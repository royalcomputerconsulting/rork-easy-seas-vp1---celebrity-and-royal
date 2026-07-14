import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, TrendingDown, TrendingUp, DollarSign, Calendar, Ship, AlertCircle } from 'lucide-react-native';
import { useCoreData } from '@/state/CoreDataProvider';
import { usePriceTracking } from '@/state/PriceTrackingProvider';
import { COLORS, SPACING } from '@/constants/theme';
import { generateCruiseKey } from '@/types/models';

export default function PricingSummaryScreen() {
  const router = useRouter();
  const { bookedCruises } = useCoreData();
  const { priceHistory, priceDrops, getCruisePricingStatus, getPriceHistoryForCruise } = usePriceTracking();
  const [selectedView, setSelectedView] = useState<'summary' | 'drops' | 'history'>('summary');

  const upcomingCruises = useMemo(() => {
    return bookedCruises.filter(cruise => {
      const sailDate = new Date(cruise.sailDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return sailDate >= today && cruise.completionState !== 'completed';
    });
  }, [bookedCruises]);

  const pricingStats = useMemo(() => {
    const stats = {
      complete: 0,
      partial: 0,
      missing: 0,
      totalTracked: priceHistory.length,
      totalDrops: priceDrops.length,
      totalSavings: 0,
    };

    upcomingCruises.forEach(cruise => {
      const status = getCruisePricingStatus(cruise);
      if (status.completeness === 100) {
        stats.complete++;
      } else if (status.completeness > 0) {
        stats.partial++;
      } else {
        stats.missing++;
      }
    });

    priceDrops.forEach(drop => {
      stats.totalSavings += drop.priceDrop;
    });

    return stats;
  }, [upcomingCruises, getCruisePricingStatus, priceHistory.length, priceDrops]);

  const cruiseDetails = useMemo(() => {
    return upcomingCruises.map(cruise => {
      const status = getCruisePricingStatus(cruise);
      const cruiseKey = generateCruiseKey(cruise.shipName, cruise.sailDate, cruise.cabinType || 'unknown');
      const history = getPriceHistoryForCruise(cruiseKey);
      const drops = priceDrops.filter(d => d.cruiseKey === cruiseKey);

      return {
        cruise,
        status,
        history,
        drops,
        cruiseKey,
      };
    });
  }, [upcomingCruises, getCruisePricingStatus, getPriceHistoryForCruise, priceDrops]);

  const sortedCruises = useMemo(() => {
    return [...cruiseDetails].sort((a, b) => b.status.completeness - a.status.completeness);
  }, [cruiseDetails]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderSummaryView = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#E8F5E9' }]}>
            <DollarSign color="#2E7D32" size={24} />
          </View>
          <Text style={styles.statValue}>{stats.complete}</Text>
          <Text style={styles.statLabel}>Complete Data</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FFF3E0' }]}>
            <AlertCircle color="#F57C00" size={24} />
          </View>
          <Text style={styles.statValue}>{stats.partial}</Text>
          <Text style={styles.statLabel}>Partial Data</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FCE4EC' }]}>
            <TrendingDown color="#C2185B" size={24} />
          </View>
          <Text style={styles.statValue}>{stats.totalDrops}</Text>
          <Text style={styles.statLabel}>Price Drops</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#E3F2FD' }]}>
            <TrendingUp color="#1565C0" size={24} />
          </View>
          <Text style={styles.statValue}>{formatPrice(stats.totalSavings)}</Text>
          <Text style={styles.statLabel}>Total Savings</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cruise Pricing Status</Text>
        {sortedCruises.map(({ cruise, status, history, drops }) => (
          <View key={cruise.id} style={styles.cruiseCard}>
            <View style={styles.cruiseHeader}>
              <Ship color={COLORS.navy} size={18} />
              <View style={styles.cruiseInfo}>
                <Text style={styles.cruiseName} numberOfLines={1}>
                  {cruise.shipName}
                </Text>
                <Text style={styles.cruiseDate}>
                  {formatDate(cruise.sailDate)} • {cruise.nights}N
                </Text>
              </View>
              <View style={[
                styles.completenessIndicator,
                { backgroundColor: status.completeness === 100 ? '#4CAF50' : status.completeness > 50 ? '#FF9800' : '#F44336' }
              ]}>
                <Text style={styles.completenessText}>{status.completeness}%</Text>
              </View>
            </View>

            {status.missingFields.length > 0 && (
              <View style={styles.missingFields}>
                <Text style={styles.missingLabel}>Missing:</Text>
                <Text style={styles.missingText}>{status.missingFields.join(', ')}</Text>
              </View>
            )}

            {history.length > 0 && (
              <View style={styles.historyInfo}>
                <Text style={styles.historyLabel}>
                  📊 {history.length} price {history.length === 1 ? 'record' : 'records'} tracked
                </Text>
              </View>
            )}

            {drops.length > 0 && (
              <View style={styles.dropInfo}>
                <TrendingDown color="#4CAF50" size={16} />
                <Text style={styles.dropText}>
                  {drops.length} price {drops.length === 1 ? 'drop' : 'drops'} detected! Save {formatPrice(drops.reduce((sum, d) => sum + d.priceDrop, 0))}
                </Text>
              </View>
            )}

            <View style={styles.priceDetails}>
              {cruise.price !== undefined && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Base Price:</Text>
                  <Text style={styles.priceValue}>{formatPrice(cruise.price)}</Text>
                </View>
              )}
              {cruise.taxes !== undefined && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Taxes:</Text>
                  <Text style={styles.priceValue}>{formatPrice(cruise.taxes)}</Text>
                </View>
              )}
              {(cruise.freePlay || 0) > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Free Play:</Text>
                  <Text style={[styles.priceValue, styles.perkValue]}>{formatPrice(cruise.freePlay || 0)}</Text>
                </View>
              )}
              {(cruise.freeOBC || 0) > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>OBC:</Text>
                  <Text style={[styles.priceValue, styles.perkValue]}>{formatPrice(cruise.freeOBC || 0)}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderPriceDropsView = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Price Drops</Text>
        {priceDrops.length === 0 ? (
          <View style={styles.emptyState}>
            <TrendingDown color={COLORS.textSecondary} size={48} />
            <Text style={styles.emptyText}>No price drops detected yet</Text>
            <Text style={styles.emptySubtext}>We&apos;ll notify you when prices drop on tracked cruises</Text>
          </View>
        ) : (
          priceDrops.map((drop, index) => (
            <View key={`${drop.cruiseKey}_${index}`} style={styles.dropCard}>
              <View style={styles.dropHeader}>
                <View style={styles.dropIcon}>
                  <TrendingDown color="#4CAF50" size={24} />
                </View>
                <View style={styles.dropInfo}>
                  <Text style={styles.dropShipName}>{drop.shipName}</Text>
                  <Text style={styles.dropDate}>{formatDate(drop.sailDate)}</Text>
                </View>
                <View style={styles.dropSavings}>
                  <Text style={styles.dropSavingsAmount}>{formatPrice(drop.priceDrop)}</Text>
                  <Text style={styles.dropSavingsLabel}>saved</Text>
                </View>
              </View>

              <View style={styles.dropDetails}>
                <View style={styles.priceCompare}>
                  <View style={styles.priceColumn}>
                    <Text style={styles.priceCompareLabel}>Was</Text>
                    <Text style={styles.priceCompareOld}>{formatPrice(drop.previousPrice)}</Text>
                  </View>
                  <TrendingDown color="#4CAF50" size={20} />
                  <View style={styles.priceColumn}>
                    <Text style={styles.priceCompareLabel}>Now</Text>
                    <Text style={styles.priceCompareNew}>{formatPrice(drop.currentPrice)}</Text>
                  </View>
                </View>

                <View style={styles.dropMeta}>
                  <Text style={styles.dropMetaText}>
                    {drop.priceDropPercent.toFixed(1)}% decrease • {drop.cabinType}
                  </Text>
                  <Text style={styles.dropMetaDate}>
                    Detected {formatDate(drop.currentRecordedAt)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderHistoryView = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price History</Text>
        <Text style={styles.sectionSubtitle}>
          {priceHistory.length} total price {priceHistory.length === 1 ? 'record' : 'records'} tracked
        </Text>
        {priceHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar color={COLORS.textSecondary} size={48} />
            <Text style={styles.emptyText}>No price history yet</Text>
            <Text style={styles.emptySubtext}>Price snapshots will appear here as cruises are tracked</Text>
          </View>
        ) : (
          priceHistory
            .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
            .map((record) => (
              <View key={record.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View>
                    <Text style={styles.historyShipName}>{record.shipName}</Text>
                    <Text style={styles.historyDate}>{formatDate(record.sailDate)}</Text>
                  </View>
                  <Text style={styles.historyPrice}>{formatPrice(record.totalPrice)}</Text>
                </View>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyMetaText}>
                    {record.cabinType} • {record.nights}N
                  </Text>
                  <Text style={styles.historyMetaDate}>
                    Recorded {formatDate(record.recordedAt)}
                  </Text>
                </View>
              </View>
            ))
        )}
      </View>
    </ScrollView>
  );

  const stats = pricingStats;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pricing Summary</Text>
          <Text style={styles.subtitle}>{upcomingCruises.length} upcoming cruises tracked</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedView === 'summary' && styles.tabActive]}
          onPress={() => setSelectedView('summary')}
        >
          <Text style={[styles.tabText, selectedView === 'summary' && styles.tabTextActive]}>
            Summary
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedView === 'drops' && styles.tabActive]}
          onPress={() => setSelectedView('drops')}
        >
          <Text style={[styles.tabText, selectedView === 'drops' && styles.tabTextActive]}>
            Price Drops
          </Text>
          {priceDrops.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{priceDrops.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedView === 'history' && styles.tabActive]}
          onPress={() => setSelectedView('history')}
        >
          <Text style={[styles.tabText, selectedView === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {selectedView === 'summary' && renderSummaryView()}
      {selectedView === 'drops' && renderPriceDropsView()}
      {selectedView === 'history' && renderHistoryView()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navy,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.gold,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.navy,
  },
  badge: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navy,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  section: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navy,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  cruiseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cruiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  cruiseInfo: {
    flex: 1,
  },
  cruiseName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navy,
    marginBottom: 2,
  },
  cruiseDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  completenessIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completenessText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  missingFields: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  missingLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#F57C00',
    marginBottom: 2,
  },
  missingText: {
    fontSize: 12,
    color: '#E65100',
  },
  historyInfo: {
    paddingVertical: 6,
  },
  historyLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  dropInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    gap: 6,
  },
  dropText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2E7D32',
    flex: 1,
  },
  priceDetails: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navy,
  },
  perkValue: {
    color: '#4CAF50',
  },
  dropCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderLeftWidth: 4,
  },
  dropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  dropIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropShipName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navy,
  },
  dropDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  dropSavings: {
    alignItems: 'flex-end',
  },
  dropSavingsAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4CAF50',
  },
  dropSavingsLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  dropDetails: {
    gap: SPACING.sm,
  },
  priceCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: SPACING.md,
  },
  priceColumn: {
    flex: 1,
    alignItems: 'center',
  },
  priceCompareLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  priceCompareOld: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  priceCompareNew: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4CAF50',
  },
  dropMeta: {
    gap: 4,
  },
  dropMetaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  dropMetaDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  historyShipName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLORS.navy,
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  historyPrice: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navy,
  },
  historyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  historyMetaDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});
