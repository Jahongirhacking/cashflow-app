import type { BulkTransactionAction, Transaction } from '@finance/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckSquare, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import {
  EMPTY_FILTERS,
  type TransactionFilters as Filters,
  useBulkTransactions,
  useTransactionsInfinite,
} from '@/features/transactions/api';
import { BulkActionBar } from '@/features/transactions/components/BulkActionBar';
import { BulkCategoryDialog } from '@/features/transactions/components/BulkCategoryDialog';
import { BulkTypeDialog } from '@/features/transactions/components/BulkTypeDialog';
import {
  TransactionFilters,
  countActiveFilters,
} from '@/features/transactions/components/TransactionFilters';
import {
  TransactionList,
  type TransactionSelection,
} from '@/features/transactions/components/TransactionList';
import { useTransactionEditor } from '@/features/transactions/TransactionEditorProvider';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { breakpoints, useTheme } from '@/theme';

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop, isMobile } = useBreakpoint();
  const editor = useTransactionEditor();
  const t = useT();
  const params = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  // Deep links such as /transactions?category=Food (from dashboard charts) pre-select the category
  // until the user changes any filter, which clears the parameter.
  const setFilters = useCallback(
    (next: Filters | ((f: Filters) => Filters)) => {
      setFiltersState(next);
      if (params.category) router.setParams({ category: undefined });
    },
    [params.category, router],
  );
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const effective = useMemo(
    () => ({
      ...filters,
      category: filters.category ?? params.category ?? null,
      search: debouncedSearch,
    }),
    [filters, params.category, debouncedSearch],
  );
  const query = useTransactionsInfinite(effective);

  const transactions = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const hasFilters = countActiveFilters(effective) > 0;

  const clearFilters = useCallback(() => {
    setSearchText('');
    setFilters((f) => ({ ...EMPTY_FILTERS, sort: f.sort }));
  }, []);

  const openCreate = useCallback(() => editor.open({ mode: 'create' }), [editor]);

  // --- multi-select ---
  const toast = useToast();
  const bulk = useBulkTransactions();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [bulkDialog, setBulkDialog] = useState<'category' | 'type' | 'delete' | null>(null);
  const endSelection = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkDialog(null);
  }, []);
  const selection = useMemo<TransactionSelection | undefined>(
    () =>
      selectMode
        ? {
            ids: selected,
            active: true,
            onToggle: (tx: Transaction) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(tx.id)) next.delete(tx.id);
                else next.add(tx.id);
                return next;
              }),
            onToggleMany: (ids: string[], on: boolean) =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const id of ids)
                  if (on) next.add(id);
                  else next.delete(id);
                return next;
              }),
            onStart: () => undefined,
          }
        : {
            ids: selected,
            active: false,
            onToggle: () => undefined,
            onToggleMany: () => undefined,
            onStart: (tx: Transaction) => {
              setSelectMode(true);
              setSelected(new Set([tx.id]));
            },
          },
    [selectMode, selected],
  );
  const runBulk = async (input: BulkTransactionAction) => {
    try {
      const result = await bulk.mutateAsync(input);
      toast.success(
        input.action === 'delete'
          ? t('tx.bulk.deleted', { count: result.affected })
          : t('tx.bulk.updated', { count: result.affected }),
      );
      endSelection();
    } catch (error) {
      toast.error(getUserMessage(error));
    }
  };
  const selectedIds = [...selected];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: isMobile ? theme.spacing.lg : theme.spacing.xxl,
            paddingTop: isDesktop ? theme.spacing.xxl : theme.spacing.lg + insets.top,
            maxWidth: breakpoints.contentMaxWidth,
          },
        ]}
      >
        <TransactionList
          transactions={transactions}
          isPending={query.isPending}
          isError={query.isError}
          errorMessage={query.error ? getUserMessage(query.error) : undefined}
          isFetchingNextPage={query.isFetchingNextPage}
          hasNextPage={Boolean(query.hasNextPage)}
          hasFilters={hasFilters}
          onRetry={() => void query.refetch()}
          onLoadMore={() => void query.fetchNextPage()}
          onPressItem={(transaction) => editor.open({ mode: 'edit', transaction })}
          onClearFilters={clearFilters}
          onAdd={openCreate}
          selection={selection}
          bottomInset={selectMode ? 72 : 0}
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="title" accessibilityRole="header">
                    {t('tx.title')}
                  </Text>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                    {query.isPending
                      ? t('common.loading')
                      : hasFilters
                        ? t('tx.countMatch', { count: total })
                        : total === 1
                          ? t('tx.countOne')
                          : t('tx.count', { count: total })}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Button
                    title={selectMode ? t('common.cancel') : t('tx.select')}
                    icon={selectMode ? undefined : CheckSquare}
                    variant="secondary"
                    size={isMobile ? 'sm' : 'md'}
                    onPress={selectMode ? endSelection : () => setSelectMode(true)}
                    disabled={transactions.length === 0 && !selectMode}
                  />
                  {!isMobile ? (
                    <Button title={t('tx.add')} icon={Plus} onPress={openCreate} />
                  ) : null}
                </View>
              </View>
              <TransactionFilters
                filters={filters}
                searchText={searchText}
                onSearchText={setSearchText}
                onChange={setFilters}
              />
            </View>
          }
        />
      </View>
      {selectMode ? (
        <BulkActionBar
          count={selected.size}
          bottom={12 + (isMobile ? 0 : insets.bottom)}
          onCategory={() => setBulkDialog('category')}
          onType={() => setBulkDialog('type')}
          onDelete={() => setBulkDialog('delete')}
          onCancel={endSelection}
        />
      ) : null}
      <BulkCategoryDialog
        visible={bulkDialog === 'category'}
        count={selected.size}
        loading={bulk.isPending}
        onClose={() => setBulkDialog(null)}
        onApply={(category) => void runBulk({ action: 'setCategory', ids: selectedIds, category })}
      />
      <BulkTypeDialog
        visible={bulkDialog === 'type'}
        count={selected.size}
        loading={bulk.isPending}
        onClose={() => setBulkDialog(null)}
        onApply={(type) => void runBulk({ action: 'setType', ids: selectedIds, type })}
      />
      <ConfirmDialog
        visible={bulkDialog === 'delete'}
        title={t('tx.bulk.deleteTitle', { count: selected.size })}
        message={t('tx.bulk.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={bulk.isPending}
        onConfirm={() => void runBulk({ action: 'delete', ids: selectedIds })}
        onCancel={() => setBulkDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, width: '100%', alignSelf: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
