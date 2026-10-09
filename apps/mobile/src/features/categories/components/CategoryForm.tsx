import {
  type Category,
  type CreateCategoryInput,
  EXPENSE_KINDS,
  expenseKindSchema,
  transactionTypeSchema,
} from '@finance/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { type Translate, useT } from '@/i18n';
import { useTheme } from '@/theme';

function buildSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(1, t('form.nameRequired')).max(100),
    type: transactionTypeSchema,
    kind: expenseKindSchema,
  });
}

type Values = z.infer<ReturnType<typeof buildSchema>>;

export function CategoryForm({
  mode,
  initial,
  defaultType,
  submitting,
  onSubmit,
  onDelete,
}: {
  mode: 'create' | 'edit';
  initial?: Category | null;
  defaultType?: 'INCOME' | 'EXPENSE';
  submitting?: boolean;
  onSubmit: (v: CreateCategoryInput) => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const schema = useMemo(() => buildSchema(t), [t]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      type: initial?.type ?? defaultType ?? 'EXPENSE',
      kind: initial?.kind ?? 'VARIABLE',
    },
  });
  const type = form.watch('type');
  const submit = form.handleSubmit((v) =>
    onSubmit({ name: v.name, type: v.type, kind: v.type === 'EXPENSE' ? v.kind : null }),
  );
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Controller
        control={form.control}
        name="type"
        render={({ field }) => (
          <Segmented
            value={field.value}
            options={[
              { value: 'EXPENSE', label: t('common.expense'), tint: 'expense' },
              { value: 'INCOME', label: t('common.income'), tint: 'income' },
            ]}
            onChange={field.onChange}
            accessibilityLabel={t('form.type')}
          />
        )}
      />
      <Controller
        control={form.control}
        name="name"
        render={({ field }) => (
          <TextField
            label={t('form.name')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={form.formState.errors.name?.message}
            autoFocus={mode === 'create'}
            autoCapitalize="words"
          />
        )}
      />
      {type === 'EXPENSE' ? (
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <View style={{ gap: 6 }}>
              <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                {t('cat.classification')}
              </Text>
              <Segmented
                size="sm"
                value={field.value}
                options={EXPENSE_KINDS.map((k) => ({
                  value: k,
                  label: k === 'FIXED' ? t('cat.fixed') : t('cat.variable'),
                }))}
                onChange={field.onChange}
                accessibilityLabel={t('cat.classification')}
              />
              <Text variant="caption" color="textMuted">
                {t('cat.classificationHint')}
              </Text>
            </View>
          )}
        />
      ) : null}
      <View style={styles.actions}>
        {mode === 'edit' && onDelete ? (
          <Button
            title={t('common.delete')}
            variant="ghost"
            icon={Trash2}
            onPress={onDelete}
            disabled={submitting}
          />
        ) : (
          <View />
        )}
        <Button
          title={mode === 'create' ? t('cat.add') : t('common.save')}
          onPress={() => void submit()}
          loading={submitting}
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
