import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleServiceAccountConfig {
  email: string;
  privateKey: string;
}

/** Typed facade over the validated environment. Services ask this instead of reading process.env. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get apiPublicUrl(): string {
    return this.config.get('API_PUBLIC_URL', { infer: true });
  }

  get appWebUrl(): string {
    return this.config.get('APP_WEB_URL', { infer: true });
  }

  get corsOrigins(): string[] {
    const extra = this.config.get('CORS_ORIGINS', { infer: true });
    const list = (extra ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    return Array.from(new Set([this.appWebUrl, ...list]));
  }

  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiresIn(): string {
    return this.config.get('JWT_EXPIRES_IN', { infer: true });
  }

  get cookie(): {
    sameSite: 'lax' | 'strict' | 'none';
    domain: string | undefined;
    secure: boolean;
  } {
    const sameSite = this.config.get('COOKIE_SAME_SITE', { infer: true });
    return {
      sameSite,
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
      secure: this.isProduction || sameSite === 'none',
    };
  }

  get nativeScheme(): string {
    return this.config.get('AUTH_NATIVE_SCHEME', { infer: true });
  }

  get dataDir(): string {
    return this.config.get('DATA_DIR', { infer: true });
  }

  get throttle(): { ttlSeconds: number; limit: number } {
    return {
      ttlSeconds: this.config.get('THROTTLE_TTL_SECONDS', { infer: true }),
      limit: this.config.get('THROTTLE_LIMIT', { infer: true }),
    };
  }

  /** Service-account email shown to users in the setup wizard. Null when not configured. */
  get serviceAccountEmail(): string | null {
    return this.config.get('GOOGLE_SERVICE_ACCOUNT_EMAIL', { infer: true }) ?? null;
  }

  get sheetsBackend(): 'google' | 'memory' {
    return this.config.get('SHEETS_BACKEND', { infer: true });
  }

  get registrySpreadsheetId(): string | null {
    return this.config.get('GOOGLE_SPREADSHEET_ID', { infer: true }) ?? null;
  }

  get googleOAuth(): GoogleOAuthConfig | null {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    if (!clientId || !clientSecret) return null;
    const redirectUri =
      this.config.get('GOOGLE_OAUTH_REDIRECT_URI', { infer: true }) ??
      `${this.apiPublicUrl.replace(/\/$/, '')}/auth/google/callback`;
    return { clientId, clientSecret, redirectUri };
  }

  get googleServiceAccount(): GoogleServiceAccountConfig | null {
    const email = this.config.get('GOOGLE_SERVICE_ACCOUNT_EMAIL', { infer: true });
    const privateKey = this.config.get('GOOGLE_PRIVATE_KEY', { infer: true });
    if (!email || !privateKey) return null;
    return { email, privateKey };
  }
}
