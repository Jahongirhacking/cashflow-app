import {
  type CreateTransactionInput,
  isoDateSchema,
  nowIsoTime,
  type PaymentMethod,
  paymentMethodSchema,
  todayIsoDate,
  type Transaction,
  type TransactionType,
  transactionTypeSchema,
  addDays,
} from '@finance/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { useCategories } from '@/features/categories/api';
import { useTransactionFacets } from '@/features/transactions/api';
import { useTheme } from '@/theme';
import {
  categoryIcon,
  formatAmountInput,
  PAYMENT_METHODS,
  paymentLabel,
  parseAmountInput,
} from '../utils';
import { type Translate, useT } from '@/i18n';

function buildFormSchema(t: Translate) {
  return z.object({
    type: transactionTypeSchema,
    amount: z
      .string()
      .trim()
      .min(1, t('form.amountRequired'))
      .refine((v) => parseAmountInput(v) > 0, t('form.amountPositive')),
    name: z.string().trim().min(1, t('form.nameRequired')).max(200, t('form.nameLong')),
    category: z.string().trim().min(1, t('form.categoryRequired')).max(100),
    paymentMethod: paymentMethodSchema,
    date: isoDateSchema,
    time: z
      .string()
      .trim()
      .refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), t('form.timeFormat')),
    note: z.string().trim().max(1000, t('form.noteLong')),
  });
}
type FormSchema = ReturnType<typeof buildFormSchema>;

export type TransactionFormValues = z.infer<FormSchema>;

export interface TransactionFormProps {
  mode: 'create' | 'edit';
  initial?: Transaction | null;
  defaults?: Partial<CreateTransactionInput>;
  submitting?: boolean;
  onSubmit: (values: CreateTransactionInput) => void;
  onDelete?: () => void;
}

export function TransactionForm({
  mode,
  initial,
  defaults,
  submitting = false,
  onSubmit,
  onDelete,
}: TransactionFormProps) {
  const theme = useTheme();
  const t = useT();
  const categories = useCategories();
  const facets = useTransactionFacets();
  const formSchema = useMemo(() => buildFormSchema(t), [t]);
  const typeOptions: { value: TransactionType; label: string; tint: 'income' | 'expense' }[] = [
    { value: 'EXPENSE', label: t('common.expense'), tint: 'expense' },
    { value: 'INCOME', label: t('common.income'), tint: 'income' },
  ];
  const paymentOptions = PAYMENT_METHODS.map((value: PaymentMethod) => ({
    value,
    label: paymentLabel(value),
  }));

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      type: initial?.type ?? defaults?.type ?? 'EXPENSE',
      amount: initial
        ? formatAmountInput(String(initial.amount))
        : defaults?.amount
          ? formatAmountInput(String(defaults.amount))
          : '',
      name: initial?.name ?? defaults?.name ?? '',
      category: initial?.category ?? defaults?.category ?? '',
      paymentMethod: initial?.paymentMethod ?? defaults?.paymentMethod ?? 'CARD',
      date: initial?.date ?? defaults?.date ?? todayIsoDate(),
      time: initial?.time ?? defaults?.time ?? (initial ? '' : nowIsoTime()),
      note: initial?.note ?? defaults?.note ?? '',
    },
  });
  const type = form.watch('type');
  const category = form.watch('category');
  const date = form.watch('date');

  const suggestions = useMemo(() => {
    const names = new Set<string>();
    for (const c of categories.data ?? []) if (c.type === type) names.add(c.name);
    for (const f of facets.data?.categories ?? []) if (f.type === type) names.add(f.name);
    const list = [...names];
    if (category && !list.some((n) => n.toLowerCase() === category.toLowerCase()))
      list.unshift(category);
    return list.slice(0, 24);
  }, [categories.data, facets.data, type, category]);

  const submit = form.handleSubmit((values) => {
    onSubmit({
      type: values.type,
      amount: parseAmountInput(values.amount),
      name: values.name,
      category: values.category,
      paymentMethod: values.paymentMethod,
      date: values.date,
      time: values.time ? values.time : null,
      note: values.note ? values.note : null,
    });
  });

  const errors = form.formState.errors;
  const today = todayIsoDate();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Controller
        control={form.control}
        name="type"
        render={({ field }) => (
          <Segmented
            value={field.value}
            options={typeOptions}
            onChange={field.onChange}
            accessibilityLabel={t('form.type')}
          />
        )}
      />

      <Controller
        control={form.control}
        name="amount"
        render={({ field }) => (
          <TextField
            label={t('form.amount')}
            value={field.value}
            onChangeText={(text) => field.onChange(formatAmountInput(text))}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0"
            suffix={t('common.currency')}
            error={errors.amount?.message}
            autoFocus={mode === 'create'}
            style={[
              theme.typography.title,
              { color: type === 'INCOME' ? theme.colors.income : theme.colors.expense },
            ]}
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
            placeholder={
              type === 'INCOME' ? t('form.placeholderIncome') : t('form.placeholderExpense')
            }
            error={errors.name?.message}
            autoCapitalize="sentences"
          />
        )}
      />

      <Controller
        control={form.control}
        name="category"
        render={({ field }) => (
          <View style={{ gap: 8 }}>
            <TextField
              label={t('form.category')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('form.categoryPlaceholder')}
              error={errors.category?.message}
              autoCapitalize="words"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chips}
            >
              {suggestions.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  icon={categoryIcon(name)}
                  selected={name.toLowerCase() === field.value.toLowerCase()}
                  tone={type === 'INCOME' ? 'income' : 'expense'}
                  onPress={() => field.onChange(name)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <View style={{ gap: 6 }}>
            <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
              {t('form.paymentMethod')}
            </Text>
            <Segmented
              value={field.value}
              options={paymentOptions}
              onChange={field.onChange}
              size="sm"
              accessibilityLabel={t('form.paymentMethod')}
            />
          </View>
        )}
      />

      <View style={styles.row}>
        <View style={{ flex: 3, gap: 8 }}>
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <DateField
                label={t('form.date')}
                value={field.value}
                onChange={(iso) => form.setValue('date', iso, { shouldValidate: true })}
                error={errors.date?.message}
              />
            )}
          />
          <View style={styles.chips}>
            <Chip
              label={t('common.today')}
              selected={date === today}
              onPress={() => form.setValue('date', today, { shouldValidate: true })}
            />
            <Chip
              label={t('common.yesterday')}
              selected={date === addDays(today, -1)}
              onPress={() => form.setValue('date', addDays(today, -1), { shouldValidate: true })}
            />
          </View>
        </View>
        <View style={{ flex: 2, gap: 8 }}>
          <Controller
            control={form.control}
            name="time"
            render={({ field }) => (
              <TextField
                label={t('form.time')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="HH:mm"
                error={errors.time?.message}
                keyboardType="numbers-and-punctuation"
              />
            )}
          />
          <View style={styles.chips}>
            <Chip
              label={t('common.now')}
              onPress={() => form.setValue('time', nowIsoTime(), { shouldValidate: true })}
            />
          </View>
        </View>
      </View>

      <Controller
        control={form.control}
        name="note"
        render={({ field }) => (
          <TextField
            label={t('form.note')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('form.notePlaceholder')}
            error={errors.note?.message}
            multiline
            numberOfLines={2}
            style={{ minHeight: 64, textAlignVertical: 'top' }}
          />
        )}
      />

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
          title={mode === 'create' ? t('tx.add') : t('common.save')}
          onPress={() => void submit()}
          loading={submitting}
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
});
