import { formatMoney, type RecurringOccurrence } from '@finance/shared';
import { useRouter } from 'expo-router';
import { Check, Repeat } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { CardEmpty } from '@/components/feedback/CardEmpty';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useMarkOccurrence, useRecurringSchedule } from '@/features/recurring/api';
import { formatDateLabel } from '@/features/transactions/utils';
import { useT } from '@/i18n';
import { getUserMessage } from '@/lib/api';
import { useTheme } from '@/theme';

/**
 * This month's fixed expenses as a reminder checklist. Ticking stores a "done" mark for the
 * occurrence in your spreadsheet's Settings sheet; it never creates or deletes transactions.
 */
export function FixedExpensesTodo({ month }: { month: string }) {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const schedule = useRecurringSchedule(month);
  const mark = useMarkOccurrence();
  const items = (schedule.data?.occurrences ?? []).filter((o) => o.type === 'EXPENSE');
  const remaining = items.filter((o) => o.status !== 'paid');
  const total = items.reduce((s, o) => s + o.amount, 0);
  const doneTotal = items.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);

  const toggle = (o: RecurringOccurrence) => {
    const done = !(o.status === 'paid');
    mark.mutate(
      { id: o.ruleId, input: { dueDate: o.dueDate, done } },
      {
        onSuccess: () =>
          toast.success(
            done
              ? t('dashboard.markedDone', { name: o.name })
              : t('dashboard.markedNotDone', { name: o.name }),
          ),
        onError: (e) => toast.error(getUserMessage(e)),
      },
    );
  };

  return (
    <Card>
      <SectionHeader
        title={t('dashboard.fixedThisMonth')}
        subtitle={
          items.length > 0
            ? t('dashboard.leftOf', {
                count: remaining.length,
                left: formatMoney(total - doneTotal),
                total: formatMoney(total),
              })
            : t('dashboard.remindersOnly')
        }
        right={
          <Text
            variant="caption"
            color="info"
            onPress={() => router.push('/recurring')}
            accessibilityRole="link"
          >
            {t('common.manage')}
          </Text>
        }
      />
      {schedule.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={18} />
          <Skeleton height={18} width="80%" />
        </View>
      ) : items.length === 0 ? (
        <CardEmpty
          icon={Repeat}
          message={t('dashboard.noFixed')}
          action={
            <Button
              title={t('dashboard.addRule')}
              size="sm"
              variant="secondary"
              onPress={() => router.push('/recurring')}
            />
          }
        />
      ) : (
        <View style={{ gap: 4 }}>
          {items.map((o) => {
            const done = o.status === 'paid';
            const busy =
              mark.isPending &&
              mark.variables?.id === o.ruleId &&
              mark.variables.input.dueDate === o.dueDate;
            const detail = done
              ? o.markedDone
                ? t('common.done')
                : `${t('dashboard.paidFound')}${o.matchedByName ? t('dashboard.matchedByName') : ''}`
              : o.status === 'overdue'
                ? t('dashboard.overdueWasDue', { date: formatDateLabel(o.dueDate) })
                : t('dashboard.dueOn', { date: formatDateLabel(o.dueDate) });
            return (
              <Pressable
                key={`${o.ruleId}-${o.dueDate}`}
                onPress={() => toggle(o)}
                disabled={busy}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done, busy }}
                accessibilityLabel={`${o.name}, ${formatMoney(o.amount)}, ${done ? t('common.done').toLowerCase() : t(`common.${o.status}`)}`}
                style={({ pressed }) => [
                  styles.row,
                  { borderRadius: theme.radii.sm },
                  pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
                ]}
              >
                <View
                  style={[
                    styles.check,
                    {
                      borderColor: done ? theme.colors.income : theme.colors.borderStrong,
                      backgroundColor: done ? theme.colors.income : 'transparent',
                    },
                  ]}
                >
                  {done ? <Check size={14} color={theme.colors.onPrimary} strokeWidth={3} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="body"
                    numberOfLines={1}
                    style={
                      done
                        ? { textDecorationLine: 'line-through', color: theme.colors.textMuted }
                        : null
                    }
                  >
                    {o.name}
                  </Text>
                  <Text variant="caption" color={o.status === 'overdue' ? 'expense' : 'textMuted'}>
                    {detail}
                  </Text>
                </View>
                <Text
                  variant="bodyStrong"
                  color={done ? 'textMuted' : 'text'}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(o.amount)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
