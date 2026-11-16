// The login rate limiter is reset before each test (see test/setup.ts) and
// tested on its own in middleware/rateLimit.test.ts.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../env';
import { verifyAdminToken } from '../middleware/auth';
import { adminAuth, api, fetchMock, shopifyCall, shopifyReturns } from '../test/helpers';

const original = { ...env };
afterEach(() => Object.assign(env, original));

/* ---------------------------------- Fixtures --------------------------------- */

const shopifyAdminProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'gid://shopify/Product/1',
  title: 'Fern Tee',
  handle: 'fern-tee',
  status: 'ACTIVE',
  totalInventory: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  tags: ['summer'],
  descriptionHtml: '<p>Soft</p>',
  featuredImage: { url: 'https://cdn.shopify.com/tee.jpg' },
  variantsCount: { count: 3 },
  variants: { nodes: [{ price: '25.00', inventoryItem: { tracked: false } }] },
  ...overrides,
});

const adminProduct = {
  id: 'gid://shopify/Product/1',
  title: 'Fern Tee',
  handle: 'fern-tee',
  description: '<p>Soft</p>',
  status: 'ACTIVE',
  featuredImageUrl: 'https://cdn.shopify.com/tee.jpg',
  inventoryTracked: false,
  totalInventory: null,
  variantCount: 3,
  price: '25.00',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  tags: ['summer'],
};

const shopMoney = (amount: string) => ({ shopMoney: { amount } });

const shopifyOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'gid://shopify/Order/9',
  name: '#1009',
  createdAt: '2026-05-01T10:00:00Z',
  note: 'Gift wrap',
  email: 'buyer@example.com',
  displayFinancialStatus: 'PAID',
  displayFulfillmentStatus: 'FULFILLED',
  totalPriceSet: shopMoney('55.00'),
  subtotalPriceSet: shopMoney('50.00'),
  customer: { displayName: 'Sam Rivers' },
  shippingAddress: { address1: '1 Oak St', city: 'Leeds', province: null, country: 'UK', zip: 'LS1' },
  fulfillments: [
    { trackingInfo: [{ company: 'Royal Mail', number: 'RM1', url: 'https://track/rm1' }] },
    { trackingInfo: [{ company: 'DPD', number: 'D2', url: null }] },
  ],
  lineItems: {
    nodes: [
      {
        id: 'gid://shopify/LineItem/1',
        title: 'Fern Tee',
        variantTitle: 'M',
        quantity: 2,
        originalUnitPriceSet: shopMoney('25.00'),
        image: { url: 'https://cdn.shopify.com/tee.jpg' },
      },
    ],
  },
  ...overrides,
});

const adminOrder = {
  id: 'gid://shopify/Order/9',
  name: '#1009',
  totalPrice: '55.00',
  subtotalPrice: '50.00',
  financialStatus: 'PAID',
  fulfillmentStatus: 'FULFILLED',
  createdAt: '2026-05-01T10:00:00Z',
  note: 'Gift wrap',
  customerName: 'Sam Rivers',
  customerEmail: 'buyer@example.com',
  shippingAddress: { address1: '1 Oak St', city: 'Leeds', province: null, country: 'UK', zip: 'LS1' },
  tracking: [
    { company: 'Royal Mail', number: 'RM1', url: 'https://track/rm1' },
    { company: 'DPD', number: 'D2', url: null },
  ],
  lineItems: [
    {
      id: 'gid://shopify/LineItem/1',
      title: 'Fern Tee',
      variantTitle: 'M',
      quantity: 2,
      price: '25.00',
      imageUrl: 'https://cdn.shopify.com/tee.jpg',
    },
  ],
};

const cursorPage = { hasNextPage: false, endCursor: null };

/* ------------------------------------ Auth ----------------------------------- */

describe('POST /api/admin/auth/login', () => {
  it('returns a valid token for the right password', async () => {
    const res = await api().post('/api/admin/auth/login').send({ password: 'correct-horse-battery' });

    expect(res.status).toBe(200);
    expect(verifyAdminToken(res.body.token)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a 401 for the wrong password', async () => {
    const res = await api().post('/api/admin/auth/login').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid password' });
  });

  it('returns a 400 for a missing password', async () => {
    const res = await api().post('/api/admin/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns a 503 when ADMIN_PASSWORD is not configured', async () => {
    env.ADMIN_PASSWORD = undefined;
    const res = await api().post('/api/admin/auth/login').send({ password: 'anything' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/ADMIN_PASSWORD/);
  });
});

describe('admin route protection', () => {
  const routes = [
    ['get', '/api/admin/auth/me'],
    ['get', '/api/admin/products'],
    ['get', '/api/admin/products/1'],
    ['patch', '/api/admin/products/1'],
    ['put', '/api/admin/products/1/image'],
    ['get', '/api/admin/orders'],
    ['get', '/api/admin/orders/1'],
    ['get', '/api/admin/dashboard'],
  ] as const;

  it.each(routes)('%s %s returns 401 without a token', async (method, path) => {
    const res = await api()[method](path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a garbage token', 'Bearer not-a-token'],
    ['a non-bearer scheme', 'Basic dXNlcjpwYXNz'],
  ])('rejects %s', async (_label, header) => {
    const res = await api().get('/api/admin/dashboard').set('Authorization', header);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const auth = adminAuth();
    vi.setSystemTime(Date.now() + 12 * 60 * 60 * 1000 + 1);

    const res = await api().get('/api/admin/auth/me').set('Authorization', auth);
    expect(res.status).toBe(401);
  });

  it('rejects tokens issued before the password changed', async () => {
    const auth = adminAuth();
    env.ADMIN_PASSWORD = 'rotated-password';
    const res = await api().get('/api/admin/auth/me').set('Authorization', auth);
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/auth/me echoes a valid token', async () => {
    const auth = adminAuth();
    const res = await api().get('/api/admin/auth/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: auth.slice('Bearer '.length) });
  });
});

/* ---------------------------------- Products --------------------------------- */

describe('GET /api/admin/products', () => {
  it('formats products and passes default paging', async () => {
    shopifyReturns({
      products: { nodes: [shopifyAdminProduct()], pageInfo: { hasNextPage: true, endCursor: 'c1' } },
    });

    const res = await api().get('/api/admin/products').set('Authorization', adminAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      products: [adminProduct],
      pageInfo: { hasNextPage: true, endCursor: 'c1' },
    });
    expect(shopifyCall().variables).toEqual({ first: 50 });
    expect(shopifyCall().url).toContain('/admin/api/');
  });

  it('passes search and paging, capping first at 100 and dropping empty strings', async () => {
    shopifyReturns({ products: { nodes: [], pageInfo: cursorPage } });
    await api()
      .get('/api/admin/products?first=250&after=c1&query=tee')
      .set('Authorization', adminAuth());
    expect(shopifyCall().variables).toEqual({ first: 100, after: 'c1', query: 'tee' });

    shopifyReturns({ products: { nodes: [], pageInfo: cursorPage } });
    await api().get('/api/admin/products?after=&query=').set('Authorization', adminAuth());
    expect(shopifyCall(1).variables).toEqual({ first: 50 });
  });
});

describe('admin product formatting', () => {
  const format = async (overrides: Record<string, unknown>) => {
    shopifyReturns({ product: shopifyAdminProduct(overrides) });
    const res = await api().get('/api/admin/products/1').set('Authorization', adminAuth());
    return res.body;
  };

  it('reports null inventory for untracked (print-on-demand) products', async () => {
    const body = await format({ totalInventory: 0 });
    expect(body).toMatchObject({ inventoryTracked: false, totalInventory: null });
  });

  it('reports the inventory count for tracked products', async () => {
    const body = await format({
      totalInventory: 7,
      variants: { nodes: [{ price: '25.00', inventoryItem: { tracked: true } }] },
    });
    expect(body).toMatchObject({ inventoryTracked: true, totalInventory: 7 });
  });

  it('treats a null total as 0 for tracked products', async () => {
    const body = await format({
      totalInventory: null,
      variants: { nodes: [{ price: '25.00', inventoryItem: { tracked: true } }] },
    });
    expect(body.totalInventory).toBe(0);
  });

  it('handles a product with no variants, image, description or variant count', async () => {
    const body = await format({
      variants: { nodes: [] },
      featuredImage: null,
      descriptionHtml: null,
      variantsCount: null,
    });
    expect(body).toMatchObject({
      inventoryTracked: false,
      totalInventory: null,
      price: null,
      featuredImageUrl: null,
      description: null,
      variantCount: 0,
    });
  });

  it('treats a missing inventoryItem as untracked', async () => {
    const body = await format({ variants: { nodes: [{ price: '1.00', inventoryItem: null }] } });
    expect(body.inventoryTracked).toBe(false);
  });
});

describe('GET /api/admin/products/:productId', () => {
  it('converts a numeric id to a product GID', async () => {
    shopifyReturns({ product: shopifyAdminProduct() });

    const res = await api().get('/api/admin/products/123').set('Authorization', adminAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(adminProduct);
    expect(shopifyCall().variables).toEqual({ id: 'gid://shopify/Product/123' });
  });

  it('passes a full GID through unchanged', async () => {
    shopifyReturns({ product: shopifyAdminProduct() });
    const gid = 'gid://shopify/Product/123';
    await api().get(`/api/admin/products/${encodeURIComponent(gid)}`).set('Authorization', adminAuth());
    expect(shopifyCall().variables).toEqual({ id: gid });
  });

  it('returns a 404 for an unknown product', async () => {
    shopifyReturns({ product: null });
    const res = await api().get('/api/admin/products/999').set('Authorization', adminAuth());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Product not found' });
  });
});

describe('PATCH /api/admin/products/:productId', () => {
  it('sends only the fields provided and returns the updated product', async () => {
    shopifyReturns({
      productUpdate: { product: shopifyAdminProduct({ title: 'New' }), userErrors: [] },
    });

    const res = await api()
      .patch('/api/admin/products/1')
      .set('Authorization', adminAuth())
      .send({ title: 'New' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...adminProduct, title: 'New' });
    const call = shopifyCall();
    expect(call.query).toContain('mutation UpdateProduct(');
    expect(call.variables).toEqual({ product: { id: 'gid://shopify/Product/1', title: 'New' } });
  });

  it('maps description to descriptionHtml', async () => {
    shopifyReturns({ productUpdate: { product: shopifyAdminProduct(), userErrors: [] } });

    await api()
      .patch('/api/admin/products/1')
      .set('Authorization', adminAuth())
      .send({ description: '<p>New</p>', status: 'DRAFT', tags: ['a', 'b'] });

    expect(shopifyCall().variables.product).toEqual({
      id: 'gid://shopify/Product/1',
      descriptionHtml: '<p>New</p>',
      status: 'DRAFT',
      tags: ['a', 'b'],
    });
  });

  it.each([
    ['an empty title', { title: '' }],
    ['an unknown status', { status: 'DELETED' }],
    ['non-string tags', { tags: [1, 2] }],
  ])('rejects %s with a 400', async (_label, body) => {
    const res = await api()
      .patch('/api/admin/products/1')
      .set('Authorization', adminAuth())
      .send(body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('joins Shopify userErrors into a 400', async () => {
    shopifyReturns({
      productUpdate: {
        product: null,
        userErrors: [
          { field: ['title'], message: 'Title is too long' },
          { field: null, message: 'Handle taken' },
        ],
      },
    });
    const res = await api()
      .patch('/api/admin/products/1')
      .set('Authorization', adminAuth())
      .send({ title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Title is too long, Handle taken' });
  });

  it('returns a 404 when no product comes back', async () => {
    shopifyReturns({ productUpdate: { product: null, userErrors: [] } });
    const res = await api()
      .patch('/api/admin/products/1')
      .set('Authorization', adminAuth())
      .send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/products/:productId/image', () => {
  const imageUrl = 'https://shopify-staged-uploads.storage.googleapis.com/tmp/1/photo.jpg';

  it('adds the image as extra media, then returns the refetched product', async () => {
    shopifyReturns({ productUpdate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } });
    shopifyReturns({ product: shopifyAdminProduct() });

    const res = await api()
      .put('/api/admin/products/1/image')
      .set('Authorization', adminAuth())
      .send({ imageUrl, altText: 'Model shot' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(adminProduct);

    const add = shopifyCall(0);
    expect(add.query).toContain('mutation AddProductImage(');
    expect(add.variables).toEqual({
      product: { id: 'gid://shopify/Product/1' },
      media: [{ originalSource: imageUrl, alt: 'Model shot', mediaContentType: 'IMAGE' }],
    });
    expect(shopifyCall(1).variables).toEqual({ id: 'gid://shopify/Product/1' });
  });

  it('defaults alt text to an empty string', async () => {
    shopifyReturns({ productUpdate: { product: { id: 'x' }, userErrors: [] } });
    shopifyReturns({ product: shopifyAdminProduct() });

    await api().put('/api/admin/products/1/image').set('Authorization', adminAuth()).send({ imageUrl });

    expect((shopifyCall().variables.media as { alt: string }[])[0].alt).toBe('');
  });

  it('rejects a non-URL imageUrl', async () => {
    const res = await api()
      .put('/api/admin/products/1/image')
      .set('Authorization', adminAuth())
      .send({ imageUrl: 'not a url' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns userErrors as a 400 and does not refetch', async () => {
    shopifyReturns({
      productUpdate: { product: null, userErrors: [{ message: 'Invalid media source' }] },
    });
    const res = await api()
      .put('/api/admin/products/1/image')
      .set('Authorization', adminAuth())
      .send({ imageUrl });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid media source' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/* ----------------------------------- Orders ---------------------------------- */

describe('GET /api/admin/orders', () => {
  it('formats orders, flattening tracking across fulfillments', async () => {
    shopifyReturns({ orders: { nodes: [shopifyOrder()], pageInfo: cursorPage } });

    const res = await api().get('/api/admin/orders').set('Authorization', adminAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ orders: [adminOrder], pageInfo: cursorPage });
    expect(shopifyCall().variables).toEqual({ first: 25 });
  });

  it('fills in defaults for guest and unpaid orders', async () => {
    shopifyReturns({
      orders: {
        nodes: [
          shopifyOrder({
            customer: null,
            email: null,
            note: null,
            displayFinancialStatus: null,
            displayFulfillmentStatus: null,
            subtotalPriceSet: null,
            shippingAddress: null,
            fulfillments: [],
          }),
        ],
        pageInfo: cursorPage,
      },
    });

    const res = await api().get('/api/admin/orders').set('Authorization', adminAuth());

    expect(res.body.orders[0]).toMatchObject({
      customerName: 'Guest',
      customerEmail: null,
      note: null,
      financialStatus: 'PENDING',
      fulfillmentStatus: null,
      subtotalPrice: '0',
      shippingAddress: null,
      tracking: [],
    });
  });

  it('filters by fulfillment status and caps first at 100', async () => {
    shopifyReturns({ orders: { nodes: [], pageInfo: cursorPage } });
    await api()
      .get('/api/admin/orders?status=unfulfilled&first=200&after=c9')
      .set('Authorization', adminAuth());
    expect(shopifyCall().variables).toEqual({
      first: 100,
      after: 'c9',
      query: 'fulfillment_status:unfulfilled',
    });
  });

  it.each(['unfulfilled OR status:any', 'a:b', 'x y', 'unfulfilled)'])(
    'rejects status=%j to prevent search-syntax injection',
    async (status) => {
      const res = await api()
        .get(`/api/admin/orders?status=${encodeURIComponent(status)}`)
        .set('Authorization', adminAuth());
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid status filter' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe('GET /api/admin/orders/:orderId', () => {
  it('converts a numeric id to an order GID', async () => {
    shopifyReturns({ order: shopifyOrder() });

    const res = await api().get('/api/admin/orders/9').set('Authorization', adminAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(adminOrder);
    expect(shopifyCall().variables).toEqual({ id: 'gid://shopify/Order/9' });
  });

  it('returns a 404 for an unknown order', async () => {
    shopifyReturns({ order: null });
    const res = await api().get('/api/admin/orders/404').set('Authorization', adminAuth());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Order not found' });
  });
});

/* --------------------------------- Dashboard --------------------------------- */

describe('GET /api/admin/dashboard', () => {
  const tracked = (t: boolean | null) => ({
    variants: { nodes: t === null ? [] : [{ inventoryItem: { tracked: t } }] },
  });

  const dashboardData = {
    recentOrders: {
      nodes: [
        {
          id: 'gid://shopify/Order/9',
          name: '#1009',
          createdAt: '2026-05-01T10:00:00Z',
          displayFinancialStatus: 'PAID',
          displayFulfillmentStatus: 'UNFULFILLED',
          totalPriceSet: shopMoney('55.00'),
          customer: { displayName: 'Sam Rivers' },
          lineItems: { nodes: [{ quantity: 2 }, { quantity: 3 }] },
        },
        {
          id: 'gid://shopify/Order/8',
          name: '#1008',
          createdAt: '2026-04-30T10:00:00Z',
          displayFinancialStatus: null,
          displayFulfillmentStatus: null,
          totalPriceSet: shopMoney('10.00'),
          customer: null,
          lineItems: { nodes: [] },
        },
      ],
    },
    todayOrders: {
      nodes: [
        { totalPriceSet: shopMoney('10.10') },
        { totalPriceSet: shopMoney('20.20') },
        { totalPriceSet: shopMoney('0.05') },
      ],
    },
    productsCount: { count: 42 },
    ordersCount: { count: 314 },
    delayedOrders: {
      nodes: [
        { cancelledAt: null, displayFulfillmentStatus: 'UNFULFILLED' },
        { cancelledAt: null, displayFulfillmentStatus: 'PARTIALLY_FULFILLED' },
        { cancelledAt: null, displayFulfillmentStatus: 'ON_HOLD' },
        { cancelledAt: '2026-04-01T00:00:00Z', displayFulfillmentStatus: 'UNFULFILLED' }, // cancelled
        { cancelledAt: null, displayFulfillmentStatus: 'FULFILLED' }, // search filter was stale
        { cancelledAt: null, displayFulfillmentStatus: null },
      ],
    },
    lowStockCandidates: {
      nodes: [tracked(true), tracked(true), tracked(false), tracked(null)],
    },
  };

  it('summarises the store', async () => {
    shopifyReturns(dashboardData);

    const res = await api().get('/api/admin/dashboard').set('Authorization', adminAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalProducts: 42,
      totalOrders: 314,
      delayedOrders: 3, // excludes cancelled, fulfilled and unknown status
      revenueToday: '30.35',
      revenueTotal: '0',
      lowStockCount: 2, // untracked products excluded
      recentOrders: [
        {
          id: 'gid://shopify/Order/9',
          name: '#1009',
          totalPrice: '55.00',
          financialStatus: 'PAID',
          fulfillmentStatus: 'UNFULFILLED',
          createdAt: '2026-05-01T10:00:00Z',
          customerName: 'Sam Rivers',
          itemCount: 5,
        },
        {
          id: 'gid://shopify/Order/8',
          name: '#1008',
          totalPrice: '10.00',
          financialStatus: 'PENDING',
          fulfillmentStatus: null,
          createdAt: '2026-04-30T10:00:00Z',
          customerName: 'Guest',
          itemCount: 0,
        },
      ],
    });
  });

  it('builds the date-based search queries from the current time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T14:30:00Z'));
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    shopifyReturns(dashboardData);
    await api().get('/api/admin/dashboard').set('Authorization', adminAuth());

    expect(shopifyCall().variables).toEqual({
      todayQuery: `created_at:>=${startOfToday.toISOString()}`,
      delayedQuery:
        'fulfillment_status:unfulfilled AND created_at:<=2026-06-10T14:30:00.000Z AND created_at:>=2026-04-16T14:30:00.000Z',
      lowStockQuery: 'status:active AND inventory_total:<=5',
    });
  });

  it('reports 0.00 revenue on a day with no orders', async () => {
    shopifyReturns({ ...dashboardData, todayOrders: { nodes: [] } });
    const res = await api().get('/api/admin/dashboard').set('Authorization', adminAuth());
    expect(res.body.revenueToday).toBe('0.00');
  });

  it('returns a 503 when the Admin API token is not configured', async () => {
    env.SHOPIFY_ADMIN_TOKEN = undefined;
    const res = await api().get('/api/admin/dashboard').set('Authorization', adminAuth());
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/SHOPIFY_ADMIN_TOKEN/);
  });
});
