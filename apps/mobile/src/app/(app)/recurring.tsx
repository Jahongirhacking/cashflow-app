import { currentMonthKey, formatMoney, type RecurringRule } from '@finance/shared';
import { Pause, Play, Plus, Repeat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/StateViews';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import {
  useCreateRecurringRule,
  useDeleteRecurringRule,
  useRecurringRules,
  useRecurringSchedule,
  useUpdateRecurringRule,
} from '@/features/recurring/api';
import { RecurringRuleForm } from '@/features/recurring/components/RecurringRuleForm';
import { describeFrequency } from '@/features/recurring/utils';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { formatDateLabel } from '@/features/transactions/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useInteractionState } from '@/hooks/useInteractionState';
import { getUserMessage } from '@/lib/api';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

type EditorState =
  { mode: 'create'; type: 'INCOME' | 'EXPENSE' } | { mode: 'edit'; rule: RecurringRule } | null;

export default function RecurringScreen() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { isMobile } = useBreakpoint();
  const [showIncome, setShowIncome] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<RecurringRule | null>(null);
  const rules = useRecurringRules();
  const schedule = useRecurringSchedule(currentMonthKey());
  const create = useCreateRecurringRule();
  const update = useUpdateRecurringRule();
  const remove = useDeleteRecurringRule();

  const visible = useMemo(
    () => (rules.data ?? []).filter((r) => showIncome || r.type === 'EXPENSE'),
    [rules.data, showIncome],
  );
  const incomeCount = (rules.data ?? []).filter((r) => r.type === 'INCOME').length;
  const totals = schedule.data?.totals;

  const submit = (values: Parameters<typeof create.mutate>[0]) => {
    if (!editor) return;
    if (editor.mode === 'create') {
      create.mutate(values, {
        onSuccess: () => {
          toast.success(t('rec.added'));
          setEditor(null);
        },
        onError: (e) => toast.error(getUserMessage(e)),
      });
    } else {
      update.mutate(
        { id: editor.rule.id, patch: values },
        {
          onSuccess: () => {
            toast.success(t('rec.updated'));
            setEditor(null);
          },
          onError: (e) => toast.error(getUserMessage(e)),
        },
      );
    }
  };
  const togglePause = (rule: RecurringRule) =>
    update.mutate(
      { id: rule.id, patch: { isActive: !rule.isActive } },
      {
        onSuccess: () =>
          toast.success(
            rule.isActive
              ? t('rec.pausedToast', { name: rule.name })
              : t('rec.resumedToast', { name: rule.name }),
          ),
        onError: (e) => toast.error(getUserMessage(e)),
      },
    );

  return (
    <Screen
      title={t('rec.title')}
      subtitle={t('rec.subtitle')}
      headerRight={
        !isMobile ? (
          <Button
            title={t('rec.addRule')}
            icon={Plus}
            onPress={() => setEditor({ mode: 'create', type: showIncome ? 'INCOME' : 'EXPENSE' })}
          />
        ) : undefined
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <View style={styles.tiles}>
          <StatTile
            label={t('rec.dueThisMonth')}
            value={formatMoney(totals?.expenseDue ?? 0)}
            tone="expense"
            loading={schedule.isPending}
            hint={t('rec.unpaidHint')}
          />
          <StatTile
            label={t('rec.paidThisMonth')}
            value={formatMoney(totals?.expensePaid ?? 0)}
            loading={schedule.isPending}
            hint={t('rec.paidHint')}
          />
          {showIncome ? (
            <StatTile
              label={t('rec.expectedIncome')}
              value={formatMoney((totals?.incomeExpected ?? 0) + (totals?.incomeReceived ?? 0))}
              tone="income"
              loading={schedule.isPending}
              hint={t('rec.receivedHint', { amount: formatMoney(totals?.incomeReceived ?? 0) })}
            />
          ) : null}
        </View>

        <View style={styles.toolbar}>
          <View style={styles.switchRow}>
            <Switch
              value={showIncome}
              onValueChange={setShowIncome}
              accessibilityLabel={t('rec.showIncomeLabel')}
              trackColor={{ true: theme.colors.income, false: theme.colors.borderStrong }}
            />
            <Text variant="caption" color="textSecondary">
              {t('rec.showIncome')}
              {incomeCount > 0 ? ` (${incomeCount})` : ''}
            </Text>
          </View>
          {isMobile ? (
            <Button
              title={t('rec.addRule')}
              size="sm"
              icon={Plus}
              onPress={() => setEditor({ mode: 'create', type: showIncome ? 'INCOME' : 'EXPENSE' })}
            />
          ) : null}
        </View>

        <Card padding="none">
          {rules.isPending ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton height={18} />
              <Skeleton height={18} width="70%" />
            </View>
          ) : visible.length === 0 ? (
            <View style={{ padding: 16 }}>
              <EmptyState
                icon={Repeat}
                title={showIncome ? t('rec.emptyIncomeTitle') : t('rec.emptyTitle')}
                description={t('rec.emptyBody')}
                actionLabel={t('rec.addRule')}
                onAction={() =>
                  setEditor({ mode: 'create', type: showIncome ? 'INCOME' : 'EXPENSE' })
                }
              />
            </View>
          ) : (
            visible.map((rule, index) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                first={index === 0}
                onEdit={() => setEditor({ mode: 'edit', rule })}
                onTogglePause={() => togglePause(rule)}
              />
            ))
          )}
        </Card>
      </View>

      <Dialog
        visible={editor !== null}
        title={editor?.mode === 'edit' ? t('rec.editRule') : t('rec.addRuleTitle')}
        onClose={() => setEditor(null)}
      >
        {editor ? (
          <RecurringRuleForm
            key={editor.mode === 'edit' ? editor.rule.id : 'new'}
            mode={editor.mode}
            initial={editor.mode === 'edit' ? editor.rule : null}
            defaultType={editor.mode === 'create' ? editor.type : undefined}
            submitting={create.isPending || update.isPending}
            onSubmit={submit}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.rule) : undefined}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        visible={deleting !== null}
        title={t('rec.deleteConfirm')}
        message={deleting ? t('rec.deleteBody', { name: deleting.name }) : undefined}
        confirmLabel={t('common.delete')}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('rec.deleted'));
              setDeleting(null);
              setEditor(null);
            },
            onError: (e) => toast.error(getUserMessage(e)),
          })
        }
      />
    </Screen>
  );
}

function RuleRow({
  rule,
  first,
  onEdit,
  onTogglePause,
}: {
  rule: RecurringRule;
  first: boolean;
  onEdit: () => void;
  onTogglePause: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { hovered, pressed, handlers } = useInteractionState();
  const isIncome = rule.type === 'INCOME';
  // The pause/resume control is a sibling of the main pressable, never a child: nested buttons are
  // invalid DOM on web (RN Web renders role="button" as <button>) and nested focusables on Android.
  return (
    <View
      style={[
        styles.row,
        first ? null : { borderTopWidth: 1, borderTopColor: theme.colors.border },
        hovered || pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
      ]}
    >
      <Pressable
        {...handlers}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${rule.name}, ${formatMoney(rule.amount)}, ${describeFrequency(rule)}`}
        style={styles.main}
      >
        <View
          style={[
            styles.icon,
            {
              backgroundColor: isIncome ? theme.colors.incomeSoft : theme.colors.surfaceMuted,
              borderRadius: theme.radii.full,
              opacity: rule.isActive ? 1 : 0.5,
            },
          ]}
        >
          <CategoryIcon
            name={rule.category}
            size={18}
            color={isIncome ? theme.colors.income : theme.colors.textSecondary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text
              variant="bodyStrong"
              numberOfLines={1}
              style={rule.isActive ? null : { color: theme.colors.textMuted }}
            >
              {rule.name}
            </Text>
            {!rule.isActive ? (
              <Text
                variant="caption"
                color="textMuted"
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.full },
                ]}
              >
                {t('rec.paused')}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {describeFrequency(rule)} · {rule.category}
            {rule.nextDate ? ` · ${t('rec.next', { date: formatDateLabel(rule.nextDate) })}` : ''}
          </Text>
        </View>
        <Text
          variant="bodyStrong"
          color={isIncome ? 'income' : 'text'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {isIncome ? '+' : '-'}
          {formatMoney(rule.amount)}
        </Text>
      </Pressable>
      {rule.frequency !== 'ONCE' ? (
        <Pressable
          onPress={onTogglePause}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            rule.isActive
              ? t('rec.pause', { name: rule.name })
              : t('rec.resume', { name: rule.name })
          }
          style={styles.pause}
        >
          {rule.isActive ? (
            <Pause size={16} color={theme.colors.textMuted} />
          ) : (
            <Play size={16} color={theme.colors.textMuted} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pause: { padding: 6 },
});
