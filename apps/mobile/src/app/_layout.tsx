import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { ErrorState } from '@/components/feedback/StateViews';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { SpreadsheetAccessProvider } from '@/features/spreadsheet/SpreadsheetAccessProvider';
import { queryClient } from '@/lib/query/query-client';
import { I18nProvider, useLocale, useT } from '@/i18n';
import { ThemeProvider, useTheme, useThemeMode } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <AuthProvider>
                  <SpreadsheetAccessProvider>
                    <AppErrorBoundary>
                      <RootNavigator />
                    </AppErrorBoundary>
                  </SpreadsheetAccessProvider>
                </AuthProvider>
              </ToastProvider>
            </QueryClientProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { isReady } = useThemeMode();
  const { isReady: localeReady } = useLocale();
  const t = useT();
  const auth = useAuth();
  const resolved = auth.status !== 'loading';

  useEffect(() => {
    if (isReady && localeReady && resolved) SplashScreen.hideAsync().catch(() => undefined);
  }, [isReady, localeReady, resolved]);

  if (!isReady || !localeReady || auth.status === 'loading') {
    return <FullScreenLoader />;
  }

  if (auth.status === 'error') {
    return (
      <ErrorState
        title={t('auth.cannotReach.title')}
        message={t('auth.cannotReach.body')}
        onRetry={() => void auth.refresh()}
      />
    );
  }

  const isAuthenticated = auth.status === 'authenticated';
  const hasSpreadsheet = Boolean(auth.user?.hasSpreadsheet);

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Protected guard={isAuthenticated && hasSpreadsheet}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="+not-found" options={{ title: t('notFound.title') }} />
      </Stack>
    </>
  );
}
