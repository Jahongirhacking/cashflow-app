import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type JwtSignOptions, JwtService } from '@nestjs/jwt';
import type { AuthPlatform } from '@finance/shared';
import { z } from 'zod';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';

const SESSION_AUDIENCE = 'finance:session';
const STATE_AUDIENCE = 'finance:oauth-state';
const STATE_TTL = '10m';
const EXCHANGE_CODE_TTL_MS = 2 * 60_000;

const sessionPayloadSchema = z.object({ sub: z.string().min(1), exp: z.number() });

export const oauthStateSchema = z.object({
  platform: z.enum(['web', 'native']),
  redirect: z.string().nullable(),
  nonce: z.string().min(8),
});
export type OAuthState = z.infer<typeof oauthStateSchema>;

export interface IssuedSession {
  accessToken: string;
  /** Absolute expiry in ms since epoch. */
  expiresAt: number;
}

/**
 * Session tokens, CSRF state for the OAuth round-trip and the one-time codes
 * handed to native apps so the JWT never travels through a deep link.
 */
@Injectable()
export class AuthService {
  private readonly exchangeCodes = new Map<string, { userId: string; expiresAt: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  issueSession(userId: string): IssuedSession {
    const accessToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtExpiresIn as JwtSignOptions['expiresIn'],
        audience: SESSION_AUDIENCE,
      },
    );
    const decoded = sessionPayloadSchema.parse(this.jwt.decode(accessToken));
    return { accessToken, expiresAt: decoded.exp * 1000 };
  }

  /** Returns the user id or throws UNAUTHORIZED. */
  verifySession(token: string): string {
    try {
      const payload = this.jwt.verify<object>(token, {
        secret: this.config.jwtSecret,
        audience: SESSION_AUDIENCE,
      });
      return sessionPayloadSchema.parse(payload).sub;
    } catch {
      throw AppException.unauthorized('Your session has expired. Please sign in again.');
    }
  }

  createState(platform: AuthPlatform, redirect: string | null): { state: string; nonce: string } {
    const nonce = randomBytes(16).toString('hex');
    const state = this.jwt.sign({ platform, redirect, nonce } satisfies OAuthState, {
      secret: this.config.jwtSecret,
      expiresIn: STATE_TTL,
      audience: STATE_AUDIENCE,
    });
    return { state, nonce };
  }

  verifyState(state: string): OAuthState {
    try {
      const payload = this.jwt.verify<object>(state, {
        secret: this.config.jwtSecret,
        audience: STATE_AUDIENCE,
      });
      return oauthStateSchema.parse(payload);
    } catch {
      throw AppException.unauthorized(
        'The sign-in request is invalid or has expired. Please try again.',
      );
    }
  }

  issueExchangeCode(userId: string): string {
    this.sweepExpiredCodes();
    const code = randomBytes(32).toString('base64url');
    this.exchangeCodes.set(code, { userId, expiresAt: Date.now() + EXCHANGE_CODE_TTL_MS });
    return code;
  }

  /** Single use: the code is deleted whether or not it was still valid. */
  consumeExchangeCode(code: string): string {
    const entry = this.exchangeCodes.get(code);
    this.exchangeCodes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) {
      throw AppException.unauthorized(
        'The sign-in code is invalid or has expired. Please sign in again.',
      );
    }
    return entry.userId;
  }

  private sweepExpiredCodes(): void {
    const now = Date.now();
    for (const [code, entry] of this.exchangeCodes) {
      if (entry.expiresAt < now) this.exchangeCodes.delete(code);
    }
  }
}
