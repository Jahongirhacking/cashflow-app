import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { observeApiErrors } from '@/lib/api';

interface SpreadsheetAccessContextValue {
  /** True once any request failed because the service account lost access to the sheet. */
  accessLost: boolean;
  clearAccessLost: () => void;
}

const Ctx = createContext<SpreadsheetAccessContextValue | null>(null);

/** Detects "spreadsheet access lost" globally so the shell can show a recovery screen. */
export function SpreadsheetAccessProvider({ children }: { children: ReactNode }) {
  const [accessLost, setAccessLost] = useState(false);

  useEffect(
    () =>
      observeApiErrors((error) => {
        if (error.code === 'SPREADSHEET_ACCESS_DENIED' || error.code === 'SPREADSHEET_NOT_FOUND')
          setAccessLost(true);
      }),
    [],
  );

  const clearAccessLost = useCallback(() => setAccessLost(false), []);
  const value = useMemo(() => ({ accessLost, clearAccessLost }), [accessLost, clearAccessLost]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpreadsheetAccess(): SpreadsheetAccessContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSpreadsheetAccess must be used within SpreadsheetAccessProvider');
  return ctx;
}
