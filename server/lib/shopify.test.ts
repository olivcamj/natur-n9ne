import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../env';
import { HttpError } from '../middleware/errors';
import { fetchMock, shopifyCall, shopifyResponds, shopifyReturns } from '../test/helpers';
import { shopifyAdminRequest, shopifyStorefrontRequest } from './shopify';

const original = { ...env };
afterEach(() => Object.assign(env, original));

describe('shopifyStorefrontRequest', () => {
  it('POSTs the query to the Storefront endpoint with the storefront token', async () => {
    shopifyReturns({ shop: { name: 'N9NE' } });

    const data = await shopifyStorefrontRequest('query { shop { name } }', { a: 1 });

    expect(data).toEqual({ shop: { name: 'N9NE' } });
    const call = shopifyCall();
    expect(call.url).toBe('https://test-shop.myshopify.com/api/2026-04/graphql.json');
    expect(call.init.method).toBe('POST');
    expect(call.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': 'storefront-token',
    });
    expect(call.headers).not.toHaveProperty('X-Shopify-Access-Token');
    expect(call.query).toBe('query { shop { name } }');
    expect(call.variables).toEqual({ a: 1 });
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each(['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_STOREFRONT_TOKEN'] as const)(
    'throws a 503 without calling Shopify when %s is missing',
    async (key) => {
      env[key] = undefined;
      expect(() => shopifyStorefrontRequest('{ shop { name } }')).toThrow(HttpError);
      try {
        shopifyStorefrontRequest('{ shop { name } }');
      } catch (err) {
        expect((err as HttpError).status).toBe(503);
        expect((err as HttpError).message).toMatch(/not configured/);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe('shopifyAdminRequest', () => {
  it('POSTs to the Admin endpoint with the admin token', async () => {
    shopifyReturns({ ok: true });

    await shopifyAdminRequest('{ ok }');

    const call = shopifyCall();
    expect(call.url).toBe('https://test-shop.myshopify.com/admin/api/2026-04/graphql.json');
    expect(call.headers).toMatchObject({ 'X-Shopify-Access-Token': 'admin-token' });
    expect(call.headers).not.toHaveProperty('X-Shopify-Storefront-Access-Token');
  });

  it('uses the configured API version', async () => {
    env.SHOPIFY_API_VERSION = '2025-10';
    shopifyReturns({ ok: true });
    await shopifyAdminRequest('{ ok }');
    expect(shopifyCall().url).toContain('/admin/api/2025-10/');
  });

  it('throws a 503 when the admin token is missing', () => {
    env.SHOPIFY_ADMIN_TOKEN = undefined;
    expect(() => shopifyAdminRequest('{ ok }')).toThrow(/SHOPIFY_ADMIN_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('graphql error handling', () => {
  it('throws on GraphQL errors even with HTTP 200', async () => {
    shopifyResponds({ errors: [{ message: 'Field x missing' }, { message: 'Bad arg' }] });
    await expect(shopifyStorefrontRequest('{ x }')).rejects.toThrow(
      'Shopify Storefront API error (200): Field x missing; Bad arg',
    );
  });

  it('throws on a non-2xx status', async () => {
    shopifyResponds({ errors: [{ message: 'Invalid API key' }] }, { status: 401 });
    await expect(shopifyAdminRequest('{ x }')).rejects.toThrow(
      'Shopify Admin API error (401): Invalid API key',
    );
  });

  it('throws when data is missing', async () => {
    shopifyResponds({}, { status: 200 });
    await expect(shopifyStorefrontRequest('{ x }')).rejects.toThrow(/Storefront API error \(200\)/);
  });

  it('falls back to the status text for an empty error body', async () => {
    shopifyResponds('', { status: 502, statusText: 'Bad Gateway' });
    await expect(shopifyStorefrontRequest('{ x }')).rejects.toThrow('(502): Bad Gateway');
  });

  it('includes a truncated snippet of a non-JSON body', async () => {
    shopifyResponds(`<html>${'x'.repeat(1000)}</html>`, { status: 500 });
    const err = await shopifyStorefrontRequest('{ x }').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('(500): <html>xxx');
    expect((err as Error).message.length).toBeLessThan(400);
  });

  it('propagates network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(shopifyStorefrontRequest('{ x }')).rejects.toThrow('fetch failed');
  });
});
