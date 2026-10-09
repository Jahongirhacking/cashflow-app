import { Injectable, Logger } from '@nestjs/common';
import {
  type Category,
  generateId,
  type ImportCategoryInfo,
  type ImportCommitInput,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
  type Transaction,
  type User,
} from '@finance/shared';
import { SheetsClient } from '../../google-sheets/sheets-client';
import { SettingsStore } from '../../spreadsheets/settings-store';
import { AppException } from '../../../common/errors/app.exception';
import { CategoriesRepository } from '../../categories/categories.repository';
import { SpreadsheetService } from '../../spreadsheets/spreadsheet.service';
import { TransactionsRepository } from '../transactions.repository';
import { parseTransactionsWorkbook } from './xlsx-parser';

const FIXED_CATEGORY = /kommunal|qarz|kredit|credit|loan|rent|ijara|obuna|subscri/i;
const SAVED_MAP_KEY = 'import.categoryMap';

/** Uzbek export categories → default app categories (used only when no exact or remembered mapping exists). */
const KEYWORD_MAP: { match: RegExp; target: string }[] = [
  { match: /oziq|ovqat|ro.?zg|food/i, target: 'Food' },
  { match: /transport|taksi|yo.?l/i, target: 'Transport' },
  { match: /kommunal|utilit/i, target: 'Utilities' },
  { match: /uy va|housing|ijara|rent/i, target: 'Housing' },
  { match: /shaxsiy|personal|shopping|xarid/i, target: 'Shopping' },
  { match: /oilaviy|family|oila/i, target: 'Family' },
  { match: /ish haqi|daromad|oylik|salary|maosh/i, target: 'Salary' },
  { match: /qarz|kredit|credit|loan/i, target: 'Credit' },
  { match: /xo.?jalik|household|ro.?zg.?or/i, target: 'Housing' },
  { match: /bank|moliya|finance/i, target: 'Other' },
  { match: /boshqa|other/i, target: 'Other' },
];

/** Two rows are the same transaction when date, time, name, amount and type all match. */
function fingerprint(t: {
  date: string;
  time?: string | null;
  name: string;
  amount: number;
  type: string;
}): string {
  return `${t.date}|${t.time ?? ''}|${t.name.trim().toLowerCase()}|${Math.round(t.amount)}|${t.type}`;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly spreadsheets: SpreadsheetService,
    private readonly transactions: TransactionsRepository,
    private readonly categories: CategoriesRepository,
    private readonly sheets: SheetsClient,
  ) {}

  async preview(user: User, fileName: string, buffer: Buffer): Promise<ImportPreview> {
    const ctx = await this.spreadsheets.getContext(user);
    let parsed;
    try {
      parsed = await parseTransactionsWorkbook(buffer);
    } catch (error) {
      this.logger.warn(`Import parse failed: ${(error as Error).message}`);
      throw AppException.validation([
        { path: 'file', message: 'This file could not be read as an Excel workbook (.xlsx).' },
      ]);
    }
    const settings = new SettingsStore(this.sheets, ctx.spreadsheetId);
    const [table, categories, savedMap] = await Promise.all([
      this.transactions.getTable(ctx, user.id),
      this.categories.list(ctx, user.id),
      this.loadSavedMap(settings),
    ]);
    const existing = new Set(table.items.map(fingerprint));
    const seen = new Set<string>();
    const known = new Set(categories.map((c) => c.name.toLowerCase()));
    const newCategories = new Set<string>();
    let income = 0;
    let expenses = 0;
    let minDate: string | null = null;
    let maxDate: string | null = null;
    const rows: ImportRow[] = parsed.rows.map((row) => {
      const key = fingerprint(row);
      const duplicate = existing.has(key) || seen.has(key);
      seen.add(key);
      if (!duplicate) {
        if (row.type === 'INCOME') income += row.amount;
        else expenses += row.amount;
      }
      if (!minDate || row.date < minDate) minDate = row.date;
      if (!maxDate || row.date > maxDate) maxDate = row.date;
      if (!known.has(row.category.toLowerCase())) newCategories.add(row.category);
      return { ...row, duplicate };
    });
    return {
      fileName,
      sheetName: parsed.sheetName,
      rows,
      skippedRows: parsed.skippedRows,
      duplicates: rows.filter((r) => r.duplicate).length,
      income,
      expenses,
      minDate,
      maxDate,
      newCategories: [...newCategories].sort(),
      categories: this.describeCategories(rows, categories, savedMap),
      warnings: parsed.warnings,
    };
  }

  async commit(user: User, input: ImportCommitInput): Promise<ImportResult> {
    const ctx = await this.spreadsheets.getContext(user);
    const table = await this.transactions.getTable(ctx, user.id);
    const existing = new Set(table.items.map(fingerprint));
    const seen = new Set<string>();
    const now = new Date().toISOString();
    const toInsert: Transaction[] = [];
    let skipped = 0;
    const mapCategory = (name: string) =>
      input.categoryMap[name] ?? input.categoryMap[name.trim()] ?? name;
    for (const raw of input.rows) {
      const row = { ...raw, category: mapCategory(raw.category) };
      const key = fingerprint(row);
      if (input.skipDuplicates && (existing.has(key) || seen.has(key))) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      toInsert.push({
        id: generateId('txn'),
        name: row.name,
        amount: row.amount,
        type: row.type,
        paymentMethod: row.paymentMethod,
        date: row.date,
        time: row.time ?? null,
        category: row.category,
        note: row.note ?? null,
        isRecurring: false,
        recurringRuleId: null,
        createdAt: now,
        updatedAt: now,
        userId: user.id,
      });
    }

    let categoriesCreated: string[] = [];
    if (input.createCategories && toInsert.length > 0) {
      categoriesCreated = await this.ensureCategories(ctx, user.id, toInsert);
    }
    if (toInsert.length > 0) await this.transactions.insertMany(ctx, toInsert);
    if (Object.keys(input.categoryMap).length > 0) {
      await this.rememberMap(ctx.spreadsheetId, input.categoryMap);
    }
    this.logger.log(
      `Imported ${toInsert.length} transactions (${skipped} skipped) into ${ctx.spreadsheetId}`,
    );
    return { imported: toInsert.length, skipped, categoriesCreated };
  }

  private describeCategories(
    rows: ImportRow[],
    categories: Category[],
    savedMap: Record<string, string>,
  ): ImportCategoryInfo[] {
    const byExact = new Map(categories.map((c) => [c.name.toLowerCase(), c.name]));
    const stats = new Map<
      string,
      { name: string; count: number; income: number; expense: number }
    >();
    for (const r of rows) {
      const key = r.category.toLowerCase();
      const s = stats.get(key) ?? { name: r.category, count: 0, income: 0, expense: 0 };
      s.count += 1;
      if (r.type === 'INCOME') s.income += 1;
      else s.expense += 1;
      stats.set(key, s);
    }
    const savedLower = new Map(Object.entries(savedMap).map(([k, v]) => [k.toLowerCase(), v]));
    return [...stats.values()]
      .map((s): ImportCategoryInfo => {
        const type = s.income > s.expense ? 'INCOME' : 'EXPENSE';
        const exact = byExact.get(s.name.toLowerCase());
        if (exact) return { name: s.name, count: s.count, type, suggested: exact, source: 'exact' };
        const saved = savedLower.get(s.name.toLowerCase());
        if (saved && byExact.has(saved.toLowerCase()))
          return {
            name: s.name,
            count: s.count,
            type,
            suggested: byExact.get(saved.toLowerCase()) ?? saved,
            source: 'saved',
          };
        const keyword = KEYWORD_MAP.find((k) => k.match.test(s.name))?.target;
        if (
          keyword &&
          byExact.has(keyword.toLowerCase()) &&
          categories.some((c) => c.name === keyword && c.type === type)
        ) {
          return { name: s.name, count: s.count, type, suggested: keyword, source: 'keyword' };
        }
        return { name: s.name, count: s.count, type, suggested: null, source: null };
      })
      .sort((a, b) => b.count - a.count);
  }

  private async loadSavedMap(settings: SettingsStore): Promise<Record<string, string>> {
    try {
      const raw = (await settings.readAll()).get(SAVED_MAP_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'string'),
      ) as Record<string, string>;
    } catch {
      return {};
    }
  }

  /** Merge this import's mapping into the Settings sheet so the next upload is pre-mapped. */
  private async rememberMap(spreadsheetId: string, map: Record<string, string>): Promise<void> {
    const settings = new SettingsStore(this.sheets, spreadsheetId);
    const merged = { ...(await this.loadSavedMap(settings)), ...map };
    await settings.write({ [SAVED_MAP_KEY]: JSON.stringify(merged) });
  }

  /** Create categories used by the import that do not exist yet; type follows the majority sign. */
  private async ensureCategories(
    ctx: Awaited<ReturnType<SpreadsheetService['getContext']>>,
    userId: string,
    rows: Transaction[],
  ): Promise<string[]> {
    const existing = new Set(
      (await this.categories.list(ctx, userId)).map((c) => c.name.toLowerCase()),
    );
    const stats = new Map<string, { name: string; income: number; expense: number }>();
    for (const t of rows) {
      const key = t.category.toLowerCase();
      if (existing.has(key)) continue;
      const s = stats.get(key) ?? { name: t.category, income: 0, expense: 0 };
      if (t.type === 'INCOME') s.income += 1;
      else s.expense += 1;
      stats.set(key, s);
    }
    const created: string[] = [];
    const now = new Date().toISOString();
    for (const s of stats.values()) {
      const type = s.income > s.expense ? 'INCOME' : 'EXPENSE';
      const category: Category = {
        id: generateId('cat'),
        name: s.name,
        type,
        kind: type === 'EXPENSE' ? (FIXED_CATEGORY.test(s.name) ? 'FIXED' : 'VARIABLE') : null,
        icon: null,
        color: null,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        userId,
      };
      await this.categories.insert(ctx, category);
      created.push(s.name);
    }
    return created.sort();
  }
}
