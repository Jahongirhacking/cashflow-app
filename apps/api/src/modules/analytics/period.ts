import {
  type AnalyticsPeriod,
  daysInMonth,
  diffDays,
  shiftMonthKey,
  addDays,
} from '@finance/shared';

export interface ResolvedPeriod {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  isCurrentMonth: boolean;
}

function monthEnd(key: string): string {
  return `${key}-${String(daysInMonth(key)).padStart(2, '0')}`;
}

/** Map a named period onto date ranges; the previous range has the same length and ends the day before. */
export function resolvePeriod(
  period: AnalyticsPeriod,
  today: string,
  firstDate: string | null,
): ResolvedPeriod {
  const month = today.slice(0, 7);
  let from: string;
  let to: string;
  let previousFrom: string;
  let previousTo: string;
  switch (period) {
    case 'last-month': {
      const prev = shiftMonthKey(month, -1);
      from = `${prev}-01`;
      to = monthEnd(prev);
      const prev2 = shiftMonthKey(month, -2);
      previousFrom = `${prev2}-01`;
      previousTo = monthEnd(prev2);
      break;
    }
    case '3m':
    case '6m':
    case '12m': {
      const months = Number(period.replace('m', ''));
      from = `${shiftMonthKey(month, -(months - 1))}-01`;
      to = monthEnd(month);
      previousFrom = `${shiftMonthKey(month, -(2 * months - 1))}-01`;
      previousTo = monthEnd(shiftMonthKey(month, -months));
      break;
    }
    case 'all': {
      from = firstDate && firstDate < `${month}-01` ? firstDate : `${month}-01`;
      to = monthEnd(month);
      const length = diffDays(from, to) + 1;
      previousTo = addDays(from, -1);
      previousFrom = addDays(previousTo, -(length - 1));
      break;
    }
    default: {
      from = `${month}-01`;
      to = monthEnd(month);
      const prev = shiftMonthKey(month, -1);
      previousFrom = `${prev}-01`;
      previousTo = monthEnd(prev);
    }
  }
  return { period, from, to, previousFrom, previousTo, isCurrentMonth: period === 'month' };
}
