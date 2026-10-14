import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { env } from '@/lib/env';

/**
 * Direct Google sign-in on the device (no server): authorization-code flow with PKCE against an
 * Android OAuth client, asking for identity plus the Sheets scope so the app can read and write the
 * user's spreadsheet itself. Tokens live in the device keystore; the refresh token keeps the session.
 */
const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
];
const TOKENS_KEY = 'finance.google.tokens';
const PROFILE_KEY = 'finance.google.profile';
const EXPIRY_MARGIN_MS = 60_000;

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}

/** Google's native redirect scheme is the reversed client id. */
export function googleRedirectUri(clientId: string): string {
  const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return AuthSession.makeRedirectUri({
    native: `com.googleusercontent.apps.${prefix}:/oauth2redirect`,
  });
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(key)
        : await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const raw = value === null ? null : JSON.stringify(value);
  if (Platform.OS === 'web') {
    if (raw === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, raw);
    return;
  }
  if (raw === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, raw);
}

function toTokens(
  response: AuthSession.TokenResponse,
  previous?: GoogleTokens | null,
): GoogleTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? previous?.refreshToken ?? null,
    expiresAt: (response.issuedAt + (response.expiresIn ?? 3600)) * 1000,
    scope: response.scope ?? previous?.scope ?? GOOGLE_SCOPES.join(' '),
  };
}

export const googleDirect = {
  get clientId(): string {
    return env.googleClientId ?? '';
  },

  isConfigured(): boolean {
    return Boolean(env.googleClientId);
  },

  getProfile(): Promise<GoogleProfile | null> {
    return readJson<GoogleProfile>(PROFILE_KEY);
  },

  async hasSession(): Promise<boolean> {
    const tokens = await readJson<GoogleTokens>(TOKENS_KEY);
    return Boolean(tokens && (tokens.refreshToken || tokens.expiresAt > Date.now()));
  },

  /** Opens the system browser for consent; resolves with the profile or null when the user cancelled. */
  async signIn(): Promise<GoogleProfile | null> {
    const clientId = this.clientId;
    if (!clientId) throw new Error('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is not configured');
    const redirectUri = googleRedirectUri(clientId);
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: GOOGLE_SCOPES,
      redirectUri,
      usePKCE: true,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    });
    const result = await request.promptAsync(DISCOVERY);
    if (result.type !== 'success') return null;
    const response = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: result.params.code ?? '',
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      DISCOVERY,
    );
    const tokens = toTokens(response);
    await writeJson(TOKENS_KEY, tokens);
    const profile = await fetchProfile(tokens.accessToken);
    await writeJson(PROFILE_KEY, profile);
    return profile;
  },

  /** Valid access token for the Sheets API; refreshes silently when close to expiry or forced. */
  async getAccessToken(options: { force?: boolean } = {}): Promise<string> {
    const tokens = await readJson<GoogleTokens>(TOKENS_KEY);
    if (!tokens) throw new Error('Not signed in');
    const fresh = tokens.expiresAt - Date.now() > EXPIRY_MARGIN_MS;
    if (fresh && !options.force) return tokens.accessToken;
    if (!tokens.refreshToken) throw new Error('Session expired');
    const response = await AuthSession.refreshAsync(
      { clientId: this.clientId, refreshToken: tokens.refreshToken },
      DISCOVERY,
    );
    const next = toTokens(response, tokens);
    await writeJson(TOKENS_KEY, next);
    return next.accessToken;
  },

  async signOut(): Promise<void> {
    const tokens = await readJson<GoogleTokens>(TOKENS_KEY);
    await writeJson(TOKENS_KEY, null);
    await writeJson(PROFILE_KEY, null);
    if (tokens?.refreshToken) {
      // Best effort: revoking the grant means the next sign-in asks for consent again.
      await AuthSession.revokeAsync(
        { token: tokens.refreshToken, clientId: this.clientId },
        DISCOVERY,
      ).catch(() => undefined);
    }
  },
};

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Could not load the Google profile (${response.status})`);
  const data = (await response.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };
  return {
    googleId: data.sub,
    email: data.email.toLowerCase(),
    name: data.name?.trim() || data.email.split('@')[0] || 'User',
    picture: data.picture ?? null,
  };
}
