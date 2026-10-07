import { fromSignedAmount, toSignedAmount, type Transaction } from '@finance/shared';
import type { CellValue } from '../google-sheets/sheets-client';
import type { TransactionsLayout } from '../spreadsheets/sheet-layout';
import {
  cellText,
  parseCellAmount,
  parseCellDate,
  parseCellPayment,
  parseCellTime,
  paymentToCell,
} from './cell-parsers';

export interface ParsedTransactionRow {
  transaction: Transaction;
  rowNumber: number;
  /** True when the sheet row had no Finance ID yet (legacy row) and one was generated. */
  idMissing: boolean;
}

/**
 * Spreadsheet row ⇄ normalised Transaction.
 * Reading tolerates the legacy sheet's loose formats; writing always produces clean values.
 */
export class TransactionRowAdapter {
  constructor(private readonly layout: TransactionsLayout) {}

  parse(
    cells: CellValue[],
    rowNumber: number,
    userId: string,
    fallbackId: () => string,
  ): ParsedTransactionRow | null {
    const c = this.layout.columns;
    const name = cellText(cells[c.name - 1]);
    const signed = parseCellAmount(cells[c.amount - 1]);
    if (!name && signed === null) return null; // blank / tombstoned row
    if (!name || signed === null || signed === 0) return null; // unusable row (e.g. stray label)
    const date = parseCellDate(cells[c.date - 1]);
    if (!date) return null;
    const { type, amount } = fromSignedAmount(signed);
    const existingId = cellText(cells[c.id - 1]);
    const idMissing = existingId === '';
    const id = idMissing ? fallbackId() : existingId;
    const createdAt = cellText(cells[c.createdAt - 1]) || `${date}T00:00:00.000Z`;
    const updatedAt = cellText(cells[c.updatedAt - 1]) || createdAt;
    const recurringRuleId = cellText(cells[c.recurringRuleId - 1]) || null;
    return {
      rowNumber,
      idMissing,
      transaction: {
        id,
        name,
        amount,
        type,
        paymentMethod: parseCellPayment(cells[c.payment - 1]),
        date,
        time: parseCellTime(cells[c.time - 1]),
        category: cellText(cells[c.category - 1]) || 'Other',
        note: cellText(cells[c.note - 1]) || null,
        isRecurring: recurringRuleId !== null,
        recurringRuleId,
        createdAt,
        updatedAt,
        userId,
      },
    };
  }

  /** Values for the legacy data block (A-F). */
  dataCells(t: Transaction): CellValue[] {
    return [
      t.name,
      toSignedAmount(t.type, t.amount),
      paymentToCell(t.paymentMethod),
      t.date,
      t.time ?? '',
      t.category,
    ];
  }

  /** Values for the app metadata block. */
  appCells(t: Transaction): CellValue[] {
    return [t.id, t.note ?? '', t.recurringRuleId ?? '', t.createdAt, t.updatedAt];
  }
}
