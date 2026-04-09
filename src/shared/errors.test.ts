import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InsufficientCreditsError,
  ValidationError,
  ConflictError,
  ExpiredError,
  PipelineStageError,
} from '@/shared/errors';

describe('AppError', () => {
  it('sets message, code, and statusCode', () => {
    const error = new AppError('test message', 'TEST_CODE', 418);
    expect(error.message).toBe('test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(418);
  });

  it('is instanceof Error', () => {
    const error = new AppError('msg', 'CODE', 500);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name equal to "AppError"', () => {
    const error = new AppError('msg', 'CODE', 500);
    expect(error.name).toBe('AppError');
  });
});

describe('NotFoundError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new NotFoundError('User');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "NotFoundError"', () => {
    const error = new NotFoundError('User');
    expect(error.name).toBe('NotFoundError');
  });

  it('has code NOT_FOUND and statusCode 404', () => {
    const error = new NotFoundError('User');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('message includes resource and id when id is provided', () => {
    const error = new NotFoundError('User', 'abc-123');
    expect(error.message).toBe('User with id abc-123 not found');
  });

  it('message is "{resource} not found" when id is omitted', () => {
    const error = new NotFoundError('Exam');
    expect(error.message).toBe('Exam not found');
  });
});

describe('UnauthorizedError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new UnauthorizedError();
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "UnauthorizedError", code UNAUTHORIZED, statusCode 401', () => {
    const error = new UnauthorizedError();
    expect(error.name).toBe('UnauthorizedError');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
  });

  it('uses default message "Authentication required"', () => {
    const error = new UnauthorizedError();
    expect(error.message).toBe('Authentication required');
  });

  it('accepts custom message', () => {
    const error = new UnauthorizedError('Token expired');
    expect(error.message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "ForbiddenError", code FORBIDDEN, statusCode 403', () => {
    const error = new ForbiddenError();
    expect(error.name).toBe('ForbiddenError');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Access denied');
  });
});

describe('InsufficientCreditsError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new InsufficientCreditsError(10, 3);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "InsufficientCreditsError", code INSUFFICIENT_CREDITS, statusCode 402', () => {
    const error = new InsufficientCreditsError(10, 3);
    expect(error.name).toBe('InsufficientCreditsError');
    expect(error.code).toBe('INSUFFICIENT_CREDITS');
    expect(error.statusCode).toBe(402);
  });

  it('message includes required and available amounts', () => {
    const error = new InsufficientCreditsError(10, 3);
    expect(error.message).toBe('Insufficient credits: need 10, have 3');
  });
});

describe('ValidationError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new ValidationError('Invalid email');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "ValidationError", code VALIDATION_ERROR, statusCode 400', () => {
    const error = new ValidationError('Invalid email');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid email');
  });
});

describe('ConflictError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new ConflictError('Already exists');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "ConflictError", code CONFLICT, statusCode 409', () => {
    const error = new ConflictError('Already exists');
    expect(error.name).toBe('ConflictError');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Already exists');
  });
});

describe('ExpiredError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new ExpiredError('Token');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "ExpiredError", code EXPIRED, statusCode 410', () => {
    const error = new ExpiredError('Token');
    expect(error.name).toBe('ExpiredError');
    expect(error.code).toBe('EXPIRED');
    expect(error.statusCode).toBe(410);
    expect(error.message).toBe('Token has expired');
  });
});

describe('PipelineStageError', () => {
  it('is instanceof AppError and Error', () => {
    const error = new PipelineStageError('Stage failed', [{ stage: 'ocr' }]);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has name "PipelineStageError", code PIPELINE_ERROR, statusCode 500', () => {
    const error = new PipelineStageError('Stage failed', []);
    expect(error.name).toBe('PipelineStageError');
    expect(error.code).toBe('PIPELINE_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('exposes failures property', () => {
    const failures = [{ stage: 'ocr', reason: 'timeout' }, { stage: 'classify' }];
    const error = new PipelineStageError('Pipeline failed', failures);
    expect(error.failures).toBe(failures);
    expect(error.failures).toHaveLength(2);
  });

  it('message is set correctly', () => {
    const error = new PipelineStageError('OCR stage failed', []);
    expect(error.message).toBe('OCR stage failed');
  });
});
