import type { TransactionFacetCategory } from '@finance/shared';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n';
import { categoryIcon } from '../utils';

export interface CategoryPickerDialogProps {
  visible: boolean;
  categories: TransactionFacetCategory[];
  selected: string | null;
  onClose: () => void;
  onPick: (category: string | null) => void;
}

/** Every category with its transaction count, searchable and grouped by income / expense. */
export function CategoryPickerDialog({
  visible,
  categories,
  selected,
  onClose,
  onPick,
}: CategoryPickerDialogProps) {
  const t = useT();
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
    return [
      { type: 'EXPENSE' as const, items: list.filter((c) => c.type === 'EXPENSE') },
      { type: 'INCOME' as const, items: list.filter((c) => c.type === 'INCOME') },
    ].filter((g) => g.items.length > 0);
  }, [categories, search]);
  const close = () => {
    setSearch('');
    onClose();
  };
  const pick = (name: string | null) => {
    setSearch('');
    onPick(name);
  };

  return (
    <Dialog
      visible={visible}
      title={t('tx.filter.pickCategory')}
      subtitle={t('tx.filter.pickCategoryHint', { count: categories.length })}
      onClose={close}
      maxWidth={520}
      footer={
        <>
          <Button
            title={t('tx.filter.anyCategory')}
            variant="ghost"
            onPress={() => pick(null)}
            disabled={!selected}
          />
          <Button title={t('common.close')} variant="secondary" onPress={close} />
        </>
      }
    >
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={t('tx.filter.searchCategory')}
        accessibilityLabel={t('tx.filter.searchCategory')}
        autoCapitalize="none"
      />
      {groups.map((g) => (
        <View key={g.type} style={{ gap: 8 }}>
          <Text variant="label" color="textMuted">
            {g.type === 'INCOME' ? t('common.income') : t('common.expenses')}
          </Text>
          <View style={styles.chips}>
            {g.items.map((c) => (
              <Chip
                key={c.name}
                label={`${c.name} · ${c.count}`}
                icon={categoryIcon(c.name)}
                tone={c.type === 'INCOME' ? 'income' : 'expense'}
                selected={selected?.toLowerCase() === c.name.toLowerCase()}
                onPress={() => pick(c.name)}
              />
            ))}
          </View>
        </View>
      ))}
      {groups.length === 0 ? (
        <Text variant="caption" color="textMuted">
          {t('tx.bulk.noCategories')}
        </Text>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
