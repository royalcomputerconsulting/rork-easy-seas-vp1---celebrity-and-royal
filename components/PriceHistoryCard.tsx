import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { TrendingDown, TrendingUp, Minus, RefreshCw, BarChart3, Calendar } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/state/AuthProvider';
import { trpcClient, isBackendAvailable } from '@/lib/trpc';

interface PriceSnapshot {
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  capturedDate: string;
  capturedAt: string;
  prices: {
    interior?: number;
    oceanview?: number;
    balcony?: number;
    suite?: number;
    juniorSuite?: number;
    grandSuite?: number;
  };
  taxesFees?: number;
  source: string;
}

interface PriceHistoryCardProps {
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  currentPrices?: {
    interior?: number;
    oceanview?: number;
    balcony?: number;
    suite?: number;
  };
}

type CabinFilter = 'interior' | 'oceanview' | 'balcony' | 'suite' | 'all';

const CABIN_COLORS: Record<string, string> = {
  interior: '#6B7280',
  oceanview: '#0097A7',
  balcony: '#059669',
  suite: '#D4A00A',
  juniorSuite: '#F59E0B',
  grandSuite: '#DC2626',
};

const CABIN_LABELS: Record<string, string> = {
  interior: 'Interior',
  oceanview: 'Oceanview',
  balcony: 'Balcony',
  suite: 'Suite',
  juniorSuite: 'Jr. Suite',
  grandSuite: 'Grand Suite',
};

export default function PriceHistoryCard({ cruiseKey, shipName, sailDate, currentPrices }: PriceHistoryCardProps) {
  const { authenticatedEmail } = useAuth();
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCabin, setSelectedCabin] = useState<CabinFilter>('all');

  const fetchHistory = useCallback(async () => {
    if (!authenticatedEmail || !isBackendAvailable()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await trpcClient.priceTracking.getHistory.query({
        userId: authenticatedEmail,
        cruiseKey,
      });
      setSnapshots(result as PriceSnapshot[]);
      console.log('[PriceHistoryCard] Loaded', result.length, 'snapshots for', cruiseKey);
    } catch (err) {
      console.error('[PriceHistoryCard] Failed to fetch history:', err);
      setError('Unable to load price history');
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedEmail, cruiseKey]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const availableCabins = useMemo(() => {
    const cabins = new Set<string>();
    for (const snap of snapshots) {
      if (snap.prices) {
        for (const [key, val] of Object.entries(snap.prices)) {
          if (val && val > 0) cabins.add(key);
        }
      }
    }
    return Array.from(cabins);
  }, [snapshots]);

  const priceChanges = useMemo(() => {
    if (snapshots.length < 2) return [];

    const changes: Array<{
      cabin: string;
      firstPrice: number;
      latestPrice: number;
      change: number;
      changePercent: number;
      trend: 'up' | 'down' | 'stable';
    }> = [];

    for (const cabin of availableCabins) {
      const pricesOverTime = snapshots
        .filter(s => s.prices?.[cabin as keyof PriceSnapshot['prices']] && (s.prices[cabin as keyof PriceSnapshot['prices']] as number) > 0)
        .sort((a, b) => a.capturedDate.localeCompare(b.capturedDate));

      if (pricesOverTime.length >= 2) {
        const first = pricesOverTime[0].prices[cabin as keyof PriceSnapshot['prices']] as number;
        const latest = pricesOverTime[pricesOverTime.length - 1].prices[cabin as keyof PriceSnapshot['prices']] as number;
        const change = latest - first;
        const changePercent = (change / first) * 100;

        changes.push({
          cabin,
          firstPrice: first,
          latestPrice: latest,
          change,
          changePercent,
          trend: Math.abs(changePercent) < 1 ? 'stable' : change < 0 ? 'down' : 'up',
        });
      }
    }

    return changes;
  }, [snapshots, availableCabins]);

  const chartData = useMemo(() => {
    if (snapshots.length === 0) return [];

    const sorted = [...snapshots].sort((a, b) => a.capturedDate.localeCompare(b.capturedDate));

    return sorted.map(snap => ({
      date: snap.capturedDate,
      displayDate: new Date(snap.capturedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      prices: snap.prices,
    }));
  }, [snapshots]);

  const filteredChartData = useMemo(() => {
    if (selectedCabin === 'all') return chartData;
    return chartData.filter(d => {
      const price = d.prices[selectedCabin as keyof typeof d.prices];
      return price && price > 0;
    });
  }, [chartData, selectedCabin]);

  const priceRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (const point of filteredChartData) {
      const cabins = selectedCabin === 'all' ? availableCabins : [selectedCabin];
      for (const cabin of cabins) {
        const price = point.prices[cabin as keyof typeof point.prices];
        if (price && price > 0) {
          min = Math.min(min, price);
          max = Math.max(max, price);
        }
      }
    }

    if (min === Infinity) return { min: 0, max: 100 };
    const padding = (max - min) * 0.15 || 50;
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [filteredChartData, selectedCabin, availableCabins]);

  if (!isBackendAvailable()) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BarChart3 size={16} color={COLORS.navy} />
          <Text style={styles.title}>Price Tracking</Text>
        </View>
        <ActivityIndicator size="small" color={COLORS.navy} style={{ padding: SPACING.lg }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BarChart3 size={16} color={COLORS.navy} />
          <Text style={styles.title}>Price Tracking</Text>
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchHistory} style={styles.retryButton}>
          <RefreshCw size={14} color={COLORS.navy} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (snapshots.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BarChart3 size={16} color={COLORS.navy} />
          <Text style={styles.title}>Price Tracking</Text>
        </View>
        <View style={styles.emptyState}>
          <Calendar size={28} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No price history yet</Text>
          <Text style={styles.emptySubtitle}>Prices will be tracked automatically each time you sync with Royal Caribbean</Text>
        </View>
      </View>
    );
  }

  const chartHeight = 120;
  const chartWidth = filteredChartData.length * 48;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BarChart3 size={16} color={COLORS.navy} />
          <Text style={styles.title}>Price Tracking</Text>
        </View>
        <TouchableOpacity onPress={fetchHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <RefreshCw size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} recorded
      </Text>

      {availableCabins.length > 1 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCabin === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedCabin('all')}
          >
            <Text style={[styles.filterChipText, selectedCabin === 'all' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {availableCabins.map(cabin => (
            <TouchableOpacity
              key={cabin}
              style={[
                styles.filterChip,
                selectedCabin === cabin && styles.filterChipActive,
                selectedCabin === cabin && { backgroundColor: CABIN_COLORS[cabin] || COLORS.navy },
              ]}
              onPress={() => setSelectedCabin(cabin as CabinFilter)}
            >
              <Text style={[
                styles.filterChipText,
                selectedCabin === cabin && styles.filterChipTextActive,
              ]}>
                {CABIN_LABELS[cabin] || cabin}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filteredChartData.length >= 2 && (
        <View style={styles.miniChart}>
          <View style={styles.chartYAxis}>
            <Text style={styles.chartAxisLabel}>{formatCurrency(priceRange.max)}</Text>
            <Text style={styles.chartAxisLabel}>{formatCurrency(priceRange.min)}</Text>
          </View>
          <View style={styles.chartArea}>
            {(selectedCabin === 'all' ? availableCabins : [selectedCabin]).map(cabin => {
              const points = filteredChartData
                .map((d, i) => {
                  const price = d.prices[cabin as keyof typeof d.prices];
                  if (!price || price <= 0) return null;
                  const x = (i / (filteredChartData.length - 1)) * 100;
                  const y = ((price - priceRange.min) / (priceRange.max - priceRange.min)) * 100;
                  return { x, y: 100 - y, price, date: d.displayDate };
                })
                .filter(Boolean) as Array<{ x: number; y: number; price: number; date: string }>;

              if (points.length < 2) return null;

              return (
                <View key={cabin} style={StyleSheet.absoluteFill}>
                  {points.map((point, i) => {
                    if (i === 0) return null;
                    const prev = points[i - 1];
                    return (
                      <View
                        key={`line-${cabin}-${i}`}
                        style={[
                          styles.chartLine,
                          {
                            left: `${prev.x}%` as any,
                            top: `${(prev.y + point.y) / 2}%` as any,
                            width: `${point.x - prev.x}%` as any,
                            borderColor: CABIN_COLORS[cabin] || COLORS.navy,
                            transform: [{ rotate: `${Math.atan2(point.y - prev.y, point.x - prev.x) * (180 / Math.PI)}deg` }],
                          },
                        ]}
                      />
                    );
                  })}
                  {points.map((point, i) => (
                    <View
                      key={`dot-${cabin}-${i}`}
                      style={[
                        styles.chartDot,
                        {
                          left: `${point.x}%` as any,
                          top: `${point.y}%` as any,
                          backgroundColor: CABIN_COLORS[cabin] || COLORS.navy,
                        },
                      ]}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {filteredChartData.length >= 2 && (
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{filteredChartData[0].displayDate}</Text>
          <Text style={styles.dateLabel}>{filteredChartData[filteredChartData.length - 1].displayDate}</Text>
        </View>
      )}

      {priceChanges.length > 0 && (
        <View style={styles.changesSection}>
          <Text style={styles.changesSectionTitle}>Price Changes (First → Latest)</Text>
          {priceChanges.map(change => (
            <View key={change.cabin} style={styles.changeRow}>
              <View style={[styles.cabinDot, { backgroundColor: CABIN_COLORS[change.cabin] || COLORS.navy }]} />
              <Text style={styles.changeCabinLabel}>{CABIN_LABELS[change.cabin] || change.cabin}</Text>
              <View style={styles.changePrices}>
                <Text style={styles.changeOldPrice}>{formatCurrency(change.firstPrice)}</Text>
                <Text style={styles.changeArrow}>→</Text>
                <Text style={styles.changeNewPrice}>{formatCurrency(change.latestPrice)}</Text>
              </View>
              <View style={[
                styles.changeBadge,
                change.trend === 'down' ? styles.changeBadgeDown :
                change.trend === 'up' ? styles.changeBadgeUp : styles.changeBadgeStable,
              ]}>
                {change.trend === 'down' ? (
                  <TrendingDown size={10} color="#059669" />
                ) : change.trend === 'up' ? (
                  <TrendingUp size={10} color="#DC2626" />
                ) : (
                  <Minus size={10} color="#6B7280" />
                )}
                <Text style={[
                  styles.changeBadgeText,
                  change.trend === 'down' ? styles.changeBadgeTextDown :
                  change.trend === 'up' ? styles.changeBadgeTextUp : styles.changeBadgeTextStable,
                ]}>
                  {change.trend === 'stable' ? '—' : `${Math.abs(change.changePercent).toFixed(1)}%`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {availableCabins.length > 0 && (
        <View style={styles.legend}>
          {availableCabins.map(cabin => (
            <View key={cabin} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CABIN_COLORS[cabin] || COLORS.navy }]} />
              <Text style={styles.legendLabel}>{CABIN_LABELS[cabin] || cabin}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navy,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    textAlign: 'center' as const,
    paddingVertical: SPACING.sm,
  },
  retryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 12,
    color: COLORS.navy,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: SPACING.lg,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  emptySubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center' as const,
    paddingHorizontal: SPACING.md,
  },
  filterRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  filterChipText: {
    fontSize: 11,
    color: COLORS.textDarkGrey,
    fontWeight: '500' as const,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  miniChart: {
    flexDirection: 'row' as const,
    height: 120,
    marginBottom: 4,
  },
  chartYAxis: {
    width: 50,
    justifyContent: 'space-between' as const,
    paddingVertical: 2,
  },
  chartAxisLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  chartArea: {
    flex: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    position: 'relative' as const,
  },
  chartLine: {
    position: 'absolute' as const,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'solid' as const,
  },
  chartDot: {
    position: 'absolute' as const,
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
  },
  dateRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingLeft: 50,
    marginBottom: SPACING.sm,
  },
  dateLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  changesSection: {
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  changesSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
    marginBottom: 6,
  },
  changeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 5,
    gap: 6,
  },
  cabinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  changeCabinLabel: {
    fontSize: 11,
    color: COLORS.textDarkGrey,
    fontWeight: '500' as const,
    width: 65,
  },
  changePrices: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    flex: 1,
  },
  changeOldPrice: {
    fontSize: 11,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  changeArrow: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  changeNewPrice: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  changeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  changeBadgeDown: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
  },
  changeBadgeUp: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  changeBadgeStable: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  changeBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  changeBadgeTextDown: {
    color: '#059669',
  },
  changeBadgeTextUp: {
    color: '#DC2626',
  },
  changeBadgeTextStable: {
    color: '#6B7280',
  },
  legend: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
});
