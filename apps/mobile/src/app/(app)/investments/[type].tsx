import { formatMoney, INVESTMENT_TYPES, type InvestmentType } from '@finance/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
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
import { investmentTypeLabel, netHint, netLabel } from '@/features/investments/utils';
import { EMPTY_FILTERS, useTransactionsInfinite } from '@/features/transactions/api';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { useTransactionEditor } from '@/features/transactions/TransactionEditorProvider';
import { formatShortDate } from '@/features/transactions/utils';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { useTheme } from '@/theme';

function isInvestmentType(value: string | undefined): value is InvestmentType {
  return INVESTMENT_TYPES.includes(value as InvestmentType);
}

/** One investment type: totals, monthly flows and every transaction in its category. */
export default function InvestmentTypeScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const editor = useTransactionEditor();
  const { type } = useLocalSearchParams<{ type: string }>();
  const valid = isInvestmentType(type);
  const investments = useInvestments();
  const position = valid ? investments.data?.positions.find((p) => p.type === type) : undefined;
  const category = position?.category ?? '';
  // The query key is value-based, so a fresh filters object per render is fine.
  const query = useTransactionsInfinite({ ...EMPTY_FILTERS, category: category || null });
  const transactions = query.data?.pages.flatMap((p) => p.items) ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/investments'));
  const backButton = (
    <Button title={t('inv.allInvestments')} icon={ArrowLeft} variant="ghost" onPress={back} />
  );
  const openCreate = () => editor.open({ mode: 'create', defaults: { category, type: 'EXPENSE' } });

  if (!valid) {
    return (
      <Screen title={t('inv.title')} headerRight={backButton}>
        <ErrorState title={t('inv.notFound')} message={t('inv.notFoundBody')} onRetry={back} />
      </Screen>
    );
  }
  const title = investmentTypeLabel(type, t);
  if (investments.isError) {
    return (
      <Screen title={title} headerRight={backButton}>
        <ErrorState
          message={getUserMessage(investments.error)}
          onRetry={() => void investments.refetch()}
        />
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
      <View style={styles.tiles}>
        <StatTile
          label={t('inv.invested')}
          value={formatMoney(position?.invested ?? 0)}
          tone="expense"
          loading={investments.isPending}
        />
        <StatTile
          label={t('inv.returned')}
          value={formatMoney(position?.returned ?? 0)}
          tone="income"
          loading={investments.isPending}
        />
        <StatTile
          label={t('inv.net')}
          value={netLabel(position?.net ?? 0)}
          hint={position ? netHint(position.net, t) : undefined}
          tone={(position?.net ?? 0) > 0 ? 'income' : (position?.net ?? 0) < 0 ? 'expense' : 'text'}
          loading={investments.isPending}
        />
        <StatTile
          label={t('inv.lastActivity')}
          value={position?.lastDate ? formatShortDate(position.lastDate) : '—'}
          hint={
            position?.firstDate
              ? t('inv.firstActivity', { date: formatShortDate(position.firstDate) })
              : undefined
          }
          loading={investments.isPending}
        />
      </View>
      <Card>
        <SectionHeader title={t('inv.flows')} subtitle={t('inv.last12')} />
        {investments.isPending || !position ? (
          <Skeleton height={180} />
        ) : (
          <InvestmentFlowChart points={position.monthly} height={180} />
        )}
      </Card>
      <Card>
        <SectionHeader title={t('inv.howItWorks')} />
        <Text variant="caption" color="textSecondary">
          {t('inv.howItWorksBody', { category: category || title })}
        </Text>
      </Card>
      <SectionHeader
        title={t('inv.detail.transactions')}
        subtitle={
          position ? t('inv.transactions', { count: position.transactionCount }) : undefined
        }
      />
    </View>
  );

  return (
    <Screen
      title={title}
      subtitle={position ? t('inv.category', { name: position.category }) : undefined}
      headerRight={backButton}
      scroll={false}
      contentStyle={{ flex: 1 }}
    >
      <TransactionList
        transactions={transactions}
        isPending={investments.isPending || query.isPending}
        isError={query.isError}
        errorMessage={query.error ? getUserMessage(query.error) : undefined}
        isFetchingNextPage={query.isFetchingNextPage}
        hasNextPage={Boolean(query.hasNextPage)}
        hasFilters={false}
        onRetry={() => void query.refetch()}
        onLoadMore={() => void query.fetchNextPage()}
        onPressItem={(transaction) => editor.open({ mode: 'edit', transaction })}
        onClearFilters={() => undefined}
        onAdd={openCreate}
        ListHeaderComponent={header}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
