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
import { ThemeProvider, useTheme, useThemeMode } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
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
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { isReady } = useThemeMode();
  const auth = useAuth();
  const resolved = auth.status !== 'loading';

  useEffect(() => {
    if (isReady && resolved) SplashScreen.hideAsync().catch(() => undefined);
  }, [isReady, resolved]);

  if (!isReady || auth.status === 'loading') {
    return <FullScreenLoader />;
  }

  if (auth.status === 'error') {
    return (
      <ErrorState
        title="Can't reach Finance"
        message="We couldn't check your session. Make sure the API is running and try again."
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
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}
