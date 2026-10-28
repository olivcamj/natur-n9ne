// Zod schemas for the admin + storage API: the single source of truth for
// runtime validation and the TypeScript types in admin.types.ts.
// Keep in sync with openapi.yaml.

import { z } from 'zod';
import { AfterParam, FirstParam } from './storefront.schemas';

export const AdminLoginInputSchema = z.object({
  password: z.string().min(1),
});

export const AdminAuthResponseSchema = z.object({
  token: z.string(),
});

export const AdminOrderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  totalPrice: z.string(),
  financialStatus: z.string(),
  fulfillmentStatus: z.string().nullable(),
  createdAt: z.string(),
  customerName: z.string(),
  itemCount: z.number().int().optional(),
});

export const AdminDashboardSchema = z.object({
  totalProducts: z.number().int(),
  totalOrders: z.number().int(),
  pendingOrders: z.number().int(),
  revenueToday: z.string(),
  revenueTotal: z.string(),
  lowStockCount: z.number().int(),
  recentOrders: z.array(AdminOrderSummarySchema),
});

/* ---------------------------------- Products --------------------------------- */

export const AdminProductStatusSchema = z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']);

export const AdminProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  description: z.string().nullish(),
  status: AdminProductStatusSchema,
  featuredImageUrl: z.string().nullish(),
  totalInventory: z.number().int(),
  variantCount: z.number().int().optional(),
  price: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).optional(),
});

export const CursorPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullish(),
});

export const AdminProductConnectionSchema = z.object({
  products: z.array(AdminProductSchema),
  pageInfo: CursorPageInfoSchema,
});

export const AdminProductUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: AdminProductStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const AdminProductImageInputSchema = z.object({
  imageUrl: z.url(),
  altText: z.string().optional(),
});

export const ListAdminProductsParamsSchema = z.object({
  first: FirstParam,
  after: AfterParam,
  query: z.string().nullish(),
});

/* ----------------------------------- Orders ---------------------------------- */

export const AdminOrderLineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  variantTitle: z.string().nullish(),
  quantity: z.number().int(),
  price: z.string(),
  imageUrl: z.string().nullish(),
});

export const AdminOrderShippingAddressSchema = z
  .object({
    address1: z.string().nullish(),
    city: z.string().nullish(),
    province: z.string().nullish(),
    country: z.string().nullish(),
    zip: z.string().nullish(),
  })
  .nullable();

export const AdminOrderSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalPrice: z.string(),
  subtotalPrice: z.string().optional(),
  financialStatus: z.string(),
  fulfillmentStatus: z.string().nullable(),
  createdAt: z.string(),
  note: z.string().nullish(),
  customerName: z.string().optional(),
  customerEmail: z.string().nullish(),
  shippingAddress: AdminOrderShippingAddressSchema.optional(),
  lineItems: z.array(AdminOrderLineItemSchema),
});

export const AdminOrderConnectionSchema = z.object({
  orders: z.array(AdminOrderSchema),
  pageInfo: CursorPageInfoSchema,
});

export const ListAdminOrdersParamsSchema = z.object({
  first: FirstParam,
  after: AfterParam,
  /** Filter by fulfillment status e.g. unfulfilled */
  status: z.string().nullish(),
});

/* ---------------------------------- Storage ---------------------------------- */

export const UploadUrlInputSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\//, 'Only image uploads are allowed'),
  folder: z.string().optional(),
});

export const UploadUrlResponseSchema = z.object({
  uploadUrl: z.string(),
  objectPath: z.string(),
  publicUrl: z.string(),
});
