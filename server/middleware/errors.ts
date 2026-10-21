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
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  
  if (status >= 500) console.error(err);

  const body: ApiError = {
    error: status >= 500 ? 'Internal server error' : (err as Error).message,
  };

  res.status(status).json(body);
};
