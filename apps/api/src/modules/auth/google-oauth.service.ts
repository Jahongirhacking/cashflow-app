import { Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';
import type { GoogleProfile } from '../users/users.service';

/** Minimal scopes: we only need to know who the user is. */
const SCOPES = ['openid', 'email', 'profile'];

/**
 * Talks to Google's OAuth endpoints. Identity only — spreadsheet access is a separate
 * concern handled by the service account (see GoogleSheetsService).
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private client: OAuth2Client | null = null;

  constructor(private readonly config: AppConfigService) {}

  get isConfigured(): boolean {
    return this.config.googleOAuth !== null;
  }

  buildAuthUrl(state: string): string {
    return this.getClient().generateAuthUrl({
      access_type: 'online',
      scope: SCOPES,
      state,
      prompt: 'select_account',
      include_granted_scopes: false,
    });
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const client = this.getClient();
    let idToken: string | null | undefined;
    try {
      const { tokens } = await client.getToken(code);
      idToken = tokens.id_token;
    } catch (error) {
      this.logger.warn(`Google code exchange failed: ${describe(error)}`);
      throw new AppException(
        'UNAUTHORIZED',
        'Google sign-in could not be completed. Please try again.',
      );
    }
    if (!idToken)
      throw new AppException('UNAUTHORIZED', 'Google did not return an identity token.');
    return this.verifyIdToken(idToken);
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const client = this.getClient();
    const oauth = this.requireConfig();
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: oauth.clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new AppException('UNAUTHORIZED', 'Google account is missing an email address.');
      }
      if (payload.email_verified === false) {
        throw new AppException('UNAUTHORIZED', 'Your Google email address is not verified.');
      }
      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        name: payload.name?.trim() || payload.email.split('@')[0] || 'User',
        picture: payload.picture ?? null,
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.warn(`Google ID token verification failed: ${describe(error)}`);
      throw new AppException('UNAUTHORIZED', 'Google sign-in could not be verified.');
    }
  }

  private requireConfig() {
    const oauth = this.config.googleOAuth;
    if (!oauth) {
      throw AppException.configuration(
        'Google sign-in is not configured on the server (GOOGLE_CLIENT_ID/SECRET).',
      );
    }
    return oauth;
  }

  private getClient(): OAuth2Client {
    if (this.client) return this.client;
    const oauth = this.requireConfig();
    this.client = new OAuth2Client({
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      redirectUri: oauth.redirectUri,
    });
    return this.client;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
