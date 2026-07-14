import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Polyline, Circle as SvgCircle } from 'react-native-svg';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS } from '@/constants/darkRoyalTheme';

export type LineSeriesPoint = { x: string; y: number };
export type LineSeries = {
  key: string;
  label: string;
  color: string;
  points: LineSeriesPoint[];
};
export type ReferenceLine = { key: string; label: string; value: number; color: string };

const CHART_WIDTH = 300;
const MIN_HIT_SIZE = 32;

/**
 * Lightweight SVG line chart (no external chart library needed). Supports
 * multiple series sharing an x-axis plus optional dashed horizontal
 * reference lines (e.g. tier point targets). Every plotted dot on the
 * primary series now has its own invisible ~32x32 touch target positioned
 * directly over it (computed as a percentage of the chart area), on top of
 * the x-axis label row underneath, so tapping the visual point itself
 * always works too.
 */
export function CasinoLineChart({
  series,
  referenceLines = [],
  height = 130,
  onPointPress,
  valueFormatter,
}: {
  series: LineSeries[];
  referenceLines?: ReferenceLine[];
  height?: number;
  onPointPress?: (index: number) => void;
  valueFormatter?: (value: number) => string;
}) {
  const pointCount = Math.max(...series.map((s) => s.points.length), 1);
  const allValues = [
    ...series.flatMap((s) => s.points.map((p) => p.y)),
    ...referenceLines.map((r) => r.value),
    0,
  ];
  const maxV = Math.max(...allValues, 1);
  const minV = Math.min(...allValues, 0);
  const range = Math.max(1, maxV - minV);

  const getXY = (index: number, value: number) => {
    const x = pointCount <= 1 ? CHART_WIDTH / 2 : (index / (pointCount - 1)) * CHART_WIDTH;
    const y = height - ((value - minV) / range) * height;
    return { x, y };
  };

  const xAxisLabels = series[0]?.points.map((p) => p.x) ?? [];
  const primarySeries = series[0];

  return (
    <View>
      <View style={{ position: 'relative' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${CHART_WIDTH} ${height}`} preserveAspectRatio="none">
          {referenceLines.map((ref) => {
            const { y } = getXY(0, ref.value);
            return (
              <Line
                key={ref.key}
                x1={0}
                y1={y}
                x2={CHART_WIDTH}
                y2={y}
                stroke={ref.color}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            );
          })}
          {series.map((s) => (
            <Polyline
              key={s.key}
              points={s.points.map((p, i) => {
                const { x, y } = getXY(i, p.y);
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
            />
          ))}
          {series.map((s) => s.points.map((p, i) => {
            const { x, y } = getXY(i, p.y);
            return (
              <SvgCircle
                key={`${s.key}-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill={p.y < 0 ? CASINO_DASHBOARD_COLORS.red : s.color}
              />
            );
          }))}
        </Svg>
        {onPointPress && primarySeries?.points.map((p, i) => {
          const { x, y } = getXY(i, p.y);
          const leftPct = (x / CHART_WIDTH) * 100;
          const topPct = (y / height) * 100;
          return (
            <TouchableOpacity
              key={`hit-${i}`}
              onPress={() => onPointPress(i)}
              activeOpacity={0.5}
              hitSlop={4}
              style={[
                styles.pointHitTarget,
                {
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  marginLeft: -MIN_HIT_SIZE / 2,
                  marginTop: -MIN_HIT_SIZE / 2,
                },
              ]}
              testID={`line-point-hit-${i}`}
            />
          );
        })}
      </View>
      {referenceLines.length > 0 && (
        <View style={styles.refLegendRow}>
          {referenceLines.map((ref) => (
            <View key={ref.key} style={styles.legendItem}>
              <View style={[styles.legendDash, { backgroundColor: ref.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {ref.label} ({valueFormatter ? valueFormatter(ref.value) : ref.value})
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.xAxisRow}>
        {xAxisLabels.map((label, index) => (
          <TouchableOpacity
            key={`${label}-${index}`}
            style={styles.xAxisItem}
            activeOpacity={onPointPress ? 0.6 : 1}
            disabled={!onPointPress}
            onPress={() => onPointPress?.(index)}
          >
            <Text style={styles.xAxisLabel} numberOfLines={1}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.legendRow}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointHitTarget: {
    position: 'absolute',
    width: MIN_HIT_SIZE,
    height: MIN_HIT_SIZE,
    borderRadius: MIN_HIT_SIZE / 2,
  },
  xAxisRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  xAxisItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    minHeight: MIN_HIT_SIZE,
    justifyContent: 'center',
  },
  xAxisLabel: {
    fontSize: 9.5,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    fontWeight: '600' as const,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },
  refLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
});
