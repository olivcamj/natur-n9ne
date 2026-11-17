import { Router } from 'express';
import { healthRouter } from './health';
import { productsRouter } from './products';
import { cartRouter } from './cart';
import { storeRouter } from './store';
import { collectionsRouter } from './collections';
import { adminRouter } from './admin';
import { storageRouter } from './storage';

// Everything here is mounted under /api (see app.ts).
// Add one router per area as it's built: store, products, collections, cart, admin, storage.
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(productsRouter);
apiRouter.use(cartRouter);
apiRouter.use(storeRouter);
apiRouter.use(collectionsRouter);
apiRouter.use(adminRouter);
apiRouter.use(storageRouter);
