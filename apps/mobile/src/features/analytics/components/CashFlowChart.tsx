import { formatMoney, type MonthlyCashFlowPoint } from '@finance/shared';
import { BarChart, monthLabel } from '@/components/charts';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export function CashFlowChart({
  points,
  height,
}: {
  points: MonthlyCashFlowPoint[];
  height?: number;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <BarChart
      height={height}
      series={[
        { name: t('chart.income'), color: theme.chart.income },
        { name: t('chart.expenses'), color: theme.chart.expense },
      ]}
      groups={points.map((p) => ({
        label: monthLabel(p.month),
        title: `${monthLabel(p.month)} · ${t('chart.net')} ${formatMoney(p.net)}`,
        values: [p.income, p.expenses],
      }))}
      accessibilityLabel={t('chart.incomeVsExpensesLabel')}
    />
  );
}
