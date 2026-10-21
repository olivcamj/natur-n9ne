import { env } from './env';
import { createApp } from './app';

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`API server listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});
