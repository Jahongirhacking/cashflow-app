import { formatMoney, formatPercent } from '@finance/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { arcPath } from './chart-utils';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (value: number) => string;
  /** Called when a slice (or its legend row) is pressed. */
  onSelect?: (label: string) => void;
}

/** Donut with 2px surface gaps between arcs and a legend that doubles as the hit area. */
export function DonutChart({
  slices,
  size = 160,
  centerLabel,
  centerValue,
  formatValue = formatMoney,
  onSelect,
}: DonutChartProps) {
  const theme = useTheme();
  const t = useT();
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = size / 2 - 22;
  let angle = 0;
  const gap = total > 0 ? 2 / rOuter : 0; // ~2px gap expressed in radians at the outer radius

  const paths = slices.map((slice, i) => {
    const sweep = total > 0 ? (slice.value / total) * Math.PI * 2 : 0;
    const start = angle + (slices.length > 1 ? gap / 2 : 0);
    const end = angle + sweep - (slices.length > 1 ? gap / 2 : 0);
    angle += sweep;
    if (end <= start) return null;
    return (
      <Path
        key={slice.label}
        d={arcPath(cx, cy, rOuter, rInner, start, end)}
        fill={slice.color}
        opacity={active === null || active === i ? 1 : 0.35}
      />
    );
  });

  const current = active !== null ? slices[active] : undefined;

  return (
    <View style={styles.root}>
      <View
        style={{ width: size, height: size }}
        accessibilityRole="image"
        accessibilityLabel={`${t('chart.breakdown')}: ${slices.map((s) => `${s.label} ${formatValue(s.value)}`).join(', ')}`}
      >
        <Svg width={size} height={size}>
          {total > 0 ? (
            paths
          ) : (
            <Path
              d={arcPath(cx, cy, rOuter, rInner, 0, Math.PI * 2 - 0.0001)}
              fill={theme.colors.surfaceMuted}
            />
          )}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {current ? current.label : centerLabel}
          </Text>
          <Text variant="subheading" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {current ? formatPercent((current.value / total) * 100, 0) : centerValue}
          </Text>
        </View>
      </View>
      <View style={styles.legend} accessibilityRole="list">
        {slices.map((slice, i) => (
          <Pressable
            key={slice.label}
            onHoverIn={() => setActive(i)}
            onHoverOut={() => setActive(null)}
            onPressIn={() => setActive(i)}
            onPress={() => onSelect?.(slice.label)}
            accessibilityRole="button"
            accessibilityLabel={`${slice.label}: ${formatValue(slice.value)}, ${formatPercent(total > 0 ? (slice.value / total) * 100 : 0, 0)}`}
            style={[
              styles.legendRow,
              active === i ? { backgroundColor: theme.colors.surfaceMuted } : null,
              { borderRadius: theme.radii.sm },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: slice.color }]} />
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
              {slice.label}
            </Text>
            <Text variant="caption" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {formatValue(slice.value)}
            </Text>
            <Text variant="caption" color="textMuted" style={{ width: 36, textAlign: 'right' }}>
              {formatPercent(total > 0 ? (slice.value / total) * 100 : 0, 0)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  legend: { flex: 1, minWidth: 180, gap: 2 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
