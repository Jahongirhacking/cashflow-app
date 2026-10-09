import type { ApiErrorCode, ApiFieldError } from '@finance/shared';
import { translate, type TranslationKey } from '@/i18n';

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

/** Message safe to show to a user. Validation errors keep the server's wording (already user-facing). */
export function getUserMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') {
      return error.details?.[0]?.message ?? error.message;
    }
    if (error.code === 'CONFIGURATION_ERROR' && error.message) return error.message;
    return (
      translate(`errors.${error.code}` as TranslationKey) ||
      fallback ||
      translate('errors.fallback')
    );
  }
  return fallback ?? translate('errors.fallback');
}
