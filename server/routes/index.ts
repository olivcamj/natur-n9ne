import { Router } from 'express';
import { healthRouter } from './health';

// Everything here is mounted under /api (see app.ts).
// Add one router per area as it's built: store, products, collections, cart, admin, storage.
export const apiRouter = Router();

apiRouter.use(healthRouter);
