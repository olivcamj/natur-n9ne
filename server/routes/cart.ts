import { Router } from 'express';
import type { Cart, CartLine, CheckoutUrlResponse } from '@shared/storefront.types';
import {
  CartInputSchema,
  CartLineInputSchema,
  CartLineUpdateSchema,
} from '@shared/storefront.schemas';
import { shopifyStorefrontRequest } from '../lib/shopify';
import { HttpError } from '../middleware/errors';
import { parse } from '../middleware/validate';

export const cartRouter = Router();

const CART_FIELDS = `#graphql
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      totalAmount { amount currencyCode }
      subtotalAmount { amount currencyCode }
    }
    lines(first: 50) {
      nodes {
        id
        quantity
        cost {
          totalAmount { amount currencyCode }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            image { url altText }
            selectedOptions { name value }
            product {
              id
              title
              handle
              featuredImage { url altText }
            }
          }
        }
      }
    }
  }
`;

// Shopify wraps lines in { nodes }; our API returns a plain array.
type ShopifyCart = Omit<Cart, 'lines'> & { lines: { nodes: CartLine[] } };

type CartMutationResult = {
  cart: ShopifyCart | null;
  userErrors: { field?: string[] | null; message: string }[];
};

function mapCart({ lines, ...rest }: ShopifyCart): Cart {
  return { ...rest, lines: lines.nodes };
}

// Runs a cart mutation and turns Shopify's userErrors (bad variant, sold out,
// unknown line…) into a 400 with Shopify's own message.
async function cartMutation(
  field: string,
  mutation: string,
  variables: Record<string, unknown>,
  fallbackError: string,
): Promise<Cart> {
  const data = await shopifyStorefrontRequest<Record<string, CartMutationResult>>(
    `#graphql
      ${CART_FIELDS}
      ${mutation}
    `,
    variables,
  );

  const { cart, userErrors } = data[field];
  if (userErrors.length > 0 || !cart) {
    throw new HttpError(400, userErrors[0]?.message ?? fallbackError);
  }
  return mapCart(cart);
}

const removeLines = (cartId: string, lineIds: string[]) =>
  cartMutation(
    'cartLinesRemove',
    `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }`,
    { cartId, lineIds },
    'Failed to remove item',
  );

// Note: Express already URL-decodes req.params, so cart/line GIDs arrive
// ready to use. Decoding again would break (or throw on) IDs containing '%'.

// POST /api/cart — create a cart with its first line
cartRouter.post('/cart', async (req, res) => {
  const { variantId, quantity } = parse(CartInputSchema, req.body);

  const cart = await cartMutation(
    'cartCreate',
    `mutation CartCreate($variantId: ID!, $quantity: Int!) {
      cartCreate(input: { lines: [{ merchandiseId: $variantId, quantity: $quantity }] }) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }`,
    { variantId, quantity },
    'Cart creation failed',
  );

  res.status(201).json(cart);
});

// GET /api/cart/:cartId
cartRouter.get('/cart/:cartId', async (req, res) => {
  const data = await shopifyStorefrontRequest<{ cart: ShopifyCart | null }>(
    `#graphql
      ${CART_FIELDS}
      query Cart($cartId: ID!) {
        cart(id: $cartId) { ...CartFields }
      }
    `,
    { cartId: req.params.cartId },
  );

  // Shopify carts expire, so a saved cartId can legitimately 404.
  if (!data.cart) throw new HttpError(404, 'Cart not found');

  res.json(mapCart(data.cart));
});

// POST /api/cart/:cartId/lines — add a line
cartRouter.post('/cart/:cartId/lines', async (req, res) => {
  const { variantId, quantity } = parse(CartLineInputSchema, req.body);

  const cart = await cartMutation(
    'cartLinesAdd',
    `mutation CartLinesAdd($cartId: ID!, $variantId: ID!, $quantity: Int!) {
      cartLinesAdd(cartId: $cartId, lines: [{ merchandiseId: $variantId, quantity: $quantity }]) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }`,
    { cartId: req.params.cartId, variantId, quantity },
    'Failed to add item',
  );

  res.json(cart);
});

// PUT /api/cart/:cartId/lines/:lineId — set quantity (0 removes the line)
cartRouter.put('/cart/:cartId/lines/:lineId', async (req, res) => {
  const { cartId, lineId } = req.params;
  const { quantity } = parse(CartLineUpdateSchema, req.body);

  if (quantity === 0) {
    res.json(await removeLines(cartId, [lineId]));
    return;
  }

  const cart = await cartMutation(
    'cartLinesUpdate',
    `mutation CartLinesUpdate($cartId: ID!, $lineId: ID!, $quantity: Int!) {
      cartLinesUpdate(cartId: $cartId, lines: [{ id: $lineId, quantity: $quantity }]) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }`,
    { cartId, lineId, quantity },
    'Failed to update item',
  );

  res.json(cart);
});

// DELETE /api/cart/:cartId/lines/:lineId — remove a line
cartRouter.delete('/cart/:cartId/lines/:lineId', async (req, res) => {
  res.json(await removeLines(req.params.cartId, [req.params.lineId]));
});

// POST /api/cart/:cartId/checkout — Shopify hosted checkout URL
cartRouter.post('/cart/:cartId/checkout', async (req, res) => {
  const data = await shopifyStorefrontRequest<{ cart: { checkoutUrl: string } | null }>(
    `#graphql
      query CartCheckoutUrl($cartId: ID!) {
        cart(id: $cartId) { checkoutUrl }
      }
    `,
    { cartId: req.params.cartId },
  );

  if (!data.cart?.checkoutUrl) throw new HttpError(404, 'Cart not found');

  const body: CheckoutUrlResponse = { checkoutUrl: data.cart.checkoutUrl };
  res.json(body);
});
