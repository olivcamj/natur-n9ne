// Limiter counts are reset before each test (see test/setup.ts).

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { fetchMock } from '../test/helpers';

const CART_ID = encodeURIComponent('gid://shopify/Cart/c1?key=abc');

async function hit(n: number, send: () => request.Test) {
  for (let i = 0; i < n; i++) await send();
}

describe('apiLimiter', () => {
  it('allows 120 API requests per minute, then returns 429', async () => {
    const app = createApp();
    const get = () => request(app).get('/api/nope'); // cheap: no Shopify call

    await hit(120, get);
    const res = await get();

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests. Please slow down and try again shortly.' });
    expect(res.headers['ratelimit-policy']).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined(); // legacy headers off
  });

  it('does not count health checks', async () => {
    const app = createApp();
    await hit(130, () => request(app).get('/api/healthz'));

    expect((await request(app).get('/api/healthz')).status).toBe(200);
    expect((await request(app).get('/api/nope')).status).toBe(404);
  });

  it('does not apply outside /api', async () => {
    const app = createApp();
    await hit(121, () => request(app).get('/api/nope'));
    expect((await request(app).get('/not-api')).status).not.toBe(429);
  });
});

describe('cartWriteLimiter', () => {
  // An empty body fails validation before Shopify is called, but still counts.
  const write = (app: ReturnType<typeof createApp>) => request(app).post('/api/cart').send({});

  it('allows 30 cart writes per minute, then returns 429', async () => {
    const app = createApp();
    await hit(30, () => write(app));

    const res = await write(app);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many cart updates. Please slow down and try again shortly.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts every write method on /api/cart', async () => {
    const app = createApp();
    const line = `/api/cart/${CART_ID}/lines/${encodeURIComponent('gid://shopify/CartLine/l1')}`;
    await hit(10, () => request(app).put(line).send({}));
    await hit(10, () => request(app).delete(`/api/cart/bad`));
    await hit(10, () => write(app));
    expect((await request(app).post(`/api/cart/${CART_ID}/lines`).send({})).status).toBe(429);
  });

  it('does not count cart reads', async () => {
    const app = createApp();
    // Malformed ids 404 before reaching Shopify.
    await hit(40, () => request(app).get('/api/cart/not-a-gid'));
    expect((await write(app)).status).toBe(400); // validation, not 429
  });

  it('does not limit other routes', async () => {
    const app = createApp();
    await hit(31, () => write(app));
    expect((await request(app).get('/api/healthz')).status).toBe(200);
    expect((await request(app).get('/api/nope')).status).toBe(404);
  });
});

describe('loginLimiter', () => {
  it('blocks after 5 failed logins, and successful logins do not count', async () => {
    const app = createApp();
    const login = (password: string) => request(app).post('/api/admin/auth/login').send({ password });

    for (let i = 0; i < 3; i++) {
      expect((await login('correct-horse-battery')).status).toBe(200);
    }
    for (let i = 0; i < 5; i++) {
      expect((await login('wrong')).status).toBe(401);
    }

    const blocked = await login('wrong');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Too many login attempts. Try again in 15 minutes.' });

    // Even the right password is refused while blocked.
    expect((await login('correct-horse-battery')).status).toBe(429);
  });
});
