// Cross boundary types. Both the React frontend and Express backend
// import these so that an API response and the type describing it can't drift apart.
// Types only: every type is inferred from the Zod schemas in storefront.schemas.ts,
// and `import type` is erased at compile time, so importing from here adds
// nothing (not even zod) to either bundle.

import type { z } from 'zod';
import type * as S from './storefront.schemas';

export type HealthStatus = z.infer<typeof S.HealthStatusSchema>;
export type ApiError = z.infer<typeof S.ApiErrorSchema>;
export type Money = z.infer<typeof S.MoneySchema>;
export type StoreInfo = z.infer<typeof S.StoreInfoSchema>;

/* ---------------------------------- Products --------------------------------- */

export type ProductImage = z.infer<typeof S.ProductImageSchema>;
export type ProductFeaturedImage = z.infer<typeof S.ImageSchema>;
export type ProductVariantImage = z.infer<typeof S.ImageSchema>;
export type ProductVariantCompareAtPrice = z.infer<typeof S.ProductVariantCompareAtPriceSchema>;
export type ProductVariantSelectedOptionsItem = z.infer<typeof S.SelectedOptionSchema>;
export type ProductVariant = z.infer<typeof S.ProductVariantSchema>;
export type ProductPriceRange = z.infer<typeof S.ProductPriceRangeSchema>;
export type ProductOptionsItem = z.infer<typeof S.ProductOptionsItemSchema>;
export type Product = z.infer<typeof S.ProductSchema>;
export type ProductConnectionPageInfo = z.infer<typeof S.ProductConnectionPageInfoSchema>;
export type ProductConnection = z.infer<typeof S.ProductConnectionSchema>;

export type ListProductsSortKey = z.infer<typeof S.ListProductsSortKeySchema>;
export type ListProductsParams = z.infer<typeof S.ListProductsParamsSchema>;
export type GetFeaturedProductsParams = z.infer<typeof S.GetFeaturedProductsParamsSchema>;

/* -------------------------------- Collections -------------------------------- */

export type CollectionImage = z.infer<typeof S.ImageSchema>;
export type Collection = z.infer<typeof S.CollectionSchema>;
export type ListCollectionsParams = z.infer<typeof S.ListCollectionsParamsSchema>;

/* ------------------------------------ Cart ----------------------------------- */

export type CartLineMerchandiseImage = z.infer<typeof S.ImageSchema>;
export type CartLineMerchandiseSelectedOptionsItem = z.infer<typeof S.SelectedOptionSchema>;
export type CartLineMerchandiseProductFeaturedImage = z.infer<typeof S.ImageSchema>;
export type CartLineMerchandiseProduct = z.infer<typeof S.CartLineMerchandiseProductSchema>;
export type CartLineMerchandise = z.infer<typeof S.CartLineMerchandiseSchema>;
export type CartLine = z.infer<typeof S.CartLineSchema>;
export type Cart = z.infer<typeof S.CartSchema>;
export type CartInput = z.infer<typeof S.CartInputSchema>;
export type CartLineInput = z.infer<typeof S.CartLineInputSchema>;
export type CartLineUpdate = z.infer<typeof S.CartLineUpdateSchema>;
export type CheckoutUrlResponse = z.infer<typeof S.CheckoutUrlResponseSchema>;
