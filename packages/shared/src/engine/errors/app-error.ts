import type { ApiErrorCode, ApiFieldError } from '../../api/errors';

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SPREADSHEET_NOT_CONNECTED: 412,
  SPREADSHEET_INVALID_URL: 400,
  SPREADSHEET_ACCESS_DENIED: 403,
  SPREADSHEET_NOT_FOUND: 404,
  GOOGLE_API_ERROR: 502,
  CONFIGURATION_ERROR: 503,
  INTERNAL_ERROR: 500,
};

export interface AppErrorOptions {
  status?: number;
  details?: ApiFieldError[];
  cause?: unknown;
}

/**
 * Domain error with a stable machine-readable `code` and an HTTP-style status.
 * Thrown by the engine on every platform; the API serialises it into the error envelope,
 * the mobile app maps the code to a localised message.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details: ApiFieldError[] | undefined;

  constructor(code: ApiErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.status ?? DEFAULT_STATUS[code];
    this.details = options.details;
  }

  static validation(details: ApiFieldError[], message = 'Validation failed'): AppError {
    return new AppError('VALIDATION_ERROR', message, { details });
  }

  static notFound(what: string): AppError {
    return new AppError('NOT_FOUND', `${what} not found`);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHORIZED', message);
  }

  static configuration(message: string): AppError {
    return new AppError('CONFIGURATION_ERROR', message);
  }
}
