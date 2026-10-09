import type { ExportCategoryMap, ExportCategorySettings } from '@finance/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const KEY = ['export', 'categories'] as const;

/** App categories with the Excel names they get on export. */
export function useExportCategories(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) =>
      api.get<ExportCategorySettings>('/transactions/export/categories', undefined, signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveExportMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (map: ExportCategoryMap) =>
      api.put<ExportCategorySettings>('/transactions/export/categories', map),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
}
