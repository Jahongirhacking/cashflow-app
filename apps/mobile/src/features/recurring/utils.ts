import type { RecurringRule } from '@finance/shared';
import { formatShortDate } from '@/features/transactions/utils';
import { getLocale, monthLong, translate, weekdayLong } from '@/i18n';

/** English ordinal suffix; Uzbek uses "18-kuni" style instead. */
export function ordinalDay(n: number): string {
  if (getLocale() === 'uz') return `${n}-kuni`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** "Every month · 18th", "Every Monday", "Once · 25 Oct 2026", "Every year · 5 March", "Every day" (localised). */
export function describeFrequency(
  rule: Pick<RecurringRule, 'frequency' | 'dayOfPeriod' | 'monthOfYear' | 'startDate'>,
): string {
  switch (rule.frequency) {
    case 'ONCE':
      return translate('rec.describe.once', { date: formatShortDate(rule.startDate) });
    case 'DAILY':
      return translate('rec.describe.daily');
    case 'WEEKLY':
      return translate('rec.describe.weekly', { day: weekdayLong()[rule.dayOfPeriod ?? 0] ?? '' });
    case 'MONTHLY':
      return translate('rec.describe.monthly', {
        day: ordinalDay(rule.dayOfPeriod ?? Number(rule.startDate.slice(8, 10))),
      });
    case 'YEARLY':
      return translate('rec.describe.yearly', {
        day: rule.dayOfPeriod ?? Number(rule.startDate.slice(8, 10)),
        month: monthLong()[(rule.monthOfYear ?? Number(rule.startDate.slice(5, 7))) - 1] ?? '',
      });
    default:
      return '';
  }
}
