import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { SetupWizard } from '@/features/spreadsheet/components/SetupWizard';
import { useTheme } from '@/theme';

export default function SpreadsheetSetupScreen() {
  const auth = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const reconnect = params.mode === 'reconnect' || Boolean(auth.user?.hasSpreadsheet);

  return (
    <Screen
      title={reconnect ? 'Reconnect your spreadsheet' : 'Connect your spreadsheet'}
      subtitle={auth.user ? `Signed in as ${auth.user.email}` : undefined}
      contentStyle={styles.content}
    >
      <SetupWizard reconnect={reconnect} />
      <View style={[styles.footer, { marginTop: theme.spacing.xl }]}>
        {auth.user?.hasSpreadsheet ? (
          <Button
            title="Cancel"
            variant="ghost"
            size="sm"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          />
        ) : null}
        <Button title="Sign out" variant="ghost" size="sm" onPress={() => void auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 640 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
});
