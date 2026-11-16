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

  // Defaults to 'info' ('silent' under test). Use 'debug' for more detail.
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),

  // Express `trust proxy`. Set it when running behind a proxy/CDN so req.ip
  // (and so rate limiting) sees the real client IP instead of the proxy's.
  // A hop count ("1"), "true"/"false", or a subnet list ("loopback, 10.0.0.0/8").
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v): boolean | number | string => {
      if (v === undefined || v === '' || v === 'false') return false;
      if (v === 'true') return true;
      return /^\d+$/.test(v) ? Number(v) : v;
    }),

  // Shopify (filled in as the product/cart/admin routes are built)
  SHOPIFY_STORE_DOMAIN: z.string().optional(), // e.g. my-store.myshopify.com
  SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
  // Pinned so a Shopify release can't change response shapes under us.
  SHOPIFY_API_VERSION: z.string().default('2026-04'),
  SHOPIFY_ADMIN_TOKEN: z.string().optional(),

  // Admin login. SESSION_SECRET signs admin tokens: anyone who knows it can
  // mint a valid token, so it must be long, random and set in production.
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
}).superRefine((e, ctx) => {
  if (e.NODE_ENV === 'production' && !e.SESSION_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['SESSION_SECRET'],
      message: 'SESSION_SECRET is required in production',
    });
  }
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
