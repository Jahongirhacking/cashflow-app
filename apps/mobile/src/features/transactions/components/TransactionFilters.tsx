import {
  currentMonthKey,
  daysInMonth,
  type PaymentMethod,
  shiftMonthKey,
  todayIsoDate,
  addDays,
} from '@finance/shared';
import { ArrowDownUp, ChevronDown, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Dialog } from '@/components/ui/Dialog';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Chip } from '@/components/ui/Chip';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useTransactionFacets } from '@/features/transactions/api';
import { useTheme } from '@/theme';
import { EMPTY_FILTERS, type TransactionFilters as Filters } from '../api';
import { categoryIcon, paymentLabel } from '../utils';
import { CategoryPickerDialog } from './CategoryPickerDialog';
import { useT } from '@/i18n';

export interface TransactionFiltersProps {
  filters: Filters;
  searchText: string;
  onSearchText: (text: string) => void;
  onChange: (next: Filters) => void;
}

type TypeOption = 'ALL' | 'INCOME' | 'EXPENSE';

const DATE_PRESETS = ['all', 'this-month', 'last-month', 'last-30'] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

function presetRange(preset: DatePreset): { from: string | null; to: string | null } {
  const today = todayIsoDate();
  const month = currentMonthKey();
  switch (preset) {
    case 'this-month':
      return { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` };
    case 'last-month': {
      const prev = shiftMonthKey(month, -1);
      return { from: `${prev}-01`, to: `${prev}-${String(daysInMonth(prev)).padStart(2, '0')}` };
    }
    case 'last-30':
      return { from: addDays(today, -29), to: today };
    default:
      return { from: null, to: null };
  }
}

function activePreset(filters: Filters): DatePreset {
  for (const preset of DATE_PRESETS) {
    const range = presetRange(preset);
    if (range.from === filters.from && range.to === filters.to) return preset;
  }
  return 'all';
}

export function countActiveFilters(filters: Filters): number {
  let n = 0;
  if (filters.type) n += 1;
  if (filters.paymentMethod) n += 1;
  if (filters.category) n += 1;
  if (filters.from || filters.to) n += 1;
  if (filters.search) n += 1;
  return n;
}

export function TransactionFilters({
  filters,
  searchText,
  onSearchText,
  onChange,
}: TransactionFiltersProps) {
  const theme = useTheme();
  const t = useT();
  const facets = useTransactionFacets();
  const preset = activePreset(filters);
  const presetLabel = (p: DatePreset) =>
    p === 'all'
      ? t('period.all')
      : p === 'this-month'
        ? t('period.month')
        : p === 'last-month'
          ? t('period.last-month')
          : t('period.last30Short');
  const active = countActiveFilters(filters);
  const categories = (facets.data?.categories ?? []).filter(
    (c) => !filters.type || c.type === filters.type,
  );
  const payments = (facets.data?.paymentMethods ?? []).map((p) => p.method);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheet, setSheet] = useState<'type' | 'period' | 'payment' | null>(null);
  const { isMobile } = useBreakpoint();
  const selectedCategory = filters.category
    ? (categories.find((c) => c.name.toLowerCase() === filters.category?.toLowerCase()) ?? {
        name: filters.category,
        count: 0,
        type: filters.type ?? 'EXPENSE',
      })
    : null;
  // Quick picks: the busiest categories; the full list lives in the picker dialog.
  const quick = categories
    .filter((c) => c.name.toLowerCase() !== selectedCategory?.name.toLowerCase())
    .slice(0, selectedCategory ? 4 : 5);
  const setCategory = (name: string | null) => onChange({ ...filters, category: name });

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.search,
            {
              borderColor: theme.colors.borderStrong,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            value={searchText}
            onChangeText={onSearchText}
            placeholder={t('tx.search')}
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={t('tx.searchLabel')}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, theme.typography.body, { color: theme.colors.text }]}
          />
          {searchText ? (
            <Pressable
              onPress={() => onSearchText('')}
              accessibilityRole="button"
              accessibilityLabel={t('tx.clearSearch')}
              hitSlop={8}
            >
              <X size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() =>
            onChange({ ...filters, sort: filters.sort === 'newest' ? 'oldest' : 'newest' })
          }
          accessibilityRole="button"
          accessibilityLabel={t('tx.sortLabel', {
            order: filters.sort === 'newest' ? t('tx.newestFirst') : t('tx.oldestFirst'),
          })}
          style={[
            styles.sort,
            {
              borderColor: theme.colors.borderStrong,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <ArrowDownUp size={16} color={theme.colors.textSecondary} />
          <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
            {filters.sort === 'newest' ? t('tx.sortNewest') : t('tx.sortOldest')}
          </Text>
        </Pressable>
      </View>

      {isMobile ? (
        // Phones: one scrollable row of pills; each opens a bottom sheet with its options.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.pills}
        >
          <Chip
            label={`${t('tx.filter.type')}: ${filters.type ? (filters.type === 'INCOME' ? t('common.income') : t('common.expense')) : t('common.all')}`}
            icon={ChevronDown}
            selected={filters.type !== null}
            tone={
              filters.type === 'INCOME'
                ? 'income'
                : filters.type === 'EXPENSE'
                  ? 'expense'
                  : 'default'
            }
            onPress={() => setSheet('type')}
          />
          <Chip
            label={`${t('tx.filter.period')}: ${presetLabel(preset)}`}
            icon={ChevronDown}
            selected={preset !== 'all'}
            onPress={() => setSheet('period')}
          />
          {payments.length > 1 ? (
            <Chip
              label={`${t('tx.filter.payment')}: ${filters.paymentMethod ? paymentLabel(filters.paymentMethod) : t('common.all')}`}
              icon={ChevronDown}
              selected={filters.paymentMethod !== null}
              onPress={() => setSheet('payment')}
            />
          ) : null}
          {categories.length > 0 || selectedCategory ? (
            <Chip
              label={`${t('tx.filter.category')}: ${selectedCategory ? selectedCategory.name : t('common.all')}`}
              icon={ChevronDown}
              selected={selectedCategory !== null}
              tone={
                selectedCategory?.type === 'INCOME'
                  ? 'income'
                  : selectedCategory
                    ? 'expense'
                    : 'default'
              }
              onPress={() => setPickerOpen(true)}
            />
          ) : null}
          {active > 0 ? (
            <Chip
              label={t('tx.clearFilters', { count: active })}
              icon={X}
              onPress={() => {
                onSearchText('');
                onChange({ ...EMPTY_FILTERS, sort: filters.sort });
              }}
            />
          ) : null}
        </ScrollView>
      ) : (
        <>
          {/* Wider screens: the three segmented groups inline, then the category chips. */}
          <View style={styles.groups}>
            <View style={styles.group}>
              <Segmented<TypeOption>
                size="sm"
                accessibilityLabel={t('tx.typeFilter')}
                value={filters.type ?? 'ALL'}
                options={[
                  { value: 'ALL', label: t('common.all') },
                  { value: 'INCOME', label: t('common.income'), tint: 'income' },
                  { value: 'EXPENSE', label: t('common.expense'), tint: 'expense' },
                ]}
                onChange={(value) =>
                  onChange({ ...filters, type: value === 'ALL' ? null : value, category: null })
                }
              />
            </View>
            <View style={[styles.group, styles.groupWide]}>
              <Segmented<DatePreset>
                size="sm"
                accessibilityLabel={t('tx.filter.period')}
                value={preset}
                options={DATE_PRESETS.map((p) => ({ value: p, label: presetLabel(p) }))}
                onChange={(p) => onChange({ ...filters, ...presetRange(p) })}
              />
            </View>
            {payments.length > 1 ? (
              <View style={styles.group}>
                <Segmented<string>
                  size="sm"
                  accessibilityLabel={t('tx.filter.payment')}
                  value={filters.paymentMethod ?? 'ALL'}
                  options={[
                    { value: 'ALL', label: t('common.all') },
                    ...payments.map((m: PaymentMethod) => ({ value: m, label: paymentLabel(m) })),
                  ]}
                  onChange={(value) =>
                    onChange({
                      ...filters,
                      paymentMethod: value === 'ALL' ? null : (value as PaymentMethod),
                    })
                  }
                />
              </View>
            ) : null}
          </View>
          {categories.length > 0 || selectedCategory ? (
            <View style={styles.categoryRow}>
              <View style={styles.chips}>
                {selectedCategory ? (
                  <Chip
                    label={
                      selectedCategory.count
                        ? `${selectedCategory.name} · ${selectedCategory.count}`
                        : selectedCategory.name
                    }
                    icon={categoryIcon(selectedCategory.name)}
                    selected
                    tone={selectedCategory.type === 'INCOME' ? 'income' : 'expense'}
                    onPress={() => setCategory(null)}
                  />
                ) : null}
                {quick.map((c) => (
                  <Chip
                    key={c.name}
                    label={`${c.name} · ${c.count}`}
                    tone={c.type === 'INCOME' ? 'income' : 'expense'}
                    onPress={() => setCategory(c.name)}
                  />
                ))}
                {categories.length > quick.length + (selectedCategory ? 1 : 0) ? (
                  <Chip
                    label={t('tx.filter.moreCategories', { count: categories.length })}
                    icon={ChevronDown}
                    onPress={() => setPickerOpen(true)}
                  />
                ) : null}
              </View>
              {active > 0 ? (
                <Pressable
                  onPress={() => {
                    onSearchText('');
                    onChange({ ...EMPTY_FILTERS, sort: filters.sort });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('tx.clearFiltersAction')}
                  hitSlop={8}
                  style={styles.clear}
                >
                  <Text variant="caption" color="info" style={{ fontWeight: '600' }}>
                    {t('tx.clearFilters', { count: active })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      {/* Phone option sheets */}
      <OptionSheet
        visible={sheet === 'type'}
        title={t('tx.filter.type')}
        value={filters.type ?? 'ALL'}
        options={[
          { value: 'ALL', label: t('common.all') },
          { value: 'INCOME', label: t('common.income'), tone: 'income' },
          { value: 'EXPENSE', label: t('common.expense'), tone: 'expense' },
        ]}
        onClose={() => setSheet(null)}
        onPick={(value) => {
          onChange({
            ...filters,
            type: value === 'ALL' ? null : (value as TypeOption & ('INCOME' | 'EXPENSE')),
            category: null,
          });
          setSheet(null);
        }}
      />
      <OptionSheet
        visible={sheet === 'period'}
        title={t('tx.filter.period')}
        value={preset}
        options={DATE_PRESETS.map((p) => ({ value: p, label: presetLabel(p) }))}
        onClose={() => setSheet(null)}
        onPick={(value) => {
          onChange({ ...filters, ...presetRange(value as DatePreset) });
          setSheet(null);
        }}
      />
      <OptionSheet
        visible={sheet === 'payment'}
        title={t('tx.filter.payment')}
        value={filters.paymentMethod ?? 'ALL'}
        options={[
          { value: 'ALL', label: t('common.all') },
          ...payments.map((m: PaymentMethod) => ({ value: m, label: paymentLabel(m) })),
        ]}
        onClose={() => setSheet(null)}
        onPick={(value) => {
          onChange({
            ...filters,
            paymentMethod: value === 'ALL' ? null : (value as PaymentMethod),
          });
          setSheet(null);
        }}
      />

      <CategoryPickerDialog
        visible={pickerOpen}
        categories={categories}
        selected={filters.category}
        onClose={() => setPickerOpen(false)}
        onPick={(name) => {
          setCategory(name);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

/** Bottom sheet with one row of choices; tapping a choice applies it and closes the sheet. */
function OptionSheet({
  visible,
  title,
  value,
  options,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  value: string;
  options: { value: string; label: string; tone?: 'income' | 'expense' }[];
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  return (
    <Dialog visible={visible} title={title} onClose={onClose} maxWidth={420}>
      <View style={styles.sheetChips}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={o.value === value}
            tone={o.tone ?? 'default'}
            onPress={() => onPick(o.value)}
          />
        ))}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    height: 42,
  },
  searchInput: { flex: 1, paddingVertical: 0 },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    height: 42,
  },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  group: { flexGrow: 1, flexBasis: 200, minWidth: 0 },
  groupWide: { flexBasis: 300 },
  pills: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  clear: { marginLeft: 'auto' },
});
