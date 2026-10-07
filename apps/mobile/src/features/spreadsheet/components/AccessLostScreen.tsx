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
import { useTheme } from '@/theme';

/** Shown instead of app content when the service account can no longer read the user's sheet. */
export function AccessLostScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const auth = useAuth();
  const status = useSpreadsheetStatus();
  const verify = useVerifySpreadsheet();
  const { clearAccessLost } = useSpreadsheetAccess();
  const email = status.data?.serviceAccountEmail ?? 'the Finance service account';

  const retry = () => {
    verify.mutate(undefined, {
      onSuccess: (result) => {
        if (result.connected) {
          clearAccessLost();
          toast.success('Spreadsheet access restored');
        } else {
          toast.error('Still no access. Check the sharing settings and try again.');
        }
      },
      onError: () => toast.error('Could not verify the connection. Please try again.'),
    });
  };

  return (
    <Screen title="Spreadsheet access lost">
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
          Please restore Editor access
        </Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
          Finance can no longer read {auth.user?.spreadsheetName ?? 'your spreadsheet'}. Share it
          again with <Text variant="bodyStrong">{email}</Text> and give it Editor access, or connect
          a different spreadsheet.
        </Text>
        <View style={[styles.actions, { marginTop: theme.spacing.xl }]}>
          <Button title="Try again" onPress={retry} loading={verify.isPending} />
          <Button
            title="Reconnect"
            variant="secondary"
            onPress={() => router.push('/setup/spreadsheet?mode=reconnect')}
          />
          <Button title="Open Settings" variant="ghost" onPress={() => router.push('/settings')} />
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
