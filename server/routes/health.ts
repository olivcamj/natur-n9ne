import { Router } from 'express';
import type { HealthStatus } from '@shared/storefront.types';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  const body: HealthStatus = { status: 'ok' };
  res.json(body);
});
