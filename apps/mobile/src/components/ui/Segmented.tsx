import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Text colour when selected; defaults to the primary text colour. */
  tint?: 'income' | 'expense';
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.root,
        { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const color = selected
          ? option.tint
            ? theme.colors[option.tint]
            : theme.colors.text
          : theme.colors.textSecondary;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[
              styles.segment,
              { height: size === 'sm' ? 30 : 38, borderRadius: theme.radii.sm },
              selected ? { backgroundColor: theme.colors.surface } : null,
            ]}
          >
            <Text
              variant={size === 'sm' ? 'caption' : 'body'}
              style={{ color, fontWeight: selected ? '600' : '500' }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', padding: 3, gap: 2 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
