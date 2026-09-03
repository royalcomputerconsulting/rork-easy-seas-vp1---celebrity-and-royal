import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
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
  CalendarDays,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { withAlpha } from '@/constants/loyaltyColors';
import { getPlayerCardTheme, type SupportedBrand } from '@/constants/loyaltyTheme';
import { getEffectiveCelebrityCaptainsClubLevel } from '@/constants/celebrityCaptainsClub';
import { getSilverseaTierByDays } from '@/constants/silverseaVenetianSociety';
import { LoyaltyPill } from '@/components/ui/LoyaltyPill';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { DataStateCard } from '@/components/ui/EasySeasPrimitives';
import { TierProgressBar } from '@/components/ui/TierProgressBar';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { MinimalistFilterBar } from '@/components/ui/MinimalistFilterBar';
import { createDateFromString } from '@/lib/date';
import { CruiseCard } from '@/components/CruiseCard';
import { type BookedCruise, type Cruise } from '@/types/models';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import { AddBookedCruiseModal } from '@/components/AddBookedCruiseModal';
import { VoyageWeatherSection } from '@/components/VoyageWeatherSection';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useSailingWeather } from '@/state/SailingWeatherProvider';

import { getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { formatCurrency, formatNumber as formatNum } from '@/lib/format';
import { CrownAnchorTimeline } from '@/components/CrownAnchorTimeline';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { buildCruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';
import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { applyKnownBookingCorrections, findOverlappingBookedCruises } from '@/lib/cruiseOverlapGuards';
import { isActiveBookedCruise, isCompletedBookedCruise } from '@/lib/bookedCruiseStatus';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { filterRecordsForProfile } from '@/lib/profileIsolation';
import { CLUB_ROYALE_TIERS, getHigherClubRoyaleTier, getTierByPoints, getTierProgress } from '@/constants/clubRoyaleTiers';
import { buildConsecutiveBookedVoyageBlocks, buildPhysicalBookedVoyageGroups, getPhysicalBookedVoyageKey } from '@/lib/bookedVoyageRelationships';
import { enrichBookedCruisesWithCatalogFacts } from '@/lib/bookedCruiseDisplayTruth';
import { useExperience } from '@/state/ExperienceProvider';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { FavoriteStateroomsSection } from '@/components/favorite-staterooms/FavoriteStateroomsSection';

type FilterType = 'all' | 'upcoming' | 'completed' | 'celebrity';
type SortType = 'next' | 'newest' | 'oldest' | 'ship' | 'nights';
type ViewMode = 'list' | 'timeline' | 'points';

function isCruiseCompleted(cruise: BookedCruise): boolean {
  return isCompletedBookedCruise(cruise);
}

function isCruiseUpcomingBooking(cruise: BookedCruise): boolean {
  return isActiveBookedCruise(cruise);
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

function resolveCasinoThemeBrand(selectedBrand: string, preferredBrand?: SupportedBrand): SupportedBrand {
  if (selectedBrand === 'royal' || selectedBrand === 'celebrity' || selectedBrand === 'silversea' || selectedBrand === 'carnival') {
    return selectedBrand;
  }

  return preferredBrand ?? 'royal';
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
  const { colors: experienceColors, isDark } = useExperience();
  const queryClient = useQueryClient();
  const sailingWeather = useSailingWeather();
  const { getCruiseByIdentity, isInventoryReady, ownerScopeId } = useCruiseInventory();
  const { localData, clubRoyaleProfile, isLoading: appLoading, refreshData } = useAppState();
  const { addBookedCruise, bookedCruises: storedBooked, cruises: storedCruises } = useCoreData();
  const { authenticatedEmail } = useAuth();
  const { users, currentUser } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const {
    clubRoyaleTier: loyaltyClubRoyaleTier,
    clubRoyalePoints,
    clubRoyaleCurrentYearPoints,
    clubRoyaleHistoricalPoints,
    crownAnchorPoints,
    crownAnchorLevel,
    captainsClub,
  } = useLoyalty();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('next');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCasinoEvidence, setShowCasinoEvidence] = useState(false);
  const [indexedBookedCatalogFacts, setIndexedBookedCatalogFacts] = useState<Cruise[]>([]);

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const baseBookedCruises = useMemo(() => {
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

  useEffect(() => {
    let cancelled = false;
    if (!isInventoryReady || !ownerScopeId || baseBookedCruises.length === 0) {
      setIndexedBookedCatalogFacts([]);
      return () => { cancelled = true; };
    }
    const physicalSailings = Array.from(new Map(
      baseBookedCruises.map((cruise) => [`${cruise.shipName.trim().toLowerCase()}|${cruise.sailDate.slice(0, 10)}`, cruise]),
    ).values());
    void Promise.all(physicalSailings.map((cruise) => getCruiseByIdentity({
      shipName: cruise.shipName,
      sailDate: cruise.sailDate.slice(0, 10),
    }))).then((rows) => {
      if (!cancelled) setIndexedBookedCatalogFacts(rows.filter((row): row is Cruise => Boolean(row)));
    }).catch((error) => {
      console.warn('[Booked] Could not hydrate exact sailing facts from the indexed catalog:', error);
      if (!cancelled) setIndexedBookedCatalogFacts([]);
    });
    return () => { cancelled = true; };
  }, [baseBookedCruises, getCruiseByIdentity, isInventoryReady, ownerScopeId]);

  const bookedCruises = useMemo(() => enrichBookedCruisesWithCatalogFacts(baseBookedCruises, [
    ...indexedBookedCatalogFacts,
    ...storedCruises,
    ...((localData.cruises || []) as Cruise[]),
  ]), [baseBookedCruises, indexedBookedCatalogFacts, localData.cruises, storedCruises]);

  const favoriteShipOptions = useMemo(() => Array.from(new Set([
    ...bookedCruises.map((cruise) => cruise.shipName),
    ...storedCruises.map((cruise) => cruise.shipName),
    ...((localData.cruises || []) as Cruise[]).map((cruise) => cruise.shipName),
  ].map((name) => String(name || '').trim()).filter(Boolean))).sort(), [bookedCruises, localData.cruises, storedCruises]);

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

  // The loyalty provider's effective balance is the authoritative profile/provider
  // total. Cruise-attributed points remain available separately for reconciliation.
  const currentYearPoints = clubRoyalePoints;
  const clubRoyaleTier = getHigherClubRoyaleTier(loyaltyClubRoyaleTier, currentUser?.clubRoyaleTier || clubRoyaleProfile?.tier || 'Choice');
  const earnedClubRoyaleTier = getTierByPoints(currentYearPoints);
  const clubRoyaleProgress = getTierProgress(currentYearPoints, earnedClubRoyaleTier);
  const clubRoyaleProgressTier = clubRoyaleProgress.nextTier ?? earnedClubRoyaleTier;
  const casinoThemeBrand = useMemo(() => resolveCasinoThemeBrand(selectedBrand, currentUser?.preferredBrand), [currentUser?.preferredBrand, selectedBrand]);
  const celebrityLevel = useMemo(() => (
    getEffectiveCelebrityCaptainsClubLevel(
      currentUser?.celebrityCaptainsClubPoints ?? captainsClub.points ?? 0,
      crownAnchorLevel || currentUser?.crownAnchorLevel,
      captainsClub.tier,
    )
  ), [captainsClub.points, captainsClub.tier, crownAnchorLevel, currentUser?.celebrityCaptainsClubPoints, currentUser?.crownAnchorLevel]);
  const silverseaTier = useMemo(() => currentUser?.silverseaVenetianTier || getSilverseaTierByDays(currentUser?.silverseaVenetianPoints ?? 0), [currentUser?.silverseaVenetianPoints, currentUser?.silverseaVenetianTier]);
  const casinoCardTheme = useMemo(() => getPlayerCardTheme({
    brand: casinoThemeBrand,
    crownAnchorLevel: crownAnchorLevel || currentUser?.crownAnchorLevel,
    celebrityLevel,
    silverseaTier,
    carnivalVifpTier: currentUser?.carnivalVifpTier || 'Blue',
  }), [casinoThemeBrand, celebrityLevel, crownAnchorLevel, currentUser?.carnivalVifpTier, currentUser?.crownAnchorLevel, silverseaTier]);

  const stats = useMemo(() => {
    const activeCruises = bookedCruises.filter((cruise) => isCruiseUpcomingBooking(cruise) || isCruiseCompleted(cruise));
    const upcoming = activeCruises.filter(c => isCruiseUpcomingBooking(c)).length;
    const completed = activeCruises.filter(c => isCruiseCompleted(c)).length;
    const withData = activeCruises.filter(c => c.price && c.price > 0).length;
    const totalNights = buildPhysicalBookedVoyageGroups(activeCruises)
      .reduce((sum, group) => sum + Math.max(0, Number(group.voyage.nights) || 0), 0);
    const totalPoints = activeCruises.reduce((sum, c) => sum + getBookedCruiseCasinoPoints(c), 0);
    const totalSpent = activeCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
    return { upcoming, completed, withData, total: activeCruises.length, totalNights, totalPoints, totalSpent };
  }, [bookedCruises]);

  const casinoOwnerCruises = useMemo(() => filterRecordsForProfile(bookedCruises, currentUser, users), [bookedCruises, currentUser, users]);
  const cruiseEconomicsSummary = useMemo(() => {
    const activeCruises = casinoOwnerCruises.filter((cruise) => isCruiseUpcomingBooking(cruise) || isCruiseCompleted(cruise));
    return buildCruiseEconomicsSummary(activeCruises, new Date(), { scope: 'allCruises' });
  }, [casinoOwnerCruises]);

  const gamingActivitySummary = useMemo(() => {
    return buildCruiseEconomicsSummary(casinoOwnerCruises, new Date(), { scope: 'completedOnly' });
  }, [casinoOwnerCruises]);
  const attributedCruisePoints = gamingActivitySummary.totals.totalPoints;
  const priorSeasonConfirmedPoints = clubRoyaleHistoricalPoints;
  const casinoEvidenceRows = useMemo(() => gamingActivitySummary.rows
    .filter((row) => row.points > 0)
    .sort((a, b) => b.sailDate.localeCompare(a.sailDate)), [gamingActivitySummary.rows]);
  const casinoSeasonReconciliation = useMemo(() => {
    const today = new Date();
    const currentSeasonYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
    const currentStart = `${currentSeasonYear}-04-01`;
    const nextStart = `${currentSeasonYear + 1}-04-01`;
    const priorStart = `${currentSeasonYear - 1}-04-01`;
    const priorAttributed = casinoEvidenceRows
      .filter((row) => row.sailDate >= priorStart && row.sailDate < currentStart)
      .reduce((sum, row) => sum + row.points, 0);
    const currentAttributed = casinoEvidenceRows
      .filter((row) => row.sailDate >= currentStart && row.sailDate < nextStart)
      .reduce((sum, row) => sum + row.points, 0);
    return {
      priorLabel: `${currentSeasonYear - 1}–${String(currentSeasonYear).slice(-2)}`,
      currentLabel: `${currentSeasonYear}–${String(currentSeasonYear + 1).slice(-2)}`,
      priorAttributed,
      currentAttributed,
      priorUnallocated: Math.max(0, priorSeasonConfirmedPoints - priorAttributed),
      currentUnallocated: Math.max(0, currentYearPoints - currentAttributed),
    };
  }, [casinoEvidenceRows, currentYearPoints, priorSeasonConfirmedPoints]);

  const casinoStats = useMemo(() => {
    const gamingCruiseCount = gamingActivitySummary.totals.cruises;
    const portfolioCruiseCount = cruiseEconomicsSummary.totals.cruises;
    // Never manufacture portfolio coin-in from a profile or historical point total.
    // Only cruise rows with eligible casino evidence contribute to this summary.
    const totalCoinIn = gamingActivitySummary.totals.totalCoinIn;
    const totalCashResult = gamingActivitySummary.totals.totalCashResult;
    const totalRetailValue = gamingActivitySummary.totals.totalRetailValue;
    const totalPaid = gamingActivitySummary.totals.totalPaid;
    const totalCruiseValueCaptured = gamingActivitySummary.totals.totalCruiseValueCaptured;
    const totalEconomicValue = gamingActivitySummary.totals.totalEconomicValue;

    console.log('[Booked] Casino stats calculated with shared gaming activity summary:', {
      gamingCruiseCount,
      portfolioCruiseCount,
      attributedCruisePoints,
      priorSeasonConfirmedPoints,
      attributedCurrentYearPoints: clubRoyaleCurrentYearPoints,
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
      avgCoinInPerCruise: gamingCruiseCount > 0 ? totalCoinIn / gamingCruiseCount : 0,
      avgCashResultPerCruise: gamingCruiseCount > 0 ? totalCashResult / gamingCruiseCount : 0,
      totalRetailValue: gamingActivitySummary.totals.totalRetailValue,
      totalPaid: gamingActivitySummary.totals.totalPaid,
      totalCruiseValueCaptured: gamingActivitySummary.totals.totalCruiseValueCaptured,
      totalEconomicValue: gamingActivitySummary.totals.totalEconomicValue,
      completedCount: gamingCruiseCount || portfolioCruiseCount,
      hasEstimates: gamingActivitySummary.totals.hasEstimates || cruiseEconomicsSummary.totals.hasEstimates,
    };
  }, [attributedCruisePoints, clubRoyaleCurrentYearPoints, cruiseEconomicsSummary, gamingActivitySummary, priorSeasonConfirmedPoints]);
  const hasCasinoCruiseData = casinoStats.completedCount > 0;

  const overlapWarningsByCruiseId = useMemo(() => {
    const warnings = findOverlappingBookedCruises(bookedCruises);
    return new Map(warnings.map((warning) => [warning.cruiseId, warning.message]));
  }, [bookedCruises]);

  const nextCruise = useMemo(() => {
    const upcomingCruises = bookedCruises
      .filter(c => isCruiseUpcomingBooking(c))
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
    return upcomingCruises[0] || null;
  }, [bookedCruises]);

  const physicalVoyageGroups = useMemo(() => buildPhysicalBookedVoyageGroups(bookedCruises), [bookedCruises]);
  const reservationCountByVoyage = useMemo(() => new Map(
    physicalVoyageGroups.map((group) => [group.key, group.reservations.length]),
  ), [physicalVoyageGroups]);
  const consecutiveVoyageBlocks = useMemo(() => buildConsecutiveBookedVoyageBlocks(
    bookedCruises.filter((cruise) => isCruiseUpcomingBooking(cruise)),
  ), [bookedCruises]);
  const nextVoyageReadiness = useMemo(() => {
    if (!nextCruise) return null;
    const checks = [
      { label: 'Reservation', ready: Boolean(nextCruise.bookingId || nextCruise.reservationNumber) },
      { label: 'Stateroom', ready: Boolean(nextCruise.cabinType || nextCruise.stateroomType || nextCruise.stateroomNumber) },
      { label: 'Guests', ready: Boolean((nextCruise.guestNames?.length || 0) > 0 || (nextCruise.guests || 0) > 0) },
      {
        label: 'Itinerary',
        ready: nextCruise.itineraryNeedsManualEntry !== true
          && Boolean(nextCruise.itinerary?.length || nextCruise.itineraryRaw?.length || nextCruise.portsAndTimes),
      },
    ];
    return { checks, complete: checks.filter((check) => check.ready).length };
  }, [nextCruise]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Booked] Refreshing data...');
    try {
      await refreshData();
      if (nextCruise) {
        await sailingWeather.prefetchCruiseForecastWindow(nextCruise, { force: true });
        await queryClient.invalidateQueries({ queryKey: ['sailing-weather', nextCruise.id] });
      }
    } finally {
      setRefreshing(false);
    }
  }, [nextCruise, queryClient, refreshData, sailingWeather]);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setSearchQuery('');
    setHideCompleted(false);
    setSortBy('newest');
  }, []);

  const handleCruisePress = useCallback((cruise: BookedCruise) => {
    console.log('[Booked] Cruise pressed:', cruise.id);
    router.push({
      pathname: '/cruise-details' as any,
      params: buildCruiseDetailsParams(cruise, { source: 'booked' }),
    });
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
    const reservationCount = reservationCountByVoyage.get(getPhysicalBookedVoyageKey(item)) ?? 1;
    const canonicalCard = <CruiseCard
      cruise={item}
      onPress={() => handleCruisePress(item)}
      variant={isPast ? 'completed' : 'booked'}
      conflictWarning={overlapWarningsByCruiseId.get(item.id)}
      mini={true}
      relatedReservationCount={reservationCount}
    />;
    
    return (
      <ResponsiveContainer>
        {reservationCount > 1 ? (
          <View testID="booked-related-reservations" accessibilityLabel={`${reservationCount} separate reservations share this physical voyage`}>
            {canonicalCard}
          </View>
        ) : canonicalCard}
      </ResponsiveContainer>
    );
  }, [handleCruisePress, overlapWarningsByCruiseId, reservationCountByVoyage]);

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
                        <Text style={styles.timelineDaysLabel}>Days</Text>
                      </View>
                    )}
                    <View style={styles.timelineCardWrapper}>
                      <CruiseCard
                        cruise={cruise}
                        onPress={() => handleCruisePress(cruise)}
                        variant="booked"
                        mini={true}
                        relatedReservationCount={reservationCountByVoyage.get(getPhysicalBookedVoyageKey(cruise)) ?? 1}
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
                        relatedReservationCount={reservationCountByVoyage.get(getPhysicalBookedVoyageKey(cruise)) ?? 1}
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
      <TabIdentityBand tab="booked" compact detail={`${stats.total.toLocaleString()} cruise${stats.total === 1 ? '' : 's'} · ${stats.totalNights.toLocaleString()} nights`} />
      {/* Colorful Hero Header */}
      <View style={[styles.heroContainer, !nextCruise && styles.heroContainerEmpty]}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0, 31, 63, 0.3)', 'rgba(0, 31, 63, 0.85)', 'rgba(0, 31, 63, 0.95)']}
          style={styles.heroOverlay}
          pointerEvents="none"
        />
        <View style={styles.heroContent}>
          {nextCruise ? (
            <>
              <TouchableOpacity
                style={styles.nextCruiseCard}
                onPress={() => handleCruisePress(nextCruise)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`Open ${nextCruise.shipName} cruise details`}
                testID="booked-next-cruise-card"
              >
                <View style={styles.nextCruiseHeader}>
                  <Clock size={14} color={COLORS.beigeWarm} />
                  <Text style={styles.nextCruiseLabel}>Next voyage</Text>
                </View>
                <Text style={styles.nextCruiseShip}>{nextCruise.shipName}</Text>
                <Text style={styles.nextCruiseDest}>
                  {nextCruise.nights}N • {nextCruise.destination || nextCruise.itineraryName || 'Caribbean'}
                </Text>
                <Text style={styles.nextCruiseDate}>
                  {createDateFromString(nextCruise.sailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.todayOnCruiseButton}
                onPress={() => router.push({ pathname: '/today-on-cruise' as any, params: { cruiseId: nextCruise.id } })}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Open today on my cruise for ${nextCruise.shipName}`}
                testID="booked-today-on-cruise-button"
              >
                <CalendarDays size={17} color="#082F49" />
                <Text style={styles.todayOnCruiseButtonText}>Today on my cruise</Text>
                <ChevronRight size={17} color="#082F49" />
              </TouchableOpacity>
              {nextVoyageReadiness ? (
                <View style={styles.readinessCard} testID="booked-next-voyage-readiness">
                  <View style={styles.readinessHeader}>
                    <Text style={styles.readinessTitle}>Voyage readiness</Text>
                    <Text style={styles.readinessScore}>{nextVoyageReadiness.complete}/{nextVoyageReadiness.checks.length} confirmed</Text>
                  </View>
                  <View style={styles.readinessChecks}>
                    {nextVoyageReadiness.checks.map((check) => (
                      <View key={check.label} style={[styles.readinessChip, check.ready && styles.readinessChipReady]}>
                        <CheckCircle size={12} color={check.ready ? '#0F766E' : '#6B7280'} />
                        <Text style={[styles.readinessChipText, check.ready && styles.readinessChipTextReady]}>{check.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyHeroCopy}>
              <Ship size={24} color="#D4F4F2" />
              <View style={styles.emptyHeroTextWrap}>
                <Text style={styles.emptyHeroTitle}>No upcoming voyage</Text>
                <Text style={styles.emptyHeroText}>Add or import a reservation to build readiness, weather, itinerary, and casino planning.</Text>
              </View>
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

      {nextCruise ? (
        <View style={styles.marineAlertsSection} testID="booked-sailing-weather-section">
          <ThemedSectionHeader
            tab="booked"
            emoji="🌦️"
            title="Upcoming voyage weather"
            subtitle="Voyage alerts, route conditions, the itinerary map, and the saved offline outlook."
            tone="weather"
            compact
          />
          <View style={styles.sectionBody}>
          <VoyageWeatherSection cruise={nextCruise} />
          </View>
        </View>
      ) : null}

      {/* Combined Casino Section */}
      <View style={styles.casinoSection}>
        <LinearGradient
          colors={['#FFFDF9', '#F5F1E8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.casinoGradient, { borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}
        >
          <ThemedSectionHeader
            tab="booked"
            emoji="🎰"
            title="Casino opportunity"
            subtitle="Cruise value, current points, and the evidence behind each calculation."
            tone="casino"
            compact
            action={<LoyaltyPill label={clubRoyaleTier} color={casinoCardTheme.accentColor} size="small" testID="booked-casino-tier-pill" />}
            testID="booked-casino-opportunity-section"
          />
          <View style={styles.sectionBody}>
          <View style={styles.casinoMetricsGrid}>
            <View style={[styles.casinoMetricCard, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoCardTheme.surfaceColorMuted }]}>
                <Coins size={16} color={casinoCardTheme.accentColor} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoCardTheme.topTextColor }]}>{hasCasinoCruiseData ? formatCurrency(casinoStats.totalCoinIn) : '—'}</Text>
              <Text style={[styles.casinoMetricLabel, { color: casinoCardTheme.secondaryTextColor }]}>{hasCasinoCruiseData ? (casinoStats.hasEstimates ? 'Modeled Coin-In' : 'Recorded Coin-In') : 'Coin-In Not Recorded'}</Text>
            </View>
            
            <View style={[styles.casinoMetricCard, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoCardTheme.surfaceColorMuted }]}>
                <Target size={16} color={casinoCardTheme.accentColor} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoCardTheme.topTextColor }]}>
                {hasCasinoCruiseData ? `${casinoStats.netResult >= 0 ? '+' : ''}${formatCurrency(casinoStats.netResult)}` : '—'}
              </Text>
              <Text style={[styles.casinoMetricLabel, { color: casinoCardTheme.secondaryTextColor }]}>Cash Result</Text>
            </View>
            
            <View style={[styles.casinoMetricCard, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}>
              <View style={[styles.casinoMetricIcon, { backgroundColor: casinoCardTheme.surfaceColorMuted }]}>
                <Award size={16} color={casinoCardTheme.accentColor} />
              </View>
              <Text style={[styles.casinoMetricValue, { color: casinoCardTheme.topTextColor }]}>{formatNumber(currentYearPoints)}</Text>
              <Text style={[styles.casinoMetricLabel, { color: casinoCardTheme.secondaryTextColor }]}>Current Season</Text>
            </View>
          </View>
          
          <View style={[styles.casinoFinancialsRow, { backgroundColor: casinoCardTheme.surfaceColor, borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}>
            <View style={styles.casinoFinancialItem}>
              <Ship size={14} color={casinoCardTheme.accentColor} />
              <View style={styles.casinoFinancialText}>
                <Text style={[styles.casinoFinancialLabel, { color: casinoCardTheme.secondaryTextColor }]}>Retail Value</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoCardTheme.topTextColor }]}>
                  {hasCasinoCruiseData ? formatCurrency(casinoStats.totalRetailValue) : '—'}
                </Text>
              </View>
            </View>
            <View style={[styles.casinoFinancialDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
            <View style={styles.casinoFinancialItem}>
              <DollarSign size={14} color={casinoCardTheme.accentColor} />
              <View style={styles.casinoFinancialText}>
                <Text style={[styles.casinoFinancialLabel, { color: casinoCardTheme.secondaryTextColor }]}>Amount Paid</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoCardTheme.topTextColor }]}>
                  {hasCasinoCruiseData ? formatCurrency(casinoStats.totalPaid) : '—'}
                </Text>
              </View>
            </View>
            <View style={[styles.casinoFinancialDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
            <View style={styles.casinoFinancialItem}>
              <TrendingUp size={14} color={casinoCardTheme.accentColor} />
              <View style={styles.casinoFinancialText}>
                <Text style={[styles.casinoFinancialLabel, { color: casinoCardTheme.secondaryTextColor }]}>Total Economic Value</Text>
                <Text style={[styles.casinoFinancialValue, { color: casinoCardTheme.topTextColor }]}> 
                  {hasCasinoCruiseData ? `${casinoStats.totalEconomicValue >= 0 ? '+' : ''}${formatCurrency(casinoStats.totalEconomicValue)}` : '—'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.casinoAvgRow, { backgroundColor: casinoCardTheme.surfaceColorMuted, borderWidth: 1, borderColor: casinoCardTheme.borderColor, marginBottom: SPACING.sm }]}> 
            <View style={styles.casinoAvgItem}>
              <Text style={[styles.casinoAvgLabel, { color: casinoCardTheme.secondaryTextColor }]}>Prior Season Confirmed</Text>
              <Text style={[styles.casinoAvgValue, { color: casinoCardTheme.topTextColor }]}>{formatNumber(priorSeasonConfirmedPoints)}</Text>
            </View>
            <View style={[styles.casinoAvgDivider, { backgroundColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]} />
            <View style={styles.casinoAvgItem}>
              <Text style={[styles.casinoAvgLabel, { color: casinoCardTheme.secondaryTextColor }]}>Status Tier</Text>
              <Text style={[styles.casinoAvgValue, { color: casinoCardTheme.topTextColor }]}>{clubRoyaleTier}</Text>
            </View>
          </View>

          <View style={styles.casinoProgressCard} testID="booked-casino-tier-progress">
            <Text style={styles.casinoProgressNarrative}>Retained status: {clubRoyaleTier} · current-season earned tier: {earnedClubRoyaleTier}</Text>
            <TierProgressBar
              tierName={clubRoyaleProgressTier}
              currentPoints={currentYearPoints}
              targetPoints={CLUB_ROYALE_TIERS[clubRoyaleProgressTier].threshold}
              percentComplete={clubRoyaleProgress.percentComplete}
              barColor={CLUB_ROYALE_TIERS[clubRoyaleProgressTier].color}
              compact
            />
            <Text style={styles.casinoProgressFootnote}>{clubRoyaleProgress.nextTier ? `${clubRoyaleProgress.pointsToNext.toLocaleString()} points remain to ${clubRoyaleProgress.nextTier}. Prior-season confirmed points remain separate from this current-season bar.` : 'Top current-season tier reached. Prior-season confirmed points remain separately reconciled below.'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.casinoEvidenceToggle, { backgroundColor: casinoCardTheme.surfaceColorMuted, borderColor: casinoCardTheme.borderColor }]}
            onPress={() => setShowCasinoEvidence((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={`${showCasinoEvidence ? 'Hide' : 'Show'} cruises used for Casino calculations`}
            testID="booked-casino-evidence-toggle"
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.casinoEvidenceToggleTitle, { color: casinoCardTheme.topTextColor }]}>Cruise rows attributed: {formatNumber(attributedCruisePoints)} points</Text>
              <Text style={[styles.casinoEvidenceToggleMeta, { color: casinoCardTheme.secondaryTextColor }]}>{casinoEvidenceRows.length} completed cruise{casinoEvidenceRows.length === 1 ? '' : 's'} currently contribute to the calculations above</Text>
            </View>
            <ChevronDown size={18} color={casinoCardTheme.accentColor} style={{ transform: [{ rotate: showCasinoEvidence ? '180deg' : '0deg' }] }} />
          </TouchableOpacity>

          {showCasinoEvidence ? (
            <View style={[styles.casinoEvidenceList, { backgroundColor: casinoCardTheme.surfaceColor, borderColor: casinoCardTheme.borderColor }]} testID="booked-casino-evidence-list">
              {casinoEvidenceRows.length ? casinoEvidenceRows.map((row) => (
                <View key={`${row.cruiseId}-${row.sailDate}`} style={[styles.casinoEvidenceRow, { borderBottomColor: withAlpha(casinoCardTheme.topTextColor, 0.10) }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.casinoEvidenceShip, { color: casinoCardTheme.topTextColor }]}>{row.ship}</Text>
                    <Text style={[styles.casinoEvidenceMeta, { color: casinoCardTheme.secondaryTextColor }]}>{row.sailDate} · {row.calculationConfidence} evidence</Text>
                  </View>
                  <Text style={[styles.casinoEvidencePoints, { color: casinoCardTheme.accentColor }]}>{formatNumber(row.points)} pts</Text>
                </View>
              )) : <Text style={[styles.casinoEvidenceMeta, { color: casinoCardTheme.secondaryTextColor }]}>No completed cruise has an attributed point record yet.</Text>}
              <View style={[styles.casinoReconciliationBox, { borderColor: withAlpha(casinoCardTheme.topTextColor, 0.12) }]}>
                <Text style={[styles.casinoEvidenceShip, { color: casinoCardTheme.topTextColor }]}>Season reconciliation</Text>
                <Text style={[styles.casinoEvidenceMeta, { color: casinoCardTheme.secondaryTextColor }]}>{casinoSeasonReconciliation.priorLabel}: {formatNumber(priorSeasonConfirmedPoints)} confirmed · {formatNumber(casinoSeasonReconciliation.priorAttributed)} assigned to named cruises · {formatNumber(casinoSeasonReconciliation.priorUnallocated)} not yet assigned</Text>
                <Text style={[styles.casinoEvidenceMeta, { color: casinoCardTheme.secondaryTextColor }]}>{casinoSeasonReconciliation.currentLabel}: {formatNumber(currentYearPoints)} current balance · {formatNumber(casinoSeasonReconciliation.currentAttributed)} assigned to named cruises · {formatNumber(casinoSeasonReconciliation.currentUnallocated)} not yet assigned</Text>
              </View>
              <Text style={[styles.casinoEvidenceFootnote, { color: casinoCardTheme.secondaryTextColor }]}>Current Season is the effective saved/provider balance. Prior Season Confirmed is the annual reconciliation total. Cruise rows attributed is only the sum assigned to named completed sailings; these three figures are intentionally not substituted for one another.</Text>
            </View>
          ) : null}

          {casinoStats.completedCount > 0 && (
            <View style={[styles.casinoAvgRow, { backgroundColor: casinoCardTheme.surfaceColorMuted, borderWidth: 1, borderColor: casinoCardTheme.borderColor }]}>
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
          </View>
        </LinearGradient>
      </View>

      <View style={styles.favoriteStateroomsSection} testID="booked-favorite-staterooms-section">
        <ThemedSectionHeader
          tab="booked"
          emoji="⭐️"
          title="Favorite staterooms"
          subtitle="Saved rooms, decks, nearby alternatives, and personal notes."
          tone="success"
          compact
        />
        <View style={styles.sectionBody}>
          <FavoriteStateroomsSection shipOptions={favoriteShipOptions} showHeader={false} />
        </View>
      </View>

      {consecutiveVoyageBlocks.length > 0 ? (
        <View style={styles.consecutiveSection} testID="booked-consecutive-voyage-blocks">
          <ThemedSectionHeader
            tab="booked"
            emoji="🔗"
            title="Consecutive voyage blocks"
            subtitle="Back-to-back sailings grouped into one continuous trip."
            tone="info"
            compact
          />
          {consecutiveVoyageBlocks.map((block) => (
            <View key={block.id} style={styles.consecutiveCard}>
              <View style={styles.consecutiveBlockHeader}>
                <View style={styles.consecutiveIcon}><Ship size={15} color="#FFFFFF" /></View>
                <View style={styles.consecutiveCopy}>
                <Text style={styles.consecutiveTitle}>{block.voyages.length} voyages · {block.nights} cruise nights</Text>
                <Text style={styles.consecutiveMeta}>{block.startDate} to {block.endDate}</Text>
                </View>
              </View>
              <View style={styles.consecutiveVoyageList}>
                {block.voyages.map((group, voyageIndex) => (
                  <View
                    key={group.key}
                    testID={`booked-consecutive-voyage-card-${voyageIndex}`}
                    accessibilityLabel={`Voyage ${voyageIndex + 1} of ${block.voyages.length}: ${group.voyage.shipName}`}
                  >
                    <CruiseCard
                      cruise={group.voyage}
                      onPress={() => handleCruisePress(group.voyage)}
                      variant="booked"
                      mini={true}
                      relatedReservationCount={group.reservations.length}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <IntelligenceFilterStrip contextLabel="Booked" variant="bookedCruises" compact />

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
          
          <ThemedSectionHeader
            tab="booked"
            emoji="🚢"
            title="My cruises"
            subtitle={`${filteredCruises.length} ${filteredCruises.length === 1 ? 'cruise' : 'cruises'} • Tap to view details`}
            compact
            testID="booked-cruise-list-section"
          />
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
      <DataStateCard
        kind="empty"
        title="No booked cruises match"
        reason={filter === 'upcoming'
          ? 'No upcoming cruise records match this owner and filter.'
          : filter === 'completed'
            ? 'No completed cruise records match this owner and filter.'
            : filter === 'celebrity'
              ? 'No Celebrity booking records match this owner.'
              : searchQuery
                ? 'No booked cruise records match the current search.'
                : 'No booked cruise records are stored for this owner yet.'}
        sourceLabel="Owner-scoped booked cruise repository"
        actionLabel={searchQuery || filter !== 'all' || hideCompleted ? 'Clear Filters' : undefined}
        onAction={searchQuery || filter !== 'all' || hideCompleted ? clearFilters : undefined}
      />
    </ResponsiveContainer>
  );

  if (appLoading) {
    return (
      <View style={styles.loadingContainer}>
        <DataStateCard
          kind="loading"
          title="Loading booked cruises"
          reason="Easy Seas is reading this owner’s booked and completed cruise records. Counts remain unavailable until readback finishes."
          committed={false}
          sourceLabel="Owner-scoped booked cruise repository"
          testID="booked-cruises-loading"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: experienceColors.background }]}> 
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
    backgroundColor: '#F6F2EA',
  },
  safeArea: {
    flex: 1,
  },
  sameVoyageBanner: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 2,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: '#FFFFFF',
  },
  sameVoyageBannerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#123D73' },
  readinessCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  readinessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  readinessTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  readinessScore: { fontSize: 11, fontWeight: '700', color: '#D4F4F2' },
  readinessChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  readinessChip: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  readinessChipReady: { backgroundColor: '#DDF5F2' },
  readinessChipText: { fontSize: 10, fontWeight: '700', color: '#596674' },
  readinessChipTextReady: { color: '#0F766E' },
  consecutiveSection: { marginTop: 16 },
  favoriteStateroomsSection: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  consecutiveSectionTitle: { marginBottom: 8, fontSize: 16, lineHeight: 21, fontWeight: '800', color: '#17324D' },
  consecutiveCard: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBDDE2',
    backgroundColor: '#FFFDF9',
  },
  consecutiveBlockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  consecutiveIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#167C80' },
  consecutiveCopy: { flex: 1, marginLeft: 10 },
  consecutiveTitle: { fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 17, lineHeight: 21, fontWeight: '600', color: '#17324D' },
  consecutiveMeta: { marginTop: 2, fontSize: 11, color: '#60727F' },
  consecutiveVoyageList: { gap: 10 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: '#F6F2EA',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.secondary,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 120,
  },
  headerContent: {
    marginBottom: SPACING.md,
  },
  heroContainer: {
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  heroContainerEmpty: {
    height: 150,
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
    padding: 18,
  },
  emptyHeroCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyHeroTextWrap: { flex: 1 },
  emptyHeroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  emptyHeroText: { color: '#D4F4F2', fontSize: 12, lineHeight: 17, marginTop: 3 },
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
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  nextCruiseCard: {
    backgroundColor: 'rgba(21, 40, 59, 0.48)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
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
    fontSize: 28,
    lineHeight: 33,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
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
  todayOnCruiseButton: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FDE68A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  todayOnCruiseButtonText: {
    flex: 1,
    textAlign: 'center',
    color: '#082F49',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 12,
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
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D2C8',
    borderRadius: 14,
    padding: 0,
    overflow: 'hidden',
  },
  sectionBody: {
    padding: 14,
    paddingTop: 12,
  },
  casinoSection: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOW.sm,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    backgroundColor: '#FFFFFF',
  },
  casinoGradient: {
    padding: 0,
  },
  casinoProgressCard: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  casinoProgressNarrative: {
    color: '#0F2247',
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  casinoProgressFootnote: {
    color: '#58585B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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
    borderRadius: 14,
    padding: 12,
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
  casinoEvidenceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  casinoEvidenceToggleTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  casinoEvidenceToggleMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  casinoEvidenceList: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  casinoEvidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  casinoEvidenceShip: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  casinoEvidenceMeta: {
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  casinoEvidencePoints: {
    fontSize: 12,
    fontWeight: '900' as const,
  },
  casinoReconciliationBox: {
    borderTopWidth: 1,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    gap: 2,
  },
  casinoEvidenceFootnote: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: SPACING.sm,
    fontStyle: 'italic' as const,
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
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 19,
    fontWeight: '600',
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
