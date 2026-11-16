// Admin auth: one shared password (ADMIN_PASSWORD) exchanged for a signed,
// expiring bearer token. No database or sessions needed.
//
// Token format: "<expiresAtMs>.<hmac>", where the HMAC covers the expiry and
// the current password. So a token stops working when it expires *or* when
// ADMIN_PASSWORD changes (changing the password logs everyone out).

import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../env';
import { HttpError } from './errors';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Dev-only fallback; env.ts refuses to start in production without a secret.
const secret = env.SESSION_SECRET ?? 'dev-only-secret-not-for-production-use';

function requireAdminPassword(): string {
  if (!env.ADMIN_PASSWORD) {
    throw new HttpError(503, 'Admin login is not configured: set ADMIN_PASSWORD in .env');
  }
  return env.ADMIN_PASSWORD;
}

function sign(expiresAt: number, password: string) {
  return crypto.createHmac('sha256', secret).update(`${expiresAt}:${password}`).digest('hex');
}

// Constant-time comparison so response timing can't leak how much matched.
// Hashing first makes both sides the same length, as timingSafeEqual requires.
function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: string): boolean {
  return safeEqual(candidate, requireAdminPassword());
}

export function createAdminToken(): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return `${expiresAt}.${sign(expiresAt, requireAdminPassword())}`;
}

export function verifyAdminToken(token: string): boolean {
  const password = env.ADMIN_PASSWORD;
  if (!password) return false;

  const [expiresAtRaw, mac] = token.split('.');
  const expiresAt = Number(expiresAtRaw);
  if (!mac || !Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;

  return safeEqual(mac, sign(expiresAt, password));
}

export function bearerToken(header: string | undefined): string | undefined {
  return header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
}

// Put this on every admin (and admin-only storage) route.
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req.headers.authorization);
  if (token && verifyAdminToken(token)) return next();
  next(new HttpError(401, 'Unauthorized'));
};

// One shared password is easy to brute-force without this.
// Counts only failed attempts, per IP. Behind a proxy/CDN, set Express's
// `trust proxy` to match your hosting or every visitor looks like one IP.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
