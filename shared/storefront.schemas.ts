// Zod schemas for the storefront API: the single source of truth for both
// runtime validation (Express request bodies/params, client forms) and the
// TypeScript types in storefront.types.ts, which are inferred from these.
// Keep in sync with openapi.yaml.

import { z } from 'zod';

export const HealthStatusSchema = z.object({
  status: z.string(),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
});

export const MoneySchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

// Loose image shape Shopify returns for featured/variant/collection images.
export const ImageSchema = z
  .object({
    url: z.string().optional(),
    altText: z.string().nullish(),
  })
  .nullable();

export const StoreInfoSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  currencyCode: z.string(),
  moneyFormat: z.string().optional(),
});

/* ---------------------------------- Products --------------------------------- */

export const ProductImageSchema = z.object({
  url: z.string(),
  altText: z.string().nullish(),
  width: z.number().int().nullish(),
  height: z.number().int().nullish(),
});

export const SelectedOptionSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const ProductVariantCompareAtPriceSchema = z
  .object({
    amount: z.string().optional(),
    currencyCode: z.string().optional(),
  })
  .nullable();

export const ProductVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  quantityAvailable: z.number().int().nullish(),
  price: MoneySchema,
  compareAtPrice: ProductVariantCompareAtPriceSchema.optional(),
  selectedOptions: z.array(SelectedOptionSchema).optional(),
  image: ImageSchema.optional(),
});

export const ProductPriceRangeSchema = z.object({
  minVariantPrice: MoneySchema,
  maxVariantPrice: MoneySchema,
});

export const ProductOptionsItemSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
});

export const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  descriptionHtml: z.string().optional(),
  availableForSale: z.boolean(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featuredImage: ImageSchema.optional(),
  images: z.array(ProductImageSchema),
  priceRange: ProductPriceRangeSchema,
  variants: z.array(ProductVariantSchema),
  options: z.array(ProductOptionsItemSchema).optional(),
});

export const ProductConnectionPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullish(),
  endCursor: z.string().nullish(),
});

export const ProductConnectionSchema = z.object({
  products: z.array(ProductSchema),
  pageInfo: ProductConnectionPageInfoSchema,
});

/* ------------------------------- Query params -------------------------------- */
// Query strings arrive as strings on the server, so numbers/booleans are coerced.

export const FirstParam = z.coerce.number().int().min(1).max(250).optional();
export const AfterParam = z.string().nullish();

export const ListProductsSortKeySchema = z.enum([
  'TITLE',
  'PRICE',
  'BEST_SELLING',
  'CREATED_AT',
  'RELEVANCE',
]);

export const ListProductsParamsSchema = z.object({
  first: FirstParam,
  after: AfterParam,
  collectionHandle: z.string().nullish(),
  sortKey: ListProductsSortKeySchema.optional(),
  reverse: z.union([z.boolean(), z.stringbool()]).optional(),
});

export const GetFeaturedProductsParamsSchema = z.object({
  first: FirstParam,
});

export const ListCollectionsParamsSchema = z.object({
  first: FirstParam,
});

/* -------------------------------- Collections -------------------------------- */

export const CollectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  description: z.string().optional(),
  image: ImageSchema.optional(),
});

/* ------------------------------------ Cart ----------------------------------- */

export const CartLineMerchandiseProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  featuredImage: ImageSchema.optional(),
});

export const CartLineMerchandiseSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: MoneySchema.optional(),
  image: ImageSchema.optional(),
  selectedOptions: z.array(SelectedOptionSchema).optional(),
  product: CartLineMerchandiseProductSchema,
});

export const CartLineSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  merchandise: CartLineMerchandiseSchema,
  cost: z.object({ totalAmount: MoneySchema }),
});

export const CartSchema = z.object({
  id: z.string(),
  checkoutUrl: z.string(),
  totalQuantity: z.number().int(),
  lines: z.array(CartLineSchema),
  cost: z.object({
    totalAmount: MoneySchema,
    subtotalAmount: MoneySchema,
  }),
});

export const CartLineInputSchema = z.object({
  /** Shopify ProductVariant GID */
  variantId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const CartInputSchema = CartLineInputSchema;

export const CartLineUpdateSchema = z.object({
  quantity: z.number().int().min(0),
});

export const CheckoutUrlResponseSchema = z.object({
  checkoutUrl: z.string(),
});
