import type {
  BulkTransactionAction,
  BulkTransactionResult,
  CreateTransactionInput,
  Paginated,
  PaymentMethod,
  Transaction,
  TransactionFacets,
  TransactionSort,
  TransactionType,
  UpdateTransactionInput,
} from '@finance/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export interface TransactionFilters {
  search: string;
  type: TransactionType | null;
  paymentMethod: PaymentMethod | null;
  category: string | null;
  from: string | null;
  to: string | null;
  sort: TransactionSort;
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  type: null,
  paymentMethod: null,
  category: null,
  from: null,
  to: null,
  sort: 'newest',
};

export const PAGE_SIZE = 50;

export function useTransactionsInfinite(filters: TransactionFilters) {
  const params = {
    search: filters.search || undefined,
    type: filters.type ?? undefined,
    paymentMethod: filters.paymentMethod ?? undefined,
    category: filters.category ?? undefined,
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    sort: filters.sort,
    pageSize: PAGE_SIZE,
  };
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(params),
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<Transaction>>('/transactions', { ...params, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
}

export function useTransactionFacets() {
  return useQuery({
    queryKey: queryKeys.transactions.facets,
    queryFn: ({ signal }) => api.get<TransactionFacets>('/transactions/facets', undefined, signal),
    staleTime: 60_000,
  });
}

function useInvalidateTransactions() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.investments.all }),
    ]);
}

export function useCreateTransaction() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => api.post<Transaction>('/transactions', input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTransactionInput }) =>
      api.patch<Transaction>(`/transactions/${id}`, patch),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/transactions/${id}`),
    onSuccess: () => invalidate(),
  });
}

/** Multi-select actions: change category, flip income/expense, delete. */
export function useBulkTransactions() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: (input: BulkTransactionAction) =>
      api.post<BulkTransactionResult>('/transactions/bulk', input),
    onSuccess: () => invalidate(),
  });
}
