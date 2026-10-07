import { View, type ViewProps } from 'react-native';
import { cardShadow, useTheme } from '@/theme';

export interface CardProps extends ViewProps {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'default' | 'muted';
}

const PADDING = { none: 0, sm: 12, md: 16, lg: 24 } as const;

export function Card({ padding = 'md', tone = 'default', style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: tone === 'muted' ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: PADDING[padding],
        },
        cardShadow(theme.scheme),
        style,
      ]}
    />
  );
}
