// Admin + storage API types, shared with the Express backend.
// Types only: every type is inferred from the Zod schemas in admin.schemas.ts.

import type { z } from 'zod';
import type * as S from './admin.schemas';

export type AdminLoginInput = z.infer<typeof S.AdminLoginInputSchema>;
export type AdminAuthResponse = z.infer<typeof S.AdminAuthResponseSchema>;
export type AdminOrderSummary = z.infer<typeof S.AdminOrderSummarySchema>;
export type AdminDashboard = z.infer<typeof S.AdminDashboardSchema>;

/* ---------------------------------- Products --------------------------------- */

export type AdminProductStatus = z.infer<typeof S.AdminProductStatusSchema>;
export type AdminProduct = z.infer<typeof S.AdminProductSchema>;
export type AdminProductConnectionPageInfo = z.infer<typeof S.CursorPageInfoSchema>;
export type AdminProductConnection = z.infer<typeof S.AdminProductConnectionSchema>;
export type AdminProductUpdate = z.infer<typeof S.AdminProductUpdateSchema>;
export type AdminProductImageInput = z.infer<typeof S.AdminProductImageInputSchema>;
export type ListAdminProductsParams = z.infer<typeof S.ListAdminProductsParamsSchema>;

/* ----------------------------------- Orders ---------------------------------- */

export type AdminOrderLineItem = z.infer<typeof S.AdminOrderLineItemSchema>;
export type AdminOrderShippingAddress = z.infer<typeof S.AdminOrderShippingAddressSchema>;
export type AdminOrderTracking = z.infer<typeof S.AdminOrderTrackingSchema>;
export type AdminOrder = z.infer<typeof S.AdminOrderSchema>;
export type AdminOrderConnectionPageInfo = z.infer<typeof S.CursorPageInfoSchema>;
export type AdminOrderConnection = z.infer<typeof S.AdminOrderConnectionSchema>;
export type ListAdminOrdersParams = z.infer<typeof S.ListAdminOrdersParamsSchema>;

/* ---------------------------------- Storage ---------------------------------- */

export type UploadUrlInput = z.infer<typeof S.UploadUrlInputSchema>;
export type UploadUrlResponse = z.infer<typeof S.UploadUrlResponseSchema>;
