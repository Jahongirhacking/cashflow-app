import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { planWarningText } from '@/features/analytics/insights';
import { useMonthPlan } from '@/features/planning/api';
import { useTransactionEditor } from '@/features/transactions/TransactionEditorProvider';
import {
  formatAmountInput,
  formatDateLabel,
  parseAmountInput,
} from '@/features/transactions/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { type TranslationKey, useT } from '@/i18n';
import { useTheme } from '@/theme';
import { formatMoney, formatPercent, INVESTMENT_CATEGORIES } from '@finance/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const RATE_KEY = 'finance.plan.rate';

/** Living-cost group names come from the API in English; show them in the user's language. */
const GROUP_KEYS: Record<string, TranslationKey> = {
  Family: 'plan.group.family',
  Entertainment: 'plan.group.entertainment',
  Food: 'plan.group.food',
  Health: 'plan.group.health',
  Housing: 'plan.group.housing',
  Shopping: 'plan.group.shopping',
  Transport: 'plan.group.transport',
  Utilities: 'plan.group.utilities',
};

/**
 * "How much money do you have?" → what is still due, living costs against their 6-month
 * average, and how much can go to a deposit/investment and when, at the entered annual rate.
 */
export function PlanningCard({ month }: { month: string }) {
  const theme = useTheme();
  const t = useT();
  const editor = useTransactionEditor();
  const [cashText, setCashText] = useState('');
  const [rateText, setRateText] = useState('20');
  const [touched, setTouched] = useState(false);
  const cash = useDebouncedValue(touched ? parseAmountInput(cashText) : null, 400);
  const rate = useDebouncedValue(Math.max(0, Math.min(200, Number(rateText) || 0)), 400);
  const plan = useMonthPlan({ month, cash, rate });

  useEffect(() => {
    AsyncStorage.getItem(RATE_KEY)
      .then((v) => {
        if (v) setRateText(v);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(RATE_KEY, rateText).catch(() => undefined);
  }, [rateText]);

  const p = plan.data;
  // Until the user types, show the server default (expected recurring income) in the field.
  const displayCash = touched
    ? cashText
    : p && p.cashOnHand > 0
      ? formatAmountInput(String(p.cashOnHand))
      : '';
  const recommendedTotal = useMemo(
    () => (p ? p.recommendations.reduce((s, r) => s + r.amount, 0) : 0),
    [p],
  );
  const groupLabel = (name: string) => {
    const key = GROUP_KEYS[name];
    return key ? t(key) : name;
  };

  return (
    <Card>
      <SectionHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />
      <View style={styles.inputs}>
        <View style={{ flex: 2, flexBasis: 160, minWidth: 0 }}>
          <TextField
            label={t('plan.cashQuestion')}
            value={displayCash}
            onChangeText={(text) => {
              setTouched(true);
              setCashText(formatAmountInput(text));
            }}
            keyboardType="decimal-pad"
            inputMode="decimal"
            suffix={t('common.currency')}
            hint={
              p?.cashIsDefault && !touched
                ? t('plan.defaultHint', { amount: formatMoney(p.currentBalance) })
                : undefined
            }
          />
        </View>
        <View style={{ flex: 1, flexBasis: 110, minWidth: 0 }}>
          <TextField
            label={t('plan.annualReturn')}
            value={rateText}
            onChangeText={(text) => setRateText(text.replace(/[^\d.]/g, '').slice(0, 5))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            suffix="%"
          />
        </View>
      </View>

      {plan.isPending || !p ? (
        <View style={{ gap: 10, marginTop: theme.spacing.lg }}>
          <Skeleton height={18} />
          <Skeleton height={18} width="70%" />
        </View>
      ) : (
        <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
          <View style={styles.summaryRow}>
            <Summary
              label={t('plan.fixedDue')}
              value={formatMoney(p.fixed.dueTotal)}
              tone={p.fixed.dueTotal > 0 ? 'expense' : 'text'}
              hint={t('plan.payments', { count: p.fixed.due.length })}
            />
            <Summary
              label={t('plan.upcomingIncome')}
              value={formatMoney(p.recurringIncome.upcoming)}
              tone={p.recurringIncome.upcoming > 0 ? 'income' : 'text'}
              hint={t('plan.daysLeft', { count: p.daysRemaining })}
            />
          </View>

          {p.variable.lines.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View style={styles.lineRow}>
                <Text variant="label" color="textMuted" style={{ flex: 1 }}>
                  {t('plan.livingCosts')}
                </Text>
                <Text variant="caption" color="textMuted">
                  {t('plan.livingHint', { months: p.variable.monthsOfHistory })}
                </Text>
              </View>
              {p.variable.lines?.map((l) => {
                const over = l.budget > 0 && l.spent > l.budget;
                const ratio = l.budget > 0 ? Math.min(1, l.spent / l.budget) : l.spent > 0 ? 1 : 0;
                return (
                  <View key={l.category} style={{ gap: 4 }}>
                    <View style={styles.lineRow}>
                      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                        {groupLabel(l.category)}
                      </Text>
                      <Text
                        variant="body"
                        color={over ? 'expense' : 'text'}
                        style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}
                      >
                        {formatMoney(l.spent)}
                        <Text variant="caption" color="textMuted">
                          {' '}
                          / {formatMoney(l.budget)}
                        </Text>
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <View
                        style={[
                          styles.bar,
                          {
                            width: `${Math.round(ratio * 100)}%`,
                            backgroundColor: over ? theme.colors.expense : theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View
            style={[
              styles.reco,
              {
                backgroundColor:
                  recommendedTotal > 0 ? theme.colors.incomeSoft : theme.colors.surfaceMuted,
                borderRadius: theme.radii.md,
              },
            ]}
          >
            {recommendedTotal > 0 ? (
              <>
                <Text variant="label" color="income">
                  {t('plan.recommended', { amount: formatMoney(recommendedTotal) })}
                </Text>
                {p.recommendations.map((r) => (
                  <View key={r.date} style={styles.recoRow}>
                    <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatMoney(r.amount)}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
                      {r.reason === 'after-income' && r.incomeName
                        ? t('plan.afterIncome', {
                            name: r.incomeName,
                            date: formatDateLabel(r.date),
                          })
                        : r.date === p.today
                          ? t('plan.nowWord')
                          : t('plan.onDate', { date: formatDateLabel(r.date) })}
                    </Text>
                  </View>
                ))}
                <Text variant="caption" color="textSecondary">
                  {t('plan.profitLine', {
                    rate: formatPercent(p.annualRatePercent, 1),
                    monthly: formatMoney(p.expectedProfit.monthly),
                  })}
                </Text>
                <Button
                  title={t('plan.record')}
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    editor.open({
                      mode: 'create',
                      defaults: {
                        type: 'EXPENSE',
                        category: INVESTMENT_CATEGORIES.DEPOSIT,
                        amount: p.recommendations[0]?.amount,
                      },
                    })
                  }
                />
              </>
            ) : (
              <Text variant="caption" color="textSecondary">
                {t('plan.nothing')}
              </Text>
            )}
          </View>

          {p.warnings.map((w) => (
            <Text key={w.code} variant="caption" color="warning">
              {planWarningText(w, t)}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function Summary({
  label,
  value,
  hint,
  tone = 'text',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'text' | 'income' | 'expense';
}) {
  return (
    <View style={styles.summary}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong" color={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summary: { flexGrow: 1, flexBasis: 140, minWidth: 0 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  reco: { padding: 14, gap: 8 },
  recoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
