import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SESSION_COOKIE } from '../session-cookie';

/** Accepts `Authorization: Bearer <jwt>` (native) or the HTTP-only session cookie (web). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);
    if (!token) throw AppException.unauthorized();

    const userId = this.auth.verifySession(token);
    const user = await this.users.findById(userId);
    if (!user)
      throw AppException.unauthorized('This account no longer exists. Please sign in again.');

    (request as AuthenticatedRequest).user = user;
    return true;
  }
}

export function extractToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const cookies = (request as { cookies?: Record<string, unknown> }).cookies;
  const cookie = cookies?.[SESSION_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : null;
}
