import { Injectable } from '@nestjs/common';
import {
  type CreateRecurringRuleInput,
  generateId,
  type RecurringRule,
  type RecurringSchedule,
  todayIsoDate,
  type UpdateRecurringRuleInput,
  type User,
} from '@finance/shared';
import { AppException } from '../../common/errors/app.exception';
import { SheetsClient } from '../google-sheets/sheets-client';
import { SettingsStore } from '../spreadsheets/settings-store';
import { SpreadsheetService } from '../spreadsheets/spreadsheet.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurringRepository } from './recurring.repository';
import { buildSchedule, nextOccurrence, occurrenceKey } from './schedule';

const doneKey = (month: string) => `reminders.done.${month}`;

@Injectable()
export class RecurringService {
  constructor(
    private readonly spreadsheets: SpreadsheetService,
    private readonly repo: RecurringRepository,
    private readonly transactions: TransactionsService,
    private readonly sheets: SheetsClient,
  ) {}

  async list(user: User): Promise<RecurringRule[]> {
    const ctx = await this.spreadsheets.getContext(user);
    const today = todayIsoDate();
    return (await this.repo.list(ctx, user.id))
      .map((rule) => ({ ...rule, nextDate: nextOccurrence(rule, today) }))
      .sort(
        (a, b) =>
          (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999') ||
          a.name.localeCompare(b.name),
      );
  }

  async schedule(user: User, month: string): Promise<RecurringSchedule> {
    const ctx = await this.spreadsheets.getContext(user);
    const settings = new SettingsStore(this.sheets, ctx.spreadsheetId);
    const [rules, transactions, done] = await Promise.all([
      this.repo.list(ctx, user.id),
      this.transactions.listAll(user),
      this.readDone(settings, month),
    ]);
    const today = todayIsoDate();
    const occurrences = buildSchedule(rules, transactions, month, today, done);
    const totals = { expenseDue: 0, expensePaid: 0, incomeExpected: 0, incomeReceived: 0 };
    for (const o of occurrences) {
      if (o.type === 'EXPENSE') {
        if (o.status === 'paid') totals.expensePaid += o.amount;
        else totals.expenseDue += o.amount;
      } else if (o.status === 'received') totals.incomeReceived += o.amount;
      else totals.incomeExpected += o.amount;
    }
    return { month, today, occurrences, totals };
  }

  async create(user: User, input: CreateRecurringRuleInput): Promise<RecurringRule> {
    const ctx = await this.spreadsheets.getContext(user);
    const now = new Date().toISOString();
    const rule: RecurringRule = {
      id: generateId('rec'),
      name: input.name,
      amount: input.amount,
      type: input.type,
      category: input.category,
      paymentMethod: input.paymentMethod,
      frequency: input.frequency,
      dayOfPeriod:
        input.dayOfPeriod ??
        (input.frequency === 'MONTHLY' || input.frequency === 'YEARLY'
          ? Number(input.startDate.slice(8, 10))
          : null),
      monthOfYear:
        input.monthOfYear ??
        (input.frequency === 'YEARLY' ? Number(input.startDate.slice(5, 7)) : null),
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      nextDate: null,
      isActive: input.isActive,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      userId: user.id,
    };
    validateRule(rule);
    const created = await this.repo.insert(ctx, rule);
    return { ...created, nextDate: nextOccurrence(created, todayIsoDate()) };
  }

  async update(user: User, id: string, patch: UpdateRecurringRuleInput): Promise<RecurringRule> {
    const ctx = await this.spreadsheets.getContext(user);
    const existing = (await this.repo.list(ctx, user.id)).find((r) => r.id === id);
    if (!existing) throw AppException.notFound('Recurring rule');
    const updated: RecurringRule = {
      ...existing,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      dayOfPeriod: patch.dayOfPeriod === undefined ? existing.dayOfPeriod : patch.dayOfPeriod,
      monthOfYear: patch.monthOfYear === undefined ? existing.monthOfYear : patch.monthOfYear,
      endDate: patch.endDate === undefined ? existing.endDate : patch.endDate,
      note: patch.note === undefined ? existing.note : patch.note,
      updatedAt: new Date().toISOString(),
    };
    validateRule(updated);
    const saved = await this.repo.update(ctx, updated);
    return { ...saved, nextDate: nextOccurrence(saved, todayIsoDate()) };
  }

  async remove(user: User, id: string): Promise<void> {
    const ctx = await this.spreadsheets.getContext(user);
    await this.repo.remove(ctx, user.id, id);
  }

  /**
   * Tick / untick a reminder for one occurrence. Stored per month in the Settings sheet
   * (`reminders.done.YYYY-MM`); transactions are never created or removed.
   */
  async markDone(
    user: User,
    ruleId: string,
    dueDate: string,
    done: boolean,
  ): Promise<RecurringSchedule> {
    const ctx = await this.spreadsheets.getContext(user);
    const rule = (await this.repo.list(ctx, user.id)).find((r) => r.id === ruleId);
    if (!rule) throw AppException.notFound('Recurring rule');
    const month = dueDate.slice(0, 7);
    const settings = new SettingsStore(this.sheets, ctx.spreadsheetId);
    const current = await this.readDone(settings, month);
    const key = occurrenceKey(ruleId, dueDate);
    if (done) current.add(key);
    else current.delete(key);
    await settings.write({ [doneKey(month)]: JSON.stringify([...current].sort()) });
    return this.schedule(user, month);
  }

  private async readDone(settings: SettingsStore, month: string): Promise<Set<string>> {
    const raw = (await settings.readAll()).get(doneKey(month));
    if (!raw) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(
        Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [],
      );
    } catch {
      return new Set();
    }
  }
}

function validateRule(rule: RecurringRule): void {
  if (rule.frequency === 'WEEKLY' && rule.dayOfPeriod !== null && rule.dayOfPeriod > 6) {
    throw AppException.validation([
      { path: 'dayOfPeriod', message: 'Weekday must be between 0 (Sunday) and 6 (Saturday)' },
    ]);
  }
  if (
    (rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') &&
    (rule.dayOfPeriod === null || rule.dayOfPeriod < 1)
  ) {
    throw AppException.validation([
      { path: 'dayOfPeriod', message: 'Day of month must be between 1 and 31' },
    ]);
  }
  if (rule.endDate && rule.endDate < rule.startDate) {
    throw AppException.validation([
      { path: 'endDate', message: 'End date must be after the start date' },
    ]);
  }
}
