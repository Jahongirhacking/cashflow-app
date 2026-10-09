import { formatCompactNumber } from '@finance/shared';
import { monthShort } from '@/i18n';

/** "Nice" axis maximum and tick values for a positive-valued chart. */
export function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const rough = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v);
  return { max, ticks };
}

export function formatAxisValue(value: number): string {
  return formatCompactNumber(value);
}

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "2026-10" → "Oct" (or "Oct 26" when the year differs from `currentYear`). */
export function monthLabel(key: string, currentYear = new Date().getFullYear()): string {
  const [y, m] = key.split('-').map(Number);
  const label = monthShort()[(m ?? 1) - 1] ?? key;
  return y === currentYear ? label : `${label} ${String(y).slice(2)}`;
}

/** Arc path for a donut segment (angles in radians, clockwise from 12 o'clock). */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const largeArc = end - start > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`;
  return [
    `M ${p(rOuter, start)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p(rOuter, end)}`,
    `L ${p(rInner, end)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p(rInner, start)}`,
    'Z',
  ].join(' ');
}
