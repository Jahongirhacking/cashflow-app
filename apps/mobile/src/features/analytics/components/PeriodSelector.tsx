import { ANALYTICS_PERIODS, type AnalyticsPeriod } from '@finance/shared';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '@/components/ui/Chip';
import { useT } from '@/i18n';
import { PERIOD_KEYS } from '../api';

export function PeriodSelector({
  value,
  onChange,
  options = ANALYTICS_PERIODS,
}: {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
  options?: readonly AnalyticsPeriod[];
}) {
  const t = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t('period.label')}
    >
      {options.map((p) => (
        <Chip
          key={p}
          label={t(PERIOD_KEYS[p])}
          selected={value === p}
          onPress={() => onChange(p)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 6 } });
