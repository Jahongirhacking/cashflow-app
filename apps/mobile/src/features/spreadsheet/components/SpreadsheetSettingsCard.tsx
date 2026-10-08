import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useSpreadsheetStatus, useVerifySpreadsheet } from '@/features/spreadsheet/api';
import { useSpreadsheetAccess } from '@/features/spreadsheet/SpreadsheetAccessProvider';
import { useTheme } from '@/theme';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ExternalLink, RefreshCw } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function SpreadsheetSettingsCard() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const status = useSpreadsheetStatus();
  const verify = useVerifySpreadsheet();
  const { clearAccessLost } = useSpreadsheetAccess();

  const data = status.data;
  const state = data?.accessState ?? 'NOT_CONNECTED';
  const stateLabel =
    state === 'OK'
      ? 'Connected ✓'
      : state === 'ACCESS_DENIED'
        ? 'Access lost'
        : state === 'NOT_FOUND'
          ? 'Spreadsheet not found'
          : 'Not connected';
  const stateColor =
    state === 'OK' ? 'income' : state === 'NOT_CONNECTED' ? 'textSecondary' : 'expense';

  const openSpreadsheet = () => {
    const url = data?.spreadsheetUrl;

    if (!url) return;

    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(url);
    }
  };

  const onVerify = () =>
    verify.mutate(undefined, {
      onSuccess: (result) => {
        if (result.connected) {
          clearAccessLost();
          toast.success('Connection verified');
        } else {
          toast.error(
            'Finance cannot access the spreadsheet. Restore Editor access and try again.',
          );
        }
      },
      onError: () => toast.error('Could not verify the connection. Please try again.'),
    });

  if (status.isPending) {
    return (
      <Card>
        <Skeleton width="40%" height={16} />
        <Skeleton width="70%" height={14} style={{ marginTop: 12 }} />
      </Card>
    );
  }

  return (
    <Card>
      <Row label="Connection status">
        <Text variant="bodyStrong" color={stateColor}>
          {stateLabel}
        </Text>
      </Row>
      <Row label="Spreadsheet">
        <Text variant="body">{data?.spreadsheetName ?? '—'}</Text>
      </Row>
      <Row label="Last verified">
        <Text variant="body">{formatDateTime(data?.lastVerifiedAt ?? null)}</Text>
      </Row>
      <Row label="Shared with">
        <Text variant="mono" selectable>
          {data?.serviceAccountEmail ?? 'Not configured'}
        </Text>
      </Row>
      <View style={[styles.actions, { marginTop: theme.spacing.lg }]}>
        <Button
          title="Open Spreadsheet"
          variant="secondary"
          size="sm"
          icon={ExternalLink}
          disabled={!data?.spreadsheetUrl}
          onPress={openSpreadsheet}
        />
        <Button
          title="Reconnect Spreadsheet"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/setup/spreadsheet?mode=reconnect')}
        />
        <Button
          title="Verify Connection"
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          loading={verify.isPending}
          onPress={onVerify}
        />
      </View>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { paddingVertical: theme.spacing.sm }]}>
      <Text variant="caption" color="textMuted" style={{ width: 130 }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
