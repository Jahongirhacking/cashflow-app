import { Injectable } from '@nestjs/common';
import {
  compareIsoDates,
  type CreateTransactionInput,
  generateId,
  type Paginated,
  type Transaction,
  type TransactionQuery,
  type UpdateTransactionInput,
  type User,
} from '@finance/shared';
import { AppException } from '../../common/errors/app.exception';
import { SpreadsheetService } from '../spreadsheets/spreadsheet.service';
import { TransactionsRepository } from './transactions.repository';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly spreadsheets: SpreadsheetService,
    private readonly repo: TransactionsRepository,
  ) {}

  async listAll(user: User): Promise<Transaction[]> {
    const ctx = await this.spreadsheets.getContext(user);
    return (await this.repo.getTable(ctx, user.id)).items;
  }

  async list(user: User, query: TransactionQuery): Promise<Paginated<Transaction>> {
    const all = await this.listAll(user);
    const search = query.search?.toLowerCase();
    const filtered = all.filter((t) => {
      if (query.type && t.type !== query.type) return false;
      if (query.paymentMethod && t.paymentMethod !== query.paymentMethod) return false;
      if (query.category && t.category.toLowerCase() !== query.category.toLowerCase()) return false;
      if (query.from && compareIsoDates(t.date, query.from) < 0) return false;
      if (query.to && compareIsoDates(t.date, query.to) > 0) return false;
      if (search && !`${t.name} ${t.category} ${t.note ?? ''}`.toLowerCase().includes(search))
        return false;
      return true;
    });
    filtered.sort((a, b) => {
      const byDate = compareIsoDates(a.date, b.date) || (a.time ?? '').localeCompare(b.time ?? '');
      const byCreated = a.createdAt.localeCompare(b.createdAt);
      const order = byDate || byCreated;
      return query.sort === 'oldest' ? order : -order;
    });
    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);
    return {
      items,
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: start + items.length < filtered.length,
    };
  }

  async getById(user: User, id: string): Promise<Transaction> {
    const ctx = await this.spreadsheets.getContext(user);
    const transaction = await this.repo.findById(ctx, user.id, id);
    if (!transaction) throw AppException.notFound('Transaction');
    return transaction;
  }

  async create(user: User, input: CreateTransactionInput): Promise<Transaction> {
    const ctx = await this.spreadsheets.getContext(user);
    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: input.clientId ? `txn_${input.clientId}` : generateId('txn'),
      name: input.name,
      amount: input.amount,
      type: input.type,
      paymentMethod: input.paymentMethod,
      date: input.date,
      time: input.time ?? null,
      category: input.category,
      note: input.note ?? null,
      isRecurring: Boolean(input.recurringRuleId) || Boolean(input.isRecurring),
      recurringRuleId: input.recurringRuleId ?? null,
      createdAt: now,
      updatedAt: now,
      userId: user.id,
    };
    return this.repo.insert(ctx, transaction);
  }

  async update(user: User, id: string, patch: UpdateTransactionInput): Promise<Transaction> {
    const existing = await this.getById(user, id);
    const ctx = await this.spreadsheets.getContext(user);
    const updated: Transaction = {
      ...existing,
      ...stripUndefined(patch),
      time: patch.time === undefined ? existing.time : patch.time,
      note: patch.note === undefined ? existing.note : patch.note,
      recurringRuleId:
        patch.recurringRuleId === undefined ? existing.recurringRuleId : patch.recurringRuleId,
      updatedAt: new Date().toISOString(),
    };
    updated.isRecurring =
      updated.recurringRuleId !== null || Boolean(patch.isRecurring ?? existing.isRecurring);
    return this.repo.update(ctx, updated);
  }

  async remove(user: User, id: string): Promise<void> {
    const ctx = await this.spreadsheets.getContext(user);
    await this.repo.remove(ctx, user.id, id);
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
