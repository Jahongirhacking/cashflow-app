import { type AnalyticsPeriod, currentMonthKey, formatMoney, formatPercent } from '@finance/shared';
import { useRouter } from 'expo-router';
import { Inbox, Lightbulb, Plus, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CardEmpty } from '@/components/feedback/CardEmpty';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import {
  monthsForPeriod,
  useAnalyticsOverview,
  useMonthlyCashFlow,
} from '@/features/analytics/api';
import { CashFlowChart } from '@/features/analytics/components/CashFlowChart';
import { CategoryBars } from '@/features/analytics/components/CategoryBars';
import { PeriodSelector } from '@/features/analytics/components/PeriodSelector';
import { useAuth } from '@/features/auth/AuthProvider';
import { FixedExpensesTodo } from '@/features/dashboard/components/FixedExpensesTodo';
import { PlanningCard } from '@/features/dashboard/components/PlanningCard';
import { WalletCard } from '@/features/dashboard/components/WalletCard';
import { useInvestments } from '@/features/investments/api';
import { netHint, netLabel } from '@/features/investments/utils';
import { EMPTY_FILTERS, useTransactionsInfinite } from '@/features/transactions/api';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { useTransactionEditor } from '@/features/transactions/TransactionEditorProvider';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { insightText } from '@/features/analytics/insights';
import { type Translate, useT } from '@/i18n';
import { useTheme } from '@/theme';

const DASHBOARD_PERIODS: AnalyticsPeriod[] = ['month', 'last-month', '3m', '6m', '12m'];

/** Compact grid: every row stretches its cards to equal height and empty cards show an icon placeholder. */
export default function DashboardScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const editor = useTransactionEditor();
  const { isDesktop, isMobile } = useBreakpoint();
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const overview = useAnalyticsOverview(period);
  const monthly = useMonthlyCashFlow(monthsForPeriod(period));
  const recent = useTransactionsInfinite(EMPTY_FILTERS);
  const investments = useInvestments();
  const month = currentMonthKey();
  const o = overview.data;
  const recentItems = recent.data?.pages[0]?.items.slice(0, 5) ?? [];
  const firstName = auth.user?.name.split(' ')[0] ?? '';
  const gap = theme.spacing.md;
  const link = (label: string, href: string) => (
    <Text variant="caption" color="info" onPress={() => router.push(href)} accessibilityRole="link">
      {label}
    </Text>
  );

  return (
    <Screen
      title={firstName ? t('dashboard.hi', { name: firstName }) : t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
      headerRight={
        !isMobile ? (
          <Button title={t('tx.add')} icon={Plus} onPress={() => editor.open({ mode: 'create' })} />
        ) : undefined
      }
    >
      <View style={{ gap }}>
        <PeriodSelector value={period} onChange={setPeriod} options={DASHBOARD_PERIODS} />

        <View style={[styles.tiles, { gap }]}>
          <StatTile
            label={t('dashboard.totalBalance')}
            value={formatMoney(o?.totalBalance ?? 0)}
            hint={t('dashboard.allTime')}
            tone={(o?.totalBalance ?? 0) < 0 ? 'expense' : 'text'}
          />
          <StatTile
            label={t('common.income')}
            value={formatMoney(o?.summary.income ?? 0)}
            hint={change(o?.incomeChangePercent, t)}
            tone="income"
            loading={overview.isPending}
          />
          <StatTile
            label={t('common.expenses')}
            value={formatMoney(o?.summary.expenses ?? 0)}
            hint={change(o?.expenseChangePercent, t)}
            tone="expense"
            loading={overview.isPending}
          />
          <StatTile
            label={t('common.savings')}
            value={formatMoney(o?.summary.savings ?? 0)}
            hint={t('dashboard.savingsRate', { value: formatPercent(o?.summary.savingsRate ?? 0) })}
            loading={overview.isPending}
            tone={(o?.summary.savings ?? 0) < 0 ? 'expense' : 'text'}
          />
        </View>

        {/* Money now: balance per payment method */}
        <WalletCard balances={o?.balanceByPaymentMethod ?? {}} loading={overview.isPending} />

        {/* Row 1: cash-flow chart + top categories */}
        <View style={[styles.row, isDesktop ? styles.rowDesktop : null, { gap }]}>
          <Card style={[isDesktop ? [styles.cell, { flex: 3 }] : null]}>
            <SectionHeader
              title={t('dashboard.incomeVsExpenses')}
              subtitle={t('dashboard.byMonth')}
              right={link(t('nav.analytics'), '/analytics')}
            />
            {monthly.isPending ? (
              <Skeleton height={180} />
            ) : monthly.data ? (
              <CashFlowChart points={monthly.data} height={180} />
            ) : null}
          </Card>
          <Card style={[isDesktop ? [styles.cell, { flex: 2 }] : null]}>
            <SectionHeader
              title={t('dashboard.topExpenses')}
              right={link(t('common.all'), '/transactions')}
            />
            {overview.isPending ? (
              <Skeleton height={80} />
            ) : (
              <CategoryBars
                items={o?.topExpenseCategories ?? []}
                tone="expense"
                max={4}
                onPress={(category) =>
                  router.push({ pathname: '/transactions', params: { category } })
                }
              />
            )}
            <View style={{ height: gap }} />
            <SectionHeader title={t('dashboard.topIncome')} />
            {overview.isPending ? (
              <Skeleton height={60} />
            ) : (
              <CategoryBars
                items={o?.topIncomeCategories ?? []}
                tone="income"
                max={3}
                onPress={(category) =>
                  router.push({ pathname: '/transactions', params: { category } })
                }
              />
            )}
          </Card>
        </View>

        {/* Row 2: to-do + recent transactions | monthly plan */}
        <View style={[styles.row, isDesktop ? styles.rowDesktop : null, { gap }]}>
          <View style={[isDesktop ? styles.cell : null, { gap }]}>
            <FixedExpensesTodo month={month} />
            <Card style={isDesktop ? { flex: 1 } : null} padding="sm">
              <View style={{ paddingHorizontal: 6, paddingTop: 6 }}>
                <SectionHeader
                  title={t('dashboard.recent')}
                  right={link(t('common.seeAll'), '/transactions')}
                />
              </View>
              {recent.isPending ? (
                <View style={{ gap: 10, padding: 6 }}>
                  <Skeleton height={18} />
                  <Skeleton height={18} width="80%" />
                </View>
              ) : recentItems.length === 0 ? (
                <CardEmpty
                  icon={Inbox}
                  message={t('dashboard.noTransactions')}
                  action={
                    <Button
                      title={t('tx.add')}
                      size="sm"
                      variant="secondary"
                      onPress={() => editor.open({ mode: 'create' })}
                    />
                  }
                />
              ) : (
                recentItems.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    onPress={(transaction) => editor.open({ mode: 'edit', transaction })}
                  />
                ))
              )}
            </Card>
          </View>
          <View style={isDesktop ? styles.cell : null}>
            <PlanningCard month={month} />
          </View>
        </View>

        {/* Row 3: investments | insights */}
        <View style={[styles.row, isDesktop ? styles.rowDesktop : null, { gap }]}>
          <Card style={isDesktop ? styles.cell : null}>
            <SectionHeader
              title={t('dashboard.investments')}
              right={link(t('common.manage'), '/investments')}
            />
            {investments.isPending ? (
              <Skeleton height={60} />
            ) : investments.data && investments.data.summary.transactionCount > 0 ? (
              <View style={{ gap: 6 }}>
                <Row
                  label={t('inv.invested')}
                  value={formatMoney(investments.data.summary.invested)}
                />
                <Row
                  label={t('inv.returned')}
                  value={formatMoney(investments.data.summary.returned)}
                />
                <Row
                  label={t('inv.net')}
                  value={`${netLabel(investments.data.summary.net)} · ${netHint(investments.data.summary.net, t)}`}
                  tone={
                    investments.data.summary.net > 0
                      ? 'income'
                      : investments.data.summary.net < 0
                        ? 'expense'
                        : undefined
                  }
                />
              </View>
            ) : (
              <CardEmpty
                icon={TrendingUp}
                message={t('dashboard.noInvestments')}
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
          <Card style={isDesktop ? styles.cell : null}>
            <SectionHeader title={t('dashboard.insights')} />
            {overview.isPending ? (
              <Skeleton height={60} />
            ) : o && o.insights.length > 0 ? (
              <View style={{ gap: 6 }}>
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
                    <Text variant="caption" style={{ flex: 1 }}>
                      {insightText(i, t)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <CardEmpty icon={Lightbulb} message={t('dashboard.noInsights')} />
            )}
          </Card>
        </View>
      </View>
    </Screen>
  );
}

function change(value: number | null | undefined, t: Translate): string {
  if (value === null || value === undefined) return t('dashboard.vsPreviousNa');
  return t('dashboard.vsPrevious', { value: `${value > 0 ? '+' : ''}${value.toFixed(0)}` });
}

function Row({
  label,
  value,
  tone = 'text',
}: {
  label: string;
  value: string;
  tone?: 'text' | 'income' | 'expense';
}) {
  return (
    <View style={styles.kv}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodyStrong" color={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  row: {},
  rowDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { flex: 1, minWidth: 0 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
