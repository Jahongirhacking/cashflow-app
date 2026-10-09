import { toIsoDate, toIsoTime } from '@finance/shared';
import type { PaymentMethod } from '@finance/shared';
import type { CellValue } from '../google-sheets/sheets-client';

const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Google Sheets date serial (days since 1899-12-30) → `YYYY-MM-DD`. */
export function serialToIsoDate(serial: number): string {
  const date = new Date(SERIAL_EPOCH_MS + Math.floor(serial) * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Fraction of a day → `HH:mm`. */
export function serialToIsoTime(serial: number): string {
  const fraction = serial - Math.floor(serial);
  const totalMinutes = Math.round(fraction * 24 * 60) % (24 * 60);
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

/** Accepts serials, ISO strings, dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy and yyyy/mm/dd. */
export function parseCellDate(cell: CellValue | undefined): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number')
    return Number.isFinite(cell) && cell > 0 ? serialToIsoDate(cell) : null;
  if (typeof cell !== 'string') return null;
  const text = cell.trim();
  let match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(text);
  if (match) return buildDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/.exec(text);
  if (match) return buildDate(Number(match[3]), Number(match[2]), Number(match[1]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseCellTime(cell: CellValue | undefined): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return serialToIsoTime(cell);
  if (typeof cell !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(cell.trim());
  if (!match) {
    const parsed = new Date(`1970-01-01T${cell.trim()}`);
    return Number.isNaN(parsed.getTime()) ? null : toIsoTime(parsed);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "1 250 000", "-50,000", "50000.5", "1,5" (decimal comma), 2500 → number (null when not numeric). */
export function parseCellAmount(cell: CellValue | undefined): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell === 'boolean') return null;
  // Drop currency labels and spaces: "-1,400so'm", "1 250 000 сум", "UZS 50,000".
  let text = cell.replace(/[^\d,.-]/g, '');
  if (!text) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, ''); // thousands separators
  } else if (/^-?\d+,\d+$/.test(text)) {
    text = text.replace(',', '.'); // decimal comma
  } else {
    text = text.replace(/,/g, '');
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const PAYMENT_WRITE: Record<PaymentMethod, string> = {
  CASH: 'N',
  CARD: 'P',
  BANK: 'B',
  OTHER: 'O',
};

export function paymentToCell(method: PaymentMethod): string {
  return PAYMENT_WRITE[method];
}

export function parseCellPayment(cell: CellValue | undefined): PaymentMethod {
  const text = String(cell ?? '')
    .trim()
    .toLowerCase();
  if (!text) return 'OTHER';
  if (text === 'n' || text.startsWith('naqd') || text.startsWith('cash')) return 'CASH';
  if (
    text === 'p' ||
    text.startsWith('plastik') ||
    text.startsWith('karta') ||
    text.startsWith('card')
  )
    return 'CARD';
  if (
    text === 'b' ||
    text.startsWith('bank') ||
    text.startsWith('transfer') ||
    text.startsWith('o’tkazma')
  )
    return 'BANK';
  return 'OTHER';
}

export function cellText(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}
