import { a1 } from '../google-sheets/a1';
import type { CellValue, SheetsClient } from '../google-sheets/sheets-client';

export const SETTINGS_SHEET = 'Settings';

export const SETTING_KEYS = {
  schemaVersion: 'schemaVersion',
  transactionsSheet: 'transactions.sheet',
  transactionsFormat: 'transactions.format',
  transactionsAppColumn: 'transactions.appColumn',
  categoriesSeeded: 'categories.seeded',
} as const;

export const SCHEMA_VERSION = '1';

/** Key/value settings persisted in the user's own spreadsheet (Settings sheet). */
export class SettingsStore {
  constructor(
    private readonly client: SheetsClient,
    private readonly spreadsheetId: string,
  ) {}

  async readAll(): Promise<Map<string, string>> {
    const rows = await this.client.getValues(this.spreadsheetId, a1(SETTINGS_SHEET, 1, 2, 2));
    const map = new Map<string, string>();
    for (const row of rows) {
      const key = String(row[0] ?? '').trim();
      if (key) map.set(key, String(row[1] ?? ''));
    }
    return map;
  }

  /** Upsert several keys with a single write when possible. */
  async write(values: Record<string, string>): Promise<void> {
    const rows = await this.client.getValues(this.spreadsheetId, a1(SETTINGS_SHEET, 1, 2, 2));
    const updates: { range: string; values: CellValue[][] }[] = [];
    const appendRows: CellValue[][] = [];
    for (const [key, value] of Object.entries(values)) {
      const index = rows.findIndex((row) => String(row[0] ?? '').trim() === key);
      if (index >= 0) {
        updates.push({ range: a1(SETTINGS_SHEET, 2, index + 2, 2, index + 2), values: [[value]] });
      } else {
        appendRows.push([key, value]);
      }
    }
    if (appendRows.length > 0) {
      const start = rows.length + 2;
      updates.push({
        range: a1(SETTINGS_SHEET, 1, start, 2, start + appendRows.length - 1),
        values: appendRows,
      });
    }
    await this.client.batchUpdateValues(this.spreadsheetId, updates);
  }
}
