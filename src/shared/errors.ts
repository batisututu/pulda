export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      'NOT_FOUND',
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits: need ${required}, have ${available}`,
      'INSUFFICIENT_CREDITS',
      402
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class ExpiredError extends AppError {
  constructor(resource: string) {
    super(`${resource} has expired`, 'EXPIRED', 410);
  }
}

export class PipelineStageError extends AppError {
  constructor(
    message: string,
    public readonly failures: unknown[]
  ) {
    super(message, 'PIPELINE_ERROR', 500);
  }
}

export class RepositoryError extends AppError {
  constructor(message: string) {
    super(message, 'REPOSITORY_ERROR', 500);
  }
}
