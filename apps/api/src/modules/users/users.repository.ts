import type { User } from '@finance/shared';

export type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type UserPatch = Partial<Omit<User, 'id' | 'googleId' | 'createdAt' | 'updatedAt'>>;

/**
 * Persistence boundary for application users. Implementations: JSON file (development)
 * and the app-owned registry spreadsheet (production).
 */
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByGoogleId(googleId: string): Promise<User | null>;
  abstract create(user: NewUser): Promise<User>;
  abstract update(id: string, patch: UserPatch): Promise<User | null>;
}
