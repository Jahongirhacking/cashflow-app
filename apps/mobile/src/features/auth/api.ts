import type { AuthSession, CurrentUser } from '@finance/shared';
import { api, ApiError } from '@/lib/api';

/** Resolves to null when there is no valid session; throws only for network/server failures. */
export async function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  try {
    return await api.get<CurrentUser>('/auth/me', undefined, signal);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') return null;
    throw error;
  }
}

export function exchangeNativeCode(code: string): Promise<AuthSession> {
  return api.post<AuthSession>('/auth/exchange', { code });
}

export function logoutRequest(): Promise<void> {
  return api.post<void>('/auth/logout');
}
