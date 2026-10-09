import { Injectable } from '@nestjs/common';
import type { Category } from '@finance/shared';
import { TtlCache } from '../../common/cache/ttl-cache';
import { AppException } from '../../common/errors/app.exception';
import { a1 } from '../google-sheets/a1';
import { type CellValue, SheetsClient } from '../google-sheets/sheets-client';
import { CATEGORIES_HEADERS } from '../spreadsheets/sheet-layout';
import type { SpreadsheetContext } from '../spreadsheets/spreadsheet-context';

const SHEET = 'Categories';
const TTL_MS = 5 * 60_000;
const WIDTH = CATEGORIES_HEADERS.length;

interface CategoryTable {
  items: Category[];
  rowById: Map<string, number>;
  lastRow: number;
}

/** Categories live in the app-created "Categories" sheet (ID | Name | Type | Kind | Icon | Color | Default | …). */
@Injectable()
export class CategoriesRepository {
  private readonly cache = new TtlCache();

  constructor(private readonly client: SheetsClient) {}

  async list(ctx: SpreadsheetContext, userId: string): Promise<Category[]> {
    return (await this.table(ctx, userId)).items;
  }

  async insert(ctx: SpreadsheetContext, category: Category): Promise<Category> {
    const table = await this.table(ctx, category.userId);
    const row = table.lastRow + 1;
    await this.client.updateValues(ctx.spreadsheetId, a1(SHEET, 1, row, WIDTH, row), [
      toCells(category),
    ]);
    this.cache.invalidate(this.key(ctx));
    return category;
  }

  async update(ctx: SpreadsheetContext, category: Category): Promise<Category> {
    const table = await this.table(ctx, category.userId);
    const row = table.rowById.get(category.id);
    if (!row) throw AppException.notFound('Category');
    await this.client.updateValues(ctx.spreadsheetId, a1(SHEET, 1, row, WIDTH, row), [
      toCells(category),
    ]);
    this.cache.invalidate(this.key(ctx));
    return category;
  }

  async remove(ctx: SpreadsheetContext, userId: string, id: string): Promise<void> {
    const table = await this.table(ctx, userId);
    const row = table.rowById.get(id);
    if (!row) throw AppException.notFound('Category');
    const sheet = ctx.sheets.get(SHEET);
    if (!sheet) throw new AppException('GOOGLE_API_ERROR', 'Categories sheet is missing');
    await this.client.deleteRows(ctx.spreadsheetId, sheet.sheetId, row, row);
    this.cache.invalidate(this.key(ctx));
  }

  private key(ctx: SpreadsheetContext): string {
    return `cat:${ctx.spreadsheetId}`;
  }

  private table(ctx: SpreadsheetContext, userId: string): Promise<CategoryTable> {
    return this.cache.getOrLoad(this.key(ctx), TTL_MS, async () => {
      const rows = await this.client.getValues(ctx.spreadsheetId, a1(SHEET, 1, 2, WIDTH));
      const items: Category[] = [];
      const rowById = new Map<string, number>();
      let lastRow = 1;
      rows.forEach((cells, i) => {
        const row = i + 2;
        if (cells.some((c) => c !== '' && c !== null)) lastRow = row;
        const category = fromCells(cells, userId);
        if (!category || rowById.has(category.id)) return;
        items.push(category);
        rowById.set(category.id, row);
      });
      return { items, rowById, lastRow };
    });
  }
}

function text(cell: CellValue | undefined): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

function fromCells(cells: CellValue[], userId: string): Category | null {
  const id = text(cells[0]);
  const name = text(cells[1]);
  const type = text(cells[2]).toUpperCase();
  if (!id || !name || (type !== 'INCOME' && type !== 'EXPENSE')) return null;
  const kind = text(cells[3]).toUpperCase();
  const isDefault = /^(true|1|yes)$/i.test(text(cells[6]));
  const createdAt = text(cells[7]) || new Date(0).toISOString();
  return {
    id,
    name,
    type,
    kind: kind === 'FIXED' || kind === 'VARIABLE' ? kind : null,
    icon: text(cells[4]) || null,
    color: text(cells[5]) || null,
    isDefault,
    createdAt,
    updatedAt: text(cells[8]) || createdAt,
    userId,
  };
}

function toCells(c: Category): CellValue[] {
  return [
    c.id,
    c.name,
    c.type,
    c.kind ?? '',
    c.icon ?? '',
    c.color ?? '',
    c.isDefault ? 'TRUE' : 'FALSE',
    c.createdAt,
    c.updatedAt,
  ];
}
