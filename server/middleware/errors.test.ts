import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { env } from '../env';
import { api, shopifyResponds } from '../test/helpers';
import { errorHandler, HttpError } from './errors';

describe('error handling', () => {
  afterEach(() => {
    env.NODE_ENV = 'test';
  });

  it('returns a JSON 404 for unknown /api routes', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No route for GET /nope' });
  });

  it('returns a JSON 404 for unknown /api routes in production too (not the SPA)', async () => {
    env.NODE_ENV = 'production';
    const res = await request(createApp()).post('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ error: 'No route for POST /nope' });
  });

  it('returns a 400 for malformed JSON', async () => {
    const res = await api()
      .post('/api/cart')
      .set('Content-Type', 'application/json')
      .send('{"variantId": ');
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns a 413 for a body over 100kb', async () => {
    const res = await api()
      .post('/api/cart')
      .send({ variantId: 'x'.repeat(100 * 1024 + 1), quantity: 1 });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'request entity too large' });
  });

  it('hides details of unexpected errors behind a 500', async () => {
    shopifyResponds({ errors: [{ message: 'secret internal detail' }] }, { status: 500 });

    const res = await api().get('/api/store/info');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});

// Unit tests for the handler itself, with a fake req.log, so we can see what
// gets logged (the real logger is silent under test).
describe('errorHandler', () => {
  function run(err: unknown) {
    const log = { error: vi.fn() };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    errorHandler(err, { log } as never, res as never, vi.fn());
    return { log, status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
  }

  it('sends an HttpError as-is without logging it', () => {
    const { log, status, body } = run(new HttpError(418, 'Short and stout'));
    expect(status).toBe(418);
    expect(body).toEqual({ error: 'Short and stout' });
    expect(log.error).not.toHaveBeenCalled();
  });

  it('sends exposed client errors from middleware with their message', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, expose: true });
    expect(run(err)).toMatchObject({ status: 413, body: { error: 'request entity too large' } });
  });

  it('hides the message of unexposed client errors', () => {
    const err = Object.assign(new Error('internal parser state'), { status: 400, expose: false });
    expect(run(err)).toMatchObject({ status: 400, body: { error: 'Bad request' } });
  });

  it('logs unexpected errors with the request logger and sends a generic 500', () => {
    const err = new Error('secret internal detail');
    const { log, status, body } = run(err);
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(log.error).toHaveBeenCalledWith({ err }, 'Unhandled error');
  });

  it('treats a 5xx status on a non-HttpError as unexpected', () => {
    const err = Object.assign(new Error('upstream exploded'), { status: 502 });
    const { log, status, body } = run(err);
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(log.error).toHaveBeenCalled();
  });

  it('does not send the x-powered-by header', async () => {
    const res = await api().get('/api/healthz');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
