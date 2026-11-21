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
    # 3D models live in media, not images. Only the first model is used.
    media(first: 10) {
      nodes {
        mediaContentType
        ... on Model3d {
          alt
          previewImage { url altText }
          sources { url mimeType format }
        }
      }
    }
    # Null unless the metafield exists and has Storefront API access turned on.
    artworkName: metafield(namespace: "custom", key: "artwork_name") { value }
    artworkStory: metafield(namespace: "custom", key: "artwork_story") { value }
  }
`;

// Shopify wraps lists in { nodes }; our API returns plain arrays.
type ShopifyMedia = {
  mediaContentType: string;
  alt?: string | null;
  previewImage?: { url: string; altText?: string | null } | null;
  sources?: { url: string; mimeType: string; format: string }[];
};

type ShopifyProduct = Omit<Product, 'images' | 'variants' | 'artwork' | 'model'> & {
  images: { nodes: ProductImage[] };
  variants: { nodes: ProductVariant[] };
  media?: { nodes: ShopifyMedia[] };
  artworkName?: { value: string } | null;
  artworkStory?: { value: string } | null;
};

// Shopify converts an uploaded model into several formats: GLB for browsers,
// USDZ for iPhone AR. Without a GLB there's nothing a browser can show.
function mapModel(media: ShopifyMedia[] = []): Product['model'] {
  const model = media.find((m) => m.mediaContentType === 'MODEL_3D');
  const glb = model?.sources?.find((s) => s.format === 'glb' || s.mimeType === 'model/gltf-binary');
  if (!model || !glb) return undefined;
  const usdz = model.sources?.find((s) => s.format === 'usdz');
  return {
    glbUrl: glb.url,
    ...(usdz ? { usdzUrl: usdz.url } : {}),
    ...(model.previewImage?.url ? { posterUrl: model.previewImage.url } : {}),
    ...(model.alt ? { alt: model.alt } : {}),
  };
}

type ShopifyProductPage = {
  pageInfo: ProductConnectionPageInfo;
  nodes: ShopifyProduct[];
};

function mapProduct({ images, variants, media, artworkName, artworkStory, ...rest }: ShopifyProduct): Product {
  const name = artworkName?.value.trim() || undefined;
  const story = artworkStory?.value.trim();
  const model = mapModel(media?.nodes);
  return {
    ...rest,
    images: images.nodes,
    variants: variants.nodes,
    ...(story ? { artwork: { name, story } } : {}),
    ...(model ? { model } : {}),
  };
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

const FEATURED_MAX = 20;

// GET /api/products/featured (must be registered before /products/:handle)
productsRouter.get('/products/featured', async (req, res) => {
  const params = parse(GetFeaturedProductsParamsSchema, req.query);
  // Without `first`, return every featured product up to the cap, so the home page rail
  // grows and shrinks with the store instead of with a number in the frontend.
  const first = Math.min(params.first ?? FEATURED_MAX, FEATURED_MAX);

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
