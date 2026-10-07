import type { CurrentUser } from '@finance/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { configureApiClient } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';
import { exchangeNativeCode, fetchCurrentUser, logoutRequest } from './api';
import { startGoogleSignIn } from './sign-in';
import { tokenStore } from './token-store';

export type AuthStatus = 'loading' | 'error' | 'unauthenticated' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  /** Error message when the session could not be checked (network/server), else null. */
  lastSignInError: string | null;
  signInWithGoogle: () => Promise<void>;
  completeNativeSignIn: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<CurrentUser | null>;
  setSignInError: (reason: string | null) => void;
  /** Update the cached user after e.g. connecting a spreadsheet. */
  setUser: (user: CurrentUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [signInError, setSignInErrorState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    queryClient.setQueryData(queryKeys.auth.me, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }, [queryClient]);

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenStore.get(),
      onUnauthorized: () => {
        void clearSession();
      },
    });
  }, [clearSession]);

  const setSignInError = useCallback((reason: string | null) => setSignInErrorState(reason), []);

  const completeNativeSignIn = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        const session = await exchangeNativeCode(code);
        if (session.accessToken) await tokenStore.set(session.accessToken);
        queryClient.setQueryData(queryKeys.auth.me, session.user);
        setSignInErrorState(null);
      } catch {
        setSignInErrorState('server_error');
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const signInWithGoogle = useCallback(async () => {
    setSignInErrorState(null);
    setBusy(true);
    try {
      const result = await startGoogleSignIn();
      if (result.kind === 'code') {
        await completeNativeSignIn(result.code);
      } else if (result.kind === 'error') {
        setSignInErrorState(result.reason);
      }
    } catch {
      setSignInErrorState('server_error');
    } finally {
      setBusy(false);
    }
  }, [completeNativeSignIn]);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // The local session is cleared regardless; the cookie expires on its own.
    }
    await clearSession();
  }, [clearSession]);

  const refresh = useCallback(async () => {
    const result = await query.refetch();
    return result.data ?? null;
  }, [query]);

  const setUser = useCallback(
    (user: CurrentUser) => queryClient.setQueryData(queryKeys.auth.me, user),
    [queryClient],
  );

  const status: AuthStatus =
    query.isPending || busy
      ? 'loading'
      : query.isError
        ? 'error'
        : query.data
          ? 'authenticated'
          : 'unauthenticated';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: query.data ?? null,
      lastSignInError: signInError,
      signInWithGoogle,
      completeNativeSignIn,
      signOut,
      refresh,
      setSignInError,
      setUser,
    }),
    [
      status,
      query.data,
      signInError,
      signInWithGoogle,
      completeNativeSignIn,
      signOut,
      refresh,
      setSignInError,
      setUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
