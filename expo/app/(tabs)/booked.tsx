import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Plus, Trophy } from 'lucide-react-native';
import { AddBookedCruiseModal } from '@/components/AddBookedCruiseModal';
import { CrownAnchorTimeline } from '@/components/CrownAnchorTimeline';
import {
  PremiumActionBar,
  PremiumChipBar,
  PremiumEmptyState,
  PremiumEntityCard,
  PremiumHeroCard,
  PremiumPageBackground,
  PremiumQuickFacts,
  PremiumStatGrid,
} from '../../components/cruise/UnifiedCruiseSystem';
import { APP_TEXTURE, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import { createDateFromString, formatDate, isDateInPast } from '@/lib/date';
import { calculatePortfolioValue } from '@/lib/valueCalculator';
import { createCruiseListKey } from '@/lib/listKeys';
import {
  buildCruiseCardFields,
  pickCruiseImage,
  type DisplayField,
} from '../../lib/cruisePresentation';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import type { BookedCruise } from '@/types/models';

type FilterType = 'all' | 'upcoming' | 'completed' | 'celebrity';
type SortType = 'next' | 'newest' | 'oldest' | 'ship' | 'nights';
type ViewMode = 'list' | 'timeline' | 'points';

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Celebrity', value: 'celebrity' },
];

const SORT_OPTIONS: { label: string; value: SortType }[] = [
  { label: 'Next Sailing', value: 'next' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Ship', value: 'ship' },
  { label: 'Nights', value: 'nights' },
];

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: 'List', value: 'list' },
  { label: 'Timeline', value: 'timeline' },
  { label: 'C&A', value: 'points' },
];

export default function BookedScreen() {
  const router = useRouter();
  const { localData, clubRoyaleProfile, isLoading: appLoading, refreshData } = useAppState();
  const { addBookedCruise, bookedCruises: storedBooked } = useCoreData();
  const { casinoAnalytics } = useSimpleAnalytics();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    crownAnchorPoints,
  } = useLoyalty();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('next');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const bookedCruises = useMemo<BookedCruise[]>(() => {
    const localBooked = localData.booked || [];
    if (localBooked.length > 0) {
      return localBooked;
    }
    return storedBooked.length > 0 ? storedBooked : [];
  }, [localData.booked, storedBooked]);

  const filteredCruises = useMemo<BookedCruise[]>(() => {
    let result = [...bookedCruises];

    if (filter === 'upcoming') {
      result = result.filter((cruise) => !isDateInPast(cruise.returnDate));
    } else if (filter === 'completed') {
      result = result.filter((cruise) => isDateInPast(cruise.returnDate));
    } else if (filter === 'celebrity') {
      result = result.filter((cruise) => cruise.cruiseSource === 'celebrity' || cruise.shipName?.toLowerCase().startsWith('celebrity'));
    }

    if (hideCompleted) {
      result = result.filter((cruise) => !isDateInPast(cruise.returnDate));
    }

    const query = searchQuery.trim().toLowerCase();
    if (query.length > 0) {
      result = result.filter((cruise) => (
        cruise.shipName?.toLowerCase().includes(query) ||
        cruise.destination?.toLowerCase().includes(query) ||
        cruise.departurePort?.toLowerCase().includes(query) ||
        cruise.reservationNumber?.toLowerCase().includes(query) ||
        cruise.itineraryName?.toLowerCase().includes(query) ||
        cruise.bookingId?.toLowerCase().includes(query)
      ));
    }

    switch (sortBy) {
      case 'next': {
        const now = new Date();
        result.sort((left, right) => {
          const leftDate = createDateFromString(left.sailDate);
          const rightDate = createDateFromString(right.sailDate);
          const leftUpcoming = leftDate >= now;
          const rightUpcoming = rightDate >= now;
          if (leftUpcoming && rightUpcoming) return leftDate.getTime() - rightDate.getTime();
          if (!leftUpcoming && !rightUpcoming) return rightDate.getTime() - leftDate.getTime();
          return leftUpcoming ? -1 : 1;
        });
        break;
      }
      case 'newest':
        result.sort((left, right) => createDateFromString(right.sailDate).getTime() - createDateFromString(left.sailDate).getTime());
        break;
      case 'oldest':
        result.sort((left, right) => createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime());
        break;
      case 'ship':
        result.sort((left, right) => (left.shipName || '').localeCompare(right.shipName || ''));
        break;
      case 'nights':
        result.sort((left, right) => (right.nights || 0) - (left.nights || 0));
        break;
    }

    return result;
  }, [bookedCruises, filter, hideCompleted, searchQuery, sortBy]);

  const currentPoints = loyaltyClubRoyalePoints || clubRoyaleProfile?.tierPoints || 0;
  const clubRoyaleTier = loyaltyClubRoyaleTier || clubRoyaleProfile?.tier || 'Choice';

  const stats = useMemo(() => {
    const upcoming = bookedCruises.filter((cruise) => !isDateInPast(cruise.returnDate)).length;
    const completed = bookedCruises.filter((cruise) => isDateInPast(cruise.returnDate)).length;
    const totalNights = crownAnchorPoints;
    const totalPoints = bookedCruises.reduce((sum, cruise) => sum + (cruise.earnedPoints || cruise.casinoPoints || 0), 0);
    const totalSpent = bookedCruises.reduce((sum, cruise) => sum + (cruise.totalPrice || cruise.price || 0), 0);
    const totalRetailValue = bookedCruises.reduce((sum, cruise) => sum + calculatePortfolioValue([cruise]).totalRetailValue, 0);
    return { upcoming, completed, total: bookedCruises.length, totalNights, totalPoints, totalSpent, totalRetailValue };
  }, [bookedCruises, crownAnchorPoints]);

  const casinoStats = useMemo(() => {
    const today = new Date();
    const completedCruises = bookedCruises.filter((cruise) => {
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
      return returnDate ? returnDate < today : cruise.completionState === 'completed';
    });
    const upcomingCruises = bookedCruises.filter((cruise) => {
      const returnDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
      return returnDate ? returnDate >= today : cruise.completionState !== 'completed';
    });

    const completedPortfolio = calculatePortfolioValue(completedCruises);
    const upcomingPortfolio = calculatePortfolioValue(upcomingCruises);
    const totalWinnings = completedCruises.reduce((sum, cruise) => sum + (cruise.winnings || 0), 0);
    const totalRetailValue = upcomingPortfolio.totalRetailValue || 0;
    const totalTaxesFees = upcomingPortfolio.totalTaxesFees || 0;
    const netProfit = (totalRetailValue - totalTaxesFees) + totalWinnings;

    return {
      totalCoinIn: casinoAnalytics.totalCoinIn || completedPortfolio.totalCoinIn || 0,
      netResult: casinoAnalytics.netResult || totalWinnings || 0,
      avgCoinInPerCruise: casinoAnalytics.avgCoinInPerCruise || (completedCruises.length > 0 ? completedPortfolio.totalCoinIn / completedCruises.length : 0),
      avgWinLossPerCruise: casinoAnalytics.avgWinLossPerCruise || (completedCruises.length > 0 ? totalWinnings / completedCruises.length : 0),
      totalRetailValue,
      totalTaxesFees,
      totalProfit: netProfit,
      completedCount: completedCruises.length,
    };
  }, [bookedCruises, casinoAnalytics]);

  const nextCruise = useMemo<BookedCruise | null>(() => {
    const upcomingCruises = bookedCruises
      .filter((cruise) => !isDateInPast(cruise.returnDate))
      .sort((left, right) => createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime());
    return upcomingCruises[0] || null;
  }, [bookedCruises]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Booked] Refreshing data...');
    await refreshData();
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }, [refreshData]);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setSearchQuery('');
    setHideCompleted(false);
    setSortBy('next');
  }, []);

  const handleCruisePress = useCallback((cruise: BookedCruise) => {
    console.log('[Booked] Cruise pressed:', cruise.id);
    router.push(`/cruise-details?id=${cruise.id}` as never);
  }, [router]);

  const handleSaveNewCruise = useCallback(async (cruise: BookedCruise) => {
    console.log('[Booked] Saving new cruise:', cruise.id);
    addBookedCruise(cruise);
    await refreshData();
  }, [addBookedCruise, refreshData]);

  const heroPills = useMemo(() => ([
    { label: 'Upcoming', value: formatNumber(stats.upcoming), tone: 'gold' as const },
    { label: 'Completed', value: formatNumber(stats.completed), tone: 'emerald' as const },
    { label: 'C&A Points', value: formatNumber(stats.totalNights), tone: 'violet' as const },
    { label: 'Retail', value: formatCurrency(stats.totalRetailValue), tone: 'teal' as const },
  ]), [stats.completed, stats.totalNights, stats.totalRetailValue, stats.upcoming]);

  const quickFacts = useMemo<DisplayField[]>(() => ([
    { key: 'tier', label: 'Club Royale', value: clubRoyaleTier, tone: 'accent' },
    { key: 'points', label: 'Casino Points', value: formatNumber(currentPoints), tone: 'accent' },
    { key: 'cruises', label: 'Tracked Cruises', value: formatNumber(stats.total), tone: 'default' },
  ]), [clubRoyaleTier, currentPoints, stats.total]);

  const statGridFields = useMemo<DisplayField[]>(() => ([
    { key: 'totalCoinIn', label: 'Coin-In', value: formatCurrency(casinoStats.totalCoinIn), tone: 'success' },
    { key: 'netResult', label: 'Net Win/Loss', value: `${casinoStats.netResult >= 0 ? '+' : ''}${formatCurrency(casinoStats.netResult)}`, tone: casinoStats.netResult >= 0 ? 'success' : 'danger' },
    { key: 'taxes', label: 'Taxes Paid', value: formatCurrency(casinoStats.totalTaxesFees), tone: 'warning' },
    { key: 'spent', label: 'Out of Pocket', value: formatCurrency(stats.totalSpent), tone: 'warning' },
  ]), [casinoStats.netResult, casinoStats.totalCoinIn, casinoStats.totalTaxesFees, stats.totalSpent]);

  const renderCruiseCard = useCallback(({ item }: { item: BookedCruise }) => {
    const cardFields = buildCruiseCardFields(item);
    const isPast = isDateInPast(item.returnDate);
    const subtitle = `${formatDate(item.sailDate, 'medium')} • ${item.nights || 0} nights • ${item.departurePort || 'Port TBD'}`;
    const chips = [
      item.destination || item.itineraryName || 'Cruise',
      item.bookingId || 'No booking ID',
      item.reservationNumber || 'No reservation #',
      item.cabinType || item.stateroomType || 'Cabin TBD',
    ].filter(Boolean);

    return (
      <PremiumEntityCard
        title={item.shipName}
        subtitle={subtitle}
        imageUri={pickCruiseImage(item)}
        badge={isPast ? { label: 'COMPLETED', tone: 'emerald' } : { label: 'BOOKED', tone: 'teal' }}
        chips={chips}
        primaryFields={cardFields.primary}
        extraFields={cardFields.extra}
        footerText="Booking ID, reservation data, pricing, casino metrics, and all tracked fields remain available here."
        onPress={() => handleCruisePress(item)}
      />
    );
  }, [handleCruisePress]);

  const timelineCards = useMemo<BookedCruise[]>(() => {
    return [...filteredCruises].sort((left, right) => createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime());
  }, [filteredCruises]);

  const header = useMemo(() => (
    <View style={styles.headerStack}>
      <PremiumHeroCard
        title="My Cruises"
        subtitle={nextCruise ? `${nextCruise.shipName} sails ${formatDate(nextCruise.sailDate, 'medium')}. The booked experience now uses the same premium surfaces, chips, and stat rhythm as Offers.` : 'Every booked sailing now shares the premium offers visual system without dropping a single field.'}
        badge={{ label: 'BOOKED PORTFOLIO', tone: 'teal' }}
        imageUri={pickCruiseImage(nextCruise ?? bookedCruises[0], 'booked-cruises')}
        pills={heroPills}
      >
        <PremiumQuickFacts fields={quickFacts} />
      </PremiumHeroCard>

      <PremiumStatGrid title="Casino & Value Snapshot" fields={statGridFields} />

      <PremiumActionBar
        actions={[
          { key: 'add', label: 'Add Cruise', onPress: () => setShowAddModal(true), tone: 'gold' },
          { key: 'refresh', label: 'Refresh', onPress: onRefresh, tone: 'teal' },
          { key: 'hide', label: hideCompleted ? 'Show Completed' : 'Hide Completed', onPress: () => setHideCompleted((current) => !current), tone: 'violet' },
          { key: 'clear', label: 'Clear Filters', onPress: clearFilters, tone: 'rose' },
        ]}
      />

      <PremiumChipBar
        chips={VIEW_OPTIONS.map((option) => ({
          key: option.value,
          label: option.label,
          active: viewMode === option.value,
          onPress: () => setViewMode(option.value),
          tone: option.value === 'points' ? 'violet' : option.value === 'timeline' ? 'gold' : 'teal',
        }))}
      />

      {viewMode === 'list' ? (
        <>
          <PremiumChipBar
            chips={FILTER_OPTIONS.map((option) => ({
              key: option.value,
              label: option.label,
              active: filter === option.value,
              onPress: () => setFilter(option.value),
              tone: option.value === 'completed' ? 'emerald' : option.value === 'upcoming' ? 'gold' : 'slate',
            }))}
          />

          <View style={styles.searchSurface}>
            <Text style={styles.searchLabel}>Search ship, destination, reservation, booking ID, or itinerary</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search booked cruises"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              testID="booked-search-input"
            />
          </View>

          <PremiumChipBar
            chips={SORT_OPTIONS.map((option) => ({
              key: option.value,
              label: option.label,
              active: sortBy === option.value,
              onPress: () => setSortBy(option.value),
              tone: option.value === 'nights' ? 'violet' : option.value === 'ship' ? 'teal' : 'gold',
            }))}
          />
        </>
      ) : null}
    </View>
  ), [bookedCruises, clearFilters, filter, heroPills, hideCompleted, nextCruise, onRefresh, quickFacts, searchQuery, sortBy, statGridFields, viewMode]);

  if (appLoading) {
    return (
      <PremiumPageBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A5F" />
          <Text style={styles.loadingText}>Loading booked cruises…</Text>
        </View>
      </PremiumPageBackground>
    );
  }

  return (
    <PremiumPageBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={viewMode === 'list' ? filteredCruises : viewMode === 'timeline' ? timelineCards : ([] as BookedCruise[])}
          keyExtractor={(item, index) => createCruiseListKey(item, index)}
          renderItem={renderCruiseCard}
          ListHeaderComponent={(
            <View>
              {header}
              {viewMode === 'timeline' ? (
                <View style={styles.timelineSurface}>
                  <Text style={styles.timelineTitle}>Chronological Voyage Timeline</Text>
                  <Text style={styles.timelineSubtitle}>Upcoming and completed sailings share the same premium card system and retain all booking fields inside each card.</Text>
                </View>
              ) : null}
              {viewMode === 'points' ? (
                <View style={styles.pointsSurface}>
                  <View style={styles.pointsHeaderRow}>
                    <View style={styles.pointsIconWrap}>
                      <Trophy size={18} color="#B8860B" />
                    </View>
                    <View style={styles.pointsHeaderTextWrap}>
                      <Text style={styles.pointsTitle}>Crown & Anchor Progress</Text>
                      <Text style={styles.pointsSubtitle}>All booked sailings still feed the same loyalty progression timeline.</Text>
                    </View>
                  </View>
                  <CrownAnchorTimeline currentPoints={crownAnchorPoints} bookedCruises={bookedCruises} />
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={viewMode === 'list' ? <PremiumEmptyState title="No booked cruises found" subtitle="All booked-cruise data is still supported. Adjust filters, search, or add a new cruise." /> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" colors={['#1E3A5F']} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      <TouchableOpacity
        style={styles.addFloatingButton}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.9}
        testID="booked-add-cruise"
      >
        <Plus size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <AddBookedCruiseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNewCruise}
      />
    </PremiumPageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: '#6B7280',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  listSpacer: {
    height: SPACING.md,
  },
  headerStack: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  searchSurface: {
    borderRadius: 22,
    padding: SPACING.lg,
    backgroundColor: APP_TEXTURE.surfaceStrong,
    borderWidth: 1,
    borderColor: APP_TEXTURE.border,
  },
  searchLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 12,
  },
  searchInput: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.52)',
    color: '#1A2A3D',
    fontSize: 15,
    fontWeight: '600' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  timelineSurface: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: APP_TEXTURE.surfaceStrong,
    borderWidth: 1,
    borderColor: APP_TEXTURE.border,
  },
  timelineTitle: {
    color: '#1A2A3D',
    fontSize: 18,
    fontWeight: '800' as const,
  },
  timelineSubtitle: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  pointsSurface: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: APP_TEXTURE.surfaceStrong,
    borderWidth: 1,
    borderColor: APP_TEXTURE.border,
  },
  pointsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: SPACING.md,
  },
  pointsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_TEXTURE.goldWash,
    borderWidth: 1,
    borderColor: APP_TEXTURE.borderStrong,
  },
  pointsHeaderTextWrap: {
    flex: 1,
  },
  pointsTitle: {
    color: '#1A2A3D',
    fontSize: 18,
    fontWeight: '800' as const,
  },
  pointsSubtitle: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
  },
  addFloatingButton: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#132B47',
    borderWidth: 1,
    borderColor: 'rgba(255,226,143,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10223A',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
