function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Local calendar date as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local wall-clock time as `HH:mm`. */
export function toIsoTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function nowIsoTime(now: Date = new Date()): string {
  return toIsoTime(now);
}

/** `YYYY-MM` for grouping. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(toIsoDate(now));
}

/** Shift a `YYYY-MM` key by `delta` months. */
export function shiftMonthKey(key: string, delta: number): string {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function daysInMonth(key: string): number {
  const [yearStr, monthStr] = key.split('-');
  return new Date(Number(yearStr), Number(monthStr), 0).getDate();
}

/** Parse `YYYY-MM-DD` into a local Date at midnight. */
export function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Inclusive difference in days between two ISO dates (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
