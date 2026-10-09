import { formatMoney, type InvestmentFlowPoint } from '@finance/shared';
import { BarChart, monthLabel } from '@/components/charts';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

/** Money put in vs money taken out per month. */
export function InvestmentFlowChart({
  points,
  height,
}: {
  points: InvestmentFlowPoint[];
  height?: number;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <BarChart
      height={height}
      series={[
        { name: t('inv.invested'), color: theme.chart.expense },
        { name: t('inv.returned'), color: theme.chart.income },
      ]}
      groups={points.map((p) => ({
        label: monthLabel(p.month),
        title: `${monthLabel(p.month)} · ${t('inv.net')} ${formatMoney(p.net)}`,
        values: [p.invested, p.returned],
      }))}
      accessibilityLabel={t('inv.chartLabel')}
    />
  );
}
