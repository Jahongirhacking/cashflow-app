import type { MonthPlan } from '@finance/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export interface MonthPlanParams {
  month: string;
  cash: number | null;
  rate: number;
}

export function useMonthPlan(params: MonthPlanParams) {
  const query = { month: params.month, cash: params.cash ?? undefined, rate: params.rate };
  return useQuery({
    queryKey: queryKeys.planning.month(query),
    queryFn: ({ signal }) => api.get<MonthPlan>('/planning/month', query, signal),
    placeholderData: (previous) => previous,
  });
}
