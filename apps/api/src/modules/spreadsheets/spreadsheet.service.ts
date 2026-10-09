import { Injectable, Logger } from '@nestjs/common';
import {
  buildSpreadsheetUrl,
  CATEGORY_SEED_VERSION,
  DEFAULT_CATEGORIES,
  extractSpreadsheetId,
  generateId,
  REQUIRED_SHEETS,
  type SpreadsheetInfo,
  type SpreadsheetStatus,
  type User,
} from '@finance/shared';
import { TtlCache } from '../../common/cache/ttl-cache';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';
import { a1, columnLetter } from '../google-sheets/a1';
import {
  type CellValue,
  SheetsClient,
  type SheetProperties,
  type SpreadsheetMeta,
} from '../google-sheets/sheets-client';
import { UsersService } from '../users/users.service';
import { SettingsStore, SETTING_KEYS, SCHEMA_VERSION } from './settings-store';
import {
  APP_BLOCK_HEADERS,
  APP_BLOCK_WIDTH,
  buildColumns,
  CATEGORIES_HEADERS,
  chooseAppBlockColumn,
  findAppBlockColumn,
  isLegacyTransactionsHeader,
  LEGACY_DATA_WIDTH,
  RECURRING_HEADERS,
  scoreLegacyHeader,
  SETTINGS_HEADERS,
  TRANSACTIONS_HEADERS,
  type TransactionsLayout,
} from './sheet-layout';
import type { SpreadsheetContext } from './spreadsheet-context';

const CONTEXT_TTL_MS = 5 * 60_000;
const HEADER_SCAN_COLUMNS = 60;

/**
 * Owns the user ↔ spreadsheet relationship: connection, access verification,
 * one-time initialisation of the required sheets and the per-spreadsheet context cache.
 */
@Injectable()
export class SpreadsheetService {
  private readonly logger = new Logger(SpreadsheetService.name);
  private readonly cache = new TtlCache();

  constructor(
    private readonly client: SheetsClient,
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  async connect(user: User, spreadsheetUrl: string): Promise<SpreadsheetStatus> {
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new AppException('SPREADSHEET_INVALID_URL', 'This is not a valid Google Sheets URL.');
    }
    if (!this.config.googleServiceAccount && this.config.sheetsBackend !== 'memory') {
      throw AppException.configuration('Spreadsheet access is not configured on the server.');
    }
    const meta = await this.client.getSpreadsheet(spreadsheetId);
    await this.initialize(meta);
    this.cache.invalidate(`ctx:${spreadsheetId}`);
    const verifiedAt = new Date().toISOString();
    const updated = await this.users.setSpreadsheet(user.id, {
      spreadsheetId,
      spreadsheetName: meta.title,
      verifiedAt,
    });
    return this.toStatus(updated, 'OK');
  }

  status(user: User): SpreadsheetStatus {
    return this.toStatus(user, user.spreadsheetId ? 'OK' : 'NOT_CONNECTED');
  }

  /** Re-check that the service account can still read the spreadsheet. */
  async verify(user: User): Promise<SpreadsheetStatus> {
    if (!user.spreadsheetId) return this.toStatus(user, 'NOT_CONNECTED');
    try {
      const meta = await this.client.getSpreadsheet(user.spreadsheetId);
      const verifiedAt = new Date().toISOString();
      const updated = await this.users.setSpreadsheet(user.id, {
        spreadsheetId: user.spreadsheetId,
        spreadsheetName: meta.title,
        verifiedAt,
      });
      return this.toStatus(updated, 'OK');
    } catch (error) {
      if (error instanceof AppException && error.code === 'SPREADSHEET_ACCESS_DENIED') {
        return this.toStatus(user, 'ACCESS_DENIED');
      }
      if (error instanceof AppException && error.code === 'SPREADSHEET_NOT_FOUND') {
        return this.toStatus(user, 'NOT_FOUND');
      }
      throw error;
    }
  }

  async info(user: User): Promise<SpreadsheetInfo> {
    const ctx = await this.getContext(user);
    return {
      spreadsheetId: ctx.spreadsheetId,
      title: ctx.title,
      url: buildSpreadsheetUrl(ctx.spreadsheetId),
      sheets: [...ctx.sheets.values()].map((s) => ({
        sheetId: s.sheetId,
        title: s.title,
        rowCount: s.rowCount,
        columnCount: s.columnCount,
      })),
      transactionsSheet: ctx.transactions.sheetTitle,
      requiredSheets: REQUIRED_SHEETS.map((title) => ({
        title,
        exists: title === 'Transactions' ? true : ctx.sheets.has(title),
      })),
    };
  }

  /** Cached per spreadsheet; repositories call this on every request. */
  getContext(user: User): Promise<SpreadsheetContext> {
    const spreadsheetId = user.spreadsheetId;
    if (!spreadsheetId) {
      throw new AppException(
        'SPREADSHEET_NOT_CONNECTED',
        'Connect your Google Spreadsheet to continue.',
      );
    }
    return this.cache.getOrLoad(`ctx:${spreadsheetId}`, CONTEXT_TTL_MS, () =>
      this.loadContext(spreadsheetId),
    );
  }

  invalidateContext(spreadsheetId: string): void {
    this.cache.invalidate(`ctx:${spreadsheetId}`);
  }

  private async loadContext(spreadsheetId: string): Promise<SpreadsheetContext> {
    const meta = await this.client.getSpreadsheet(spreadsheetId);
    const sheets = new Map(meta.sheets.map((s) => [s.title, s]));
    const settings = new SettingsStore(this.client, spreadsheetId);
    let layout: TransactionsLayout | null = null;
    let seedVersion: string | undefined;
    if (sheets.has('Settings')) {
      const values = await settings.readAll();
      seedVersion = values.get(SETTING_KEYS.categoriesSeedVersion);
      const title = values.get(SETTING_KEYS.transactionsSheet);
      const appColumn = Number(values.get(SETTING_KEYS.transactionsAppColumn));
      const format = values.get(SETTING_KEYS.transactionsFormat);
      const sheet = title ? sheets.get(title) : undefined;
      if (
        sheet &&
        Number.isInteger(appColumn) &&
        appColumn > LEGACY_DATA_WIDTH &&
        (format === 'legacy' || format === 'app')
      ) {
        layout = {
          sheetTitle: sheet.title,
          sheetId: sheet.sheetId,
          headerRow: 1,
          format,
          columns: buildColumns(appColumn),
        };
      }
    }
    if (!layout || seedVersion !== CATEGORY_SEED_VERSION) {
      // Settings missing/stale (user edited the sheet) or new defaults shipped: the initialisation is idempotent.
      this.logger.log(
        `Spreadsheet ${spreadsheetId}: ${layout ? 'applying new default categories' : 'no valid layout settings, re-initialising'}`,
      );
      await this.initialize(meta);
      return this.loadContextAfterInit(spreadsheetId);
    }
    return { spreadsheetId, title: meta.title, sheets, transactions: layout };
  }

  private async loadContextAfterInit(spreadsheetId: string): Promise<SpreadsheetContext> {
    const meta = await this.client.getSpreadsheet(spreadsheetId);
    const sheets = new Map(meta.sheets.map((s) => [s.title, s]));
    const values = await new SettingsStore(this.client, spreadsheetId).readAll();
    const title = values.get(SETTING_KEYS.transactionsSheet) ?? 'Transactions';
    const sheet = sheets.get(title);
    const appColumn = Number(values.get(SETTING_KEYS.transactionsAppColumn));
    const format = values.get(SETTING_KEYS.transactionsFormat) === 'legacy' ? 'legacy' : 'app';
    if (!sheet || !Number.isInteger(appColumn)) {
      throw new AppException('GOOGLE_API_ERROR', 'The spreadsheet could not be initialised.');
    }
    return {
      spreadsheetId,
      title: meta.title,
      sheets,
      transactions: {
        sheetTitle: sheet.title,
        sheetId: sheet.sheetId,
        headerRow: 1,
        format,
        columns: buildColumns(appColumn),
      },
    };
  }

  /**
   * Idempotent set-up of the user's spreadsheet. Never deletes or rewrites existing rows:
   * creates missing sheets, reuses a legacy transaction sheet, and adds the app's metadata
   * columns in the first fully empty column block.
   */
  private async initialize(meta: SpreadsheetMeta): Promise<void> {
    const spreadsheetId = meta.spreadsheetId;
    const sheets = new Map(meta.sheets.map((s) => [s.title, s]));

    const ensureSheet = async (title: string, headers: string[]): Promise<SheetProperties> => {
      const existing = sheets.get(title);
      if (existing) return existing;
      const created = await this.client.addSheet(
        spreadsheetId,
        title,
        Math.max(headers.length, 10),
      );
      await this.client.updateValues(spreadsheetId, a1(title, 1, 1, headers.length, 1), [headers]);
      sheets.set(title, created);
      return created;
    };

    await ensureSheet('Settings', SETTINGS_HEADERS);
    const settings = new SettingsStore(this.client, spreadsheetId);
    const current = await settings.readAll();

    // 1. Transactions sheet: reuse the legacy one when present.
    let layoutSheet: SheetProperties | undefined;
    let format: 'legacy' | 'app' = 'app';
    const configuredTitle = current.get(SETTING_KEYS.transactionsSheet);
    if (configuredTitle && sheets.has(configuredTitle)) {
      layoutSheet = sheets.get(configuredTitle);
      format = current.get(SETTING_KEYS.transactionsFormat) === 'legacy' ? 'legacy' : 'app';
    } else {
      const legacy = await this.detectLegacySheet(spreadsheetId, [...sheets.values()]);
      if (legacy) {
        layoutSheet = legacy;
        format = 'legacy';
      }
    }
    if (!layoutSheet) {
      layoutSheet = await ensureSheet('Transactions', [
        ...TRANSACTIONS_HEADERS,
        ...APP_BLOCK_HEADERS,
      ]);
      format = 'app';
    }

    // 2. App metadata block (Finance ID, note, …) in the first empty column run.
    const title = layoutSheet.title;
    const scanRange = a1(title, 1, 1, HEADER_SCAN_COLUMNS);
    const rows = await this.client.getValues(spreadsheetId, scanRange);
    const header = rows[0] ?? [];
    let appColumn = findAppBlockColumn(header);
    if (!appColumn) {
      const fromColumn = LEGACY_DATA_WIDTH + 1;
      appColumn = chooseAppBlockColumn(
        rows.map((r) => r.slice(fromColumn - 1)),
        fromColumn,
        HEADER_SCAN_COLUMNS,
      );
      await this.client.updateValues(
        spreadsheetId,
        a1(title, appColumn, 1, appColumn + APP_BLOCK_WIDTH - 1, 1),
        [[...APP_BLOCK_HEADERS]],
      );
      this.logger.log(
        `Added Finance columns at ${columnLetter(appColumn)} in sheet "${title}" of ${spreadsheetId}`,
      );
    }
    if (format === 'app' && rows.length === 0) {
      await this.client.updateValues(
        spreadsheetId,
        a1(title, 1, 1, TRANSACTIONS_HEADERS.length, 1),
        [[...TRANSACTIONS_HEADERS]],
      );
    }

    // 3. Other app sheets.
    await ensureSheet('Recurring', RECURRING_HEADERS);
    const categories = await ensureSheet('Categories', CATEGORIES_HEADERS);
    if (current.get(SETTING_KEYS.categoriesSeedVersion) !== CATEGORY_SEED_VERSION) {
      await this.seedMissingCategories(spreadsheetId, categories.title);
    }

    await settings.write({
      [SETTING_KEYS.schemaVersion]: SCHEMA_VERSION,
      [SETTING_KEYS.transactionsSheet]: title,
      [SETTING_KEYS.transactionsFormat]: format,
      [SETTING_KEYS.transactionsAppColumn]: String(appColumn),
      [SETTING_KEYS.categoriesSeedVersion]: CATEGORY_SEED_VERSION,
    });
  }

  private async detectLegacySheet(
    spreadsheetId: string,
    sheets: SheetProperties[],
  ): Promise<SheetProperties | null> {
    const candidates = sheets.filter(
      (s) => !REQUIRED_SHEETS.includes(s.title as (typeof REQUIRED_SHEETS)[number]),
    );
    if (candidates.length === 0) return null;
    const headers = await this.client.batchGetValues(
      spreadsheetId,
      candidates.map((s) => a1(s.title, 1, 1, LEGACY_DATA_WIDTH, 1)),
    );
    let best: { sheet: SheetProperties; score: number } | null = null;
    candidates.forEach((sheet, i) => {
      const header = headers[i]?.[0] ?? [];
      if (!isLegacyTransactionsHeader(header)) return;
      const score = scoreLegacyHeader(header);
      if (!best || score > best.score) best = { sheet, score };
    });
    return best ? (best as { sheet: SheetProperties }).sheet : null;
  }

  /** Additive: appends default categories that are not yet in the sheet (matched by type + name). */
  private async seedMissingCategories(spreadsheetId: string, sheetTitle: string): Promise<void> {
    const rows = await this.client.getValues(spreadsheetId, a1(sheetTitle, 1, 2, 3));
    const existing = new Set<string>();
    let lastRow = 1;
    rows.forEach((cells, i) => {
      if (cells.some((c) => c !== '' && c !== null)) lastRow = i + 2;
      const name = String(cells[1] ?? '')
        .trim()
        .toLowerCase();
      const type = String(cells[2] ?? '')
        .trim()
        .toUpperCase();
      if (name) existing.add(`${type}:${name}`);
    });
    const now = new Date().toISOString();
    const missing: CellValue[][] = DEFAULT_CATEGORIES.filter(
      (c) => !existing.has(`${c.type}:${c.name.toLowerCase()}`),
    ).map((c) => [generateId('cat'), c.name, c.type, c.kind ?? '', c.icon, '', 'TRUE', now, now]);
    if (missing.length === 0) return;
    await this.client.updateValues(
      spreadsheetId,
      a1(sheetTitle, 1, lastRow + 1, CATEGORIES_HEADERS.length, lastRow + missing.length),
      missing,
    );
    this.logger.log(`Added ${missing.length} default categories to ${spreadsheetId}`);
  }

  private toStatus(user: User, accessState: SpreadsheetStatus['accessState']): SpreadsheetStatus {
    return {
      connected: Boolean(user.spreadsheetId) && accessState === 'OK',
      accessState,
      spreadsheetId: user.spreadsheetId,
      spreadsheetName: user.spreadsheetName,
      spreadsheetUrl: user.spreadsheetId ? buildSpreadsheetUrl(user.spreadsheetId) : null,
      lastVerifiedAt: user.spreadsheetVerifiedAt,
      serviceAccountEmail:
        this.config.serviceAccountEmail ??
        (this.config.sheetsBackend === 'memory' ? 'demo-bot@finance.local' : null),
    };
  }
}
