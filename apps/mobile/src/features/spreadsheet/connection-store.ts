import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finance.local.connections';
/** Pre-October-2026 single-slot key; read once as a fallback and migrated on the next save. */
const LEGACY_KEY = 'finance.local.connection';

export interface StoredConnection {
  spreadsheetId: string;
  spreadsheetName: string;
  verifiedAt: string;
}

type ConnectionMap = Record<string, StoredConnection>;

async function readMap(): Promise<ConnectionMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as ConnectionMap) : {};
  } catch {
    return {};
  }
}

function isConnection(value: unknown): value is StoredConnection {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as StoredConnection).spreadsheetId === 'string'
  );
}

/**
 * The connected spreadsheet, remembered on the device **per signed-in account** (localStorage on
 * web, AsyncStorage on Android). Direct mode reads it as the source of truth; API mode uses it to
 * reconnect silently after a fresh sign-in, so nobody is asked for the URL twice. It survives
 * sign-out on purpose; a different account on the same device gets its own slot.
 */
export const connectionStore = {
  /** `userKey`: a stable id of the account (Google id in direct mode, API user id otherwise). */
  async load(userKey: string): Promise<StoredConnection | null> {
    const map = await readMap();
    const own = map[userKey];
    if (isConnection(own)) return own;
    // One-time fallback to the old single slot (whoever signs in first inherits it).
    try {
      const legacy: unknown = JSON.parse((await AsyncStorage.getItem(LEGACY_KEY)) ?? 'null');
      return isConnection(legacy) ? legacy : null;
    } catch {
      return null;
    }
  },
  async save(userKey: string, connection: StoredConnection): Promise<void> {
    try {
      const map = await readMap();
      map[userKey] = connection;
      await AsyncStorage.setItem(KEY, JSON.stringify(map));
      await AsyncStorage.removeItem(LEGACY_KEY);
    } catch {
      // storage blocked: the server copy (API mode) still has it
    }
  },
  async clear(userKey: string): Promise<void> {
    try {
      const map = await readMap();
      delete map[userKey];
      await AsyncStorage.setItem(KEY, JSON.stringify(map));
    } catch {
      // nothing to clear
    }
  },
};
