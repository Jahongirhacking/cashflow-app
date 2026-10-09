import { StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { Text, type TextColor } from './Text';

export interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: TextColor;
  loading?: boolean;
}

/** Compact headline number. One per metric; never a chart. */
export function StatTile({ label, value, hint, tone = 'text', loading = false }: StatTileProps) {
  const theme = useTheme();
  return (
    <Card padding="sm" style={styles.tile}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      {loading ? (
        <Skeleton width="70%" height={22} style={{ marginTop: theme.spacing.sm }} />
      ) : (
        <Text
          variant="heading"
          color={tone}
          numberOfLines={1}
          style={[{ marginTop: theme.spacing.xs }, styles.value]}
        >
          {value}
        </Text>
      )}
      {hint && !loading ? (
        <Text variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 0, paddingHorizontal: 14 },
  value: { fontVariant: ['tabular-nums'] },
});
