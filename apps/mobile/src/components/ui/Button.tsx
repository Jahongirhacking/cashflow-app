import type { LucideIcon } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { readPressableState } from '@/lib/pressable';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  fullWidth = false,
  disabled,
  accessibilityLabel,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled) || loading;

  const palette = {
    primary: { bg: theme.colors.primary, fg: theme.colors.onPrimary, border: theme.colors.primary },
    secondary: {
      bg: theme.colors.surface,
      fg: theme.colors.text,
      border: theme.colors.borderStrong,
    },
    ghost: { bg: 'transparent', fg: theme.colors.textSecondary, border: 'transparent' },
    danger: { bg: theme.colors.expense, fg: '#FFFFFF', border: theme.colors.expense },
  }[variant];

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={(state) => {
        const { pressed, hovered } = readPressableState(state);
        return [
          styles.base,
          {
            height: HEIGHT[size],
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderRadius: theme.radii.md,
            opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
          hovered && !isDisabled && variant === 'ghost'
            ? { backgroundColor: theme.colors.surfaceMuted }
            : null,
          hovered && !isDisabled && variant === 'secondary'
            ? { backgroundColor: theme.colors.surfaceMuted }
            : null,
          style,
        ];
      }}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : Icon ? (
          <Icon size={size === 'sm' ? 16 : 18} color={palette.fg} strokeWidth={2} />
        ) : null}
        <Text
          variant={size === 'sm' ? 'caption' : 'bodyStrong'}
          style={{ color: palette.fg, fontWeight: '600' }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
