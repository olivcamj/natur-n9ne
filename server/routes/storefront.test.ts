// Health, store info and collections: the small public routes.

import { describe, expect, it } from 'vitest';
import { api, fetchMock, shopifyCall, shopifyReturns } from '../test/helpers';

describe('GET /api/healthz', () => {
  it('reports ok without calling Shopify', async () => {
    const res = await api().get('/api/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/store/info', () => {
  it('flattens the shop fields', async () => {
    shopifyReturns({
      shop: { name: 'N9NE', description: 'Nature tees', paymentSettings: { currencyCode: 'GBP' } },
    });

    const res = await api().get('/api/store/info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'N9NE', description: 'Nature tees', currencyCode: 'GBP' });
    expect(shopifyCall().query).toContain('query ShopInfo');
  });

  it('keeps a null description', async () => {
    shopifyReturns({ shop: { name: 'N9NE', description: null, paymentSettings: { currencyCode: 'USD' } } });
    const res = await api().get('/api/store/info');
    expect(res.body.description).toBeNull();
  });
});

describe('GET /api/collections', () => {
  const collection = {
    id: 'gid://shopify/Collection/1',
    title: 'Summer',
    handle: 'summer',
    description: 'Warm weather',
    image: { url: 'https://cdn.shopify.com/summer.jpg', altText: null },
  };

  it('returns the collection nodes as a plain array', async () => {
    shopifyReturns({ collections: { nodes: [collection] } });

    const res = await api().get('/api/collections');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([collection]);
    expect(shopifyCall().variables).toEqual({ first: 20 });
  });

  it.each([
    ['5', 5],
    ['50', 50],
    ['250', 50], // capped at 50
  ])('passes first=%s to Shopify as %d', async (first, expected) => {
    shopifyReturns({ collections: { nodes: [] } });
    await api().get(`/api/collections?first=${first}`);
    expect(shopifyCall().variables.first).toBe(expected);
  });

  it.each(['0', '251', 'abc', '1.5'])('rejects first=%s with a 400', async (first) => {
    const res = await api().get(`/api/collections?first=${first}`);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
