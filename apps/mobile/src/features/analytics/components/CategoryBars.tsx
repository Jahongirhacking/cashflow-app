import { type CategoryBreakdownItem, formatMoney, formatPercent } from '@finance/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CardEmpty } from '@/components/feedback/CardEmpty';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { ChartPie } from 'lucide-react-native';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

/** Ranked categories with proportional bars; colour comes from the fixed categorical order. */
export function CategoryBars({
  items,
  tone,
  onPress,
  max = 5,
}: {
  items: CategoryBreakdownItem[];
  tone: 'income' | 'expense';
  onPress?: (category: string) => void;
  max?: number;
}) {
  const theme = useTheme();
  const t = useT();
  const shown = items.slice(0, max);
  const top = shown[0]?.amount ?? 1;
  if (shown.length === 0) {
    return (
      <CardEmpty
        icon={ChartPie}
        message={tone === 'income' ? t('analytics.noIncome') : t('analytics.noExpenses')}
      />
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {shown.map((item, i) => {
        const color = theme.chart.categorical[i] ?? theme.chart.other;
        return (
          <Pressable
            key={item.category}
            onPress={onPress ? () => onPress(item.category) : undefined}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${item.category} ${formatMoney(item.amount)} ${formatPercent(item.percent, 0)}`}
            style={styles.row}
          >
            <CategoryIcon name={item.category} size={16} color={theme.colors.textSecondary} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.labelRow}>
                <Text variant="caption" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {item.category}
                </Text>
                <Text
                  variant="caption"
                  style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(item.amount)}
                </Text>
                <Text variant="caption" color="textMuted" style={{ width: 34, textAlign: 'right' }}>
                  {formatPercent(item.percent, 0)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.max(2, (item.amount / top) * 100)}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
});
