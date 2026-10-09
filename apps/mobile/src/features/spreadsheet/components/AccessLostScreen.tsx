import { useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpreadsheetStatus, useVerifySpreadsheet } from '@/features/spreadsheet/api';
import { useSpreadsheetAccess } from '@/features/spreadsheet/SpreadsheetAccessProvider';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

/** Shown instead of app content when the service account can no longer read the user's sheet. */
export function AccessLostScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const auth = useAuth();
  const status = useSpreadsheetStatus();
  const verify = useVerifySpreadsheet();
  const { clearAccessLost } = useSpreadsheetAccess();
  const email = status.data?.serviceAccountEmail ?? t('sheet.lost.serviceAccount');

  const retry = () => {
    verify.mutate(undefined, {
      onSuccess: (result) => {
        if (result.connected) {
          clearAccessLost();
          toast.success(t('sheet.lost.restored'));
        } else {
          toast.error(t('sheet.lost.still'));
        }
      },
      onError: () => toast.error(t('sheet.verifyError')),
    });
  };

  return (
    <Screen title={t('sheet.lost.title')}>
      <Card padding="lg" style={styles.card}>
        <View
          style={[
            styles.icon,
            { backgroundColor: theme.colors.warningSoft, borderRadius: theme.radii.full },
          ]}
        >
          <ShieldAlert size={22} color={theme.colors.warning} />
        </View>
        <Text variant="heading" style={{ marginTop: theme.spacing.md }}>
          {t('sheet.lost.heading')}
        </Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
          {t('sheet.lost.body', {
            name: auth.user?.spreadsheetName ?? t('sheet.lost.yourSpreadsheet'),
            email,
          })}
        </Text>
        <View style={[styles.actions, { marginTop: theme.spacing.xl }]}>
          <Button title={t('common.tryAgain')} onPress={retry} loading={verify.isPending} />
          <Button
            title={t('sheet.lost.reconnect')}
            variant="secondary"
            onPress={() => router.push('/setup/spreadsheet?mode=reconnect')}
          />
          <Button
            title={t('sheet.lost.openSettings')}
            variant="ghost"
            onPress={() => router.push('/settings')}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { maxWidth: 560 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
