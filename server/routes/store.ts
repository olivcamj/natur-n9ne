import { Router } from 'express';
import type { StoreInfo } from '@shared/storefront.types';
import { shopifyStorefrontRequest } from '../lib/shopify';

export const storeRouter = Router();

// GET /api/store/info
storeRouter.get('/store/info', async (_req, res) => {
  const data = await shopifyStorefrontRequest<{
    shop: {
      name: string;
      description: string | null;
      paymentSettings: { currencyCode: string };
    };
  }>(`#graphql
    query ShopInfo {
      shop {
        name
        description
        paymentSettings { currencyCode }
      }
    }
  `);

  // moneyFormat (e.g. "${{amount}}") isn't exposed by the Storefront API,
  // so it's left out; format prices on the client with Intl.NumberFormat
  // and currencyCode instead.
  const body: StoreInfo = {
    name: data.shop.name,
    description: data.shop.description,
    currencyCode: data.shop.paymentSettings.currencyCode,
  };
  res.json(body);
});
