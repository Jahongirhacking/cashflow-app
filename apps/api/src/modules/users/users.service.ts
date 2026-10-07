import { Injectable } from '@nestjs/common';
import type { CurrentUser, User } from '@finance/shared';
import { AppException } from '../../common/errors/app.exception';
import { UsersRepository } from './users.repository';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<User> {
    const existing = await this.users.findByGoogleId(profile.googleId);
    if (existing) {
      const changed =
        existing.email !== profile.email ||
        existing.name !== profile.name ||
        existing.picture !== profile.picture;
      if (!changed) return existing;
      return (
        (await this.users.update(existing.id, {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        })) ?? existing
      );
    }
    return this.users.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      spreadsheetId: null,
      spreadsheetName: null,
      spreadsheetVerifiedAt: null,
    });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw AppException.notFound('User');
    return user;
  }

  async setSpreadsheet(
    userId: string,
    connection: { spreadsheetId: string; spreadsheetName: string; verifiedAt: string },
  ): Promise<User> {
    const user = await this.users.update(userId, {
      spreadsheetId: connection.spreadsheetId,
      spreadsheetName: connection.spreadsheetName,
      spreadsheetVerifiedAt: connection.verifiedAt,
    });
    if (!user) throw AppException.notFound('User');
    return user;
  }

  async touchSpreadsheetVerification(userId: string, verifiedAt: string): Promise<void> {
    await this.users.update(userId, { spreadsheetVerifiedAt: verifiedAt });
  }

  toCurrentUser(user: User): CurrentUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      spreadsheetId: user.spreadsheetId,
      spreadsheetName: user.spreadsheetName,
      spreadsheetVerifiedAt: user.spreadsheetVerifiedAt,
      hasSpreadsheet: Boolean(user.spreadsheetId),
    };
  }
}
