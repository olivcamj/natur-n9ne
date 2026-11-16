// Minimal Shopify GraphQL clients for the Storefront and Admin APIs.
// The Storefront token is a public, buyer-facing credential, but we still keep
// it server-side so the frontend only ever talks to /api. The Admin token is a
// real secret and must never leave the server.

import { env } from '../env';
import { HttpError } from '../middleware/errors';

const FETCH_TIMEOUT_MS = 10_000;

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

function requireConfig(name: string, ...values: (string | undefined)[]) {
  if (values.some((v) => !v)) {
    throw new HttpError(503, `Shopify is not configured: set ${name} in .env`);
  }
}

async function graphqlRequest<T>(
  label: string,
  url: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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
    throw new Error(`Shopify ${label} API error (${res.status}): ${detail}`);
  }

  return json.data;
}

export function shopifyStorefrontRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  requireConfig(
    'SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN',
    env.SHOPIFY_STORE_DOMAIN,
    env.SHOPIFY_STOREFRONT_TOKEN,
  );
  return graphqlRequest<T>(
    'Storefront',
    `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    { 'X-Shopify-Storefront-Access-Token': env.SHOPIFY_STOREFRONT_TOKEN! },
    query,
    variables,
  );
}

// Needs an Admin API access token with read_products, write_products and
// read_orders scopes (read_all_orders for orders older than 60 days).
export function shopifyAdminRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  requireConfig(
    'SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN',
    env.SHOPIFY_STORE_DOMAIN,
    env.SHOPIFY_ADMIN_TOKEN,
  );
  return graphqlRequest<T>(
    'Admin',
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    { 'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN! },
    query,
    variables,
  );
}
