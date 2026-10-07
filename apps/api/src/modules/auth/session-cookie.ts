import type { CookieOptions, Response } from 'express';
import type { AppConfigService } from '../../config/app-config.service';

export const SESSION_COOKIE = 'finance_session';
export const OAUTH_NONCE_COOKIE = 'finance_oauth';

function baseOptions(config: AppConfigService): CookieOptions {
  const { sameSite, secure, domain } = config.cookie;
  return { httpOnly: true, sameSite, secure, path: '/', ...(domain ? { domain } : {}) };
}

export function setSessionCookie(
  res: Response,
  config: AppConfigService,
  token: string,
  expiresAt: number,
): void {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(config), expires: new Date(expiresAt) });
}

export function clearSessionCookie(res: Response, config: AppConfigService): void {
  res.clearCookie(SESSION_COOKIE, baseOptions(config));
}

export function setOAuthNonceCookie(res: Response, config: AppConfigService, nonce: string): void {
  res.cookie(OAUTH_NONCE_COOKIE, nonce, { ...baseOptions(config), maxAge: 10 * 60_000 });
}

export function clearOAuthNonceCookie(res: Response, config: AppConfigService): void {
  res.clearCookie(OAUTH_NONCE_COOKIE, baseOptions(config));
}
