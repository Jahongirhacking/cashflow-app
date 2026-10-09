import { Checkbox } from '@/components/ui/Checkbox';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Text } from '@/components/ui/Text';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { formatSignedMoney, type Transaction } from '@finance/shared';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { paymentLabel } from '../utils';

export interface TransactionRowProps {
  transaction: Transaction;
  onPress: (transaction: Transaction) => void;
  /** Long press starts multi-select (native) — on web the header "Select" button does the same. */
  onLongPress?: (transaction: Transaction) => void;
  /** When set, the row shows a checkbox and a tap toggles selection instead of opening the editor. */
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (transaction: Transaction) => void;
  /** Hairline above the row (rows inside a day card). */
  divider?: boolean;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  onPress,
  onLongPress,
  selectable = false,
  selected = false,
  onToggle,
  divider = false,
}: TransactionRowProps) {
  const theme = useTheme();
  const t = useT();
  const { hovered, pressed, handlers } = useInteractionState();
  const isIncome = transaction.type === 'INCOME';
  const meta = [transaction.category, transaction.time, paymentLabel(transaction.paymentMethod)]
    .filter(Boolean)
    .join(' · ');
  const label = `${transaction.name}, ${formatSignedMoney(transaction.amount, transaction.type)}, ${meta}`;

  return (
    <Pressable
      {...handlers}
      onPress={() => (selectable ? onToggle?.(transaction) : onPress(transaction))}
      onLongPress={onLongPress ? () => onLongPress(transaction) : undefined}
      delayLongPress={350}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={selectable ? `${t('tx.selectRow')}: ${label}` : label}
      style={[
        styles.row,
        divider
          ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }
          : null,
        selected
          ? { backgroundColor: theme.colors.primarySoft }
          : hovered || pressed
            ? { backgroundColor: theme.colors.surfaceMuted }
            : null,
      ]}
    >
      {selectable ? <Checkbox checked={selected} accessibilityLabel={t('tx.selectRow')} /> : null}
      <View
        style={[
          styles.icon,
          {
            backgroundColor: isIncome ? theme.colors.incomeSoft : theme.colors.expenseSoft,
            borderRadius: theme.radii.full,
          },
        ]}
      >
        <CategoryIcon
          name={transaction.category}
          size={18}
          color={isIncome ? theme.colors.income : theme.colors.expense}
        />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {transaction.name}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text variant="bodyStrong" color={isIncome ? 'income' : 'expense'} style={styles.amount}>
        {formatSignedMoney(transaction.amount, transaction.type)}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  amount: { fontVariant: ['tabular-nums'] },
});
