import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { type ThemeColors, type TypographyVariant, useTheme } from '@/theme';

export type TextColor = keyof Pick<
  ThemeColors,
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'income'
  | 'expense'
  | 'warning'
  | 'info'
  | 'onPrimary'
  | 'primary'
>;

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
