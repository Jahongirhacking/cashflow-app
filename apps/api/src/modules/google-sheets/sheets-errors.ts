import { AppException } from '../../common/errors/app.exception';

export const SPREADSHEET_ACCESS_DENIED_MESSAGE =
  'The My Cashify app cannot access this spreadsheet.';
export const SPREADSHEET_NOT_FOUND_MESSAGE = 'This spreadsheet could not be found.';

interface GoogleErrorDetail {
  reason?: string;
  '@type'?: string;
}

interface GoogleErrorLike {
  response?: {
    status?: number;
    data?: { error?: { message?: string; status?: string; details?: GoogleErrorDetail[] } };
  };
  status?: number;
  code?: number | string;
  message?: string;
}

export const SHEETS_API_DISABLED_MESSAGE =
  'The Google Sheets API is not enabled for the My Cashify service-account project. Enable it in Google Cloud Console, wait a minute and retry.';

export function googleErrorStatus(error: unknown): number | null {
  const e = error as GoogleErrorLike;
  const status = e.response?.status ?? e.status ?? (typeof e.code === 'number' ? e.code : null);
  return typeof status === 'number' ? status : null;
}

function googleErrorBody(error: unknown) {
  return (error as GoogleErrorLike).response?.data?.error;
}

/** A 403 that means "the project never enabled the Sheets API", not "the sheet is not shared". */
export function isSheetsApiDisabledError(error: unknown): boolean {
  if (googleErrorStatus(error) !== 403) return false;
  const body = googleErrorBody(error);
  const reasons = (body?.details ?? []).map((d) => d.reason ?? '');
  if (reasons.some((r) => r === 'SERVICE_DISABLED' || r === 'accessNotConfigured')) return true;
  const message = body?.message ?? '';
  return /has not been used in project|is disabled/i.test(message);
}

/** Compact one-line description for server logs (never sent to clients). */
export function describeGoogleError(error: unknown): string {
  const status = googleErrorStatus(error);
  const body = googleErrorBody(error);
  const reason =
    body?.details
      ?.map((d) => d.reason)
      .filter(Boolean)
      .join(',') ||
    body?.status ||
    '';
  const message = body?.message ?? (error instanceof Error ? error.message : String(error));
  return `Google Sheets API error${status ? ` ${status}` : ''}${reason ? ` [${reason}]` : ''}: ${message}`;
}

/** Translate a Google API failure into a stable application error. */
export function mapGoogleError(error: unknown): AppException {
  if (error instanceof AppException) return error;
  const status = googleErrorStatus(error);
  if (isSheetsApiDisabledError(error)) {
    return new AppException('CONFIGURATION_ERROR', SHEETS_API_DISABLED_MESSAGE, { cause: error });
  }
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
