import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS } from '@/constants/darkRoyalTheme';

export type BarGroup = {
  key: string;
  label: string;
  bars: { key: string; value: number; color: string; onPress?: () => void }[];
  onPress?: () => void;
};

const CHART_HEIGHT = 120;

/**
 * Simple grouped bar chart built from plain Views (no SVG needed). Each
 * group (e.g. a calendar year) is tappable to drill into that year's
 * records, matching the "every bar must be clickable" requirement.
 */
export function CasinoGroupedBarChart({
  groups,
  barLabels,
}: {
  groups: BarGroup[];
  barLabels: { key: string; label: string; color: string }[];
}) {
  const maxValue = Math.max(1, ...groups.flatMap((g) => g.bars.map((b) => Math.abs(b.value))));

  return (
    <View>
      <View style={styles.chartRow}>
        {groups.map((group) => (
          <TouchableOpacity
            key={group.key}
            style={styles.groupColumn}
            activeOpacity={group.onPress ? 0.7 : 1}
            onPress={group.onPress}
            disabled={!group.onPress}
          >
            <View style={styles.barsRow}>
              {group.bars.map((bar) => (
                bar.onPress ? (
                  <TouchableOpacity
                    key={bar.key}
                    activeOpacity={0.6}
                    onPress={bar.onPress}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    style={[
                      styles.bar,
                      {
                        height: Math.max(3, (Math.abs(bar.value) / maxValue) * CHART_HEIGHT),
                        backgroundColor: bar.color,
                      },
                    ]}
                    testID={`chart-bar-${group.key}-${bar.key}`}
                  />
                ) : (
                  <View
                    key={bar.key}
                    style={[
                      styles.bar,
                      {
                        height: Math.max(3, (Math.abs(bar.value) / maxValue) * CHART_HEIGHT),
                        backgroundColor: bar.color,
                      },
                    ]}
                  />
                )
              ))}
            </View>
            <Text style={styles.groupLabel} numberOfLines={1}>{group.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.legendRow}>
        {barLabels.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: CHART_HEIGHT + 24,
    paddingTop: 8,
  },
  groupColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: CHART_HEIGHT,
  },
  bar: {
    width: 10,
    borderRadius: 3,
  },
  groupLabel: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    fontWeight: '600' as const,
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
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
  legendText: {
    fontSize: 11.5,
    fontWeight: '600' as const,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
});
