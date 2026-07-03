import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS } from '@/constants/darkRoyalTheme';

export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  onPress?: () => void;
};

const SIZE = 148;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MIN_HIT_SIZE = 32;

/**
 * Lightweight SVG donut chart with a legend. Each arc segment now has a
 * real, invisible ~32x32 touch target positioned at its own arc midpoint
 * (via trigonometry, since native SVG shapes can't take onPress hit-testing
 * on their own), in addition to the legend row — matching the "tap the
 * visual point/segment or the legend" requirement.
 */
export function CasinoDonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  let cumulative = 0;
  const center = SIZE / 2;

  const arcs = segments.map((segment) => {
    const fraction = total > 0 ? Math.max(0, segment.value) / total : 0;
    const dash = fraction * CIRCUMFERENCE;
    const offset = CIRCUMFERENCE - cumulative;
    const startAngle = (cumulative / CIRCUMFERENCE) * 360 - 90;
    const midAngle = startAngle + (fraction * 360) / 2;
    cumulative += dash;
    return { segment, fraction, dash, offset, midAngle };
  });

  return (
    <View style={styles.row}>
      <View style={styles.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={center}
            cy={center}
            r={RADIUS}
            stroke={CASINO_DASHBOARD_COLORS.border}
            strokeWidth={STROKE}
            fill="none"
          />
          {arcs.map(({ segment, fraction, dash, offset }) => {
            if (fraction <= 0) return null;
            return (
              <Circle
                key={segment.key}
                cx={center}
                cy={center}
                r={RADIUS}
                stroke={segment.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                fill="none"
                rotation={-90}
                origin={`${center}, ${center}`}
              />
            );
          })}
        </Svg>
        {arcs.map(({ segment, fraction, midAngle }) => {
          if (fraction <= 0 || !segment.onPress) return null;
          const rad = (midAngle * Math.PI) / 180;
          const x = center + RADIUS * Math.cos(rad);
          const y = center + RADIUS * Math.sin(rad);
          return (
            <TouchableOpacity
              key={`hit-${segment.key}`}
              onPress={segment.onPress}
              activeOpacity={0.6}
              hitSlop={6}
              style={[
                styles.arcHitTarget,
                { left: x - MIN_HIT_SIZE / 2, top: y - MIN_HIT_SIZE / 2 },
              ]}
              testID={`donut-segment-hit-${segment.key}`}
            />
          );
        })}
        <View style={styles.centerLabelWrap} pointerEvents="none">
          <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>{centerValue}</Text>
          <Text style={styles.centerLabel} numberOfLines={1}>{centerLabel}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {segments.map((segment) => (
          <TouchableOpacity
            key={segment.key}
            style={styles.legendRow}
            activeOpacity={segment.onPress ? 0.7 : 1}
            onPress={segment.onPress}
            disabled={!segment.onPress}
            testID={`donut-legend-${segment.key}`}
          >
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>{segment.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  chartWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcHitTarget: {
    position: 'absolute',
    width: MIN_HIT_SIZE,
    height: MIN_HIT_SIZE,
    borderRadius: MIN_HIT_SIZE / 2,
  },
  centerLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE - STROKE * 2,
  },
  centerValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: CASINO_DASHBOARD_COLORS.deepNavy,
  },
  centerLabel: {
    fontSize: 10.5,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    marginTop: 2,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_HIT_SIZE,
    paddingVertical: 4,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendLabel: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: CASINO_DASHBOARD_COLORS.darkText,
    flexShrink: 1,
  },
});
