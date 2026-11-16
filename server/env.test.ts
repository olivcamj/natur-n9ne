import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env.ts validates at import time, so each call imports a fresh copy. A unique
// query string is used rather than vi.resetModules(), which doesn't evict a
// module whose evaluation threw (here, via the mocked process.exit).

let importCount = 0;

async function loadEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);

  const mod = (await import(/* @vite-ignore */ `./env.ts?fresh=${++importCount}`)) as typeof import('./env');
 
  return mod.env;
}

describe('env', () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit);
    
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    exit.mockRestore();
    consoleError.mockRestore();
  });

  it('applies defaults', async () => {
    const env = await loadEnv({
      NODE_ENV: undefined,
      API_PORT: undefined,
      SHOPIFY_API_VERSION: undefined,
    });
    
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3001);
    expect(env.SHOPIFY_API_VERSION).toBe('2026-04');
  });

  it('coerces API_PORT to a number', async () => {
    const env = await loadEnv({ API_PORT: '8080' });
    expect(env.API_PORT).toBe(8080);
  });

  it.each([
    ['a non-numeric API_PORT', { API_PORT: 'abc' }],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }],
    ['a SESSION_SECRET under 32 characters', { SESSION_SECRET: 'too-short' }],
    ['production without SESSION_SECRET', { NODE_ENV: 'production', SESSION_SECRET: undefined }],
  ])('exits on %s', async (_label, vars) => {
    await expect(loadEnv(vars)).rejects.toThrow('process.exit(1)');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid environment variables'));
  });

  it('accepts a valid LOG_LEVEL and rejects others', async () => {
    expect((await loadEnv({ LOG_LEVEL: 'debug' })).LOG_LEVEL).toBe('debug');
    expect((await loadEnv({ LOG_LEVEL: undefined })).LOG_LEVEL).toBeUndefined();
    await expect(loadEnv({ LOG_LEVEL: 'verbose' })).rejects.toThrow('process.exit(1)');
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
    ['1', 1],
    ['2', 2],
    ['loopback', 'loopback'],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('parses TRUST_PROXY=%j as %j', async (raw, expected) => {
    const env = await loadEnv({ TRUST_PROXY: raw });
    expect(env.TRUST_PROXY).toEqual(expected);
  });

  it('allows a missing SESSION_SECRET outside production', async () => {
    const env = await loadEnv({ NODE_ENV: 'development', SESSION_SECRET: undefined });
    expect(env.SESSION_SECRET).toBeUndefined();
  });

  it('starts when there is no .env file', async () => {
    vi.mocked(process.loadEnvFile).mockImplementationOnce(() => {
      throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
    });
    await expect(loadEnv({})).resolves.toBeDefined();
  });

  it('rethrows other .env read errors', async () => {
    vi.mocked(process.loadEnvFile).mockImplementationOnce(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    });
    await expect(loadEnv({})).rejects.toThrow('permission denied');
  });
});
