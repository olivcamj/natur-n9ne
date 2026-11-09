import { Router } from 'express';
import type { Collection } from '@shared/storefront.types';
import { ListCollectionsParamsSchema } from '@shared/storefront.schemas';
import { shopifyStorefrontRequest } from '../lib/shopify';
import { parse } from '../middleware/validate';

export const collectionsRouter = Router();

// GET /api/collections
collectionsRouter.get('/collections', async (req, res) => {
  const params = parse(ListCollectionsParamsSchema, req.query);
  const first = Math.min(params.first ?? 20, 50);

  const data = await shopifyStorefrontRequest<{ collections: { nodes: Collection[] } }>(
    `#graphql
      query Collections($first: Int!) {
        collections(first: $first) {
          nodes {
            id
            title
            handle
            description
            image { url altText }
          }
        }
      }
    `,
    { first },
  );

  const body: Collection[] = data.collections.nodes;
  res.json(body);
});
