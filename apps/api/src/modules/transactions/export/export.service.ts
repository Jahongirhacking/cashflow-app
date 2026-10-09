import { Injectable } from '@nestjs/common';
import type { ExportCategoryMap, ExportCategorySettings, User } from '@finance/shared';
import { CategoriesRepository } from '../../categories/categories.repository';
import { SheetsClient } from '../../google-sheets/sheets-client';
import { SettingsStore } from '../../spreadsheets/settings-store';
import { SpreadsheetService } from '../../spreadsheets/spreadsheet.service';
import { TransactionsRepository } from '../transactions.repository';
import { buildTransactionsWorkbook } from './xlsx-export';

const EXPORT_MAP_KEY = 'export.categoryMap';
const IMPORT_MAP_KEY = 'import.categoryMap';

function parseMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([k, v]) => k.trim() && typeof v === 'string' && v.trim(),
      ),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Export of transactions to .xlsx with a many-to-one category renaming (app → Excel name). */
@Injectable()
export class ExportService {
  constructor(
    private readonly spreadsheets: SpreadsheetService,
    private readonly transactions: TransactionsRepository,
    private readonly categories: CategoriesRepository,
    private readonly sheets: SheetsClient,
  ) {}

  async settings(user: User): Promise<ExportCategorySettings> {
    const ctx = await this.spreadsheets.getContext(user);
    const store = new SettingsStore(this.sheets, ctx.spreadsheetId);
    const [all, categories, table] = await Promise.all([
      store.readAll(),
      this.categories.list(ctx, user.id),
      this.transactions.getTable(ctx, user.id),
    ]);
    const saved = parseMap(all.get(EXPORT_MAP_KEY));
    const importMap = parseMap(all.get(IMPORT_MAP_KEY));
    // The remembered import mapping (file → app) inverted gives a sensible default (app → file).
    const defaults: Record<string, string> = {};
    for (const [fileName, appName] of Object.entries(importMap)) {
      if (!defaults[appName]) defaults[appName] = fileName;
    }
    const map = all.has(EXPORT_MAP_KEY) ? saved : defaults;

    const list = categories.map((c) => ({ name: c.name, type: c.type }));
    const known = new Set(list.map((c) => c.name.toLowerCase()));
    for (const t of table.items) {
      if (!known.has(t.category.toLowerCase())) {
        known.add(t.category.toLowerCase());
        list.push({ name: t.category, type: t.type });
      }
    }
    const fileNames = [...new Set([...Object.keys(importMap), ...Object.values(map)])].sort(
      (a, b) => a.localeCompare(b),
    );
    return { map, categories: list, fileNames };
  }

  async saveMap(user: User, map: ExportCategoryMap): Promise<ExportCategorySettings> {
    const ctx = await this.spreadsheets.getContext(user);
    const store = new SettingsStore(this.sheets, ctx.spreadsheetId);
    // Identity entries are noise: an unmapped category already keeps its app name.
    const cleaned = Object.fromEntries(
      Object.entries(map).filter(
        ([app, file]) => app.trim().toLowerCase() !== file.trim().toLowerCase(),
      ),
    );
    await store.write({ [EXPORT_MAP_KEY]: JSON.stringify(cleaned) });
    return this.settings(user);
  }

  async workbook(user: User): Promise<Buffer> {
    const ctx = await this.spreadsheets.getContext(user);
    const store = new SettingsStore(this.sheets, ctx.spreadsheetId);
    const [all, table] = await Promise.all([
      store.readAll(),
      this.transactions.getTable(ctx, user.id),
    ]);
    const map = parseMap(all.get(EXPORT_MAP_KEY));
    const byLower = new Map(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
    const rows = table.items.map((t) => ({
      ...t,
      category: byLower.get(t.category.toLowerCase()) ?? t.category,
    }));
    return buildTransactionsWorkbook(rows, new Date());
  }
}
