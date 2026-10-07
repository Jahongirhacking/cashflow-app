export type CellValue = string | number | boolean | null;

export interface SheetProperties {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  sheets: SheetProperties[];
}

export interface ValueUpdate {
  range: string;
  values: CellValue[][];
}

/**
 * Narrow, transport-agnostic view of the Sheets API used by the application.
 * Implemented by GoogleSheetsClient (REST, service account) and InMemorySheetsClient (tests).
 * Rows/columns in deleteRows are 1-based and inclusive.
 */
export abstract class SheetsClient {
  abstract getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMeta>;
  /** Values as Google returns them: trailing empty cells/rows omitted, dates as serial numbers. */
  abstract getValues(spreadsheetId: string, range: string): Promise<CellValue[][]>;
  abstract batchGetValues(spreadsheetId: string, ranges: string[]): Promise<CellValue[][][]>;
  abstract updateValues(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void>;
  abstract batchUpdateValues(spreadsheetId: string, updates: ValueUpdate[]): Promise<void>;
  abstract clearValues(spreadsheetId: string, ranges: string[]): Promise<void>;
  abstract addSheet(
    spreadsheetId: string,
    title: string,
    columnCount?: number,
  ): Promise<SheetProperties>;
  abstract deleteRows(
    spreadsheetId: string,
    sheetId: number,
    startRow: number,
    endRow: number,
  ): Promise<void>;
}
