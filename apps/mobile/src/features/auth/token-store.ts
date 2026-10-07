import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'finance.session-token';

/**
 * Native: bearer token in the device keystore (expo-secure-store).
 * Web: nothing — the API sets an HTTP-only cookie the browser sends automatically.
 */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') return;
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // nothing to clear
    }
  },
};
