import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ship,
  RotateCcw,
  EyeOff,
  X,
  ArrowUpDown,
  Clock,
  Award,
  Plus,
  List,
  CheckCircle,
  Anchor,
  Dice5,
  TrendingUp,
  Coins,
  Target,
  DollarSign,
  Crown,
  Globe2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { withAlpha } from '@/constants/loyaltyColors';
import { createLoyaltyCardTheme, getClubRoyaleTierColor } from '@/constants/loyaltyTheme';
import { LoyaltyPill } from '@/components/ui/LoyaltyPill';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { MinimalistFilterBar } from '@/components/ui/MinimalistFilterBar';
import { createDateFromString } from '@/lib/date';
import { CruiseCard } from '@/components/CruiseCard';
import { DOLLARS_PER_POINT, type BookedCruise } from '@/types/models';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import { AddBookedCruiseModal } from '@/components/AddBookedCruiseModal';
import { MarineAlertsPanel } from '@/components/MarineAlertsPanel';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

import { getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { formatCurrency, formatNumber as formatNum } from '@/lib/format';
import { CrownAnchorTimeline } from '@/components/CrownAnchorTimeline';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { buildCruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';
import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { CONFIRMED_CLUB_ROYALE_2025_POINTS, isKnownCasinoProfile } from '@/lib/knownProfileFallback';
import { applyKnownBookingCorrections, findOverlappingBookedCruises } from '@/lib/cruiseOverlapGuards';
import { isActiveBookedCruise, isCompletedBookedCruise } from '@/lib/bookedCruiseStatus';

type FilterType = 'all' | 'upcoming' | 'completed' | 'celebrity';
type SortType = 'next' | 'newest' | 'oldest' | 'ship' | 'nights';
type ViewMode = 'list' | 'timeline' | 'points';

const BOOKED_MARINE_ALERT_FORECAST_DAYS = 10;
const BOOKED_MARINE_ALERT_DAYS_AHEAD = BOOKED_MARINE_ALERT_FORECAST_DAYS - 1;

function isCruiseCompleted(cruise: BookedCruise): boolean {
  return isCompletedBookedCruise(cruise);
}

function isCruiseUpcomingBooking(cruise: BookedCruise): boolean {
  return isActiveBookedCruise(cruise);
}

function startOfLocalDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getCruiseForecastEndDate(cruise: BookedCruise, sailStart: Date): Date {
  if (cruise.returnDate) {
    const parsedReturnDate = createDateFromString(cruise.returnDate);
    if (!Number.isNaN(parsedReturnDate.getTime())) {
      return startOfLocalDay(parsedReturnDate);
    }
  }

  const nights = typeof cruise.nights === 'number' && Number.isFinite(cruise.nights) && cruise.nights > 0 ? cruise.nights : 0;
  const estimatedReturnDate = new Date(sailStart);
  estimatedReturnDate.setDate(estimatedReturnDate.getDate() + nights);
  return startOfLocalDay(estimatedReturnDate);
}

function isCruiseInsideForecastWindow(cruise: BookedCruise, windowStart: Date, windowEnd: Date): boolean {
  if (!cruise.sailDate) return false;
  const sailStart = startOfLocalDay(createDateFromString(cruise.sailDate));
  if (Number.isNaN(sailStart.getTime())) return false;
  const cruiseEnd = getCruiseForecastEndDate(cruise, sailStart);
  return cruiseEnd >= windowStart && sailStart <= windowEnd;
}

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Celebrity', value: 'celebrity' },
];

const SORT_OPTIONS: { label: string; value: SortType }[] = [
  { label: 'Next Sailing First', value: 'next' },
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'By Ship', value: 'ship' },
  { label: 'By Nights', value: 'nights' },
];

function mergeCruiseData(primaryCruises: BookedCruise[], fallbackCruises: BookedCruise[]): BookedCruise[] {
  return applyKnownBookingCorrections(dedupeBookedCruises([...fallbackCruises, ...primaryCruises], 'booked screen merged cruises'));
}

function getBookedCruiseRenderKey(cruise: BookedCruise, index: number): string {
  const keyParts = [
    cruise.id,
    cruise.ownerProfileId,
    cruise.sourceEmail,
    cruise.reservationNumber,
    cruise.bookingId,
    cruise.sailDate,
    cruise.returnDate,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return `${keyParts.join('|') || 'booked-cruise'}|${index}`;
}

export default function BookedScreen() {
  const router = useRouter();
  const { localData, clubRoyaleProfile, isLoading: appLoading, refreshData } = useAppState();
  const { addBookedCruise, bookedCruises: storedBooked } = useCoreData();
  const { authenticatedEmail } = useAuth();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const { casinoAnalytics } = useSimpleAnalytics();
  const {
    clubRoyaleTier: loyaltyClubRoyaleTier,
    clubRoyaleCurrentYearPoints,
    clubRoyaleHistoricalPoints,
    crownAnchorPoints,
  } = useLoyalty();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('next');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const bookedCruises = useMemo(() => {
    const localBooked = filterRecordsByIntelligence((localData.booked || []) as BookedCruise[], intelligenceFilterSnapshot, users);
    const storedScoped = filterRecordsByIntelligence(storedBooked, intelligenceFilterSnapshot, users);
    const baseCruises = dedupeBookedCruises([...storedScoped, ...localBooked], 'booked screen scoped source merge');
    const normalizedEmail = authenticatedEmail?.toLowerCase().trim() ?? null;
    const mergedCruises = filterRecordsByIntelligence(mergeCruiseData(baseCruises, []), intelligenceFilterSnapshot, users);
    console.log('[Booked] Resolved booked cruise source:', {
      authenticatedEmail: normalizedEmail,
      localBooked: localBooked.length,
      storedBooked: storedScoped.length,
      mergedCruises: mergedCruises.length,
    });
    return mergedCruises;
  }, [authenticatedEmail, intelligenceFilterSnapshot, localData.booked, storedBooked, users]);

  const filteredCruises = useMemo(() => {
    let result = bookedCruises.filter((cruise) => isCruiseUpcomingBooking(cruise) || isCruiseCompleted(cruise));

    if (filter === 'upcoming') {
      result = result.filter(cruise => isCruiseUpcomingBooking(cruise));
    } else if (filter === 'completed') {
      result = result.filter(cruise => isCruiseCompleted(cruise));
    } else if (filter === 'celebrity') {
      result = result.filter(cruise => 
        cruise.cruiseSource === 'celebrity' || 
        cruise.shipName?.toLowerCase().startsWith('celebrity')
      );
    }

    if (hideCompleted) {
      result = result.filter(cruise => !isCruiseCompleted(cruise));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(cruise =>
        cruise.shipName?.toLowerCase().includes(query) ||
        cruise.destination?.toLowerCase().includes(query) ||
        cruise.departurePort?.toLowerCase().includes(query) ||
        cruise.reservationNumber?.toLowerCase().includes(query) ||
        cruise.itineraryName?.toLowerCase().includes(query)
      );
    }

    switch (sortBy) {
      case 'next': {
        const now = new Date();
        result.sort((a, b) => {
          const aDate = createDateFromString(a.sailDate);
          const bDate = createDateFromString(b.sailDate);
          const aUpcoming = aDate >= now;
          const bUpcoming = bDate >= now;
          if (aUpcoming && bUpcoming) return aDate.getTime() - bDate.getTime();
          if (!aUpcoming && !bUpcoming) return bDate.getTime() - aDate.getTime();
          return aUpcoming ? -1 : 1;
        });
        break;
      }
      case 'newest':
        result.sort((a, b) => createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
        break;
      case 'ship':
        result.sort((a, b) => (a.shipName || '').localeCompare(b.shipName || ''));
        break;
      case 'nights':
        result.sort((a, b) => (b.nights || 0) - (a.nights || 0));
        break;
    }

    return result;
  }, [bookedCruises, filter, hideCompleted, searchQuery, sortBy]);

  const currentYearPoints = clubRoyaleCurrentYearPoints;
  const historicalPoints = casinoAnalytics.historicalPointsEarned || clubRoyaleHistoricalPoints;
  const usesKnownCasinoProfile = isKnownCasinoProfile(authenticatedEmail);
  const clubRoyaleTier = loyaltyClubRoyaleTier || clubRoyaleProfile?.tier || 'Choice';
  const clubRoyaleTierColor = getClubRoyaleTierColor(clubRoyaleTier);
  const casinoCardTheme = useMemo(() => createLoyaltyCardTheme(clubRoyaleTierColor), [clubRoyaleTierColor]);

  const stats = useMemo(() => {
    const activeCruises = bookedCruises.filter((cruise) => isCruiseUpcomingBooking(cruise) || isCruiseCompleted(cruise));
    const upcoming = activeCruises.filter(c => isCruiseUpcomingBooking(c)).length;
    const completed = activeCruises.filter(c => isCruiseCompleted(c)).length;
    const withData = activeCruises.filter(c => c.price && c.price > 0).length;
    const totalNights = crownAnchorPoints;
    const totalPoints = activeCruises.reduce((sum, c) => sum + getBookedCruiseCasinoPoints(c), 0);
    const totalSpent = activeCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
    return { upcoming, completed, withData, total: activeCruises.length, totalNights, totalPoints, totalSpent };
  }, [bookedCruises, crownAnchorPoints]);

  const cruiseEconomicsSummary = useMemo(() => {
    const activeCruises = bookedCruises.filter((cruise) => isCruiseUpcomingBooking(cruise) || isCruiseCompleted(cruise));
    return buildCruiseEconomicsSummary(activeCruises, new Date(), { scope: 'allCruises' });
  }, [bookedCruises]);

  const gamingActivitySummary = useMemo(() => {
    return buildCruiseEconomicsSummary(bookedCruises, new Date(), {
      useKnownAnnualReportFacts: usesKnownCasinoProfile,
      minimumTotalPoints: usesKnownCasinoProfile ? CONFIRMED_CLUB_ROYALE_2025_POINTS : undefined,
      pointsAdjustmentNote: 'Historical Club Royale points use the confirmed 58,680-point 2025 season floor when imported per-cruise rows do not contain every point transaction.',
    });
  }, [bookedCruises, usesKnownCasinoProfile]);

  const casinoStats = useMemo(() => {
    const gamingCruiseCount = gamingActivitySummary.totals.cruises;
    const portfolioCruiseCount = cruiseEconomicsSummary.totals.cruises;
    const historicalCoinInFromPoints = historicalPoints > 0 ? historicalPoints * DOLLARS_PER_POINT : 0;
    const totalCoinIn = gamingActivitySummary.totals.totalCoinIn || casinoAnalytics.totalCoinIn || historicalCoinInFromPoints;
    const totalCashResult = gamingActivitySummary.totals.totalCashResult || cruiseEconomicsSummary.totals.totalCashResult;
    const totalRetailValue = cruiseEconomicsSummary.totals.totalRetailValue;
    const totalPaid = cruiseEconomicsSummary.totals.totalPaid;
    const totalCruiseValueCaptured = cruiseEconomicsSummary.totals.totalCruiseValueCaptured;
    const totalEconomicValue = cruiseEconomicsSummary.totals.totalEconomicValue;

    console.log('[Booked] Casino stats calculated with shared gaming activity summary:', {
      gamingCruiseCount,
      portfolioCruiseCount,
      historicalPoints,
      historicalCoinInFromPoints,
      totalRetailValue,
      totalPaid,
      totalCruiseValueCaptured,
      totalCashResult,
      totalEconomicValue,
      totalCoinIn,
      gamingTotalCoinIn: gamingActivitySummary.totals.totalCoinIn,
      hasEstimates: gamingActivitySummary.totals.hasEstimates || cruiseEconomicsSummary.totals.hasEstimates,
    });

    return {
      totalCoinIn,
      netResult: totalCashResult,
      avgCoinInPerCruise: gamingCruiseCount > 0 ? totalCoinIn / gamingCruiseCount : casinoAnalytics.avgCoinInPerCruise,
      avgCashResultPerCruise: gamingCruiseCount > 0 ? totalCashResult / gamingCruiseCount : 0,
      totalRetailValue,
      totalPaid,
      totalCruiseValueCaptured,
      totalEconomicValue,
      completedCount: gamingCruiseCount || portfolioCruiseCount,
      hasEstimates: gamingActivitySummary.totals.hasEstimates || cruiseEconomicsSummary.totals.hasEstimates,
    };
  }, [casinoAnalytics.avgCoinInPerCruise, casinoAnalytics.totalCoinIn, cruiseEconomicsSummary, gamingActivitySummary, historicalPoints]);

  const overlapWarningsByCruiseId = useMemo(() => {
    const warnings = findOverlappingBookedCruises(bookedCruises);
    return new Map(warnings.map((warning) => [warning.cruiseId, warning.message]));
  }, [bookedCruises]);

  const upcomingCruisesForAlerts = useMemo((): BookedCruise[] => {
    const forecastWindowStart = startOfLocalDay(new Date());
    const forecastWindowEnd = new Date(forecastWindowStart);
    forecastWindowEnd.setDate(forecastWindowEnd.getDate() + BOOKED_MARINE_ALERT_DAYS_AHEAD);

    const nextForecastCruise = bookedCruises
      .filter((cruise) => isCruiseUpcomingBooking(cruise))
      .filter((cruise) => isCruiseInsideForecastWindow(cruise, forecastWindowStart, forecastWindowEnd))
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime())[0];

    return nextForecastCruise ? [nextForecastCruise] : [];
  }, [bookedCruises]);

  const nextCruise = useMemo(() => {
    const upcomingCruises = bookedCruises
      .filter(c => isCruiseUpcomingBooking(c))
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
    return upcomingCruises[0] || null;
  }, [bookedCruises]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Booked] Refreshing data...');
    await refreshData();
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, [refreshData]);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setSearchQuery('');
    setHideCompleted(false);
    setSortBy('newest');
  }, []);

  const handleCruisePress = useCallback((cruise: BookedCruise) => {
    console.log('[Booked] Cruise pressed:', cruise.id);
    router.push(`/cruise-details?id=${cruise.id}&source=booked` as any);
  }, [router]);

  const handleAddCruise = useCallback(() => {
    console.log('[Booked] Opening add cruise modal');
    setShowAddModal(true);
  }, []);

  const handleCountriesPress = useCallback(() => {
    const countryFilter = filter === 'upcoming' || filter === 'completed' ? filter : 'all';
    console.log('[Booked] Opening Countries view:', countryFilter);
    router.push({ pathname: '/countries' as any, params: { filter: countryFilter } });
  }, [filter, router]);

  const handleSaveNewCruise = useCallback(async (cruise: BookedCruise) => {
    console.log('[Booked] Saving new cruise:', cruise);
    addBookedCruise(cruise);
    await refreshData();
  }, [addBookedCruise, refreshData]);

  const getDaysUntilCruise = useCallback((sailDate: string | undefined): number | null => {
    if (!sailDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sail = createDateFromString(sailDate);
    sail.setHours(0, 0, 0, 0);
    const diffTime = sail.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  }, []);

  const formatNumber = useCallback((num: number): string => {
    return formatNum(num);
  }, []);



  const renderCruiseCard = useCallback(({ item }: { item: BookedCruise }) => {
    const isPast = isCruiseCompleted(item);
    
    return (
      <ResponsiveContainer>
        <CruiseCard
          cruise={item}
          onPress={() => handleCruisePress(item)}
          variant={isPast ? 'completed' : 'booked'}
          conflictWarning={overlapWarningsByCruiseId.get(item.id)}
          mini={true}
        />
      </ResponsiveContainer>
    );
  }, [handleCruisePress, overlapWarningsByCruiseId]);

  const renderTimelineView = () => {
    const upcomingCruises = filteredCruises
      .filter(c => isCruiseUpcomingBooking(c))
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
    const completedCruises = filteredCruises
      .filter(c => isCruiseCompleted(c))
      .sort((a, b) => createDateFromString(b.returnDate || b.sailDate).getTime() - createDateFromString(a.returnDate || a.sailDate).getTime());
    
    return (
      <View style={styles.timelineContainer}>
        {/* Upcoming Section */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineSectionHeader}>
            <View style={styles.timelineSectionIcon}>
              <Clock size={16} color={COLORS.white} />
            </View>
            <Text style={styles.timelineSectionTitle}>Upcoming ({upcomingCruises.length})</Text>
          </View>
          
          {upcomingCruises.length === 0 ? (
            <View style={styles.timelineEmptyCard}>
              <Ship size={24} color={COLORS.textSecondary} />
              <Text style={styles.timelineEmptyText}>No upcoming cruises</Text>
            </View>
          ) : (
            <View style={styles.timelineVerticalList}>
              {upcomingCruises.map((cruise, index) => {
                const daysUntil = getDaysUntilCruise(cruise.sailDate);
                return (
                  <View key={getBookedCruiseRenderKey(cruise, index)} style={styles.timelineItemWrapper}>
                    {daysUntil !== null && (
                      <View style={styles.timelineDaysIndicator}>
                        <Text style={styles.timelineDaysNumber}>{daysUntil}</Text>
                        <Text style={styles.timelineDaysLabel}>DAYS</Text>
                      </View>
                    )}
                    <View style={styles.timelineCardWrapper}>
                      <CruiseCard
                        cruise={cruise}
                        onPress={() => handleCruisePress(cruise)}
                        variant="booked"
                        mini={true}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        
        {/* Completed Section */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineSectionHeader}>
            <View style={[styles.timelineSectionIcon, { backgroundColor: COLORS.success }]}>
              <CheckCircle size={16} color={COLORS.white} />
            </View>
            <Text style={styles.timelineSectionTitle}>Completed ({completedCruises.length})</Text>
          </View>
          
          {completedCruises.length === 0 ? (
            <View style={styles.timelineEmptyCard}>
              <CheckCircle size={24} color={COLORS.textSecondary} />
              <Text style={styles.timelineEmptyText}>No completed cruises</Text>
            </View>
          ) : (
            <View style={styles.timelineVerticalList}>
              {completedCruises.map((cruise, index) => {
                const points = getBookedCruiseCasinoPoints(cruise);
                return (
                  <View key={getBookedCruiseRenderKey(cruise, index)} style={styles.timelineItemWrapper}>
                    {points > 0 && (
                      <View style={[styles.timelineDaysIndicator, styles.timelinePointsIndicator]}>
                        <Award size={14} color={COLORS.success} />
                        <Text style={styles.timelinePointsValue}>+{formatNumber(points)}</Text>
                      </View>
                    )}
                    <View style={styles.timelineCardWrapper}>
                      <CruiseCard
                        cruise={cruise}
                        onPress={() => handleCruisePress(cruise)}
                        variant="completed"
                        mini={true}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  const heroImage = useMemo(() => {
    if (nextCruise?.destination) {
      const hash = nextCruise.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return getImageForDestination(nextCruise.destination, hash);
    }
    return DEFAULT_CRUISE_IMAGE;
  }, [nextCruise]);

  const renderHeader = () => (
    <ResponsiveContainer>
      <View style={styles.headerContent}>
      {/* Colorful Hero Header */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0, 31, 63, 0.3)', 'rgba(0, 31, 63, 0.85)', 'rgba(0, 31, 63, 0.95)']}
          style={styles.heroOverlay}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTitleRow}>
            <View style={styles.heroIconBadge}>
              <Anchor size={24} color={COLORS.white} />
            </View>
            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroTitle}>My Cruises</Text>
              <Text style={styles.heroSubtitle}>{stats.total} cruises • {stats.totalNights} nights sailed</Text>
            </View>
          </View>
          
          {nextCruise && (
            <View style={styles.nextCruiseCard}>
              <View style={styles.nextCruiseHeader}>
                <Clock size={14} color={COLORS.beigeWarm} />
                <Text style={styles.nextCruiseLabel}>NEXT VOYAGE</Text>
              </View>
              <Text style={styles.nextCruiseShip}>{nextCruise.shipName}</Text>
              <Text style={styles.nextCruiseDest}>
                {nextCruise.nights}N • {nextCruise.destination || nextCruise.itineraryName || 'Caribbean'}
              </Text>
              <Text style={styles.nextCruiseDate}>
                {createDateFromString(nextCruise.sailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </Text>
            </View>
          )}
          
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Clock size={16} color={COLORS.aquaAccent} />
              <Text style={styles.heroStatValue}>{stats.upcoming}</Text>
              <Text style={styles.heroStatLabel}>Upcoming</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.heroStatValue}>{stats.completed}</Text>
              <Text style={styles.heroStatLabel}>Completed</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Award size={16} color={COLORS.goldAccent} />
              <Text style={styles.heroStatValue}>{formatNumber(currentYearPoints)}</Text>
              <Text style={styles.heroStatLabel}>Season Pts</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.marineAlertsSection}>
        <MarineAlertsPanel
          cruises={upcomingCruisesForAlerts}
          startDate={new Date()}
          daysAhead={BOOKED_MARINE_ALERT_DAYS_AHEAD}
          maxItems={3}
          title="Rough seas / weather alerts"
          description="10-day outlook focused on the next sailing you are on, with rough-seas, squall, and bad-weather watchouts before and during the cruise."
          testID="booked-marine-alerts-panel"
        />
      </View>

      {/* Combined Casino Section */}
      <View style={styles.casinoSection}>
        <LinearGradient
          colors={casinoCardTheme.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.casinoGradient, { borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}
        >
          <View style={styles.casinoHeader}>
            <View style={[styles.casinoIconBadge, {
              backgroundColor: withAlpha(casinoCardTheme.accentColor, 0.28),
              borderWidth: 1,
              borderColor: withAlpha('#FFFFFF', 0.18),
            }]}> 
              <Dice5 size={20} color={COLORS.white} />
            </View>
            <Text style={[styles.casinoTitle, { color: casinoCardTheme.topTextColor }]}>Casino</Text>
            <LoyaltyPill label={clubRoyaleTier} color={clubRoyaleTierColor} size="small" testID="booked-casino-tier-pill" />
          </View>
          
          <View style={styles.casinoMetricsGrid}>
            <View style={[styles.casinoMetricCard, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: withAlpha(casinoCardTheme.accentColor, 0.24) }]}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoCardTheme.surfaceColorMuted }]}>
                <Coins size={16} color={COLORS.goldLight} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoCardTheme.topTextColor }]}>{formatCurrency(casinoStats.totalCoinIn)}</Text>
              <Text style={[styles.casinoMetricLabel, { color: casinoCardTheme.secondaryTextColor }]}>Total Coin-In</Text>
            </View>
            
            <View style={[styles.casinoMetricCard, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: withAlpha(casinoCardTheme.accentColor, 0.24) }]}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoCardTheme.surfaceColorMuted }]}>
                <Target size={16} color={casinoStats.netResult >= 0 ? COLORS.success : COLORS.error} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoCardTheme.topTextColor }]}>
                {casinoStats.netResult >= 0 ? '+' : ''}{formatCurrency(casinoStats.netResult)}
              </Text>
              <Text style={[styles.casinoMetricLabel, { color: casinoCardTheme.secondaryTextColor }]}>Cash Result</Text>
            </View>
            
            <View style={[styles.casinoMetricCard, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: withAlpha(casinoCardTheme.accentColor, 0.24) }]}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoCardTheme.surfaceColorMuted }]}>
                <Award size={16} color={clubRoyaleTierColor} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoCardTheme.topTextColor }]}>{formatNumber(currentYearPoints)}</Text>
              <Text style={[styles.casinoMetricLabel, { color: casinoCardTheme.secondaryTextColor }]}>Current Season</Text>
            </View>
          </View>
          
          <View style={[styles.casinoFinancialsRow, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: withAlpha(casinoCardTheme.accentColor, 0.24) }]}>
            <View style={styles.casinoFinancialItem}>
              <Ship size={14} color={casinoCardTheme.topTextColor} />
              <View style={styles.casinoFinancialText}>
                <Text style={[styles.casinoFinancialLabel, { color: casinoCardTheme.secondaryTextColor }]}>Retail Value</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoCardTheme.topTextColor }]}>
                  {formatCurrency(casinoStats.totalRetailValue)}
                </Text>
              </View>
            </View>
            <View style={[styles.casinoFinancialDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
            <View style={styles.casinoFinancialItem}>
              <DollarSign size={14} color={casinoCardTheme.topTextColor} />
              <View style={styles.casinoFinancialText}>
                <Text style={[styles.casinoFinancialLabel, { color: casinoCardTheme.secondaryTextColor }]}>Amount Paid</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoCardTheme.topTextColor }]}>
                  {formatCurrency(casinoStats.totalPaid)}
                </Text>
              </View>
            </View>
            <View style={[styles.casinoFinancialDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
            <View style={styles.casinoFinancialItem}>
              <TrendingUp size={14} color={casinoCardTheme.topTextColor} />
              <View style={styles.casinoFinancialText}>
                <Text style={[styles.casinoFinancialLabel, { color: casinoCardTheme.secondaryTextColor }]}>Total Economic Value</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoCardTheme.topTextColor }]}> 
                  {casinoStats.totalEconomicValue >= 0 ? '+' : ''}{formatCurrency(casinoStats.totalEconomicValue)}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.casinoAvgRow, { backgroundColor: casinoCardTheme.surfaceColorMuted, borderWidth: 1, borderColor: withAlpha(casinoCardTheme.accentColor, 0.2), marginBottom: SPACING.sm }]}>
            <View style={styles.casinoAvgItem}>
              <Text style={[styles.casinoAvgLabel, { color: casinoCardTheme.secondaryTextColor }]}>Historical Points</Text>
              <Text style={[styles.casinoAvgValue, { color: casinoCardTheme.topTextColor }]}>{formatNumber(historicalPoints)}</Text>
            </View>
            <View style={[styles.casinoAvgDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
            <View style={styles.casinoAvgItem}>
              <Text style={[styles.casinoAvgLabel, { color: casinoCardTheme.secondaryTextColor }]}>Status Tier</Text>
              <Text style={[styles.casinoAvgValue, { color: casinoCardTheme.topTextColor }]}>{clubRoyaleTier}</Text>
            </View>
          </View>

          {casinoStats.completedCount > 0 && (
            <View style={[styles.casinoAvgRow, { backgroundColor: casinoCardTheme.surfaceColorMuted, borderWidth: 1, borderColor: withAlpha(casinoCardTheme.accentColor, 0.2) }]}>
              <View style={styles.casinoAvgItem}>
                <Text style={[styles.casinoAvgLabel, { color: casinoCardTheme.secondaryTextColor }]}>Avg Coin-In/Cruise</Text>
                <Text style={[styles.casinoAvgValue, { color: casinoCardTheme.topTextColor }]}>{formatCurrency(casinoStats.avgCoinInPerCruise)}</Text>
              </View>
              <View style={[styles.casinoAvgDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
              <View style={styles.casinoAvgItem}>
                <Text style={[styles.casinoAvgLabel, { color: casinoCardTheme.secondaryTextColor }]}>Avg Cash Result</Text>
                <Text style={[styles.casinoAvgValue, { color: casinoCardTheme.topTextColor }]}> 
                  {casinoStats.avgCashResultPerCruise >= 0 ? '+' : ''}{formatCurrency(casinoStats.avgCashResultPerCruise)}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>

      <IntelligenceFilterStrip contextLabel="Booked" variant="bookedCruises" />

      <View style={styles.viewModeRow}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.7}
          >
            <List size={16} color={viewMode === 'list' ? COLORS.navyDeep : COLORS.textSecondary} />
            <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'timeline' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('timeline')}
            activeOpacity={0.7}
          >
            <Clock size={16} color={viewMode === 'timeline' ? COLORS.navyDeep : COLORS.textSecondary} />
            <Text style={[styles.viewModeText, viewMode === 'timeline' && styles.viewModeTextActive]}>Timeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'points' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('points')}
            activeOpacity={0.7}
          >
            <Crown size={16} color={viewMode === 'points' ? COLORS.navyDeep : COLORS.textSecondary} />
            <Text style={[styles.viewModeText, viewMode === 'points' && styles.viewModeTextActive]}>C&A Pts</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.addCruiseButton}
          onPress={handleAddCruise}
          activeOpacity={0.7}
        >
          <Plus size={16} color={COLORS.white} />
          <Text style={styles.addCruiseText}>Add Cruise</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'timeline' && renderTimelineView()}

      {viewMode === 'points' && (
        <CrownAnchorTimeline
          currentPoints={crownAnchorPoints}
          bookedCruises={bookedCruises}
        />
      )}

      {viewMode === 'list' && (
        <>
          <MinimalistFilterBar
            tabs={FILTER_OPTIONS.map(opt => ({ key: opt.value, label: opt.label }))}
            activeTab={filter}
            onTabPress={(key) => setFilter(key as FilterType)}
            actions={[
              { key: 'countries', label: 'Countries', icon: Globe2, onPress: handleCountriesPress },
              { key: 'refresh', label: 'Refresh', icon: RotateCcw, onPress: onRefresh },
              { key: 'hide', label: hideCompleted ? 'Show All' : 'Hide Done', icon: EyeOff, active: hideCompleted, onPress: () => setHideCompleted(!hideCompleted) },
              { key: 'clear', label: 'Clear Filters', icon: X, onPress: clearFilters },
              { key: 'sort', label: 'Sort', icon: ArrowUpDown, onPress: () => setShowSortMenu(!showSortMenu) },
            ]}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by ship, destination, reservation..."
            showingCount={filteredCruises.length}
            totalCount={stats.total}
            bookedCount={stats.upcoming}
          />
          
          <View style={styles.cruiseListHeader}>
            <Text style={styles.cruiseListTitle}>MY CRUISES</Text>
            <Text style={styles.cruiseListSubtitle}>
              {filteredCruises.length} {filteredCruises.length === 1 ? 'cruise' : 'cruises'} • Tap to view details
            </Text>
          </View>
        </>
      )}

      {showSortMenu && viewMode === 'list' && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sortOption, sortBy === option.value && styles.sortOptionActive]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortBy === option.value && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      </View>
    </ResponsiveContainer>
  );

  const renderEmpty = () => (
    <ResponsiveContainer>
      <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ship size={56} color={COLORS.beigeWarm} />
      </View>
      <Text style={styles.emptyTitle}>No Cruises Found</Text>
      <Text style={styles.emptyText}>
        {filter === 'upcoming' 
          ? 'You have no upcoming cruises scheduled.'
          : filter === 'completed'
          ? 'You haven\'t completed any cruises yet.'
          : filter === 'celebrity'
          ? 'You have no Celebrity cruises booked.'
          : searchQuery
          ? 'No cruises match your search.'
          : 'Your booked cruises will appear here.'}
      </Text>
      {(searchQuery || filter !== 'all' || hideCompleted) && (
        <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
          <LinearGradient
            colors={[COLORS.beigeWarm, COLORS.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.clearFiltersGradient}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      </View>
    </ResponsiveContainer>
  );

  if (appLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.navyDeep} />
        <Text style={styles.loadingText}>Loading cruises...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={viewMode === 'list' ? filteredCruises : ([] as BookedCruise[])}
          renderItem={renderCruiseCard}
          keyExtractor={(item, index) => getBookedCruiseRenderKey(item, index)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={viewMode === 'list' ? renderEmpty : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.beigeWarm}
              colors={[COLORS.beigeWarm]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={5}
          windowSize={7}
          updateCellsBatchingPeriod={50}
        />
      </SafeAreaView>

      <AddBookedCruiseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNewCruise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F1',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.secondary,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  headerContent: {
    marginBottom: SPACING.md,
  },
  heroContainer: {
    height: 280,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOW.lg,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroTitleGroup: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  nextCruiseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nextCruiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  nextCruiseLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.beigeWarm,
    letterSpacing: 1,
  },
  nextCruiseShip: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  nextCruiseDest: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  nextCruiseDate: {
    fontSize: 12,
    color: COLORS.beigeWarm,
    marginTop: 4,
    fontWeight: '600' as const,
  },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    justifyContent: 'space-around',
  },
  heroStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  marineAlertsSection: {
    marginBottom: SPACING.md,
  },
  casinoSection: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  casinoGradient: {
    padding: SPACING.md,
  },
  casinoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  casinoIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    flex: 1,
  },
  casinoTierBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  casinoTierText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  casinoMetricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  casinoMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  casinoMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  casinoMetricValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  casinoMetricLabel: {
    fontSize: 11,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textAlign: 'center' as const,
    marginTop: 2,
  },
  casinoFinancialsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  casinoFinancialItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  casinoFinancialText: {
    flex: 1,
  },
  casinoFinancialLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  casinoFinancialValue: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  casinoFinancialDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.xs,
  },
  casinoAvgRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  casinoAvgItem: {
    flex: 1,
    alignItems: 'center',
  },
  casinoAvgLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginBottom: 2,
  },
  casinoAvgValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  casinoAvgDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.sm,
  },
  cruiseCardWrapper: {
    position: 'relative',
  },
  countdownBadge: {
    position: 'absolute',
    top: -8,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.royalPurple,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    zIndex: 10,
    ...SHADOW.sm,
  },
  countdownText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  pointsEarnedBadge: {
    position: 'absolute',
    top: -8,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    zIndex: 10,
    ...SHADOW.sm,
  },
  pointsEarnedText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  statsHighlightRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statsHighlightCard: {
    flex: 1,
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    minWidth: 70,
  },
  statsHighlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  statsHighlightValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  statsHighlightLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  viewModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  viewModeToggle: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.round,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.navyDeep,
  },
  viewModeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  viewModeTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  addCruiseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: SPACING.xs,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.round,
  },
  addCruiseText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  timelineContainer: {
    marginBottom: SPACING.lg,
  },
  timelineSection: {
    marginBottom: SPACING.lg,
  },
  timelineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  timelineSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  timelineVerticalList: {
    gap: SPACING.sm,
  },
  timelineItemWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDaysIndicator: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    marginTop: SPACING.sm,
  },
  timelineDaysNumber: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    lineHeight: 22,
  },
  timelineDaysLabel: {
    fontSize: 8,
    color: COLORS.beigeWarm,
    textTransform: 'uppercase' as const,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
  },
  timelinePointsIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  timelinePointsValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
    marginTop: 2,
  },
  timelineCardWrapper: {
    flex: 1,
  },
  timelineEmptyCard: {
    paddingVertical: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 31, 63, 0.2)',
  },
  timelineEmptyText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.6,
    marginTop: SPACING.xs,
    textAlign: 'center' as const,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.data.value,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  sortMenu: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  sortOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.08)',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
  },
  sortOptionText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  sortOptionTextActive: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  cruiseListHeader: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: 'rgba(224, 242, 254, 0.3)',
    borderRadius: BORDER_RADIUS.md,
  },
  cruiseListTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cruiseListSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderAccent,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.data.value,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  sortChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.3)',
  },
  sortChipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  filterTabs: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: COLORS.beigeWarm,
    borderColor: COLORS.beigeWarm,
  },
  filterTabText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  activeTabText: {
    color: COLORS.navyDeep,
  },
  cruiseCard: {
    backgroundColor: COLORS.cardBackgroundDark,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderAccent,
    padding: SPACING.lg,
    ...SHADOW.lg,
  },
  statusBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
    zIndex: 1,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(212, 165, 116, 0.9)',
  },
  completedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  completedStatusText: {
    color: COLORS.white,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xl,
  },
  shipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  shipName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.data.value,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  offerBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.goldAccent,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  destination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.beigeWarm,
    marginBottom: SPACING.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.15)',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  reservationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  reservationLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.8)',
  },
  reservationNumber: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.data.value,
  },
  cabinTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cabinTypeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.data.value,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  priceContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  price: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  pointsRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 165, 116, 0.15)',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  pointsValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  pointsLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(224, 242, 254, 0.3)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(224, 242, 254, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  clearFiltersButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  clearFiltersGradient: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  clearFiltersText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
});
