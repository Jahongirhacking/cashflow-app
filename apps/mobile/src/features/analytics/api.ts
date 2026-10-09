import type {
  AnalyticsOverview,
  AnalyticsPeriod,
  CategoryBreakdown,
  FixedVariableBreakdown,
  MonthlyCashFlowPoint,
  SpendingTrend,
} from '@finance/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TranslationKey } from '@/i18n';
import { queryKeys } from '@/lib/query/keys';

export const PERIOD_KEYS: Record<AnalyticsPeriod, TranslationKey> = {
  month: 'period.month',
  'last-month': 'period.last-month',
  '3m': 'period.3m',
  '6m': 'period.6m',
  '12m': 'period.12m',
  all: 'period.all',
};

export function useAnalyticsOverview(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: queryKeys.analytics.overview(period),
    queryFn: ({ signal }) => api.get<AnalyticsOverview>('/analytics/overview', { period }, signal),
  });
}

export function useMonthlyCashFlow(months: number) {
  return useQuery({
    queryKey: queryKeys.analytics.monthly(months),
    queryFn: ({ signal }) =>
      api.get<MonthlyCashFlowPoint[]>('/analytics/monthly', { months }, signal),
  });
}

export function useCategoryBreakdown(period: AnalyticsPeriod, type: 'INCOME' | 'EXPENSE') {
  return useQuery({
    queryKey: queryKeys.analytics.categories(period, type),
    queryFn: ({ signal }) =>
      api.get<CategoryBreakdown>('/analytics/categories', { period, type }, signal),
  });
}

export function useFixedVariable(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: queryKeys.analytics.fixedVariable(period),
    queryFn: ({ signal }) =>
      api.get<FixedVariableBreakdown>('/analytics/fixed-variable', { period }, signal),
  });
}

export function useSpendingTrend(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: queryKeys.analytics.trend(period),
    queryFn: ({ signal }) => api.get<SpendingTrend>('/analytics/trend', { period }, signal),
  });
}

/** Number of monthly bars that makes sense for a period selector value. */
export function monthsForPeriod(period: AnalyticsPeriod): number {
  switch (period) {
    case '3m':
      return 3;
    case '12m':
    case 'all':
      return 12;
    default:
      return 6;
  }
}
