import { IMPORT_LAYOUT, type ImportRow, type ImportWarning } from '@finance/shared';
import ExcelJS from 'exceljs';
import type { CellValue } from '../../google-sheets/sheets-client';
import {
  cellText,
  parseCellAmount,
  parseCellDate,
  parseCellPayment,
  parseCellTime,
} from '../cell-parsers';

export interface ParsedWorkbook {
  sheetName: string;
  rows: Omit<ImportRow, 'duplicate'>[];
  skippedRows: number;
  warnings: ImportWarning[];
}

const MAX_ROWS = 10_000;

/** exceljs cell → the plain value our Sheets parsers already understand. Dates become ISO strings. */
function toCellValue(cell: ExcelJS.Cell): CellValue {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return dateToString(v, cell.numFmt);
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('result' in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      return r instanceof Date
        ? dateToString(r, cell.numFmt)
        : r === undefined
          ? null
          : typeof r === 'object'
            ? String((r as { error?: string }).error ?? '')
            : r;
    }
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
  }
  return null; // unsupported cell content (images, errors)
}

/** Time-only cells (serial < 1 day) keep HH:mm; everything else becomes YYYY-MM-DD. */
function dateToString(d: Date, numFmt?: string): string {
  const isTime = /^h|^\[h|^hh|mm:ss/i.test(numFmt ?? '') && !/d|y/i.test(numFmt ?? '');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  if (isTime || d.getUTCFullYear() <= 1900) return `${hh}:${mm}`;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Parse the user's legacy export: header rows 1–2, data from row 3,
 * A name · B signed amount ("-1,400so'm") · C N/P · D date (blank = same as the row above) · E time · F category.
 */
export async function parseTransactionsWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet)
    return {
      sheetName: '',
      rows: [],
      skippedRows: 0,
      warnings: [{ sourceRow: 0, message: 'The workbook has no sheets.' }],
    };

  const { firstDataRow, columns } = IMPORT_LAYOUT;
  const rows: Omit<ImportRow, 'duplicate'>[] = [];
  const warnings: ImportWarning[] = [];
  let skippedRows = 0;
  let lastDate: string | null = null;
  /** Rows above the first dated row; they receive that first date once it is known. */
  const undated: Omit<ImportRow, 'duplicate'>[] = [];

  for (
    let r = firstDataRow;
    r <= sheet.rowCount && rows.length + undated.length < MAX_ROWS;
    r += 1
  ) {
    const row = sheet.getRow(r);
    const get = (c: number) => toCellValue(row.getCell(c));
    const name = cellText(get(columns.name));
    const signed = parseCellAmount(get(columns.amount));
    const rawDate = get(columns.date);
    const rawTime = get(columns.time);
    const category = cellText(get(columns.category));

    if (!name && signed === null && !cellText(rawDate) && !category) {
      continue; // blank line
    }
    const date = parseCellDate(rawDate);
    if (date) {
      lastDate = date;
      if (undated.length > 0) {
        for (const u of undated) {
          u.date = date;
          warnings.push({
            sourceRow: u.sourceRow,
            message: `No date above this row; used the next date (${date}).`,
          });
        }
        rows.unshift(...undated.splice(0));
      }
    }
    if (!name || signed === null || signed === 0) {
      skippedRows += 1;
      warnings.push({
        sourceRow: r,
        message: !name ? 'Missing name' : 'Amount is missing or not a number',
      });
      continue;
    }
    const parsedRow: Omit<ImportRow, 'duplicate'> = {
      sourceRow: r,
      name,
      amount: Math.abs(signed),
      type: signed < 0 ? 'EXPENSE' : 'INCOME',
      paymentMethod: parseCellPayment(get(columns.payment)),
      date: lastDate ?? '',
      time: parseCellTime(rawTime),
      category: category || 'Boshqa',
      note: null,
    };
    if (lastDate) rows.push(parsedRow);
    else undated.push(parsedRow);
  }
  for (const u of undated) {
    skippedRows += 1;
    warnings.push({ sourceRow: u.sourceRow, message: 'No date on this row or any other row' });
  }
  warnings.sort((a, b) => a.sourceRow - b.sourceRow);
  if (sheet.rowCount - firstDataRow + 1 > MAX_ROWS) {
    warnings.push({
      sourceRow: firstDataRow + MAX_ROWS,
      message: `Only the first ${MAX_ROWS} rows were read.`,
    });
  }
  return { sheetName: sheet.name, rows, skippedRows, warnings };
}
