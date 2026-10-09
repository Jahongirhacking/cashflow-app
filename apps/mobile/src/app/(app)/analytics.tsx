import {
  type AnalyticsPeriod,
  formatCompactNumber,
  formatMoney,
  formatPercent,
} from '@finance/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DonutChart, LineChart } from '@/components/charts';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import {
  monthsForPeriod,
  PERIOD_KEYS,
  useAnalyticsOverview,
  useCategoryBreakdown,
  useFixedVariable,
  useMonthlyCashFlow,
  useSpendingTrend,
} from '@/features/analytics/api';
import { insightText } from '@/features/analytics/insights';
import { useT } from '@/i18n';
import { CashFlowChart } from '@/features/analytics/components/CashFlowChart';
import { CategoryBars } from '@/features/analytics/components/CategoryBars';
import { PeriodSelector } from '@/features/analytics/components/PeriodSelector';
import { formatShortDate } from '@/features/transactions/utils';
import { useRecurringSchedule } from '@/features/recurring/api';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getUserMessage } from '@/lib/api';
import { useTheme } from '@/theme';
import { ChartPie } from 'lucide-react-native';

export default function AnalyticsScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const { isDesktop } = useBreakpoint();
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const overview = useAnalyticsOverview(period);
  const monthly = useMonthlyCashFlow(monthsForPeriod(period));
  const expenseCats = useCategoryBreakdown(period, 'EXPENSE');
  const fixedVariable = useFixedVariable(period);
  const trend = useSpendingTrend(period);
  const schedule = useRecurringSchedule(new Date().toISOString().slice(0, 7));

  const o = overview.data;
  const sign = (n: number | null) =>
    n === null ? '—' : t('dashboard.vsPrevious', { value: `${n > 0 ? '+' : ''}${n.toFixed(0)}` });

  if (overview.isError) {
    return (
      <Screen title={t('analytics.title')}>
        <ErrorState
          message={getUserMessage(overview.error)}
          onRetry={() => void overview.refetch()}
        />
      </Screen>
    );
  }

  const empty = o && o.summary.transactionCount === 0 && o.previous.transactionCount === 0;

  return (
    <Screen title={t('analytics.title')} subtitle={t(PERIOD_KEYS[period])}>
      <View style={{ gap: theme.spacing.lg }}>
        <PeriodSelector value={period} onChange={setPeriod} />

        {empty ? (
          <Card padding="lg">
            <EmptyState
              icon={ChartPie}
              title={t('analytics.emptyTitle')}
              description={t('analytics.emptyBody')}
              actionLabel={t('analytics.goTransactions')}
              onAction={() => router.push('/transactions')}
            />
          </Card>
        ) : null}

        <View style={styles.tiles}>
          <StatTile
            label={t('common.income')}
            value={formatMoney(o?.summary.income ?? 0)}
            hint={sign(o?.incomeChangePercent ?? null)}
            tone="income"
            loading={overview.isPending}
          />
          <StatTile
            label={t('common.expenses')}
            value={formatMoney(o?.summary.expenses ?? 0)}
            hint={sign(o?.expenseChangePercent ?? null)}
            tone="expense"
            loading={overview.isPending}
          />
          <StatTile
            label={t('common.savings')}
            value={formatMoney(o?.summary.savings ?? 0)}
            hint={t('dashboard.savingsRate', { value: formatPercent(o?.summary.savingsRate ?? 0) })}
            tone={(o?.summary.savings ?? 0) >= 0 ? 'text' : 'expense'}
            loading={overview.isPending}
          />
          <StatTile
            label={t('analytics.avgDaily')}
            value={formatMoney(o?.averageDailySpending ?? 0)}
            hint={t('analytics.transactions', { count: o?.summary.transactionCount ?? 0 })}
            loading={overview.isPending}
          />
        </View>

        <Card>
          <SectionHeader
            title={t('dashboard.incomeVsExpenses')}
            subtitle={t('analytics.monthlyCashFlow')}
          />
          {monthly.isPending ? (
            <Skeleton height={200} />
          ) : monthly.data ? (
            <CashFlowChart points={monthly.data} />
          ) : null}
        </Card>

        <View style={[styles.grid, isDesktop ? styles.gridDesktop : null]}>
          <Card style={isDesktop ? styles.gridItem : null}>
            <SectionHeader
              title={t('analytics.byCategory')}
              subtitle={expenseCats.data ? formatMoney(expenseCats.data.total) : undefined}
            />
            {expenseCats.isPending ? (
              <Skeleton height={160} />
            ) : expenseCats.data && expenseCats.data.items.length > 0 ? (
              <DonutChart
                slices={toSlices(
                  expenseCats.data.items,
                  theme.chart.categorical,
                  theme.chart.other,
                  t('common.other'),
                )}
                centerLabel={t('analytics.total')}
                centerValue={`${formatCompactNumber(expenseCats.data.total)} so'm`}
                onSelect={(category) =>
                  router.push({ pathname: '/transactions', params: { category } })
                }
              />
            ) : (
              <Text variant="caption" color="textMuted">
                {t('analytics.noExpenses')}
              </Text>
            )}
          </Card>

          <Card style={isDesktop ? styles.gridItem : null}>
            <SectionHeader
              title={t('analytics.fixedVsVariable')}
              subtitle={
                fixedVariable.data
                  ? t('analytics.fixedPct', {
                      value: formatPercent(fixedVariable.data.fixedPercent, 0),
                    })
                  : undefined
              }
            />
            {fixedVariable.isPending ? (
              <Skeleton height={160} />
            ) : fixedVariable.data && fixedVariable.data.fixed + fixedVariable.data.variable > 0 ? (
              <View style={{ gap: theme.spacing.md }}>
                <DonutChart
                  size={120}
                  slices={[
                    {
                      label: t('analytics.fixed'),
                      value: fixedVariable.data.fixed,
                      color: theme.chart.categorical[0] ?? theme.chart.other,
                    },
                    {
                      label: t('analytics.variable'),
                      value: fixedVariable.data.variable,
                      color: theme.chart.categorical[1] ?? theme.chart.other,
                    },
                  ]}
                  centerLabel={t('analytics.fixed')}
                  centerValue={formatPercent(fixedVariable.data.fixedPercent, 0)}
                />
                <Text variant="caption" color="textMuted">
                  {t('analytics.fixedHint')}
                </Text>
              </View>
            ) : (
              <Text variant="caption" color="textMuted">
                {t('analytics.noExpenses')}
              </Text>
            )}
          </Card>
        </View>

        <Card>
          <SectionHeader
            title={t('analytics.trend')}
            subtitle={
              trend.data
                ? t('analytics.trendSubtitle', { amount: formatMoney(trend.data.averageDaily) })
                : undefined
            }
          />
          {trend.isPending ? (
            <Skeleton height={180} />
          ) : trend.data && trend.data.points.length > 0 ? (
            <LineChart
              color={theme.chart.expense}
              points={trend.data.points.map((p) => ({
                x: p.date,
                y: p.amount,
                title: formatShortDate(p.date),
              }))}
              xLabels={pickLabels(trend.data.points.map((p) => p.date))}
              accessibilityLabel={t('chart.dailySpending')}
            />
          ) : (
            <Text variant="caption" color="textMuted">
              {t('analytics.noSpending')}
            </Text>
          )}
        </Card>

        <View style={[styles.grid, isDesktop ? styles.gridDesktop : null]}>
          <Card style={isDesktop ? styles.gridItem : null}>
            <SectionHeader title={t('analytics.topIncome')} />
            {overview.isPending ? (
              <Skeleton height={100} />
            ) : (
              <CategoryBars
                items={o?.topIncomeCategories ?? []}
                tone="income"
                onPress={(category) =>
                  router.push({ pathname: '/transactions', params: { category } })
                }
              />
            )}
          </Card>
          <Card style={isDesktop ? styles.gridItem : null}>
            <SectionHeader
              title={t('analytics.recurring')}
              subtitle={t('analytics.thisMonth')}
              right={
                <Text variant="caption" color="info" onPress={() => router.push('/recurring')}>
                  {t('common.manage')}
                </Text>
              }
            />
            {schedule.isPending ? (
              <Skeleton height={100} />
            ) : (
              <View style={{ gap: 8 }}>
                {(schedule.data?.occurrences ?? [])
                  .filter((x) => x.type === 'EXPENSE')
                  .slice(0, 6)
                  .map((x) => (
                    <View key={`${x.ruleId}-${x.dueDate}`} style={styles.recRow}>
                      <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                        {x.name}
                      </Text>
                      <Text
                        variant="caption"
                        color={
                          x.status === 'paid'
                            ? 'income'
                            : x.status === 'overdue'
                              ? 'expense'
                              : 'textSecondary'
                        }
                      >
                        {t(`common.${x.status}`)}
                      </Text>
                      <Text
                        variant="caption"
                        style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}
                      >
                        {formatMoney(x.amount)}
                      </Text>
                    </View>
                  ))}
                {(schedule.data?.occurrences ?? []).filter((x) => x.type === 'EXPENSE').length ===
                0 ? (
                  <Text variant="caption" color="textMuted">
                    {t('analytics.noRecurring')}
                  </Text>
                ) : null}
              </View>
            )}
          </Card>
        </View>

        {o && o.insights.length > 0 ? (
          <Card>
            <SectionHeader title={t('dashboard.insights')} />
            <View style={{ gap: 8 }}>
              {o.insights.map((i) => (
                <View key={i.id} style={styles.insight}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i.tone === 'positive'
                            ? theme.colors.income
                            : i.tone === 'warning'
                              ? theme.colors.warning
                              : theme.colors.textMuted,
                      },
                    ]}
                  />
                  <Text variant="body" style={{ flex: 1 }}>
                    {insightText(i, t)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

export function toSlices(
  items: { category: string; amount: number }[],
  palette: string[],
  other: string,
  otherLabel: string,
  max = 6,
) {
  const head = items.slice(0, max);
  const rest = items.slice(max).reduce((s, i) => s + i.amount, 0);
  const slices = head.map((i, idx) => ({
    label: i.category,
    value: i.amount,
    color: palette[idx] ?? other,
  }));
  if (rest > 0) slices.push({ label: otherLabel, value: rest, color: other });
  return slices;
}

function pickLabels(dates: string[]): { x: string; label: string }[] {
  if (dates.length === 0) return [];
  const step = Math.max(1, Math.ceil(dates.length / 6));
  return dates
    .filter((_, i) => i % step === 0 || i === dates.length - 1)
    .map((d) => ({ x: d, label: `${Number(d.slice(8, 10))}` }));
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grid: { gap: 16 },
  gridDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  gridItem: { flex: 1, minWidth: 0 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
});
