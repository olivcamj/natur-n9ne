// Environment config, validated once at startup so a missing secret fails
// loudly at boot instead of on the first request that needs it.

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),

  // Shopify (filled in as the product/cart/admin routes are built)
  SHOPIFY_STORE_DOMAIN: z.string().optional(), // e.g. my-store.myshopify.com
  SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
  SHOPIFY_ADMIN_TOKEN: z.string().optional(),

  // Admin login
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
