import {
  type CreateRecurringRuleInput,
  isoDateSchema,
  paymentMethodSchema,
  RECURRING_FREQUENCIES,
  type RecurringRule,
  recurringFrequencySchema,
  todayIsoDate,
  transactionTypeSchema,
} from '@finance/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { useCategories } from '@/features/categories/api';
import {
  categoryIcon,
  formatAmountInput,
  PAYMENT_METHODS,
  paymentLabel,
  parseAmountInput,
} from '@/features/transactions/utils';
import { monthShort, type Translate, type TranslationKey, useT, weekdayShort } from '@/i18n';
import { useTheme } from '@/theme';

function buildSchema(t: Translate) {
  return z
    .object({
      name: z.string().trim().min(1, t('form.nameRequired')).max(200, t('form.nameLong')),
      amount: z
        .string()
        .trim()
        .min(1, t('form.amountRequired'))
        .refine((v) => parseAmountInput(v) > 0, t('form.amountPositive')),
      type: transactionTypeSchema,
      category: z.string().trim().min(1, t('form.categoryRequired')).max(100),
      paymentMethod: paymentMethodSchema,
      frequency: recurringFrequencySchema,
      dayOfMonth: z.string().trim(),
      weekday: z.number().int().min(0).max(6),
      month: z.number().int().min(1).max(12),
      startDate: isoDateSchema,
      endDate: z
        .string()
        .trim()
        .refine((v) => v === '' || isoDateSchema.safeParse(v).success, t('form.dateFormat')),
      isActive: z.boolean(),
      note: z.string().trim().max(1000, t('form.noteLong')),
    })
    .superRefine((v, ctx) => {
      if (
        (v.frequency === 'MONTHLY' || v.frequency === 'YEARLY') &&
        !(Number(v.dayOfMonth) >= 1 && Number(v.dayOfMonth) <= 31)
      ) {
        ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: t('rec.dayRange') });
      }
      if (v.endDate && v.endDate < v.startDate)
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: t('rec.endAfterStart') });
    });
}
type Values = z.infer<ReturnType<typeof buildSchema>>;

export interface RecurringRuleFormProps {
  mode: 'create' | 'edit';
  initial?: RecurringRule | null;
  defaultType?: 'INCOME' | 'EXPENSE';
  submitting?: boolean;
  onSubmit: (values: CreateRecurringRuleInput) => void;
  onDelete?: () => void;
}

export function RecurringRuleForm({
  mode,
  initial,
  defaultType = 'EXPENSE',
  submitting,
  onSubmit,
  onDelete,
}: RecurringRuleFormProps) {
  const theme = useTheme();
  const t = useT();
  const categories = useCategories();
  const today = todayIsoDate();
  const schema = useMemo(() => buildSchema(t), [t]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      amount: initial ? formatAmountInput(String(initial.amount)) : '',
      type: initial?.type ?? defaultType,
      category: initial?.category ?? '',
      paymentMethod: initial?.paymentMethod ?? 'CARD',
      frequency: initial?.frequency ?? 'MONTHLY',
      dayOfMonth: String(initial?.dayOfPeriod ?? Number(today.slice(8, 10))),
      weekday: initial?.frequency === 'WEEKLY' ? (initial.dayOfPeriod ?? 1) : 1,
      month: initial?.monthOfYear ?? Number(today.slice(5, 7)),
      startDate: initial?.startDate ?? today,
      endDate: initial?.endDate ?? '',
      isActive: initial?.isActive ?? true,
      note: initial?.note ?? '',
    },
  });
  const type = form.watch('type');
  const frequency = form.watch('frequency');
  const category = form.watch('category');
  const errors = form.formState.errors;

  const suggestions = useMemo(() => {
    const names = (categories.data ?? []).filter((c) => c.type === type).map((c) => c.name);
    if (category && !names.some((n) => n.toLowerCase() === category.toLowerCase()))
      names.unshift(category);
    return names.slice(0, 20);
  }, [categories.data, type, category]);

  const submit = form.handleSubmit((v) => {
    const dayOfPeriod =
      v.frequency === 'WEEKLY'
        ? v.weekday
        : v.frequency === 'MONTHLY' || v.frequency === 'YEARLY'
          ? Number(v.dayOfMonth)
          : null;
    onSubmit({
      name: v.name,
      amount: parseAmountInput(v.amount),
      type: v.type,
      category: v.category,
      paymentMethod: v.paymentMethod,
      frequency: v.frequency,
      dayOfPeriod,
      monthOfYear: v.frequency === 'YEARLY' ? v.month : null,
      startDate: v.startDate,
      endDate: v.endDate ? v.endDate : null,
      isActive: v.isActive,
      note: v.note ? v.note : null,
    });
  });

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
            placeholder={
              type === 'INCOME' ? t('rec.placeholderIncome') : t('rec.placeholderExpense')
            }
            error={errors.name?.message}
            autoFocus={mode === 'create'}
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
            suffix={t('common.currency')}
            error={errors.amount?.message}
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
        name="frequency"
        render={({ field }) => (
          <View style={{ gap: 6 }}>
            <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
              {t('rec.repeats')}
            </Text>
            <Segmented
              size="sm"
              value={field.value}
              options={RECURRING_FREQUENCIES.map((f) => ({
                value: f,
                label: t(`rec.freq.${f}` as TranslationKey),
              }))}
              onChange={field.onChange}
              accessibilityLabel={t('rec.repeats')}
            />
            <Text variant="caption" color="textMuted">
              {field.value === 'ONCE' ? t('rec.onceHint') : t('rec.repeatHint')}
            </Text>
          </View>
        )}
      />
      {frequency === 'WEEKLY' ? (
        <Controller
          control={form.control}
          name="weekday"
          render={({ field }) => (
            <View style={styles.chips}>
              {weekdayShort().map((d, i) => (
                <Chip
                  key={d}
                  label={d}
                  selected={field.value === i}
                  onPress={() => field.onChange(i)}
                />
              ))}
            </View>
          )}
        />
      ) : null}
      <View style={styles.row}>
        {frequency === 'MONTHLY' || frequency === 'YEARLY' ? (
          <View style={{ flex: 1 }}>
            <Controller
              control={form.control}
              name="dayOfMonth"
              render={({ field }) => (
                <TextField
                  label={t('rec.dayOfMonth')}
                  value={field.value}
                  onChangeText={(text) => field.onChange(text.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  error={errors.dayOfMonth?.message}
                  hint={t('rec.dayHint')}
                />
              )}
            />
          </View>
        ) : null}
        {frequency === 'YEARLY' ? (
          <Controller
            control={form.control}
            name="month"
            render={({ field }) => (
              <View style={{ flex: 2, gap: 6 }}>
                <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                  {t('rec.month')}
                </Text>
                <View style={styles.chips}>
                  {monthShort().map((m, i) => (
                    <Chip
                      key={m}
                      label={m}
                      selected={field.value === i + 1}
                      onPress={() => field.onChange(i + 1)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
        ) : null}
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Controller
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <DateField
                label={frequency === 'ONCE' ? t('rec.paymentDate') : t('rec.startsOn')}
                value={field.value}
                onChange={(iso) => form.setValue('startDate', iso, { shouldValidate: true })}
                error={errors.startDate?.message}
              />
            )}
          />
        </View>
        {frequency !== 'ONCE' ? (
          <View style={{ flex: 1 }}>
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DateField
                  label={t('rec.endsOn')}
                  value={field.value}
                  onChange={(iso) => form.setValue('endDate', iso, { shouldValidate: true })}
                  error={errors.endDate?.message}
                  allowClear
                  placeholder={t('rec.noEnd')}
                />
              )}
            />
          </View>
        ) : null}
      </View>
      <Controller
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <View style={{ gap: 6 }}>
            <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
              {t('form.paymentMethod')}
            </Text>
            <Segmented
              size="sm"
              value={field.value}
              options={PAYMENT_METHODS.map((k) => ({ value: k, label: paymentLabel(k) }))}
              onChange={field.onChange}
              accessibilityLabel={t('form.paymentMethod')}
            />
          </View>
        )}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => (
          <TextField
            label={t('form.note')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            multiline
            style={{ minHeight: 56, textAlignVertical: 'top' }}
          />
        )}
      />
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text variant="body">{t('rec.active')}</Text>
              <Text variant="caption" color="textMuted">
                {t('rec.activeHint')}
              </Text>
            </View>
            <Switch
              value={field.value}
              onValueChange={field.onChange}
              accessibilityLabel={t('rec.active')}
              trackColor={{ true: theme.colors.income, false: theme.colors.borderStrong }}
            />
          </View>
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
          title={mode === 'create' ? t('rec.addRule') : t('common.save')}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
