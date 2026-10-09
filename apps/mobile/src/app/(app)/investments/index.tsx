import { formatMoney, INVESTMENT_TYPES, type InvestmentPosition } from '@finance/shared';
import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { CardEmpty } from '@/components/feedback/CardEmpty';
import { ErrorState } from '@/components/feedback/StateViews';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { useInvestments } from '@/features/investments/api';
import { InvestmentFlowChart } from '@/features/investments/components/InvestmentFlowChart';
import {
  INVESTMENT_ICONS,
  investmentTypeLabel,
  netHint,
  netLabel,
} from '@/features/investments/utils';
import { formatShortDate } from '@/features/transactions/utils';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { useTheme } from '@/theme';

export default function InvestmentsScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const investments = useInvestments();
  const data = investments.data;
  const summary = data?.summary;
  const hasActivity = (summary?.transactionCount ?? 0) > 0;

  if (investments.isError) {
    return (
      <Screen title={t('inv.title')}>
        <ErrorState
          message={getUserMessage(investments.error)}
          onRetry={() => void investments.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('inv.title')} subtitle={t('inv.subtitle')}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={styles.tiles}>
          <StatTile
            label={t('inv.invested')}
            value={formatMoney(summary?.invested ?? 0)}
            hint={t('inv.transactions', { count: summary?.transactionCount ?? 0 })}
            tone="expense"
            loading={investments.isPending}
          />
          <StatTile
            label={t('inv.returned')}
            value={formatMoney(summary?.returned ?? 0)}
            tone="income"
            loading={investments.isPending}
          />
          <StatTile
            label={t('inv.net')}
            value={netLabel(summary?.net ?? 0)}
            hint={summary ? netHint(summary.net, t) : undefined}
            tone={(summary?.net ?? 0) > 0 ? 'income' : (summary?.net ?? 0) < 0 ? 'expense' : 'text'}
            loading={investments.isPending}
          />
          <StatTile
            label={t('inv.activeTypes')}
            value={`${summary?.activeTypes ?? 0} / ${INVESTMENT_TYPES.length}`}
            loading={investments.isPending}
          />
        </View>

        <Card>
          <SectionHeader title={t('inv.flows')} subtitle={t('inv.last12')} />
          {investments.isPending ? (
            <Skeleton height={200} />
          ) : hasActivity && data ? (
            <InvestmentFlowChart points={data.monthly} />
          ) : (
            <CardEmpty
              icon={TrendingUp}
              message={t('inv.emptyBody')}
              action={
                <Button
                  title={t('inv.goTransactions')}
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/transactions')}
                />
              }
            />
          )}
        </Card>

        <Card padding="none">
          <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
            <SectionHeader title={t('inv.positions')} />
          </View>
          {investments.isPending ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton height={18} />
              <Skeleton height={18} width="70%" />
              <Skeleton height={18} width="80%" />
            </View>
          ) : (
            data?.positions.map((position, index) => (
              <PositionRow
                key={position.type}
                position={position}
                first={index === 0}
                onPress={() => router.push(`/investments/${position.type}`)}
              />
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}

function PositionRow({
  position,
  first,
  onPress,
}: {
  position: InvestmentPosition;
  first: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { hovered, pressed, handlers } = useInteractionState();
  const Icon = INVESTMENT_ICONS[position.type];
  const active = position.transactionCount > 0;
  const label = investmentTypeLabel(position.type, t);
  return (
    <Pressable
      {...handlers}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${t('inv.net')} ${netLabel(position.net)}`}
      style={[
        styles.row,
        first ? null : { borderTopWidth: 1, borderTopColor: theme.colors.border },
        hovered || pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.full },
        ]}
      >
        <Icon size={18} color={active ? theme.colors.text : theme.colors.textMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {active
            ? `${t('inv.invested')} ${formatMoney(position.invested)} · ${t('inv.returned')} ${formatMoney(position.returned)}`
            : t('inv.noActivity')}
        </Text>
        {position.lastDate ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {t('inv.lastActivity')}: {formatShortDate(position.lastDate)} ·{' '}
            {t('inv.transactions', { count: position.transactionCount })}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          variant="bodyStrong"
          color={position.net > 0 ? 'income' : position.net < 0 ? 'expense' : 'text'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {netLabel(position.net)}
        </Text>
        {active ? (
          <Text variant="caption" color="textMuted">
            {netHint(position.net, t)}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
