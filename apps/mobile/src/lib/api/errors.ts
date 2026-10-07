import type { ApiErrorCode, ApiFieldError } from '@finance/shared';

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNEXPECTED_RESPONSE';

/** Every failure surfaced by the API client. `status` is 0 when no response was received. */
export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly details: ApiFieldError[] | undefined;

  constructor(code: ClientErrorCode, message: string, status = 0, details?: ApiFieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }

  get isAuth(): boolean {
    return this.code === 'UNAUTHORIZED';
  }
}

const FRIENDLY_MESSAGES: Partial<Record<ClientErrorCode, string>> = {
  NETWORK_ERROR: "Can't reach the server. Check your connection and try again.",
  TIMEOUT: 'The server took too long to respond. Please try again.',
  UNEXPECTED_RESPONSE: 'The server returned an unexpected response.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  SPREADSHEET_NOT_CONNECTED: 'Connect your Google Spreadsheet to continue.',
  SPREADSHEET_ACCESS_DENIED: 'Unable to access your spreadsheet.',
  SPREADSHEET_NOT_FOUND: "We couldn't find that spreadsheet.",
  GOOGLE_API_ERROR: 'Google Sheets is not responding right now. Please try again.',
  CONFIGURATION_ERROR: 'The server is not fully configured yet.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

/** Message safe to show to a user. Validation errors keep the server's wording (already user-facing). */
export function getUserMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') {
      return error.details?.[0]?.message ?? error.message;
    }
    return FRIENDLY_MESSAGES[error.code] ?? fallback;
  }
  return fallback;
}
