import { Injectable } from '@nestjs/common';
import {
  type Category,
  type CreateCategoryInput,
  generateId,
  type UpdateCategoryInput,
  type User,
} from '@finance/shared';
import { AppException } from '../../common/errors/app.exception';
import { SpreadsheetService } from '../spreadsheets/spreadsheet.service';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly spreadsheets: SpreadsheetService,
    private readonly repo: CategoriesRepository,
  ) {}

  async list(user: User): Promise<Category[]> {
    const ctx = await this.spreadsheets.getContext(user);
    const items = await this.repo.list(ctx, user.id);
    return [...items].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }

  async create(user: User, input: CreateCategoryInput): Promise<Category> {
    const ctx = await this.spreadsheets.getContext(user);
    const existing = await this.repo.list(ctx, user.id);
    if (
      existing.some(
        (c) => c.type === input.type && c.name.toLowerCase() === input.name.toLowerCase(),
      )
    ) {
      throw new AppException(
        'CONFLICT',
        `A ${input.type.toLowerCase()} category named "${input.name}" already exists.`,
      );
    }
    const now = new Date().toISOString();
    return this.repo.insert(ctx, {
      id: generateId('cat'),
      name: input.name,
      type: input.type,
      kind: input.kind ?? (input.type === 'EXPENSE' ? 'VARIABLE' : null),
      icon: input.icon ?? null,
      color: input.color ?? null,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      userId: user.id,
    });
  }

  async update(user: User, id: string, patch: UpdateCategoryInput): Promise<Category> {
    const ctx = await this.spreadsheets.getContext(user);
    const existing = (await this.repo.list(ctx, user.id)).find((c) => c.id === id);
    if (!existing) throw AppException.notFound('Category');
    const updated: Category = {
      ...existing,
      name: patch.name ?? existing.name,
      type: patch.type ?? existing.type,
      kind: patch.kind === undefined ? existing.kind : patch.kind,
      icon: patch.icon === undefined ? existing.icon : patch.icon,
      color: patch.color === undefined ? existing.color : patch.color,
      updatedAt: new Date().toISOString(),
    };
    return this.repo.update(ctx, updated);
  }

  async remove(user: User, id: string): Promise<void> {
    const ctx = await this.spreadsheets.getContext(user);
    await this.repo.remove(ctx, user.id, id);
  }
}
