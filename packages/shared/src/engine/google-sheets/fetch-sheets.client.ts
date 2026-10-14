import { AppError } from '../errors/app-error';
import { type Logger, noopLogger } from '../logger';
import {
  type CellValue,
  SheetsClient,
  type SheetProperties,
  type SpreadsheetMeta,
  type ValueUpdate,
} from './sheets-client';
import { describeGoogleError, isRetryableGoogleError, mapGoogleError } from './sheets-errors';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const MAX_ATTEMPTS = 3;

/** The subset of the Fetch API the client relies on (kept minimal so the package needs no DOM lib). */
export interface FetchLike {
  (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
}

export interface FetchSheetsClientOptions {
  /** Returns a valid OAuth access token with the `spreadsheets` scope; `force` asks for a refreshed one. */
  getAccessToken: (options?: { force?: boolean }) => Promise<string>;
  fetch?: FetchLike;
  logger?: Logger;
  /** Sleep used between retries (injectable for tests). */
  sleep?: (ms: number) => Promise<void>;
}

interface RawSheet {
  properties?: {
    sheetId?: number;
    title?: string;
    index?: number;
    gridProperties?: { rowCount?: number; columnCount?: number };
  };
}

interface RawSpreadsheet {
  spreadsheetId?: string;
  properties?: { title?: string };
  sheets?: RawSheet[];
}

declare const globalThis: { fetch?: FetchLike };
declare function setTimeout(callback: () => void, ms: number): unknown;

/**
 * Google Sheets REST client authenticated with a *user's* OAuth token (web and mobile), so the app
 * can read and write the spreadsheet without any server or service account. Same behaviour as the
 * API's service-account client: unformatted reads, USER_ENTERED writes, retries on 429/5xx, errors
 * mapped to AppError codes. A 401 triggers one token refresh before failing.
 */
export class FetchSheetsClient extends SheetsClient {
  private readonly fetchImpl: FetchLike;
  private readonly logger: Logger;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: FetchSheetsClientOptions) {
    super();
    const impl = options.fetch ?? globalThis.fetch;
    if (!impl)
      throw new AppError('CONFIGURATION_ERROR', 'fetch is not available on this platform.');
    this.fetchImpl = impl;
    this.logger = options.logger ?? noopLogger;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMeta> {
    const data = await this.request<RawSpreadsheet>(
      'GET',
      `/${encodeURIComponent(spreadsheetId)}`,
      {
        fields:
          'spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))',
      },
    );
    return {
      spreadsheetId: data.spreadsheetId ?? spreadsheetId,
      title: data.properties?.title ?? 'Untitled spreadsheet',
      sheets: (data.sheets ?? []).map(toSheetProperties),
    };
  }

  async getValues(spreadsheetId: string, range: string): Promise<CellValue[][]> {
    const data = await this.request<{ values?: CellValue[][] }>(
      'GET',
      `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      {
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
        majorDimension: 'ROWS',
      },
    );
    return data.values ?? [];
  }

  async batchGetValues(spreadsheetId: string, ranges: string[]): Promise<CellValue[][][]> {
    if (ranges.length === 0) return [];
    const data = await this.request<{ valueRanges?: { values?: CellValue[][] }[] }>(
      'GET',
      `/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
      {
        ranges,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
        majorDimension: 'ROWS',
      },
    );
    return (data.valueRanges ?? []).map((vr) => vr.values ?? []);
  }

  async updateValues(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void> {
    await this.request(
      'PUT',
      `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { valueInputOption: 'USER_ENTERED' },
      { range, majorDimension: 'ROWS', values },
    );
  }

  async batchUpdateValues(spreadsheetId: string, updates: ValueUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    await this.request(
      'POST',
      `/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      undefined,
      {
        valueInputOption: 'USER_ENTERED',
        data: updates.map((u) => ({ range: u.range, majorDimension: 'ROWS', values: u.values })),
      },
    );
  }

  async clearValues(spreadsheetId: string, ranges: string[]): Promise<void> {
    if (ranges.length === 0) return;
    await this.request(
      'POST',
      `/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
      undefined,
      {
        ranges,
      },
    );
  }

  async addSheet(spreadsheetId: string, title: string, columnCount = 26): Promise<SheetProperties> {
    const data = await this.request<{ replies?: { addSheet?: RawSheet }[] }>(
      'POST',
      `/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      undefined,
      {
        requests: [
          { addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount } } } },
        ],
      },
    );
    const sheet = data.replies?.[0]?.addSheet;
    if (!sheet) throw new AppError('GOOGLE_API_ERROR', `Could not create sheet "${title}".`);
    return toSheetProperties(sheet);
  }

  async appendRows(spreadsheetId: string, sheetId: number, count: number): Promise<void> {
    if (count <= 0) return;
    await this.request('POST', `/${encodeURIComponent(spreadsheetId)}:batchUpdate`, undefined, {
      requests: [{ appendDimension: { sheetId, dimension: 'ROWS', length: count } }],
    });
  }

  async deleteRows(
    spreadsheetId: string,
    sheetId: number,
    startRow: number,
    endRow: number,
  ): Promise<void> {
    await this.request('POST', `/${encodeURIComponent(spreadsheetId)}:batchUpdate`, undefined, {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: startRow - 1, endIndex: endRow },
          },
        },
      ],
    });
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    params?: Record<string, string | string[]>,
    body?: unknown,
  ): Promise<T> {
    const query = params
      ? Object.entries(params)
          .flatMap(([key, value]) =>
            (Array.isArray(value) ? value : [value]).map(
              (v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`,
            ),
          )
          .join('&')
      : '';
    const url = `${BASE_URL}${path}${query ? `?${query}` : ''}`;
    let forceRefresh = false;
    for (let attempt = 1; ; attempt += 1) {
      const token = await this.options.getAccessToken({ force: forceRefresh });
      forceRefresh = false;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      let response: { ok: boolean; status: number; text(): Promise<string> };
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
          await this.sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw new AppError('GOOGLE_API_ERROR', 'Could not reach Google Sheets.', { cause: error });
      }
      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: { message: text.slice(0, 200) } };
        }
      }
      if (response.ok) return data as T;
      // Same shape the service-account client sees, so one error mapper serves both.
      const error = { response: { status: response.status, data } };
      if (response.status === 401 && attempt === 1) {
        forceRefresh = true;
        continue;
      }
      if (attempt < MAX_ATTEMPTS && isRetryableGoogleError(error)) {
        const delay = 400 * 2 ** (attempt - 1);
        this.logger.warn(
          `Google Sheets request failed (attempt ${attempt}), retrying in ${delay}ms`,
        );
        await this.sleep(delay);
        continue;
      }
      this.logger.warn(describeGoogleError(error));
      throw mapGoogleError(error);
    }
  }
}

function toSheetProperties(sheet: RawSheet): SheetProperties {
  return {
    sheetId: sheet.properties?.sheetId ?? 0,
    title: sheet.properties?.title ?? '',
    index: sheet.properties?.index ?? 0,
    rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
    columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
  };
}
