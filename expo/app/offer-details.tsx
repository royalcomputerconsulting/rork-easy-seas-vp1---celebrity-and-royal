import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ship,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  X,
  Dice5,
  Star,
  DollarSign,
  Ban,
  Archive,
  BedDouble,
  Users,
  Gauge,
  FileText,
  Layers,
  Calculator,
  ClipboardCheck,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Gift,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { calculateCruiseValue, getDoubleOccupancyRoomRetailValue } from '@/lib/valueCalculator';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { calculateCasinoAvailabilityForCruise, calculatePersonalizedPlayEstimate, getCasinoStatusBadge } from '@/lib/casinoAvailability';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { createDateFromString, getDaysUntil, formatDate } from '@/lib/date';
import { useCertificates } from '@/state/CertificatesProvider';
import { formatCount, formatCurrency } from '@/lib/format';
import { formatGuestEligibility, getCruiseGuestEligibility } from '@/lib/cruiseRecordIntegrity';
import {
  buildCertificateStackingNotes,
  calculateOfferIntelligenceScore,
  decodeOffer,
} from '@/lib/offerIntelligence';
import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { getCanonicalCruiseInventoryKey, getCruiseInventoryOptionKey, getCruiseOfferInstanceKey } from '@/lib/cruiseInventory/cruiseCanonicalIdentity';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import type { CruiseInventoryCursor } from '@/lib/cruiseInventory/CruiseInventoryRepository';
import { evaluateBookTiming, evaluateShouldIBook } from '@/lib/shouldIBook';
import { normalizeOfferValue } from '@/lib/offers/offerValueNormalization';
import { resolveOfferCabinEntitlement, resolveOfferGuestEntitlement, resolveOfferPointRequirement } from '@/lib/offers/offerDisplayTruth';
import { filterOfferSailingRows } from '@/lib/offers/offerSailingFilters';
import { resolveOfferDetailsInstance } from '@/lib/offers/offerInstanceIdentity';
import { PremiumVoyageArtwork } from '@/components/ui/PremiumVoyageArtwork';
import { EntityProvenanceDisclosure } from '@/components/ui/EntityProvenanceDisclosure';
import { CruiseCard } from '@/components/CruiseCard';

type SortOption = 'soonest' | 'highest-value' | 'lowest-price' | 'longest' | 'shortest';
type ActiveOfferSailingQuery = {
  offerInstanceKey?: string;
  offerCode?: string;
  sortBy: 'sailDate' | 'nights' | 'value';
  sortDirection: 'asc' | 'desc';
};

type ToggleFilterMode = 'all' | 'yes' | 'no';
type OfferSailingFilters = {
  ships: string[];
  shipClasses: string[];
  cabins: string[];
  guestCounts: number[];
  departurePorts: string[];
  dateFrom: string;
  dateTo: string;
  minNights: string;
  maxNights: string;
  gty: ToggleFilterMode;
  nextCruiseBonus: ToggleFilterMode;
};

type OfferDetailViewState = {
  search: string;
  sort: SortOption;
  filters: OfferSailingFilters;
  scrollOffset: number;
  visiblePage: number;
};

const createEmptyOfferFilters = (): OfferSailingFilters => ({
  ships: [], shipClasses: [], cabins: [], guestCounts: [], departurePorts: [],
  dateFrom: '', dateTo: '', minNights: '', maxNights: '', gty: 'all', nextCruiseBonus: 'all',
});

const offerDetailViewStateCache = new Map<string, OfferDetailViewState>();

const OFFER_DETAIL_PAGE_SIZE = 200;
const OFFER_DETAIL_MAX_ROWS = 6000;
const OFFER_VISIBLE_PAGE_SIZE = 20;

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function getOfferSailingRowKey(cruise: Cruise, index = 0): string {
  const source = cruise as Cruise & {
    offerSailingKey?: string;
    inventoryCanonicalKey?: string;
    sourceCruiseId?: string;
  };
  const stableKey = source.offerSailingKey
    || getCruiseInventoryOptionKey(cruise)
    || [
      source.inventoryCanonicalKey,
      source.sourceCruiseId,
      cruise.id,
      cruise.offerCode,
      cruise.offerName,
      cruise.shipName,
      cruise.sailDate,
      cruise.returnDate,
      cruise.cabinType,
      cruise.guests,
      cruise.guestsInfo,
      cruise.sourceRecordId,
      cruise.sourceRowIndex,
    ].filter((part) => part !== undefined && part !== null && String(part).trim()).join('|');
  return stableKey || `offer-sailing-row-${index}`;
}

function getCruiseDetailsTargetId(cruise: Cruise): string {
  const source = cruise as Cruise & { inventoryCanonicalKey?: string; sourceCruiseId?: string };
  return String(source.inventoryCanonicalKey || source.sourceCruiseId || cruise.id || '').trim();
}

function compactText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getOfferSailingShipClass(cruise: Cruise): string {
  const row = cruise as Cruise & { shipClass?: string; shipClassName?: string; vesselClass?: string };
  const explicit = compactText(row.shipClass) || compactText(row.shipClassName) || compactText(row.vesselClass);
  if (explicit) return explicit;
  const category = compactText(cruise.category);
  return /\bclass\b/i.test(category) ? category : '';
}

function hasNextCruiseBonus(cruise: Cruise): boolean {
  const row = cruise as Cruise & { nextCruiseBonus?: unknown; nextCruiseBonusValue?: unknown; bookingBonus?: unknown };
  return Boolean(row.nextCruiseBonus || row.nextCruiseBonusValue || row.bookingBonus)
    || (cruise.perks ?? []).some((perk) => /next\s*cruise|booking bonus/i.test(perk));
}

function toggleArrayValue<T extends string | number>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

function SailingFilterChip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      style={[styles.filterChoiceChip, selected && styles.filterChoiceChipSelected]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      testID={testID}
    >
      {selected ? <Check size={13} color="#FFFFFF" /> : null}
      <Text style={[styles.filterChoiceText, selected && styles.filterChoiceTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getOfferSailingCabinLabel(cruise: Cruise): string {
  const cabinCandidates = [
    cruise.cabinType,
    (cruise as Cruise & { roomType?: string }).roomType,
  ].map(compactText);
  const categoryCandidates = [cruise.offerCategory, cruise.category]
    .map(compactText)
    .filter((value) => /interior|ocean\s*view|balcony|suite|stateroom|\bgty\b|guarantee/i.test(value));
  const explicit = [...cabinCandidates, ...categoryCandidates].find(Boolean);
  if (explicit) return explicit;

  const pricedBuckets = [
    cruise.interiorPrice && cruise.interiorPrice > 0 ? 'Interior' : '',
    cruise.oceanviewPrice && cruise.oceanviewPrice > 0 ? 'Oceanview' : '',
    cruise.balconyPrice && cruise.balconyPrice > 0 ? 'Balcony' : '',
    cruise.suitePrice && cruise.suitePrice > 0 ? 'Suite' : '',
  ].filter(Boolean);

  return pricedBuckets.length > 0 ? pricedBuckets.join(' / ') : '';
}

export default function OfferDetailsScreen() {
  const router = useRouter();
  const { offerCode, offerId, offerInstanceKey, id, expectedCruiseCount, openDecoded } = useLocalSearchParams<{ offerCode?: string; offerId?: string; offerInstanceKey?: string; id?: string; expectedCruiseCount?: string; openDecoded?: string }>();
  const routeCacheKey = String(offerInstanceKey || offerId || id || offerCode || 'unknown-offer');
  const cachedViewState = offerDetailViewStateCache.get(routeCacheKey);
  const { localData } = useAppState();
  const { cruises: storeCruises, bookedCruises: storeBookedCruises, casinoOffers: storeOffers, updateCasinoOffer } = useCoreData();
  const { currentUser } = useUser();
  const { queryOfferSailings } = useCruiseInventory();
  const { certificates } = useCertificates();
  const [sortBy, setSortBy] = useState<SortOption>(cachedViewState?.sort ?? 'soonest');
  const [showDecodedOffer, setShowDecodedOffer] = useState<boolean>(false);
  const [showValueFormula, setShowValueFormula] = useState<boolean>(false);
  const [showBookDecision, setShowBookDecision] = useState<boolean>(false);
  const [showOfferIntelligence, setShowOfferIntelligence] = useState<boolean>(false);
  const [inventoryOfferCruises, setInventoryOfferCruises] = useState<Cruise[]>([]);
  const [inventoryOfferTotal, setInventoryOfferTotal] = useState(0);
  const [inventoryOfferLoading, setInventoryOfferLoading] = useState(false);
  const [cruiseSearchText, setCruiseSearchText] = useState(cachedViewState?.search ?? '');
  const [sailingFilters, setSailingFilters] = useState<OfferSailingFilters>(cachedViewState?.filters ?? createEmptyOfferFilters());
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const offerListRef = useRef<FlatList<Cruise> | null>(null);
  const restoredScrollRef = useRef(false);
  const nextOfferCursorRef = useRef<CruiseInventoryCursor | null>(null);
  const activeOfferSailingQueryRef = useRef<ActiveOfferSailingQuery | null>(null);
  const [offerListStatusText, setOfferListStatusText] = useState('');
  const [offerListError, setOfferListError] = useState('');
  const [offerLoadAttempt, setOfferLoadAttempt] = useState(0);
  const [offerVisiblePage, setOfferVisiblePage] = useState(cachedViewState?.visiblePage ?? 0);
  const paginationInitializedRef = useRef(false);

  useEffect(() => {
    const current = offerDetailViewStateCache.get(routeCacheKey);
    offerDetailViewStateCache.set(routeCacheKey, {
      search: cruiseSearchText,
      sort: sortBy,
      filters: sailingFilters,
      scrollOffset: current?.scrollOffset ?? 0,
      visiblePage: offerVisiblePage,
    });
  }, [cruiseSearchText, offerVisiblePage, routeCacheKey, sailingFilters, sortBy]);

  const selectedOffer = useMemo(() => {
    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
    const uniqueOffers = allOffers.filter((candidate, index, self) =>
      index === self.findIndex((offerCandidate) => offerCandidate.id === candidate.id)
    );
    return resolveOfferDetailsInstance(uniqueOffers, {
      offerId: String(offerId || ''),
      id: String(id || ''),
      offerCode: String(offerCode || ''),
      offerInstanceKey: String(offerInstanceKey || ''),
    });
  }, [id, localData.offers, offerCode, offerId, offerInstanceKey, storeOffers]);

  const inventoryOfferQuery = useMemo(() => {
    const strongInstance = String(selectedOffer?.playerOfferId || selectedOffer?.offerInstanceId || selectedOffer?.carnivalOfferId || '').trim();
    return {
      offerInstanceKey: strongInstance && selectedOffer
        ? getCruiseOfferInstanceKey(selectedOffer as unknown as Cruise) ?? undefined
        : undefined,
      offerCode: strongInstance ? undefined : selectedOffer?.offerCode || offerCode,
      sortBy: sortBy === 'longest' || sortBy === 'shortest' ? 'nights' as const
        : sortBy === 'highest-value' || sortBy === 'lowest-price' ? 'value' as const
          : 'sailDate' as const,
      sortDirection: sortBy === 'highest-value' || sortBy === 'longest' ? 'desc' as const : 'asc' as const,
    } satisfies ActiveOfferSailingQuery;
  }, [offerCode, selectedOffer, sortBy]);

  const expectedOfferCruiseCount = useMemo(() => {
    const parsed = Number(Array.isArray(expectedCruiseCount) ? expectedCruiseCount[0] : expectedCruiseCount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [expectedCruiseCount]);

  useEffect(() => {
    if (!inventoryOfferQuery.offerInstanceKey && !inventoryOfferQuery.offerCode) return;
    let cancelled = false;
    setInventoryOfferLoading(true);
    setOfferListError('');
    setOfferListStatusText('Loading offer cruises…');
    nextOfferCursorRef.current = null;
    void (async () => {
      activeOfferSailingQueryRef.current = inventoryOfferQuery;
      const primaryPage = await queryOfferSailings({ ...inventoryOfferQuery, limit: OFFER_DETAIL_PAGE_SIZE });
      // The provider instance is authoritative whenever it has relationships.
      // Fall back to the public code only for legacy/unindexed instances; a
      // populated instance must never absorb separate offers sharing its code.
      if (inventoryOfferQuery.offerInstanceKey && primaryPage.total === 0 && (selectedOffer?.offerCode || offerCode)) {
        const fallbackQuery = {
          offerCode: selectedOffer?.offerCode || offerCode,
          sortBy: inventoryOfferQuery.sortBy,
          sortDirection: inventoryOfferQuery.sortDirection,
        } satisfies ActiveOfferSailingQuery;
        const fallbackPage = await queryOfferSailings({ ...fallbackQuery, limit: OFFER_DETAIL_PAGE_SIZE });
        if (fallbackPage.total > 0) {
          activeOfferSailingQueryRef.current = fallbackQuery;
          return fallbackPage;
        }
      }
      return primaryPage;
    })().then(async (page) => {
      if (cancelled) return;
      setInventoryOfferCruises(page.rows);
      setInventoryOfferTotal(page.total);
      nextOfferCursorRef.current = page.nextCursor;
      const targetRows = Math.min(
        OFFER_DETAIL_MAX_ROWS,
        Math.max(page.total, expectedOfferCruiseCount, page.rows.length),
      );
      let collectedRows = page.rows;
      let cursor = page.nextCursor;
      let loadedPages = 1;
      while (!cancelled && cursor && collectedRows.length < targetRows) {
        loadedPages += 1;
        setOfferListStatusText(`Loading offer cruises… ${collectedRows.length.toLocaleString()} of ${targetRows.toLocaleString()}`);
        await yieldToUi();
        const activeQuery = activeOfferSailingQueryRef.current ?? inventoryOfferQuery;
        const nextPage = await queryOfferSailings({ ...activeQuery, cursor, limit: OFFER_DETAIL_PAGE_SIZE });
        if (cancelled) return;
        collectedRows = [...collectedRows, ...nextPage.rows];
        setInventoryOfferCruises(collectedRows);
        setInventoryOfferTotal(nextPage.total || page.total);
        cursor = nextPage.nextCursor;
        nextOfferCursorRef.current = cursor;
        if (nextPage.rows.length === 0 || loadedPages > 40) break;
      }
      if (!cancelled) {
        const total = Math.max(page.total || 0, expectedOfferCruiseCount, collectedRows.length);
        if (collectedRows.length < total) {
          setOfferListError(`Only ${collectedRows.length.toLocaleString()} of ${total.toLocaleString()} offer-sailing rows passed inventory readback.`);
          setOfferListStatusText(`Incomplete readback · ${collectedRows.length.toLocaleString()} of ${total.toLocaleString()} loaded`);
        } else {
          setOfferListStatusText('');
        }
      }
    }).catch((error) => {
      console.error('[OfferDetails] Offer sailing query failed:', error);
      if (!cancelled) {
        setOfferListError(error instanceof Error ? error.message : String(error));
        setOfferListStatusText('Could not load offer cruises from inventory. Your saved rows were not removed.');
      }
    }).finally(() => {
      if (!cancelled) setInventoryOfferLoading(false);
    });
    return () => { cancelled = true; };
  }, [expectedOfferCruiseCount, inventoryOfferQuery, offerCode, offerLoadAttempt, queryOfferSailings, selectedOffer?.offerCode]);

  const retryOfferSailingLoad = useCallback(() => {
    setOfferListError('');
    setOfferLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    const shouldOpenDecoded = String(Array.isArray(openDecoded) ? openDecoded[0] : openDecoded || '').toLowerCase();
    if (shouldOpenDecoded === '1' || shouldOpenDecoded === 'true') {
      setShowDecodedOffer(true);
    }
  }, [openDecoded]);

  const loadMoreOfferSailings = useCallback(async () => {
    const cursor = nextOfferCursorRef.current;
    if (!cursor || inventoryOfferLoading) return;
    setInventoryOfferLoading(true);
    try {
      const activeQuery = activeOfferSailingQueryRef.current ?? inventoryOfferQuery;
      const page = await queryOfferSailings({ ...activeQuery, cursor, limit: OFFER_DETAIL_PAGE_SIZE });
      setInventoryOfferCruises((current) => [...current, ...page.rows]);
      setInventoryOfferTotal(page.total);
      nextOfferCursorRef.current = page.nextCursor;
    } finally {
      setInventoryOfferLoading(false);
    }
  }, [inventoryOfferLoading, inventoryOfferQuery, queryOfferSailings]);

  const playingHoursConfig = useMemo(() => {
    const userPlayingHours = currentUser?.playingHours || DEFAULT_PLAYING_HOURS;
    return {
      enabled: userPlayingHours.enabled,
      sessions: userPlayingHours.sessions,
    };
  }, [currentUser?.playingHours]);

  const bookedCruiseIds = useMemo(() => {
    const allBooked = [...(storeBookedCruises || []), ...(localData.booked || [])];
    return new Set(allBooked.map((b: BookedCruise) => b.id));
  }, [storeBookedCruises, localData.booked]);

  const offerData = useMemo(() => {
    // Combine CruiseStore data (primary) with localData (fallback)
    const allCruises = inventoryOfferCruises.length > 0
      ? inventoryOfferCruises
      : [...(storeCruises || []), ...(localData.cruises || [])];
    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
    
    console.log('[OfferDetails] Data sources:', {
      storeCruisesCount: (storeCruises || []).length,
      localCruisesCount: (localData.cruises || []).length,
      storeOffersCount: (storeOffers || []).length,
      localOffersCount: (localData.offers || []).length,
      targetOfferCode: offerCode,
      targetOfferId: offerId,
    });
    
    // Preserve offer-sailing option rows. A single physical sailing can appear
    // several times under one offer with different cabin, guest, B2B, or source
    // evidence; de-duping by physical cruise id is exactly what hid "70 cruises"
    // as one visible card.
    const uniqueCruises = inventoryOfferCruises.length > 0
      ? allCruises
      : allCruises.filter((cruise, index, self) => {
        const key = getOfferSailingRowKey(cruise, index);
        return index === self.findIndex((candidate, candidateIndex) => getOfferSailingRowKey(candidate, candidateIndex) === key);
      });
    
    const uniqueOffers = allOffers.filter((candidate, index, self) =>
      index === self.findIndex((offerCandidate) => offerCandidate.id === candidate.id)
    );
    const offer = selectedOffer;
    const linkedCruiseIds = new Set(
      offer ? [offer.cruiseId, ...(offer.cruiseIds ?? [])].filter((id): id is string => Boolean(id)) : [],
    );
    const offerInstanceId = String(offer?.playerOfferId || offer?.offerInstanceId || offer?.carnivalOfferId || '').trim().toLowerCase();

    // Explicit cruiseIds are authoritative. Provider instance identity is the
    // next-safe fallback. Code-only matching is retained solely for legacy
    // single-instance records so separate offers sharing 26TOR403 never open a
    // combined sailing list.
    let matchingCruises = inventoryOfferCruises.length > 0
      ? uniqueCruises
      : linkedCruiseIds.size > 0
        ? uniqueCruises.filter((cruise) => linkedCruiseIds.has(cruise.id))
        : offerInstanceId
          ? uniqueCruises.filter((cruise) => String(cruise.playerOfferId || cruise.offerInstanceId || '').trim().toLowerCase() === offerInstanceId)
          : uniqueCruises.filter((cruise) => cruise.offerCode === (offer?.offerCode || offerCode));
    
    console.log('[OfferDetails] Found offer:', offer?.offerCode, 'with pricing:', {
      interior: offer?.interiorPrice,
      oceanview: offer?.oceanviewPrice,
      balcony: offer?.balconyPrice,
      suite: offer?.suitePrice,
      taxesFees: offer?.taxesFees,
    });
    
    // Enrich cruises with pricing from the linked offer if missing
    const enrichedCruises = matchingCruises.map(cruise => {
      const hasPricing = cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice;
      
      if (!hasPricing && offer) {
        console.log('[OfferDetails] Enriching cruise with offer pricing:', cruise.id);
        return {
          ...cruise,
          interiorPrice: cruise.interiorPrice || offer.interiorPrice,
          oceanviewPrice: cruise.oceanviewPrice || offer.oceanviewPrice,
          balconyPrice: cruise.balconyPrice || offer.balconyPrice,
          suitePrice: cruise.suitePrice || offer.suitePrice,
          taxes: cruise.taxes || offer.taxesFees,
        };
      }
      
      console.log('[OfferDetails] Cruise pricing:', cruise.id, {
        interior: cruise.interiorPrice,
        oceanview: cruise.oceanviewPrice,
        balcony: cruise.balconyPrice,
        suite: cruise.suitePrice,
        taxes: cruise.taxes,
      });
      
      return cruise;
    });
    
    const cruises = [...enrichedCruises].sort((a, b) => {
      switch (sortBy) {
        case 'soonest': {
          const dateA = createDateFromString(a.sailDate).getTime();
          const dateB = createDateFromString(b.sailDate).getTime();
          return dateA - dateB;
        }
        case 'highest-value': {
          const valueA = Math.max(
            a.suitePrice || 0,
            a.balconyPrice || 0,
            a.oceanviewPrice || 0,
            a.interiorPrice || 0
          );
          const valueB = Math.max(
            b.suitePrice || 0,
            b.balconyPrice || 0,
            b.oceanviewPrice || 0,
            b.interiorPrice || 0
          );
          return valueB - valueA;
        }
        case 'lowest-price': {
          const getPrices = (cruise: Cruise) => [
            cruise.interiorPrice,
            cruise.oceanviewPrice,
            cruise.balconyPrice,
            cruise.suitePrice,
          ].filter((p): p is number => p != null && p > 0);
          
          const pricesA = getPrices(a);
          const pricesB = getPrices(b);
          const minA = pricesA.length > 0 ? Math.min(...pricesA) : Infinity;
          const minB = pricesB.length > 0 ? Math.min(...pricesB) : Infinity;
          return minA - minB;
        }
        case 'longest':
          return (b.nights || 0) - (a.nights || 0);
        case 'shortest':
          return (a.nights || 0) - (b.nights || 0);
        default:
          return 0;
      }
    });
    
    return { cruises, offer };
  }, [storeCruises, storeOffers, localData.cruises, localData.offers, offerCode, offerId, sortBy, inventoryOfferCruises, selectedOffer]);

  // Count only rows the user can inspect on this screen. Provider and route
  // totals are a loading/readback target, not a substitute for visible data.
  const eligibleRowsLoaded = offerData.cruises.length;
  const eligibleRowsExpected = Math.max(inventoryOfferTotal, expectedOfferCruiseCount, eligibleRowsLoaded);

  const offerInfo = useMemo(() => {
    const { cruises, offer } = offerData;
    const first = cruises[0];
    const source = offer ?? ({
      id: first?.id ?? offerCode ?? 'unknown', offerCode: first?.offerCode ?? offerCode,
      offerName: first?.offerName, expiryDate: first?.offerExpiry, roomType: first?.cabinType,
      freePlay: first?.freePlay, OBC: first?.freeOBC, taxesFees: first?.taxes,
    } as CasinoOffer);
    const normalizedValue = normalizeOfferValue(source, cruises);
    return {
      offerCode: source.offerCode || offerCode || 'Unknown',
      offerName: source.title || source.offerName || source.offerCode || 'Casino Offer',
      expiryDate: source.expiryDate || source.offerExpiryDate,
      tradeInValue: source.value || source.tradeInValue,
      freePlay: source.freePlay || source.freeplayAmount,
      obc: source.obcAmount || source.OBC,
      roomType: source.roomType,
      received: source.received,
      perks: source.perks,
      interiorPrice: source.interiorPrice,
      oceanviewPrice: source.oceanviewPrice,
      balconyPrice: source.balconyPrice,
      suitePrice: source.suitePrice,
      taxesFees: source.taxesFees,
      totalValue: normalizedValue.faceValue.value ?? 0,
      minRetailValue: normalizedValue.cabinRetailRange?.minimum ?? 0,
      maxRetailValue: normalizedValue.cabinRetailRange?.maximum ?? 0,
      normalizedValue,
    };
  }, [offerData, offerCode]);

  const offerEntitlementTruth = useMemo(() => ({
    points: resolveOfferPointRequirement(offerData.offer ?? { offerCode: offerInfo.offerCode }, offerData.cruises),
    cabin: resolveOfferCabinEntitlement(offerData.offer, offerData.cruises),
    guests: resolveOfferGuestEntitlement(offerData.offer, offerData.cruises),
  }), [offerData.cruises, offerData.offer, offerInfo.offerCode]);

  const filterFacets = useMemo(() => {
    const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      ships: uniqueStrings(offerData.cruises.map((cruise) => compactText(cruise.shipName))),
      shipClasses: uniqueStrings(offerData.cruises.map(getOfferSailingShipClass)),
      cabins: uniqueStrings(offerData.cruises.map((cruise) => getOfferSailingCabinLabel(cruise))),
      guestCounts: Array.from(new Set(offerData.cruises.map(getCruiseGuestEligibility).filter((count): count is number => Boolean(count)))).sort((a, b) => a - b),
      departurePorts: uniqueStrings(offerData.cruises.map((cruise) => compactText(cruise.departurePort))),
    };
  }, [offerData.cruises, offerData.offer]);

  const activeSailingFilterCount = useMemo(() => {
    return sailingFilters.ships.length
      + sailingFilters.shipClasses.length
      + sailingFilters.cabins.length
      + sailingFilters.guestCounts.length
      + sailingFilters.departurePorts.length
      + Number(Boolean(sailingFilters.dateFrom))
      + Number(Boolean(sailingFilters.dateTo))
      + Number(Boolean(sailingFilters.minNights))
      + Number(Boolean(sailingFilters.maxNights))
      + Number(sailingFilters.gty !== 'all')
      + Number(sailingFilters.nextCruiseBonus !== 'all');
  }, [sailingFilters]);

  const clearSailingFilters = useCallback(() => {
    setSailingFilters(createEmptyOfferFilters());
    setCruiseSearchText('');
  }, []);

  const displayedOfferCruises = useMemo(() => {
    return filterOfferSailingRows(offerData.cruises, cruiseSearchText, sailingFilters, {
      ship: (cruise) => compactText(cruise.shipName),
      shipClass: getOfferSailingShipClass,
      cabin: (cruise) => getOfferSailingCabinLabel(cruise),
      guestCount: getCruiseGuestEligibility,
      departurePort: (cruise) => compactText(cruise.departurePort),
      sailDate: (cruise) => cruise.sailDate,
      nights: (cruise) => cruise.nights,
      hasNextCruiseBonus,
      dateToTime: (date) => createDateFromString(date).getTime(),
      searchParts: (cruise) => [
        cruise.shipName,
        getOfferSailingShipClass(cruise),
        cruise.sailDate,
        cruise.returnDate,
        cruise.departurePort,
        cruise.destination,
        cruise.destinationRegion,
        cruise.itineraryName,
        cruise.cabinType,
        getOfferSailingCabinLabel(cruise),
        cruise.guestsInfo,
        cruise.offerCode,
        cruise.offerName,
        cruise.portsAndTimes,
        cruise.ports ?? [],
        (cruise.itinerary ?? []).map((day) => day.port),
      ],
    });
  }, [cruiseSearchText, offerData.cruises, offerData.offer, sailingFilters]);

  const offerVisiblePageCount = Math.max(1, Math.ceil(displayedOfferCruises.length / OFFER_VISIBLE_PAGE_SIZE));
  const pagedOfferCruises = useMemo(() => {
    const safePage = Math.min(offerVisiblePage, offerVisiblePageCount - 1);
    const start = safePage * OFFER_VISIBLE_PAGE_SIZE;
    return displayedOfferCruises.slice(start, start + OFFER_VISIBLE_PAGE_SIZE);
  }, [displayedOfferCruises, offerVisiblePage, offerVisiblePageCount]);

  const offerOptionCountsByPhysicalVoyage = useMemo(() => {
    const counts = new Map<string, number>();
    offerData.cruises.forEach((cruise) => {
      const key = getCanonicalCruiseInventoryKey(cruise);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [offerData.cruises]);

  useEffect(() => {
    setOfferVisiblePage((current) => Math.min(current, offerVisiblePageCount - 1));
  }, [offerVisiblePageCount]);

  useEffect(() => {
    if (!paginationInitializedRef.current) {
      paginationInitializedRef.current = true;
      return;
    }
    setOfferVisiblePage(0);
  }, [cruiseSearchText, sailingFilters, sortBy]);

  const goToOfferVisiblePage = useCallback((page: number) => {
    const nextPage = Math.max(0, Math.min(page, offerVisiblePageCount - 1));
    setOfferVisiblePage(nextPage);
    requestAnimationFrame(() => offerListRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0.05 }));
  }, [offerVisiblePageCount]);

  useEffect(() => {
    if (restoredScrollRef.current || inventoryOfferLoading || displayedOfferCruises.length === 0) return;
    restoredScrollRef.current = true;
    const savedOffset = offerDetailViewStateCache.get(routeCacheKey)?.scrollOffset ?? 0;
    if (savedOffset <= 0) return;
    const timer = setTimeout(() => offerListRef.current?.scrollToOffset({ offset: savedOffset, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [displayedOfferCruises.length, inventoryOfferLoading, routeCacheKey]);

  const handleOfferListScroll = useCallback((offset: number) => {
    const current = offerDetailViewStateCache.get(routeCacheKey) ?? {
      search: cruiseSearchText,
      sort: sortBy,
      filters: sailingFilters,
      scrollOffset: 0,
      visiblePage: offerVisiblePage,
    };
    offerDetailViewStateCache.set(routeCacheKey, { ...current, scrollOffset: Math.max(0, offset) });
  }, [cruiseSearchText, offerVisiblePage, routeCacheKey, sailingFilters, sortBy]);

  const currentTravelerProfile = useMemo(() => {
    if (!currentUser) return null;
    return {
      id: currentUser.id,
      displayName: currentUser.displayName || currentUser.name,
      email: currentUser.email,
      royalCaribbeanNumber: currentUser.royalCaribbeanNumber || currentUser.crownAnchorNumber,
      clubRoyaleId: currentUser.clubRoyaleId,
      celebrityCaptainsClubNumber: currentUser.celebrityCaptainsClubNumber,
      blueChipId: currentUser.blueChipId,
      active: currentUser.active,
      defaultProfile: currentUser.defaultProfile,
      createdAt: currentUser.createdAt,
      updatedAt: currentUser.updatedAt,
    };
  }, [currentUser]);

  const offerIntelligence = useMemo(() => {
    if (!offerData.offer) return null;
    return calculateOfferIntelligenceScore(offerData.offer, offerData.cruises, certificates, currentTravelerProfile);
  }, [offerData.offer, offerData.cruises, certificates, currentTravelerProfile]);

  const shouldBookResult = useMemo(() => {
    const candidate = offerData.cruises[0];
    if (!offerData.offer || !candidate) return null;
    return evaluateShouldIBook({
      offer: offerData.offer,
      cruise: candidate,
      bookedCruises: storeBookedCruises,
      certificates,
      profile: currentTravelerProfile,
    });
  }, [certificates, currentTravelerProfile, offerData.cruises, offerData.offer, storeBookedCruises]);

  const decodedOffer = useMemo(() => {
    if (!offerData.offer) return null;
    return decodeOffer(offerData.offer, offerData.cruises, currentTravelerProfile);
  }, [offerData.offer, offerData.cruises, currentTravelerProfile]);

  const certificateStackingNotes = useMemo(() => {
    if (!offerData.offer) return [];
    return buildCertificateStackingNotes(offerData.offer, certificates, offerData.cruises).slice(0, 3);
  }, [offerData.offer, certificates, offerData.cruises]);

  const daysUntilExpiry = offerInfo.expiryDate ? getDaysUntil(offerInfo.expiryDate) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  const bookTimingResult = shouldBookResult ? evaluateBookTiming({ decision: shouldBookResult, daysUntilOfferExpiry: daysUntilExpiry, observedPriceChangePercent: offerData.cruises[0]?.priceDrop && offerData.cruises[0]?.originalPrice ? offerData.cruises[0].priceDrop / offerData.cruises[0].originalPrice * 100 : null, cabinAvailability: 'unknown', alternativeOfferCount: Math.max(0, offerData.cruises.length - 1) }) : null;

  const handleCruisePress = useCallback((cruise: Cruise) => {
    const targetId = getCruiseDetailsTargetId(cruise);
    console.log('[OfferDetails] Cruise pressed:', {
      targetId,
      offerSailingKey: (cruise as Cruise & { offerSailingKey?: string }).offerSailingKey,
      offerCode: cruise.offerCode,
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
    });
    router.push({
      pathname: '/cruise-details' as never,
      params: {
        ...buildCruiseDetailsParams(cruise, { source: 'offer-details' }),
        id: targetId,
        offerOptionId: (cruise as Cruise & { offerSailingKey?: string }).offerSailingKey || cruise.id,
        offerCode: cruise.offerCode,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        returnDate: cruise.returnDate,
      },
    } as never);
  }, [router]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleMarkAsUsed = useCallback(() => {
    const { offer } = offerData;
    if (!offer) return;

    // A redeemed offer remains part of the user's durable offer history. Do
    // not delete it: certificates, bookings, backups, and Agent SEA can still
    // need the source record after redemption.
    updateCasinoOffer(offer.id, {
      status: 'used',
      updatedAt: new Date().toISOString(),
    });
    console.log('[OfferDetails] Marked offer as used:', offer.offerCode);
    router.back();
  }, [offerData, router, updateCasinoOffer]);

  const handleMarkAsInProgress = useCallback(() => {
    const { offer } = offerData;
    if (!offer) return;
    
    updateCasinoOffer(offer.id, {
      status: 'booked',
    });
    console.log('[OfferDetails] Marked offer as booked/in-progress:', offer.offerCode);
    router.back();
  }, [offerData, router, updateCasinoOffer]);

  const getCruiseSummary = useCallback((cruise: Cruise) => {
    const casinoAvail = calculateCasinoAvailabilityForCruise(cruise, storeOffers, { quiet: true });
    const playEstimate = calculatePersonalizedPlayEstimate(casinoAvail, playingHoursConfig);
    const valueBreakdown = calculateCruiseValue(cruise);
    const operationalItineraryKnown = casinoAvail.totalDays > 0;
    const statusBadge = operationalItineraryKnown
      ? getCasinoStatusBadge(casinoAvail.casinoOpenDays, casinoAvail.totalDays)
      : { label: 'Needs itinerary', color: COLORS.textSecondary, percentage: 0 };
    
    // Calculate retail value range; imported cabin prices are already full-booking totals.
    const taxes = cruise.taxes || 0;
    const interiorPrice = cruise.interiorPrice || 0;
    const oceanviewPrice = cruise.oceanviewPrice || 0;
    const suitePrice = cruise.suitePrice || 0;
    
    // Min retail = interior + taxes, Max retail = suite + taxes.
    const minRetailValue = interiorPrice > 0 ? (getDoubleOccupancyRoomRetailValue(interiorPrice) ?? interiorPrice) + taxes : 0;
    const maxRetailValue = suitePrice > 0 ? (getDoubleOccupancyRoomRetailValue(suitePrice) ?? suitePrice) + taxes : 0;
    
    return {
      operationalItineraryKnown,
      casinoDays: operationalItineraryKnown ? casinoAvail.casinoOpenDays : null,
      seaDays: operationalItineraryKnown ? casinoAvail.seaDays : null,
      portDays: operationalItineraryKnown ? casinoAvail.portDays : null,
      casinoOpenHours: operationalItineraryKnown ? casinoAvail.estimatedCasinoHours : null,
      totalDays: casinoAvail.totalDays,
      estimatedPoints: operationalItineraryKnown ? playEstimate.estimatedPoints : null,
      goldenHours: operationalItineraryKnown ? (playEstimate.goldenHoursTotal || playEstimate.estimatedPlayHours) : null,
      totalValue: valueBreakdown.totalRetailValue,
      minRetailValue,
      maxRetailValue,
      coveragePercent: Math.round(valueBreakdown.coverageFraction * 100),
      statusBadge,
      balconyPrice: cruise.balconyPrice,
      interiorPrice: cruise.interiorPrice,
      oceanviewPrice: cruise.oceanviewPrice,
      suitePrice: cruise.suitePrice,
      taxes,
    };
  }, [storeOffers, playingHoursConfig]);

  const renderCruiseCard = useCallback(({ item }: { item: Cruise }) => {
    const isBooked = bookedCruiseIds.has(item.id);
    const offerPointTruth = resolveOfferPointRequirement(offerData.offer ?? undefined, [item]);
    const offerGuestTruth = resolveOfferGuestEntitlement(undefined, [item]);
    const eligibleCabinLabel = getOfferSailingCabinLabel(item);
    const displayCruise: Cruise = {
      ...item,
      cabinType: item.cabinType || eligibleCabinLabel || undefined,
      guests: getCruiseGuestEligibility(item) ?? offerGuestTruth.value ?? undefined,
      shipClass: item.shipClass || getOfferSailingShipClass(item) || undefined,
      pointRequirement: item.pointRequirement || offerPointTruth.value || undefined,
      sourceProvider: item.sourceProvider || item.cruiseSource || 'Club Royale eligible-sailing catalog',
    };

    return (
      <View testID={`offer-sailing-${getOfferSailingRowKey(item)}`}>
        <CruiseCard
          cruise={displayCruise}
          onPress={() => handleCruisePress(displayCruise)}
          variant={isBooked ? 'booked' : 'available'}
          mini
          showRetailValue
          relatedOfferOptionCount={offerOptionCountsByPhysicalVoyage.get(getCanonicalCruiseInventoryKey(item)) ?? 1}
        />
      </View>
    );
  }, [bookedCruiseIds, handleCruisePress, offerData.offer, offerOptionCountsByPhysicalVoyage]);

  const toggleSailingStringFilter = useCallback((field: 'ships' | 'shipClasses' | 'cabins' | 'departurePorts', value: string) => {
    setSailingFilters((current) => ({ ...current, [field]: toggleArrayValue(current[field], value) }));
  }, []);

  const toggleSailingGuestFilter = useCallback((value: number) => {
    setSailingFilters((current) => ({ ...current, guestCounts: toggleArrayValue(current.guestCounts, value) }));
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          ref={offerListRef}
          data={pagedOfferCruises}
          renderItem={renderCruiseCard}
          keyExtractor={(item, index) => getOfferSailingRowKey(item, index)}
          extraData={`${sortBy}:${cruiseSearchText}:${JSON.stringify(sailingFilters)}:${offerVisiblePage}`}
          initialNumToRender={12}
          maxToRenderPerBatch={20}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => { void loadMoreOfferSailings(); }}
          onEndReachedThreshold={0.6}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => handleOfferListScroll(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={200}
          ListHeaderComponent={
            <>
              <LinearGradient
                colors={['#FFFFFF', '#F8FAFB', '#F3F3F2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mergedHeader}
              >
                <View style={styles.compactHeaderTopRow}>
                  <Image
                    source={{ uri: IMAGES.logo }}
                    style={styles.compactOfferLogo}
                    resizeMode="contain"
                  />
                  <View style={styles.compactOfferTextGroup}>
                    <Text style={styles.featuredOfferName} numberOfLines={2}>{offerInfo.offerName}</Text>
                    <View style={styles.compactCodeRow}>
                      <View style={styles.offerCodeBadge}>
                        <Text style={styles.offerCodeText}>{offerInfo.offerCode}</Text>
                      </View>
                      {offerData.offer && (offerData.offer.status === 'used' || offerData.offer.status === 'booked') ? (
                        <View style={[styles.statusMiniBadge, offerData.offer.status === 'used' && styles.statusBadgeUsed]}>
                          {offerData.offer.status === 'used' ? (
                            <Ban size={12} color={COLORS.white} />
                          ) : (
                            <Archive size={12} color={COLORS.white} />
                          )}
                          <Text style={styles.statusMiniBadgeText}>{offerData.offer.status === 'used' ? 'Used' : 'In Progress'}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.75} testID="offer-details-close" accessibilityLabel="Close offer details">
                    <X size={22} color={COLORS.navyDeep} />
                  </TouchableOpacity>
                </View>

                <PremiumVoyageArtwork
                  kind="destination"
                  ship={offerInfo.offerName}
                  destination={inventoryOfferLoading && eligibleRowsExpected > eligibleRowsLoaded
                    ? `${eligibleRowsLoaded.toLocaleString()} of ${formatCount(eligibleRowsExpected, 'eligible voyage option')} loaded`
                    : formatCount(eligibleRowsLoaded, 'eligible voyage option')}
                  height={96}
                />
                <EntityProvenanceDisclosure ownerId={null} entityType="offer" entityId={String(offerData.offer?.id ?? offerInfo.offerCode)} field="offerCode" label="Offer source and freshness" fallback={{ sourceType: 'provider_sync', observedAt: String((offerData.offer as any)?.updatedAt ?? (offerData.offer as any)?.syncedAt ?? new Date().toISOString()), ownerId: null, confidence: 'high', sourceRecord: `${String((offerData.offer as any)?.provider ?? 'Royal Caribbean / Club Royale')} · ${offerInfo.offerCode}`, formula: null, provider: String((offerData.offer as any)?.provider ?? 'Club Royale'), sourceHash: null, notes: null }} />

                <View style={styles.compactMetricRow}>
                  {offerInfo.totalValue > 0 ? (
                    <View style={[styles.compactMetricPill, styles.compactMetricPillMoney]}>
                      <DollarSign size={14} color="#166534" />
                      <Text style={styles.compactMetricLabel}>{offerInfo.normalizedValue.faceValue.evidence === 'provider' ? 'Provider value' : 'Derived value'}</Text>
                      <Text style={[styles.compactMetricValue, styles.compactMetricValueMoney]}>${Math.round(offerInfo.totalValue).toLocaleString()}</Text>
                    </View>
                  ) : null}
                  {offerInfo.expiryDate ? (
                    <View style={styles.compactMetricPill}>
                      <Clock size={14} color={isExpiringSoon ? COLORS.warning : COLORS.navyDeep} />
                      <Text style={styles.compactMetricLabel}>Expires</Text>
                      <Text style={[styles.compactMetricValue, isExpiringSoon && styles.statValueWarning]}>
                        {formatDate(offerInfo.expiryDate, 'short')}{isExpiringSoon && ` · ${daysUntilExpiry}d`}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.compactMetricPill}>
                    <Ship size={14} color={COLORS.navyDeep} />
                    <Text style={styles.compactMetricLabel}>Cruises</Text>
                    <Text style={styles.compactMetricValue}>{eligibleRowsLoaded.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.entitlementTruthGrid} testID="offer-details-entitlement-truth">
                  <View style={styles.entitlementTruthItem}>
                    <Text style={styles.entitlementTruthLabel}>Points level</Text>
                    <Text style={styles.entitlementTruthValue}>{offerEntitlementTruth.points.label}</Text>
                  </View>
                  <View style={styles.entitlementTruthItem}>
                    <Text style={styles.entitlementTruthLabel}>Stateroom</Text>
                    <Text style={styles.entitlementTruthValue}>{offerEntitlementTruth.cabin.label}</Text>
                  </View>
                  <View style={styles.entitlementTruthItem}>
                    <Text style={styles.entitlementTruthLabel}>Guests</Text>
                    <Text style={styles.entitlementTruthValue}>{offerEntitlementTruth.guests.label}</Text>
                  </View>
                  <View style={styles.entitlementTruthItem}>
                    <Text style={styles.entitlementTruthLabel}>
                      {offerInfo.normalizedValue.components.cabinRetail.evidence === 'provider' ? 'Stateroom value' : 'Est. stateroom value'}
                    </Text>
                    <Text style={styles.entitlementTruthValue}>
                      {offerInfo.normalizedValue.components.cabinRetail.value == null ? 'Not available' : formatCurrency(offerInfo.normalizedValue.components.cabinRetail.value)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.valueFormulaButton} onPress={() => setShowValueFormula((current) => !current)} testID="offer-value-formula-drilldown">
                  <Calculator size={15} color="#0F766E" />
                  <View style={styles.valueFormulaButtonCopy}>
                    <Text style={styles.valueFormulaButtonTitle}>True offer value</Text>
                    <Text style={styles.valueFormulaButtonSub}>Face, expected, and personally usable value · {offerInfo.normalizedValue.missingInputs.length ? `${offerInfo.normalizedValue.missingInputs.length} missing input(s)` : 'complete inputs'}</Text>
                  </View>
                  <ChevronRight size={17} color="#0F766E" />
                </TouchableOpacity>
                {showValueFormula ? (
                  <View style={styles.valueFormulaPanel} testID="offer-value-normalized-breakdown">
                    <View style={styles.valueFormulaGrid}>
                      <View style={styles.valueFormulaMetric}><Text style={styles.valueFormulaLabel}>Face value</Text><Text style={styles.valueFormulaValue}>{offerInfo.normalizedValue.faceValue.value == null ? 'Missing' : formatCurrency(offerInfo.normalizedValue.faceValue.value)}</Text></View>
                      <View style={styles.valueFormulaMetric}><Text style={styles.valueFormulaLabel}>Expected value</Text><Text style={styles.valueFormulaValue}>{offerInfo.normalizedValue.expectedValue.value == null ? 'Missing' : formatCurrency(offerInfo.normalizedValue.expectedValue.value)}</Text></View>
                      <View style={styles.valueFormulaMetric}><Text style={styles.valueFormulaLabel}>Personally usable</Text><Text style={styles.valueFormulaValue}>{offerInfo.normalizedValue.personallyUsableValue.value == null ? 'Missing' : formatCurrency(offerInfo.normalizedValue.personallyUsableValue.value)}</Text></View>
                    </View>
                    {offerInfo.normalizedValue.cabinRetailRange ? <Text style={styles.valueFormulaText}>Eligible cabin retail range: {formatCurrency(offerInfo.normalizedValue.cabinRetailRange.minimum)}–{formatCurrency(offerInfo.normalizedValue.cabinRetailRange.maximum)} · median {formatCurrency(offerInfo.normalizedValue.cabinRetailRange.median)} across {formatCount(offerInfo.normalizedValue.eligibleSailingCount, 'option')}.</Text> : null}
                    {offerInfo.normalizedValue.formula.map((line) => <Text key={line} style={styles.valueFormulaText}>• {line}</Text>)}
                    {offerInfo.normalizedValue.missingInputs.length ? <Text style={styles.valueFormulaMissing}>Missing: {offerInfo.normalizedValue.missingInputs.join(', ')}. Missing values remain missing and are not invented.</Text> : null}
                  </View>
                ) : null}

                {((offerInfo.freePlay ?? 0) > 0 || (offerInfo.obc ?? 0) > 0) && (
                  <View style={styles.fpObcRow}>
                    {(offerInfo.freePlay ?? 0) > 0 && (
                      <View style={styles.fpBadgeOffer}>
                        <Text style={styles.fpLabelOffer}>FreePlay</Text>
                        <Text style={styles.fpValueOffer}>${(offerInfo.freePlay ?? 0).toLocaleString()}</Text>
                      </View>
                    )}
                    {(offerInfo.obc ?? 0) > 0 && (
                      <View style={styles.obcBadgeOffer}>
                        <Text style={styles.obcLabelOffer}>OBC</Text>
                        <Text style={styles.obcValueOffer}>${(offerInfo.obc ?? 0).toLocaleString()}</Text>
                      </View>
                    )}
                  </View>
                )}

                {offerIntelligence ? (
                  <View style={styles.intelligencePanel} testID="offer-details-intelligence-panel">
                    <TouchableOpacity
                      style={styles.intelligenceHeaderRow}
                      onPress={() => setShowOfferIntelligence((current) => !current)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showOfferIntelligence }}
                      testID="offer-details-intelligence-disclosure"
                    >
                      <View style={styles.intelligenceScoreBadge}>
                        <Gauge size={15} color="#0F766E" />
                        <Text style={styles.intelligenceScoreText}>{offerIntelligence.score}</Text>
                      </View>
                      <View style={styles.intelligenceCopy}>
                        <Text style={styles.intelligenceTitle}>Offer Intelligence</Text>
                        <Text style={styles.intelligenceSubtitle}>{offerIntelligence.rating} · {offerIntelligence.brandLabel}</Text>
                        <Text style={styles.intelligenceExplanation} numberOfLines={2}>{offerIntelligence.explanation}</Text>
                      </View>
                      {showOfferIntelligence ? <ChevronDown size={18} color="#17324D" /> : <ChevronRight size={18} color="#17324D" />}
                    </TouchableOpacity>
                    {showOfferIntelligence ? <>
                    <View style={styles.intelligenceBottomRow}>
                      <View style={styles.calculatorGrid} testID="casino-pays-for-calculator">
                        <View style={styles.calculatorCell}>
                          <Text style={styles.calculatorLabel}>Casino</Text>
                          <Text style={styles.calculatorValue}>{formatCurrency(offerIntelligence.casinoPaysFor.casinoCoveredValue)}</Text>
                        </View>
                        <View style={styles.calculatorCell}>
                          <Text style={styles.calculatorLabel}>You Pay</Text>
                          <Text style={styles.calculatorValue}>{formatCurrency(offerIntelligence.casinoPaysFor.userOutOfPocket)}</Text>
                        </View>
                        <View style={styles.calculatorCell}>
                          <Text style={styles.calculatorLabel}>Save</Text>
                          <Text style={styles.calculatorValue}>{offerIntelligence.casinoPaysFor.effectiveSavingsPercentage}%</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.decodeButton}
                        onPress={() => setShowDecodedOffer((current) => !current)}
                        activeOpacity={0.8}
                        testID="offer-details-decode-offer"
                      >
                        <FileText size={14} color={COLORS.white} />
                        <Text style={styles.decodeButtonText}>{showDecodedOffer ? 'Hide' : 'Decode'}</Text>
                      </TouchableOpacity>
                    </View>
                    {shouldBookResult ? (
                      <>
                        <TouchableOpacity
                          style={styles.shouldBookButton}
                          onPress={() => setShowBookDecision((current) => !current)}
                          activeOpacity={0.8}
                          testID="offer-details-should-i-book"
                        >
                          <ClipboardCheck size={16} color="#FFFFFF" />
                          <View style={styles.shouldBookButtonCopy}>
                            <Text style={styles.shouldBookButtonTitle}>Should I Book?</Text>
                            <Text style={styles.shouldBookButtonSubtitle}>{shouldBookResult.verdictLabel} · {shouldBookResult.score}/100 · {shouldBookResult.confidence} confidence</Text>
                          </View>
                          <ChevronRight size={17} color="#FFFFFF" />
                        </TouchableOpacity>
                        {showBookDecision ? (
                          <View style={styles.shouldBookPanel} testID="should-i-book-transparent-breakdown">
                            <Text style={styles.shouldBookHeadline}>{shouldBookResult.headline}</Text>
                            {bookTimingResult ? <View style={styles.shouldBookFactor}><View style={styles.shouldBookFactorTop}><Text style={styles.shouldBookFactorLabel}>Book now or wait?</Text><Text style={styles.shouldBookFactorScore}>{bookTimingResult.recommendation.replaceAll('_', ' ').toUpperCase()}</Text></View>{bookTimingResult.reasons.map((reason)=><Text key={reason} style={styles.shouldBookFactorExplanation}>• {reason}</Text>)}{bookTimingResult.missingEvidence.length?<Text style={styles.shouldBookFactorExplanation}>Could change this: {bookTimingResult.missingEvidence.join(', ')}</Text>:null}</View> : null}
                            <View style={styles.shouldBookMetricRow}>
                              <View style={styles.shouldBookMetric}><Text style={styles.shouldBookMetricLabel}>Casino value</Text><Text style={styles.shouldBookMetricValue}>{formatCurrency(shouldBookResult.estimatedCasinoValue)}</Text></View>
                              <View style={styles.shouldBookMetric}><Text style={styles.shouldBookMetricLabel}>Cash cost</Text><Text style={styles.shouldBookMetricValue}>{formatCurrency(shouldBookResult.estimatedCashCost)}</Text></View>
                              <View style={styles.shouldBookMetric}><Text style={styles.shouldBookMetricLabel}>Net value</Text><Text style={styles.shouldBookMetricValue}>{formatCurrency(shouldBookResult.estimatedNetVacationValue)}</Text></View>
                            </View>
                            {shouldBookResult.factors.map((factor) => (
                              <View key={factor.id} style={styles.shouldBookFactor}>
                                <View style={styles.shouldBookFactorTop}>
                                  <Text style={styles.shouldBookFactorLabel}>{factor.label}</Text>
                                  <Text style={styles.shouldBookFactorScore}>{factor.score}/{factor.maxScore}</Text>
                                </View>
                                <Text style={styles.shouldBookFactorExplanation}>{factor.explanation}</Text>
                              </View>
                            ))}
                            <View style={styles.shouldBookVerifyBox}>
                              <AlertTriangle size={15} color="#92400E" />
                              <View style={styles.shouldBookVerifyCopy}>
                                <Text style={styles.shouldBookVerifyTitle}>Verify before booking</Text>
                                {shouldBookResult.verifyBeforeBooking.map((item) => <Text key={item} style={styles.shouldBookVerifyText}>• {item}</Text>)}
                              </View>
                            </View>
                            <Text style={styles.shouldBookDisclaimer}>{shouldBookResult.disclaimer}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                    {showDecodedOffer && decodedOffer ? (
                      <View style={styles.decodedPanel}>
                        {decodedOffer.bullets.map((bullet, index) => (
                          <View key={`${bullet}-${index}`} style={styles.decodedBulletRow}>
                            <Calculator size={14} color="#0F766E" />
                            <Text style={styles.decodedBulletText}>{bullet}</Text>
                          </View>
                        ))}
                        <Text style={styles.decodedDisclaimer}>{decodedOffer.disclaimer}</Text>
                      </View>
                    ) : null}
                    </> : null}
                  </View>
                ) : null}

                {certificateStackingNotes.length > 0 ? (
                  <View style={styles.stackingPanel} testID="certificate-stacking-notes">
                    <View style={styles.stackingHeaderRow}>
                      <Layers size={15} color={COLORS.navyDeep} />
                      <Text style={styles.stackingTitle}>Certificate Notes</Text>
                    </View>
                    {certificateStackingNotes.map((note) => (
                      <View key={note.certificateId} style={styles.stackingItem}>
                        <Text style={styles.stackingLabel}>{note.label}</Text>
                        <Text style={styles.stackingAction} numberOfLines={2}>{note.recommendedAction}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.certificateLookupButton}
                  onPress={() => router.push({ pathname: '/certificate-lookup', params: { query: '' } })}
                  activeOpacity={0.8}
                  testID="offer-details-view-certificates"
                >
                  <FileText size={16} color="#FFFFFF" />
                  <View style={styles.certificateLookupCopy}>
                    <Text style={styles.certificateLookupTitle}>View this month’s certificates</Text>
                    <Text style={styles.certificateLookupSubtitle}>Download every current A/C certificate or open one official PDF</Text>
                  </View>
                  <ChevronRight size={17} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.sortSection}>
                <View style={styles.searchFilterRow}>
                  <View style={styles.offerSearchBox} testID="offer-cruise-filter-box">
                    <Search size={17} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.offerSearchInput}
                      value={cruiseSearchText}
                      onChangeText={setCruiseSearchText}
                      placeholder="Ship, itinerary, date, or port"
                      placeholderTextColor={COLORS.textSecondary}
                      autoCorrect={false}
                      clearButtonMode="while-editing"
                      testID="offer-cruise-filter-input"
                    />
                    {cruiseSearchText.trim() ? (
                      <TouchableOpacity onPress={() => setCruiseSearchText('')} activeOpacity={0.7} testID="offer-cruise-filter-clear">
                        <X size={17} color={COLORS.navyDeep} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.openFilterButton, activeSailingFilterCount > 0 && styles.openFilterButtonActive]}
                    onPress={() => setShowFilterSheet(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open sailing filters${activeSailingFilterCount ? `, ${activeSailingFilterCount} active` : ''}`}
                    testID="offer-open-filter-sheet"
                  >
                    <SlidersHorizontal size={18} color={activeSailingFilterCount > 0 ? '#FFFFFF' : COLORS.navyDeep} />
                    {activeSailingFilterCount > 0 ? <Text style={styles.openFilterCount}>{activeSailingFilterCount}</Text> : null}
                  </TouchableOpacity>
                </View>
                <Text style={styles.filteredCountText} testID="offer-filtered-count">
                  {activeSailingFilterCount > 0 || cruiseSearchText.trim()
                    ? `${displayedOfferCruises.length.toLocaleString()} matching of ${eligibleRowsLoaded.toLocaleString()} eligible sailings`
                    : `${eligibleRowsLoaded.toLocaleString()} eligible sailings · showing up to 20 on this page`}
                </Text>
                {offerVisiblePageCount > 1 ? (
                  <View style={styles.offerPageControls} testID="offer-sailing-page-controls-top">
                    <TouchableOpacity
                      style={[styles.offerPageButton, offerVisiblePage === 0 && styles.offerPageButtonDisabled]}
                      disabled={offerVisiblePage === 0}
                      onPress={() => goToOfferVisiblePage(offerVisiblePage - 1)}
                      accessibilityLabel="Previous 20 eligible sailings"
                    >
                      <ChevronLeft size={16} color={offerVisiblePage === 0 ? COLORS.textSecondary : COLORS.navyDeep} />
                      <Text style={[styles.offerPageButtonText, offerVisiblePage === 0 && styles.offerPageButtonTextDisabled]}>Previous</Text>
                    </TouchableOpacity>
                    <Text style={styles.offerPageLabel}>Page {(offerVisiblePage + 1).toLocaleString()} of {offerVisiblePageCount.toLocaleString()} · up to 20 cruises</Text>
                    <TouchableOpacity
                      style={[styles.offerPageButton, offerVisiblePage >= offerVisiblePageCount - 1 && styles.offerPageButtonDisabled]}
                      disabled={offerVisiblePage >= offerVisiblePageCount - 1}
                      onPress={() => goToOfferVisiblePage(offerVisiblePage + 1)}
                      accessibilityLabel="Next 20 eligible sailings"
                    >
                      <Text style={[styles.offerPageButtonText, offerVisiblePage >= offerVisiblePageCount - 1 && styles.offerPageButtonTextDisabled]}>Next</Text>
                      <ChevronRight size={16} color={offerVisiblePage >= offerVisiblePageCount - 1 ? COLORS.textSecondary : COLORS.navyDeep} />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {(activeSailingFilterCount > 0 || cruiseSearchText.trim()) ? (
                  <TouchableOpacity style={styles.clearAllInline} onPress={clearSailingFilters} testID="offer-clear-all-filters">
                    <RotateCcw size={13} color="#0F766E" />
                    <Text style={styles.clearAllInlineText}>Clear all filters</Text>
                  </TouchableOpacity>
                ) : null}
                {offerListStatusText ? (
                  <Text style={styles.offerListStatusText} testID="offer-list-load-status">{offerListStatusText}</Text>
                ) : null}
                {offerListError ? (
                  <View style={styles.offerListErrorCard} testID="offer-list-load-error">
                    <AlertCircle size={16} color="#991B1B" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerListErrorTitle}>Eligible sailings need another read</Text>
                      <Text style={styles.offerListErrorText}>{offerListError}</Text>
                    </View>
                    <TouchableOpacity style={styles.offerListRetryButton} onPress={retryOfferSailingLoad} testID="offer-list-retry">
                      <RefreshCcw size={14} color="#FFFFFF" />
                      <Text style={styles.offerListRetryText}>Reload sailings</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <Text style={styles.sortLabel} testID="offer-sort-label">Sort by:</Text>
                <View style={styles.sortRowCentered}>
                  <TouchableOpacity
                    style={[styles.sortPillMain, sortBy === 'soonest' && styles.sortPillMainActive]}
                    onPress={() => setSortBy('soonest')}
                    activeOpacity={0.7}
                    testID="sort-soonest"
                  >
                    <Text style={[styles.sortPillMainText, sortBy === 'soonest' && styles.sortPillMainTextActive]}>Soonest expiring</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortPillMain, sortBy === 'highest-value' && styles.sortPillMainActive]}
                    onPress={() => setSortBy('highest-value')}
                    activeOpacity={0.7}
                    testID="sort-highest-value"
                  >
                    <Text style={[styles.sortPillMainText, sortBy === 'highest-value' && styles.sortPillMainTextActive]}>Highest value</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortPillMain, sortBy === 'lowest-price' && styles.sortPillMainActive]}
                    onPress={() => setSortBy('lowest-price')}
                    activeOpacity={0.7}
                    testID="sort-lowest-price"
                  >
                    <Text style={[styles.sortPillMainText, sortBy === 'lowest-price' && styles.sortPillMainTextActive]}>Lowest price</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortPillMain, sortBy === 'longest' && styles.sortPillMainActive]}
                    onPress={() => setSortBy('longest')}
                    activeOpacity={0.7}
                    testID="sort-longest"
                  >
                    <Text style={[styles.sortPillMainText, sortBy === 'longest' && styles.sortPillMainTextActive]}>Longest</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortPillMain, sortBy === 'shortest' && styles.sortPillMainActive]}
                    onPress={() => setSortBy('shortest')}
                    activeOpacity={0.7}
                    testID="sort-shortest"
                  >
                    <Text style={[styles.sortPillMainText, sortBy === 'shortest' && styles.sortPillMainTextActive]}>Shortest</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {inventoryOfferLoading ? (
                <ActivityIndicator color={COLORS.navyDeep} />
              ) : (
                <Ship size={48} color={COLORS.textSecondary} />
              )}
              <Text style={styles.emptyText}>
                {inventoryOfferLoading
                  ? 'Loading cruises for this offer…'
                  : cruiseSearchText.trim() || activeSailingFilterCount > 0
                    ? 'No cruises match this filter'
                    : 'No cruises found for this offer'}
              </Text>
              {!inventoryOfferLoading && (cruiseSearchText.trim() || activeSailingFilterCount > 0) ? (
                <TouchableOpacity onPress={clearSailingFilters} activeOpacity={0.75} testID="offer-empty-clear-filter">
                  <Text style={styles.emptyActionText}>Clear all filters</Text>
                </TouchableOpacity>
              ) : null}
              {!inventoryOfferLoading && offerListError && !cruiseSearchText.trim() && activeSailingFilterCount === 0 ? (
                <TouchableOpacity onPress={retryOfferSailingLoad} activeOpacity={0.75} testID="offer-empty-retry">
                  <Text style={styles.emptyActionText}>Reload eligible sailings</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View style={styles.footerActionsContainer}>
              {offerVisiblePageCount > 1 ? (
                <View style={styles.offerPageControls} testID="offer-sailing-page-controls-bottom">
                  <TouchableOpacity style={[styles.offerPageButton, offerVisiblePage === 0 && styles.offerPageButtonDisabled]} disabled={offerVisiblePage === 0} onPress={() => goToOfferVisiblePage(offerVisiblePage - 1)}>
                    <ChevronLeft size={16} color={offerVisiblePage === 0 ? COLORS.textSecondary : COLORS.navyDeep} />
                    <Text style={[styles.offerPageButtonText, offerVisiblePage === 0 && styles.offerPageButtonTextDisabled]}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={styles.offerPageLabel}>{(offerVisiblePage * OFFER_VISIBLE_PAGE_SIZE + 1).toLocaleString()}–{Math.min((offerVisiblePage + 1) * OFFER_VISIBLE_PAGE_SIZE, displayedOfferCruises.length).toLocaleString()} of {displayedOfferCruises.length.toLocaleString()}</Text>
                  <TouchableOpacity style={[styles.offerPageButton, offerVisiblePage >= offerVisiblePageCount - 1 && styles.offerPageButtonDisabled]} disabled={offerVisiblePage >= offerVisiblePageCount - 1} onPress={() => goToOfferVisiblePage(offerVisiblePage + 1)}>
                    <Text style={[styles.offerPageButtonText, offerVisiblePage >= offerVisiblePageCount - 1 && styles.offerPageButtonTextDisabled]}>Next</Text>
                    <ChevronRight size={16} color={offerVisiblePage >= offerVisiblePageCount - 1 ? COLORS.textSecondary : COLORS.navyDeep} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {inventoryOfferLoading ? <ActivityIndicator color={COLORS.navyDeep} /> : null}
              {offerInfo.offerCode && offerData.offer && offerData.offer.status !== 'used' && offerData.offer.status !== 'booked' ? (
                <View style={styles.statusActionsRow}>
                  <TouchableOpacity
                    style={styles.statusActionButton}
                    onPress={handleMarkAsInProgress}
                    activeOpacity={0.7}
                    testID="offer-mark-in-progress"
                  >
                    <Archive size={16} color={COLORS.white} />
                    <Text style={styles.statusActionText}>Mark In Progress</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusActionButton, styles.statusActionButtonUsed]}
                    onPress={handleMarkAsUsed}
                    activeOpacity={0.7}
                    testID="offer-mark-used"
                  >
                    <Ban size={16} color={COLORS.white} />
                    <Text style={styles.statusActionText}>Mark as Used</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          }
        />

        <Modal
          visible={showFilterSheet}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowFilterSheet(false)}
        >
          <SafeAreaView style={styles.filterSheetSafeArea} edges={['top', 'bottom']}>
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetEyebrow}>ELIGIBLE SAILINGS</Text>
                <Text style={styles.filterSheetTitle}>Filter cruises</Text>
              </View>
              <TouchableOpacity style={styles.filterSheetClose} onPress={() => setShowFilterSheet(false)} accessibilityLabel="Close filters" testID="offer-close-filter-sheet">
                <X size={21} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.filterSheetContent} keyboardShouldPersistTaps="handled">
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Ship</Text>
                <View style={styles.filterChoicesWrap}>{filterFacets.ships.map((value) => <SailingFilterChip key={value} label={value} selected={sailingFilters.ships.includes(value)} onPress={() => toggleSailingStringFilter('ships', value)} />)}</View>
              </View>

              {filterFacets.shipClasses.length > 0 ? (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Ship class</Text>
                  <View style={styles.filterChoicesWrap}>{filterFacets.shipClasses.map((value) => <SailingFilterChip key={value} label={value} selected={sailingFilters.shipClasses.includes(value)} onPress={() => toggleSailingStringFilter('shipClasses', value)} />)}</View>
                </View>
              ) : null}

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Stateroom entitlement</Text>
                <View style={styles.filterChoicesWrap}>{filterFacets.cabins.map((value) => <SailingFilterChip key={value} label={value} selected={sailingFilters.cabins.includes(value)} onPress={() => toggleSailingStringFilter('cabins', value)} />)}</View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Guest eligibility</Text>
                <View style={styles.filterChoicesWrap}>{filterFacets.guestCounts.map((value) => <SailingFilterChip key={value} label={`${value} guest${value === 1 ? '' : 's'}`} selected={sailingFilters.guestCounts.includes(value)} onPress={() => toggleSailingGuestFilter(value)} />)}</View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Departure port</Text>
                <View style={styles.filterChoicesWrap}>{filterFacets.departurePorts.map((value) => <SailingFilterChip key={value} label={value} selected={sailingFilters.departurePorts.includes(value)} onPress={() => toggleSailingStringFilter('departurePorts', value)} />)}</View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sailing dates</Text>
                <View style={styles.filterInputRow}>
                  <View style={styles.filterInputGroup}><Text style={styles.filterInputLabel}>From</Text><TextInput value={sailingFilters.dateFrom} onChangeText={(dateFrom) => setSailingFilters((current) => ({ ...current, dateFrom }))} placeholder="YYYY-MM-DD" autoCapitalize="none" style={styles.filterTextInput} testID="offer-filter-date-from" /></View>
                  <View style={styles.filterInputGroup}><Text style={styles.filterInputLabel}>To</Text><TextInput value={sailingFilters.dateTo} onChangeText={(dateTo) => setSailingFilters((current) => ({ ...current, dateTo }))} placeholder="YYYY-MM-DD" autoCapitalize="none" style={styles.filterTextInput} testID="offer-filter-date-to" /></View>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Cruise length</Text>
                <View style={styles.filterInputRow}>
                  <View style={styles.filterInputGroup}><Text style={styles.filterInputLabel}>Minimum nights</Text><TextInput value={sailingFilters.minNights} onChangeText={(minNights) => setSailingFilters((current) => ({ ...current, minNights }))} keyboardType="number-pad" placeholder="Any" style={styles.filterTextInput} testID="offer-filter-min-nights" /></View>
                  <View style={styles.filterInputGroup}><Text style={styles.filterInputLabel}>Maximum nights</Text><TextInput value={sailingFilters.maxNights} onChangeText={(maxNights) => setSailingFilters((current) => ({ ...current, maxNights }))} keyboardType="number-pad" placeholder="Any" style={styles.filterTextInput} testID="offer-filter-max-nights" /></View>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Guarantee stateroom</Text>
                <View style={styles.filterChoicesWrap}>{(['all', 'yes', 'no'] as ToggleFilterMode[]).map((value) => <SailingFilterChip key={value} label={value === 'all' ? 'Any' : value === 'yes' ? 'GTY only' : 'Assigned only'} selected={sailingFilters.gty === value} onPress={() => setSailingFilters((current) => ({ ...current, gty: value }))} testID={`offer-filter-gty-${value}`} />)}</View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>NextCruise bonus</Text>
                <View style={styles.filterChoicesWrap}>{(['all', 'yes', 'no'] as ToggleFilterMode[]).map((value) => <SailingFilterChip key={value} label={value === 'all' ? 'Any' : value === 'yes' ? 'Bonus included' : 'No bonus shown'} selected={sailingFilters.nextCruiseBonus === value} onPress={() => setSailingFilters((current) => ({ ...current, nextCruiseBonus: value }))} testID={`offer-filter-nextcruise-${value}`} />)}</View>
              </View>

              <Text style={styles.filterHelpText}>Use the search field on the offer page for itinerary, region, ports, or exact dates. Missing provider values remain “not stated” and are never guessed.</Text>
            </ScrollView>

            <View style={styles.filterSheetActions}>
              <TouchableOpacity style={styles.filterResetButton} onPress={clearSailingFilters} testID="offer-filter-reset">
                <RotateCcw size={16} color={COLORS.navyDeep} />
                <Text style={styles.filterResetText}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyButton} onPress={() => setShowFilterSheet(false)} testID="offer-filter-apply">
                <Text style={styles.filterApplyText}>Show {displayedOfferCruises.length.toLocaleString()} cruises</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const THEME = {
  background: '#F6F2EA',
  cardBg: '#FFFDF9',
  headerText: COLORS.navyDeep,
  textWhite: '#FFFFFF',
  textMuted: COLORS.textDarkGrey,
  borderColor: COLORS.borderLight,
  success: COLORS.success,
  moneyGreen: COLORS.money,
  pointsTeal: COLORS.points,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  safeArea: {
    flex: 1,
  },
  mergedHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#FFFDF9',
    ...SHADOW.sm,
  },
  compactHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  compactOfferLogo: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },
  compactOfferTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  compactCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredOfferSection: {
    alignItems: 'center',
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  offerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  offerLogoGroup: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  offerLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },

  featuredOfferName: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textAlign: 'left' as const,
  },
  totalValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(22, 101, 52, 0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOW.sm,
  },
  totalValueLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#166534',
    opacity: 0.8,
  },
  totalValueAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#166534',
  },
  offerCodeBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  offerCodeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 0.8,
  },
  statusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0EA5E9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  statusMiniBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  compactMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  compactMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  compactMetricPillMoney: {
    backgroundColor: '#F8FAFB',
    borderColor: '#D9E1E6',
  },
  compactMetricLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    opacity: 0.65,
  },
  compactMetricValue: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  compactMetricValueMoney: {
    color: '#17324D',
  },
  entitlementTruthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  entitlementTruthItem: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 62,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#FFFDF9',
  },
  entitlementTruthLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.7,
    color: '#167C80',
  },
  entitlementTruthValue: {
    marginTop: 3,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 13,
    lineHeight: 16,
    color: '#17324D',
  },
  entitlementTruthSource: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 12,
    color: '#66737F',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statItemHighlight: {
    backgroundColor: 'rgba(22, 101, 52, 0.08)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statTextGroup: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  statValueWarning: {
    color: COLORS.warning,
  },
  statValueMoney: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#166534',
  },
  sortSection: {
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
  },
  offerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.14)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.xs,
    ...SHADOW.sm,
  },
  openFilterButton: {
    width: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.18)',
    backgroundColor: '#FFFFFF',
    marginBottom: SPACING.xs,
    ...SHADOW.sm,
  },
  openFilterButtonActive: {
    backgroundColor: '#17324D',
    borderColor: '#17324D',
  },
  openFilterCount: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    textAlign: 'center',
    color: '#17324D',
    backgroundColor: '#E6B63D',
    fontSize: 10,
    lineHeight: 17,
    fontWeight: '900' as const,
  },
  offerSearchInput: {
    flex: 1,
    minWidth: 0,
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    paddingVertical: 0,
  },
  filteredCountText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginLeft: 2,
    marginBottom: SPACING.xs,
  },
  clearAllInline: {
    minHeight: 34,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.xs,
  },
  clearAllInlineText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '800' as const,
  },
  offerListStatusText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginLeft: 2,
    marginBottom: SPACING.xs,
  },
  offerListErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F2B8B5',
    backgroundColor: '#FFF1F0',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  offerListErrorTitle: { color: '#7F1D1D', fontSize: 12, fontWeight: '900' as const },
  offerListErrorText: { color: '#7F1D1D', fontSize: 10, lineHeight: 14, marginTop: 2 },
  offerListRetryButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38, borderRadius: 12, paddingHorizontal: 11, backgroundColor: COLORS.navyDeep },
  offerListRetryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' as const },
  sortRowCentered: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sortPillMain: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  sortPillMainActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  sortPillMainText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  sortPillMainTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sortLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginLeft: 2,
  },
  filterSheetSafeArea: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  filterSheetHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D9E1E6',
  },
  filterSheetEyebrow: {
    color: '#167C80',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900' as const,
    letterSpacing: 1.2,
  },
  filterSheetTitle: {
    color: '#17324D',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800' as const,
  },
  filterSheetClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3F5',
  },
  filterSheetContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
    gap: SPACING.md,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  filterSectionTitle: {
    color: '#17324D',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800' as const,
    marginBottom: SPACING.sm,
  },
  filterChoicesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  filterChoiceChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#C8D3D9',
    backgroundColor: '#FFFFFF',
  },
  filterChoiceChipSelected: {
    backgroundColor: '#17324D',
    borderColor: '#17324D',
  },
  filterChoiceText: {
    color: '#334B5F',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700' as const,
  },
  filterChoiceTextSelected: {
    color: '#FFFFFF',
  },
  filterInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterInputGroup: {
    flex: 1,
    minWidth: 0,
  },
  filterInputLabel: {
    color: '#526776',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    marginBottom: 5,
  },
  filterTextInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#C8D3D9',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FFFFFF',
    color: '#17324D',
    fontSize: 14,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  filterHelpText: {
    color: '#526776',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: SPACING.xs,
  },
  filterSheetActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D9E1E6',
  },
  filterResetButton: {
    minHeight: 50,
    minWidth: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#C8D3D9',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
  },
  filterResetText: {
    color: '#17324D',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  filterApplyButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#17324D',
    paddingHorizontal: SPACING.md,
  },
  filterApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900' as const,
    textAlign: 'center',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 28,
  },
  offerPageControls: {
    minHeight: 48,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: '#F8FBFD',
  },
  offerPageButton: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  offerPageButtonDisabled: { opacity: 0.5 },
  offerPageButtonText: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '800' as const },
  offerPageButtonTextDisabled: { color: COLORS.textSecondary },
  offerPageLabel: { flex: 1, color: COLORS.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700' as const, textAlign: 'center' },
  cruiseCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 0,
    ...SHADOW.lg,
  },
  bookedCard: {
    borderColor: COLORS.success,
    borderWidth: 3,
  },
  cruiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  shipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  shipName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: THEME.textWhite,
    flex: 1,
  },
  cruiseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  bookedBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: THEME.textWhite,
  },
  destination: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.points,
    marginBottom: SPACING.sm,
  },
  cruiseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: THEME.textMuted,
  },
  daysAway: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: THEME.textMuted,
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: -SPACING.md,
    marginTop: -SPACING.md,
    marginBottom: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    gap: SPACING.xs,
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.04)',
    borderRadius: BORDER_RADIUS.sm,
    gap: 2,
  },
  summaryStatBoxMoney: {
    backgroundColor: 'rgba(22, 101, 52, 0.08)',
  },
  summaryStatValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  summaryStatValueMoney: {
    color: '#166534',
  },
  summaryStatLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
    opacity: 0.6,
    textAlign: 'center' as const,
  },
  cardHeaderWhite: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  shipNameNavy: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    flex: 1,
  },
  bookedBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  bookedBadgeTextInline: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  chevronRight: {
    marginLeft: SPACING.xs,
  },
  headerLine2: {
    marginBottom: SPACING.xs,
  },
  offerCardItinerary: {
    color: COLORS.navyDeep,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  offerCardOperationalTruth: {
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#99D5D7',
    backgroundColor: '#EFFBFB',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    marginBottom: SPACING.sm,
  },
  offerCardOperationalTruthText: {
    color: '#0F666A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700' as const,
  },
  offerCardMissingItinerary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#F5D08A',
    backgroundColor: '#FFF8E8',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    marginBottom: SPACING.sm,
  },
  offerCardMissingItineraryText: {
    flex: 1,
    color: '#7C4A03',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600' as const,
  },
  shipClassText: {
    color: '#167C80',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800' as const,
    marginTop: 3,
  },
  cabinGuestRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap' as const,
  },
  cabinBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cabinBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1E40AF',
  },
  guestBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  guestBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#7C3AED',
  },
  bonusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E6B63D',
  },
  bonusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#8A5A00',
  },
  nightsDestinationText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  headerLine3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  headerDetailBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerDetailLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  headerDetailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  daysAwayNavy: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginTop: SPACING.xs,
  },
  pricingMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    marginHorizontal: -SPACING.md,
    marginBottom: -SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomLeftRadius: BORDER_RADIUS.lg,
    borderBottomRightRadius: BORDER_RADIUS.lg,
  },
  pricingMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pricingMiniLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  pricingMiniValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  coverageBadge: {
    marginLeft: 'auto',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  coverageText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#166534',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  emptyActionText: {
    marginTop: SPACING.sm,
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  fpObcRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  fpBadgeOffer: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    paddingVertical: 7,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
  },
  fpLabelOffer: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#15803D',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  fpValueOffer: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#15803D',
  },
  obcBadgeOffer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    paddingVertical: 7,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignItems: 'center',
  },
  obcLabelOffer: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#1E40AF',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  obcValueOffer: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#1E40AF',
  },
  intelligencePanel: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.16)',
  },
  intelligenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  intelligenceScoreBadge: {
    width: 46,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intelligenceScoreText: {
    fontSize: 17,
    fontWeight: '900' as const,
    color: '#0F766E',
    marginTop: 1,
  },
  intelligenceCopy: {
    flex: 1,
  },
  intelligenceTitle: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  intelligenceSubtitle: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#0F766E',
    marginTop: 1,
  },
  intelligenceExplanation: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
    marginTop: 2,
  },
  intelligenceBottomRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  calculatorGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  calculatorCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  calculatorLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#64748B',
    marginBottom: 2,
  },
  calculatorValue: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  decodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
  },
  decodeButtonText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  shouldBookButton: {
    marginTop: SPACING.sm,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#0F766E',
  },
  shouldBookButtonCopy: {
    flex: 1,
  },
  shouldBookButtonTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
  },
  shouldBookButtonSubtitle: {
    marginTop: 1,
    color: '#CCFBF1',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  shouldBookPanel: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shouldBookHeadline: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
    lineHeight: 20,
  },
  shouldBookMetricRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  shouldBookMetric: {
    flex: 1,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#ECFDF5',
  },
  shouldBookMetricLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800' as const,
  },
  shouldBookMetricValue: {
    marginTop: 2,
    color: '#065F46',
    fontSize: 12,
    fontWeight: '900' as const,
  },
  shouldBookFactor: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
  },
  shouldBookFactorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shouldBookFactorLabel: {
    color: COLORS.navyDeep,
    fontSize: 11,
    fontWeight: '900' as const,
  },
  shouldBookFactorScore: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '900' as const,
  },
  shouldBookFactorExplanation: {
    marginTop: 2,
    color: '#475569',
    fontSize: 10,
    lineHeight: 15,
  },
  shouldBookVerifyBox: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#FEF3C7',
  },
  shouldBookVerifyCopy: {
    flex: 1,
  },
  shouldBookVerifyTitle: {
    color: '#78350F',
    fontSize: 11,
    fontWeight: '900' as const,
  },
  shouldBookVerifyText: {
    marginTop: 3,
    color: '#78350F',
    fontSize: 10,
    lineHeight: 14,
  },
  shouldBookDisclaimer: {
    marginTop: SPACING.sm,
    color: '#64748B',
    fontSize: 9,
    lineHeight: 14,
  },
  decodedPanel: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  decodedBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  decodedBulletText: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 18,
  },
  decodedDisclaimer: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: SPACING.xs,
  },
  stackingPanel: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 64, 175, 0.14)',
  },
  stackingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  stackingTitle: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  stackingItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  stackingLabel: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  stackingAction: {
    fontSize: 12,
    color: '#0F766E',
    lineHeight: 17,
    marginTop: 3,
  },
  stackingWarning: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
    marginTop: 3,
  },
  certificateLookupButton: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  certificateLookupCopy: {
    flex: 1,
  },
  certificateLookupTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900' as const,
  },
  certificateLookupSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  valueFormulaButton: { marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  valueFormulaButtonCopy: { flex: 1 },
  valueFormulaButtonTitle: { color: '#0F5132', fontSize: 13, fontWeight: '900' as const },
  valueFormulaButtonSub: { color: '#3D6657', fontSize: 11, lineHeight: 15, marginTop: 2 },
  valueFormulaPanel: { marginTop: SPACING.xs, backgroundColor: '#F8FFFC', borderWidth: 1, borderColor: '#BCE7D6', borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
  valueFormulaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  valueFormulaMetric: { flexGrow: 1, minWidth: '30%', backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: '#D8EEE5' },
  valueFormulaLabel: { color: '#60756C', fontSize: 10, fontWeight: '800' as const },
  valueFormulaValue: { color: '#0F5132', fontSize: 14, fontWeight: '900' as const, marginTop: 3 },
  valueFormulaText: { color: '#375B4D', fontSize: 11, lineHeight: 16, marginTop: 3 },
  valueFormulaMissing: { color: '#92400E', backgroundColor: '#FFF7ED', borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, fontSize: 11, lineHeight: 16, marginTop: SPACING.sm },
  footerActionsContainer: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  statusActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  statusActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: '#0EA5E9',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOW.sm,
  },
  statusActionButtonUsed: {
    backgroundColor: '#A52B34',
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  statusBadgeContainer: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#0EA5E9',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.round,
    ...SHADOW.sm,
  },
  statusBadgeUsed: {
    backgroundColor: '#A52B34',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
});
