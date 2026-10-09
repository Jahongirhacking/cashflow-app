import type {
  CreateRecurringRuleInput,
  MarkOccurrenceInput,
  RecurringRule,
  RecurringSchedule,
  UpdateRecurringRuleInput,
} from '@finance/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export function useRecurringRules() {
  return useQuery({
    queryKey: queryKeys.recurring.list,
    queryFn: ({ signal }) => api.get<RecurringRule[]>('/recurring', undefined, signal),
  });
}

export function useRecurringSchedule(month: string) {
  return useQuery({
    queryKey: queryKeys.recurring.schedule(month),
    queryFn: ({ signal }) => api.get<RecurringSchedule>('/recurring/schedule', { month }, signal),
  });
}

function useInvalidateRecurring() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
}

export function useCreateRecurringRule() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: (input: CreateRecurringRuleInput) => api.post<RecurringRule>('/recurring', input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRecurringRule() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateRecurringRuleInput }) =>
      api.patch<RecurringRule>(`/recurring/${id}`, patch),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteRecurringRule() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/recurring/${id}`),
    onSuccess: () => invalidate(),
  });
}

/** Reminder tick for one occurrence. Pure bookkeeping: no transaction is created or removed. */
export function useMarkOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MarkOccurrenceInput }) =>
      api.post<RecurringSchedule>(`/recurring/${id}/done`, input),
    onSuccess: async (schedule) => {
      queryClient.setQueryData(queryKeys.recurring.schedule(schedule.month), schedule);
      await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
