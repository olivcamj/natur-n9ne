import { env } from './env';
import { createApp } from './app';
import { logger } from './lib/logger';

const app = createApp();

app.listen(env.API_PORT, () => {
  logger.info(`API server listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});
