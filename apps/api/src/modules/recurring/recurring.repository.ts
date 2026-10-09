import { Injectable } from '@nestjs/common';
import type { RecurringRule } from '@finance/shared';
import { TtlCache } from '../../common/cache/ttl-cache';
import { AppException } from '../../common/errors/app.exception';
import { a1 } from '../google-sheets/a1';
import { type CellValue, SheetsClient } from '../google-sheets/sheets-client';
import { RECURRING_HEADERS } from '../spreadsheets/sheet-layout';
import type { SpreadsheetContext } from '../spreadsheets/spreadsheet-context';
import { parseCellDate } from '../transactions/cell-parsers';

const SHEET = 'Recurring';
const WIDTH = RECURRING_HEADERS.length;
const TTL_MS = 5 * 60_000;

interface Table {
  items: RecurringRule[];
  rowById: Map<string, number>;
  lastRow: number;
}

/** Recurring rules sheet: ID | Name | Amount | Type | Category | Payment | Frequency | Day | Month | Start | End | Active | Note | Created | Updated */
@Injectable()
export class RecurringRepository {
  private readonly cache = new TtlCache();

  constructor(private readonly client: SheetsClient) {}

  async list(ctx: SpreadsheetContext, userId: string): Promise<RecurringRule[]> {
    return (await this.table(ctx, userId)).items;
  }

  async insert(ctx: SpreadsheetContext, rule: RecurringRule): Promise<RecurringRule> {
    const table = await this.table(ctx, rule.userId);
    const row = table.lastRow + 1;
    await this.client.updateValues(ctx.spreadsheetId, a1(SHEET, 1, row, WIDTH, row), [
      toCells(rule),
    ]);
    this.cache.invalidate(this.key(ctx));
    return rule;
  }

  async update(ctx: SpreadsheetContext, rule: RecurringRule): Promise<RecurringRule> {
    const table = await this.table(ctx, rule.userId);
    const row = table.rowById.get(rule.id);
    if (!row) throw AppException.notFound('Recurring rule');
    await this.client.updateValues(ctx.spreadsheetId, a1(SHEET, 1, row, WIDTH, row), [
      toCells(rule),
    ]);
    this.cache.invalidate(this.key(ctx));
    return rule;
  }

  async remove(ctx: SpreadsheetContext, userId: string, id: string): Promise<void> {
    const table = await this.table(ctx, userId);
    const row = table.rowById.get(id);
    if (!row) throw AppException.notFound('Recurring rule');
    const sheet = ctx.sheets.get(SHEET);
    if (!sheet) throw new AppException('GOOGLE_API_ERROR', 'Recurring sheet is missing');
    await this.client.deleteRows(ctx.spreadsheetId, sheet.sheetId, row, row);
    this.cache.invalidate(this.key(ctx));
  }

  private key(ctx: SpreadsheetContext): string {
    return `rec:${ctx.spreadsheetId}`;
  }

  private table(ctx: SpreadsheetContext, userId: string): Promise<Table> {
    return this.cache.getOrLoad(this.key(ctx), TTL_MS, async () => {
      const rows = await this.client.getValues(ctx.spreadsheetId, a1(SHEET, 1, 2, WIDTH));
      const items: RecurringRule[] = [];
      const rowById = new Map<string, number>();
      let lastRow = 1;
      rows.forEach((cells, i) => {
        const row = i + 2;
        if (cells.some((c) => c !== '' && c !== null)) lastRow = row;
        const rule = fromCells(cells, userId);
        if (!rule || rowById.has(rule.id)) return;
        items.push(rule);
        rowById.set(rule.id, row);
      });
      return { items, rowById, lastRow };
    });
  }
}

function text(cell: CellValue | undefined): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

function num(cell: CellValue | undefined): number | null {
  const value = Number(text(cell));
  return text(cell) === '' || !Number.isFinite(value) ? null : value;
}

function fromCells(cells: CellValue[], userId: string): RecurringRule | null {
  const id = text(cells[0]);
  const name = text(cells[1]);
  const amount = num(cells[2]);
  const type = text(cells[3]).toUpperCase();
  const frequency = text(cells[6]).toUpperCase();
  const startDate = parseCellDate(cells[9]);
  if (
    !id ||
    !name ||
    amount === null ||
    amount <= 0 ||
    (type !== 'INCOME' && type !== 'EXPENSE') ||
    !startDate
  )
    return null;
  if (!['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency)) return null;
  const payment = text(cells[5]).toUpperCase();
  const createdAt = text(cells[13]) || new Date(0).toISOString();
  return {
    id,
    name,
    amount,
    type,
    category: text(cells[4]) || 'Other',
    paymentMethod: ['CASH', 'CARD', 'BANK', 'OTHER'].includes(payment)
      ? (payment as RecurringRule['paymentMethod'])
      : 'CARD',
    frequency: frequency as RecurringRule['frequency'],
    dayOfPeriod: num(cells[7]),
    monthOfYear: num(cells[8]),
    startDate,
    endDate: parseCellDate(cells[10]),
    nextDate: null,
    isActive: !/^(false|0|no)$/i.test(text(cells[11]) || 'true'),
    note: text(cells[12]) || null,
    createdAt,
    updatedAt: text(cells[14]) || createdAt,
    userId,
  };
}

function toCells(r: RecurringRule): CellValue[] {
  return [
    r.id,
    r.name,
    r.amount,
    r.type,
    r.category,
    r.paymentMethod,
    r.frequency,
    r.dayOfPeriod ?? '',
    r.monthOfYear ?? '',
    r.startDate,
    r.endDate ?? '',
    r.isActive ? 'TRUE' : 'FALSE',
    r.note ?? '',
    r.createdAt,
    r.updatedAt,
  ];
}
