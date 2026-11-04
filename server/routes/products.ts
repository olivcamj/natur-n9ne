import { Router } from 'express';
import type {
  Product,
  ProductConnection,
  ProductConnectionPageInfo,
  ProductImage,
  ProductVariant,
} from '@shared/storefront.types';
import {
  GetFeaturedProductsParamsSchema,
  ListProductsParamsSchema,
} from '@shared/storefront.schemas';
import { shopifyStorefrontRequest } from '../lib/shopify';
import { HttpError } from '../middleware/errors';
import { parse } from '../middleware/validate';

export const productsRouter = Router();

const PRODUCT_FIELDS = `#graphql
  fragment ProductFields on Product {
    id
    title
    handle
    descriptionHtml
    availableForSale
    productType
    tags
    featuredImage { url altText }
    images(first: 10) {
      nodes { url altText width height }
    }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    variants(first: 20) {
      nodes {
        id
        title
        availableForSale
        quantityAvailable
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
        image { url altText }
      }
    }
    options { name values }
  }
`;

// Shopify wraps lists in { nodes }; our API returns plain arrays.
type ShopifyProduct = Omit<Product, 'images' | 'variants'> & {
  images: { nodes: ProductImage[] };
  variants: { nodes: ProductVariant[] };
};

type ShopifyProductPage = {
  pageInfo: ProductConnectionPageInfo;
  nodes: ShopifyProduct[];
};

function mapProduct({ images, variants, ...rest }: ShopifyProduct): Product {
  return { ...rest, images: images.nodes, variants: variants.nodes };
}

// Collection products use a different sort enum than the product list:
// it has CREATED where ProductSortKeys has CREATED_AT.
function collectionSortKey(sortKey: string) {
  return sortKey === 'CREATED_AT' ? 'CREATED' : sortKey;
}

// GET /api/products
productsRouter.get('/products', async (req, res) => {
  const params = parse(ListProductsParamsSchema, req.query);
  const first = Math.min(params.first ?? 20, 100);
  const after = params.after || undefined;
  const sortKey = params.sortKey ?? 'BEST_SELLING';
  const reverse = params.reverse ?? false;

  let page: ShopifyProductPage | undefined;

  if (params.collectionHandle) {
    const data = await shopifyStorefrontRequest<{
      collection: { products: ShopifyProductPage } | null;
    }>(
      `#graphql
        ${PRODUCT_FIELDS}
        query CollectionProducts($handle: String!, $first: Int!, $after: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean) {
          collection(handle: $handle) {
            products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
              pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
              nodes { ...ProductFields }
            }
          }
        }
      `,
      { handle: params.collectionHandle, first, after, sortKey: collectionSortKey(sortKey), reverse },
    );
    page = data.collection?.products;
    if (!page) throw new HttpError(404, 'Collection not found');
  } else {
    const data = await shopifyStorefrontRequest<{ products: ShopifyProductPage }>(
      `#graphql
        ${PRODUCT_FIELDS}
        query Products($first: Int!, $after: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
          products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            nodes { ...ProductFields }
          }
        }
      `,
      { first, after, sortKey, reverse },
    );
    page = data.products;
  }

  const body: ProductConnection = {
    products: page.nodes.map(mapProduct),
    pageInfo: page.pageInfo,
  };
  res.json(body);
});

// GET /api/products/featured (must be registered before /products/:handle)
productsRouter.get('/products/featured', async (req, res) => {
  const params = parse(GetFeaturedProductsParamsSchema, req.query);
  const first = Math.min(params.first ?? 6, 20);

  const data = await shopifyStorefrontRequest<{ products: { nodes: ShopifyProduct[] } }>(
    `#graphql
      ${PRODUCT_FIELDS}
      query FeaturedProducts($first: Int!) {
        products(first: $first, sortKey: BEST_SELLING) {
          nodes { ...ProductFields }
        }
      }
    `,
    { first },
  );

  const body: Product[] = data.products.nodes.map(mapProduct);
  res.json(body);
});

// GET /api/products/:handle
productsRouter.get('/products/:handle', async (req, res) => {
  const data = await shopifyStorefrontRequest<{ product: ShopifyProduct | null }>(
    `#graphql
      ${PRODUCT_FIELDS}
      query ProductByHandle($handle: String!) {
        product(handle: $handle) { ...ProductFields }
      }
    `,
    { handle: req.params.handle },
  );

  if (!data.product) throw new HttpError(404, 'Product not found');

  const body: Product = mapProduct(data.product);
  res.json(body);
});
