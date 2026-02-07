import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  History,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { usePriceHistory } from '@/state/PriceHistoryProvider';
import type { PriceHistoryRecord, PriceDropAlert } from '@/types/models';

interface PriceHistoryCardProps {
  cruiseKey?: string;
  shipName?: string;
  sailDate?: string;
  compact?: boolean;
  onViewDetails?: (cruiseKey: string) => void;
}

interface PriceTrendIndicatorProps {
  current: number;
  previous: number;
  size?: number;
}

function PriceTrendIndicator({ current, previous, size = 16 }: PriceTrendIndicatorProps) {
  if (current < previous) {
    const drop = previous - current;
    const pct = ((drop / previous) * 100).toFixed(1);
    return (
      <View style={trendStyles.dropContainer}>
        <TrendingDown size={size} color={COLORS.success} />
        <Text style={trendStyles.dropText}>-${drop.toLocaleString()} ({pct}%)</Text>
      </View>
    );
  }
  if (current > previous) {
    const rise = current - previous;
    const pct = ((rise / previous) * 100).toFixed(1);
    return (
      <View style={trendStyles.riseContainer}>
        <TrendingUp size={size} color={COLORS.error} />
        <Text style={trendStyles.riseText}>+${rise.toLocaleString()} ({pct}%)</Text>
      </View>
    );
  }
  return (
    <View style={trendStyles.stableContainer}>
      <Minus size={size} color={COLORS.textMuted} />
      <Text style={trendStyles.stableText}>No change</Text>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  dropContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  dropText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.success,
  },
  riseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  riseText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.error,
  },
  stableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  stableText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textMuted,
  },
});

function PriceHistoryTimeline({ records }: { records: PriceHistoryRecord[] }) {
  if (records.length === 0) return null;

  const sorted = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  const displayRecords = sorted.slice(0, 5);

  return (
    <View style={timelineStyles.container}>
      {displayRecords.map((record, index) => {
        const prevRecord = index < displayRecords.length - 1 ? displayRecords[index + 1] : null;
        const dateStr = new Date(record.recordedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <View key={record.id} style={timelineStyles.row}>
            <View style={timelineStyles.dotColumn}>
              <View style={[
                timelineStyles.dot,
                index === 0 && timelineStyles.dotActive,
              ]} />
              {index < displayRecords.length - 1 && (
                <View style={timelineStyles.line} />
              )}
            </View>
            <View style={timelineStyles.content}>
              <View style={timelineStyles.rowHeader}>
                <Text style={timelineStyles.date}>{dateStr}</Text>
                {prevRecord && (
                  <PriceTrendIndicator
                    current={record.totalPrice}
                    previous={prevRecord.totalPrice}
                    size={12}
                  />
                )}
              </View>
              <Text style={timelineStyles.price}>
                ${record.totalPrice.toLocaleString()}
              </Text>
              {record.offerName && (
                <Text style={timelineStyles.offer} numberOfLines={1}>
                  {record.offerName}
                </Text>
              )}
            </View>
          </View>
        );
      })}
      {sorted.length > 5 && (
        <Text style={timelineStyles.moreText}>
          +{sorted.length - 5} more records
        </Text>
      )}
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    minHeight: 48,
  },
  dotColumn: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderMedium,
    marginTop: 4,
  },
  dotActive: {
    backgroundColor: COLORS.navy,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 2,
  },
  content: {
    flex: 1,
    paddingLeft: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  price: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navy,
    marginTop: 2,
  },
  offer: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  moreText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingTop: SPACING.xs,
  },
});

export function PriceHistoryMiniCard({ cruiseKey, onViewDetails }: PriceHistoryCardProps) {
  const { getPriceHistory, getLowestPrice, getLatestPrice } = usePriceHistory();

  const history = useMemo(() => {
    if (!cruiseKey) return [];
    return getPriceHistory(cruiseKey);
  }, [cruiseKey, getPriceHistory]);

  const latest = useMemo(() => {
    if (!cruiseKey) return null;
    return getLatestPrice(cruiseKey);
  }, [cruiseKey, getLatestPrice]);

  const lowest = useMemo(() => {
    if (!cruiseKey) return null;
    return getLowestPrice(cruiseKey);
  }, [cruiseKey, getLowestPrice]);

  if (history.length === 0) return null;

  const isAtLowest = latest && lowest && Math.abs(latest.totalPrice - lowest.totalPrice) < 1;

  return (
    <TouchableOpacity
      style={miniStyles.container}
      onPress={() => cruiseKey && onViewDetails?.(cruiseKey)}
      activeOpacity={0.7}
      testID="priceHistoryMiniCard"
    >
      <View style={miniStyles.header}>
        <View style={miniStyles.iconContainer}>
          <History size={14} color={COLORS.info} />
        </View>
        <Text style={miniStyles.title}>Price History</Text>
        <Text style={miniStyles.count}>{history.length} records</Text>
        <ChevronRight size={14} color={COLORS.textMuted} />
      </View>
      <View style={miniStyles.stats}>
        <View style={miniStyles.stat}>
          <Text style={miniStyles.statLabel}>Current</Text>
          <Text style={miniStyles.statValue}>
            ${latest?.totalPrice.toLocaleString() ?? '—'}
          </Text>
        </View>
        <View style={miniStyles.divider} />
        <View style={miniStyles.stat}>
          <Text style={miniStyles.statLabel}>Lowest</Text>
          <Text style={[miniStyles.statValue, miniStyles.lowestValue]}>
            ${lowest?.totalPrice.toLocaleString() ?? '—'}
          </Text>
        </View>
        {latest && history.length >= 2 && (
          <>
            <View style={miniStyles.divider} />
            <View style={miniStyles.stat}>
              <Text style={miniStyles.statLabel}>Trend</Text>
              <PriceTrendIndicator
                current={latest.totalPrice}
                previous={history[1]?.totalPrice ?? latest.totalPrice}
                size={12}
              />
            </View>
          </>
        )}
      </View>
      {isAtLowest && history.length > 1 && (
        <View style={miniStyles.lowestBadge}>
          <TrendingDown size={12} color={COLORS.success} />
          <Text style={miniStyles.lowestBadgeText}>Currently at lowest tracked price!</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const miniStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 151, 167, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navy,
    flex: 1,
  },
  count: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navy,
  },
  lowestValue: {
    color: COLORS.success,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.borderLight,
  },
  lowestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginTop: SPACING.sm,
  },
  lowestBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.success,
  },
});

export function PriceDropAlertCard({ alert, onDismiss }: { alert: PriceDropAlert; onDismiss?: () => void }) {
  return (
    <View style={alertStyles.container} testID="priceDropAlertCard">
      <View style={alertStyles.header}>
        <View style={alertStyles.iconContainer}>
          <TrendingDown size={16} color={COLORS.success} />
        </View>
        <View style={alertStyles.headerText}>
          <Text style={alertStyles.title}>Price Drop!</Text>
          <Text style={alertStyles.subtitle} numberOfLines={1}>
            {alert.shipName} · {new Date(alert.sailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={alertStyles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={alertStyles.priceRow}>
        <View style={alertStyles.priceItem}>
          <Text style={alertStyles.priceLabel}>Was</Text>
          <Text style={alertStyles.previousPrice}>${alert.previousPrice.toLocaleString()}</Text>
        </View>
        <View style={alertStyles.arrow}>
          <ChevronRight size={16} color={COLORS.textMuted} />
        </View>
        <View style={alertStyles.priceItem}>
          <Text style={alertStyles.priceLabel}>Now</Text>
          <Text style={alertStyles.currentPrice}>${alert.currentPrice.toLocaleString()}</Text>
        </View>
        <View style={alertStyles.savingsContainer}>
          <Text style={alertStyles.savingsLabel}>Save</Text>
          <Text style={alertStyles.savingsValue}>
            ${alert.priceDrop.toLocaleString()} ({alert.priceDropPercent.toFixed(1)}%)
          </Text>
        </View>
      </View>
      <View style={alertStyles.metaRow}>
        <Text style={alertStyles.metaText}>{alert.cabinType} · {alert.destination}</Text>
        {alert.offerName && (
          <Text style={alertStyles.metaText} numberOfLines={1}>{alert.offerName}</Text>
        )}
      </View>
    </View>
  );
}

const alertStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  dismissText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  priceItem: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  previousPrice: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textDecorationLine: 'line-through' as const,
  },
  currentPrice: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  arrow: {
    paddingTop: 10,
  },
  savingsContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  savingsLabel: {
    fontSize: 10,
    color: COLORS.success,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  savingsValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
  },
});

export function PriceDropsSummaryCard({ onViewAll }: { onViewAll?: () => void }) {
  const { getActivePriceDrops, dismissPriceDrop } = usePriceHistory();

  const activeDrops = useMemo(() => getActivePriceDrops(), [getActivePriceDrops]);

  if (activeDrops.length === 0) return null;

  const topDrops = activeDrops.slice(0, 3);
  const totalSavings = activeDrops.reduce((sum, d) => sum + d.priceDrop, 0);

  return (
    <View style={summaryStyles.container} testID="priceDropsSummaryCard">
      <View style={summaryStyles.header}>
        <View style={summaryStyles.headerLeft}>
          <View style={summaryStyles.iconContainer}>
            <AlertTriangle size={16} color={COLORS.success} />
          </View>
          <View>
            <Text style={summaryStyles.title}>Price Drops Detected</Text>
            <Text style={summaryStyles.subtitle}>
              {activeDrops.length} cruise{activeDrops.length !== 1 ? 's' : ''} · Up to ${totalSavings.toLocaleString()} in savings
            </Text>
          </View>
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={summaryStyles.viewAll}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
      {topDrops.map((drop) => (
        <PriceDropAlertCard
          key={drop.cruiseKey}
          alert={drop}
          onDismiss={() => dismissPriceDrop(drop.cruiseKey)}
        />
      ))}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navy,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  viewAll: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.info,
  },
});

export function PriceHistoryDetailCard({ cruiseKey }: { cruiseKey: string }) {
  const { getPriceHistory, getLowestPrice, getHighestPrice, getLatestPrice } = usePriceHistory();

  const history = useMemo(() => getPriceHistory(cruiseKey), [cruiseKey, getPriceHistory]);
  const latest = useMemo(() => getLatestPrice(cruiseKey), [cruiseKey, getLatestPrice]);
  const lowest = useMemo(() => getLowestPrice(cruiseKey), [cruiseKey, getLowestPrice]);
  const highest = useMemo(() => getHighestPrice(cruiseKey), [cruiseKey, getHighestPrice]);

  if (history.length === 0) {
    return (
      <View style={detailStyles.emptyContainer}>
        <History size={24} color={COLORS.textMuted} />
        <Text style={detailStyles.emptyText}>No price history tracked yet</Text>
        <Text style={detailStyles.emptySubtext}>
          Price data will be recorded each time you sync offers
        </Text>
      </View>
    );
  }

  return (
    <View style={detailStyles.container} testID="priceHistoryDetailCard">
      <View style={detailStyles.header}>
        <History size={18} color={COLORS.navy} />
        <Text style={detailStyles.title}>Price Tracking</Text>
        <Text style={detailStyles.badge}>{history.length} snapshots</Text>
      </View>

      <View style={detailStyles.statsRow}>
        <View style={detailStyles.statItem}>
          <Text style={detailStyles.statLabel}>Current</Text>
          <Text style={detailStyles.statValueNavy}>
            ${latest?.totalPrice.toLocaleString() ?? '—'}
          </Text>
        </View>
        <View style={detailStyles.statDivider} />
        <View style={detailStyles.statItem}>
          <Text style={detailStyles.statLabel}>Lowest</Text>
          <Text style={detailStyles.statValueGreen}>
            ${lowest?.totalPrice.toLocaleString() ?? '—'}
          </Text>
        </View>
        <View style={detailStyles.statDivider} />
        <View style={detailStyles.statItem}>
          <Text style={detailStyles.statLabel}>Highest</Text>
          <Text style={detailStyles.statValueRed}>
            ${highest?.totalPrice.toLocaleString() ?? '—'}
          </Text>
        </View>
      </View>

      {lowest && highest && lowest.totalPrice !== highest.totalPrice && (
        <View style={detailStyles.rangeBar}>
          <View style={detailStyles.rangeTrack}>
            <View
              style={[
                detailStyles.rangeIndicator,
                {
                  left: latest
                    ? `${Math.max(0, Math.min(100, ((latest.totalPrice - lowest.totalPrice) / (highest.totalPrice - lowest.totalPrice)) * 100))}%`
                    : '0%',
                },
              ]}
            />
          </View>
          <View style={detailStyles.rangeLabels}>
            <Text style={detailStyles.rangeLabel}>${lowest.totalPrice.toLocaleString()}</Text>
            <Text style={detailStyles.rangeLabel}>${highest.totalPrice.toLocaleString()}</Text>
          </View>
        </View>
      )}

      <PriceHistoryTimeline records={history} />
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navy,
    flex: 1,
  },
  badge: {
    fontSize: 11,
    color: COLORS.info,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    backgroundColor: 'rgba(0, 151, 167, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValueNavy: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navy,
  },
  statValueGreen: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  statValueRed: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.error,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.borderLight,
  },
  rangeBar: {
    marginBottom: SPACING.md,
  },
  rangeTrack: {
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    position: 'relative' as const,
  },
  rangeIndicator: {
    position: 'absolute' as const,
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.navy,
    marginLeft: -6,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  rangeLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: 8,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
