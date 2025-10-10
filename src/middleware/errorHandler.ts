import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../utils/httpErrors.js';
import { logger } from '../utils/logger.js';

type ErrorResponse = {
  code: number;
  message: string;
  details?: unknown;
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = 'Internal Server Error';
  let details: unknown;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Invalid request';
    details = err.flatten();
  }

  const logContext: Record<string, unknown> = {
    method: req.method,
    path: req.originalUrl,
    status,
  };

  if (err instanceof Error) {
    logContext.error = err.message;
    if (err.stack) {
      logContext.stack = err.stack;
    }
  } else {
    logContext.error = String(err);
  }

  if (details) {
    logContext.details = details;
  }

  logger.error('Request failed', logContext);

  const payload: ErrorResponse = {
    code: status,
    message,
  };

  if (typeof details !== 'undefined') {
    payload.details = details;
  }

  res.status(status).json(payload);
}
