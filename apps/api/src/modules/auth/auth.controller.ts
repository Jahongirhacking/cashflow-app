import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthSession, CurrentUser as CurrentUserDto, User } from '@finance/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../users/users.service';
import { AuthFlowService } from './auth-flow.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { clearSessionCookie, OAUTH_NONCE_COOKIE } from './session-cookie';

const startSchema = z.object({
  platform: z.enum(['web', 'native']).default('web'),
  redirect: z.string().trim().min(1).max(500).optional(),
});

const callbackSchema = z.object({
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1),
  error: z.string().trim().optional(),
});

const exchangeSchema = z.object({ code: z.string().trim().min(16).max(200) });

const idTokenSchema = z.object({
  idToken: z.string().trim().min(16),
  platform: z.enum(['web', 'native']).default('native'),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly flow: AuthFlowService,
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  /** Step 1: send the browser to Google. Native apps pass their deep-link redirect. */
  @Public()
  @Get('google')
  start(
    @Query(new ZodValidationPipe(startSchema)) query: z.infer<typeof startSchema>,
    @Res() res: Response,
  ): void {
    const url = this.flow.start(query.platform, query.redirect ?? null, res);
    res.redirect(302, url);
  }

  /** Step 2: Google sends the user back here with a code; we create the session. */
  @Public()
  @Get('google/callback')
  async callback(
    @Query(new ZodValidationPipe(callbackSchema)) query: z.infer<typeof callbackSchema>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const nonceCookie = (req as { cookies?: Record<string, unknown> }).cookies?.[
      OAUTH_NONCE_COOKIE
    ];
    const url = await this.flow.complete(
      query,
      typeof nonceCookie === 'string' ? nonceCookie : null,
      res,
    );
    res.redirect(302, url);
  }

  /** Native apps trade the one-time code from the deep link for a bearer token. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('exchange')
  @HttpCode(200)
  exchange(
    @Body(new ZodValidationPipe(exchangeSchema)) body: z.infer<typeof exchangeSchema>,
  ): Promise<AuthSession> {
    return this.flow.exchangeNativeCode(body.code);
  }

  /** Alternative entry: a Google ID token obtained client-side (Google Sign-In SDK / One Tap). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(200)
  signInWithIdToken(
    @Body(new ZodValidationPipe(idTokenSchema)) body: z.infer<typeof idTokenSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.flow.signInWithIdToken(body.idToken, body.platform, res);
  }

  @Get('me')
  me(@CurrentUser() user: User): CurrentUserDto {
    return this.users.toCurrentUser(user);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, this.config);
  }
}
