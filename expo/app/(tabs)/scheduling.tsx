import React, { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ship,
  X,
  Bell,
  Sparkles,
  ListFilter,
  Bot,
  Check,
  Bookmark,
  RotateCcw,
  CalendarDays,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { MinimalistFilterBar } from '@/components/ui/MinimalistFilterBar';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { DataStateCard, FilterButton, InlineLoading } from '@/components/ui/EasySeasPrimitives';
import { isDateInPast, getDaysUntil, createDateFromString, toLocalCalendarDateOnly } from '@/lib/date';
import { isActiveBookedCruise } from '@/lib/bookedCruiseStatus';
import { CruiseCard } from '@/components/CruiseCard';
import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { AlertsManagerModal } from '@/components/AlertsManagerModal';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { findBackToBackSets, type BackToBackSet, type CruiseOffer } from '@/lib/backToBackFinder';
import { formatGuestEligibility, getCruiseGuestEligibility } from '@/lib/cruiseRecordIntegrity';
import { findSingleMaterialOffer } from '@/lib/itineraryIntegrity';
import { Link2, Calendar, Tag, Anchor, ChevronRight } from 'lucide-react-native';
import { beginPerformanceSpan, recordPerformanceCount, recordProviderRender } from '@/lib/performance/performanceDiagnostics';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import type { CruiseInventoryCursor } from '@/lib/cruiseInventory/CruiseInventoryRepository';
import { useCertificates } from '@/state/CertificatesProvider';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import { matchesCruiseDiscoveryFilters, matchesCruiseDiscoverySearch } from '@/lib/cruises/cruiseDiscoveryFilters';
import { sortCruiseDiscoveryRows, type CruiseDiscoverySortOption } from '@/lib/cruises/cruiseDiscoverySort';
import { useExperience } from '@/state/ExperienceProvider';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { getCanonicalCruiseInventoryKey, getCruiseInventoryOptionKey } from '@/lib/cruiseInventory/cruiseCanonicalIdentity';

type ViewTab = 'available' | 'all' | 'foryou' | 'booked';
type CabinFilter = 'all' | 'Interior' | 'Oceanview' | 'Balcony' | 'Suite';
type SortOption = CruiseDiscoverySortOption;
type EligibilityFilter = 'all' | 'offer' | 'certificate';

interface FilterState {
  cabinType: CabinFilter;
  noConflicts: boolean;
  searchQuery: string;
  sortBy: SortOption;
  selectedShips: string[];
  selectedShipClasses: string[];
  guestCounts: number[];
  departurePorts: string[];
  regions: string[];
  dateFrom: string;
  dateTo: string;
  minNights: string;
  maxNights: string;
  eligibility: EligibilityFilter;
}

type SchedulingViewState = { activeTab: ViewTab; filters: FilterState; scrollOffset: number };

const createDefaultFilters = (): FilterState => ({
  cabinType: 'all', noConflicts: false, searchQuery: '', sortBy: 'date-asc', selectedShips: [],
  selectedShipClasses: [], guestCounts: [], departurePorts: [], regions: [],
  dateFrom: '', dateTo: '', minNights: '', maxNights: '', eligibility: 'all',
});

let schedulingViewStateCache: SchedulingViewState = {
  activeTab: 'available', filters: createDefaultFilters(), scrollOffset: 0,
};

function compactText(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }

function parseOptionalFilterNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function getCruiseShipClass(cruise: Cruise): string {
  const row = cruise as Cruise & { shipClass?: string; shipClassName?: string; vesselClass?: string };
  return compactText(row.shipClass) || compactText(row.shipClassName) || compactText(row.vesselClass);
}

function toggleFilterValue<T extends string | number>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

function CruiseFilterChip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return <TouchableOpacity style={[styles.sheetChip, selected && styles.sheetChipActive]} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} testID={testID}>
    {selected ? <Check size={13} color="#FFFFFF" /> : null}
    <Text style={[styles.sheetChipText, selected && styles.sheetChipTextActive]}>{label}</Text>
  </TouchableOpacity>;
}

const TABS: { key: ViewTab; label: string; icon?: any }[] = [
  { key: 'available', label: 'Available', icon: Ship },
  { key: 'all', label: 'All', icon: ListFilter },
  { key: 'foryou', label: 'Back 2 Back', icon: Sparkles },
  { key: 'booked', label: 'Booked', icon: Bookmark },
];

const CABIN_FILTERS: { key: CabinFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Interior', label: 'Interior' },
  { key: 'Oceanview', label: 'Ocean' },
  { key: 'Balcony', label: 'Balcony' },
  { key: 'Suite', label: 'Suite' },
];

const EMPTY_CRUISES: Cruise[] = [];
const EMPTY_BOOKED_CRUISES: BookedCruise[] = [];
const EMPTY_CASINO_OFFERS: CasinoOffer[] = [];

export default function SchedulingScreen() {
  recordProviderRender('SchedulingScreen');
  const router = useRouter();
  const { colors: experienceColors, isDark, preferences } = useExperience();
  const { localData, isLoading: appLoading } = useAppState();
  const { bookedCruises: storedBookedCruises } = useCoreData();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand } = useIntelligenceFilters();
  const { queryCruises, totalCruises, facets, isInventoryReady, inventoryError, refreshCounts } = useCruiseInventory();
  const { searchableCertificates, refreshCertificateDocuments } = useCertificates();

  const [activeTab, setActiveTab] = useState<ViewTab>(schedulingViewStateCache.activeTab);
  const [filters, setFilters] = useState<FilterState>(() => schedulingViewStateCache.filters);
  const [refreshing, setRefreshing] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [catalogRows, setCatalogRows] = useState<Cruise[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRefreshVersion, setCatalogRefreshVersion] = useState(0);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showFilterHelp, setShowFilterHelp] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const nextCatalogCursorRef = useRef<CruiseInventoryCursor | null>(null);
  const cruiseListRef = useRef<FlatList<Cruise> | null>(null);

  const resetCatalogPosition = useCallback(() => {
    schedulingViewStateCache = { ...schedulingViewStateCache, scrollOffset: 0 };
    cruiseListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const effectiveSelectedProgram = useMemo<'clubRoyale' | 'blueChip' | 'venetianSociety' | 'all'>(() => selectedBrand === 'royal'
    ? 'clubRoyale'
    : selectedBrand === 'celebrity'
      ? 'blueChip'
      : selectedBrand === 'silversea'
        ? 'venetianSociety'
        : 'all', [selectedBrand]);

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram: effectiveSelectedProgram,
  }), [effectiveSelectedProgram, selectedBrand, selectedProfileId]);

  const deferredLegacyCruises = useDeferredValue((localData.cruises || []) as Cruise[], EMPTY_CRUISES);
  const deferredOffers = useDeferredValue((localData.offers || []) as CasinoOffer[], EMPTY_CASINO_OFFERS);
  const deferredLocalBooked = useDeferredValue((localData.booked || []) as BookedCruise[], EMPTY_BOOKED_CRUISES);
  const deferredStoredBooked = useDeferredValue((storedBookedCruises || []) as BookedCruise[], EMPTY_BOOKED_CRUISES);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(filters.searchQuery.trim()), 300);
    return () => clearTimeout(timeout);
  }, [filters.searchQuery]);

  useEffect(() => {
    schedulingViewStateCache = { ...schedulingViewStateCache, activeTab, filters };
  }, [activeTab, filters]);

  useFocusEffect(useCallback(() => {
    // Cruise discovery is the orientation point for this tab. Returning to the
    // tab always reveals its search and filters instead of restoring a deep,
    // contextless catalog position.
    schedulingViewStateCache = { ...schedulingViewStateCache, scrollOffset: 0 };
    const timer = setTimeout(() => cruiseListRef.current?.scrollToOffset({ offset: 0, animated: false }), 0);
    return () => clearTimeout(timer);
  }, []));

  const handleCatalogScroll = useCallback((offset: number) => {
    schedulingViewStateCache = { ...schedulingViewStateCache, scrollOffset: Math.max(0, offset) };
  }, []);

  const selectedProviders = useMemo(() => {
    if (!selectedBrand || selectedBrand === 'all' || selectedBrand === 'unknown') return undefined;
    return [selectedBrand];
  }, [selectedBrand]);

  useEffect(() => {
    if (!isInventoryReady || totalCruises === 0 || activeTab === 'booked') return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    nextCatalogCursorRef.current = null;
    void queryCruises({
      providers: selectedProviders,
      shipNames: filters.selectedShips.length > 0 ? filters.selectedShips : undefined,
      shipClasses: filters.selectedShipClasses.length > 0 ? filters.selectedShipClasses : undefined,
      guestCounts: filters.guestCounts.length > 0 ? filters.guestCounts : undefined,
      departurePorts: filters.departurePorts.length > 0 ? filters.departurePorts : undefined,
      regionsOrDestinations: filters.regions.length > 0 ? filters.regions : undefined,
      cabinTypes: filters.cabinType === 'all' ? undefined : [filters.cabinType],
      minNights: parseOptionalFilterNumber(filters.minNights),
      maxNights: parseOptionalFilterNumber(filters.maxNights),
      offerLinked: filters.eligibility === 'offer' ? true : undefined,
      search: debouncedSearch || undefined,
      sailDateFrom: filters.dateFrom || toLocalCalendarDateOnly(new Date()) || undefined,
      sailDateTo: filters.dateTo || undefined,
      sortBy: filters.sortBy.startsWith('value') ? 'value' : filters.sortBy === 'nights-desc' ? 'nights' : 'sailDate',
      sortDirection: filters.sortBy.endsWith('desc') ? 'desc' : 'asc',
      limit: activeTab === 'foryou' ? 200 : 75,
    }).then((page) => {
      if (cancelled) return;
      setCatalogRows(page.rows);
      setCatalogTotal(page.total);
      nextCatalogCursorRef.current = page.nextCursor;
    }).catch((error) => {
      console.error('[Scheduling] Cruise inventory query failed without blocking navigation:', error);
      if (!cancelled) setCatalogError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, catalogRefreshVersion, debouncedSearch, filters.cabinType, filters.dateFrom, filters.dateTo, filters.departurePorts, filters.eligibility, filters.guestCounts, filters.maxNights, filters.minNights, filters.regions, filters.selectedShipClasses, filters.selectedShips, filters.sortBy, isInventoryReady, queryCruises, selectedProviders, totalCruises]);

  const loadMoreCatalogRows = useCallback(async () => {
    const cursor = nextCatalogCursorRef.current;
    if (!cursor || catalogLoadingMore || catalogLoading || activeTab === 'booked' || activeTab === 'foryou') return;
    setCatalogLoadingMore(true);
    setCatalogError(null);
    try {
      const page = await queryCruises({
        providers: selectedProviders,
        shipNames: filters.selectedShips.length > 0 ? filters.selectedShips : undefined,
        shipClasses: filters.selectedShipClasses.length > 0 ? filters.selectedShipClasses : undefined,
        guestCounts: filters.guestCounts.length > 0 ? filters.guestCounts : undefined,
        departurePorts: filters.departurePorts.length > 0 ? filters.departurePorts : undefined,
        regionsOrDestinations: filters.regions.length > 0 ? filters.regions : undefined,
        cabinTypes: filters.cabinType === 'all' ? undefined : [filters.cabinType],
        minNights: parseOptionalFilterNumber(filters.minNights),
        maxNights: parseOptionalFilterNumber(filters.maxNights),
        offerLinked: filters.eligibility === 'offer' ? true : undefined,
        search: debouncedSearch || undefined,
        sailDateFrom: filters.dateFrom || toLocalCalendarDateOnly(new Date()) || undefined,
        sailDateTo: filters.dateTo || undefined,
        sortBy: filters.sortBy.startsWith('value') ? 'value' : filters.sortBy === 'nights-desc' ? 'nights' : 'sailDate',
        sortDirection: filters.sortBy.endsWith('desc') ? 'desc' : 'asc',
        cursor,
        limit: 75,
      });
      setCatalogRows((current) => {
        const known = new Set(current.map(getCruiseInventoryOptionKey));
        return [...current, ...page.rows.filter((cruise) => !known.has(getCruiseInventoryOptionKey(cruise)))];
      });
      setCatalogTotal(page.total);
      nextCatalogCursorRef.current = page.nextCursor;
    } catch (error) {
      console.error('[Scheduling] Could not load the next cruise inventory page:', error);
      setCatalogError(error instanceof Error ? error.message : String(error));
    } finally {
      setCatalogLoadingMore(false);
    }
  }, [activeTab, catalogLoading, catalogLoadingMore, debouncedSearch, filters.cabinType, filters.dateFrom, filters.dateTo, filters.departurePorts, filters.eligibility, filters.guestCounts, filters.maxNights, filters.minNights, filters.regions, filters.selectedShipClasses, filters.selectedShips, filters.sortBy, queryCruises, selectedProviders]);

  const cruiseQueryRows = totalCruises > 0 ? catalogRows : deferredLegacyCruises;
  const allCruises = useMemo(() => {
    const finishFilterDiagnostic = beginPerformanceSpan('SchedulingScreen.intelligenceFilter', {
      cruisesLoadedIntoJS: cruiseQueryRows.length,
    });
    const result = filterRecordsByIntelligence(cruiseQueryRows, intelligenceFilterSnapshot, users);
    finishFilterDiagnostic({ resultRows: result.length });
    return result;
  }, [cruiseQueryRows, intelligenceFilterSnapshot, users]);

  const allOffers = useMemo(() => {
    return filterRecordsByIntelligence(deferredOffers, intelligenceFilterSnapshot, users);
  }, [deferredOffers, intelligenceFilterSnapshot, users]);

  const scopedLocalBookedCruises = useMemo(() => {
    return filterRecordsByIntelligence(deferredLocalBooked, intelligenceFilterSnapshot, users);
  }, [deferredLocalBooked, intelligenceFilterSnapshot, users]);

  const scopedStoredBookedCruises = useMemo(() => {
    return filterRecordsByIntelligence(deferredStoredBooked, intelligenceFilterSnapshot, users);
  }, [deferredStoredBooked, intelligenceFilterSnapshot, users]);

  const bookedIds = useMemo(() => {
    const localBooked = scopedLocalBookedCruises;
    const storeBooked = scopedStoredBookedCruises;
    return new Set([
      ...localBooked.map((b: BookedCruise) => b.id),
      ...storeBooked.map((b: BookedCruise) => b.id),
    ]);
  }, [scopedLocalBookedCruises, scopedStoredBookedCruises]);

  const bookedDates = useMemo(() => {
    const dates = new Set<string>();
    const allBooked = [...scopedLocalBookedCruises, ...scopedStoredBookedCruises];
    allBooked.forEach((cruise: BookedCruise) => {
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate);
      let currentDate = new Date(sailDate);
      while (currentDate <= returnDate) {
        const currentDateKey = toLocalCalendarDateOnly(currentDate);
        if (currentDateKey) dates.add(currentDateKey);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    return dates;
  }, [scopedLocalBookedCruises, scopedStoredBookedCruises]);

  const hasConflict = useCallback((cruise: Cruise): boolean => {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    let currentDate = new Date(sailDate);
    while (currentDate <= returnDate) {
      const currentDateKey = toLocalCalendarDateOnly(currentDate);
      if (currentDateKey && bookedDates.has(currentDateKey)) {
        return true;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return false;
  }, [bookedDates]);

  const availableShips = useMemo(() => {
    const ships = new Set<string>();
    const offers = allOffers;
    offers.forEach((offer: any) => {
      if (offer.shipName) {
        ships.add(offer.shipName);
      }
    });
    facets.shipNames.forEach((shipName) => ships.add(shipName));
    return Array.from(ships).sort();
  }, [allOffers, facets.shipNames]);

  const advancedFacets = useMemo(() => {
    const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      shipClasses: unique([...facets.shipClasses, ...catalogRows.map(getCruiseShipClass)]),
      guestCounts: Array.from(new Set([...facets.guestCounts, ...catalogRows.map(getCruiseGuestEligibility).filter((value): value is number => Boolean(value))])).sort((a, b) => a - b),
      departurePorts: unique([...facets.departurePorts, ...catalogRows.map((cruise) => compactText(cruise.departurePort))]),
      regions: unique([...facets.destinations, ...catalogRows.map((cruise) => compactText(cruise.destinationRegion) || compactText(cruise.destination))]),
    };
  }, [catalogRows, facets.departurePorts, facets.destinations, facets.guestCounts, facets.shipClasses]);

  const certificateCruiseKeys = useMemo(() => new Set(
    buildLocalCertificateSailingIndex(searchableCertificates)
      .map((match) => `${compactText(match.shipName).toLowerCase()}|${compactText(match.sailDate)}`)
      .filter((key) => key !== '|'),
  ), [searchableCertificates]);

  useEffect(() => {
    if (filters.eligibility !== 'certificate') return;
    void refreshCertificateDocuments();
  }, [filters.eligibility, refreshCertificateDocuments]);

  useEffect(() => {
    if (filters.eligibility !== 'certificate' || !nextCatalogCursorRef.current || catalogLoading || catalogLoadingMore) return;
    void loadMoreCatalogRows();
  }, [catalogLoading, catalogLoadingMore, catalogRows.length, filters.eligibility, loadMoreCatalogRows]);

  const activeFilterCount = useMemo(() => (
    filters.selectedShips.length + filters.selectedShipClasses.length + filters.guestCounts.length
    + filters.departurePorts.length + filters.regions.length
    + Number(filters.cabinType !== 'all') + Number(filters.noConflicts)
    + Number(Boolean(filters.dateFrom)) + Number(Boolean(filters.dateTo))
    + Number(Boolean(filters.minNights)) + Number(Boolean(filters.maxNights))
    + Number(filters.eligibility !== 'all') + Number(Boolean(filters.searchQuery.trim()))
  ), [filters]);

  const activeFilterLabels = useMemo(() => {
    const labels: Array<{ key: string; label: string }> = [];
    if (filters.searchQuery.trim()) labels.push({ key: 'search', label: `Search: ${filters.searchQuery.trim()}` });
    filters.selectedShips.forEach((value) => labels.push({ key: `ship:${value}`, label: `Ship: ${value}` }));
    filters.selectedShipClasses.forEach((value) => labels.push({ key: `class:${value}`, label: `Class: ${value}` }));
    if (filters.cabinType !== 'all') labels.push({ key: 'cabin', label: `Room: ${filters.cabinType}` });
    filters.guestCounts.forEach((value) => labels.push({ key: `guests:${value}`, label: `${value} guest${value === 1 ? '' : 's'}` }));
    filters.departurePorts.forEach((value) => labels.push({ key: `port:${value}`, label: `From: ${value}` }));
    filters.regions.forEach((value) => labels.push({ key: `region:${value}`, label: `Region: ${value}` }));
    if (filters.dateFrom) labels.push({ key: 'dateFrom', label: `After: ${filters.dateFrom}` });
    if (filters.dateTo) labels.push({ key: 'dateTo', label: `Before: ${filters.dateTo}` });
    if (filters.minNights) labels.push({ key: 'minNights', label: `${filters.minNights}+ nights` });
    if (filters.maxNights) labels.push({ key: 'maxNights', label: `Up to ${filters.maxNights} nights` });
    if (filters.eligibility === 'offer') labels.push({ key: 'eligibility', label: 'Offer attached' });
    if (filters.eligibility === 'certificate') labels.push({ key: 'eligibility', label: 'Downloaded certificate' });
    if (filters.noConflicts) labels.push({ key: 'conflicts', label: 'No booking conflicts' });
    return labels;
  }, [filters]);

  const removeActiveFilter = useCallback((key: string) => {
    setFilters((current) => {
      if (key === 'search') return { ...current, searchQuery: '' };
      if (key === 'cabin') return { ...current, cabinType: 'all' };
      if (key === 'dateFrom' || key === 'dateTo' || key === 'minNights' || key === 'maxNights') return { ...current, [key]: '' };
      if (key === 'eligibility') return { ...current, eligibility: 'all' };
      if (key === 'conflicts') return { ...current, noConflicts: false };
      const [kind, rawValue] = key.split(':');
      if (kind === 'ship') return { ...current, selectedShips: current.selectedShips.filter((value) => value !== rawValue) };
      if (kind === 'class') return { ...current, selectedShipClasses: current.selectedShipClasses.filter((value) => value !== rawValue) };
      if (kind === 'guests') return { ...current, guestCounts: current.guestCounts.filter((value) => value !== Number(rawValue)) };
      if (kind === 'port') return { ...current, departurePorts: current.departurePorts.filter((value) => value !== rawValue) };
      if (kind === 'region') return { ...current, regions: current.regions.filter((value) => value !== rawValue) };
      return current;
    });
    resetCatalogPosition();
  }, [resetCatalogPosition]);

  const materialOfferCandidateIndex = useMemo(() => {
    const byCruiseId = new Map<string, CasinoOffer[]>();
    const byOfferCode = new Map<string, CasinoOffer[]>();
    const append = (map: Map<string, CasinoOffer[]>, key: string | undefined, offer: CasinoOffer) => {
      const normalizedKey = String(key ?? '').trim().toLowerCase();
      if (!normalizedKey) return;
      const entries = map.get(normalizedKey) ?? [];
      entries.push(offer);
      map.set(normalizedKey, entries);
    };

    allOffers.forEach((offer) => {
      append(byCruiseId, offer.cruiseId, offer);
      offer.cruiseIds?.forEach((cruiseId) => append(byCruiseId, cruiseId, offer));
      append(byOfferCode, offer.offerCode, offer);
    });
    return { byCruiseId, byOfferCode };
  }, [allOffers]);

  const enrichedCruises = useMemo(() => {
    return allCruises.map(cruise => {
      if (cruise.offerName && cruise.offerCode) {
        return cruise;
      }
      
      const directCandidates = materialOfferCandidateIndex.byCruiseId.get(cruise.id.toLowerCase()) ?? [];
      const codeCandidates = materialOfferCandidateIndex.byOfferCode.get(String(cruise.offerCode ?? '').trim().toLowerCase()) ?? [];
      const candidateOffers = Array.from(new Set([...directCandidates, ...codeCandidates]));
      const matchingOffer = findSingleMaterialOffer(cruise, candidateOffers);
      
      if (matchingOffer) {
        return {
          ...cruise,
          offerName: matchingOffer.offerName || matchingOffer.title || cruise.offerName,
          offerCode: matchingOffer.offerCode || cruise.offerCode,
          freePlay: matchingOffer.freePlay || matchingOffer.freeplayAmount || cruise.freePlay,
          tradeInValue: matchingOffer.tradeInValue || cruise.tradeInValue,
          perks: matchingOffer.perks || cruise.perks,
        };
      }
      
      return cruise;
    });
  }, [allCruises, materialOfferCandidateIndex]);

  const bookedCruisesData = useMemo(() => {
    const localBooked = scopedLocalBookedCruises;
    const storeBooked = scopedStoredBookedCruises;
    if (localBooked.length > 0) return localBooked;
    return storeBooked;
  }, [scopedLocalBookedCruises, scopedStoredBookedCruises]);

  const b2bSets = useMemo((): BackToBackSet[] => {
    // Back-to-back discovery is one of the most expensive cruise calculations.
    // Run it only when that view is selected and keep the calculation pure;
    // setting state from a render-time memo caused repeated render loops.
    if (activeTab !== 'foryou') return [];

    const allBooked = [...scopedLocalBookedCruises, ...scopedStoredBookedCruises];
    const sets = findBackToBackSets(enrichedCruises, bookedDates, {
      maxGapDays: 2,
      requireDifferentOffers: true,
      excludeConflicts: false,
      minChainLength: 2,
      bookedCruises: allBooked,
      casinoOffers: allOffers,
    });
    if (__DEV__) {
      console.log('[Scheduling] Back-to-back sets calculated:', {
        cruises: enrichedCruises.length,
        booked: allBooked.length,
        sets: sets.length,
      });
    }
    return sets;
  }, [activeTab, allOffers, bookedDates, enrichedCruises, scopedLocalBookedCruises, scopedStoredBookedCruises]);

  const filteredCruises = useMemo(() => {
    const finishFilterDiagnostic = beginPerformanceSpan('SchedulingScreen.filterAndSort', {
      cruisesLoadedIntoJS: enrichedCruises.length,
      activeTab,
      sortBy: filters.sortBy,
    });
    let result = [...enrichedCruises];

    if (activeTab === 'available') {
      result = result.filter(c => 
        !isDateInPast(c.sailDate) && 
        !bookedIds.has(c.id) && 
        !hasConflict(c)
      );
    } else if (activeTab === 'all') {
      result = result.filter(c => !isDateInPast(c.sailDate));
    } else if (activeTab === 'foryou') {
      return [];
    } else if (activeTab === 'booked') {
      result = bookedCruisesData.filter(c => isActiveBookedCruise(c)) as Cruise[];
    }

    result = result.filter((cruise) => matchesCruiseDiscoveryFilters({
      shipName: compactText(cruise.shipName),
      shipClass: getCruiseShipClass(cruise),
      cabinType: compactText(cruise.cabinType),
      guestCount: getCruiseGuestEligibility(cruise) ?? null,
      departurePort: compactText(cruise.departurePort),
      regionOrDestination: compactText(cruise.destinationRegion) || compactText(cruise.destination),
      sailDate: compactText(cruise.sailDate),
      nights: Number(cruise.nights) || 0,
      hasOffer: Boolean(cruise.offerCode || cruise.offerName || cruise.offerInstanceId),
      hasCertificate: certificateCruiseKeys.has(`${compactText(cruise.shipName).toLowerCase()}|${compactText(cruise.sailDate)}`),
    }, filters));

    if (filters.noConflicts && activeTab === 'all') {
      result = result.filter(c => !hasConflict(c));
    }

    if (filters.searchQuery.trim()) {
      result = result.filter((cruise) => matchesCruiseDiscoverySearch({
        shipName: cruise.shipName,
        shipClass: getCruiseShipClass(cruise),
        itineraryName: cruise.itineraryName,
        destination: cruise.destination,
        destinationRegion: cruise.destinationRegion,
        departurePort: cruise.departurePort,
        ports: cruise.ports,
        offerCode: cruise.offerCode,
        offerName: cruise.offerName,
        guestsInfo: cruise.guestsInfo,
      }, filters.searchQuery));
    }

    const valueByOption = filters.sortBy.startsWith('value')
      ? new Map(result.map((cruise) => [getCruiseInventoryOptionKey(cruise), calculateCruiseValue(cruise).totalRetailValue || null]))
      : null;
    result = sortCruiseDiscoveryRows(result, filters.sortBy, {
      getDate: (cruise) => cruise.sailDate,
      getValue: (cruise) => valueByOption?.get(getCruiseInventoryOptionKey(cruise)) ?? null,
      getNights: (cruise) => cruise.nights,
      getIdentity: getCruiseInventoryOptionKey,
    });
    finishFilterDiagnostic({ cruisesRendered: result.length });
    recordPerformanceCount('SchedulingScreen.cruisesRendered', result.length, { activeTab });
    return result;
  }, [enrichedCruises, activeTab, filters, bookedIds, certificateCruiseKeys, hasConflict, bookedCruisesData]);

  const stats = useMemo(() => ({
    loaded: filteredCruises.length,
    indexedMatches: activeTab === 'booked'
      ? bookedCruisesData.filter(c => isActiveBookedCruise(c)).length
      : (catalogTotal || totalCruises || enrichedCruises.length),
    catalogCruises: totalCruises || catalogTotal || enrichedCruises.length,
    booked: bookedCruisesData.filter(c => isActiveBookedCruise(c)).length,
  }), [activeTab, bookedCruisesData, catalogTotal, enrichedCruises.length, filteredCruises.length, totalCruises]);

  const offerOptionCountsByPhysicalVoyage = useMemo(() => {
    const counts = new Map<string, number>();
    filteredCruises.forEach((cruise) => {
      if (!cruise.offerCode && !cruise.offerName && !cruise.offerInstanceId) return;
      const key = getCanonicalCruiseInventoryKey(cruise);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [filteredCruises]);

  const alertCount = useMemo(() => {
    return allOffers.filter((o: CasinoOffer) => {
      if (o.expiryDate) {
        const days = getDaysUntil(o.expiryDate);
        return days > 0 && days <= 7;
      }
      return false;
    }).length;
  }, [allOffers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Scheduling] Refreshing cruises...');
    await refreshCounts().catch(console.error);
    setCatalogRefreshVersion((version) => version + 1);
    setRefreshing(false);
  }, [refreshCounts]);

  const _handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(createDefaultFilters());
    resetCatalogPosition();
  }, [resetCatalogPosition]);

  const toggleShipFilter = useCallback((shipName: string) => {
    setFilters(prev => {
      const isSelected = prev.selectedShips.includes(shipName);
      if (isSelected) {
        return { ...prev, selectedShips: prev.selectedShips.filter(s => s !== shipName) };
      } else {
        return { ...prev, selectedShips: [...prev.selectedShips, shipName] };
      }
    });
  }, []);

  const handleSortChange = useCallback((sortOption: SortOption) => {
    setFilters(prev => ({ ...prev, sortBy: sortOption }));
    resetCatalogPosition();
  }, [resetCatalogPosition]);

  const applyCruiseFilters = useCallback(() => {
    setShowFilterSheet(false);
    resetCatalogPosition();
  }, [resetCatalogPosition]);

  const catalogPresentationKey = useMemo(() => JSON.stringify({
    activeTab,
    selectedBrand,
    filters,
  }), [activeTab, filters, selectedBrand]);

  const handleCruisePress = useCallback((cruise: Cruise) => {
    console.log('[Scheduling] Cruise pressed:', cruise.id);
    router.push({
      pathname: '/cruise-details' as any,
      params: buildCruiseDetailsParams(cruise, { source: 'cruises' }),
    });
  }, [router]);

  const handleAlertsPress = useCallback(() => {
    console.log('[Scheduling] Alerts pressed');
    setShowAlertsModal(true);
  }, []);

  const renderCruiseCard = useCallback(({ item, index: _index }: { item: Cruise; index: number }) => {
    const isBooked = bookedIds.has(item.id) || activeTab === 'booked';
    
    return (
      <ResponsiveContainer>
        <CruiseCard
          cruise={item}
          onPress={() => handleCruisePress(item)}
          variant={isBooked ? 'booked' : 'available'}
          mini={true}
          relatedOfferOptionCount={offerOptionCountsByPhysicalVoyage.get(getCanonicalCruiseInventoryKey(item)) ?? 1}
        />
      </ResponsiveContainer>
    );
  }, [bookedIds, handleCruisePress, activeTab, offerOptionCountsByPhysicalVoyage]);

  const renderSlotOffers = useCallback((offers: CruiseOffer[]) => {
    const groupedByCode = offers.reduce((acc, offer) => {
      const code = offer.offerCode || 'NO_CODE';
      if (!acc[code]) acc[code] = [];
      acc[code].push(offer);
      return acc;
    }, {} as Record<string, CruiseOffer[]>);

    return (
      <View style={styles.slotOffersContainer}>
        <Text style={styles.slotOffersTitle}>Available Offers ({offers.length} options):</Text>
        {Object.entries(groupedByCode).map(([code, codeOffers]) => (
          <View key={code} style={styles.offerGroup}>
            <View style={styles.offerCodeHeader}>
              <Tag size={10} color={COLORS.goldDark} />
              <Text style={styles.offerCodeText}>{code === 'NO_CODE' ? 'Standard' : code}</Text>
            </View>
            {codeOffers.map((offer, i) => (
              <TouchableOpacity
                key={`${offer.cruiseId}_${i}`}
                style={styles.offerOption}
                onPress={() => handleCruisePress(offer.cruise)}
                activeOpacity={0.7}
              >
                <View style={styles.offerOptionLeft}>
                  <Text style={styles.offerCabinType}>{offer.cabinType || 'Any Room'}</Text>
                  <Text style={styles.offerGuests}>{formatGuestEligibility(offer.cruise)}</Text>
                </View>
                {offer.offerName ? (
                  <Text style={styles.offerNameSmall} numberOfLines={2}>{offer.offerName}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  }, [handleCruisePress]);

  const getB2BSetValue = useCallback((set: BackToBackSet): number => {
    return set.cruises.reduce((sum, c) => sum + calculateCruiseValue(c).totalRetailValue, 0);
  }, []);

  const sortedB2bSets = useMemo(() => {
    if (b2bSets.length === 0) return b2bSets;
    const sorted = [...b2bSets];
    switch (filters.sortBy) {
      case 'date-asc':
        sorted.sort((a, b) => createDateFromString(a.startDate).getTime() - createDateFromString(b.startDate).getTime());
        break;
      case 'date-desc':
        sorted.sort((a, b) => createDateFromString(b.startDate).getTime() - createDateFromString(a.startDate).getTime());
        break;
      case 'nights-desc':
        sorted.sort((a, b) => b.totalNights - a.totalNights);
        break;
      case 'value-desc':
        sorted.sort((a, b) => getB2BSetValue(b) - getB2BSetValue(a));
        break;
      case 'value-asc':
        sorted.sort((a, b) => getB2BSetValue(a) - getB2BSetValue(b));
        break;
      default:
        sorted.sort((a, b) => createDateFromString(a.startDate).getTime() - createDateFromString(b.startDate).getTime());
    }
    return sorted;
  }, [b2bSets, filters.sortBy, getB2BSetValue]);

  const renderB2BSetCard = useCallback((set: BackToBackSet, index: number) => {
    const slots = set.slots || [];
    const setValue = set.cruises.reduce((sum, c) => sum + calculateCruiseValue(c).totalRetailValue, 0);
    
    return (
      <ResponsiveContainer>
        <View key={set.id} style={styles.b2bSetCard}>
        <LinearGradient
          colors={['#E0F7FA', '#DBEAFE', '#E0F2FE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.b2bSetHeader}
        >
          <View style={styles.b2bSetBadge}>
            <Link2 size={14} color={COLORS.navyDeep} />
            <Text style={styles.b2bSetBadgeText}>Back-to-back option {index + 1}</Text>
          </View>
          <View style={styles.b2bSetSummary}>
            <View style={styles.b2bSummaryItem}>
              <Ship size={12} color={COLORS.navyDeep} />
              <Text style={styles.b2bSummaryText}>{slots[0]?.shipName || 'Unknown Ship'}</Text>
            </View>
            <View style={styles.b2bSummaryItem}>
              <Calendar size={12} color={COLORS.navyDeep} />
              <Text style={styles.b2bSummaryText}>{set.totalNights} nights total</Text>
            </View>
            <View style={styles.b2bSummaryItem}>
              <Anchor size={12} color={COLORS.navyDeep} />
              <Text style={styles.b2bSummaryText}>{set.departurePort}</Text>
            </View>
          </View>
          <View style={styles.b2bValueRow}>
            <Text style={styles.b2bDateRange}>{set.startDate} → {set.endDate}</Text>
            {setValue > 0 && (
              <View style={styles.b2bValueBadge}>
                <Text style={styles.b2bValueText}>${setValue.toLocaleString()}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        
        {slots.map((slot, slotIndex) => {
          const physicalCruise = slot.offers[0]?.cruise ?? set.cruises.find((cruise) => cruise.shipName === slot.shipName && cruise.sailDate === slot.sailDate);
          const gapFromPrevious = slotIndex > 0 ? set.gapDays?.[slotIndex - 1] : null;
          return (
          <View
            key={slot.key}
            style={[
              styles.b2bCruiseItem,
              slotIndex === slots.length - 1 && styles.b2bCruiseItemLast
            ]}
          >
            <View style={styles.b2bCruisePosition}>
              <Text style={styles.b2bPositionNumber}>{slotIndex + 1}</Text>
              {slotIndex < slots.length - 1 && (
                <View style={styles.b2bConnectorContainer}>
                  <View style={styles.b2bConnector} />
                  {set.gapDays && set.gapDays[slotIndex] !== undefined && (
                    <View style={styles.b2bGapBadge}>
                      <Text style={styles.b2bGapText}>
                        {set.gapDays[slotIndex] === 0 ? 'Same day' : `${set.gapDays[slotIndex]}d gap`}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            
            <View style={styles.b2bCruiseContent}>
              <View style={styles.b2bCruiseHeader}>
                <Anchor size={14} color={COLORS.navyDeep} />
                <Text style={styles.b2bShipName}>
                  {slot.departurePort || 'Handoff port not stated'}{gapFromPrevious !== null ? ` · ${gapFromPrevious === 0 ? 'same-day handoff' : `${gapFromPrevious}-day gap`}` : ' · first voyage'}
                </Text>
              </View>
              {physicalCruise ? (
                <CruiseCard
                  cruise={physicalCruise}
                  onPress={() => handleCruisePress(physicalCruise)}
                  variant={bookedIds.has(physicalCruise.id) ? 'booked' : 'available'}
                  mini
                  relatedOfferOptionCount={slot.offers.length}
                  conflictWarning={hasConflict(physicalCruise) ? 'This sailing overlaps a booked cruise.' : undefined}
                />
              ) : null}
              {renderSlotOffers(slot.offers)}
            </View>
          </View>
        ); })}
        
        <View style={styles.b2bSetFooter}>
          <Text style={styles.b2bFooterHint}>
            Offer options stay attached to each sailing. Pick one offer per voyage when you plan the chain.
          </Text>
          <TouchableOpacity
            style={styles.b2bOperationalButton}
            onPress={() => router.push({ pathname: '/back-to-back-trip-builder', params: { id: set.id, plan: JSON.stringify(slots.map(slot => ({ shipName: slot.shipName, sailDate: slot.sailDate, returnDate: slot.returnDate, departurePort: slot.departurePort, nights: slot.nights }))) } })}
            testID="b2b-open-operational-builder"
          >
            <Text style={styles.b2bOperationalButtonText}>Plan this back-to-back trip</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ResponsiveContainer>
    );
  }, [bookedIds, handleCruisePress, hasConflict, renderSlotOffers, router]);

  const renderHeader = () => (
    <ResponsiveContainer>
      <View style={styles.headerContent}>
      <TabIdentityBand tab="cruises" dense />
      <View style={styles.discoverySection}>
      <ThemedSectionHeader
        tab="cruises"
        emoji="🔎"
        title="Search and filters"
        subtitle="Find sailings by brand, date, value, ship, class, itinerary, or port."
        compact
        testID="cruises-discovery-controls-section"
      />
      <View style={styles.sectionBody}>

      <IntelligenceFilterStrip contextLabel="Cruises" variant="bookedCruises" compact showTitle={false} showProfile={false} showProgram={false} />

      <MinimalistFilterBar
        tabs={TABS.map(tab => ({ key: tab.key, label: tab.label }))}
        activeTab={activeTab}
        onTabPress={(key) => setActiveTab(key as ViewTab)}
        searchPlaceholder="Search ship, class, itinerary, port, or offer…"
        searchValue={filters.searchQuery}
        onSearchChange={_handleSearch}
        onSearch={_handleSearch}
        actions={[
          { key: 'clear', label: 'Clear', icon: X, onPress: clearFilters },
          { key: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount, onPress: handleAlertsPress },
        ]}
        ships={availableShips}
        selectedShips={filters.selectedShips}
        onShipToggle={toggleShipFilter}
        onClearShips={() => setFilters(prev => ({ ...prev, selectedShips: [] }))}
        showingCount={stats.loaded}
        totalCount={stats.indexedMatches}
        countLabel="loaded / indexed matches"
        bookedCount={stats.booked}
        showShipFilterControl={false}
      />

      {/* Compact sort and filter row */}
      <View style={styles.sortFilterRow}>
        <View style={styles.sortChips}>
          <TouchableOpacity
            style={[styles.sortChip, filters.sortBy === 'date-asc' && styles.sortChipActive]}
            onPress={() => handleSortChange('date-asc')}
            activeOpacity={0.7}
            testID="cruises-sort-soonest"
          >
            <Text style={styles.sortChipEmoji}>🕘</Text>
            <Text style={[styles.sortChipText, filters.sortBy === 'date-asc' && styles.sortChipTextActive]}>Soonest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, filters.sortBy === 'date-desc' && styles.sortChipActive]}
            onPress={() => handleSortChange('date-desc')}
            activeOpacity={0.7}
            testID="cruises-sort-latest"
          >
            <Text style={styles.sortChipEmoji}>📅</Text>
            <Text style={[styles.sortChipText, filters.sortBy === 'date-desc' && styles.sortChipTextActive]}>Latest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, filters.sortBy === 'value-desc' && styles.sortChipActive]}
            onPress={() => handleSortChange('value-desc')}
            activeOpacity={0.7}
            testID="cruises-sort-value"
          >
            <Text style={styles.sortChipEmoji}>💎</Text>
            <Text style={[styles.sortChipText, filters.sortBy === 'value-desc' && styles.sortChipTextActive]}>Value</Text>
          </TouchableOpacity>
        </View>
        <FilterButton
          activeCount={activeFilterCount}
          label="Filters"
          onPress={() => setShowFilterSheet(true)}
          testID="cruises-open-filter-screen"
        />
      </View>
      <TouchableOpacity
        style={styles.agentInlineButton}
        onPress={handleAskAllOffersOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Ask Agent SEA about cruise discovery"
        testID="scheduling-open-ask-all-offers"
      >
        <View style={styles.agentInlineIcon}>
          <Bot size={16} color="#167C80" />
        </View>
        <View style={styles.agentInlineCopy}>
          <Text style={styles.agentInlineTitle}>Ask Agent SEA</Text>
          <Text style={styles.agentInlineSubtitle} numberOfLines={1}>Compare results with your offers, certificates, and bookings.</Text>
        </View>
        <ChevronRight size={18} color="#167C80" />
      </TouchableOpacity>
      {activeFilterLabels.length > 0 ? (
        <View style={styles.activeFilterSummary} testID="cruises-active-filter-summary">
          <View style={styles.activeFilterHeadingRow}>
            <Text style={styles.activeFilterHeading}>Active filters</Text>
            <TouchableOpacity onPress={clearFilters} accessibilityRole="button" accessibilityLabel="Clear all cruise filters" testID="cruises-active-filters-clear">
              <Text style={styles.activeFilterClear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterChipRow}>
            {activeFilterLabels.map((filter) => <TouchableOpacity key={filter.key} style={styles.activeFilterChip} onPress={() => removeActiveFilter(filter.key)} accessibilityRole="button" accessibilityLabel={`Remove ${filter.label} filter`}>
              <Text style={styles.activeFilterChipText}>{filter.label}</Text><X size={12} color="#123D73" />
            </TouchableOpacity>)}
          </ScrollView>
        </View>
      ) : null}
      </View>
      </View>

      <ThemedSectionHeader
        tab="cruises"
        emoji={activeTab === 'foryou' ? '🔗' : activeTab === 'booked' ? '🧳' : '🗺️'}
        title={activeTab === 'booked' ? 'Booked cruises' : activeTab === 'foryou' ? 'Back-to-back sets' : 'All cruises'}
        subtitle={activeTab === 'foryou'
          ? `${b2bSets.length} ${b2bSets.length === 1 ? 'set' : 'sets'} found • Different offers on each cruise`
          : `${filteredCruises.length.toLocaleString()} loaded · ${stats.indexedMatches.toLocaleString()} indexed matches • Tap to view details`}
        tone={activeTab === 'foryou' ? 'info' : 'default'}
        compact
        testID="cruises-catalog-section"
      />
      
      {activeTab === 'foryou' && b2bSets.length > 0 && (
        <View style={styles.b2bExplanation}>
          <Link2 size={14} color={COLORS.navyDeep} />
          <Text style={styles.b2bExplanationText}>
            Each set shows consecutive cruises with different offer codes that you can book back-to-back.
          </Text>
        </View>
      )}
      </View>
    </ResponsiveContainer>
  );

  const renderListFooter = useCallback(() => {
    const hasMoreRows = Boolean(nextCatalogCursorRef.current);
    const remainingRows = Math.max(0, catalogTotal - catalogRows.length);
    return (
      <View style={styles.catalogFooter}>
        {catalogLoadingMore ? <InlineLoading label="Loading more sailings…" /> : null}
        {!catalogLoadingMore && hasMoreRows ? (
          <TouchableOpacity
            style={styles.catalogLoadMoreButton}
            onPress={() => { void loadMoreCatalogRows(); }}
            accessibilityRole="button"
            accessibilityLabel={`Show ${Math.min(75, remainingRows || 75)} more sailings`}
            testID="cruises-catalog-load-more"
          >
            <Text style={styles.catalogLoadMoreText}>Show {Math.min(75, remainingRows || 75)} more sailings</Text>
            <Text style={styles.catalogLoadMoreMeta}>{catalogRows.length.toLocaleString()} of {catalogTotal.toLocaleString()} shown</Text>
          </TouchableOpacity>
        ) : null}
        {!catalogLoadingMore && !hasMoreRows && catalogRows.length > 0 ? (
          <View style={styles.catalogEndCard} testID="cruises-catalog-end">
            <Anchor size={18} color="#0E7FA7" />
            <Text style={styles.catalogEndTitle}>All matching sailings shown</Text>
            <Text style={styles.catalogEndMeta}>{filteredCruises.length.toLocaleString()} sailings match your current search and filters.</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.catalogReturnButton}
          onPress={() => cruiseListRef.current?.scrollToOffset({ offset: 0, animated: !preferences.reducedMotion })}
          accessibilityRole="button"
          accessibilityLabel="Return to cruise discovery"
          testID="cruises-return-to-discovery"
        >
          <Text style={styles.catalogReturnText}>Back to cruise discovery</Text>
        </TouchableOpacity>
      </View>
    );
  }, [catalogLoadingMore, catalogRows.length, catalogTotal, filteredCruises.length, loadMoreCatalogRows, preferences.reducedMotion]);

  const renderEmpty = () => {
    const currentError = catalogError || inventoryError;
    if (currentError) {
      return (
        <ResponsiveContainer>
          <DataStateCard
            kind="error"
            title="Cruise catalog needs another read"
            reason={currentError}
            sourceLabel="Local cruise repository"
            actionLabel="Retry"
            onAction={() => setCatalogRefreshVersion((version) => version + 1)}
            testID="cruises-catalog-error"
          />
        </ResponsiveContainer>
      );
    }
    if (activeTab === 'foryou') {
      return (
        <ResponsiveContainer>
          <DataStateCard
            kind="empty"
            title="No back-to-back sets match"
            reason="No consecutive cruise pairs with different offer codes are available without conflicting with your booked cruises."
            sourceLabel="Committed cruise catalog"
          />
        </ResponsiveContainer>
      );
    }
    
    return (
      <ResponsiveContainer>
        <DataStateCard
          kind="empty"
          title="No cruises match"
          reason={filters.searchQuery || filters.cabinType !== 'all' || filters.noConflicts
            ? 'The committed cruise catalog has no rows matching the current filters. Clear filters to restore the full catalog.'
            : 'No cruise rows are stored yet. Import or sync cruise data to populate the catalog.'}
          sourceLabel="Committed cruise catalog"
          actionLabel={filters.searchQuery || filters.cabinType !== 'all' || filters.noConflicts ? 'Clear Filters' : undefined}
          onAction={filters.searchQuery || filters.cabinType !== 'all' || filters.noConflicts ? clearFilters : undefined}
        />
      </ResponsiveContainer>
    );
  };

  const handleAskAllOffersOpen = useCallback(() => {
    router.push('/ask-my-data' as any);
  }, [router]);

  if (appLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: experienceColors.background }]}> 
        <DataStateCard
          kind="loading"
          title="Loading the cruise catalog"
          reason="Easy Seas is reading indexed cruise rows. Counts and filters remain unavailable until repository readback finishes."
          committed={false}
          sourceLabel="Local cruise repository"
          testID="cruises-catalog-loading"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: experienceColors.background }]}> 
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {activeTab === 'foryou' ? (
          <FlatList
            data={sortedB2bSets}
            renderItem={({ item, index }) => renderB2BSetCard(item, index)}
            keyExtractor={(item, index) => item.id?.trim() || `b2b-set-${item.startDate || 'start'}-${item.departurePort || 'port'}-${index}`}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.navyDeep}
                colors={[COLORS.navyDeep]}
              />
            }
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          />
        ) : (
          <FlatList
            ref={cruiseListRef}
            testID="cruises-catalog-list"
            data={filteredCruises}
            extraData={catalogPresentationKey}
            renderItem={renderCruiseCard}
            keyExtractor={(item, index) => getCruiseInventoryOptionKey(item) || `scheduled-cruise-${item.shipName || 'ship'}-${item.sailDate || 'date'}-${item.offerCode || 'offer'}-${index}`}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderListFooter}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.navyDeep}
                colors={[COLORS.navyDeep]}
              />
            }
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={9}
            updateCellsBatchingPeriod={50}
            onScroll={(event) => handleCatalogScroll(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={200}
          />
        )}
      </SafeAreaView>

      <Modal visible={showFilterSheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilterSheet(false)}>
        <SafeAreaView style={styles.filterSheetSafe} edges={['top', 'bottom']}>
          <View style={styles.filterSheetHeader}>
            <View style={styles.filterSheetHeading}>
              <Text style={styles.filterSheetEyebrow}>Cruise discovery</Text>
              <Text style={styles.filterSheetTitle}>Filter cruises</Text>
              <Text style={styles.filterSheetSubtitle}>{activeFilterCount} active · {filteredCruises.length.toLocaleString()} loaded · {stats.indexedMatches.toLocaleString()} indexed matches</Text>
            </View>
            <TouchableOpacity style={styles.filterSheetClose} onPress={() => setShowFilterSheet(false)} accessibilityLabel="Close cruise filters" testID="cruises-close-filter-screen"><X size={21} color="#17324D" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.filterSheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Ship</Text>
              <View style={styles.sheetChipWrap}>{availableShips.map((value) => <CruiseFilterChip key={value} label={value} selected={filters.selectedShips.includes(value)} onPress={() => toggleShipFilter(value)} />)}</View>
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Ship class</Text>
              {advancedFacets.shipClasses.length ? <View style={styles.sheetChipWrap}>{advancedFacets.shipClasses.map((value) => <CruiseFilterChip key={value} label={value} selected={filters.selectedShipClasses.includes(value)} onPress={() => setFilters((current) => ({ ...current, selectedShipClasses: toggleFilterValue(current.selectedShipClasses, value) }))} />)}</View> : <Text style={styles.sheetMissing}>No ship-class values are loaded in the current provider data.</Text>}
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Stateroom entitlement</Text>
              <View style={styles.sheetChipWrap}>{CABIN_FILTERS.map((value) => <CruiseFilterChip key={value.key} label={value.label} selected={filters.cabinType === value.key} onPress={() => setFilters((current) => ({ ...current, cabinType: value.key }))} testID={`cruises-filter-cabin-${value.key}`} />)}</View>
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Guests</Text>
              <View style={styles.sheetChipWrap}>{Array.from(new Set([1, 2, ...advancedFacets.guestCounts])).sort((a, b) => a - b).map((value) => <CruiseFilterChip key={value} label={`${value} guest${value === 1 ? '' : 's'}`} selected={filters.guestCounts.includes(value)} onPress={() => setFilters((current) => ({ ...current, guestCounts: toggleFilterValue(current.guestCounts, value) }))} testID={`cruises-filter-guests-${value}`} />)}</View>
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Departure port</Text>
              <View style={styles.sheetChipWrap}>{advancedFacets.departurePorts.map((value) => <CruiseFilterChip key={value} label={value} selected={filters.departurePorts.includes(value)} onPress={() => setFilters((current) => ({ ...current, departurePorts: toggleFilterValue(current.departurePorts, value) }))} />)}</View>
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Region or destination</Text>
              <View style={styles.sheetChipWrap}>{advancedFacets.regions.map((value) => <CruiseFilterChip key={value} label={value} selected={filters.regions.includes(value)} onPress={() => setFilters((current) => ({ ...current, regions: toggleFilterValue(current.regions, value) }))} />)}</View>
            </View>
            <View style={styles.sheetSection}>
              <View style={styles.sheetSectionHeadingRow}><CalendarDays size={16} color="#167C80" /><Text style={styles.sheetSectionTitleInline}>Sailing dates</Text></View>
              <View style={styles.sheetInputRow}>
                <View style={styles.sheetInputGroup}><Text style={styles.sheetInputLabel}>From</Text><TextInput style={styles.sheetInput} value={filters.dateFrom} onChangeText={(dateFrom) => setFilters((current) => ({ ...current, dateFrom }))} placeholder="YYYY-MM-DD" autoCapitalize="none" testID="cruises-filter-date-from" /></View>
                <View style={styles.sheetInputGroup}><Text style={styles.sheetInputLabel}>To</Text><TextInput style={styles.sheetInput} value={filters.dateTo} onChangeText={(dateTo) => setFilters((current) => ({ ...current, dateTo }))} placeholder="YYYY-MM-DD" autoCapitalize="none" testID="cruises-filter-date-to" /></View>
              </View>
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Cruise length</Text>
              <View style={styles.sheetInputRow}>
                <View style={styles.sheetInputGroup}><Text style={styles.sheetInputLabel}>Minimum nights</Text><TextInput style={styles.sheetInput} value={filters.minNights} onChangeText={(minNights) => setFilters((current) => ({ ...current, minNights }))} placeholder="Any" keyboardType="number-pad" testID="cruises-filter-min-nights" /></View>
                <View style={styles.sheetInputGroup}><Text style={styles.sheetInputLabel}>Maximum nights</Text><TextInput style={styles.sheetInput} value={filters.maxNights} onChangeText={(maxNights) => setFilters((current) => ({ ...current, maxNights }))} placeholder="Any" keyboardType="number-pad" testID="cruises-filter-max-nights" /></View>
              </View>
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Eligibility source</Text>
              <View style={styles.sheetChipWrap}>{(['all', 'offer', 'certificate'] as EligibilityFilter[]).map((value) => <CruiseFilterChip key={value} label={value === 'all' ? 'All cruises' : value === 'offer' ? 'Casino offer attached' : `Downloaded certificate (${certificateCruiseKeys.size})`} selected={filters.eligibility === value} onPress={() => setFilters((current) => ({ ...current, eligibility: value }))} testID={`cruises-filter-eligibility-${value}`} />)}</View>
              {filters.eligibility === 'certificate' && (catalogLoading || catalogLoadingMore || nextCatalogCursorRef.current) ? <Text style={styles.sheetProgress}>Scanning the indexed cruise catalog against locally saved certificate ship/date rows…</Text> : null}
            </View>
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Schedule</Text>
              <CruiseFilterChip label="Hide cruises that overlap my bookings" selected={filters.noConflicts} onPress={() => setFilters((current) => ({ ...current, noConflicts: !current.noConflicts }))} testID="cruises-filter-no-conflicts" />
            </View>
            <TouchableOpacity
              style={styles.filterHelpDisclosure}
              onPress={() => setShowFilterHelp((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showFilterHelp }}
              accessibilityLabel="Show cruise filter data truth rules"
              testID="cruises-filter-help-disclosure"
            >
              <View style={styles.filterHelpIcon}><Text style={styles.filterHelpIconText}>i</Text></View>
              <View style={styles.filterHelpCopy}>
                <Text style={styles.filterHelpTitle}>Data truth rules</Text>
                <Text style={styles.filterHelpSummary} numberOfLines={showFilterHelp ? undefined : 1}>Search includes ship, class, itinerary, destination, port, offer code, offer name, and guest text.</Text>
              </View>
              <Text style={styles.filterHelpChevron}>{showFilterHelp ? '−' : '+'}</Text>
            </TouchableOpacity>
            {showFilterHelp ? (
              <Text style={styles.filterSheetHelp}>Missing provider values remain unstated; Easy Seas does not fabricate cabin, guest, price, or casino data.</Text>
            ) : null}
          </ScrollView>
          <View style={styles.filterSheetActions}>
            <TouchableOpacity style={styles.filterResetButton} onPress={clearFilters} testID="cruises-filter-clear-all"><RotateCcw size={16} color="#17324D" /><Text style={styles.filterResetText}>Clear all</Text></TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={applyCruiseFilters} testID="cruises-filter-apply"><Text style={styles.filterApplyText}>Apply filters</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Alerts Manager Modal */}
      <AlertsManagerModal
        visible={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
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
    paddingBottom: 28,
  },
  headerContent: {
    marginBottom: SPACING.md,
    backgroundColor: 'transparent',
  },
  discoverySection: {
    marginTop: -34,
    marginHorizontal: 10,
    zIndex: 2,
    padding: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    backgroundColor: '#FFFFFF',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  favoritesSection: {
    marginTop: 16,
    padding: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sectionBody: {
    padding: 10,
    paddingTop: 8,
  },
  catalogFooter: {
    gap: 6,
    paddingTop: 10,
    paddingBottom: 8,
  },
  catalogLoadMoreButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0E7FA7',
    backgroundColor: '#FFFFFF',
  },
  catalogLoadMoreText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#123D73',
  },
  catalogLoadMoreMeta: {
    marginTop: 1,
    fontSize: 10,
    color: '#5F6F7E',
  },
  catalogEndCard: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: '#FFFFFF',
  },
  catalogEndTitle: {
    marginTop: 3,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 15,
    color: '#123D73',
  },
  catalogEndMeta: {
    marginTop: 2,
    fontSize: 10,
    textAlign: 'center',
    color: '#5F6F7E',
  },
  catalogReturnButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  catalogReturnText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#0E7FA7',
  },
  activeFilterSummary: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
  },
  activeFilterHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  activeFilterHeading: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#123D73',
  },
  activeFilterClear: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#0E7FA7',
  },
  activeFilterChipRow: {
    gap: 7,
    paddingRight: SPACING.md,
  },
  activeFilterChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A8D8DE',
    backgroundColor: '#ECF8F8',
  },
  activeFilterChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#123D73',
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
    borderColor: COLORS.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  filterSectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.sm,
  },
  cabinFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  cabinChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  cabinChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  cabinChipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  cabinChipTextActive: {
    color: COLORS.white,
  },
  conflictToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  toggleCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: CLEAN_THEME.border.medium,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleCheckboxActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  conflictToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
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
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.beigeWarm,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    marginTop: 2,
  },
  cruiseCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOW.md,
  },
  conflictCard: {
    borderColor: 'rgba(244, 67, 54, 0.4)',
  },
  recommendedCard: {
    borderColor: COLORS.beigeWarm,
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.beigeWarm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderBottomRightRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
    color: COLORS.white,
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
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bookedBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  bookedBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  conflictBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  conflictBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  destination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flex: 1,
  },
  expiringSoonBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.4)',
  },
  expiringSoonText: {
    fontSize: 10,
    color: COLORS.warning,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  cruiseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.15)',
  },
  detailItem: {
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
  },
  cabinTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cabinTypeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  daysUntilText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    flex: 1,
  },
  priceText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
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
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sortPillsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flex: 1,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  sortPillActive: {
    backgroundColor: CLEAN_THEME.filter.activeBg,
    borderColor: COLORS.navyDeep,
  },
  sortPillText: {
    fontSize: 11,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  sortPillTextActive: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  advancedFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    marginLeft: SPACING.sm,
  },
  advancedFilterToggleActive: {
    backgroundColor: CLEAN_THEME.filter.activeBg,
    borderColor: COLORS.navyDeep,
  },
  advancedFilterText: {
    fontSize: 11,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  advancedFilterTextActive: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  filterBadge: {
    backgroundColor: COLORS.goldAccent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  advancedFiltersPanel: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  filterSection: {
    marginBottom: SPACING.sm,
  },
  sortFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 5,
    marginHorizontal: 0,
    marginBottom: SPACING.xs,
  },
  sortChips: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  sortChipActive: {
    backgroundColor: '#167C80',
    borderColor: '#167C80',
  },
  sortChipText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#17324D',
    fontWeight: '800' as const,
  },
  sortChipEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  sortChipTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  filterSheetSafe: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D9E1E6',
  },
  filterSheetHeading: { flex: 1, paddingRight: 16 },
  filterSheetEyebrow: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800', color: '#167C80' },
  filterSheetTitle: { marginTop: 3, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 28, lineHeight: 33, fontWeight: '600', color: '#17324D' },
  filterSheetSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, color: '#536575' },
  filterSheetClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  filterSheetContent: { padding: 16, paddingBottom: 28 },
  sheetSection: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  sheetSectionTitle: { marginBottom: 10, fontSize: 15, lineHeight: 20, fontWeight: '800', color: '#17324D' },
  sheetSectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sheetSectionTitleInline: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: '#17324D' },
  sheetChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  sheetChipActive: { backgroundColor: '#17324D', borderColor: '#17324D' },
  sheetChipText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#314A5E' },
  sheetChipTextActive: { color: '#FFFFFF' },
  sheetMissing: { fontSize: 13, lineHeight: 19, fontStyle: 'italic', color: '#667985' },
  sheetInputRow: { flexDirection: 'row', gap: 10 },
  sheetInputGroup: { flex: 1 },
  sheetInputLabel: { marginBottom: 5, fontSize: 12, fontWeight: '700', color: '#536575' },
  sheetInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD8DD',
    backgroundColor: '#FAFCFC',
    fontSize: 15,
    color: '#17324D',
  },
  sheetProgress: { marginTop: 10, fontSize: 12, lineHeight: 18, color: '#167C80' },
  filterHelpDisclosure: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#FFFFFF',
  },
  filterHelpIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7F7',
  },
  filterHelpIconText: { fontSize: 13, lineHeight: 16, fontWeight: '900', color: '#167C80' },
  filterHelpCopy: { flex: 1, minWidth: 0 },
  filterHelpTitle: { fontSize: 12, lineHeight: 16, fontWeight: '900', color: '#17324D' },
  filterHelpSummary: { marginTop: 1, fontSize: 11, lineHeight: 15, color: '#60727F' },
  filterHelpChevron: { fontSize: 20, lineHeight: 24, fontWeight: '700', color: '#167C80' },
  filterSheetHelp: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#F9FBFB',
    fontSize: 12,
    lineHeight: 18,
    color: '#60727F',
  },
  filterSheetActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#D9E1E6',
    backgroundColor: '#FFFFFF',
  },
  filterResetButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#CBD8DD',
  },
  filterResetText: { fontSize: 14, fontWeight: '800', color: '#17324D' },
  filterApplyButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: '#167C80',
  },
  filterApplyText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  filtersPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  shipFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.sm,
  },
  shipFilterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  shipFilterLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  shipCountBadge: {
    backgroundColor: COLORS.goldAccent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  shipCountText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  shipFilterToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  shipFilterList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.1)',
  },
  shipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  shipChipActive: {
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    borderColor: COLORS.navyDeep,
  },
  shipCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 31, 63, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shipCheckboxActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  shipChipText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
  },
  shipChipTextActive: {
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  noShipsText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.5,
    fontStyle: 'italic' as const,
    padding: SPACING.sm,
  },
  clearShipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  clearShipsText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.error,
  },
  filterSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    opacity: 0.6,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  cabinRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  conflictText: {
    fontSize: 12,
    color: CLEAN_THEME.text.secondary,
  },
  cruiseListHeader: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
  agentInlineButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B8DAD9',
    backgroundColor: '#F3F8F7',
  },
  agentInlineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1F1F0',
  },
  agentInlineCopy: { flex: 1, minWidth: 0 },
  agentInlineTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800' as const,
    color: '#17324D',
  },
  agentInlineSubtitle: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: '#60727F',
  },
  b2bSetCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    ...SHADOW.md,
  },
  b2bOperationalButton: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  b2bOperationalButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  b2bSetHeader: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.1)',
  },
  b2bSetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B7CCE2',
    backgroundColor: '#F8FBFD',
  },
  b2bSetBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.2,
  },
  b2bSetSummary: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  b2bSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  b2bSummaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
  },
  b2bCruiseItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.08)',
  },
  b2bCruiseItemLast: {
    borderBottomWidth: 0,
  },
  b2bCruisePosition: {
    width: 40,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  b2bPositionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EAF7F7',
    borderWidth: 1,
    borderColor: '#A8D8DE',
    color: '#167C80',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center' as const,
    lineHeight: 24,
    overflow: 'hidden',
  },
  b2bConnectorContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  b2bConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#A8D8DE',
  },
  b2bGapBadge: {
    position: 'absolute' as const,
    top: '50%',
    backgroundColor: '#F8FBFD',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    transform: [{ translateY: -8 }],
  },
  b2bGapText: {
    fontSize: 8,
    color: '#167C80',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  b2bCruiseContent: {
    flex: 1,
  },
  b2bCruiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  b2bShipName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  b2bCruiseDetails: {
    gap: 6,
  },
  b2bDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  b2bDetailText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.8,
  },
  b2bRoomBadge: {
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  b2bRoomText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  b2bOfferSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.05)',
  },
  b2bOfferInfo: {
    flex: 1,
  },
  b2bOfferCode: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.goldDark,
  },
  b2bOfferName: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginTop: 2,
  },
  b2bSetFooter: {
    padding: SPACING.md,
    backgroundColor: 'rgba(0, 31, 63, 0.03)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.08)',
  },
  b2bFooterLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.6,
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  b2bOfferTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  b2bOfferTag: {
    backgroundColor: COLORS.goldAccent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
  },
  b2bOfferTagText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  b2bNoOfferText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.5,
    fontStyle: 'italic' as const,
  },
  b2bFooterHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.6,
    marginTop: SPACING.sm,
    fontStyle: 'italic' as const,
  },
  b2bDateRange: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    marginTop: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    opacity: 0.8,
  },
  nightsBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: SPACING.xs,
  },
  nightsBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  slotOffersContainer: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(0, 31, 63, 0.03)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  slotOffersTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginBottom: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  offerGroup: {
    marginBottom: SPACING.xs,
  },
  offerCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.2)',
  },
  offerCodeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.goldDark,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  offerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: SPACING.xs,
    marginLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0, 31, 63, 0.1)',
  },
  offerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  offerCabinType: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    backgroundColor: 'rgba(0, 31, 63, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offerGuests: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  offerNameSmall: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.5,
    maxWidth: 120,
  },
  b2bExplanation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.3)',
  },
  b2bExplanationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    lineHeight: 18,
  },
  b2bValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  b2bValueBadge: {
    backgroundColor: 'rgba(34, 139, 34, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(34, 139, 34, 0.3)',
  },
  b2bValueText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: '#228B22',
  },
});
