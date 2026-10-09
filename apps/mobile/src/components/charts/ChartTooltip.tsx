import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { cardShadow, useTheme } from '@/theme';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** Small floating card used by every chart's hover/press layer. */
export function ChartTooltip({
  title,
  rows,
  x,
  width,
}: {
  title: string;
  rows: TooltipRow[];
  x: number;
  width: number;
}) {
  const theme = useTheme();
  const cardWidth = 170;
  const left = Math.max(0, Math.min(x - cardWidth / 2, width - cardWidth));
  return (
    <View
      pointerEvents="none"
      style={[
        styles.card,
        {
          left,
          width: cardWidth,
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
        },
        cardShadow(theme.scheme),
      ]}
    >
      <Text variant="caption" color="textMuted" style={{ marginBottom: 4 }}>
        {title}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          {row.color ? <View style={[styles.swatch, { backgroundColor: row.color }]} /> : null}
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
            {row.label}
          </Text>
          <Text variant="caption" style={{ fontWeight: '600' }}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', top: 0, padding: 10, borderWidth: 1, zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
});
