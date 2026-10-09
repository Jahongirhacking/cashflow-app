import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {Icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radii.full,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Icon size={22} color={theme.colors.textSecondary} />
        </View>
      ) : null}
      <Text variant="subheading" align="center">
        {title}
      </Text>
      {description ? (
        <Text
          variant="caption"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.xs, maxWidth: 320 }}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button title={actionLabel} onPress={onAction} variant="secondary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({ title, message, onRetry, retrying }: ErrorStateProps) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text variant="subheading" align="center">
        {title ?? t('errors.unableToLoad')}
      </Text>
      <Text
        variant="caption"
        color="textSecondary"
        align="center"
        style={{ marginTop: theme.spacing.xs, maxWidth: 320 }}
      >
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            title={t('common.retry')}
            onPress={onRetry}
            variant="secondary"
            size="sm"
            loading={retrying}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
