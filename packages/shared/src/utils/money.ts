import type { TransactionType } from '../domain/transaction';

export const DEFAULT_CURRENCY_LABEL = "so'm";

/** Group thousands with commas without relying on Intl (Hermes/Android safe). */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = fractionDigits > 0 ? value.toFixed(fractionDigits) : Math.round(value).toString();
  const [integerPart = '0', fraction] = rounded.replace('-', '').split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 ? '-' : '';
  return fraction ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`;
}

/** `25381420` → `25,381,420 so'm` */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY_LABEL): string {
  return `${formatNumber(amount)} ${currency}`;
}

/** `+17,413,296 so'm` for income, `-42,280 so'm` for expenses. */
export function formatSignedMoney(
  amount: number,
  type: TransactionType,
  currency: string = DEFAULT_CURRENCY_LABEL,
): string {
  const sign = type === 'INCOME' ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(amount), currency)}`;
}

/** Compact form for charts/cards: 8,700,000 → 8.7M, 42,280 → 42.3K */
export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${trimZeros((abs / 1_000_000_000).toFixed(1))}B`;
  if (abs >= 1_000_000) return `${sign}${trimZeros((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${sign}${trimZeros((abs / 1_000).toFixed(1))}K`;
  return `${sign}${Math.round(abs)}`;
}

function trimZeros(value: string): string {
  return value.replace(/\.0$/, '');
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(fractionDigits)}%`;
}

/** Signed spreadsheet amount → normalised (type, amount). */
export function fromSignedAmount(signed: number): { type: TransactionType; amount: number } {
  return signed < 0
    ? { type: 'EXPENSE', amount: Math.abs(signed) }
    : { type: 'INCOME', amount: signed };
}

/** Normalised (type, amount) → signed spreadsheet amount. */
export function toSignedAmount(type: TransactionType, amount: number): number {
  const abs = Math.abs(amount);
  return type === 'EXPENSE' ? -abs : abs;
}
