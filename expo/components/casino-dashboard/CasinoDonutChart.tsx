import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CASINO_DASHBOARD_COLORS } from '@/constants/casinoDashboardTheme';

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

/**
 * Lightweight SVG donut chart with a legend. Each legend row is tappable
 * for its own drill-down (segments themselves aren't individually
 * touch-targetable on native SVG without extra libraries, so the legend
 * doubles as the tap target, matching the "clickable segment" requirement).
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

  return (
    <View style={styles.row}>
      <View style={styles.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={CASINO_DASHBOARD_COLORS.border}
            strokeWidth={STROKE}
            fill="none"
          />
          {total > 0 && segments.map((segment) => {
            const fraction = Math.max(0, segment.value) / total;
            const dash = fraction * CIRCUMFERENCE;
            const offset = CIRCUMFERENCE - cumulative;
            cumulative += dash;
            if (fraction <= 0) return null;
            return (
              <Circle
                key={segment.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={segment.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                fill="none"
                rotation={-90}
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            );
          })}
        </Svg>
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
