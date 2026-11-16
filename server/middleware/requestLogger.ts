// Logs one line per request (method, url, status, duration) and attaches a
// child logger as `req.log`, tagged with a request id, for use in handlers.

import crypto from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger';

export const requestLogger = pinoHttp({
  logger,
  // Reuse an upstream proxy's id so log lines can be matched across hops.
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Health checks and static assets would drown out the API traffic.
  autoLogging: {
    ignore: (req) => req.url === '/api/healthz' || !req.url?.startsWith('/api'),
  },
  // Keep request lines short: no full header dump, and no query string, which
  // can carry search terms and other user input.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
