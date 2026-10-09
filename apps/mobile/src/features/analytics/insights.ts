import {
  formatMoney,
  type Insight,
  type MonthPlan,
  type PlanRecommendation,
} from '@finance/shared';
import type { Translate, TranslationKey } from '@/i18n';
import { formatDateLabel } from '@/features/transactions/utils';

/** Render a server insight in the current language (ids map 1:1 to translation keys). */
export function insightText(insight: Insight, t: Translate): string {
  const params = { ...insight.params };
  if (typeof params.amount === 'number') params.amount = formatMoney(params.amount);
  return t(`insight.${insight.id}` as TranslationKey, params);
}

export function planWarningText(warning: MonthPlan['warnings'][number], t: Translate): string {
  const params = { ...warning.params };
  if (typeof params.amount === 'number') params.amount = formatMoney(params.amount);
  if (typeof params.date === 'string') params.date = formatDateLabel(params.date);
  return t(`plan.warning.${warning.code}` as TranslationKey, params);
}

export function planReasonText(r: PlanRecommendation, t: Translate): string {
  return r.reason === 'after-income'
    ? t('plan.reason.after-income', { name: r.incomeName ?? '' })
    : t('plan.reason.free-now');
}
