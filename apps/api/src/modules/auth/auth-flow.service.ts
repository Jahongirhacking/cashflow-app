import { Injectable, Logger } from '@nestjs/common';
import type { AuthPlatform, AuthSession } from '@finance/shared';
import type { Response } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { clearOAuthNonceCookie, setOAuthNonceCookie, setSessionCookie } from './session-cookie';

interface CallbackQuery {
  code?: string;
  state: string;
  error?: string;
}

/**
 * Orchestrates the OAuth round-trip for both platforms:
 *  - web: session cookie, redirect back to the web app
 *  - native: one-time exchange code delivered through the app's deep link
 */
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);

  constructor(
    private readonly google: GoogleOAuthService,
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  start(platform: AuthPlatform, redirect: string | null, res: Response): string {
    const nativeRedirect = platform === 'native' ? this.validateNativeRedirect(redirect) : null;
    if (!this.google.isConfigured) {
      this.logger.error(
        'Google sign-in requested but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set',
      );
      return this.errorRedirect(platform, nativeRedirect, 'not_configured');
    }
    const { state, nonce } = this.auth.createState(platform, nativeRedirect);
    if (platform === 'web') setOAuthNonceCookie(res, this.config, nonce);
    return this.google.buildAuthUrl(state);
  }

  /** Returns the URL to redirect the browser to. Errors become redirect params, never raw pages. */
  async complete(query: CallbackQuery, nonceCookie: string | null, res: Response): Promise<string> {
    let state: ReturnType<AuthService['verifyState']>;
    try {
      state = this.auth.verifyState(query.state);
    } catch (error) {
      this.logger.warn(`OAuth callback with invalid state: ${(error as Error).message}`);
      return this.errorRedirect('web', null, 'invalid_state');
    }

    const failure = (reason: string) => this.errorRedirect(state.platform, state.redirect, reason);

    if (query.error || !query.code) {
      return failure(query.error === 'access_denied' ? 'cancelled' : 'google_error');
    }
    if (state.platform === 'web') {
      clearOAuthNonceCookie(res, this.config);
      if (!nonceCookie || nonceCookie !== state.nonce) {
        this.logger.warn('OAuth callback nonce mismatch');
        return failure('invalid_state');
      }
    }

    try {
      const profile = await this.google.exchangeCode(query.code);
      const user = await this.users.findOrCreateFromGoogle(profile);

      if (state.platform === 'native') {
        const code = this.auth.issueExchangeCode(user.id);
        return appendParams(state.redirect ?? `${this.config.nativeScheme}://auth/callback`, {
          code,
        });
      }

      const session = this.auth.issueSession(user.id);
      setSessionCookie(res, this.config, session.accessToken, session.expiresAt);
      return `${this.config.appWebUrl.replace(/\/$/, '')}/auth/callback`;
    } catch (error) {
      this.logger.warn(`OAuth completion failed: ${(error as Error).message}`);
      return failure(
        error instanceof AppException && error.code === 'UNAUTHORIZED'
          ? 'google_error'
          : 'server_error',
      );
    }
  }

  async exchangeNativeCode(code: string): Promise<AuthSession> {
    const userId = this.auth.consumeExchangeCode(code);
    const user = await this.users.getById(userId);
    const session = this.auth.issueSession(user.id);
    return { user: this.users.toCurrentUser(user), accessToken: session.accessToken };
  }

  async signInWithIdToken(
    idToken: string,
    platform: AuthPlatform,
    res: Response,
  ): Promise<AuthSession> {
    const profile = await this.google.verifyIdToken(idToken);
    const user = await this.users.findOrCreateFromGoogle(profile);
    const session = this.auth.issueSession(user.id);
    if (platform === 'web') {
      setSessionCookie(res, this.config, session.accessToken, session.expiresAt);
      return { user: this.users.toCurrentUser(user) };
    }
    return { user: this.users.toCurrentUser(user), accessToken: session.accessToken };
  }

  /** Only the app's own scheme (and Expo Go links outside production) may receive the code. */
  private validateNativeRedirect(redirect: string | null): string {
    const fallback = `${this.config.nativeScheme}://auth/callback`;
    if (!redirect) return fallback;
    let parsed: URL;
    try {
      parsed = new URL(redirect);
    } catch {
      throw AppException.validation([{ path: 'redirect', message: 'Invalid redirect URL' }]);
    }
    const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
    const allowed = new Set([this.config.nativeScheme.toLowerCase()]);
    if (!this.config.isProduction) ['exp', 'exps'].forEach((s) => allowed.add(s));
    if (!allowed.has(scheme)) {
      throw AppException.validation([
        { path: 'redirect', message: 'Redirect scheme is not allowed' },
      ]);
    }
    return redirect;
  }

  private errorRedirect(platform: AuthPlatform, redirect: string | null, reason: string): string {
    if (platform === 'native') {
      return appendParams(redirect ?? `${this.config.nativeScheme}://auth/callback`, {
        error: reason,
      });
    }
    return appendParams(`${this.config.appWebUrl.replace(/\/$/, '')}/auth/callback`, {
      error: reason,
    });
  }
}

function appendParams(url: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${query}`;
}
