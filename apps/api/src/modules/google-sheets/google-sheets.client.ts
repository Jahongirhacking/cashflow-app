import { Injectable, Logger } from '@nestjs/common';
import { JWT } from 'google-auth-library';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';
import {
  type CellValue,
  SheetsClient,
  type SheetProperties,
  type SpreadsheetMeta,
  type ValueUpdate,
} from './sheets-client';
import { isRetryableGoogleError, mapGoogleError } from './sheets-errors';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const MAX_ATTEMPTS = 3;

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

/**
 * Service-account backed client for the Google Sheets REST API.
 * Deliberately avoids the full `googleapis` bundle: only the handful of endpoints the app needs.
 */
@Injectable()
export class GoogleSheetsClient extends SheetsClient {
  private readonly logger = new Logger(GoogleSheetsClient.name);
  private auth: JWT | null = null;

  constructor(private readonly config: AppConfigService) {
    super();
  }

  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMeta> {
    const data = await this.request<RawSpreadsheet>({
      method: 'GET',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}`,
      params: {
        fields:
          'spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))',
      },
    });
    return {
      spreadsheetId: data.spreadsheetId ?? spreadsheetId,
      title: data.properties?.title ?? 'Untitled spreadsheet',
      sheets: (data.sheets ?? []).map(toSheetProperties),
    };
  }

  async getValues(spreadsheetId: string, range: string): Promise<CellValue[][]> {
    const data = await this.request<{ values?: CellValue[][] }>({
      method: 'GET',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      params: {
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
        majorDimension: 'ROWS',
      },
    });
    return data.values ?? [];
  }

  async batchGetValues(spreadsheetId: string, ranges: string[]): Promise<CellValue[][][]> {
    if (ranges.length === 0) return [];
    const data = await this.request<{ valueRanges?: { values?: CellValue[][] }[] }>({
      method: 'GET',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
      params: {
        ranges,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
        majorDimension: 'ROWS',
      },
    });
    return (data.valueRanges ?? []).map((vr) => vr.values ?? []);
  }

  async updateValues(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void> {
    await this.request({
      method: 'PUT',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      params: { valueInputOption: 'USER_ENTERED' },
      data: { range, majorDimension: 'ROWS', values },
    });
  }

  async batchUpdateValues(spreadsheetId: string, updates: ValueUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    await this.request({
      method: 'POST',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      data: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map((u) => ({ range: u.range, majorDimension: 'ROWS', values: u.values })),
      },
    });
  }

  async clearValues(spreadsheetId: string, ranges: string[]): Promise<void> {
    if (ranges.length === 0) return;
    await this.request({
      method: 'POST',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
      data: { ranges },
    });
  }

  async addSheet(spreadsheetId: string, title: string, columnCount = 26): Promise<SheetProperties> {
    const data = await this.request<{ replies?: { addSheet?: RawSheet }[] }>({
      method: 'POST',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      data: {
        requests: [
          { addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount } } } },
        ],
      },
    });
    const sheet = data.replies?.[0]?.addSheet;
    if (!sheet) throw new AppException('GOOGLE_API_ERROR', `Could not create sheet "${title}".`);
    return toSheetProperties(sheet);
  }

  async deleteRows(
    spreadsheetId: string,
    sheetId: number,
    startRow: number,
    endRow: number,
  ): Promise<void> {
    await this.request({
      method: 'POST',
      url: `${BASE_URL}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      data: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: startRow - 1, endIndex: endRow },
            },
          },
        ],
      },
    });
  }

  private getAuth(): JWT {
    if (this.auth) return this.auth;
    const account = this.config.googleServiceAccount;
    if (!account) {
      throw AppException.configuration(
        'Google Sheets access is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).',
      );
    }
    this.auth = new JWT({ email: account.email, key: account.privateKey, scopes: SCOPES });
    return this.auth;
  }

  private async request<T>(options: {
    method: 'GET' | 'POST' | 'PUT';
    url: string;
    params?: Record<string, string | string[]>;
    data?: unknown;
  }): Promise<T> {
    const auth = this.getAuth();
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await auth.request<T>({
          method: options.method,
          url: options.url,
          params: options.params,
          data: options.data,
          timeout: 20_000,
        });
        return response.data;
      } catch (error) {
        if (attempt < MAX_ATTEMPTS && isRetryableGoogleError(error)) {
          const delay = 400 * 2 ** (attempt - 1);
          this.logger.warn(
            `Google Sheets request failed (attempt ${attempt}), retrying in ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw mapGoogleError(error);
      }
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
