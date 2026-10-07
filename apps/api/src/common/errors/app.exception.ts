import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode, ApiFieldError } from '@finance/shared';

const DEFAULT_STATUS: Record<ApiErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  SPREADSHEET_NOT_CONNECTED: HttpStatus.PRECONDITION_FAILED,
  SPREADSHEET_INVALID_URL: HttpStatus.BAD_REQUEST,
  SPREADSHEET_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  SPREADSHEET_NOT_FOUND: HttpStatus.NOT_FOUND,
  GOOGLE_API_ERROR: HttpStatus.BAD_GATEWAY,
  CONFIGURATION_ERROR: HttpStatus.SERVICE_UNAVAILABLE,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

export interface AppExceptionOptions {
  status?: HttpStatus;
  details?: ApiFieldError[];
  cause?: unknown;
}

/**
 * Domain-level error carrying a stable machine-readable `code`.
 * The global filter serialises it into the `ApiErrorResponse` envelope.
 */
export class AppException extends HttpException {
  readonly code: ApiErrorCode;
  readonly details: ApiFieldError[] | undefined;

  constructor(code: ApiErrorCode, message: string, options: AppExceptionOptions = {}) {
    super(message, options.status ?? DEFAULT_STATUS[code], { cause: options.cause });
    this.code = code;
    this.details = options.details;
  }

  static validation(details: ApiFieldError[], message = 'Validation failed'): AppException {
    return new AppException('VALIDATION_ERROR', message, { details });
  }

  static notFound(what: string): AppException {
    return new AppException('NOT_FOUND', `${what} not found`);
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException('UNAUTHORIZED', message);
  }

  static configuration(message: string): AppException {
    return new AppException('CONFIGURATION_ERROR', message);
  }
}
