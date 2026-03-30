import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Bot, Check, X } from 'lucide-react-native';
import { FavoriteStateroomsSection } from '@/components/favorite-staterooms/FavoriteStateroomsSection';
import { AgentXChat } from '@/components/AgentXChat';
import { AlertsManagerModal } from '@/components/AlertsManagerModal';
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
import { APP_TEXTURE, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import { createDateFromString, formatDate, getDaysUntil, isDateInPast } from '@/lib/date';
import { findBackToBackSets, type BackToBackSet } from '@/lib/backToBackFinder';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import {
  buildCruiseCardFields,
  getCruiseBadge,
  pickCruiseImage,
  type DisplayField,
} from '../../lib/cruisePresentation';
import { useAgentX } from '@/state/AgentXProvider';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

type ViewTab = 'available' | 'all' | 'foryou' | 'booked';
type CabinFilter = 'all' | 'Interior' | 'Oceanview' | 'Balcony' | 'Suite';
type SortOption = 'date-asc' | 'date-desc' | 'value-asc' | 'value-desc' | 'nights-desc';

interface FilterState {
  cabinType: CabinFilter;
  noConflicts: boolean;
  searchQuery: string;
  sortBy: SortOption;
  selectedShips: string[];
}

const TABS: { key: ViewTab; label: string }[] = [
  { key: 'available', label: 'Available' },
  { key: 'all', label: 'All Cruises' },
  { key: 'foryou', label: 'Back-to-Back' },
  { key: 'booked', label: 'Booked' },
];

const CABIN_FILTERS: { key: CabinFilter; label: string }[] = [
  { key: 'all', label: 'All Cabins' },
  { key: 'Interior', label: 'Interior' },
  { key: 'Oceanview', label: 'Oceanview' },
  { key: 'Balcony', label: 'Balcony' },
  { key: 'Suite', label: 'Suite' },
];

const SORT_LABELS: Record<SortOption, string> = {
  'date-asc': 'Soonest',
  'date-desc': 'Latest',
  'value-asc': 'Lowest Value',
  'value-desc': 'Best Value',
  'nights-desc': 'Longest',
};

export default function SchedulingScreen() {
  const router = useRouter();
  const { localData, clubRoyaleProfile, isLoading: appLoading } = useAppState();
  const { bookedCruises } = useCoreData();
  const { currentUser } = useUser();
  const { messages, isLoading: agentLoading, sendMessage, isVisible, setVisible, isExpanded, toggleExpanded } = useAgentX();

  const [activeTab, setActiveTab] = useState<ViewTab>('available');
  const [filters, setFilters] = useState<FilterState>({
    cabinType: 'all',
    noConflicts: false,
    searchQuery: '',
    sortBy: 'date-asc',
    selectedShips: [],
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);

  const allCruises = useMemo<Cruise[]>(() => localData.cruises || [], [localData.cruises]);
  const allOffers = useMemo<CasinoOffer[]>(() => localData.offers || [], [localData.offers]);

  const bookedCruisesData = useMemo<BookedCruise[]>(() => {
    const localBooked = localData.booked || [];
    const storeBooked = bookedCruises || [];
    return localBooked.length > 0 ? localBooked : storeBooked;
  }, [bookedCruises, localData.booked]);

  const bookedIds = useMemo<Set<string>>(() => new Set(bookedCruisesData.map((cruise) => cruise.id)), [bookedCruisesData]);

  const bookedDates = useMemo<Set<string>>(() => {
    const dates = new Set<string>();
    bookedCruisesData.forEach((cruise) => {
      try {
        const sailDate = createDateFromString(cruise.sailDate);
        const returnDate = createDateFromString(cruise.returnDate);
        const currentDate = new Date(sailDate);
        while (currentDate <= returnDate) {
          dates.add(currentDate.toISOString().split('T')[0] ?? '');
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } catch (error) {
        console.log('[Scheduling] booked date build failed', error);
      }
    });
    return dates;
  }, [bookedCruisesData]);

  const hasConflict = useCallback((cruise: Cruise): boolean => {
    try {
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate);
      const currentDate = new Date(sailDate);
      while (currentDate <= returnDate) {
        if (bookedDates.has(currentDate.toISOString().split('T')[0] ?? '')) {
          return true;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } catch (error) {
      console.log('[Scheduling] conflict check failed', error);
    }
    return false;
  }, [bookedDates]);

  const availableShips = useMemo<string[]>(() => {
    const ships = new Set<string>();
    allOffers.forEach((offer) => {
      if (offer.shipName) {
        ships.add(offer.shipName);
      }
    });
    allCruises.forEach((cruise) => {
      if (cruise.shipName) {
        ships.add(cruise.shipName);
      }
    });
    return Array.from(ships).sort((left, right) => left.localeCompare(right));
  }, [allCruises, allOffers]);

  const linkedOfferByCruiseId = useMemo<Map<string, CasinoOffer>>(() => {
    const map = new Map<string, CasinoOffer>();
    allOffers.forEach((offer) => {
      if (offer.cruiseId) {
        map.set(offer.cruiseId, offer);
      }
      offer.cruiseIds?.forEach((cruiseId) => {
        map.set(cruiseId, offer);
      });
    });
    return map;
  }, [allOffers]);

  const enrichedCruises = useMemo<Cruise[]>(() => {
    return allCruises.map((cruise) => {
      const linkedOffer = linkedOfferByCruiseId.get(cruise.id) ?? allOffers.find((offer) => {
        if (offer.offerCode && cruise.offerCode && offer.offerCode === cruise.offerCode) {
          return true;
        }
        return offer.shipName === cruise.shipName && offer.sailingDate === cruise.sailDate;
      });

      if (!linkedOffer) {
        return cruise;
      }

      return {
        ...cruise,
        offerName: cruise.offerName || linkedOffer.offerName || linkedOffer.title,
        offerCode: cruise.offerCode || linkedOffer.offerCode,
        freePlay: cruise.freePlay ?? linkedOffer.freePlay ?? linkedOffer.freeplayAmount,
        freeOBC: cruise.freeOBC ?? linkedOffer.OBC ?? linkedOffer.obcAmount,
        tradeInValue: cruise.tradeInValue ?? linkedOffer.tradeInValue,
        interiorPrice: cruise.interiorPrice ?? linkedOffer.interiorPrice,
        oceanviewPrice: cruise.oceanviewPrice ?? linkedOffer.oceanviewPrice,
        balconyPrice: cruise.balconyPrice ?? linkedOffer.balconyPrice,
        suitePrice: cruise.suitePrice ?? linkedOffer.suitePrice,
        taxes: cruise.taxes ?? linkedOffer.taxesFees,
        perks: cruise.perks ?? linkedOffer.perks,
      } satisfies Cruise;
    });
  }, [allCruises, allOffers, linkedOfferByCruiseId]);

  const filteredCruises = useMemo<Cruise[]>(() => {
    let result = [...enrichedCruises];

    if (activeTab === 'available') {
      result = result.filter((cruise) => !isDateInPast(cruise.sailDate) && !bookedIds.has(cruise.id) && !hasConflict(cruise));
    } else if (activeTab === 'all') {
      result = result.filter((cruise) => !isDateInPast(cruise.sailDate));
    } else if (activeTab === 'booked') {
      result = bookedCruisesData.filter((cruise) => !isDateInPast(cruise.returnDate || cruise.sailDate));
    }

    if (filters.cabinType !== 'all') {
      result = result.filter((cruise) => (cruise.cabinType || '').toLowerCase().includes(filters.cabinType.toLowerCase()));
    }

    if (filters.noConflicts && activeTab === 'all') {
      result = result.filter((cruise) => !hasConflict(cruise));
    }

    if (filters.selectedShips.length > 0) {
      result = result.filter((cruise) => cruise.shipName ? filters.selectedShips.includes(cruise.shipName) : false);
    }

    const query = filters.searchQuery.trim().toLowerCase();
    if (query.length > 0) {
      result = result.filter((cruise) => (
        cruise.shipName?.toLowerCase().includes(query) ||
        cruise.destination?.toLowerCase().includes(query) ||
        cruise.departurePort?.toLowerCase().includes(query) ||
        cruise.itineraryName?.toLowerCase().includes(query) ||
        cruise.offerCode?.toLowerCase().includes(query) ||
        cruise.offerName?.toLowerCase().includes(query)
      ));
    }

    result.sort((left, right) => {
      switch (filters.sortBy) {
        case 'date-asc':
          return createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime();
        case 'date-desc':
          return createDateFromString(right.sailDate).getTime() - createDateFromString(left.sailDate).getTime();
        case 'value-asc':
          return calculateCruiseValue(left).totalRetailValue - calculateCruiseValue(right).totalRetailValue;
        case 'value-desc':
          return calculateCruiseValue(right).totalRetailValue - calculateCruiseValue(left).totalRetailValue;
        case 'nights-desc':
          return (right.nights || 0) - (left.nights || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [activeTab, bookedCruisesData, bookedIds, enrichedCruises, filters, hasConflict]);

  const backToBackSets = useMemo<BackToBackSet[]>(() => {
    if (activeTab !== 'foryou') {
      return [];
    }

    return findBackToBackSets(enrichedCruises, bookedDates, {
      maxGapDays: 2,
      requireDifferentOffers: true,
      excludeConflicts: false,
      minChainLength: 2,
      bookedCruises: bookedCruisesData,
      casinoOffers: allOffers,
    });
  }, [activeTab, allOffers, bookedCruisesData, bookedDates, enrichedCruises]);

  const sortedBackToBackSets = useMemo<BackToBackSet[]>(() => {
    const cloned = [...backToBackSets];
    cloned.sort((left, right) => {
      switch (filters.sortBy) {
        case 'date-desc':
          return createDateFromString(right.startDate).getTime() - createDateFromString(left.startDate).getTime();
        case 'nights-desc':
          return right.totalNights - left.totalNights;
        case 'value-desc': {
          const leftValue = left.cruises.reduce((sum, cruise) => sum + calculateCruiseValue(cruise).totalRetailValue, 0);
          const rightValue = right.cruises.reduce((sum, cruise) => sum + calculateCruiseValue(cruise).totalRetailValue, 0);
          return rightValue - leftValue;
        }
        case 'value-asc': {
          const leftValue = left.cruises.reduce((sum, cruise) => sum + calculateCruiseValue(cruise).totalRetailValue, 0);
          const rightValue = right.cruises.reduce((sum, cruise) => sum + calculateCruiseValue(cruise).totalRetailValue, 0);
          return leftValue - rightValue;
        }
        default:
          return createDateFromString(left.startDate).getTime() - createDateFromString(right.startDate).getTime();
      }
    });
    return cloned;
  }, [backToBackSets, filters.sortBy]);

  const stats = useMemo(() => {
    const available = enrichedCruises.filter((cruise) => !isDateInPast(cruise.sailDate) && !bookedIds.has(cruise.id) && !hasConflict(cruise)).length;
    const totalValue = enrichedCruises.reduce((sum, cruise) => sum + calculateCruiseValue(cruise).totalRetailValue, 0);
    const totalNights = enrichedCruises.reduce((sum, cruise) => sum + (cruise.nights || 0), 0);
    return {
      showing: activeTab === 'foryou' ? sortedBackToBackSets.length : filteredCruises.length,
      total: enrichedCruises.length,
      booked: bookedCruisesData.length,
      available,
      totalValue,
      totalNights,
    };
  }, [activeTab, bookedCruisesData.length, bookedIds, enrichedCruises, filteredCruises.length, hasConflict, sortedBackToBackSets.length]);

  const alertCount = useMemo<number>(() => {
    return allOffers.filter((offer) => {
      const expiry = offer.expiryDate || offer.offerExpiryDate || offer.expires;
      if (!expiry) {
        return false;
      }
      const days = getDaysUntil(expiry);
      return days > 0 && days <= 7;
    }).length;
  }, [allOffers]);

  const heroPills = useMemo(() => ([
    { label: 'Available', value: formatNumber(stats.available), tone: 'gold' as const },
    { label: 'Booked', value: formatNumber(stats.booked), tone: 'teal' as const },
    { label: 'Nights', value: formatNumber(stats.totalNights), tone: 'violet' as const },
    { label: 'Retail', value: formatCurrency(stats.totalValue), tone: 'emerald' as const },
  ]), [stats.available, stats.booked, stats.totalNights, stats.totalValue]);

  const quickFacts = useMemo<DisplayField[]>(() => ([
    { key: 'showing', label: 'Showing', value: formatNumber(stats.showing), tone: 'accent' },
    { key: 'total', label: 'Total Cruises', value: formatNumber(stats.total), tone: 'default' },
    { key: 'expiring', label: 'Expiring Offers', value: formatNumber(alertCount), tone: alertCount > 0 ? 'warning' : 'default' },
  ]), [alertCount, stats.showing, stats.total]);

  const topStatFields = useMemo<DisplayField[]>(() => ([
    { key: 'available', label: 'Open Cruises', value: formatNumber(stats.available), tone: 'success' },
    { key: 'booked', label: 'Booked Cruises', value: formatNumber(stats.booked), tone: 'accent' },
    { key: 'retail', label: 'Retail Inventory', value: formatCurrency(stats.totalValue), tone: 'success' },
    { key: 'nights', label: 'Total Nights', value: formatNumber(stats.totalNights), tone: 'default' },
  ]), [stats.available, stats.booked, stats.totalNights, stats.totalValue]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Scheduling] Refreshing cruises...');
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRefreshing(false);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      cabinType: 'all',
      noConflicts: false,
      searchQuery: '',
      sortBy: 'date-asc',
      selectedShips: [],
    });
  }, []);

  const toggleShipFilter = useCallback((shipName: string) => {
    setFilters((current) => {
      const isSelected = current.selectedShips.includes(shipName);
      return {
        ...current,
        selectedShips: isSelected
          ? current.selectedShips.filter((ship) => ship !== shipName)
          : [...current.selectedShips, shipName],
      };
    });
  }, []);

  const handleCruisePress = useCallback((cruise: Cruise) => {
    console.log('[Scheduling] Cruise pressed:', cruise.id);
    router.push(`/cruise-details?id=${cruise.id}` as never);
  }, [router]);

  const handleAgentClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const renderCruiseCard = useCallback(({ item }: { item: Cruise }) => {
    const linkedOffer = linkedOfferByCruiseId.get(item.id) ?? allOffers.find((offer) => offer.offerCode && item.offerCode && offer.offerCode === item.offerCode);
    const cardFields = buildCruiseCardFields(item, linkedOffer);
    const badge = getCruiseBadge(item);
    const daysUntil = getDaysUntil(item.sailDate);
    const subtitle = `${formatDate(item.sailDate, 'medium')} • ${item.nights || 0} nights • ${item.departurePort || 'Port TBD'}`;
    const chips = [
      item.destination || item.itineraryName || 'Cruise',
      item.cabinType || 'Cabin TBD',
      item.offerCode || 'No offer code',
      daysUntil > 0 ? `${daysUntil} days away` : 'Sailing soon',
    ].filter(Boolean);

    return (
      <PremiumEntityCard
        title={item.shipName}
        subtitle={subtitle}
        imageUri={pickCruiseImage(item)}
        badge={badge}
        chips={chips}
        primaryFields={cardFields.primary}
        extraFields={cardFields.extra}
        footerText={badge.label === 'BOOKED' ? 'Booked cruise card retains all booking and value fields.' : 'Tap to open the full cruise detail screen.'}
        onPress={() => handleCruisePress(item)}
      />
    );
  }, [allOffers, handleCruisePress, linkedOfferByCruiseId]);

  const renderBackToBackCard = useCallback(({ item }: { item: BackToBackSet }) => {
    const chainValue = item.cruises.reduce((sum, cruise) => sum + calculateCruiseValue(cruise).totalRetailValue, 0);
    const primaryFields: DisplayField[] = [
      { key: 'startDate', label: 'Start', value: formatDate(item.startDate, 'medium'), tone: 'accent' },
      { key: 'endDate', label: 'End', value: formatDate(item.endDate, 'medium'), tone: 'accent' },
      { key: 'totalNights', label: 'Nights', value: formatNumber(item.totalNights), tone: 'default' },
      { key: 'departurePort', label: 'Departure Port', value: item.departurePort || 'TBD', tone: 'default' },
      { key: 'cruises', label: 'Sailings', value: formatNumber(item.cruises.length), tone: 'default' },
      { key: 'value', label: 'Retail Value', value: formatCurrency(chainValue), tone: 'success' },
    ];
    const extraFields: DisplayField[] = [
      { key: 'offerCodes', label: 'Offer Codes', value: item.offerCodes.join(' • ') || 'None listed', tone: 'accent' },
      { key: 'offerNames', label: 'Offer Names', value: item.offerNames.join(' • ') || 'None listed', tone: 'default' },
      { key: 'gapDays', label: 'Gap Pattern', value: item.gapDays.map((gap) => `${gap}d`).join(' • ') || 'Same-day chain', tone: 'default' },
      {
        key: 'ships',
        label: 'Chain Cruises',
        value: item.cruises.map((cruise) => `${cruise.shipName} — ${formatDate(cruise.sailDate, 'medium')} — ${cruise.offerCode || 'No code'}`).join('\n'),
        tone: 'default',
      },
    ];

    return (
      <PremiumEntityCard
        title={item.slots[0]?.shipName || 'Back-to-Back Chain'}
        subtitle={`${item.cruises.length} linked sailings • ${item.departurePort || 'Port TBD'}`}
        imageUri={pickCruiseImage(item.cruises[0], item.id)}
        badge={{ label: 'CHAIN READY', tone: 'violet' }}
        chips={item.offerCodes.filter(Boolean)}
        primaryFields={primaryFields}
        extraFields={extraFields}
        footerText="Every sailing and offer code in this chain is preserved below."
      />
    );
  }, []);

  const listHeader = useMemo(() => (
    <View style={styles.headerStack}>
      <PremiumHeroCard
        title="Cruise Matrix"
        subtitle={`Offers-grade cards for every sailing. ${currentUser?.name || clubRoyaleProfile.memberName || 'Your'} inventory is now unified with the premium offers system.`}
        badge={{ label: activeTab === 'foryou' ? 'SMART CHAINS' : 'MY CRUISES', tone: activeTab === 'foryou' ? 'violet' : 'gold' }}
        imageUri={pickCruiseImage(filteredCruises[0] ?? enrichedCruises[0], 'cruise-matrix')}
        pills={heroPills}
      >
        <PremiumQuickFacts fields={quickFacts} />
      </PremiumHeroCard>

      <PremiumStatGrid title="Portfolio Snapshot" fields={topStatFields} />

      <PremiumActionBar
        actions={[
          { key: 'refresh', label: 'Refresh', onPress: onRefresh, tone: 'teal' },
          { key: 'alerts', label: `Alerts ${alertCount > 0 ? `(${alertCount})` : ''}`, onPress: () => setShowAlertsModal(true), tone: alertCount > 0 ? 'rose' : 'slate' },
          { key: 'ai', label: isVisible ? 'Hide AI' : 'Open AI', onPress: () => setVisible(!isVisible), tone: 'gold' },
          { key: 'filters', label: showAdvancedFilters ? 'Hide Filters' : 'Show Filters', onPress: () => setShowAdvancedFilters((current) => !current), tone: 'violet' },
          { key: 'settings', label: 'Settings', onPress: () => router.push('/settings' as never), tone: 'slate' },
        ]}
      />

      <PremiumChipBar
        chips={TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          active: activeTab === tab.key,
          onPress: () => setActiveTab(tab.key),
          tone: tab.key === 'booked' ? 'teal' : tab.key === 'foryou' ? 'violet' : 'gold',
        }))}
      />

      <View style={styles.searchSurface}>
        <Text style={styles.searchLabel}>Search ships, ports, destinations, itinerary, or offer codes</Text>
        <TextInput
          value={filters.searchQuery}
          onChangeText={(value) => setFilters((current) => ({ ...current, searchQuery: value }))}
          placeholder="Search cruises"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          testID="scheduling-search-input"
        />
      </View>

      <PremiumChipBar
        chips={(Object.keys(SORT_LABELS) as SortOption[]).map((sortKey) => ({
          key: sortKey,
          label: SORT_LABELS[sortKey],
          active: filters.sortBy === sortKey,
          onPress: () => setFilters((current) => ({ ...current, sortBy: sortKey })),
          tone: sortKey.includes('value') ? 'emerald' : 'gold',
        }))}
      />

      {showAdvancedFilters ? (
        <View style={styles.advancedStack}>
          <PremiumChipBar
            chips={availableShips.map((ship) => ({
              key: ship,
              label: ship,
              active: filters.selectedShips.includes(ship),
              onPress: () => toggleShipFilter(ship),
              tone: 'teal',
            }))}
          />
          <PremiumChipBar
            chips={CABIN_FILTERS.map((cabin) => ({
              key: cabin.key,
              label: cabin.label,
              active: filters.cabinType === cabin.key,
              onPress: () => setFilters((current) => ({ ...current, cabinType: cabin.key })),
              tone: cabin.key === 'all' ? 'slate' : 'gold',
            }))}
          />
          <TouchableOpacity
            style={[styles.booleanFilterButton, filters.noConflicts && styles.booleanFilterButtonActive]}
            onPress={() => setFilters((current) => ({ ...current, noConflicts: !current.noConflicts }))}
            activeOpacity={0.85}
            testID="scheduling-no-conflicts-toggle"
          >
            <View style={[styles.checkbox, filters.noConflicts && styles.checkboxActive]}>
              {filters.noConflicts ? <Check size={12} color={COLORS.white} /> : null}
            </View>
            <Text style={styles.booleanFilterText}>Show only conflict-free sailings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.85}>
            <X size={14} color="#FFD0DB" />
            <Text style={styles.clearButtonText}>Reset all filters</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  ), [activeTab, alertCount, availableShips, clearFilters, clubRoyaleProfile.memberName, currentUser?.name, enrichedCruises, filteredCruises, filters.cabinType, filters.noConflicts, filters.searchQuery, filters.selectedShips, filters.sortBy, heroPills, isVisible, onRefresh, quickFacts, setVisible, showAdvancedFilters, toggleShipFilter, topStatFields, router]);

  if (appLoading) {
    return (
      <PremiumPageBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9EFDF2" />
          <Text style={styles.loadingText}>Loading cruise portfolio…</Text>
        </View>
      </PremiumPageBackground>
    );
  }

  return (
    <PremiumPageBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {activeTab === 'foryou' ? (
          <FlatList
            data={sortedBackToBackSets}
            keyExtractor={(item) => item.id}
            renderItem={renderBackToBackCard}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={<PremiumEmptyState title="No chain-ready back-to-backs" subtitle="We preserved the back-to-back discovery flow. Try broadening filters or importing more sailings." />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" colors={['#1E3A5F']} />}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={filteredCruises}
            keyExtractor={(item) => item.id}
            renderItem={renderCruiseCard}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={<PremiumEmptyState title="No cruises match these filters" subtitle="All cruise fields are still intact. Adjust the chips above or clear filters to expand the list." />}
            ListFooterComponent={activeTab === 'available' ? <FavoriteStateroomsSection shipOptions={availableShips} /> : null}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" colors={['#1E3A5F']} />}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      <TouchableOpacity
        style={styles.floatingAiButton}
        onPress={() => setVisible(!isVisible)}
        activeOpacity={0.9}
        testID="scheduling-ai-toggle"
      >
        {isVisible ? <X size={22} color="#FFFFFF" /> : <Bot size={22} color="#FFFFFF" />}
      </TouchableOpacity>

      <Modal visible={isVisible} animationType="slide" transparent onRequestClose={handleAgentClose}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleAgentClose} />
          <View style={[styles.agentContainer, isExpanded && styles.agentContainerExpanded]}>
            <AgentXChat
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={agentLoading}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpanded}
              onClose={handleAgentClose}
              showHeader={true}
              placeholder="Ask about cruise value, conflicts, offers, and booking strategy..."
            />
          </View>
        </View>
      </Modal>

      <AlertsManagerModal visible={showAlertsModal} onClose={() => setShowAlertsModal(false)} />
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
  advancedStack: {
    gap: SPACING.md,
  },
  booleanFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: APP_TEXTURE.surfaceStrong,
    borderWidth: 1,
    borderColor: APP_TEXTURE.border,
  },
  booleanFilterButtonActive: {
    backgroundColor: 'rgba(0,151,167,0.10)',
    borderColor: 'rgba(0,151,167,0.24)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(126, 143, 162, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  checkboxActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.white,
  },
  booleanFilterText: {
    flex: 1,
    color: '#1A2A3D',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  clearButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,245,247,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.18)',
  },
  clearButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  floatingAiButton: {
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  agentContainer: {
    height: '72%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: APP_TEXTURE.frame,
  },
  agentContainerExpanded: {
    height: '88%',
  },
});
