import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

export interface CheckboxProps {
  checked: boolean;
  /** Some but not all items checked (day headers). */
  indeterminate?: boolean;
  onChange?: (next: boolean) => void;
  accessibilityLabel: string;
  size?: number;
}

/** Round check control; rendered as a plain view when there is no handler (the parent row handles presses). */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  accessibilityLabel,
  size = 22,
}: CheckboxProps) {
  const theme = useTheme();
  const on = checked || indeterminate;
  const box = (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: on ? theme.colors.primary : theme.colors.borderStrong,
          backgroundColor: on ? theme.colors.primary : theme.colors.surface,
        },
      ]}
    >
      {checked ? (
        <Check size={size * 0.64} color={theme.colors.onPrimary} strokeWidth={3} />
      ) : indeterminate ? (
        <View
          style={{
            width: size * 0.45,
            height: 2,
            backgroundColor: theme.colors.onPrimary,
            borderRadius: 1,
          }}
        />
      ) : null}
    </View>
  );
  if (!onChange) return box;
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
    >
      {box}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
