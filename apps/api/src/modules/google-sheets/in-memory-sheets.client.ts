/* eslint-disable @typescript-eslint/require-await -- test double mirrors the async interface */
import { AppException } from '../../common/errors/app.exception';
import { parseA1 } from './a1';
import {
  type CellValue,
  SheetsClient,
  type SheetProperties,
  type SpreadsheetMeta,
  type ValueUpdate,
} from './sheets-client';
import { SPREADSHEET_ACCESS_DENIED_MESSAGE, SPREADSHEET_NOT_FOUND_MESSAGE } from './sheets-errors';

interface MemorySheet {
  sheetId: number;
  title: string;
  grid: CellValue[][];
  columnCount: number;
}

interface MemorySpreadsheet {
  title: string;
  sheets: MemorySheet[];
  accessDenied: boolean;
}

/**
 * Faithful-enough simulation of the Sheets API for tests: trailing empty cells/rows are
 * trimmed from reads, writes grow the grid, deleteRows shifts rows up.
 */
export class InMemorySheetsClient extends SheetsClient {
  private readonly spreadsheets = new Map<string, MemorySpreadsheet>();
  private nextSheetId = 1;
  readonly calls: string[] = [];

  seed(
    spreadsheetId: string,
    title: string,
    sheets: { title: string; rows: CellValue[][] }[],
  ): void {
    this.spreadsheets.set(spreadsheetId, {
      title,
      accessDenied: false,
      sheets: sheets.map((s) => ({
        sheetId: this.nextSheetId++,
        title: s.title,
        grid: s.rows.map((r) => [...r]),
        columnCount: 26,
      })),
    });
  }

  setAccessDenied(spreadsheetId: string, denied: boolean): void {
    const ss = this.spreadsheets.get(spreadsheetId);
    if (ss) ss.accessDenied = denied;
  }

  /** Raw grid for assertions. */
  grid(spreadsheetId: string, sheetTitle: string): CellValue[][] {
    return this.sheet(spreadsheetId, sheetTitle).grid;
  }

  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMeta> {
    this.calls.push(`getSpreadsheet ${spreadsheetId}`);
    const ss = this.open(spreadsheetId);
    return {
      spreadsheetId,
      title: ss.title,
      sheets: ss.sheets.map((s, index) => this.props(s, index)),
    };
  }

  async getValues(spreadsheetId: string, range: string): Promise<CellValue[][]> {
    this.calls.push(`getValues ${range}`);
    return this.read(spreadsheetId, range);
  }

  async batchGetValues(spreadsheetId: string, ranges: string[]): Promise<CellValue[][][]> {
    this.calls.push(`batchGetValues ${ranges.join(',')}`);
    return ranges.map((r) => this.read(spreadsheetId, r));
  }

  async updateValues(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void> {
    this.calls.push(`updateValues ${range}`);
    this.write(spreadsheetId, range, values);
    return;
  }

  async batchUpdateValues(spreadsheetId: string, updates: ValueUpdate[]): Promise<void> {
    this.calls.push(`batchUpdateValues ${updates.map((u) => u.range).join(',')}`);
    for (const u of updates) this.write(spreadsheetId, u.range, u.values);
    return;
  }

  async clearValues(spreadsheetId: string, ranges: string[]): Promise<void> {
    this.calls.push(`clearValues ${ranges.join(',')}`);
    for (const range of ranges) {
      const { sheet, startCol, startRow, endCol, endRow } = parseA1(range);
      const s = this.sheet(spreadsheetId, sheet);
      const lastRow = endRow ?? s.grid.length;
      const lastCol = endCol ?? startCol;
      for (let r = (startRow ?? 1) - 1; r < lastRow; r += 1) {
        const row = s.grid[r];
        if (!row) continue;
        for (let c = startCol - 1; c < lastCol; c += 1) if (c < row.length) row[c] = null;
      }
    }
    return;
  }

  async addSheet(spreadsheetId: string, title: string, columnCount = 26): Promise<SheetProperties> {
    this.calls.push(`addSheet ${title}`);
    const ss = this.open(spreadsheetId);
    if (ss.sheets.some((s) => s.title === title)) {
      throw new AppException('GOOGLE_API_ERROR', `A sheet named "${title}" already exists.`);
    }
    const sheet: MemorySheet = { sheetId: this.nextSheetId++, title, grid: [], columnCount };
    ss.sheets.push(sheet);
    return this.props(sheet, ss.sheets.length - 1);
  }

  async deleteRows(
    spreadsheetId: string,
    sheetId: number,
    startRow: number,
    endRow: number,
  ): Promise<void> {
    this.calls.push(`deleteRows ${sheetId} ${startRow}-${endRow}`);
    const ss = this.open(spreadsheetId);
    const sheet = ss.sheets.find((s) => s.sheetId === sheetId);
    if (!sheet) throw new AppException('GOOGLE_API_ERROR', 'Unknown sheet id');
    sheet.grid.splice(startRow - 1, endRow - startRow + 1);
    return;
  }

  private open(spreadsheetId: string): MemorySpreadsheet {
    const ss = this.spreadsheets.get(spreadsheetId);
    if (!ss) throw new AppException('SPREADSHEET_NOT_FOUND', SPREADSHEET_NOT_FOUND_MESSAGE);
    if (ss.accessDenied)
      throw new AppException('SPREADSHEET_ACCESS_DENIED', SPREADSHEET_ACCESS_DENIED_MESSAGE);
    return ss;
  }

  private sheet(spreadsheetId: string, title: string): MemorySheet {
    const ss = this.open(spreadsheetId);
    const sheet = ss.sheets.find((s) => s.title === title);
    if (!sheet) throw new AppException('GOOGLE_API_ERROR', `Unable to parse range: ${title}`);
    return sheet;
  }

  private props(sheet: MemorySheet, index: number): SheetProperties {
    return {
      sheetId: sheet.sheetId,
      title: sheet.title,
      index,
      rowCount: Math.max(1000, sheet.grid.length),
      columnCount: sheet.columnCount,
    };
  }

  private read(spreadsheetId: string, range: string): CellValue[][] {
    const { sheet, startCol, startRow, endCol, endRow } = parseA1(range);
    const s = this.sheet(spreadsheetId, sheet);
    const firstRow = (startRow ?? 1) - 1;
    const lastRow = Math.min(endRow ?? s.grid.length, s.grid.length);
    const out: CellValue[][] = [];
    for (let r = firstRow; r < lastRow; r += 1) {
      const row = s.grid[r] ?? [];
      const lastCol = endCol ?? Math.max(row.length, startCol);
      const cells: CellValue[] = [];
      for (let c = startCol - 1; c < lastCol; c += 1) cells.push(row[c] ?? '');
      while (cells.length > 0 && isEmpty(cells[cells.length - 1])) cells.pop();
      out.push(cells);
    }
    while (out.length > 0 && (out[out.length - 1]?.length ?? 0) === 0) out.pop();
    return out;
  }

  private write(spreadsheetId: string, range: string, values: CellValue[][]): void {
    const { sheet, startCol, startRow } = parseA1(range);
    const s = this.sheet(spreadsheetId, sheet);
    const firstRow = (startRow ?? 1) - 1;
    values.forEach((rowValues, i) => {
      const r = firstRow + i;
      while (s.grid.length <= r) s.grid.push([]);
      const row = s.grid[r] as CellValue[];
      rowValues.forEach((value, j) => {
        const c = startCol - 1 + j;
        while (row.length <= c) row.push(null);
        row[c] = value === '' ? null : value;
      });
    });
  }
}

function isEmpty(value: CellValue | undefined): boolean {
  return value === null || value === undefined || value === '';
}
