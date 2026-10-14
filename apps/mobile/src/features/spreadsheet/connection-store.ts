import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finance.local.connection';

export interface StoredConnection {
  spreadsheetId: string;
  spreadsheetName: string;
  verifiedAt: string;
}

/**
 * The connected spreadsheet, remembered on the device (localStorage on web, AsyncStorage on
 * Android). Direct mode reads it as the source of truth; API mode uses it to reconnect silently
 * after a fresh sign-in, so the user never has to paste the URL twice. It survives sign-out on purpose.
 */
export const connectionStore = {
  async load(): Promise<StoredConnection | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as StoredConnection).spreadsheetId === 'string'
      ) {
        return parsed as StoredConnection;
      }
      return null;
    } catch {
      return null;
    }
  },
  async save(connection: StoredConnection): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(connection));
    } catch {
      // storage blocked: the server copy (API mode) still has it
    }
  },
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  },
};
