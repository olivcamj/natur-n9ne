import { describe, expect, it } from 'vitest';
import { api } from '../test/helpers';

describe('securityHeaders', () => {
  it('sets the standard helmet headers', async () => {
    const res = await api().get('/api/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the third-party origins the frontend needs in the CSP', async () => {
    const res = await api().get('/api/healthz');
    const csp = Object.fromEntries(
      String(res.headers['content-security-policy'])
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .map(([name, ...values]) => [name, values]),
    );

    expect(csp['img-src']).toEqual(expect.arrayContaining(["'self'", 'https://cdn.shopify.com']));
    expect(csp['style-src']).toContain('https://fonts.googleapis.com');
    expect(csp['font-src']).toContain('https://fonts.gstatic.com');
    expect(csp['connect-src']).toEqual([
      "'self'",
      'https://shopify-staged-uploads.storage.googleapis.com',
    ]);
    // helmet's defaults are kept for everything else.
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
  });
});
