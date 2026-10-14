import { buildSpreadsheetUrl } from '@finance/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConnectSpreadsheet } from '@/features/spreadsheet/api';
import { SetupWizard } from '@/features/spreadsheet/components/SetupWizard';
import { connectionStore } from '@/features/spreadsheet/connection-store';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export default function SpreadsheetSetupScreen() {
  const auth = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ mode?: string }>();
  const reconnect = params.mode === 'reconnect' || Boolean(auth.user?.hasSpreadsheet);
  const connect = useConnectSpreadsheet(false);
  // The device remembers the last connected spreadsheet: after a fresh sign-in (e.g. the server lost
  // its user list on a redeploy) reconnect it silently instead of showing the wizard again.
  const [restoring, setRestoring] = useState(!reconnect);
  useEffect(() => {
    if (reconnect) return;
    let cancelled = false;
    (async () => {
      const saved = auth.user ? await connectionStore.load(auth.user.id) : null;
      if (!saved || cancelled) {
        setRestoring(false);
        return;
      }
      try {
        const status = await connect.mutateAsync({
          spreadsheetUrl: buildSpreadsheetUrl(saved.spreadsheetId),
        });
        if (!cancelled && status.connected) {
          // Let the auth state (hasSpreadsheet) propagate so the protected "/" route accepts us.
          await new Promise((resolve) => setTimeout(resolve, 400));
          if (!cancelled) router.replace('/');
        }
      } catch {
        // fall through to the wizard; the saved id may no longer be accessible
      }
      if (!cancelled) setRestoring(false);
    })().catch(() => setRestoring(false));
    return () => {
      cancelled = true;
    };
    // Run once per visit of the setup screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (restoring) return <FullScreenLoader label={t('setup.reconnecting')} />;

  return (
    <Screen
      title={reconnect ? t('setup.reconnectTitle') : t('setup.title')}
      subtitle={auth.user ? t('setup.signedInAs', { email: auth.user.email }) : undefined}
      contentStyle={styles.content}
    >
      <SetupWizard reconnect={reconnect} />
      <View style={[styles.footer, { marginTop: theme.spacing.xl }]}>
        {auth.user?.hasSpreadsheet ? (
          <Button
            title={t('common.cancel')}
            variant="ghost"
            size="sm"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          />
        ) : null}
        <Button
          title={t('common.signOut')}
          variant="ghost"
          size="sm"
          onPress={() => void auth.signOut()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 640 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
});
