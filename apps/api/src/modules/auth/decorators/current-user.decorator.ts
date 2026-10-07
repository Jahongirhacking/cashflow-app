import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '@finance/shared';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: User;
}

/** The authenticated user, always derived from the session — never from the request body. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
