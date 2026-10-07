import type { CellValue } from '../google-sheets/sheets-client';

/** 1-based column indexes of every field in the Transactions sheet. */
export interface TransactionColumns {
  name: number;
  amount: number;
  payment: number;
  date: number;
  time: number;
  category: number;
  id: number;
  note: number;
  recurringRuleId: number;
  createdAt: number;
  updatedAt: number;
}

export type TransactionsFormat = 'legacy' | 'app';

export interface TransactionsLayout {
  sheetTitle: string;
  sheetId: number;
  headerRow: number;
  format: TransactionsFormat;
  columns: TransactionColumns;
}

/** Legacy data columns A-F, as found in the user's existing spreadsheet. */
export const LEGACY_DATA_COLUMNS = {
  name: 1,
  amount: 2,
  payment: 3,
  date: 4,
  time: 5,
  category: 6,
} as const;
export const LEGACY_DATA_WIDTH = 6;
export const APP_BLOCK_WIDTH = 5;

export const TRANSACTIONS_HEADERS = [
  "To'lov nomi",
  'Narx (+ Kirim / - Chiqim)',
  "To'lov turi (N/P)",
  'Sana',
  'Vaqt',
  'Kategoriya',
];
export const APP_BLOCK_HEADERS = ['Finance ID', 'Izoh', 'Takroriy ID', 'Yaratilgan', 'Yangilangan'];
export const APP_ID_HEADER = APP_BLOCK_HEADERS[0] as string;

export const INVESTMENTS_HEADERS = [
  'ID',
  'Name',
  'Type',
  'Invested amount',
  'Current value',
  'Start date',
  'Expected rate %',
  'Status',
  'Note',
  'Created at',
  'Updated at',
];
export const RECURRING_HEADERS = [
  'ID',
  'Name',
  'Amount',
  'Type',
  'Category',
  'Payment method',
  'Frequency',
  'Day of period',
  'Month of year',
  'Start date',
  'End date',
  'Active',
  'Note',
  'Created at',
  'Updated at',
];
export const CATEGORIES_HEADERS = [
  'ID',
  'Name',
  'Type',
  'Kind',
  'Icon',
  'Color',
  'Default',
  'Created at',
  'Updated at',
];
export const SETTINGS_HEADERS = ['Key', 'Value'];

export function buildColumns(appStart: number): TransactionColumns {
  return {
    ...LEGACY_DATA_COLUMNS,
    id: appStart,
    note: appStart + 1,
    recurringRuleId: appStart + 2,
    createdAt: appStart + 3,
    updatedAt: appStart + 4,
  };
}

function normalise(cell: CellValue | undefined): string {
  return String(cell ?? '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .trim();
}

/**
 * Heuristic: does this header row look like the legacy Uzbek transaction sheet
 * (To'lov Nomi | Narx | To'lov turi | Sana | Vaqt | Kategoriya)?
 */
export function scoreLegacyHeader(header: CellValue[]): number {
  const cells = header.slice(0, LEGACY_DATA_WIDTH).map(normalise);
  let score = 0;
  if (cells[0]?.includes('nomi') || cells[0]?.includes('name')) score += 1;
  if (cells[1]?.includes('narx') || cells[1]?.includes('summa') || cells[1]?.includes('amount'))
    score += 1;
  if (cells[2]?.includes('turi') || cells[2]?.includes('n/p') || cells[2]?.includes('payment'))
    score += 1;
  if (cells[3]?.includes('sana') || cells[3]?.includes('date')) score += 1;
  if (cells[4]?.includes('vaqt') || cells[4]?.includes('time')) score += 1;
  if (cells[5]?.includes('kategor') || cells[5]?.includes('category')) score += 1;
  return score;
}

export function isLegacyTransactionsHeader(header: CellValue[]): boolean {
  return scoreLegacyHeader(header) >= 3;
}

/** Column index (1-based) of an existing app block, found by its "Finance ID" header. */
export function findAppBlockColumn(header: CellValue[]): number | null {
  const index = header.findIndex((cell) => normalise(cell) === normalise(APP_ID_HEADER));
  return index >= 0 ? index + 1 : null;
}

/**
 * Pick the first run of APP_BLOCK_WIDTH entirely empty columns at or after `minColumn`
 * so the user's own formulas / summary cells (Naqd, Plastik, Jami…) are never touched.
 * `rows` are the sheet's cells starting at column `minColumn`.
 */
export function chooseAppBlockColumn(
  rows: CellValue[][],
  minColumn: number,
  maxColumn = 60,
): number {
  const used = new Set<number>();
  for (const row of rows) {
    row.forEach((cell, i) => {
      if (cell !== null && cell !== undefined && cell !== '') used.add(minColumn + i);
    });
  }
  for (let start = minColumn; start + APP_BLOCK_WIDTH - 1 <= maxColumn; start += 1) {
    let free = true;
    for (let c = start; c < start + APP_BLOCK_WIDTH; c += 1) {
      if (used.has(c)) {
        free = false;
        break;
      }
    }
    if (free) return start;
  }
  return maxColumn + 1;
}
