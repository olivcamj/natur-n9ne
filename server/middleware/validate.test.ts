import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError } from './errors';
import { parse } from './validate';

const Schema = z.object({ name: z.string().min(1), count: z.coerce.number().int() });

describe('parse', () => {
  it('returns parsed (and coerced) data on success', () => {
    expect(parse(Schema, { name: 'tee', count: '3' })).toEqual({ name: 'tee', count: 3 });
  });

  it('throws a 400 HttpError with a readable message on failure', () => {
    let err: unknown;
    try {
      parse(Schema, { name: '', count: 'many' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    expect((err as HttpError).message).toContain('name');
    expect((err as HttpError).message).toContain('count');
  });
});
