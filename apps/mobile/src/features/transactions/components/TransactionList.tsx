import { formatMoney, type Transaction } from '@finance/shared';
import { Inbox, SearchX } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, type ListRenderItem, StyleSheet, View } from 'react-native';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Checkbox } from '@/components/ui/Checkbox';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { formatDateLabel } from '../utils';
import { TransactionRow } from './TransactionRow';

type Item =
  | { kind: 'header'; key: string; date: string; expenses: number; income: number; ids: string[] }
  | { kind: 'tx'; key: string; tx: Transaction; first: boolean; last: boolean };

export interface TransactionSelection {
  /** Ids currently selected. */
  ids: ReadonlySet<string>;
  /** True while checkboxes are shown (even with nothing selected yet). */
  active: boolean;
  onToggle: (transaction: Transaction) => void;
  onToggleMany: (ids: string[], selected: boolean) => void;
  onStart: (transaction: Transaction) => void;
}

export interface TransactionListProps {
  transactions: Transaction[];
  isPending: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  hasFilters: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onLoadMore: () => void;
  onPressItem: (transaction: Transaction) => void;
  onClearFilters: () => void;
  onAdd: () => void;
  ListHeaderComponent?: React.ReactElement;
  selection?: TransactionSelection;
  /** Space kept free at the bottom (for a floating action bar). */
  bottomInset?: number;
}

/** One header per day followed by its rows; `first`/`last` let the rows draw the day card's corners. */
function groupByDate(transactions: Transaction[]): Item[] {
  const items: Item[] = [];
  let current: Extract<Item, { kind: 'header' }> | null = null;
  let previous: Extract<Item, { kind: 'tx' }> | null = null;
  for (const tx of transactions) {
    if (!current || current.date !== tx.date) {
      if (previous) previous.last = true;
      current = {
        kind: 'header',
        key: `h-${tx.date}`,
        date: tx.date,
        expenses: 0,
        income: 0,
        ids: [],
      };
      items.push(current);
      previous = null;
    }
    if (tx.type === 'EXPENSE') current.expenses += tx.amount;
    else current.income += tx.amount;
    current.ids.push(tx.id);
    const item: Extract<Item, { kind: 'tx' }> = {
      kind: 'tx',
      key: tx.id,
      tx,
      first: previous === null,
      last: false,
    };
    items.push(item);
    previous = item;
  }
  if (previous) previous.last = true;
  return items;
}

export function TransactionList({
  transactions,
  isPending,
  isError,
  isFetchingNextPage,
  hasNextPage,
  hasFilters,
  errorMessage,
  onRetry,
  onLoadMore,
  onPressItem,
  onClearFilters,
  onAdd,
  ListHeaderComponent,
  selection,
  bottomInset = 0,
}: TransactionListProps) {
  const theme = useTheme();
  const t = useT();
  const items = useMemo(() => groupByDate(transactions), [transactions]);
  const selectable = selection?.active ?? false;
  const selectedIds = selection?.ids;

  const renderItem: ListRenderItem<Item> = useCallback(
    ({ item }) => {
      const card = {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      };
      if (item.kind === 'header') {
        const chosen = selectedIds ? item.ids.filter((id) => selectedIds.has(id)).length : 0;
        return (
          <View
            style={[
              styles.header,
              card,
              {
                borderTopLeftRadius: theme.radii.lg,
                borderTopRightRadius: theme.radii.lg,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
          >
            {selectable && selection ? (
              <Checkbox
                checked={chosen > 0 && chosen === item.ids.length}
                indeterminate={chosen > 0 && chosen < item.ids.length}
                onChange={(next) => selection.onToggleMany(item.ids, next)}
                accessibilityLabel={t('tx.selectDay', { date: formatDateLabel(item.date) })}
                size={20}
              />
            ) : null}
            <Text variant="label" color="textSecondary" style={{ flex: 1 }}>
              {formatDateLabel(item.date)}
            </Text>
            <Text variant="caption" color="textMuted" style={styles.totals}>
              {item.expenses > 0 ? `-${formatMoney(item.expenses)}` : ''}
              {item.expenses > 0 && item.income > 0 ? '  ' : ''}
              {item.income > 0 ? `+${formatMoney(item.income)}` : ''}
            </Text>
          </View>
        );
      }
      return (
        <View
          style={[
            styles.rowWrap,
            card,
            item.last
              ? {
                  borderBottomWidth: 1,
                  borderBottomLeftRadius: theme.radii.lg,
                  borderBottomRightRadius: theme.radii.lg,
                  marginBottom: 12,
                }
              : null,
          ]}
        >
          <TransactionRow
            transaction={item.tx}
            onPress={onPressItem}
            onLongPress={selection?.onStart}
            selectable={selectable}
            selected={selectedIds?.has(item.tx.id) ?? false}
            onToggle={selection?.onToggle}
            divider={!item.first}
          />
        </View>
      );
    },
    [onPressItem, selectable, selectedIds, selection, t, theme],
  );

  let body: React.ReactElement | null = null;
  if (isPending) {
    body = (
      <View style={{ gap: 12, paddingVertical: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={38} height={38} radius={19} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={12} />
            </View>
            <Skeleton width={90} height={14} />
          </View>
        ))}
      </View>
    );
  } else if (isError) {
    body = <ErrorState message={errorMessage ?? t('tx.loadError')} onRetry={onRetry} />;
  } else if (transactions.length === 0) {
    body = hasFilters ? (
      <EmptyState
        icon={SearchX}
        title={t('tx.noMatchTitle')}
        description={t('tx.noMatchBody')}
        actionLabel={t('tx.clearFiltersAction')}
        onAction={onClearFilters}
      />
    ) : (
      <EmptyState
        icon={Inbox}
        title={t('tx.emptyTitle')}
        description={t('tx.emptyBody')}
        actionLabel={t('tx.add')}
        onAction={onAdd}
      />
    );
  }

  return (
    <FlatList
      data={body ? [] : items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      extraData={selectedIds}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
          {ListHeaderComponent}
          {body}
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator color={theme.colors.textSecondary} style={{ paddingVertical: 16 }} />
        ) : hasNextPage ? (
          <View style={{ height: 24 }} />
        ) : null
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onLoadMore();
      }}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 + bottomInset }}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  totals: { fontVariant: ['tabular-nums'] },
  rowWrap: { borderLeftWidth: 1, borderRightWidth: 1 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
});
