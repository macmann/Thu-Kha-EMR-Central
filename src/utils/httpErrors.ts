export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', details?: unknown) {
    super(404, message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, message, details);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', details?: unknown) {
    super(422, message, details);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service Unavailable', details?: unknown) {
    super(503, message, details);
  }
}
