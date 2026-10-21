import path from 'node:path';
import express from 'express';
import { env } from './env';
import { errorHandler, notFound } from './middleware/errors';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

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
