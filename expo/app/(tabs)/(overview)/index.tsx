import React, { useState, useMemo, useCallback, useDeferredValue, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Image,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  Tag,
  AlertTriangle,
  Sparkles,
  Bot,
  Target,
  TrendingUp,
  TrendingDown,
  Ship,
  Calendar,
  Coins,
  Gauge,
  FileText,
  Calculator,
  Archive,
  CheckCircle,
  Clock,
  BookOpen,
  DatabaseZap,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';

import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { withAlpha } from '@/constants/loyaltyColors';
import { createLoyaltyCardTheme, getClubRoyaleTierColor } from '@/constants/loyaltyTheme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useAuth } from '@/state/AuthProvider';
import { usePriceTrackingSync } from '@/lib/usePriceTrackingSync';
import { useAlerts } from '@/state/AlertsProvider';
import { CompactDashboardHeader } from '@/components/CompactDashboardHeader';
import { CasinoCertificatesCard } from '@/components/CasinoCertificatesCard';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { ThemedSectionCard, ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { DataStateCard, FilterButton } from '@/components/ui/EasySeasPrimitives';
import { CertificateManagerModal } from '@/components/CertificateManagerModal';
import { useCertificates } from '@/state/CertificatesProvider';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { CasinoOfferCard, OfferSummaryCard } from '@/components/CasinoOfferCard';
import { AlertsManagerModal } from '@/components/AlertsManagerModal';
import { createDateFromString, getDaysUntil, isDateInPast, formatDate } from '@/lib/date';
import { isActiveBookedCruise } from '@/lib/bookedCruiseStatus';
import { CertificateExplorerModal } from '@/components/CertificateExplorerModal';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { getBookedCruiseCasinoPoints, getBookedCruiseWinningsBroughtHome } from '@/lib/casinoPointTruth';
import { useExperience } from '@/state/ExperienceProvider';

import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { normalizeOfferValue } from '@/lib/offers/offerValueNormalization';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { getCruiseOfferInstanceKey } from '@/lib/cruiseInventory/cruiseCanonicalIdentity';
import { buildOfferDetailsParams, getMarketingOfferInstanceKey } from '@/lib/offers/offerInstanceIdentity';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';

const OFFERS_HERO_IMAGE = require('../../../assets/images/easyseas-scott-astin-logo.jpeg');
import { formatCurrency } from '@/lib/format';
import {
  buildCommandCenterBuckets,
  calculateOfferIntelligenceScore,
  decodeOffer,
  getOfferDisplayCode,
  type DecodedOffer,
  type CommandCenterBucket,
  type CommandCenterOffer,
} from '@/lib/offerIntelligence';

function AnimatedEmptyState({ onImportPress }: { onImportPress: () => void }) {
  return (
    <DataStateCard
      kind="empty"
      title="No offers are stored"
      reason="Import or sync offer data to populate offers and their eligible sailings. This is an empty repository, not a confirmed zero from Club Royale."
      actionLabel="Open Data Import"
      onAction={onImportPress}
      testID="offers-empty-state"
    />
  );
}

interface CasinoOfferCardData {
  id: string;
  offerCode: string;
  offerName: string;
  expiryDate?: string;
  tradeInValue?: number;
  freePlay?: number;
  obc?: number;
  perks?: string[];
  representativeOffer?: CasinoOffer;
  cruises: Cruise[];
}

const EMPTY_CRUISES: Cruise[] = [];
const EMPTY_BOOKED_CRUISES: BookedCruise[] = [];
const EMPTY_CASINO_OFFERS: CasinoOffer[] = [];
// Full offer cards intentionally preserve every decision field and action. Keep
// the first page short enough that certificates, activity, and Agent SEA remain
// reachable in a normal phone-length scroll; additional offers remain available
// in deterministic batches.
const OFFER_PAGE_SIZE = 3;

type OfferExpiryFilter = 'all' | '30-days' | 'no-expiry';
type OfferCabinFilter = 'all' | 'Interior' | 'Ocean View' | 'Balcony' | 'Suite';
type OfferGuestFilter = 'all' | '1' | '2';
type OfferSourceFilter = 'all' | 'synced' | 'imported' | 'manual';

interface OfferFilterState {
  expiry: OfferExpiryFilter;
  cabin: OfferCabinFilter;
  guests: OfferGuestFilter;
  minimumValue: string;
  source: OfferSourceFilter;
}

const DEFAULT_OFFER_FILTERS: OfferFilterState = {
  expiry: 'all',
  cabin: 'all',
  guests: 'all',
  minimumValue: '',
  source: 'all',
};

function normalizeOfferKey(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function getOfferLookupKey(offer: CasinoOffer): string {
  return getMarketingOfferInstanceKey(offer);
}

function isCertificateDocumentOfferLeak(offer: CasinoOffer): boolean {
  const record = offer as unknown as Record<string, unknown>;
  const sourceText = [
    record.documentKind,
    record.certificateFamily,
    record.certificateCode,
    record.provenance,
    record.sourceType,
    record.importSource,
    record.offerSource,
    offer.offerName,
    offer.title,
  ].map((value) => String(value ?? '').toLowerCase()).join(' ');
  const code = normalizeOfferKey(offer.offerCode);
  const hasCertificateMarker = sourceText.includes('certificate') || Boolean(record.certificateCode || record.certificateFamily);
  const hasNoCasinoOfferIdentity = !String(offer.playerOfferId || offer.offerInstanceId || offer.carnivalOfferId || '').trim();
  const looksLikeMonthlyCertificateCode = /^\d{4}[AC][A-Z0-9]{0,3}$/.test(code);
  return hasCertificateMarker && hasNoCasinoOfferIdentity && looksLikeMonthlyCertificateCode;
}

function getCruiseOfferLookupKey(cruise: Cruise | BookedCruise): string {
  const instanceId = String(cruise.playerOfferId || cruise.offerInstanceId || '').trim().toLowerCase();
  if (instanceId) return `instance:${instanceId}`;
  const code = normalizeOfferKey(cruise.offerCode);
  return code ? `code:${code}` : '';
}

function getOfferExpiryDate(offer: CasinoOffer): string | undefined {
  return offer.expiryDate || offer.expires || offer.offerExpiryDate || undefined;
}

function isOfferLinkedCruiseInProgress(cruise: BookedCruise, today: Date): boolean {
  if (cruise.completionState === 'in-progress') {
    return true;
  }

  if (!cruise.sailDate || !cruise.returnDate) {
    return false;
  }

  try {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    sailDate.setHours(0, 0, 0, 0);
    returnDate.setHours(0, 0, 0, 0);
    return today >= sailDate && today <= returnDate;
  } catch (error) {
    console.error('[Overview] Failed to evaluate in-progress cruise window:', error);
    return false;
  }
}

function OverviewScreenContent() {
  const router = useRouter();
  const { colors: experienceColors, minimumControlSize, motionDuration, preferences } = useExperience();
  const { cruises, cruiseInventoryCount, bookedCruises: allBookedCruises, casinoOffers, clubRoyaleProfile, updateCasinoOffer, refreshData, isLoading: coreDataLoading } = useCoreData();
  const { queryCruises, queryOfferSailings, queryOfferSailingSummary, totalCruises, totalSourceCruises, totalPhysicalSailings, isInventoryReady, refreshCounts, refreshFacets } = useCruiseInventory();
  const { currentUser, users } = useUser();
  const { clubRoyaleTier: effectiveClubRoyaleTier } = useLoyalty();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const { logout } = useAuth();
  const { summary } = useAlerts();
  
  usePriceTrackingSync();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showCertificateExplorerModal, setShowCertificateExplorerModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [offerFiltersOpen, setOfferFiltersOpen] = useState(false);
  const [offerFilters, setOfferFilters] = useState<OfferFilterState>(DEFAULT_OFFER_FILTERS);
  const [decodedOffer, setDecodedOffer] = useState<DecodedOffer | null>(null);
  const [catalogPreviewRows, setCatalogPreviewRows] = useState<Cruise[]>([]);
  const [offerSailingCounts, setOfferSailingCounts] = useState<Record<string, number>>({});
  const [offerSailingSummaries, setOfferSailingSummaries] = useState<Record<string, Awaited<ReturnType<typeof queryOfferSailingSummary>>>>({});
  const [visibleOfferCount, setVisibleOfferCount] = useState(OFFER_PAGE_SIZE);
  const { 
    certificates, 
    addCertificate, 
    updateCertificate, 
    deleteCertificate,
    getCertificatesByType,
  } = useCertificates();

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  // A CoreData hydration/sync can publish several thousand cruise records at
  // once. Keep tab presses urgent and let React prepare the expensive offer
  // grouping/list model as deferred work after the visible navigation commit.
  const deferredCruises = useDeferredValue(cruises, EMPTY_CRUISES);
  const deferredBookedCruises = useDeferredValue(allBookedCruises, EMPTY_BOOKED_CRUISES);
  const deferredCasinoOffers = useDeferredValue(casinoOffers, EMPTY_CASINO_OFFERS);

  useEffect(() => {
    if (!isInventoryReady || totalCruises === 0 || cruises.length > 0) return;
    let cancelled = false;
    void queryCruises({ limit: 200 }).then((page) => {
      if (!cancelled) setCatalogPreviewRows(page.rows);
    }).catch((error) => {
      console.warn('[Overview] Bounded catalog preview failed without blocking offers:', error);
    });
    return () => { cancelled = true; };
  }, [cruises.length, isInventoryReady, queryCruises, totalCruises]);

  const cruisesData = useMemo(() => filterRecordsByIntelligence(
    deferredCruises.length > 0 ? deferredCruises : catalogPreviewRows,
    intelligenceFilterSnapshot,
    users,
  ), [catalogPreviewRows, deferredCruises, intelligenceFilterSnapshot, users]);

  const offersData = useMemo(() => filterRecordsByIntelligence(deferredCasinoOffers, intelligenceFilterSnapshot, users)
    .filter((offer) => !isCertificateDocumentOfferLeak(offer)), [deferredCasinoOffers, intelligenceFilterSnapshot, users]);

  const bookedCruises = useMemo(() => filterRecordsByIntelligence(deferredBookedCruises, intelligenceFilterSnapshot, users), [deferredBookedCruises, intelligenceFilterSnapshot, users]);

  const activeBookedCruises = useMemo(() => {
    return bookedCruises.filter((cruise: BookedCruise) => isActiveBookedCruise(cruise));
  }, [bookedCruises]);

  const bookedCruiseIds = useMemo(() => {
    return new Set(bookedCruises.map((b: BookedCruise) => b.id));
  }, [bookedCruises]);

  const inProgressOfferKeys = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const keys = new Set<string>();
    bookedCruises.forEach((cruise: BookedCruise) => {
      const offerKey = getCruiseOfferLookupKey(cruise);
      if (!offerKey) {
        return;
      }

      if (isOfferLinkedCruiseInProgress(cruise, today)) {
        keys.add(offerKey);
      }
    });

    if (__DEV__) console.log('[Overview] In-progress offer keys:', Array.from(keys));
    return keys;
  }, [bookedCruises]);

  const blockedOfferKeys = useMemo(() => {
    const keys = new Set<string>();

    offersData.forEach((offer: CasinoOffer) => {
      const lookupKey = getOfferLookupKey(offer);
      if (!lookupKey) {
        return;
      }

      const normalizedStatus = offer.status?.trim().toLowerCase();
      const normalizedArchiveStatus = offer.archiveStatus?.trim().toLowerCase();
      const hasBlockedStatus = normalizedStatus === 'used' || normalizedStatus === 'booked' || normalizedStatus === 'expired' || normalizedStatus === 'archived' || normalizedStatus === 'replaced' || normalizedStatus === 'skipped' || normalizedArchiveStatus === 'archived' || normalizedArchiveStatus === 'replaced';
      const instanceKey = getOfferLookupKey(offer);
      const legacyCodeKey = offer.offerCode ? `code:${normalizeOfferKey(offer.offerCode)}` : '';
      const isLinkedToInProgressCruise = inProgressOfferKeys.has(instanceKey)
        || (!String(offer.playerOfferId || offer.offerInstanceId || offer.carnivalOfferId || '').trim() && Boolean(legacyCodeKey) && inProgressOfferKeys.has(legacyCodeKey));

      if (hasBlockedStatus || isLinkedToInProgressCruise) {
        keys.add(lookupKey);
      }
    });

    if (__DEV__) console.log('[Overview] Blocked offer keys:', Array.from(keys));
    return keys;
  }, [offersData, inProgressOfferKeys]);

  const realActiveOffersCount = useMemo(() => {
    const activeKeys = new Set<string>();

    offersData.forEach((offer: CasinoOffer) => {
      const lookupKey = getOfferLookupKey(offer);
      if (!lookupKey || blockedOfferKeys.has(lookupKey)) {
        return;
      }

      const expiryDate = getOfferExpiryDate(offer);
      if (expiryDate && getDaysUntil(expiryDate) < 0) {
        return;
      }

      activeKeys.add(lookupKey);
    });

    if (__DEV__) console.log('[Overview] Real active offers count:', {
      totalOffers: offersData.length,
      blockedOffers: blockedOfferKeys.size,
      realActiveOffers: activeKeys.size,
    });

    return activeKeys.size;
  }, [offersData, blockedOfferKeys]);

  const groupedOffers = useMemo(() => {
    const offersMap = new Map<string, CasinoOfferCardData>();
    
    offersData.forEach((offer: CasinoOffer) => {
      const lookupKey = getOfferLookupKey(offer);
      if (!lookupKey || blockedOfferKeys.has(lookupKey)) {
        return;
      }

      const expiryDate = getOfferExpiryDate(offer);
      if (expiryDate && getDaysUntil(expiryDate) < 0) {
        return;
      }

      const key = lookupKey;
      const existing = offersMap.get(key);

      const rawName = (offer.offerName || offer.title || '').trim();
      const offerName = rawName.length > 0 ? rawName : 'Casino Offer';

      const tradeInValue =
        offer.tradeInValue ?? offer.value ?? offer.offerValue ?? offer.totalValue ?? undefined;

      const obc = offer.obcAmount ?? offer.OBC ?? undefined;

      if (!existing) {
        offersMap.set(key, {
          id: offer.id,
          offerCode: offer.offerCode || offer.id,
          offerName,
          expiryDate,
          tradeInValue,
          freePlay: offer.freePlay ?? offer.freeplayAmount ?? 0,
          obc,
          perks: offer.perks ?? [],
          representativeOffer: offer,
          cruises: [],
        });
        return;
      }

      const shouldUpgradeName = existing.offerName === 'Casino Offer' && offerName !== 'Casino Offer';
      const shouldUpgradeExpiry = !existing.expiryDate && !!expiryDate;
      const shouldUpgradeValue = existing.tradeInValue == null && tradeInValue != null;
      const shouldUpgradeOBC = existing.obc == null && obc != null;
      const shouldUpgradeFreePlay = (existing.freePlay ?? 0) === 0 && (offer.freePlay ?? offer.freeplayAmount ?? 0) > 0;
      const shouldUpgradePerks = (existing.perks?.length ?? 0) === 0 && (offer.perks?.length ?? 0) > 0;

      if (
        shouldUpgradeName ||
        shouldUpgradeExpiry ||
        shouldUpgradeValue ||
        shouldUpgradeOBC ||
        shouldUpgradeFreePlay ||
        shouldUpgradePerks
      ) {
        offersMap.set(key, {
          ...existing,
          offerName: shouldUpgradeName ? offerName : existing.offerName,
          expiryDate: shouldUpgradeExpiry ? expiryDate : existing.expiryDate,
          tradeInValue: shouldUpgradeValue ? tradeInValue : existing.tradeInValue,
          obc: shouldUpgradeOBC ? obc : existing.obc,
          freePlay: shouldUpgradeFreePlay ? (offer.freePlay ?? offer.freeplayAmount ?? 0) : existing.freePlay,
          perks: shouldUpgradePerks ? (offer.perks ?? []) : existing.perks,
          representativeOffer: existing.representativeOffer ?? offer,
        });
      }
    });

    const offerKeyByCruiseId = new Map<string, string>();
    const offerKeyByInstance = new Map<string, string>();
    const offerKeysByCode = new Map<string, string[]>();
    offersMap.forEach((card, key) => {
      const representative = card.representativeOffer;
      if (!representative) return;
      [representative.cruiseId, ...(representative.cruiseIds ?? [])]
        .filter((id): id is string => Boolean(id))
        .forEach((id) => offerKeyByCruiseId.set(id, key));
      const instanceId = String(representative.playerOfferId || representative.offerInstanceId || representative.carnivalOfferId || '').trim().toLowerCase();
      if (instanceId) offerKeyByInstance.set(`instance:${instanceId}`, key);
      const code = normalizeOfferKey(representative.offerCode);
      if (code) offerKeysByCode.set(code, [...(offerKeysByCode.get(code) ?? []), key]);
    });

    cruisesData.forEach((cruise: Cruise) => {
      if (cruise.sailDate && isDateInPast(cruise.sailDate)) {
        return;
      }

      const instanceKey = getCruiseOfferLookupKey(cruise);
      const codeCandidates = cruise.offerCode ? offerKeysByCode.get(normalizeOfferKey(cruise.offerCode)) ?? [] : [];
      const targetOfferKey = offerKeyByCruiseId.get(cruise.id)
        || (instanceKey.startsWith('instance:') ? offerKeyByInstance.get(instanceKey) : undefined)
        || (codeCandidates.length === 1 ? codeCandidates[0] : undefined);
      const offerCard = targetOfferKey ? offersMap.get(targetOfferKey) : undefined;
      if (offerCard && !offerCard.cruises.some((linkedCruise) => linkedCruise.id === cruise.id)) {
        offerCard.cruises.push(cruise);
      }
    });

    const grouped = Array.from(offersMap.values());
    if (__DEV__) console.log('[Overview] Grouped active offers:', {
      groupedOffers: grouped.length,
      realActiveOffers: realActiveOffersCount,
    });
    return grouped;
  }, [offersData, cruisesData, blockedOfferKeys, realActiveOffersCount]);

  useEffect(() => {
    if (!isInventoryReady || totalCruises === 0 || groupedOffers.length === 0) {
      setOfferSailingCounts({});
      setOfferSailingSummaries({});
      return undefined;
    }

    let cancelled = false;
    const cards = groupedOffers.filter((card) => card.representativeOffer);

    const runCountQueries = async () => {
      const next: Record<string, number> = {};
      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        const offer = card.representativeOffer;
        if (!offer) continue;

        const strongInstance = String(offer.playerOfferId || offer.offerInstanceId || offer.carnivalOfferId || '').trim();
        const query = strongInstance
          ? { offerInstanceKey: getCruiseOfferInstanceKey(offer as unknown as Cruise) ?? undefined }
          : { offerCode: offer.offerCode || card.offerCode };

        if (!query.offerInstanceKey && !query.offerCode) continue;

        try {
          const primaryPage = await queryOfferSailings({ ...query, limit: 1 });
          const primarySummary = await queryOfferSailingSummary(query);
          let bestTotal = Math.max(primaryPage.total, primarySummary.total);
          let bestSummary = primarySummary;
          // A provider instance is the authority. Code-only fallback is safe
          // only when that instance has no indexed relationships; otherwise a
          // shared public code can combine several distinct player offers.
          if (query.offerInstanceKey && bestTotal === 0 && (offer.offerCode || card.offerCode)) {
            const fallbackPage = await queryOfferSailings({ offerCode: offer.offerCode || card.offerCode, limit: 1 });
            const fallbackSummary = await queryOfferSailingSummary({ offerCode: offer.offerCode || card.offerCode });
            if (Math.max(fallbackPage.total, fallbackSummary.total) > bestTotal) {
              bestTotal = Math.max(fallbackPage.total, fallbackSummary.total);
              bestSummary = fallbackSummary;
            }
          }
          next[card.id] = bestTotal;
          if (offer.id && offer.id !== card.id) next[offer.id] = bestTotal;
          if (!cancelled) {
            setOfferSailingSummaries((current) => ({
              ...current,
              [card.id]: bestSummary,
              ...(offer.id && offer.id !== card.id ? { [offer.id]: bestSummary } : {}),
            }));
          }
        } catch (error) {
          console.warn('[Overview] Offer sailing count query failed without blocking tab:', {
            offerCode: card.offerCode,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (cancelled) return;
        if (index % 8 === 7) {
          setOfferSailingCounts((current) => ({ ...current, ...next }));
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      if (!cancelled) {
        setOfferSailingCounts((current) => ({ ...current, ...next }));
      }
    };

    void runCountQueries();
    return () => {
      cancelled = true;
    };
  }, [groupedOffers, isInventoryReady, queryOfferSailingSummary, queryOfferSailings, totalCruises]);

  const availableCruisesCount = useMemo(() => {
    return totalSourceCruises || totalCruises || cruiseInventoryCount || cruisesData.length;
  }, [cruiseInventoryCount, cruisesData.length, totalCruises, totalSourceCruises]);

  const certificateSummary = useMemo(() => {
    const fppCerts = getCertificatesByType('fpp').filter(c => c.status === 'available');
    const nextCruiseCerts = getCertificatesByType('nextCruise').filter(c => c.status === 'available');
    const obcCerts = getCertificatesByType('obc').filter(c => c.status === 'available');
    const freeplayCerts = getCertificatesByType('freeplay').filter(c => c.status === 'available');
    
    return [
      { type: 'fpp' as const, label: 'FPP Certs', value: fppCerts.length },
      { type: 'nextCruise' as const, label: 'Next Cruise', value: nextCruiseCerts.length },
      { type: 'obc' as const, label: 'OBC Certs', value: obcCerts.length + freeplayCerts.length },
    ];
  }, [getCertificatesByType]);

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

  const commandCenterBuckets = useMemo((): CommandCenterBucket[] => {
    return buildCommandCenterBuckets(offersData, cruisesData, certificates, currentTravelerProfile);
  }, [offersData, cruisesData, certificates, currentTravelerProfile]);

  const commandCenterTotalCount = useMemo(() => {
    return commandCenterBuckets.reduce((sum, bucket) => sum + bucket.offers.length, 0);
  }, [commandCenterBuckets]);

  const commandCenterBucketCounts = useMemo(() => {
    const getBucketCount = (id: CommandCenterBucket['id']): number => commandCenterBuckets.find((bucket) => bucket.id === id)?.offers.length ?? 0;
    const expires7 = getBucketCount('expires7');
    const expires14 = getBucketCount('expires14');
    const expires30 = getBucketCount('expires30');
    const recentlyExpired = getBucketCount('recentlyExpired');
    const needsReview = getBucketCount('needsReview');
    return {
      expires7,
      expires14,
      expires30,
      recentlyExpired,
      needsReview,
      urgentExpiring: expires7 + expires14,
    };
  }, [commandCenterBuckets]);

  const topCommandCenterBuckets = useMemo(() => {
    return commandCenterBuckets.filter((bucket) => bucket.offers.length > 0).slice(0, 3);
  }, [commandCenterBuckets]);

  const clubRoyaleTier = effectiveClubRoyaleTier || clubRoyaleProfile?.tier || 'Choice';
  const clubRoyaleAccent = getClubRoyaleTierColor(clubRoyaleTier);
  const commandCenterTheme = useMemo(() => createLoyaltyCardTheme(clubRoyaleAccent), [clubRoyaleAccent]);

  const [sortMode, setSortMode] = useState<'soonest' | 'highestValue'>('soonest');

  const offerSummary = useMemo(() => {
    if (groupedOffers.length === 0) return null;
    const totalValue = groupedOffers.reduce((sum, offer) => {
      const normalized = normalizeOfferValue(
        offer.representativeOffer ?? { id: offer.id, offerCode: offer.offerCode, value: offer.tradeInValue, freePlay: offer.freePlay, obcAmount: offer.obc },
        offer.cruises,
      );
      return sum + (normalized.faceValue.value ?? 0);
    }, 0);
    const totalCruises = groupedOffers.reduce(
      (sum, offer) => sum + (offerSailingCounts[offer.id] ?? offer.cruises.length),
      0,
    );
    
    if (__DEV__) console.log('[Overview] Offer summary calculated:', { totalValue, totalCruises, totalOffers: groupedOffers.length });
    
    return {
      totalValue,
      totalCruises,
      totalOffers: groupedOffers.length,
    };
  }, [groupedOffers, offerSailingCounts]);

  const cruisesWithCasinoData = useMemo(() => {
    const allCruises = [...bookedCruises, ...cruisesData];
    return allCruises.filter((cruise: BookedCruise) => {
      const winnings = getBookedCruiseWinningsBroughtHome(cruise);
      const points = getBookedCruiseCasinoPoints(cruise);
      return winnings !== 0 || points > 0;
    }).sort((a, b) => {
      const dateA = new Date(a.sailDate).getTime();
      const dateB = new Date(b.sailDate).getTime();
      return dateB - dateA;
    });
  }, [bookedCruises, cruisesData]);

  const activeOfferFilterCount = useMemo(() => [
    offerFilters.expiry !== 'all',
    offerFilters.cabin !== 'all',
    offerFilters.guests !== 'all',
    Boolean(offerFilters.minimumValue.trim()),
    offerFilters.source !== 'all',
  ].filter(Boolean).length, [offerFilters]);

  const filteredGroupedOffers = useMemo(() => {
    const minimumValue = Number(offerFilters.minimumValue.replace(/[$,\s]/g, ''));
    return groupedOffers.filter((card) => {
      const offer = (card.representativeOffer ?? {}) as unknown as Record<string, unknown>;
      if (offerFilters.expiry === '30-days') {
        if (!card.expiryDate) return false;
        const days = getDaysUntil(card.expiryDate);
        if (days < 0 || days > 30) return false;
      } else if (offerFilters.expiry === 'no-expiry' && card.expiryDate) {
        return false;
      }

      if (offerFilters.cabin !== 'all') {
        const cabinText = [
          offer.cabinType, offer.stateroomType, offer.roomType, offer.offerCategory,
          ...card.cruises.flatMap((cruise) => {
            const row = cruise as unknown as Record<string, unknown>;
            return [row.cabinType, row.stateroomType, row.cabinCategory];
          }),
        ].filter(Boolean).join(' ').toLowerCase();
        const wanted = offerFilters.cabin.toLowerCase().replace(/\s/g, '');
        if (!cabinText.replace(/\s/g, '').includes(wanted)) return false;
      }

      if (offerFilters.guests !== 'all') {
        const guestText = [offer.guestCount, offer.guests, offer.numberOfGuests, offer.occupancy, ...card.cruises.flatMap((cruise) => {
          const row = cruise as unknown as Record<string, unknown>;
          return [row.guestCount, row.guests, row.occupancy];
        })]
          .filter((value) => value != null).join(' ').toLowerCase();
        const wantedGuests = offerFilters.guests === '1' ? /(^|\D)1(\D|$)|one guest|single/ : /(^|\D)2(\D|$)|two guests|double/;
        if (!wantedGuests.test(guestText)) return false;
      }

      if (Number.isFinite(minimumValue) && minimumValue > 0) {
        const normalized = normalizeOfferValue(
          card.representativeOffer ?? { id: card.id, offerCode: card.offerCode, value: card.tradeInValue, freePlay: card.freePlay, obcAmount: card.obc },
          card.cruises,
        );
        if ((normalized.faceValue.value ?? 0) < minimumValue) return false;
      }

      if (offerFilters.source !== 'all') {
        const source = [offer.source, offer.sourceType, offer.importSource, offer.provider, offer.dataSource].filter(Boolean).join(' ').toLowerCase();
        if (offerFilters.source === 'synced' && !/(sync|provider|royal|celebrity|carnival)/.test(source)) return false;
        if (offerFilters.source === 'imported' && !/(import|csv|file|backup)/.test(source)) return false;
        if (offerFilters.source === 'manual' && !/(manual|user)/.test(source)) return false;
      }
      return true;
    });
  }, [groupedOffers, offerFilters]);

  const sortedOffers = useMemo(() => {
    if (filteredGroupedOffers.length === 0) return filteredGroupedOffers;
    
    const sorted = [...filteredGroupedOffers];
    
    if (sortMode === 'soonest') {
      sorted.sort((a, b) => {
        const aDate = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const bDate = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return aDate - bDate;
      });
    } else {
      sorted.sort((a, b) => {
        const aValue = normalizeOfferValue(
          a.representativeOffer ?? { id: a.id, offerCode: a.offerCode, value: a.tradeInValue, freePlay: a.freePlay, obcAmount: a.obc },
          a.cruises,
        ).faceValue.value ?? 0;
        const bValue = normalizeOfferValue(
          b.representativeOffer ?? { id: b.id, offerCode: b.offerCode, value: b.tradeInValue, freePlay: b.freePlay, obcAmount: b.obc },
          b.cruises,
        ).faceValue.value ?? 0;
        return bValue - aValue;
      });
    }
    
    return sorted;
  }, [filteredGroupedOffers, sortMode]);

  const visibleOffers = useMemo(
    () => sortedOffers.slice(0, visibleOfferCount),
    [sortedOffers, visibleOfferCount],
  );

  useEffect(() => {
    setVisibleOfferCount(OFFER_PAGE_SIZE);
  }, [offerFilters, sortMode]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Overview] Screen focused, offers count:', groupedOffers.length);
    }, [groupedOffers.length])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Overview] Refreshing offers...');
    try {
      // Reload durable CoreData and refresh the indexed inventory metadata.
      // This is intentionally local-only; provider authentication/sync remains
      // an explicit user action on the relevant Connections screen.
      await Promise.all([
        refreshData(),
        refreshCounts(),
        refreshFacets(),
      ]);
      console.log('[Overview] Refresh complete');
    } catch (error) {
      console.error('[Overview] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCounts, refreshData, refreshFacets]);

  const handleOfferPress = useCallback((offer: CasinoOfferCardData | Cruise) => {
    console.log('[Overview] Offer pressed:', offer.id);
    if ('cruises' in offer) {
      const routeOfferId = offer.representativeOffer?.id || offer.id;
      const expectedCruiseCount = offerSailingCounts[offer.id] ?? offerSailingCounts[routeOfferId] ?? offer.cruises.length;
      const routeOffer = offer.representativeOffer ?? {
        id: routeOfferId,
        offerCode: offer.offerCode,
        offerName: offer.offerName,
        title: offer.offerName,
      };
      router.push({ pathname: '/offer-details' as any, params: buildOfferDetailsParams(routeOffer, { expectedCruiseCount }) });
    } else {
      router.push({
        pathname: '/cruise-details' as any,
        params: buildCruiseDetailsParams(offer, { source: 'offers' }),
      });
    }
  }, [offerSailingCounts, router]);

  const handleDecodeOffer = useCallback((offer: CasinoOffer) => {
    console.log('[Overview] Decode offer pressed:', offer.offerCode);
    const expectedCruiseCount = offerSailingCounts[offer.id] ?? 0;
    router.push({ pathname: '/offer-details' as any, params: buildOfferDetailsParams(offer, { expectedCruiseCount, openDecoded: true }) });
  }, [offerSailingCounts, router]);

  const handleCommandCenterAction = useCallback((action: 'view' | 'decode' | 'compare' | 'archive' | 'skip', item: CommandCenterOffer) => {
    const offerCodeForLog = getOfferDisplayCode(item.offer);
    console.log('[Overview] Command Center action:', { action, offerCode: offerCodeForLog });
    if (action === 'view') {
      const expectedCruiseCount = offerSailingCounts[item.offer.id] ?? 0;
      router.push({ pathname: '/offer-details' as any, params: buildOfferDetailsParams(item.offer, { expectedCruiseCount }) });
      return;
    }
    if (action === 'decode') {
      const expectedCruiseCount = offerSailingCounts[item.offer.id] ?? 0;
      router.push({ pathname: '/offer-details' as any, params: buildOfferDetailsParams(item.offer, { expectedCruiseCount, openDecoded: true }) });
      return;
    }
    if (action === 'compare') {
      router.push({
        pathname: '/ask-my-data',
        params: { prompt: `Compare offer ${getOfferDisplayCode(item.offer)} against my other active offers using score, expiration, casino-paid value, certificate fit, and profile ownership.` },
      } as any);
      return;
    }
    if (action === 'archive') {
      updateCasinoOffer(item.offer.id, { status: 'archived', archiveStatus: 'archived' });
      return;
    }
    updateCasinoOffer(item.offer.id, { status: 'skipped' });
  }, [handleDecodeOffer, offerSailingCounts, router, updateCasinoOffer]);

  const handleCruiseItemPress = useCallback((cruiseId: string) => {
    console.log('[Overview] Cruise item pressed:', cruiseId);
    const cruise = cruisesData.find((row) => row.id === cruiseId)
      ?? deferredBookedCruises.find((row) => row.id === cruiseId);
    router.push(cruise ? {
      pathname: '/cruise-details' as any,
      params: buildCruiseDetailsParams(cruise, { source: cruise.status === 'available' ? 'offers' : 'booked' }),
    } : `/cruise-details?id=${encodeURIComponent(cruiseId)}` as any);
  }, [cruisesData, deferredBookedCruises, router]);

  const handleSettingsPress = useCallback(() => {
    router.push('/settings' as any);
  }, [router]);

  const handleAlertsPress = useCallback(() => {
    console.log('[Overview] Alerts pressed');
    setShowAlertsModal(true);
  }, []);

  const handleCruisesPress = useCallback(() => {
    router.push('/scheduling' as any);
  }, [router]);

  const handleBookedPress = useCallback(() => {
    router.push('/booked' as any);
  }, [router]);

  const handleLogoutPress = useCallback(async () => {
    console.log('[Overview] Logout pressed');
    await logout();
  }, [logout]);



  const renderHeader = () => (
    <ResponsiveContainer>
      <View style={styles.headerContent}>
        <View style={styles.offersLogoHeader} accessibilityLabel="Easy Seas" testID="offers-hero-banner-image">
          <Image source={OFFERS_HERO_IMAGE} style={styles.offersLogoHeaderImage} resizeMode="cover" accessibilityLabel="Easy Seas logo by Scott Astin" />
        </View>

        <View testID="offers-loyalty-progress-section">
          <CompactDashboardHeader
          hideLogo={true}
          memberName={currentUser?.name || clubRoyaleProfile?.memberName || 'Player'}
          onSettingsPress={handleSettingsPress}
          onAlertsPress={handleAlertsPress}
          onLogoutPress={handleLogoutPress}
          alertCount={summary.totalActive}
          availableCruises={totalPhysicalSailings || availableCruisesCount}
          availableCruiseOptions={totalSourceCruises || availableCruisesCount}
          bookedCruises={activeBookedCruises.length}
          activeOffers={realActiveOffersCount}
          dataLoading={coreDataLoading}
          onCruisesPress={handleCruisesPress}
          onBookedPress={handleBookedPress}
          onOffersPress={() => console.log('Active offers pressed')}
          compact
          />
        </View>

        {(offerSummary || coreDataLoading) && (
          <OfferSummaryCard
            totalValue={offerSummary?.totalValue ?? 0}
            totalCruises={offerSummary?.totalCruises ?? 0}
            totalOffers={offerSummary?.totalOffers ?? 0}
            isLoading={coreDataLoading}
            onSoonestPress={() => setSortMode('soonest')}
            onHighestValuePress={() => setSortMode('highestValue')}
            activeSortMode={sortMode}
          />
        )}

        {renderCommandCenter()}

        <ThemedSectionCard
          tab="offers"
          emoji="🔎"
          title="Filter offers"
          subtitle="Limit by traveler, program, expiry, cabin, guests, value, and source."
          compact
          testID="offers-filter-section"
        >
          <IntelligenceFilterStrip contextLabel="Offers" variant="bookedCruises" compact showTitle={false} />
          <View style={styles.offerFilterActions}>
            <FilterButton activeCount={activeOfferFilterCount} onPress={() => setOfferFiltersOpen(true)} label="Offer details" />
            <Text style={styles.offerFilterResultCount}>{sortedOffers.length.toLocaleString()} of {groupedOffers.length.toLocaleString()} offers</Text>
            {activeOfferFilterCount > 0 ? (
              <TouchableOpacity style={styles.offerFilterClear} onPress={() => setOfferFilters(DEFAULT_OFFER_FILTERS)} accessibilityRole="button" accessibilityLabel="Clear all offer detail filters">
                <Text style={styles.offerFilterClearText}>Clear all</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {activeOfferFilterCount > 0 ? (
            <Text style={styles.offerFilterSummary} numberOfLines={2}>
              {[offerFilters.expiry !== 'all' ? offerFilters.expiry : '', offerFilters.cabin !== 'all' ? offerFilters.cabin : '', offerFilters.guests !== 'all' ? `${offerFilters.guests} guest${offerFilters.guests === '1' ? '' : 's'}` : '', offerFilters.minimumValue ? `$${offerFilters.minimumValue}+` : '', offerFilters.source !== 'all' ? offerFilters.source : ''].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </ThemedSectionCard>

        <CollapsibleSection
          title="Casino & Certificates"
          subtitle={`${availableCruisesCount} available`}
          icon={<Sparkles size={18} color="#0E7FA7" />}
          tab="offers"
          emoji="📜"
          defaultExpanded={true}
          showBorder={false}
        >
          <CasinoCertificatesCard
            certificates={certificateSummary}
            totalCertificates={certificateSummary.reduce((sum, c) => sum + c.value, 0)}
            availableCruises={availableCruisesCount}
            onManagePress={() => setShowCertificateModal(true)}
            onViewOffersPress={() => router.push('/certificate-codes' as any)}
            onExaminePress={() => router.push('/certificate-lookup' as any)}
            showHeader={false}
          />
        </CollapsibleSection>

        <ThemedSectionHeader
          tab="offers"
          emoji="🎟️"
          title="Active offers"
          subtitle="Select an offer to see every eligible sailing."
          testID="offers-active-offers-section"
        />
      </View>
    </ResponsiveContainer>
  );

  const renderCommandCenter = () => {
    if (commandCenterTotalCount === 0) {
      return null;
    }

    return (
      <View style={styles.commandCenterCard} testID="offer-expiration-command-center">
        <LinearGradient
          colors={preferences.theme === 'high-contrast'
            ? ['#000000', '#000000', '#000000']
            : ['#FFFDF9', '#F3F8F7', '#FFFDF9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.commandCenterGradient, { borderColor: commandCenterTheme.borderColor }]}
        >
          <View style={styles.commandCenterRoyalBand}>
            <View style={[styles.commandCenterRoyalLine, { backgroundColor: commandCenterTheme.accentColor }]} />
            <Text style={[styles.commandCenterRoyalText, { color: commandCenterTheme.secondaryTextColor }]}>Club Royale watchlist</Text>
          </View>

          <View style={styles.commandCenterHeader}>
            <View style={styles.commandCenterTitleRow}>
              <View style={[styles.commandCenterIconBadge, { backgroundColor: commandCenterTheme.surfaceColor, borderColor: commandCenterTheme.borderColor }]}> 
                <Clock size={18} color={commandCenterTheme.accentColor} />
              </View>
              <View style={styles.commandCenterHeadingCopy}>
                <Text style={[styles.commandCenterTitle, { color: commandCenterTheme.topTextColor }]}>Expiration command center</Text>
                <Text style={[styles.commandCenterSubtitle, { color: commandCenterTheme.secondaryTextColor }]}>Royal Caribbean offers that need a decision window.</Text>
              </View>
            </View>
            <View style={[styles.commandCenterCountPill, { backgroundColor: commandCenterTheme.accentColor }]}> 
              <Text style={styles.commandCenterCountText}>{commandCenterBucketCounts.urgentExpiring}</Text>
              <Text style={styles.commandCenterCountLabel}>expiring</Text>
            </View>
          </View>

          <View style={styles.commandCenterSummaryRow} testID="command-center-expiring-summary">
            <View style={[styles.commandCenterUrgentChip, { backgroundColor: withAlpha(commandCenterTheme.accentColor, 0.16), borderColor: commandCenterTheme.borderColor }]}> 
              <AlertTriangle size={13} color={commandCenterTheme.accentColor} />
              <Text style={[styles.commandCenterUrgentChipText, { color: commandCenterTheme.topTextColor }]}>Urgent: {commandCenterBucketCounts.urgentExpiring}</Text>
            </View>
            <View style={[styles.commandCenterMiniChip, { backgroundColor: commandCenterTheme.surfaceColor, borderColor: commandCenterTheme.borderColor }]}> 
              <Text style={[styles.commandCenterMiniChipValue, { color: commandCenterTheme.topTextColor }]}>{commandCenterBucketCounts.expires7}</Text>
              <Text style={[styles.commandCenterMiniChipLabel, { color: commandCenterTheme.secondaryTextColor }]}>0-7 days</Text>
            </View>
            <View style={[styles.commandCenterMiniChip, { backgroundColor: commandCenterTheme.surfaceColor, borderColor: commandCenterTheme.borderColor }]}> 
              <Text style={[styles.commandCenterMiniChipValue, { color: commandCenterTheme.topTextColor }]}>{commandCenterBucketCounts.expires14}</Text>
              <Text style={[styles.commandCenterMiniChipLabel, { color: commandCenterTheme.secondaryTextColor }]}>8-14 days</Text>
            </View>
            {commandCenterBucketCounts.expires30 > 0 && (
              <View style={[styles.commandCenterMiniChipMuted, { backgroundColor: commandCenterTheme.surfaceColorMuted, borderColor: commandCenterTheme.borderColor }]}> 
                <Text style={[styles.commandCenterMiniChipMutedValue, { color: commandCenterTheme.topTextColor }]}>{commandCenterBucketCounts.expires30}</Text>
                <Text style={[styles.commandCenterMiniChipMutedLabel, { color: commandCenterTheme.secondaryTextColor }]}>15-30 days</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.commandCenterOpenButton, { backgroundColor: commandCenterTheme.accentColor }]}
            onPress={() => router.push('/command-center' as any)}
            activeOpacity={0.82}
            testID="open-full-command-center"
          >
            <Text style={styles.commandCenterOpenButtonText}>Open full command center</Text>
          </TouchableOpacity>

          {topCommandCenterBuckets.slice(0, 1).map((bucket) => (
            <View key={bucket.id} style={[styles.commandCenterBucket, { backgroundColor: commandCenterTheme.surfaceColor, borderColor: commandCenterTheme.borderColor }]}> 
              <View style={styles.commandCenterBucketHeader}>
                <Text style={[styles.commandCenterBucketTitle, { color: commandCenterTheme.topTextColor }]}>{bucket.title}</Text>
                <Text style={[styles.commandCenterBucketSubtitle, { color: commandCenterTheme.secondaryTextColor }]}>{bucket.offers.length} item{bucket.offers.length === 1 ? '' : 's'}</Text>
              </View>
              {bucket.offers.slice(0, 1).map((item) => (
                <View key={item.offer.id} style={[styles.commandCenterOfferRow, { backgroundColor: commandCenterTheme.surfaceColorMuted, borderColor: withAlpha(commandCenterTheme.accentColor, 0.18) }]}> 
                  <View style={[styles.commandCenterScoreBubble, { backgroundColor: withAlpha(commandCenterTheme.accentColor, 0.14) }]}> 
                    <Gauge size={14} color={commandCenterTheme.accentColor} />
                    <Text style={[styles.commandCenterScoreText, { color: commandCenterTheme.topTextColor }]}>{item.intelligence.score}</Text>
                  </View>
                  <View style={styles.commandCenterOfferCopy}>
                    <Text style={[styles.commandCenterOfferTitle, { color: commandCenterTheme.topTextColor }]} numberOfLines={1}>{item.offer.offerName || item.offer.title || item.offer.offerCode || 'Casino Offer'}</Text>
                    <Text style={[styles.commandCenterOfferMeta, { color: commandCenterTheme.secondaryTextColor }]} numberOfLines={1}>{item.intelligence.rating} · {item.intelligence.daysUntilExpiration === null ? 'No expiry found' : `${item.intelligence.daysUntilExpiration} days`} · {formatCurrency(item.intelligence.casinoPaysFor.casinoCoveredValue)}</Text>
                  </View>
                  <View style={styles.commandCenterActions}>
                    <TouchableOpacity style={[styles.commandCenterAction, { backgroundColor: commandCenterTheme.accentColor }]} onPress={() => handleCommandCenterAction('view', item)} testID="command-center-view">
                      <Text style={styles.commandCenterActionText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.commandCenterAction, { backgroundColor: COLORS.navyDeep }]} onPress={() => handleCommandCenterAction('decode', item)} testID="command-center-decode">
                      <Text style={styles.commandCenterActionText}>Decode</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.commandCenterActionsWide}
                    accessibilityLabel={`More actions for ${item.offer.offerName || item.offer.title || item.offer.offerCode || 'casino offer'}`}
                  >
                    <TouchableOpacity style={[styles.commandCenterActionMuted, { borderColor: commandCenterTheme.borderColor, backgroundColor: commandCenterTheme.surfaceColor }]} onPress={() => handleCommandCenterAction('compare', item)} testID="command-center-compare">
                      <Calculator size={12} color={commandCenterTheme.accentColor} />
                      <Text style={[styles.commandCenterActionMutedText, { color: commandCenterTheme.secondaryTextColor }]}>Compare</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.commandCenterActionMuted, { borderColor: commandCenterTheme.borderColor, backgroundColor: commandCenterTheme.surfaceColor }]} onPress={() => handleCommandCenterAction('archive', item)} testID="command-center-archive">
                      <Archive size={12} color={commandCenterTheme.accentColor} />
                      <Text style={[styles.commandCenterActionMutedText, { color: commandCenterTheme.secondaryTextColor }]}>Archive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.commandCenterActionMuted, { borderColor: commandCenterTheme.borderColor, backgroundColor: commandCenterTheme.surfaceColor }]} onPress={() => handleCommandCenterAction('skip', item)} testID="command-center-skip">
                      <CheckCircle size={12} color={commandCenterTheme.accentColor} />
                      <Text style={[styles.commandCenterActionMutedText, { color: commandCenterTheme.secondaryTextColor }]}>Mark skipped</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.commandCenterActionMuted, { borderColor: commandCenterTheme.borderColor, backgroundColor: commandCenterTheme.surfaceColor }]}
                      onPress={() => {
                        router.push({
                          pathname: '/ask-my-data',
                          params: { prompt: `Advise me on offer ${getOfferDisplayCode(item.offer)} using the current profile and filters.` },
                        } as any);
                      }}
                      testID="command-center-ask-my-data"
                    >
                      <Bot size={12} color={commandCenterTheme.accentColor} />
                      <Text style={[styles.commandCenterActionMutedText, { color: commandCenterTheme.secondaryTextColor }]}>Ask</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              ))}
            </View>
          ))}
        </LinearGradient>
      </View>
    );
  };

  const renderFooter = () => (
    <ResponsiveContainer>
      <View style={styles.footerContent}>
        {visibleOfferCount < sortedOffers.length ? (
          <View style={styles.offerPaginationCard} testID="offers-progressive-list-control">
            <View style={styles.offerPaginationCopy}>
              <Text style={styles.offerPaginationTitle}>Showing {visibleOffers.length.toLocaleString()} of {sortedOffers.length.toLocaleString()} offers</Text>
              <Text style={styles.offerPaginationSubtitle}>More offers stay available without making the rest of this page unreachable.</Text>
            </View>
            <TouchableOpacity
              style={styles.offerPaginationButton}
              onPress={() => setVisibleOfferCount((count) => Math.min(count + OFFER_PAGE_SIZE, sortedOffers.length))}
              accessibilityRole="button"
              accessibilityLabel={`Show the next ${Math.min(OFFER_PAGE_SIZE, sortedOffers.length - visibleOfferCount)} offers`}
              testID="offers-show-more"
            >
              <Text style={styles.offerPaginationButtonText}>Show next {Math.min(OFFER_PAGE_SIZE, sortedOffers.length - visibleOfferCount)}</Text>
            </TouchableOpacity>
          </View>
        ) : sortedOffers.length > OFFER_PAGE_SIZE ? (
          <View style={styles.offerPaginationCard} testID="offers-progressive-list-complete">
            <Text style={styles.offerPaginationTitle}>All {sortedOffers.length.toLocaleString()} matching offers are visible</Text>
            <TouchableOpacity style={styles.offerPaginationReset} onPress={() => setVisibleOfferCount(OFFER_PAGE_SIZE)} accessibilityRole="button" accessibilityLabel="Collapse the offer list">
              <Text style={styles.offerPaginationResetText}>Collapse list</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {cruisesWithCasinoData.length > 0 && (
          <ThemedSectionCard
            tab="offers"
            emoji="🪙"
            title="Recent activity"
            subtitle={`${cruisesWithCasinoData.length} cruise${cruisesWithCasinoData.length !== 1 ? 's' : ''} with casino data`}
            tone="casino"
            compact
            style={styles.casinoHistorySection}
            testID="offers-recent-casino-activity-section"
          >
            {cruisesWithCasinoData.slice(0, 3).map((cruise: BookedCruise) => {
              const winnings = getBookedCruiseWinningsBroughtHome(cruise);
              const earnedPoints = getBookedCruiseCasinoPoints(cruise);
              const isWin = winnings >= 0;
              const itineraryText = `${cruise.nights} night${cruise.nights !== 1 ? 's' : ''} to ${cruise.destination || cruise.itineraryName || 'Caribbean'}`;

              return (
                <TouchableOpacity
                  key={cruise.id}
                  style={styles.casinoHistoryItem}
                  onPress={() => handleCruiseItemPress(cruise.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.casinoHistoryItemHeader}>
                    <View style={styles.casinoHistoryShipInfo}>
                      <Ship size={16} color={COLORS.navyDeep} />
                      <Text style={styles.casinoHistoryShipName}>{cruise.shipName}</Text>
                    </View>
                    <View style={styles.casinoHistoryDateRow}>
                      <Calendar size={12} color="#64748B" />
                      <Text style={styles.casinoHistoryDate}>{formatDate(cruise.sailDate)}</Text>
                    </View>
                  </View>
                  <Text style={styles.casinoHistoryItinerary}>{itineraryText}</Text>
                  <View style={styles.casinoHistoryStats}>
                    <View style={styles.casinoHistoryStat}>
                      {isWin ? (
                        <TrendingUp size={14} color={COLORS.success} />
                      ) : (
                        <TrendingDown size={14} color={COLORS.error} />
                      )}
                      <Text style={[styles.casinoHistoryStatValue, { color: isWin ? COLORS.success : COLORS.error }]}> 
                        {isWin ? '+' : ''}${winnings.toLocaleString()}
                      </Text>
                      <Text style={styles.casinoHistoryStatLabel}>Win/Loss</Text>
                    </View>
                    <View style={styles.casinoHistoryStatDivider} />
                    <View style={styles.casinoHistoryStat}>
                      <Sparkles size={14} color="#D4A574" />
                      <Text style={styles.casinoHistoryStatValuePoints}>
                        {earnedPoints.toLocaleString()}
                      </Text>
                      <Text style={styles.casinoHistoryStatLabel}>Points Earned</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.recentActivityAction}
              onPress={() => router.push('/analytics' as any)}
              activeOpacity={0.8}
              testID="offers-view-casino-history"
            >
              <Text style={styles.recentActivityActionText}>View all casino activity</Text>
            </TouchableOpacity>
          </ThemedSectionCard>
        )}

        <ThemedSectionCard
          tab="offers"
          emoji="🎰"
          title="Machine strategy and ship explorer"
          subtitle="Machine recommendations, maps, sessions, and play preferences live in Slots."
          compact
          contentStyle={styles.quickLinkContent}
        >
          <TouchableOpacity
            style={[styles.quickLinkAction, { minHeight: minimumControlSize, backgroundColor: experienceColors.surfaceMuted }]}
            onPress={() => router.push('/machines' as any)}
            activeOpacity={0.82}
            testID="offers-open-slots-tools"
            accessibilityRole="button"
            accessibilityLabel="Open Slots tools"
          >
            <Target size={20} color={experienceColors.accentSecondary} />
            <Text style={[styles.quickLinkActionText, { color: experienceColors.accent }]}>Open Slots</Text>
          </TouchableOpacity>
        </ThemedSectionCard>

        <ThemedSectionCard
          tab="offers"
          emoji="🤖"
          title="Agent SEA"
          subtitle="Ask about offers, sailings, certificates, loyalty, and saved evidence."
          compact
          contentStyle={styles.quickLinkContent}
          testID="offers-agent-sea-section"
        >
          <TouchableOpacity
            style={[styles.quickLinkAction, { minHeight: minimumControlSize, backgroundColor: experienceColors.surfaceMuted }]}
            onPress={() => router.push('/ask-my-data' as any)}
            activeOpacity={0.85}
            testID="dashboard-ask-my-data"
            accessibilityRole="button"
            accessibilityLabel="Open Agent SEA"
          >
            <DatabaseZap size={20} color={experienceColors.accentSecondary} />
            <Text style={[styles.quickLinkActionText, { color: experienceColors.accent }]}>Open the conversation</Text>
          </TouchableOpacity>
        </ThemedSectionCard>

        <ThemedSectionCard
          tab="offers"
          emoji="📘"
          title="Learn the system"
          subtitle="Offer math, certificates, loyalty basics, machine logs, and Easy Seas tutorials."
          compact
          contentStyle={styles.quickLinkContent}
        >
          <TouchableOpacity
            style={[styles.quickLinkAction, { minHeight: minimumControlSize, backgroundColor: experienceColors.surfaceMuted }]}
            onPress={() => router.push('/learn-system' as any)}
            activeOpacity={0.85}
            testID="dashboard-learn-system"
            accessibilityRole="button"
            accessibilityLabel="Open Learn the system"
          >
            <BookOpen size={20} color={experienceColors.accentSecondary} />
            <Text style={[styles.quickLinkActionText, { color: experienceColors.accent }]}>Open guide</Text>
          </TouchableOpacity>
        </ThemedSectionCard>

      </View>
    </ResponsiveContainer>
  );

  const renderOfferCard = useCallback(({ item, index }: { item: CasinoOfferCardData; index: number }) => {
    const intelligence = item.representativeOffer
      ? calculateOfferIntelligenceScore(item.representativeOffer, item.cruises, certificates, currentTravelerProfile)
      : undefined;

    return (
      <ResponsiveContainer>
        <CasinoOfferCard
          offerId={item.representativeOffer?.id}
          offerCode={item.offerCode}
          offerName={item.offerName}
          expiryDate={item.expiryDate}
          tradeInValue={item.tradeInValue}
          freePlay={item.freePlay}
          obc={item.obc}
          cruises={item.cruises}
          cruiseCountOverride={offerSailingCounts[item.id] ?? (item.cruises.length > 0 ? item.cruises.length : undefined)}
          sailingSummary={offerSailingSummaries[item.id]}
          cruiseCountLoading={offerSailingCounts[item.id] === undefined && isInventoryReady && totalCruises > 0}
          onPress={() => handleOfferPress(item)}
          onCruisePress={handleCruiseItemPress}
          bookedCruiseIds={bookedCruiseIds}
          isBestValue={index === 0}
          intelligenceScore={intelligence?.score}
          intelligenceRating={intelligence?.rating}
          intelligenceExplanation={intelligence?.explanation}
          onDecodePress={item.representativeOffer ? () => handleDecodeOffer(item.representativeOffer as CasinoOffer) : undefined}
        />
      </ResponsiveContainer>
    );
  }, [bookedCruiseIds, certificates, currentTravelerProfile, handleCruiseItemPress, handleDecodeOffer, handleOfferPress, isInventoryReady, offerSailingCounts, offerSailingSummaries, totalCruises]);

  const keyExtractor = useCallback((item: CasinoOfferCardData, index: number) => `${item.id?.trim() || 'overview-item'}-${item.offerCode || 'offer'}-${item.expiryDate || 'expiry'}-${index}`, []);

  return (
    <LinearGradient colors={[...experienceColors.pageGradient] as [string, string, ...string[]]} style={styles.container}> 
      <CertificateManagerModal
        visible={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        certificates={certificates}
        onAddCertificate={addCertificate}
        onUpdateCertificate={updateCertificate}
        onDeleteCertificate={deleteCertificate}
      />

      <CertificateExplorerModal
        visible={showCertificateExplorerModal}
        onClose={() => setShowCertificateExplorerModal(false)}
      />
      
      <AlertsManagerModal
        visible={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
      />

      <Modal visible={offerFiltersOpen} transparent animationType="slide" onRequestClose={() => setOfferFiltersOpen(false)}>
        <View style={styles.offerFilterOverlay}>
          <View style={styles.offerFilterSheet} testID="offers-filter-sheet">
            <View style={styles.offerFilterSheetHeader}>
              <View style={styles.offerFilterSheetTitleRow}>
                <SlidersHorizontal size={20} color="#0E7FA7" />
                <View>
                  <Text style={styles.offerFilterSheetTitle}>Offer filters</Text>
                  <Text style={styles.offerFilterSheetSubtitle}>{sortedOffers.length.toLocaleString()} of {groupedOffers.length.toLocaleString()} offers match</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.offerFilterClose} onPress={() => setOfferFiltersOpen(false)} accessibilityLabel="Close offer filters"><X size={20} color="#1C2F7A" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.offerFilterSheetContent} keyboardShouldPersistTaps="always">
              <Text style={styles.offerFilterFieldLabel}>Expiration</Text>
              <View style={styles.offerFilterChoiceRow}>{([
                ['all', 'All'], ['30-days', 'Next 30 days'], ['no-expiry', 'No date'],
              ] as Array<[OfferExpiryFilter, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[styles.offerFilterChoice, offerFilters.expiry === value && styles.offerFilterChoiceActive]} onPress={() => setOfferFilters((current) => ({ ...current, expiry: value }))}><Text style={[styles.offerFilterChoiceText, offerFilters.expiry === value && styles.offerFilterChoiceTextActive]}>{label}</Text></TouchableOpacity>)}</View>

              <Text style={styles.offerFilterFieldLabel}>Cabin entitlement</Text>
              <View style={styles.offerFilterChoiceRow}>{(['all', 'Interior', 'Ocean View', 'Balcony', 'Suite'] as OfferCabinFilter[]).map((value) => <TouchableOpacity key={value} style={[styles.offerFilterChoice, offerFilters.cabin === value && styles.offerFilterChoiceActive]} onPress={() => setOfferFilters((current) => ({ ...current, cabin: value }))}><Text style={[styles.offerFilterChoiceText, offerFilters.cabin === value && styles.offerFilterChoiceTextActive]}>{value === 'all' ? 'All cabins' : value}</Text></TouchableOpacity>)}</View>

              <Text style={styles.offerFilterFieldLabel}>Guests</Text>
              <View style={styles.offerFilterChoiceRow}>{([['all', 'All'], ['1', '1 guest'], ['2', '2 guests']] as Array<[OfferGuestFilter, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[styles.offerFilterChoice, offerFilters.guests === value && styles.offerFilterChoiceActive]} onPress={() => setOfferFilters((current) => ({ ...current, guests: value }))}><Text style={[styles.offerFilterChoiceText, offerFilters.guests === value && styles.offerFilterChoiceTextActive]}>{label}</Text></TouchableOpacity>)}</View>

              <Text style={styles.offerFilterFieldLabel}>Minimum recorded value</Text>
              <TextInput value={offerFilters.minimumValue} onChangeText={(minimumValue) => setOfferFilters((current) => ({ ...current, minimumValue }))} keyboardType="decimal-pad" placeholder="Any value" placeholderTextColor="#8E8A89" style={styles.offerFilterInput} accessibilityLabel="Minimum offer value" />

              <Text style={styles.offerFilterFieldLabel}>Source</Text>
              <View style={styles.offerFilterChoiceRow}>{([['all', 'All'], ['synced', 'Synced'], ['imported', 'Imported'], ['manual', 'Manual']] as Array<[OfferSourceFilter, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[styles.offerFilterChoice, offerFilters.source === value && styles.offerFilterChoiceActive]} onPress={() => setOfferFilters((current) => ({ ...current, source: value }))}><Text style={[styles.offerFilterChoiceText, offerFilters.source === value && styles.offerFilterChoiceTextActive]}>{label}</Text></TouchableOpacity>)}</View>
            </ScrollView>
            <View style={styles.offerFilterFooter}>
              <TouchableOpacity style={styles.offerFilterResetButton} onPress={() => setOfferFilters(DEFAULT_OFFER_FILTERS)} testID="offers-filter-clear-all"><Text style={styles.offerFilterResetText}>Clear all</Text></TouchableOpacity>
              <TouchableOpacity style={styles.offerFilterApplyButton} onPress={() => setOfferFiltersOpen(false)} testID="offers-filter-apply"><Text style={styles.offerFilterApplyText}>Apply · {sortedOffers.length.toLocaleString()}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={decodedOffer !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDecodedOffer(null)}
      >
        <View style={styles.decodeOverlay}>
          <View style={styles.decodeCard} testID="decoded-offer-modal">
            <LinearGradient colors={['#ECFEFF', '#F5F5F4']} style={styles.decodeHeader}>
              <View style={styles.decodeTitleRow}>
                <FileText size={20} color={COLORS.navyDeep} />
                <Text style={styles.decodeTitle}>{decodedOffer?.title ?? 'Decoded Offer'}</Text>
              </View>
              <TouchableOpacity style={styles.decodeClose} onPress={() => setDecodedOffer(null)} testID="decoded-offer-close">
                <Text style={styles.decodeCloseText}>Close</Text>
              </TouchableOpacity>
            </LinearGradient>
            <ScrollView style={styles.decodeScroll} contentContainerStyle={styles.decodeScrollContent}>
              {decodedOffer?.bullets.map((bullet, index) => (
                <View key={`${bullet}-${index}`} style={styles.decodeBulletRow}>
                  <Calculator size={15} color="#0F766E" />
                  <Text style={styles.decodeBulletText}>{bullet}</Text>
                </View>
              ))}
              <Text style={styles.decodeDisclaimer}>{decodedOffer?.disclaimer}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={visibleOffers}
          renderItem={renderOfferCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <ResponsiveContainer>
              {coreDataLoading ? (
                <DataStateCard
                  kind="loading"
                  title="Restoring saved offers"
                  reason="Easy Seas is reading the committed offer and sailing repositories on this device. Counts remain unavailable until readback finishes."
                  committed={false}
                  sourceLabel="Local offer repository"
                  testID="offers-hydration-loading"
                />
              ) : (
                <AnimatedEmptyState onImportPress={() => router.push('/settings' as any)} />
              )}
            </ResponsiveContainer>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.navyDeep}
              colors={[COLORS.navyDeep]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function OverviewScreen() {
  const { isLoading: coreLoading } = useCoreData();

  useEffect(() => {
    console.log('[OverviewScreen] Mounted, coreLoading:', coreLoading);
  }, [coreLoading]);

  useEffect(() => {
    console.log('[OverviewScreen] Loading state changed:', coreLoading);
  }, [coreLoading]);

  // Never hard-block the Offers tab on hydration. CoreDataProvider updates the
  // screen as persisted records arrive; a stalled storage/network read must not
  // trap the user on an indefinite full-screen spinner.
  return <OverviewScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F2EA',
  },
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  backgroundOverlay: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F2EA',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#66737F',
  },
  offerHydrationCard: {
    minHeight: 150,
    marginVertical: SPACING.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#FFFFFF',
    ...SHADOW.sm,
  },
  offerHydrationTitle: {
    marginTop: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 18,
    color: '#17324D',
  },
  offerHydrationText: {
    marginTop: 4,
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    color: '#66737F',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 120,
  },
  headerContent: {
    marginBottom: SPACING.md,
  },
  offersLogoHeader: {
    marginTop: 6,
    marginBottom: 12,
    height: 176,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  offersLogoHeaderImage: {
    width: '100%',
    height: '100%',
  },
  footerContent: {
    marginTop: SPACING.md,
  },
  offerPaginationCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C9DAD9',
    backgroundColor: '#FFFCF7',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  offerPaginationCopy: {
    marginBottom: 12,
  },
  offerPaginationTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 18,
    lineHeight: 23,
    color: '#17324D',
  },
  offerPaginationSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#67727A',
  },
  offerPaginationButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#167C80',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  offerPaginationButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  offerPaginationReset: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 8,
    justifyContent: 'center',
  },
  offerPaginationResetText: {
    color: '#167C80',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 21,
    color: COLORS.navyDeep,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#66737F',
    marginTop: 2,
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  progressSectionTitle: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.secondary,
    letterSpacing: 1.5,
  },
  progressCard: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  progressItem: {
    marginBottom: SPACING.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  progressValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressDivider: {
    height: 1,
    backgroundColor: CLEAN_THEME.border.light,
    marginVertical: SPACING.sm,
  },

  expiringAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 6,
  },
  expiringAlertText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.black,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  casinoOfferCard: {
    backgroundColor: COLORS.cardBackgroundDark,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorderAccent,
    ...SHADOW.lg,
  },
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 206, 209, 0.05)',
  },
  offerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  offerInfo: {
    flex: 1,
  },
  offerName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
    marginBottom: 2,
  },
  offerCode: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  offerDetails: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.15)',
  },
  offerDetailItem: {},
  offerDetailLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  offerDetailValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  tradeInValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  cruisesPreview: {},
  cruisesCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  cruisesCountText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  cruisesList: {
    gap: SPACING.xs,
  },
  cruisePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  cruisePreviewShip: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.primary,
    flex: 1,
  },
  cruisePreviewDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.6)',
  },
  bookedMini: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  bookedMiniText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  moreCruises: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.lg,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(30, 58, 95, 0.1)',
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
    color: '#676A70',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  importButton: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  importButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  learnSystemCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.md,
  },
  quickLinkContent: {
    padding: 10,
  },
  quickLinkAction: {
    minHeight: 44,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  quickLinkActionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800' as const,
    textAlign: 'right',
  },
  learnSystemGradient: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  editorialAccentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#0E7FA7',
  },
  learnSystemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F3F3F2',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnSystemCopy: {
    flex: 1,
  },
  learnSystemTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#333334',
  },
  learnSystemSubtitle: {
    fontSize: 12,
    color: '#8E8A89',
    lineHeight: 17,
    marginTop: 2,
  },
  learnSystemAction: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: '#0E7FA7',
  },
  machineDiscoveryLink: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  machineDiscoveryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F7F5',
  },
  machineDiscoveryCopy: {
    flex: 1,
    minWidth: 0,
  },
  machineDiscoveryTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    color: '#17324D',
    fontSize: 16,
  },
  machineDiscoverySubtitle: {
    color: '#66737F',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  machineDiscoveryAction: {
    color: '#167C80',
    fontSize: 11,
    fontWeight: '800' as const,
  },
  commandCenterCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  commandCenterGradient: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  commandCenterRoyalBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  commandCenterRoyalLine: {
    width: 34,
    height: 3,
    borderRadius: 2,
  },
  commandCenterRoyalText: {
    fontSize: 12,
    fontWeight: '900' as const,
    letterSpacing: 0.4,
  },
  commandCenterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  commandCenterTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  commandCenterIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  commandCenterHeadingCopy: {
    flex: 1,
  },
  commandCenterTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  commandCenterCountPill: {
    minWidth: 52,
    minHeight: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  commandCenterCountText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  commandCenterCountLabel: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.4,
  },
  commandCenterSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  commandCenterSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  commandCenterUrgentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  commandCenterUrgentChipText: {
    fontSize: 12,
    fontWeight: '900' as const,
  },
  commandCenterMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  commandCenterMiniChipValue: {
    fontSize: 12,
    fontWeight: '900' as const,
  },
  commandCenterMiniChipLabel: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  commandCenterMiniChipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  commandCenterMiniChipMutedValue: {
    fontSize: 12,
    fontWeight: '900' as const,
  },
  commandCenterMiniChipMutedLabel: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  commandCenterOpenButton: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    minHeight: 46,
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  commandCenterOpenButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900' as const,
  },
  commandCenterBucket: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 9,
    marginTop: 6,
  },
  commandCenterBucketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  commandCenterBucketTitle: {
    fontSize: 14,
    fontWeight: '900' as const,
  },
  commandCenterBucketSubtitle: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  commandCenterOfferRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 9,
    marginTop: 5,
  },
  commandCenterScoreBubble: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandCenterScoreText: {
    fontSize: 13,
    fontWeight: '900' as const,
  },
  commandCenterOfferCopy: {
    marginLeft: 52,
    marginRight: 0,
    marginBottom: SPACING.sm,
  },
  commandCenterOfferTitle: {
    fontSize: 13,
    fontWeight: '900' as const,
  },
  commandCenterOfferMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  commandCenterActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginLeft: 52,
  },
  commandCenterActionsWide: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    marginLeft: 52,
    paddingRight: SPACING.sm,
  },
  commandCenterAction: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  commandCenterActionText: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  commandCenterActionMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  commandCenterActionMutedText: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  decodeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  decodeCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  decodeHeader: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#D5D5D0',
  },
  decodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingRight: 82,
  },
  decodeTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  decodeClose: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  decodeCloseText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  decodeScroll: {
    maxHeight: 520,
  },
  decodeScrollContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  decodeBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  decodeBulletText: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
  decodeDisclaimer: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  casinoHistorySection: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  casinoHistoryHeader: {
    marginBottom: SPACING.md,
  },
  casinoHistoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  casinoHistoryTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1,
  },
  casinoHistorySubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    marginTop: 4,
  },
  casinoHistoryItem: {
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  casinoHistoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  casinoHistoryShipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  casinoHistoryShipName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  casinoHistoryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  casinoHistoryDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  casinoHistoryItinerary: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#676A70',
    marginBottom: SPACING.sm,
  },
  casinoHistoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  casinoHistoryStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  casinoHistoryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#D5D5D0',
    marginHorizontal: SPACING.sm,
  },
  casinoHistoryStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  casinoHistoryStatValuePoints: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D4A574',
  },
  casinoHistoryStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#94A3B8',
  },
  recentActivityAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#17324D',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FFFFFF',
    marginTop: SPACING.xs,
  },
  recentActivityActionText: {
    color: '#17324D',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  offerFilterActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  offerFilterResultCount: { flex: 1, minWidth: 100, color: '#58585B', fontSize: 12, fontWeight: '700' },
  offerFilterClear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  offerFilterClearText: { color: '#0E7FA7', fontSize: 12, fontWeight: '800' },
  offerFilterSummary: { marginTop: 7, color: '#58585B', fontSize: 11, lineHeight: 16 },
  offerFilterOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,34,71,0.34)' },
  offerFilterSheet: { maxHeight: '88%', backgroundColor: '#F7F3EC', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#D8D2C8', overflow: 'hidden' },
  offerFilterSheetHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#FFFCF7', borderBottomWidth: 1, borderBottomColor: '#D8D2C8' },
  offerFilterSheetTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerFilterSheetTitle: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 22, fontWeight: '700' },
  offerFilterSheetSubtitle: { color: '#676A70', fontSize: 11, marginTop: 2 },
  offerFilterClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#D5D5D0' },
  offerFilterSheetContent: { padding: 16, paddingBottom: 24 },
  offerFilterFieldLabel: { color: '#1C2F7A', fontSize: 12, fontWeight: '900', letterSpacing: 0.6, marginTop: 12, marginBottom: 8, textTransform: 'uppercase' },
  offerFilterChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offerFilterChoice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: '#B9C9C8', backgroundColor: '#FFFCF7' },
  offerFilterChoiceActive: { borderColor: '#167C80', backgroundColor: '#167C80' },
  offerFilterChoiceText: { color: '#58585B', fontSize: 12, fontWeight: '700' },
  offerFilterChoiceTextActive: { color: '#FFFFFF', fontWeight: '900' },
  offerFilterInput: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#B9C9C8', backgroundColor: '#FFFCF7', color: '#333334', fontSize: 15, paddingHorizontal: 14 },
  offerFilterFooter: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#FFFCF7', borderTopWidth: 1, borderTopColor: '#D8D2C8' },
  offerFilterResetButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#1C2F7A' },
  offerFilterResetText: { color: '#1C2F7A', fontSize: 14, fontWeight: '800' },
  offerFilterApplyButton: { flex: 1.4, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#167C80' },
  offerFilterApplyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
