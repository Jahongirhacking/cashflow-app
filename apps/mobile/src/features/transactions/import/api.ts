import type { ImportCommitInput, ImportPreview, ImportResult } from '@finance/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

const XLSX_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export interface PickedWorkbook {
  name: string;
  formData: FormData;
}

/** Opens the system file picker; resolves null when the user cancels. */
export async function pickWorkbook(): Promise<PickedWorkbook | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: XLSX_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const name = asset.name || 'transactions.xlsx';
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    formData.append('file', blob, name);
  } else {
    // React Native's FormData accepts a file descriptor object; the type definitions only know Blob.
    formData.append('file', {
      uri: asset.uri,
      name,
      type: asset.mimeType ?? XLSX_TYPES[0],
    } as unknown as Blob);
  }
  return { name, formData };
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (picked: PickedWorkbook) =>
      api.upload<ImportPreview>('/transactions/import/preview', picked.formData),
  });
}

export function useImportCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportCommitInput) => api.post<ImportResult>('/transactions/import', input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all }),
      ]);
    },
  });
}
