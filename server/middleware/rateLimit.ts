// General per-IP limit for the whole API. Stricter limits for specific routes
// live next to them (e.g. loginLimiter in auth.ts).
//
// Counts are kept in memory, so they reset on restart and aren't shared across
// instances. If you scale out, give each limiter a shared `store` (e.g. Redis).
// Behind a proxy/CDN, set TRUST_PROXY or every visitor looks like one IP.

import { rateLimit } from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120, // generous: a storefront page load fires several requests
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/healthz', // uptime monitors poll this
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

// Cart changes each call Shopify, so they get a tighter limit on top of
// apiLimiter. Reads (GET /cart/:id) aren't counted, since the frontend refetches.
export const cartWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
  message: { error: 'Too many cart updates. Please slow down and try again shortly.' },
});
