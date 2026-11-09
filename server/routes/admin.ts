import { Router } from 'express';
import type {
  AdminAuthResponse,
  AdminDashboard,
  AdminOrder,
  AdminOrderConnection,
  AdminOrderSummary,
  AdminProduct,
  AdminProductConnection,
} from '@shared/admin.types';
import {
  AdminLoginInputSchema,
  AdminProductImageInputSchema,
  AdminProductUpdateSchema,
  ListAdminOrdersParamsSchema,
  ListAdminProductsParamsSchema,
} from '@shared/admin.schemas';
import { shopifyAdminRequest } from '../lib/shopify';
import {
  bearerToken,
  checkPassword,
  createAdminToken,
  loginLimiter,
  requireAdmin,
} from '../middleware/auth';
import { HttpError } from '../middleware/errors';
import { parse } from '../middleware/validate';

export const adminRouter = Router();

/* ----------------------------------- Auth ------------------------------------ */

// POST /api/admin/auth/login (the only public admin route)
adminRouter.post('/admin/auth/login', loginLimiter, (req, res) => {
  const { password } = parse(AdminLoginInputSchema, req.body);
  if (!checkPassword(password)) throw new HttpError(401, 'Invalid password');

  const body: AdminAuthResponse = { token: createAdminToken() };
  res.json(body);
});

// Everything below this line requires a valid admin token.
adminRouter.use('/admin', requireAdmin);

// GET /api/admin/auth/me
adminRouter.get('/admin/auth/me', (req, res) => {
  const body: AdminAuthResponse = { token: bearerToken(req.headers.authorization)! };
  res.json(body);
});

/* --------------------------------- Helpers ----------------------------------- */

// Accept either a full GID or the numeric id from the end of one.
const toGid = (type: 'Product' | 'Order', id: string) =>
  id.startsWith('gid://') ? id : `gid://shopify/${type}/${id}`;

type MoneySet = { shopMoney: { amount: string } };
type UserError = { field?: string[] | null; message: string };

function throwUserErrors(errors: UserError[] | undefined) {
  if (errors?.length) throw new HttpError(400, errors.map((e) => e.message).join(', '));
}

/* --------------------------------- Products ---------------------------------- */

const ADMIN_PRODUCT_FIELDS = `
  id title handle status totalInventory createdAt updatedAt tags
  descriptionHtml
  featuredImage { url }
  variantsCount { count }
  variants(first: 1) { nodes { price inventoryItem { tracked } } }
`;

type ShopifyAdminProduct = {
  id: string;
  title: string;
  handle: string;
  status: AdminProduct['status'];
  totalInventory: number | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  descriptionHtml: string | null;
  featuredImage: { url: string } | null;
  variantsCount: { count: number } | null;
  variants: { nodes: { price: string; inventoryItem: { tracked: boolean } | null }[] };
};

function formatAdminProduct(p: ShopifyAdminProduct): AdminProduct {
  // Print-on-demand items usually don't track inventory (the supplier holds
  // the stock), and Shopify then reports 0, which reads as "sold out". The
  // first variant is used as the product's setting; Tapstitch products are
  // set up the same way across variants.
  const inventoryTracked = p.variants.nodes[0]?.inventoryItem?.tracked ?? false;

  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    // HTML, so what the admin edits is what PATCH saves back as descriptionHtml.
    description: p.descriptionHtml ?? null,
    status: p.status,
    featuredImageUrl: p.featuredImage?.url ?? null,
    inventoryTracked,
    totalInventory: inventoryTracked ? (p.totalInventory ?? 0) : null,
    variantCount: p.variantsCount?.count ?? 0,
    price: p.variants.nodes[0]?.price ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    tags: p.tags,
  };
}

async function fetchAdminProduct(gid: string): Promise<AdminProduct> {
  const data = await shopifyAdminRequest<{ product: ShopifyAdminProduct | null }>(
    `query AdminProduct($id: ID!) { product(id: $id) { ${ADMIN_PRODUCT_FIELDS} } }`,
    { id: gid },
  );
  if (!data.product) throw new HttpError(404, 'Product not found');
  return formatAdminProduct(data.product);
}

// GET /api/admin/products
adminRouter.get('/admin/products', async (req, res) => {
  const params = parse(ListAdminProductsParamsSchema, req.query);

  const data = await shopifyAdminRequest<{
    products: { nodes: ShopifyAdminProduct[]; pageInfo: AdminProductConnection['pageInfo'] };
  }>(
    `query AdminProducts($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
        nodes { ${ADMIN_PRODUCT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: Math.min(params.first ?? 50, 100),
      after: params.after || undefined,
      query: params.query || undefined,
    },
  );

  const body: AdminProductConnection = {
    products: data.products.nodes.map(formatAdminProduct),
    pageInfo: data.products.pageInfo,
  };
  res.json(body);
});

// GET /api/admin/products/:productId
adminRouter.get('/admin/products/:productId', async (req, res) => {
  res.json(await fetchAdminProduct(toGid('Product', req.params.productId)));
});

// PATCH /api/admin/products/:productId
adminRouter.patch('/admin/products/:productId', async (req, res) => {
  const { title, description, status, tags } = parse(AdminProductUpdateSchema, req.body);

  const data = await shopifyAdminRequest<{
    productUpdate: { product: ShopifyAdminProduct | null; userErrors: UserError[] };
  }>(
    `mutation UpdateProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { ${ADMIN_PRODUCT_FIELDS} }
        userErrors { field message }
      }
    }`,
    {
      // Undefined fields are dropped by JSON.stringify, so only sent fields change.
      product: {
        id: toGid('Product', req.params.productId),
        title,
        descriptionHtml: description,
        status,
        tags,
      },
    },
  );

  throwUserErrors(data.productUpdate.userErrors);
  if (!data.productUpdate.product) throw new HttpError(404, 'Product not found');

  res.json(formatAdminProduct(data.productUpdate.product));
});

// PUT /api/admin/products/:productId/image
// Adds an EXTRA storefront photo (lifestyle/model shots). It does NOT change
// the printed design: Tapstitch prints the artwork stored in Tapstitch, so a
// design change must be republished from Tapstitch as a new product.
// Additive only, on purpose: it never removes or reorders existing media, so
// the supplier's mockups stay first and stay accurate.
// Shopify processes media asynchronously, so the returned product may not
// show the new image for a few seconds.
adminRouter.put('/admin/products/:productId/image', async (req, res) => {
  const { imageUrl, altText } = parse(AdminProductImageInputSchema, req.body);
  const gid = toGid('Product', req.params.productId);

  const data = await shopifyAdminRequest<{
    productUpdate: { product: { id: string } | null; userErrors: UserError[] };
  }>(
    `mutation AddProductImage($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product { id }
        userErrors { field message }
      }
    }`,
    {
      product: { id: gid },
      media: [{ originalSource: imageUrl, alt: altText ?? '', mediaContentType: 'IMAGE' }],
    },
  );

  throwUserErrors(data.productUpdate.userErrors);
  res.json(await fetchAdminProduct(gid));
});

/* ---------------------------------- Orders ----------------------------------- */

const ORDER_FIELDS = `
  id name createdAt note email
  displayFinancialStatus displayFulfillmentStatus
  totalPriceSet { shopMoney { amount } }
  subtotalPriceSet { shopMoney { amount } }
  customer { displayName }
  shippingAddress { address1 city province country zip }
  fulfillments(first: 10) { trackingInfo(first: 10) { company number url } }
  lineItems(first: 50) {
    nodes {
      id title variantTitle quantity
      originalUnitPriceSet { shopMoney { amount } }
      image { url }
    }
  }
`;

type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  note: string | null;
  email: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: MoneySet;
  subtotalPriceSet: MoneySet | null;
  customer: { displayName: string } | null;
  shippingAddress: AdminOrder['shippingAddress'];
  fulfillments: { trackingInfo: AdminOrder['tracking'] }[];
  lineItems: {
    nodes: {
      id: string;
      title: string;
      variantTitle: string | null;
      quantity: number;
      originalUnitPriceSet: MoneySet;
      image: { url: string } | null;
    }[];
  };
};

function formatAdminOrder(o: ShopifyOrder): AdminOrder {
  return {
    id: o.id,
    name: o.name,
    totalPrice: o.totalPriceSet.shopMoney.amount,
    subtotalPrice: o.subtotalPriceSet?.shopMoney.amount ?? '0',
    financialStatus: o.displayFinancialStatus ?? 'PENDING',
    fulfillmentStatus: o.displayFulfillmentStatus ?? null,
    createdAt: o.createdAt,
    note: o.note,
    customerName: o.customer?.displayName ?? 'Guest',
    customerEmail: o.email,
    shippingAddress: o.shippingAddress ?? null,
    // One order can ship in several packages; flatten to one list of parcels.
    tracking: o.fulfillments.flatMap((f) => f.trackingInfo),
    lineItems: o.lineItems.nodes.map((li) => ({
      id: li.id,
      title: li.title,
      variantTitle: li.variantTitle,
      quantity: li.quantity,
      price: li.originalUnitPriceSet.shopMoney.amount,
      imageUrl: li.image?.url ?? null,
    })),
  };
}

// Status goes into Shopify's search syntax, so only allow plain words
// (e.g. "unfulfilled") rather than arbitrary search expressions.
const FULFILLMENT_STATUS = /^[a-z_]+$/i;

// GET /api/admin/orders
adminRouter.get('/admin/orders', async (req, res) => {
  const params = parse(ListAdminOrdersParamsSchema, req.query);
  if (params.status && !FULFILLMENT_STATUS.test(params.status)) {
    throw new HttpError(400, 'Invalid status filter');
  }

  const data = await shopifyAdminRequest<{
    orders: { nodes: ShopifyOrder[]; pageInfo: AdminOrderConnection['pageInfo'] };
  }>(
    `query AdminOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
        nodes { ${ORDER_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: Math.min(params.first ?? 25, 100),
      after: params.after || undefined,
      query: params.status ? `fulfillment_status:${params.status}` : undefined,
    },
  );

  const body: AdminOrderConnection = {
    orders: data.orders.nodes.map(formatAdminOrder),
    pageInfo: data.orders.pageInfo,
  };
  res.json(body);
});

// GET /api/admin/orders/:orderId
adminRouter.get('/admin/orders/:orderId', async (req, res) => {
  const data = await shopifyAdminRequest<{ order: ShopifyOrder | null }>(
    `query AdminOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
    { id: toGid('Order', req.params.orderId) },
  );
  if (!data.order) throw new HttpError(404, 'Order not found');

  res.json(formatAdminOrder(data.order));
});

/* -------------------------------- Dashboard ---------------------------------- */

const LOW_STOCK_THRESHOLD = 5;

// An order still unfulfilled this long after purchase is worth chasing with
// the supplier. Set it to Tapstitch's production time plus a buffer.
const DELAYED_AFTER_DAYS = 5;
// Default read_orders access only covers the last 60 days of orders.
const ORDER_LOOKBACK_DAYS = 60;
const DELAYED_STATUSES = new Set(['UNFULFILLED', 'PARTIALLY_FULFILLED', 'ON_HOLD']);

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// GET /api/admin/dashboard
adminRouter.get('/admin/dashboard', async (_req, res) => {
  // Midnight in the server's timezone. If the server and shop timezones
  // differ (common on hosted servers, which run in UTC), "today" will be off.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const delayedCutoff = daysAgo(DELAYED_AFTER_DAYS).toISOString();
  const lookbackStart = daysAgo(ORDER_LOOKBACK_DAYS).toISOString();

  const data = await shopifyAdminRequest<{
    recentOrders: {
      nodes: (Pick<
        ShopifyOrder,
        'id' | 'name' | 'createdAt' | 'displayFinancialStatus' | 'displayFulfillmentStatus' | 'totalPriceSet' | 'customer'
      > & { lineItems: { nodes: { quantity: number }[] } })[];
    };
    todayOrders: { nodes: { totalPriceSet: MoneySet }[] };
    productsCount: { count: number };
    ordersCount: { count: number };
    delayedOrders: {
      nodes: { cancelledAt: string | null; displayFulfillmentStatus: string | null }[];
    };
    lowStockCandidates: {
      nodes: { variants: { nodes: { inventoryItem: { tracked: boolean } | null }[] } }[];
    };
  }>(
    `query Dashboard($todayQuery: String!, $delayedQuery: String!, $lowStockQuery: String!) {
      recentOrders: orders(first: 5, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id name createdAt displayFinancialStatus displayFulfillmentStatus
          totalPriceSet { shopMoney { amount } }
          customer { displayName }
          lineItems(first: 50) { nodes { quantity } }
        }
      }
      todayOrders: orders(first: 250, query: $todayQuery) {
        nodes { totalPriceSet { shopMoney { amount } } }
      }
      productsCount { count }
      ordersCount { count }
      delayedOrders: orders(first: 100, sortKey: CREATED_AT, reverse: true, query: $delayedQuery) {
        nodes { cancelledAt displayFulfillmentStatus }
      }
      lowStockCandidates: products(first: 250, query: $lowStockQuery) {
        nodes { variants(first: 1) { nodes { inventoryItem { tracked } } } }
      }
    }`,
    {
      todayQuery: `created_at:>=${startOfToday.toISOString()}`,
      delayedQuery: `fulfillment_status:unfulfilled AND created_at:<=${delayedCutoff} AND created_at:>=${lookbackStart}`,
      lowStockQuery: `status:active AND inventory_total:<=${LOW_STOCK_THRESHOLD}`,
    },
  );

  // Re-check in code rather than trusting the search filter alone, and skip
  // cancelled orders (they can stay "unfulfilled" forever). Capped at 100.
  const delayedOrders = data.delayedOrders.nodes.filter(
    (o) => !o.cancelledAt && DELAYED_STATUSES.has(o.displayFulfillmentStatus ?? ''),
  ).length;

  // Untracked products report 0 inventory, so only count tracked ones.
  const lowStockCount = data.lowStockCandidates.nodes.filter(
    (p) => p.variants.nodes[0]?.inventoryItem?.tracked,
  ).length;

  const recentOrders: AdminOrderSummary[] = data.recentOrders.nodes.map((o) => ({
    id: o.id,
    name: o.name,
    totalPrice: o.totalPriceSet.shopMoney.amount,
    financialStatus: o.displayFinancialStatus ?? 'PENDING',
    fulfillmentStatus: o.displayFulfillmentStatus ?? null,
    createdAt: o.createdAt,
    customerName: o.customer?.displayName ?? 'Guest',
    itemCount: o.lineItems.nodes.reduce((sum, li) => sum + li.quantity, 0),
  }));

  // Sums the first 250 orders of the day; a busier day would undercount.
  const revenueToday = data.todayOrders.nodes
    .reduce((sum, o) => sum + Number(o.totalPriceSet.shopMoney.amount), 0)
    .toFixed(2);

  const body: AdminDashboard = {
    totalProducts: data.productsCount.count,
    totalOrders: data.ordersCount.count,
    delayedOrders,
    revenueToday,
    // TODO: all-time revenue has no cheap Admin API query (needs ShopifyQL
    // analytics with read_reports, or summing every order). Placeholder for now.
    revenueTotal: '0',
    lowStockCount,
    recentOrders,
  };
  res.json(body);
});
