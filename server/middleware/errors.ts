import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@shared/storefront.types';

// Throw this from any route to send `{ error }` with a status code.
// Express 5 forwards thrown/rejected errors from async handlers automatically.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `No route for ${req.method} ${req.path}`));
};

// Every error leaves the server as the ApiError shape from openapi.yaml.
// HttpErrors were thrown on purpose, so their message is safe to send.
// Anything else is unexpected: log it, and don't leak its details.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message };
    
    res.status(err.status).json(body);
    return;
  }

  // Client errors raised by Express middleware, like express.json():
  // 400 for malformed JSON and 413 for a body over the limit.
  if (err.status >= 400 && err.status < 500) {
    const body: ApiError = { error: err.expose ? err.message : 'Bad request' };

    res.status(err.status).json(body);
    return;
  }

  console.error(err);

  const body: ApiError = { error: 'Internal server error' };
  res.status(500).json(body);
};
