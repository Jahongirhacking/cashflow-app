import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

const DEFAULT_API_PORT = 3000;

/**
 * Resolve the API base URL.
 * 1. EXPO_PUBLIC_API_URL (inlined at build time by Expo). Accepts "https://api.example.com",
 *    "api.example.com" (https assumed) or "/api" (same origin, web only).
 * 2. In development on a device/emulator: the Expo dev-server host on port 3000.
 * 3. http://localhost:3000
 * Never throws: a bad value is reported in the console and the app still renders, so a
 * misconfigured production build shows "can't reach the server" instead of a blank page.
 */
function readConfiguredApiUrl(): string | undefined {
  // Must stay a static member expression so Expo can inline it at build time.
  const value: unknown = process.env.EXPO_PUBLIC_API_URL;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function webOrigin(): string | null {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : null;
}

/** Turn "/api" or "api.example.com" into an absolute URL. */
function absolutise(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) {
    const origin = webOrigin();
    return origin ? `${origin}${raw}` : `http://localhost:${DEFAULT_API_PORT}${raw}`;
  }
  return `https://${raw}`;
}

function resolveApiUrl(): string {
  const configured = readConfiguredApiUrl();
  if (configured) return normalise(absolutise(configured));

  if (__DEV__ && Platform.OS !== 'web') {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(':')[0];
    if (host) return `http://${host}:${DEFAULT_API_PORT}`;
  }
  return `http://localhost:${DEFAULT_API_PORT}`;
}

/** Android emulators reach the host machine through 10.0.2.2, not localhost. */
function normalise(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  if (Platform.OS === 'android' && /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(trimmed)) {
    return trimmed.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
  }
  return trimmed;
}

/** Android OAuth client id for direct Google access (public by design; it is not a secret). */
function readGoogleClientId(): string | null {
  const value: unknown = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * `direct`: the app signs in with Google itself and talks to the Sheets API from the device (no
 * backend). `api`: everything goes through the NestJS API. Default: direct on native when an OAuth
 * client id is configured, api otherwise (the web build keeps using the API for now).
 */
function readDataMode(googleClientId: string | null): 'direct' | 'api' {
  const value: unknown = process.env.EXPO_PUBLIC_DATA_MODE;
  if (value === 'direct' || value === 'api') return value;
  return googleClientId && Platform.OS !== 'web' ? 'direct' : 'api';
}

const envSchema = z.object({
  apiUrl: z.url(),
  googleClientId: z.string().nullable(),
  dataMode: z.enum(['direct', 'api']),
});

export type ClientEnv = z.infer<typeof envSchema>;

function loadEnv(): ClientEnv {
  const googleClientId = readGoogleClientId();
  const candidate = {
    apiUrl: resolveApiUrl(),
    googleClientId,
    dataMode: readDataMode(googleClientId),
  };
  const parsed = envSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  console.error(
    `[env] EXPO_PUBLIC_API_URL is not a valid URL ("${candidate.apiUrl}"); falling back to http://localhost:${DEFAULT_API_PORT}. Set it to an absolute URL (https://api.example.com) when exporting the web build.`,
  );
  return {
    apiUrl: `http://localhost:${DEFAULT_API_PORT}`,
    googleClientId,
    dataMode: readDataMode(googleClientId),
  };
}

export const env: ClientEnv = loadEnv();
