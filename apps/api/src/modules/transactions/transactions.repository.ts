import { Injectable } from '@nestjs/common';
import { generateId, type Transaction } from '@finance/shared';
import { TtlCache } from '../../common/cache/ttl-cache';
import { AppException } from '../../common/errors/app.exception';
import { a1 } from '../google-sheets/a1';
import { type CellValue, SheetsClient } from '../google-sheets/sheets-client';
import { APP_BLOCK_WIDTH, LEGACY_DATA_WIDTH } from '../spreadsheets/sheet-layout';
import type { SpreadsheetContext } from '../spreadsheets/spreadsheet-context';
import { TransactionRowAdapter } from './transaction-row.adapter';

const TABLE_TTL_MS = 60_000;
/** Extra empty rows added whenever the sheet has to grow, so bulk imports grow it once, not per chunk. */
const GROW_SLACK_ROWS = 500;

export interface TransactionTable {
  items: Transaction[];
  rowById: Map<string, number>;
  lastRow: number;
}

/**
 * Reads and writes transactions in the user's spreadsheet.
 * The whole table is read in one request and cached briefly; every write invalidates it.
 */
@Injectable()
export class TransactionsRepository {
  private readonly cache = new TtlCache();

  constructor(private readonly client: SheetsClient) {}

  getTable(ctx: SpreadsheetContext, userId: string): Promise<TransactionTable> {
    return this.cache.getOrLoad(this.key(ctx), TABLE_TTL_MS, () => this.loadTable(ctx, userId));
  }

  async findById(ctx: SpreadsheetContext, userId: string, id: string): Promise<Transaction | null> {
    const table = await this.getTable(ctx, userId);
    return table.items.find((t) => t.id === id) ?? null;
  }

  async insert(ctx: SpreadsheetContext, transaction: Transaction): Promise<Transaction> {
    const table = await this.getTable(ctx, transaction.userId);
    const existing = table.items.find((t) => t.id === transaction.id);
    if (existing) return existing; // idempotent retry
    const lastRow = await this.findLastRow(ctx, table.lastRow);
    await this.ensureRows(ctx, lastRow + 1);
    await this.writeRow(ctx, lastRow + 1, transaction);
    this.cache.invalidate(this.key(ctx));
    return transaction;
  }

  /** Append many rows with two rectangular writes (data block + app block) instead of one call per row. */
  async insertMany(ctx: SpreadsheetContext, transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    const table = await this.getTable(ctx, transactions[0]?.userId ?? '');
    const lastRow = await this.findLastRow(ctx, table.lastRow);
    const { sheetTitle, columns } = ctx.transactions;
    const adapter = new TransactionRowAdapter(ctx.transactions);
    const first = lastRow + 1;
    const last = lastRow + transactions.length;
    await this.ensureRows(ctx, last);
    await this.client.batchUpdateValues(ctx.spreadsheetId, [
      {
        range: a1(sheetTitle, 1, first, LEGACY_DATA_WIDTH, last),
        values: transactions.map((t) => adapter.dataCells(t)),
      },
      {
        range: a1(sheetTitle, columns.id, first, columns.id + APP_BLOCK_WIDTH - 1, last),
        values: transactions.map((t) => adapter.appCells(t)),
      },
    ]);
    this.cache.invalidate(this.key(ctx));
  }

  async update(ctx: SpreadsheetContext, transaction: Transaction): Promise<Transaction> {
    const table = await this.getTable(ctx, transaction.userId);
    const row = table.rowById.get(transaction.id);
    if (!row) throw AppException.notFound('Transaction');
    await this.writeRow(ctx, row, transaction);
    this.cache.invalidate(this.key(ctx));
    return transaction;
  }

  /** Rewrite many existing rows in one batched request. Unknown ids are ignored. */
  async updateMany(ctx: SpreadsheetContext, transactions: Transaction[]): Promise<number> {
    if (transactions.length === 0) return 0;
    const table = await this.getTable(ctx, transactions[0]?.userId ?? '');
    const { sheetTitle, columns } = ctx.transactions;
    const adapter = new TransactionRowAdapter(ctx.transactions);
    const updates: { range: string; values: CellValue[][] }[] = [];
    let affected = 0;
    for (const transaction of transactions) {
      const row = table.rowById.get(transaction.id);
      if (!row) continue;
      affected += 1;
      updates.push(
        {
          range: a1(sheetTitle, 1, row, LEGACY_DATA_WIDTH, row),
          values: [adapter.dataCells(transaction)],
        },
        {
          range: a1(sheetTitle, columns.id, row, columns.id + APP_BLOCK_WIDTH - 1, row),
          values: [adapter.appCells(transaction)],
        },
      );
    }
    if (updates.length > 0) await this.client.batchUpdateValues(ctx.spreadsheetId, updates);
    this.cache.invalidate(this.key(ctx));
    return affected;
  }

  /** Delete many rows: one clear request on legacy sheets, contiguous row runs on app sheets. */
  async removeMany(ctx: SpreadsheetContext, userId: string, ids: string[]): Promise<number> {
    const table = await this.getTable(ctx, userId);
    const rows = [
      ...new Set(
        ids.map((id) => table.rowById.get(id)).filter((r): r is number => r !== undefined),
      ),
    ].sort((a, b) => a - b);
    if (rows.length === 0) return 0;
    const { sheetTitle, sheetId, format, columns } = ctx.transactions;
    if (format === 'app') {
      // Delete from the bottom up so earlier row numbers stay valid; merge consecutive rows into one call.
      const runs: [number, number][] = [];
      for (const row of rows) {
        const last = runs[runs.length - 1];
        if (last && last[1] === row - 1) last[1] = row;
        else runs.push([row, row]);
      }
      for (const [start, end] of runs.reverse()) {
        await this.client.deleteRows(ctx.spreadsheetId, sheetId, start, end);
      }
    } else {
      await this.client.clearValues(
        ctx.spreadsheetId,
        rows.flatMap((row) => [
          a1(sheetTitle, 1, row, LEGACY_DATA_WIDTH, row),
          a1(sheetTitle, columns.id, row, columns.id + APP_BLOCK_WIDTH - 1, row),
        ]),
      );
    }
    this.cache.invalidate(this.key(ctx));
    return rows.length;
  }

  async remove(ctx: SpreadsheetContext, userId: string, id: string): Promise<void> {
    const table = await this.getTable(ctx, userId);
    const row = table.rowById.get(id);
    if (!row) throw AppException.notFound('Transaction');
    const { sheetTitle, sheetId, format, columns } = ctx.transactions;
    if (format === 'app') {
      await this.client.deleteRows(ctx.spreadsheetId, sheetId, row, row);
    } else {
      // Legacy sheets may hold the user's own summary cells beside the data: clear, never shift rows.
      await this.client.clearValues(ctx.spreadsheetId, [
        a1(sheetTitle, 1, row, LEGACY_DATA_WIDTH, row),
        a1(sheetTitle, columns.id, row, columns.id + APP_BLOCK_WIDTH - 1, row),
      ]);
    }
    this.cache.invalidate(this.key(ctx));
  }

  invalidate(ctx: SpreadsheetContext): void {
    this.cache.invalidate(this.key(ctx));
  }

  private key(ctx: SpreadsheetContext): string {
    return `tx:${ctx.spreadsheetId}`;
  }

  private async loadTable(ctx: SpreadsheetContext, userId: string): Promise<TransactionTable> {
    const { sheetTitle, headerRow, columns } = ctx.transactions;
    const lastCol = columns.updatedAt;
    const rows = await this.client.getValues(
      ctx.spreadsheetId,
      a1(sheetTitle, 1, headerRow + 1, lastCol),
    );
    const adapter = new TransactionRowAdapter(ctx.transactions);
    const items: Transaction[] = [];
    const rowById = new Map<string, number>();
    const backfill: { range: string; values: CellValue[][] }[] = [];
    let lastRow = headerRow;

    rows.forEach((cells, i) => {
      const rowNumber = headerRow + 1 + i;
      if (cells.some((cell) => cell !== '' && cell !== null)) lastRow = rowNumber;
      const parsed = adapter.parse(cells, rowNumber, userId, () => generateId('txn'));
      if (!parsed) return;
      if (rowById.has(parsed.transaction.id)) return; // duplicate id: keep the first occurrence
      items.push(parsed.transaction);
      rowById.set(parsed.transaction.id, rowNumber);
      if (parsed.idMissing) {
        backfill.push({
          range: a1(sheetTitle, columns.id, rowNumber, columns.id, rowNumber),
          values: [[parsed.transaction.id]],
        });
      }
    });

    if (backfill.length > 0) {
      // Give legacy rows stable identifiers once, in a single batched write.
      await this.client.batchUpdateValues(ctx.spreadsheetId, backfill);
    }
    return { items, rowById, lastRow };
  }

  /**
   * Google never extends a sheet on write: a range past the last grid row fails with
   * "exceeds grid limits". Grow the grid first whenever an append would reach beyond it.
   */
  private async ensureRows(ctx: SpreadsheetContext, lastRowNeeded: number): Promise<void> {
    const { sheetTitle, sheetId } = ctx.transactions;
    const cached = ctx.sheets.get(sheetTitle);
    if (cached && lastRowNeeded <= cached.rowCount) return;
    // The cached count may be stale (the user may have resized the sheet): confirm it live.
    const meta = await this.client.getSpreadsheet(ctx.spreadsheetId);
    const live =
      meta.sheets.find((s) => s.sheetId === sheetId) ??
      meta.sheets.find((s) => s.title === sheetTitle);
    let rowCount = live?.rowCount ?? cached?.rowCount ?? 0;
    if (lastRowNeeded > rowCount) {
      const extra = lastRowNeeded - rowCount + GROW_SLACK_ROWS;
      await this.client.appendRows(ctx.spreadsheetId, sheetId, extra);
      rowCount += extra;
    }
    if (live) ctx.sheets.set(sheetTitle, { ...live, rowCount });
    else if (cached) cached.rowCount = rowCount;
  }

  /** Re-check the sheet's tail right before appending so concurrent writers never overwrite each other. */
  private async findLastRow(ctx: SpreadsheetContext, cachedLastRow: number): Promise<number> {
    const { sheetTitle, columns, headerRow } = ctx.transactions;
    const from = Math.max(headerRow + 1, cachedLastRow);
    const tail = await this.client.getValues(
      ctx.spreadsheetId,
      a1(sheetTitle, 1, from, columns.updatedAt),
    );
    let last = cachedLastRow;
    tail.forEach((cells, i) => {
      if (cells.some((cell) => cell !== '' && cell !== null)) last = from + i;
    });
    return Math.max(last, headerRow);
  }

  private async writeRow(
    ctx: SpreadsheetContext,
    row: number,
    transaction: Transaction,
  ): Promise<void> {
    const { sheetTitle, columns } = ctx.transactions;
    const adapter = new TransactionRowAdapter(ctx.transactions);
    await this.client.batchUpdateValues(ctx.spreadsheetId, [
      {
        range: a1(sheetTitle, 1, row, LEGACY_DATA_WIDTH, row),
        values: [adapter.dataCells(transaction)],
      },
      {
        range: a1(sheetTitle, columns.id, row, columns.id + APP_BLOCK_WIDTH - 1, row),
        values: [adapter.appCells(transaction)],
      },
    ]);
  }
}
