import type { ConnectSpreadsheetInput, SpreadsheetInfo, SpreadsheetStatus } from '@finance/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export function fetchSpreadsheetStatus(signal?: AbortSignal): Promise<SpreadsheetStatus> {
  return api.get<SpreadsheetStatus>('/spreadsheets/status', undefined, signal);
}

export function fetchSpreadsheetInfo(signal?: AbortSignal): Promise<SpreadsheetInfo> {
  return api.get<SpreadsheetInfo>('/spreadsheets/info', undefined, signal);
}

export function connectSpreadsheet(
  input: ConnectSpreadsheetInput,
  reconnect = false,
): Promise<SpreadsheetStatus> {
  return api.post<SpreadsheetStatus>(
    reconnect ? '/spreadsheets/reconnect' : '/spreadsheets/connect',
    input,
  );
}

export function verifySpreadsheet(): Promise<SpreadsheetStatus> {
  return api.post<SpreadsheetStatus>('/spreadsheets/verify');
}

export function useSpreadsheetStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.spreadsheet.status,
    queryFn: ({ signal }) => fetchSpreadsheetStatus(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useSpreadsheetInfo(enabled = true) {
  return useQuery({
    queryKey: queryKeys.spreadsheet.info,
    queryFn: ({ signal }) => fetchSpreadsheetInfo(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Keeps the cached current user in sync with the connection result. */
function useApplyStatus() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  return (status: SpreadsheetStatus) => {
    queryClient.setQueryData(queryKeys.spreadsheet.status, status);
    if (auth.user) {
      auth.setUser({
        ...auth.user,
        spreadsheetId: status.spreadsheetId,
        spreadsheetName: status.spreadsheetName,
        spreadsheetVerifiedAt: status.lastVerifiedAt,
        hasSpreadsheet: status.connected,
      });
    }
    if (status.connected) {
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== 'auth' && q.queryKey[0] !== 'spreadsheet',
      });
    }
  };
}

export function useConnectSpreadsheet(reconnect = false) {
  const apply = useApplyStatus();
  return useMutation({
    mutationFn: (input: ConnectSpreadsheetInput) => connectSpreadsheet(input, reconnect),
    onSuccess: apply,
  });
}

export function useVerifySpreadsheet() {
  const apply = useApplyStatus();
  return useMutation({ mutationFn: verifySpreadsheet, onSuccess: apply });
}
