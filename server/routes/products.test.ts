import { describe, expect, it } from 'vitest';
import { api, fetchMock, money, shopifyCall, shopifyReturns } from '../test/helpers';

const variant = {
  id: 'gid://shopify/ProductVariant/11',
  title: 'M / Moss',
  availableForSale: true,
  quantityAvailable: null,
  price: money('25.00'),
  compareAtPrice: null,
  selectedOptions: [{ name: 'Size', value: 'M' }],
  image: null,
};

const image = { url: 'https://cdn.shopify.com/tee.jpg', altText: 'Tee', width: 800, height: 800 };

const shopifyProduct = {
  id: 'gid://shopify/Product/1',
  title: 'Fern Tee',
  handle: 'fern-tee',
  descriptionHtml: '<p>Soft</p>',
  availableForSale: true,
  productType: 'T-Shirt',
  tags: ['summer'],
  featuredImage: { url: image.url, altText: 'Tee' },
  images: { nodes: [image] },
  priceRange: { minVariantPrice: money('25.00'), maxVariantPrice: money('25.00') },
  variants: { nodes: [variant] },
  options: [{ name: 'Size', values: ['M'] }],
};

// What our API returns: Shopify's { nodes } wrappers flattened to arrays.
const product = { ...shopifyProduct, images: [image], variants: [variant] };

const pageInfo = { hasNextPage: true, hasPreviousPage: false, startCursor: 'a', endCursor: 'b' };

describe('GET /api/products', () => {
  it('lists products with flattened images and variants', async () => {
    shopifyReturns({ products: { nodes: [shopifyProduct], pageInfo } });

    const res = await api().get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ products: [product], pageInfo });
  });

  it('sends default paging and sort variables', async () => {
    shopifyReturns({ products: { nodes: [], pageInfo } });
    await api().get('/api/products');

    const call = shopifyCall();
    expect(call.query).toContain('query Products(');
    // `after` is undefined, so JSON drops it.
    expect(call.variables).toEqual({ first: 20, sortKey: 'BEST_SELLING', reverse: false });
  });

  it('passes paging, sort and reverse through', async () => {
    shopifyReturns({ products: { nodes: [], pageInfo } });
    await api().get('/api/products?first=10&after=cursor1&sortKey=PRICE&reverse=true');

    expect(shopifyCall().variables).toEqual({
      first: 10,
      after: 'cursor1',
      sortKey: 'PRICE',
      reverse: true,
    });
  });

  it('caps first at 100 and treats an empty after as no cursor', async () => {
    shopifyReturns({ products: { nodes: [], pageInfo } });
    await api().get('/api/products?first=250&after=');

    const { variables } = shopifyCall();
    expect(variables.first).toBe(100);
    expect(variables).not.toHaveProperty('after');
  });

  it.each([
    ['an unknown sortKey', 'sortKey=NEWEST'],
    ['first=0', 'first=0'],
    ['a non-boolean reverse', 'reverse=maybe'],
  ])('rejects %s with a 400', async (_label, qs) => {
    const res = await api().get(`/api/products?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('with collectionHandle', () => {
    it('queries the collection and flattens its products', async () => {
      shopifyReturns({ collection: { products: { nodes: [shopifyProduct], pageInfo } } });

      const res = await api().get('/api/products?collectionHandle=summer');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ products: [product], pageInfo });
      const call = shopifyCall();
      expect(call.query).toContain('query CollectionProducts(');
      expect(call.variables).toMatchObject({ handle: 'summer', sortKey: 'BEST_SELLING' });
    });

    it('maps CREATED_AT to the collection sort key CREATED', async () => {
      shopifyReturns({ collection: { products: { nodes: [], pageInfo } } });
      await api().get('/api/products?collectionHandle=summer&sortKey=CREATED_AT');
      expect(shopifyCall().variables.sortKey).toBe('CREATED');
    });

    it('leaves other sort keys unchanged', async () => {
      shopifyReturns({ collection: { products: { nodes: [], pageInfo } } });
      await api().get('/api/products?collectionHandle=summer&sortKey=TITLE');
      expect(shopifyCall().variables.sortKey).toBe('TITLE');
    });

    it('returns a 404 for an unknown collection', async () => {
      shopifyReturns({ collection: null });
      const res = await api().get('/api/products?collectionHandle=missing');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Collection not found' });
    });
  });
});

describe('GET /api/products/featured', () => {
  it('returns best sellers as a plain array (not treated as a handle)', async () => {
    shopifyReturns({ products: { nodes: [shopifyProduct] } });

    const res = await api().get('/api/products/featured');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([product]);
    const call = shopifyCall();
    expect(call.query).toContain('query FeaturedProducts(');
    expect(call.variables).toEqual({ first: 6 });
  });

  it('caps first at 20', async () => {
    shopifyReturns({ products: { nodes: [] } });
    await api().get('/api/products/featured?first=50');
    expect(shopifyCall().variables.first).toBe(20);
  });
});

describe('GET /api/products/:handle', () => {
  it('returns one product by handle', async () => {
    shopifyReturns({ product: shopifyProduct });

    const res = await api().get('/api/products/fern-tee');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(shopifyCall().variables).toEqual({ handle: 'fern-tee' });
  });

  it('returns a 404 for an unknown handle', async () => {
    shopifyReturns({ product: null });
    const res = await api().get('/api/products/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Product not found' });
  });
});
