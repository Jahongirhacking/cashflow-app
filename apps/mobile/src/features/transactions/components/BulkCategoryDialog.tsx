import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useCategories } from '@/features/categories/api';
import { useT } from '@/i18n';
import { useTransactionFacets } from '../api';
import { categoryIcon } from '../utils';

export interface BulkCategoryDialogProps {
  visible: boolean;
  count: number;
  loading: boolean;
  onClose: () => void;
  onApply: (category: string) => void;
}

/** Pick (or type) the category that every selected transaction will move to. */
export function BulkCategoryDialog({
  visible,
  count,
  loading,
  onClose,
  onApply,
}: BulkCategoryDialogProps) {
  const t = useT();
  const categories = useCategories();
  const facets = useTransactionFacets();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    const names = new Map<string, { name: string; tone: 'income' | 'expense' }>();
    for (const c of categories.data ?? [])
      names.set(c.name.toLowerCase(), {
        name: c.name,
        tone: c.type === 'INCOME' ? 'income' : 'expense',
      });
    for (const f of facets.data?.categories ?? [])
      if (!names.has(f.name.toLowerCase()))
        names.set(f.name.toLowerCase(), {
          name: f.name,
          tone: f.type === 'INCOME' ? 'income' : 'expense',
        });
    const q = search.trim().toLowerCase();
    return [...names.values()]
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories.data, facets.data, search]);

  const typed = search.trim();
  const typedIsNew =
    typed.length > 0 && !options.some((o) => o.name.toLowerCase() === typed.toLowerCase());
  const chosen = picked ?? (typedIsNew ? typed : null);

  const close = () => {
    setSearch('');
    setPicked(null);
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      title={t('tx.bulk.categoryTitle')}
      onClose={close}
      maxWidth={520}
      footer={
        <>
          <Button title={t('common.cancel')} variant="ghost" onPress={close} disabled={loading} />
          <Button
            title={t('tx.bulk.apply', { count })}
            onPress={() => chosen && onApply(chosen)}
            disabled={!chosen}
            loading={loading}
          />
        </>
      }
    >
      <Text color="textSecondary">{t('tx.bulk.categoryBody', { count })}</Text>
      <TextField
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setPicked(null);
        }}
        placeholder={t('tx.bulk.searchCategory')}
        accessibilityLabel={t('tx.bulk.searchCategory')}
        autoCapitalize="sentences"
      />
      <View style={styles.chips}>
        {typedIsNew ? (
          <Chip
            label={t('tx.bulk.newCategory', { name: typed })}
            selected
            onPress={() => setPicked(typed)}
          />
        ) : null}
        {options.map((o) => (
          <Chip
            key={o.name}
            label={o.name}
            icon={categoryIcon(o.name)}
            tone={o.tone}
            selected={picked === o.name}
            onPress={() => setPicked(o.name)}
          />
        ))}
        {options.length === 0 && !typedIsNew ? (
          <Text variant="caption" color="textMuted">
            {t('tx.bulk.noCategories')}
          </Text>
        ) : null}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
