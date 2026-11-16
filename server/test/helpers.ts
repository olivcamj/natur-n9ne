import request from 'supertest';
import { createApp } from '../app';
import { createAdminToken } from '../middleware/auth';
import { fetchMock } from './fetch-mock';

export { fetchMock };

export const api = () => request(createApp());

export const adminAuth = () => `Bearer ${createAdminToken()}`;

/** Queue a successful GraphQL response: `{ data }` with HTTP 200. */
export function shopifyReturns(data: unknown) {
  fetchMock.mockResolvedValueOnce(Response.json({ data }));
}

/** Queue a raw Shopify response (bad status, GraphQL errors, non-JSON…). */
export function shopifyResponds(body: string | object, init?: ResponseInit) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  fetchMock.mockResolvedValueOnce(new Response(text, init));
}

/** The nth request sent to Shopify, decoded. */
export function shopifyCall(n = 0) {
  const call = fetchMock.mock.calls[n];
  if (!call) throw new Error(`Shopify was called ${fetchMock.mock.calls.length} time(s), not ${n + 1}`);
  const [url, init] = call;
  const body = JSON.parse(init!.body as string) as {
    query: string;
    variables?: Record<string, unknown>;
  };
  return {
    url: String(url),
    init: init!,
    headers: init!.headers as Record<string, string>,
    query: body.query,
    variables: body.variables ?? {},
  };
}

export const money = (amount: string, currencyCode = 'USD') => ({ amount, currencyCode });
