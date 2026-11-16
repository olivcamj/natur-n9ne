import { describe, expect, it } from 'vitest';
import { api } from '../test/helpers';

describe('requestLogger', () => {
  it('generates a request id when none is sent', async () => {
    const res = await api().get('/api/healthz');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('gives each request a different id', async () => {
    const a = await api().get('/api/healthz');
    const b = await api().get('/api/healthz');
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });

  it("reuses an upstream proxy's id", async () => {
    const res = await api().get('/api/healthz').set('X-Request-Id', 'edge-abc-123');
    expect(res.headers['x-request-id']).toBe('edge-abc-123');
  });

  it('accepts an incoming id of exactly 128 characters', async () => {
    const id = 'a'.repeat(128);
    const res = await api().get('/api/healthz').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('replaces an incoming id longer than 128 characters', async () => {
    const id = 'a'.repeat(129);
    const res = await api().get('/api/healthz').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).not.toBe(id);
    expect(res.headers['x-request-id']).toHaveLength(36);
  });

  it('sets the id on error responses too', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
