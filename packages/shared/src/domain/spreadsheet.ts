import { z } from 'zod';
import { isoDateTimeSchema } from './common';

export const SPREADSHEET_ACCESS_STATES = [
  'OK',
  'ACCESS_DENIED',
  'NOT_FOUND',
  'NOT_CONNECTED',
] as const;
export type SpreadsheetAccessState = (typeof SPREADSHEET_ACCESS_STATES)[number];

const GOOGLE_SHEETS_URL =
  /^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]{20,})(?:[/?#].*)?$/;

/** Extract the spreadsheet ID from a Google Sheets URL. Returns null when the URL is not a sheet. */
export function extractSpreadsheetId(url: string): string | null {
  const match = GOOGLE_SHEETS_URL.exec(url.trim());
  return match?.[1] ?? null;
}

export function buildSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

export const connectSpreadsheetSchema = z.object({
  spreadsheetUrl: z
    .string()
    .trim()
    .min(1, 'Paste your spreadsheet URL')
    .refine(
      (value) => extractSpreadsheetId(value) !== null,
      'This is not a valid Google Sheets URL',
    ),
});
export type ConnectSpreadsheetInput = z.infer<typeof connectSpreadsheetSchema>;

export const spreadsheetStatusSchema = z.object({
  connected: z.boolean(),
  accessState: z.enum(SPREADSHEET_ACCESS_STATES),
  spreadsheetId: z.string().nullable(),
  spreadsheetName: z.string().nullable(),
  spreadsheetUrl: z.string().nullable(),
  lastVerifiedAt: isoDateTimeSchema.nullable(),
  /** Service-account email the user must share their sheet with. Safe to expose. */
  serviceAccountEmail: z.string().nullable(),
});
export type SpreadsheetStatus = z.infer<typeof spreadsheetStatusSchema>;

export interface SpreadsheetSheetInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  url: string;
  sheets: SpreadsheetSheetInfo[];
  transactionsSheet: string | null;
  requiredSheets: { title: string; exists: boolean }[];
}

/** Sheet titles the app creates in the user's spreadsheet when missing. */
export const REQUIRED_SHEETS = [
  'Transactions',
  'Investments',
  'Recurring',
  'Categories',
  'Settings',
] as const;
export type RequiredSheet = (typeof REQUIRED_SHEETS)[number];
