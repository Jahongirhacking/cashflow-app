import type { InvestmentsOverview } from '@finance/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Positions derived on the server from Deposit / Crypto / Stocks transactions. */
export function useInvestments() {
  return useQuery({
    queryKey: queryKeys.investments.all,
    queryFn: ({ signal }) => api.get<InvestmentsOverview>('/investments', undefined, signal),
  });
}
