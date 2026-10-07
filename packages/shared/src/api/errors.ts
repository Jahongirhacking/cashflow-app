export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SPREADSHEET_NOT_CONNECTED',
  'SPREADSHEET_INVALID_URL',
  'SPREADSHEET_ACCESS_DENIED',
  'SPREADSHEET_NOT_FOUND',
  'GOOGLE_API_ERROR',
  'CONFIGURATION_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiFieldError {
  path: string;
  message: string;
}

/** Structured error envelope returned by every failing API response. */
export interface ApiErrorResponse {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiFieldError[];
  requestId?: string;
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  );
}
