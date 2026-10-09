import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useSpreadsheetStatus, useVerifySpreadsheet } from '@/features/spreadsheet/api';
import { useSpreadsheetAccess } from '@/features/spreadsheet/SpreadsheetAccessProvider';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ExternalLink, RefreshCw } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

function formatDateTime(iso: string | null, never: string): string {
  if (!iso) return never;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function SpreadsheetSettingsCard() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const status = useSpreadsheetStatus();
  const verify = useVerifySpreadsheet();
  const { clearAccessLost } = useSpreadsheetAccess();

  const data = status.data;
  const state = data?.accessState ?? 'NOT_CONNECTED';
  const stateLabel =
    state === 'OK'
      ? t('sheet.connected')
      : state === 'ACCESS_DENIED'
        ? t('sheet.accessLost')
        : state === 'NOT_FOUND'
          ? t('sheet.notFound')
          : t('sheet.notConnected');
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
          toast.success(t('sheet.verified'));
        } else {
          toast.error(
            'Finance cannot access the spreadsheet. Restore Editor access and try again.',
          );
        }
      },
      onError: () => toast.error(t('sheet.verifyError')),
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
      <Row label={t('sheet.status')}>
        <Text variant="bodyStrong" color={stateColor}>
          {stateLabel}
        </Text>
      </Row>
      <Row label={t('sheet.name')}>
        <Text variant="body">{data?.spreadsheetName ?? '—'}</Text>
      </Row>
      <Row label={t('sheet.lastVerified')}>
        <Text variant="body">
          {formatDateTime(data?.lastVerifiedAt ?? null, t('common.never'))}
        </Text>
      </Row>
      <Row label={t('sheet.sharedWith')}>
        <Text variant="mono" selectable>
          {data?.serviceAccountEmail ?? t('sheet.notConfigured')}
        </Text>
      </Row>
      <View style={[styles.actions, { marginTop: theme.spacing.lg }]}>
        <Button
          title={t('sheet.open')}
          variant="secondary"
          size="sm"
          icon={ExternalLink}
          disabled={!data?.spreadsheetUrl}
          onPress={openSpreadsheet}
        />
        <Button
          title={t('sheet.reconnect')}
          variant="secondary"
          size="sm"
          onPress={() => router.push('/setup/spreadsheet?mode=reconnect')}
        />
        <Button
          title={t('sheet.verify')}
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
