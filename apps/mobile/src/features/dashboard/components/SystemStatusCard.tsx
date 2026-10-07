import { StyleSheet, View } from 'react-native';
import { ErrorState } from '@/components/feedback/StateViews';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useHealth } from '@/features/health/api';
import { getUserMessage } from '@/lib/api/errors';
import { env } from '@/lib/env';
import { useTheme } from '@/theme';

/** Proves the client ↔ API ↔ configuration pipeline works. Replaced by real widgets in later phases. */
export function SystemStatusCard() {
  const theme = useTheme();
  const health = useHealth();

  return (
    <Card>
      <View style={styles.titleRow}>
        <Text variant="label" color="textMuted">
          API connection
        </Text>
        <StatusDot state={health.isPending ? 'pending' : health.isError ? 'error' : 'ok'} />
      </View>

      {health.isPending ? (
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} />
        </View>
      ) : health.isError ? (
        <ErrorState
          title="API unreachable"
          message={`${getUserMessage(health.error)} (${env.apiUrl})`}
          onRetry={() => void health.refetch()}
          retrying={health.isFetching}
        />
      ) : (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
          <Text variant="subheading">Connected</Text>
          <Text variant="caption" color="textSecondary">
            {env.apiUrl} · v{health.data.version} · {health.data.environment}
          </Text>
        </View>
      )}
    </Card>
  );
}

function StatusDot({ state }: { state: 'pending' | 'ok' | 'error' }) {
  const theme = useTheme();
  const color =
    state === 'ok'
      ? theme.colors.income
      : state === 'error'
        ? theme.colors.expense
        : theme.colors.textMuted;
  return (
    <View style={[styles.dot, { backgroundColor: color }]} accessibilityLabel={`status ${state}`} />
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
