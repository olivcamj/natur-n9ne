// Minimal Shopify Storefront GraphQL client.
// The Storefront token is a public, buyer-facing credential, but we still keep
// it server-side so the frontend only ever talks to /api.

import { env } from '../env';
import { HttpError } from '../middleware/errors';

const FETCH_TIMEOUT_MS = 10_000;

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

function storefrontEndpoint() {
  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_STOREFRONT_TOKEN) {
    throw new HttpError(
      503,
      'Shopify is not configured: set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN in .env',
    );
  }
  return {
    url: `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    token: env.SHOPIFY_STOREFRONT_TOKEN,
  };
}

export async function shopifyStorefrontRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { url, token } = storefrontEndpoint();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const text = await res.text();
  let json: GraphQLResponse<T>;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { errors: [{ message: text.slice(0, 300) }] };
  }

  // GraphQL reports query errors with a 200, so check both.
  if (!res.ok || json.errors?.length || !json.data) {
    const detail = json.errors?.map((e) => e.message).join('; ') ?? res.statusText;
    throw new Error(`Shopify Storefront API error (${res.status}): ${detail}`);
  }

  return json.data;
}
