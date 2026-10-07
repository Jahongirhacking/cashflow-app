import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';

/** Application user. Google OAuth answers "who is this?"; nothing secret is stored here. */
export const userSchema = z.object({
  id: idSchema,
  googleId: z.string().min(1),
  email: z.email(),
  name: z.string().trim().max(200),
  picture: z.url().nullable(),
  spreadsheetId: z.string().nullable(),
  spreadsheetName: z.string().nullable(),
  spreadsheetVerifiedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

/** Shape returned by GET /auth/me. */
export type CurrentUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'picture'
  | 'spreadsheetId'
  | 'spreadsheetName'
  | 'spreadsheetVerifiedAt'
> & {
  hasSpreadsheet: boolean;
};

export const AUTH_PLATFORMS = ['web', 'native'] as const;
export type AuthPlatform = (typeof AUTH_PLATFORMS)[number];

export interface AuthSession {
  user: CurrentUser;
  /** Only present for native clients; web clients receive an HTTP-only cookie instead. */
  accessToken?: string;
}
