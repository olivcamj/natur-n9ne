// Image uploads via Shopify staged uploads.
//
// Flow: the admin asks here for an upload target, the browser POSTs the file
// straight to Shopify's storage (it never passes through this server), then
// PUT /api/admin/products/:productId/image attaches it using `resourceUrl`.
// Shopify copies the file onto its CDN, so we need no bucket or credentials
// beyond the Admin token. Staged files Shopify never attaches expire by themselves.

import { Router } from 'express';
import type { UploadUrlResponse } from '@shared/admin.types';
import { UploadUrlInputSchema } from '@shared/admin.schemas';
import { shopifyAdminRequest } from '../lib/shopify';
import { requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/errors';
import { parse } from '../middleware/validate';

export const storageRouter = Router();

type StagedTarget = {
  url: string | null;
  resourceUrl: string | null;
  parameters: { name: string; value: string }[];
};

// POST /api/storage/uploads/request-url
storageRouter.post('/storage/uploads/request-url', requireAdmin, async (req, res) => {
  const { filename, mimeType, fileSize } = parse(UploadUrlInputSchema, req.body);

  const data = await shopifyAdminRequest<{
    stagedUploadsCreate: {
      stagedTargets: StagedTarget[];
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    `mutation StagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          resource: 'IMAGE',
          httpMethod: 'POST',
          filename,
          mimeType,
          fileSize: String(fileSize), // UnsignedInt64 is sent as a string
        },
      ],
    },
  );

  const { stagedTargets, userErrors } = data.stagedUploadsCreate;
  if (userErrors.length) {
    throw new HttpError(400, userErrors.map((e) => e.message).join('; '));
  }

  const target = stagedTargets[0];
  if (!target?.url || !target.resourceUrl) {
    throw new Error('Shopify returned no staged upload target');
  }

  const body: UploadUrlResponse = {
    uploadUrl: target.url,
    parameters: target.parameters,
    resourceUrl: target.resourceUrl,
  };
  res.json(body);
});
