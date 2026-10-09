import { formatMoney } from '@finance/shared';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';
import { formatAxisValue, niceScale } from './chart-utils';
import { ChartTooltip } from './ChartTooltip';
import { Legend } from './Legend';

export interface BarSeries {
  name: string;
  color: string;
}

export interface BarGroup {
  label: string;
  /** One value per series, same order. */
  values: number[];
  /** Longer label for the tooltip title. */
  title?: string;
}

export interface BarChartProps {
  series: BarSeries[];
  groups: BarGroup[];
  height?: number;
  formatValue?: (value: number) => string;
  accessibilityLabel?: string;
}

const PADDING = { top: 12, right: 8, bottom: 24, left: 44 };

/** Grouped bars with a single y-axis, thin marks, a 2px gap between bars and a press/hover tooltip. */
export function BarChart({
  series,
  groups,
  height = 200,
  formatValue = formatMoney,
  accessibilityLabel,
}: BarChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const maxValue = Math.max(0, ...groups.flatMap((g) => g.values));
  const { max, ticks } = niceScale(maxValue);
  const plotW = Math.max(0, width - PADDING.left - PADDING.right);
  const plotH = height - PADDING.top - PADDING.bottom;
  const groupW = groups.length > 0 ? plotW / groups.length : 0;
  const barGap = 2;
  const barW = Math.max(
    3,
    Math.min(28, (groupW * 0.7 - barGap * (series.length - 1)) / Math.max(1, series.length)),
  );
  const y = (v: number) => PADDING.top + plotH - (v / max) * plotH;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={{ gap: 10 }} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <View onLayout={onLayout} style={{ height, width: '100%' }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line
                key={t}
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y(t)}
                y2={y(t)}
                stroke={theme.chart.grid}
                strokeWidth={1}
              />
            ))}
            {ticks.map((t) => (
              <SvgText
                key={`l${t}`}
                x={PADDING.left - 6}
                y={y(t) + 4}
                fontSize={10}
                fill={theme.colors.textMuted}
                textAnchor="end"
              >
                {formatAxisValue(t)}
              </SvgText>
            ))}
            {groups.map((g, gi) => {
              const groupX =
                PADDING.left +
                gi * groupW +
                (groupW - (barW * series.length + barGap * (series.length - 1))) / 2;
              return g.values.map((v, si) => {
                const x = groupX + si * (barW + barGap);
                const top = y(v);
                const h = Math.max(0, PADDING.top + plotH - top);
                const r = Math.min(4, barW / 2, h);
                const path =
                  h === 0
                    ? ''
                    : `M ${x} ${top + h} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barW - r} Q ${x + barW} ${top} ${x + barW} ${top + r} V ${top + h} Z`;
                return path ? (
                  <Path
                    key={`${gi}-${si}`}
                    d={path}
                    fill={series[si]?.color ?? theme.chart.other}
                    opacity={active === null || active === gi ? 1 : 0.4}
                  />
                ) : (
                  <Rect key={`${gi}-${si}`} x={x} y={top} width={barW} height={0} />
                );
              });
            })}
            <Line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={y(0)}
              y2={y(0)}
              stroke={theme.chart.axis}
              strokeWidth={1}
            />
            {groups.map((g, gi) => (
              <SvgText
                key={g.label}
                x={PADDING.left + gi * groupW + groupW / 2}
                y={height - 8}
                fontSize={10}
                fill={theme.colors.textSecondary}
                textAnchor="middle"
              >
                {g.label}
              </SvgText>
            ))}
          </Svg>
        ) : null}
        {width > 0
          ? groups.map((g, gi) => (
              <Pressable
                key={`hit-${g.label}`}
                accessibilityLabel={`${g.title ?? g.label}: ${series.map((s, si) => `${s.name} ${formatValue(g.values[si] ?? 0)}`).join(', ')}`}
                onPressIn={() => setActive(gi)}
                onHoverIn={() => setActive(gi)}
                onHoverOut={() => setActive((a) => (a === gi ? null : a))}
                onPressOut={() => setTimeout(() => setActive((a) => (a === gi ? null : a)), 1500)}
                style={[
                  styles.hit,
                  { left: PADDING.left + gi * groupW, width: groupW, top: 0, height },
                ]}
              />
            ))
          : null}
        {active !== null && groups[active] ? (
          <ChartTooltip
            title={groups[active].title ?? groups[active].label}
            rows={series.map((s, si) => ({
              label: s.name,
              value: formatValue(groups[active]?.values[si] ?? 0),
              color: s.color,
            }))}
            x={PADDING.left + active * groupW + groupW / 2}
            width={width}
          />
        ) : null}
      </View>
      {series.length > 1 ? (
        <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ hit: { position: 'absolute' } });
