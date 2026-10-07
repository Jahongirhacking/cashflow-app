import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
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

export const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  invalid_state: 'The sign-in link expired. Please try again.',
  google_error: 'Google sign-in failed. Please try again.',
  server_error: 'Something went wrong on our side. Please try again.',
  not_configured: 'Google sign-in is not configured on the server yet.',
};

export function signInErrorMessage(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return SIGN_IN_ERROR_MESSAGES[reason] ?? SIGN_IN_ERROR_MESSAGES.google_error ?? null;
}
