import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

const DEFAULT_API_PORT = 3000;

/**
 * Resolve the API base URL.
 * 1. EXPO_PUBLIC_API_URL (inlined at build time by Expo).
 * 2. In development on a device/emulator: the Expo dev-server host on port 3000.
 * 3. http://localhost:3000
 */
function readConfiguredApiUrl(): string | undefined {
  // Must stay a static member expression so Expo can inline it at build time.
  const value: unknown = process.env.EXPO_PUBLIC_API_URL;
  return typeof value === 'string' ? value.trim() : undefined;
}

function resolveApiUrl(): string {
  const configured = readConfiguredApiUrl();
  if (configured) return normalise(configured);

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

const envSchema = z.object({
  apiUrl: z.url(),
});

export type ClientEnv = z.infer<typeof envSchema>;

export const env: ClientEnv = envSchema.parse({ apiUrl: resolveApiUrl() });
