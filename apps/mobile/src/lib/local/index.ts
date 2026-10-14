import {
  FetchSheetsClient,
  LocalApi,
  type LocalRequest,
  type LocalUserStore,
  type User,
} from '@finance/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { googleDirect } from '@/features/auth/google-direct';

const CONNECTION_KEY = 'finance.local.connection';

interface StoredConnection {
  spreadsheetId: string;
  spreadsheetName: string;
  verifiedAt: string;
}

/**
 * The signed-in Google account plus the connected spreadsheet, kept on the device. This replaces the
 * server's user registry when the app talks to Google Sheets directly.
 */
const localUsers: LocalUserStore = {
  async current(): Promise<User | null> {
    const profile = await googleDirect.getProfile();
    if (!profile || !(await googleDirect.hasSession())) return null;
    let connection: StoredConnection | null = null;
    try {
      const raw = await AsyncStorage.getItem(CONNECTION_KEY);
      connection = raw ? (JSON.parse(raw) as StoredConnection) : null;
    } catch {
      connection = null;
    }
    return {
      id: `usr_${profile.googleId}`,
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      spreadsheetId: connection?.spreadsheetId ?? null,
      spreadsheetName: connection?.spreadsheetName ?? null,
      spreadsheetVerifiedAt: connection?.verifiedAt ?? null,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
  },
  async setSpreadsheet(_userId, connection) {
    await AsyncStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
    const user = await this.current();
    if (!user) throw new Error('Not signed in');
    return user;
  },
  async signOut() {
    await googleDirect.signOut();
  },
};

let instance: LocalApi | null = null;

/** One engine per app session; caches inside it keep Sheets reads low, exactly like the server. */
export function localApi(): LocalApi {
  if (!instance) {
    instance = new LocalApi({
      client: new FetchSheetsClient({
        getAccessToken: (options) => googleDirect.getAccessToken(options),
        logger: {
          log: () => undefined,
          warn: (m) => console.warn(m),
          error: (m) => console.error(m),
        },
      }),
      users: localUsers,
    });
  }
  return instance;
}

export function localRequest<T>(req: LocalRequest): Promise<T> {
  return localApi().request<T>(req);
}
