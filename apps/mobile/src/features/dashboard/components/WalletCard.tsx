import { formatMoney, formatPercent, PAYMENT_METHODS, type PaymentMethod } from '@finance/shared';
import { Banknote, CreditCard, Landmark, type LucideIcon, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { paymentLabel } from '@/features/transactions/utils';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

const ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  BANK: Landmark,
  OTHER: Wallet,
};

/**
 * "Money now": where the balance sits. Cash and card always get a tile; bank and other only when
 * they hold money. One stacked bar underneath shows the split, so the eye reads the proportion
 * without comparing bar lengths across tiles.
 */
export function WalletCard({
  balances,
  loading,
}: {
  balances: Record<string, number>;
  loading: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const methods = PAYMENT_METHODS.filter(
    (m) => m === 'CASH' || m === 'CARD' || (balances[m] ?? 0) !== 0,
  );
  const total = methods.reduce((s, m) => s + (balances[m] ?? 0), 0);
  const positiveTotal = methods.reduce((s, m) => s + Math.max(0, balances[m] ?? 0), 0);
  const color = (m: PaymentMethod) =>
    m === 'CASH'
      ? theme.chart.income
      : m === 'CARD'
        ? theme.colors.info
        : m === 'BANK'
          ? (theme.chart.categorical[2] ?? theme.chart.other)
          : theme.chart.other;
  const soft = (m: PaymentMethod) =>
    m === 'CASH'
      ? theme.colors.incomeSoft
      : m === 'CARD'
        ? theme.colors.infoSoft
        : theme.colors.surfaceMuted;

  return (
    <Card>
      <SectionHeader
        title={t('dashboard.wallet')}
        subtitle={t('dashboard.walletHint')}
        right={
          loading ? null : (
            <Text
              variant="bodyStrong"
              color={total < 0 ? 'expense' : 'text'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatMoney(total)}
            </Text>
          )
        }
      />
      {loading ? (
        <Skeleton height={76} />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <View style={styles.tiles}>
            {methods.map((m) => {
              const value = balances[m] ?? 0;
              const Icon = ICONS[m];
              const share = positiveTotal > 0 && value > 0 ? (value / positiveTotal) * 100 : 0;
              return (
                <View
                  key={m}
                  accessibilityLabel={`${paymentLabel(m)}: ${formatMoney(value)}`}
                  style={[styles.tile, { backgroundColor: soft(m), borderRadius: theme.radii.md }]}
                >
                  <View style={styles.tileHead}>
                    <View
                      style={[
                        styles.iconWrap,
                        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.full },
                      ]}
                    >
                      <Icon size={16} color={color(m)} />
                    </View>
                    <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                      {paymentLabel(m)}
                    </Text>
                  </View>
                  <Text
                    variant="subheading"
                    color={value < 0 ? 'expense' : 'text'}
                    numberOfLines={1}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatMoney(value)}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {value > 0
                      ? t('dashboard.walletShare', { value: formatPercent(share, 0) })
                      : value < 0
                        ? t('dashboard.walletNegative')
                        : t('dashboard.walletEmpty')}
                  </Text>
                </View>
              );
            })}
          </View>
          {positiveTotal > 0 ? (
            <View
              accessibilityLabel={t('dashboard.walletSplit')}
              style={[styles.split, { backgroundColor: theme.colors.surfaceMuted }]}
            >
              {methods
                .filter((m) => (balances[m] ?? 0) > 0)
                .map((m) => (
                  <View
                    key={m}
                    style={{
                      flexGrow: balances[m] ?? 0,
                      flexBasis: 0,
                      backgroundColor: color(m),
                      borderRadius: 4,
                    }}
                  />
                ))}
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 0, padding: 12, gap: 6 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  // 2px surface gaps between segments; the track colour shows through.
  split: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
});
