import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  tone?: 'default' | 'income' | 'expense';
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  tone = 'default',
}: ChipProps) {
  const theme = useTheme();
  const selectedBg =
    tone === 'income'
      ? theme.colors.incomeSoft
      : tone === 'expense'
        ? theme.colors.expenseSoft
        : theme.colors.primarySoft;
  const selectedFg =
    tone === 'income'
      ? theme.colors.income
      : tone === 'expense'
        ? theme.colors.expense
        : theme.colors.text;
  const fg = selected ? selectedFg : theme.colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          borderRadius: theme.radii.full,
          borderColor: selected ? 'transparent' : theme.colors.border,
          backgroundColor: selected ? selectedBg : theme.colors.surface,
        },
      ]}
    >
      {Icon ? <Icon size={14} color={fg} /> : null}
      <Text variant="caption" style={{ color: fg, fontWeight: selected ? '600' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
});
