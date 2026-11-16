import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES } from '@shared/admin.schemas';
import { adminAuth, api, fetchMock, shopifyCall, shopifyReturns } from '../test/helpers';

const PATH = '/api/storage/uploads/request-url';
const input = { filename: 'model.jpg', mimeType: 'image/jpeg', fileSize: 123_456 };

const target = {
  url: 'https://shopify-staged-uploads.storage.googleapis.com/',
  resourceUrl: 'https://shopify-staged-uploads.storage.googleapis.com/tmp/1/model.jpg',
  parameters: [
    { name: 'key', value: 'tmp/1/model.jpg' },
    { name: 'policy', value: 'abc' },
  ],
};

const staged = (stagedTargets: unknown[], userErrors: unknown[] = []) => ({
  stagedUploadsCreate: { stagedTargets, userErrors },
});

describe('POST /api/storage/uploads/request-url', () => {
  it('requires an admin token', async () => {
    const res = await api().post(PATH).send(input);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the staged upload target', async () => {
    shopifyReturns(staged([target]));

    const res = await api().post(PATH).set('Authorization', adminAuth()).send(input);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uploadUrl: target.url,
      parameters: target.parameters,
      resourceUrl: target.resourceUrl,
    });

    const call = shopifyCall();
    expect(call.url).toContain('/admin/api/');
    expect(call.query).toContain('mutation StagedUpload(');
    expect(call.variables).toEqual({
      input: [
        {
          resource: 'IMAGE',
          httpMethod: 'POST',
          filename: 'model.jpg',
          mimeType: 'image/jpeg',
          fileSize: '123456', // UnsignedInt64 goes as a string
        },
      ],
    });
  });

  it('accepts a file exactly at the size limit', async () => {
    shopifyReturns(staged([target]));
    const res = await api()
      .post(PATH)
      .set('Authorization', adminAuth())
      .send({ ...input, fileSize: MAX_UPLOAD_BYTES });
    expect(res.status).toBe(200);
  });

  it.each([
    ['a non-image type', { mimeType: 'application/pdf' }, /Only image uploads/],
    ['a file over 20 MB', { fileSize: MAX_UPLOAD_BYTES + 1 }, /20 MB or smaller/],
    ['a zero-byte file', { fileSize: 0 }, /fileSize/],
    ['an empty filename', { filename: '' }, /filename/],
    ['a filename over 255 chars', { filename: `${'a'.repeat(252)}.jpg` }, /filename/],
    ['a string fileSize', { fileSize: '100' }, /fileSize/],
  ])('rejects %s with a 400', async (_label, overrides, message) => {
    const res = await api()
      .post(PATH)
      .set('Authorization', adminAuth())
      .send({ ...input, ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('joins Shopify userErrors into a 400', async () => {
    shopifyReturns(staged([], [{ message: 'Invalid filename' }, { field: ['mimeType'], message: 'Bad type' }]));
    const res = await api().post(PATH).set('Authorization', adminAuth()).send(input);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid filename; Bad type' });
  });

  it.each([
    ['no targets', []],
    ['a target without a url', [{ ...target, url: null }]],
    ['a target without a resourceUrl', [{ ...target, resourceUrl: null }]],
  ])('returns a 500 when Shopify returns %s', async (_label, targets) => {
    shopifyReturns(staged(targets));
    const res = await api().post(PATH).set('Authorization', adminAuth()).send(input);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
