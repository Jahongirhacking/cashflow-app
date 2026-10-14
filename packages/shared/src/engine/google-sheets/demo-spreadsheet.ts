import type { InMemorySheetsClient } from './in-memory-sheets.client';

export const DEMO_SPREADSHEET_ID = '1DemoFinanceSpreadsheetIdForLocalDevelopment00';
export const DEMO_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEMO_SPREADSHEET_ID}/edit`;

/** Serial for a local calendar date (days since 1899-12-30), as Google Sheets stores dates. */
function serial(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(
    (Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - Date.UTC(1899, 11, 30)) / 86_400_000,
  );
}

/**
 * A legacy-shaped spreadsheet (Uzbek headers, signed amounts, N/P payment types, summary cells in H:I)
 * used when SHEETS_BACKEND=memory. Development only — nothing here is written to Google.
 */
export function seedDemoSpreadsheet(client: InMemorySheetsClient): void {
  const rows: (string | number)[][] = [
    [
      "To'lov Nomi",
      'Narx (+ Kirim / - Chiqim)',
      "To'lov turi (N/P)",
      'Sana',
      'Vaqt',
      'Kategoriya',
      '',
      'Naqd',
      '=SUMIF(C:C,"N",B:B)',
    ],
    [
      'Oylik',
      17413296,
      'P',
      serial('2026-09-05'),
      0.375,
      'Oylik',
      '',
      'Plastik',
      '=SUMIF(C:C,"P",B:B)',
    ],
    ['Kia kredit', -3760000, 'P', serial('2026-09-18'), 0.5, 'Kredit', '', 'Jami', '=SUM(B:B)'],
    ['Claude', -670000, 'P', serial('2026-09-03'), 0.4, 'Obuna', '', 'Chiqim', '=SUMIF(B:B,"<0")'],
    ['Metro', -2500, 'N', serial('2026-09-12'), 0.35, 'Transport', '', 'Kirim', '=SUMIF(B:B,">0")'],
    ['Ovqat', -85000, 'P', serial('2026-09-12'), 0.55, 'Ovqat'],
    ['Kommunal', -420000, 'P', serial('2026-09-10'), 0.45, 'Kommunal'],
    ['Oylik', 17413296, 'P', serial('2026-10-05'), 0.375, 'Oylik'],
    ['Claude', -670000, 'P', serial('2026-10-03'), 0.4, 'Obuna'],
    ['Taksi', -42280, 'P', serial('2026-10-06'), 0.8, 'Transport'],
    ['Bozor', -350000, 'N', serial('2026-10-06'), 0.42, 'Ovqat'],
    ['Metro', -2500, 'N', '07.10.2026', '08:15', 'Transport'],
    // Investments are derived from these categories: expense = money in, income = money out.
    ['Kapitalbank depozit', -10000000, 'P', serial('2026-08-04'), 0.5, 'Deposit'],
    ['Depozit foizi', 150000, 'P', serial('2026-09-04'), 0.5, 'Deposit'],
    ['Depozit foizi', 150000, 'P', serial('2026-10-04'), 0.5, 'Deposit'],
    ['BTC sotib olish', -2000000, 'P', serial('2026-09-20'), 0.6, 'Crypto'],
    ['BTC sotish', 2600000, 'P', serial('2026-10-02'), 0.6, 'Crypto'],
  ];
  client.seed(DEMO_SPREADSHEET_ID, 'Demo byudjet', [{ title: 'Xarajatlar', rows }]);
}
