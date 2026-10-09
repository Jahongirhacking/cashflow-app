import { formatMoney } from '@finance/shared';
import { useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { formatAxisValue, niceScale } from './chart-utils';
import { ChartTooltip } from './ChartTooltip';

export interface LinePoint {
  x: string;
  y: number;
  /** Tooltip title; defaults to `x`. */
  title?: string;
}

export interface LineChartProps {
  points: LinePoint[];
  color: string;
  height?: number;
  formatValue?: (value: number) => string;
  /** Labels to draw on the x axis (subset of point x values). */
  xLabels?: { x: string; label: string }[];
  accessibilityLabel?: string;
}

const PADDING = { top: 12, right: 8, bottom: 22, left: 44 };

/** Single-series line with a soft area, crosshair and tooltip driven by the responder system (mouse + touch). */
export function LineChart({
  points,
  color,
  height = 180,
  formatValue = formatMoney,
  xLabels = [],
  accessibilityLabel,
}: LineChartProps) {
  const theme = useTheme();
  const t = useT();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const { max, ticks } = niceScale(Math.max(0, ...points.map((p) => p.y)));
  const plotW = Math.max(0, width - PADDING.left - PADDING.right);
  const plotH = height - PADDING.top - PADDING.bottom;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xOf = (i: number) => PADDING.left + i * step;
  const yOf = (v: number) => PADDING.top + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.y)}`).join(' ');
  const area =
    points.length > 1
      ? `${line} L ${xOf(points.length - 1)} ${yOf(0)} L ${xOf(0)} ${yOf(0)} Z`
      : '';

  const locate = (e: GestureResponderEvent) => {
    if (step <= 0) return;
    const x = e.nativeEvent.locationX - PADDING.left;
    const index = Math.round(x / step);
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={locate}
      onResponderMove={locate}
      onResponderRelease={() => setTimeout(() => setActive(null), 1500)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line
              key={t}
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yOf(t)}
              y2={yOf(t)}
              stroke={theme.chart.grid}
              strokeWidth={1}
            />
          ))}
          {ticks.map((t) => (
            <SvgText
              key={`l${t}`}
              x={PADDING.left - 6}
              y={yOf(t) + 4}
              fontSize={10}
              fill={theme.colors.textMuted}
              textAnchor="end"
            >
              {formatAxisValue(t)}
            </SvgText>
          ))}
          {area ? <Path d={area} fill={color} opacity={0.12} /> : null}
          {points.length > 1 ? (
            <Path
              d={line}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {points.length === 1 ? (
            <Circle cx={xOf(0)} cy={yOf(points[0]?.y ?? 0)} r={4} fill={color} />
          ) : null}
          {active !== null && points[active] ? (
            <>
              <Line
                x1={xOf(active)}
                x2={xOf(active)}
                y1={PADDING.top}
                y2={yOf(0)}
                stroke={theme.chart.axis}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <Circle
                cx={xOf(active)}
                cy={yOf(points[active].y)}
                r={5}
                fill={color}
                stroke={theme.colors.surface}
                strokeWidth={2}
              />
            </>
          ) : null}
          {xLabels.map((l) => {
            const i = points.findIndex((p) => p.x === l.x);
            if (i < 0) return null;
            return (
              <SvgText
                key={l.x}
                x={xOf(i)}
                y={height - 6}
                fontSize={10}
                fill={theme.colors.textSecondary}
                textAnchor="middle"
              >
                {l.label}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}
      {active !== null && points[active] ? (
        <ChartTooltip
          title={points[active].title ?? points[active].x}
          rows={[{ label: t('chart.spent'), value: formatValue(points[active].y), color }]}
          x={xOf(active)}
          width={width}
        />
      ) : null}
    </View>
  );
}
