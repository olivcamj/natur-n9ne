import { Router } from 'express';
import { healthRouter } from './health';
import { productsRouter } from './products';
import { cartRouter } from './cart';
import { storeRouter } from './store';

// Everything here is mounted under /api (see app.ts).
// Add one router per area as it's built: store, products, collections, cart, admin, storage.
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(productsRouter);
apiRouter.use(cartRouter);
apiRouter.use(storeRouter);
