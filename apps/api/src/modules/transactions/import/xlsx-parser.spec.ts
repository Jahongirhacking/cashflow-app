import ExcelJS from 'exceljs';
import { parseTransactionsWorkbook } from './xlsx-parser';

async function workbook(rows: (string | number | Date | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow([]);
  ws.addRow([
    "To'lov Nomi",
    'Narx (+ Kirim / - Chiqim)',
    "To'lov turi (N/P)",
    'Sana',
    'Vaqt',
    'Kategoriya',
  ]);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseTransactionsWorkbook', () => {
  it("reads the legacy layout with fill-forward dates, so'm suffixes and N/P payment", async () => {
    const buf = await workbook([
      ['Dadam naqd', "937,417so'm", 'N', null, null, 'Oilaviy xarajatlar'],
      ['Avtobus', "-1,400so'm", 'N', '18.09.2023', '12:15', 'Transport'],
      ['Avtobus', -1400, 'P', null, '17:13', 'Transport'],
      ['Bozorliq', "-18,000so'm", 'P', null, null, "Oziq-ovqat & Ro'zg'orlik"],
      [
        'Metro',
        "-1,400so'm",
        'P',
        new Date(Date.UTC(2023, 8, 19)),
        new Date(Date.UTC(1899, 11, 30, 18, 40)),
        'Transport',
      ],
      [null, null, null, null, null, null],
      ['Nodir', "50,000so'm", 'N', null, null, ''],
    ]);
    const parsed = await parseTransactionsWorkbook(buf);
    expect(parsed.sheetName).toBe('Sheet1');
    // first row has no date above it → takes the next date below, with a warning
    expect(parsed.skippedRows).toBe(0);
    expect(parsed.warnings[0]).toMatchObject({
      sourceRow: 3,
      message: 'No date above this row; used the next date (2023-09-18).',
    });
    expect(
      parsed.rows.map((r) => [
        r.sourceRow,
        r.name,
        r.type,
        r.amount,
        r.paymentMethod,
        r.date,
        r.time,
        r.category,
      ]),
    ).toEqual([
      [3, 'Dadam naqd', 'INCOME', 937417, 'CASH', '2023-09-18', null, 'Oilaviy xarajatlar'],
      [4, 'Avtobus', 'EXPENSE', 1400, 'CASH', '2023-09-18', '12:15', 'Transport'],
      [5, 'Avtobus', 'EXPENSE', 1400, 'CARD', '2023-09-18', '17:13', 'Transport'],
      [6, 'Bozorliq', 'EXPENSE', 18000, 'CARD', '2023-09-18', null, "Oziq-ovqat & Ro'zg'orlik"],
      [7, 'Metro', 'EXPENSE', 1400, 'CARD', '2023-09-19', '18:40', 'Transport'],
      [9, 'Nodir', 'INCOME', 50000, 'CASH', '2023-09-19', null, 'Boshqa'],
    ]);
  });

  it('skips every row when no row has a date', async () => {
    const parsed = await parseTransactionsWorkbook(
      await workbook([
        ['A', 100, 'N', null, null, 'X'],
        ['B', -5, 'P', null, null, 'Y'],
      ]),
    );
    expect(parsed.rows).toEqual([]);
    expect(parsed.skippedRows).toBe(2);
  });

  it('rejects non-workbooks', async () => {
    await expect(parseTransactionsWorkbook(Buffer.from('not an xlsx'))).rejects.toBeDefined();
  });
});
