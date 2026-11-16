import { describe, expect, it } from 'vitest';
import { api, fetchMock, money, shopifyCall, shopifyReturns } from '../test/helpers';

const CART_ID = 'gid://shopify/Cart/c1?key=abc123';
const LINE_ID = 'gid://shopify/CartLine/l1?cart=c1';
const VARIANT_ID = 'gid://shopify/ProductVariant/11';

// Cart and line GIDs contain '/', '?' and '=', so clients must encode them.
const cartPath = (id = CART_ID) => `/api/cart/${encodeURIComponent(id)}`;
const linePath = (lineId = LINE_ID) => `${cartPath()}/lines/${encodeURIComponent(lineId)}`;

const line = {
  id: LINE_ID,
  quantity: 2,
  cost: { totalAmount: money('50.00') },
  merchandise: {
    id: VARIANT_ID,
    title: 'M / Moss',
    price: money('25.00'),
    image: null,
    selectedOptions: [{ name: 'Size', value: 'M' }],
    product: { id: 'gid://shopify/Product/1', title: 'Fern Tee', handle: 'fern-tee', featuredImage: null },
  },
};

const shopifyCart = {
  id: CART_ID,
  checkoutUrl: 'https://test-shop.myshopify.com/cart/c/c1',
  totalQuantity: 2,
  cost: { totalAmount: money('50.00'), subtotalAmount: money('50.00') },
  lines: { nodes: [line] },
};

const cart = { ...shopifyCart, lines: [line] };

const ok = (field: string) => ({ [field]: { cart: shopifyCart, userErrors: [] } });

describe('POST /api/cart', () => {
  it('creates a cart and returns 201 with flattened lines', async () => {
    shopifyReturns(ok('cartCreate'));

    const res = await api().post('/api/cart').send({ variantId: VARIANT_ID, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(cart);
    const call = shopifyCall();
    expect(call.query).toContain('mutation CartCreate(');
    expect(call.query).toContain('fragment CartFields on Cart');
    expect(call.variables).toEqual({ variantId: VARIANT_ID, quantity: 2 });
  });

  it.each([
    ['missing variantId', { quantity: 1 }],
    ['empty variantId', { variantId: '', quantity: 1 }],
    ['quantity 0', { variantId: VARIANT_ID, quantity: 0 }],
    ['fractional quantity', { variantId: VARIANT_ID, quantity: 1.5 }],
    ['string quantity', { variantId: VARIANT_ID, quantity: '2' }],
    ['no body', undefined],
  ])('rejects %s with a 400', async (_label, body) => {
    const res = await api().post('/api/cart').send(body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns Shopify userErrors into a 400 with Shopify's message", async () => {
    shopifyReturns({
      cartCreate: {
        cart: null,
        userErrors: [{ field: ['lines'], message: 'The merchandise is sold out.' }, { message: 'other' }],
      },
    });

    const res = await api().post('/api/cart').send({ variantId: VARIANT_ID, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The merchandise is sold out.' });
  });

  it('uses a fallback message when Shopify returns no cart and no errors', async () => {
    shopifyReturns({ cartCreate: { cart: null, userErrors: [] } });
    const res = await api().post('/api/cart').send({ variantId: VARIANT_ID, quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Cart creation failed' });
  });

  it('rejects when there are userErrors even if a cart came back', async () => {
    shopifyReturns({ cartCreate: { cart: shopifyCart, userErrors: [{ message: 'Quantity limited' }] } });
    const res = await api().post('/api/cart').send({ variantId: VARIANT_ID, quantity: 99 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Quantity limited' });
  });
});

describe('GET /api/cart/:cartId', () => {
  it('returns the cart, passing the decoded GID to Shopify', async () => {
    shopifyReturns({ cart: shopifyCart });

    const res = await api().get(cartPath());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cart);
    expect(shopifyCall().variables).toEqual({ cartId: CART_ID });
  });

  it("decodes the id exactly once (ids containing '%' survive)", async () => {
    const id = 'gid://shopify/Cart/c1?key=50%off';
    shopifyReturns({ cart: shopifyCart });
    const res = await api().get(cartPath(id));
    expect(res.status).toBe(200);
    expect(shopifyCall().variables.cartId).toBe(id);
  });

  it('returns a 404 for an expired or unknown cart', async () => {
    shopifyReturns({ cart: null });
    const res = await api().get(cartPath());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Cart not found' });
  });
});

describe('cart and line id validation', () => {
  const longCartId = `gid://shopify/Cart/${'x'.repeat(256)}`;

  it.each([
    ['GET', 'not a GID', () => api().get(cartPath('abc123'))],
    ['GET', 'the wrong GID type', () => api().get(cartPath('gid://shopify/Product/1'))],
    ['GET', 'a bare prefix', () => api().get(cartPath('gid://shopify/Cart/'))],
    ['GET', 'an id over 256 chars', () => api().get(cartPath(longCartId))],
    ['POST lines', 'not a GID', () =>
      api().post('/api/cart/abc/lines').send({ variantId: VARIANT_ID, quantity: 1 })],
    ['POST checkout', 'not a GID', () => api().post('/api/cart/abc/checkout')],
  ])('%s with %s as the cart id returns 404 without calling Shopify', async (_m, _label, send) => {
    const res = await send();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Cart not found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a cart id of exactly 256 characters', async () => {
    const id = `gid://shopify/Cart/${'x'.repeat(256 - 'gid://shopify/Cart/'.length)}`;
    shopifyReturns({ cart: shopifyCart });
    expect((await api().get(cartPath(id))).status).toBe(200);
  });

  it.each([
    ['not a GID', 'line-1'],
    ['a cart GID', CART_ID],
    ['a bare prefix', 'gid://shopify/CartLine/'],
  ])('returns 404 for %s as the line id', async (_label, lineId) => {
    const res = await api().put(linePath(lineId)).send({ quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Cart line not found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the cart id before the line id', async () => {
    const res = await api().delete(`/api/cart/bad/lines/also-bad`);
    expect(res.body).toEqual({ error: 'Cart not found' });
  });
});

describe('expired or unknown carts in mutations', () => {
  it('returns 404 when Shopify flags the cartId field', async () => {
    shopifyReturns({
      cartLinesAdd: {
        cart: null,
        userErrors: [{ field: ['cartId'], message: 'The specified cart does not exist.' }],
      },
    });
    const res = await api().post(`${cartPath()}/lines`).send({ variantId: VARIANT_ID, quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Cart not found' });
  });

  it('returns 404 even when the cartId error comes after another error', async () => {
    shopifyReturns({
      cartLinesUpdate: {
        cart: null,
        userErrors: [
          { field: ['lines', '0', 'merchandiseId'], message: 'Bad variant' },
          { field: ['input', 'cartId'], message: 'The specified cart does not exist.' },
        ],
      },
    });
    const res = await api().put(linePath()).send({ quantity: 2 });
    expect(res.status).toBe(404);
  });

  it('only matches cartId as the last path segment', async () => {
    shopifyReturns({
      cartLinesRemove: {
        cart: null,
        userErrors: [{ field: ['cartId', 'lineIds'], message: 'Line not in cart' }],
      },
    });
    const res = await api().delete(linePath());
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Line not in cart' });
  });
});

describe('POST /api/cart/:cartId/lines', () => {
  it('adds a line', async () => {
    shopifyReturns(ok('cartLinesAdd'));

    const res = await api().post(`${cartPath()}/lines`).send({ variantId: VARIANT_ID, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cart);
    const call = shopifyCall();
    expect(call.query).toContain('mutation CartLinesAdd(');
    expect(call.variables).toEqual({ cartId: CART_ID, variantId: VARIANT_ID, quantity: 1 });
  });

  it('validates the body', async () => {
    const res = await api().post(`${cartPath()}/lines`).send({ variantId: VARIANT_ID, quantity: -1 });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the add fallback message', async () => {
    shopifyReturns({ cartLinesAdd: { cart: null, userErrors: [] } });
    const res = await api().post(`${cartPath()}/lines`).send({ variantId: VARIANT_ID, quantity: 1 });
    expect(res.body).toEqual({ error: 'Failed to add item' });
  });
});

describe('PUT /api/cart/:cartId/lines/:lineId', () => {
  it('updates the quantity', async () => {
    shopifyReturns(ok('cartLinesUpdate'));

    const res = await api().put(linePath()).send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cart);
    const call = shopifyCall();
    expect(call.query).toContain('mutation CartLinesUpdate(');
    expect(call.variables).toEqual({ cartId: CART_ID, lineId: LINE_ID, quantity: 3 });
  });

  it('removes the line when quantity is 0', async () => {
    shopifyReturns(ok('cartLinesRemove'));

    const res = await api().put(linePath()).send({ quantity: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cart);
    const call = shopifyCall();
    expect(call.query).toContain('mutation CartLinesRemove(');
    expect(call.variables).toEqual({ cartId: CART_ID, lineIds: [LINE_ID] });
  });

  it.each([{ quantity: -1 }, { quantity: 'two' }, {}])('rejects %j with a 400', async (body) => {
    const res = await api().put(linePath()).send(body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the update fallback message', async () => {
    shopifyReturns({ cartLinesUpdate: { cart: null, userErrors: [] } });
    const res = await api().put(linePath()).send({ quantity: 2 });
    expect(res.body).toEqual({ error: 'Failed to update item' });
  });
});

describe('DELETE /api/cart/:cartId/lines/:lineId', () => {
  it('removes the line', async () => {
    shopifyReturns(ok('cartLinesRemove'));

    const res = await api().delete(linePath());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cart);
    expect(shopifyCall().variables).toEqual({ cartId: CART_ID, lineIds: [LINE_ID] });
  });

  it("returns Shopify's error for an unknown line", async () => {
    shopifyReturns({ cartLinesRemove: { cart: null, userErrors: [{ message: 'Line does not exist' }] } });
    const res = await api().delete(linePath());
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Line does not exist' });
  });
});

describe('POST /api/cart/:cartId/checkout', () => {
  it('returns the hosted checkout URL', async () => {
    shopifyReturns({ cart: { checkoutUrl: shopifyCart.checkoutUrl } });

    const res = await api().post(`${cartPath()}/checkout`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ checkoutUrl: shopifyCart.checkoutUrl });
    expect(shopifyCall().variables).toEqual({ cartId: CART_ID });
  });

  it.each([{ cart: null }, { cart: { checkoutUrl: '' } }])(
    'returns a 404 when there is no checkout URL (%j)',
    async (data) => {
      shopifyReturns(data);
      const res = await api().post(`${cartPath()}/checkout`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Cart not found' });
    },
  );
});
