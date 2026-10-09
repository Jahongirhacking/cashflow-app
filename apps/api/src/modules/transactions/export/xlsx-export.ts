import { IMPORT_LAYOUT, type Transaction } from '@finance/shared';
import ExcelJS from 'exceljs';

/** Header labels as in the user's original sheet; the importer reads positions, not labels. */
export const EXPORT_HEADERS = [
  "To'lov Nomi",
  'Narx',
  "To'lov turi (N/P)",
  'Sana',
  'Vaqt',
  'Kategoriya',
];

function excelDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/**
 * Builds the same layout the importer expects: title row, header row, data from row 3,
 * A name · B signed amount (number, shown as "-1,400so'm") · C N/P · D date · E time · F category.
 * Oldest first so the file reads like a ledger; every row carries its own date.
 */
export async function buildTransactionsWorkbook(
  transactions: Transaction[],
  generatedAt: Date,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Finance';
  workbook.created = generatedAt;
  const sheet = workbook.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 2 }] });
  const { columns } = IMPORT_LAYOUT;
  sheet.getCell(1, 1).value = `Finance export · ${generatedAt.toISOString().slice(0, 10)}`;
  sheet.getCell(1, 1).font = { bold: true };
  const header = sheet.getRow(2);
  EXPORT_HEADERS.forEach((label, i) => {
    header.getCell(i + 1).value = label;
  });
  header.font = { bold: true };

  const sorted = [...transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''),
  );
  sorted.forEach((t, i) => {
    const row = sheet.getRow(3 + i);
    row.getCell(columns.name).value = t.name;
    const amount = row.getCell(columns.amount);
    amount.value = t.type === 'EXPENSE' ? -t.amount : t.amount;
    amount.numFmt = '#,##0"so\'m";-#,##0"so\'m"';
    row.getCell(columns.payment).value = t.paymentMethod === 'CASH' ? 'N' : 'P';
    const date = row.getCell(columns.date);
    date.value = excelDate(t.date);
    date.numFmt = 'dd.mm.yyyy';
    row.getCell(columns.time).value = t.time ?? '';
    row.getCell(columns.category).value = t.category;
  });
  sheet.columns = [
    { width: 32 },
    { width: 16 },
    { width: 10 },
    { width: 12 },
    { width: 8 },
    { width: 24 },
  ];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
