import { Injectable } from '@nestjs/common';
import {
  type BulkTransactionAction,
  type BulkTransactionResult,
  compareIsoDates,
  type CreateTransactionInput,
  generateId,
  type Paginated,
  type PaymentMethod,
  type Transaction,
  type TransactionFacetCategory,
  type TransactionFacets,
  type TransactionQuery,
  type TransactionType,
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

  /** Distinct values used in the sheet, for filter UIs (legacy rows use categories that are not in the Categories sheet). */
  async facets(user: User): Promise<TransactionFacets> {
    const all = await this.listAll(user);
    const categories = new Map<
      string,
      { name: string; count: number; type: Record<TransactionType, number> }
    >();
    const paymentMethods = new Map<PaymentMethod, number>();
    let minDate: string | null = null;
    let maxDate: string | null = null;
    for (const t of all) {
      const key = t.category.toLowerCase();
      const entry = categories.get(key) ?? {
        name: t.category,
        count: 0,
        type: { INCOME: 0, EXPENSE: 0 },
      };
      entry.count += 1;
      entry.type[t.type] += 1;
      categories.set(key, entry);
      paymentMethods.set(t.paymentMethod, (paymentMethods.get(t.paymentMethod) ?? 0) + 1);
      if (!minDate || t.date < minDate) minDate = t.date;
      if (!maxDate || t.date > maxDate) maxDate = t.date;
    }
    return {
      total: all.length,
      minDate,
      maxDate,
      categories: [...categories.values()]
        .map((c): TransactionFacetCategory => ({
          name: c.name,
          count: c.count,
          type: c.type.EXPENSE >= c.type.INCOME ? 'EXPENSE' : 'INCOME',
        }))
        .sort((a, b) => b.count - a.count),
      paymentMethods: [...paymentMethods.entries()].map(([method, count]) => ({ method, count })),
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

  /** Apply one change to many transactions at once (multi-select on the Transactions screen). */
  async bulk(user: User, input: BulkTransactionAction): Promise<BulkTransactionResult> {
    const ctx = await this.spreadsheets.getContext(user);
    const ids = [...new Set(input.ids)];
    if (input.action === 'delete') {
      const affected = await this.repo.removeMany(ctx, user.id, ids);
      return { affected, missing: ids.length - affected };
    }
    const table = await this.repo.getTable(ctx, user.id);
    const byId = new Map(table.items.map((t) => [t.id, t]));
    const now = new Date().toISOString();
    const updated: Transaction[] = [];
    for (const id of ids) {
      const existing = byId.get(id);
      if (!existing) continue;
      if (input.action === 'setCategory') {
        if (existing.category === input.category) continue;
        updated.push({ ...existing, category: input.category, updatedAt: now });
      } else if (existing.type !== input.type) {
        updated.push({ ...existing, type: input.type, updatedAt: now });
      }
    }
    const affected = await this.repo.updateMany(ctx, updated);
    return { affected, missing: ids.filter((id) => !byId.has(id)).length };
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
