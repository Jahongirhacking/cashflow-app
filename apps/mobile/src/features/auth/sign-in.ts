import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { TranslationKey } from '@/i18n';
import { env } from '@/lib/env';

export type SignInStartResult =
  | { kind: 'redirecting' }
  | { kind: 'code'; code: string }
  | { kind: 'error'; reason: string }
  | { kind: 'cancelled' };

export const AUTH_CALLBACK_PATH = 'auth/callback';

/** Deep link Google's callback redirects to on native (finance:// in builds, exp:// in Expo Go). */
export function nativeRedirectUri(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/**
 * Web: full-page redirect to the API, which bounces to Google and back with a cookie.
 * Native: system browser auth session; the API sends a one-time code to our deep link.
 */
export async function startGoogleSignIn(): Promise<SignInStartResult> {
  if (Platform.OS === 'web') {
    window.location.assign(`${env.apiUrl}/auth/google?platform=web`);
    return { kind: 'redirecting' };
  }

  const redirect = nativeRedirectUri();
  const authUrl = `${env.apiUrl}/auth/google?platform=native&redirect=${encodeURIComponent(redirect)}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect, {
    preferEphemeralSession: false,
  });
  if (result.type !== 'success') return { kind: 'cancelled' };
  return parseCallbackUrl(result.url);
}

export function parseCallbackUrl(url: string): SignInStartResult {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
  if (code) return { kind: 'code', code };
  return { kind: 'error', reason: error ?? 'google_error' };
}

const SIGN_IN_ERROR_KEYS: Record<string, TranslationKey> = {
  cancelled: 'auth.error.cancelled',
  invalid_state: 'auth.error.invalid_state',
  google_error: 'auth.error.google_error',
  server_error: 'auth.error.server_error',
  not_configured: 'auth.error.not_configured',
};

export function signInErrorKey(reason: string | null | undefined): TranslationKey | null {
  if (!reason) return null;
  return SIGN_IN_ERROR_KEYS[reason] ?? 'auth.error.google_error';
}
