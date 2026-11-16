// Runs before every server test file, before any app code is imported.

import { afterEach, beforeEach, vi } from 'vitest';
import { fetchMock } from './fetch-mock';

// Never read the developer's real .env: tests must be hermetic and must never
// hit a real Shopify store with real credentials.
vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {});

Object.assign(process.env, {
  NODE_ENV: 'test',
  SHOPIFY_STORE_DOMAIN: 'test-shop.myshopify.com',
  SHOPIFY_STOREFRONT_TOKEN: 'storefront-token',
  SHOPIFY_ADMIN_TOKEN: 'admin-token',
  SHOPIFY_API_VERSION: '2026-04',
  ADMIN_PASSWORD: 'correct-horse-battery',
  SESSION_SECRET: 'test-session-secret-that-is-long-enough',
});

// Rate limiters are module-level, so their counts would otherwise carry over
// between tests in a file. supertest's client is 127.0.0.1 (or ::1, which the
// limiter keys by its /56 subnet).
const LOCAL_KEYS = ['127.0.0.1', '::/56'];

beforeEach(async () => {
  // All Shopify traffic goes through global fetch; stub it per test.
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  // Imported lazily: a static import would load env.ts before the vars above are set.
  const { apiLimiter, cartWriteLimiter } = await import('../middleware/rateLimit');
  const { loginLimiter } = await import('../middleware/auth');
  for (const limiter of [apiLimiter, cartWriteLimiter, loginLimiter]) {
    for (const key of LOCAL_KEYS) await limiter.resetKey(key);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
