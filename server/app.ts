import path from 'node:path';
import express from 'express';
import { env } from './env';
import { errorHandler, notFound } from './middleware/errors';
import { apiLimiter, cartWriteLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/requestLogger';
import { securityHeaders } from './middleware/security';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by'); // helmet removes it too; kept as a safeguard

  app.use(securityHeaders);
  app.use(requestLogger);
  // Before body parsing, so rejected requests cost little.
  app.use('/api', apiLimiter);
  app.use('/api/cart', cartWriteLimiter);
  // Largest payloads are admin product edits; images go straight to Shopify.
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);
  app.use('/api', notFound); // unknown /api/* → JSON 404, not the SPA

  // In production the same server hosts the built frontend (vite outDir).
  // In dev, Vite serves the frontend and proxies /api here.
  if (env.NODE_ENV === 'production') {
    const publicDir = path.resolve(import.meta.dirname, '../dist/public');
    app.use(express.static(publicDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
