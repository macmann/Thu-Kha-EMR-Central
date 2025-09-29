import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../utils/httpErrors.js';

type ErrorResponse = {
  code: number;
  message: string;
  details?: unknown;
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
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

  const payload: ErrorResponse = {
    code: status,
    message,
  };

  if (typeof details !== 'undefined') {
    payload.details = details;
  }

  res.status(status).json(payload);
}
