import { AppException } from '../../common/errors/app.exception';

export const SPREADSHEET_ACCESS_DENIED_MESSAGE = 'The Finance app cannot access this spreadsheet.';
export const SPREADSHEET_NOT_FOUND_MESSAGE = 'This spreadsheet could not be found.';

interface GoogleErrorLike {
  response?: { status?: number; data?: { error?: { message?: string; status?: string } } };
  status?: number;
  code?: number | string;
  message?: string;
}

export function googleErrorStatus(error: unknown): number | null {
  const e = error as GoogleErrorLike;
  const status = e.response?.status ?? e.status ?? (typeof e.code === 'number' ? e.code : null);
  return typeof status === 'number' ? status : null;
}

/** Translate a Google API failure into a stable application error. */
export function mapGoogleError(error: unknown): AppException {
  if (error instanceof AppException) return error;
  const status = googleErrorStatus(error);
  switch (status) {
    case 403:
      return new AppException('SPREADSHEET_ACCESS_DENIED', SPREADSHEET_ACCESS_DENIED_MESSAGE, {
        cause: error,
      });
    case 404:
      return new AppException('SPREADSHEET_NOT_FOUND', SPREADSHEET_NOT_FOUND_MESSAGE, {
        cause: error,
      });
    case 429:
      return new AppException(
        'RATE_LIMITED',
        'Google Sheets is rate limiting requests. Please try again shortly.',
        {
          cause: error,
        },
      );
    case 400: {
      const message =
        (error as GoogleErrorLike).response?.data?.error?.message ??
        'Google Sheets rejected the request.';
      return new AppException('GOOGLE_API_ERROR', message, { cause: error });
    }
    default:
      return new AppException(
        'GOOGLE_API_ERROR',
        'Google Sheets is not responding. Please try again.',
        {
          cause: error,
        },
      );
  }
}

export function isRetryableGoogleError(error: unknown): boolean {
  const status = googleErrorStatus(error);
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}
