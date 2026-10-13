import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'finance.session-token';

/**
 * Native: bearer token in the device keystore (expo-secure-store).
 * Web: bearer token in localStorage. The API also sets an HTTP-only cookie, but when the web app
 * and the API are on different sites (e.g. vercel.app + onrender.com) browsers drop that
 * third-party cookie, so the token is what keeps the session.
 */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(KEY) ?? null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(KEY, token);
      } catch {
        // storage blocked: the cookie may still carry the session
      }
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(KEY);
      } catch {
        // nothing to clear
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // nothing to clear
    }
  },
};
