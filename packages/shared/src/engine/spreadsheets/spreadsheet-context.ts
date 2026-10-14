import type { SheetProperties } from '../google-sheets/sheets-client';
import type { TransactionsLayout } from './sheet-layout';

/** Everything a repository needs to talk to one user's spreadsheet. */
export interface SpreadsheetContext {
  spreadsheetId: string;
  title: string;
  sheets: Map<string, SheetProperties>;
  transactions: TransactionsLayout;
}
