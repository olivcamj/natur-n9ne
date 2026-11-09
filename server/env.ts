// Environment config, validated once at startup so a missing secret fails
// loudly at boot instead of on the first request that needs it.

import { z } from 'zod';

// Load .env from the project root if it exists. Built into Node (20.12+),
// so no dotenv dependency or version-specific CLI flag is needed.
try {
  process.loadEnvFile();
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),

  // Shopify (filled in as the product/cart/admin routes are built)
  SHOPIFY_STORE_DOMAIN: z.string().optional(), // e.g. my-store.myshopify.com
  SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
  // Pinned so a Shopify release can't change response shapes under us.
  SHOPIFY_API_VERSION: z.string().default('2026-04'),
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
