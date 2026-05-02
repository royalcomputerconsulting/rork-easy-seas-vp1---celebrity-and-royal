import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';

import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { IMAGES, LOCAL_IMAGES } from '@/constants/images';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { useAgentX } from '@/state/AgentXProvider';
import { usePriceTrackingSync } from '@/lib/usePriceTrackingSync';
import { useAlerts } from '@/state/AlertsProvider';
import { CompactDashboardHeader } from '@/components/CompactDashboardHeader';
import { CasinoCertificatesCard } from '@/components/CasinoCertificatesCard';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { CertificateManagerModal } from '@/components/CertificateManagerModal';
import { useCertificates } from '@/state/CertificatesProvider';
import { OfferCard } from '@/components/OfferCard';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { CasinoOfferCard, OfferSummaryCard } from '@/components/CasinoOfferCard';
import { AlertsManagerModal } from '@/components/AlertsManagerModal';
import { QuickActionsFAB } from '@/components/ui/QuickActionsFAB';
import { createDateFromString, getDaysUntil, isDateInPast, formatDate } from '@/lib/date';
import { isActiveBookedCruise } from '@/lib/bookedCruiseStatus';
import { MachineStrategyCard } from '@/components/MachineStrategyCard';
import { CertificateExplorerModal } from '@/components/CertificateExplorerModal';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';

import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { getCabinPriceFromEntity, GUEST_COUNT_DEFAULT } from '@/lib/valueCalculator';

const OFFERS_TITLE_LOGO_URL = 'https://r2-pub.rork.com/attachments/4hm4mwycibyktcoe3b7eo.png';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [fadeAnim, scaleAnim, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.emptyIconContainer,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Tag size={56} color={COLORS.navyDeep} />
      </Animated.View>
      <Text style={styles.emptyTitle}>No Offers Found</Text>
      <Text style={styles.emptyText}>
        Import casino offers data to see available offers and eligible cruises.
      </Text>
      <TouchableOpacity
        style={styles.importButton}
        onPress={onImportPress}
        activeOpacity={0.8}
      >
        <Text style={styles.importButtonText}>Import Data</Text>
      </TouchableOpacity>
    </Animated.View>
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

function normalizeOfferKey(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function getOfferLookupKey(offer: CasinoOffer): string {
  return normalizeOfferKey(offer.offerCode || offer.id);
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
  const { cruises, bookedCruises: allBookedCruises, casinoOffers, clubRoyaleProfile, updateCasinoOffer } = useCoreData();
  const { currentUser, users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const { logout } = useAuth();
  const { sendMessage, setMode: setAgentMode } = useAgentX();
  const { summary } = useAlerts();
  
  usePriceTrackingSync();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showCertificateExplorerModal, setShowCertificateExplorerModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [decodedOffer, setDecodedOffer] = useState<DecodedOffer | null>(null);
  const [heroSignatureFailed, setHeroSignatureFailed] = useState<boolean>(false);
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

  const cruisesData = useMemo(() => filterRecordsByIntelligence(cruises, intelligenceFilterSnapshot, users), [cruises, intelligenceFilterSnapshot, users]);

  const offersData = useMemo(() => filterRecordsByIntelligence(casinoOffers, intelligenceFilterSnapshot, users), [casinoOffers, intelligenceFilterSnapshot, users]);

  const offerNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    offersData.forEach((o: CasinoOffer) => {
      const code = (o.offerCode || '').trim();
      if (code.length === 0) return;
      const name = (o.offerName || o.title || '').trim();
      if (name.length === 0) return;
      if (!map.has(code)) {
        map.set(code, name);
        return;
      }

      const existing = (map.get(code) || '').trim();
      if (existing.length === 0) {
        map.set(code, name);
        return;
      }

      if (existing === 'Casino Offer' && name !== 'Casino Offer') {
        map.set(code, name);
      }
    });

    console.log('[Overview] offerNameByCode map size:', map.size);
    return map;
  }, [offersData]);

  const bookedCruises = useMemo(() => filterRecordsByIntelligence(allBookedCruises, intelligenceFilterSnapshot, users), [allBookedCruises, intelligenceFilterSnapshot, users]);

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
      const offerKey = normalizeOfferKey(cruise.offerCode);
      if (!offerKey) {
        return;
      }

      if (isOfferLinkedCruiseInProgress(cruise, today)) {
        keys.add(offerKey);
      }
    });

    console.log('[Overview] In-progress offer keys:', Array.from(keys));
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
      const isLinkedToInProgressCruise = !!offer.offerCode && inProgressOfferKeys.has(normalizeOfferKey(offer.offerCode));

      if (hasBlockedStatus || isLinkedToInProgressCruise) {
        keys.add(lookupKey);
      }
    });

    console.log('[Overview] Blocked offer keys:', Array.from(keys));
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

    console.log('[Overview] Real active offers count:', {
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

      const key = offer.offerCode || offer.id;
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

    cruisesData.forEach((cruise: Cruise) => {
      if (cruise.sailDate && isDateInPast(cruise.sailDate)) {
        return;
      }
      
      const offerCode = cruise.offerCode;
      if (offerCode && offersMap.has(offerCode)) {
        const offerCard = offersMap.get(offerCode);
        if (offerCard) {
          offerCard.cruises.push(cruise);
        }
      }
    });

    const grouped = Array.from(offersMap.values());
    console.log('[Overview] Grouped active offers:', {
      groupedOffers: grouped.length,
      realActiveOffers: realActiveOffersCount,
    });
    return grouped;
  }, [offersData, cruisesData, blockedOfferKeys, realActiveOffersCount]);

  const nonExpiredOffers = useMemo(() => {
    if (groupedOffers.length === 0) {
      return cruisesData.filter((cruise: Cruise) => {
        if (cruise.sailDate) {
          return !isDateInPast(cruise.sailDate);
        }
        return true;
      });
    }
    return groupedOffers;
  }, [groupedOffers, cruisesData]);

  const availableCruisesCount = useMemo(() => {
    return cruisesData.length;
  }, [cruisesData]);

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

  const [sortMode, setSortMode] = useState<'soonest' | 'highestValue'>('soonest');

  const offerSummary = useMemo(() => {
    if (groupedOffers.length === 0) return null;
    
    let totalValue = 0;
    let totalCruises = 0;
    
    // Base rates per night for cabin type estimation (same as CasinoOfferCard)
    const baseRates: Record<string, number> = {
      'Interior': 100,
      'Interior GTY': 80,
      'Oceanview': 140,
      'Oceanview GTY': 120,
      'Balcony': 180,
      'Balcony GTY': 150,
      'Suite': 350,
      'Suite GTY': 280,
      'Junior Suite': 320,
      'Grand Suite': 500,
      "Owner's Suite": 600,
    };
    
    groupedOffers.forEach(offer => {
      totalCruises += offer.cruises.length;
      const roomType = offer.cruises[0]?.cabinType || 'Balcony';
      
      offer.cruises.forEach(cruise => {
        let cabinPrice = getCabinPriceFromEntity(cruise, roomType) || cruise.price || 0;
        
        // Estimate cabin price if not available
        if (cabinPrice === 0 && cruise.nights > 0) {
          const typeKey = Object.keys(baseRates).find(key => 
            roomType.toLowerCase().includes(key.toLowerCase())
          ) || 'Balcony';
          cabinPrice = (baseRates[typeKey] || 180) * (cruise.nights || 7);
        }
        
        const guestCount = cruise.guests || GUEST_COUNT_DEFAULT;
        const cabinValueForTwo = cabinPrice * guestCount;
        
        // Estimate taxes if not provided (~$30/night per guest)
        let taxesFees = cruise.taxes || 0;
        if (taxesFees === 0 && cruise.nights > 0) {
          taxesFees = Math.round((cruise.nights || 7) * 30 * guestCount);
        }
        
        const freePlayValue = cruise.freePlay || 0;
        const obcValue = cruise.freeOBC || 0;
        
        // Total value = cabin + taxes + freeplay + OBC (same formula as CasinoOfferCard)
        const cruiseTotalValue = cabinValueForTwo + taxesFees + freePlayValue + obcValue;
        totalValue += cruiseTotalValue;
      });
    });
    
    console.log('[Overview] Offer summary calculated:', { totalValue, totalCruises, totalOffers: groupedOffers.length });
    
    return {
      totalValue,
      totalCruises,
      totalOffers: groupedOffers.length,
    };
  }, [groupedOffers]);

  const cruisesWithCasinoData = useMemo(() => {
    const allCruises = [...bookedCruises, ...cruisesData];
    return allCruises.filter((cruise: BookedCruise) => {
      const hasWinnings = cruise.winnings !== undefined && cruise.winnings !== 0;
      const hasPoints = (cruise.earnedPoints !== undefined && cruise.earnedPoints > 0) || 
                       (cruise.casinoPoints !== undefined && cruise.casinoPoints > 0);
      return hasWinnings || hasPoints;
    }).sort((a, b) => {
      const dateA = new Date(a.sailDate).getTime();
      const dateB = new Date(b.sailDate).getTime();
      return dateB - dateA;
    });
  }, [bookedCruises, cruisesData]);

  const sortedOffers = useMemo(() => {
    if (groupedOffers.length === 0) return nonExpiredOffers;
    
    const sorted = [...groupedOffers];
    
    if (sortMode === 'soonest') {
      sorted.sort((a, b) => {
        const aDate = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const bDate = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return aDate - bDate;
      });
    } else {
      sorted.sort((a, b) => {
        const aValue = a.cruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
        const bValue = b.cruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
        return bValue - aValue;
      });
    }
    
    return sorted;
  }, [groupedOffers, nonExpiredOffers, sortMode]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Overview] Screen focused, offers count:', nonExpiredOffers.length);
    }, [nonExpiredOffers.length])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('[Overview] Refreshing offers...');
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
    console.log('[Overview] Refresh complete');
  }, []);

  const handleOfferPress = useCallback((offer: CasinoOfferCardData | Cruise) => {
    console.log('[Overview] Offer pressed:', offer.id);
    if ('cruises' in offer) {
      router.push(`/offer-details?offerCode=${encodeURIComponent(offer.offerCode)}` as any);
    } else {
      router.push(`/cruise-details?id=${offer.id}` as any);
    }
  }, [router]);

  const handleDecodeOffer = useCallback((offer: CasinoOffer) => {
    console.log('[Overview] Decode offer pressed:', offer.offerCode);
    setDecodedOffer(decodeOffer(offer, cruisesData, currentTravelerProfile));
  }, [cruisesData, currentTravelerProfile]);

  const handleCommandCenterAction = useCallback((action: 'view' | 'decode' | 'compare' | 'archive' | 'skip', item: CommandCenterOffer) => {
    const offerCodeForLog = getOfferDisplayCode(item.offer);
    console.log('[Overview] Command Center action:', { action, offerCode: offerCodeForLog });
    if (action === 'view') {
      router.push(`/offer-details?offerCode=${encodeURIComponent(getOfferDisplayCode(item.offer))}` as any);
      return;
    }
    if (action === 'decode') {
      handleDecodeOffer(item.offer);
      return;
    }
    if (action === 'compare') {
      setAgentMode('travelAgent');
      router.push('/ask-my-data' as any);
      void sendMessage(`Compare offer ${getOfferDisplayCode(item.offer)} against my other active offers using score, expiration, casino-paid value, certificate fit, and profile ownership.`);
      return;
    }
    if (action === 'archive') {
      updateCasinoOffer(item.offer.id, { status: 'archived', archiveStatus: 'archived' });
      return;
    }
    updateCasinoOffer(item.offer.id, { status: 'skipped' });
  }, [handleDecodeOffer, router, sendMessage, setAgentMode, updateCasinoOffer]);

  const handleCruiseItemPress = useCallback((cruiseId: string) => {
    console.log('[Overview] Cruise item pressed:', cruiseId);
    router.push(`/cruise-details?id=${cruiseId}` as any);
  }, [router]);

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

  const handleCalendarPress = useCallback(() => {
    router.push('/events' as any);
  }, [router]);

  const handleAddCrewmemberPress = useCallback(() => {
    console.log('[Overview] Add Crewmember pressed');
    router.push('/events' as any);
  }, [router]);

  const handleAddSessionPress = useCallback(() => {
    console.log('[Overview] Add Session pressed');
    router.push('/machines' as any);
  }, [router]);

  const handleLogoutPress = useCallback(async () => {
    console.log('[Overview] Logout pressed');
    await logout();
  }, [logout]);



  const renderHeader = () => (
    <ResponsiveContainer>
      <View style={styles.headerContent}>
        <View style={styles.titleLogoCard}>
          <Image
            source={{ uri: OFFERS_TITLE_LOGO_URL }}
            style={styles.titleLogoImage}
            resizeMode="contain"
            accessibilityLabel="Any Day Aboard Ship is a Great Day Aboard Ship logo"
            testID="offers-title-logo-card-image"
          />
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#3AAFA9', '#2B7A78', '#17A398', '#1E8C82', '#3AAFA9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'transparent', 'rgba(255,255,255,0.12)', 'transparent', 'rgba(255,255,255,0.08)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Easy Seas™</Text>
            <Text style={styles.heroSubtitle}>Manage your Nautical Lifestyle™</Text>
            {!heroSignatureFailed ? (
              <Image
                source={{ uri: IMAGES.signature }}
                style={styles.heroSignature}
                resizeMode="contain"
                onError={() => {
                  console.warn('[Overview] Signature image failed to load, using bundled fallback');
                  setHeroSignatureFailed(true);
                }}
                testID="offers-hero-signature-image"
              />
            ) : (
              <Image
                source={LOCAL_IMAGES.signature}
                style={styles.heroSignature}
                resizeMode="contain"
                testID="offers-hero-signature-fallback-image"
              />
            )}
          </View>
        </View>

        <CompactDashboardHeader
          hideLogo={true}
          memberName={currentUser?.name || clubRoyaleProfile?.memberName || 'Player'}
          onSettingsPress={handleSettingsPress}
          onAlertsPress={handleAlertsPress}
          onLogoutPress={handleLogoutPress}
          alertCount={summary.totalActive}
          availableCruises={availableCruisesCount}
          bookedCruises={activeBookedCruises.length}
          activeOffers={realActiveOffersCount}
          onCruisesPress={handleCruisesPress}
          onBookedPress={handleBookedPress}
          onOffersPress={() => console.log('Active offers pressed')}
        />

        <IntelligenceFilterStrip contextLabel="Offers" variant="bookedCruises" />


        <TouchableOpacity
          style={styles.learnSystemCard}
          onPress={() => router.push('/ask-my-data' as any)}
          activeOpacity={0.85}
          testID="dashboard-ask-my-data"
        >
          <LinearGradient colors={['#061826', '#0F766E', '#115E59']} style={styles.learnSystemGradient}>
            <View style={styles.learnSystemIcon}>
              <DatabaseZap size={20} color="#A7F3D0" />
            </View>
            <View style={styles.learnSystemCopy}>
              <Text style={styles.learnSystemTitle}>Ask My Data</Text>
              <Text style={styles.learnSystemSubtitle}>Standalone natural-language search for scoped offers, cruises, certificates, and calendar records.</Text>
            </View>
            <Text style={styles.learnSystemAction}>Open</Text>
          </LinearGradient>
        </TouchableOpacity>

        {offerSummary && (
          <OfferSummaryCard
            totalValue={offerSummary.totalValue}
            totalCruises={offerSummary.totalCruises}
            totalOffers={offerSummary.totalOffers}
            onSoonestPress={() => setSortMode('soonest')}
            onHighestValuePress={() => setSortMode('highestValue')}
            activeSortMode={sortMode}
          />
        )}

        {renderCommandCenter()}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Tag size={18} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>CASINO OFFERS</Text>
          </View>
        </View>
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
          colors={['#172554', '#0F766E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.commandCenterGradient}
        >
          <View style={styles.commandCenterHeader}>
            <View style={styles.commandCenterTitleRow}>
              <Clock size={18} color="#FDE68A" />
              <Text style={styles.commandCenterTitle}>Expiration Command Center</Text>
            </View>
            <View style={styles.commandCenterCountPill}>
              <Text style={styles.commandCenterCountText}>{commandCenterBucketCounts.urgentExpiring}</Text>
              <Text style={styles.commandCenterCountLabel}>expiring</Text>
            </View>
          </View>
          <Text style={styles.commandCenterSubtitle}>
            Urgent expiring offers are now counted in one place: {commandCenterBucketCounts.urgentExpiring} total, with {commandCenterBucketCounts.expires7} expiring in 0-7 days and {commandCenterBucketCounts.expires14} expiring in 8-14 days. {commandCenterTotalCount} total timing item{commandCenterTotalCount === 1 ? '' : 's'} need attention.
          </Text>
          <View style={styles.commandCenterSummaryRow} testID="command-center-expiring-summary">
            <View style={styles.commandCenterUrgentChip}>
              <AlertTriangle size={13} color="#172554" />
              <Text style={styles.commandCenterUrgentChipText}>Urgent: {commandCenterBucketCounts.urgentExpiring} total</Text>
            </View>
            <View style={styles.commandCenterMiniChip}>
              <Text style={styles.commandCenterMiniChipValue}>{commandCenterBucketCounts.expires7}</Text>
              <Text style={styles.commandCenterMiniChipLabel}>expire in 0-7 days</Text>
            </View>
            <View style={styles.commandCenterMiniChip}>
              <Text style={styles.commandCenterMiniChipValue}>{commandCenterBucketCounts.expires14}</Text>
              <Text style={styles.commandCenterMiniChipLabel}>expire in 8-14 days</Text>
            </View>
            {commandCenterBucketCounts.expires30 > 0 && (
              <View style={styles.commandCenterMiniChipMuted}>
                <Text style={styles.commandCenterMiniChipMutedValue}>{commandCenterBucketCounts.expires30}</Text>
                <Text style={styles.commandCenterMiniChipMutedLabel}>15-30 days</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.commandCenterOpenButton}
            onPress={() => router.push('/command-center' as any)}
            activeOpacity={0.82}
            testID="open-full-command-center"
          >
            <Text style={styles.commandCenterOpenButtonText}>Open Full Command Center</Text>
          </TouchableOpacity>

          {topCommandCenterBuckets.map((bucket) => (
            <View key={bucket.id} style={styles.commandCenterBucket}>
              <View style={styles.commandCenterBucketHeader}>
                <Text style={styles.commandCenterBucketTitle}>{bucket.title}</Text>
                <Text style={styles.commandCenterBucketSubtitle}>{bucket.offers.length} item{bucket.offers.length === 1 ? '' : 's'}</Text>
              </View>
              {bucket.offers.slice(0, 2).map((item) => (
                <View key={item.offer.id} style={styles.commandCenterOfferRow}>
                  <View style={styles.commandCenterScoreBubble}>
                    <Gauge size={14} color="#A7F3D0" />
                    <Text style={styles.commandCenterScoreText}>{item.intelligence.score}</Text>
                  </View>
                  <View style={styles.commandCenterOfferCopy}>
                    <Text style={styles.commandCenterOfferTitle} numberOfLines={1}>{item.offer.offerName || item.offer.title || item.offer.offerCode || 'Casino Offer'}</Text>
                    <Text style={styles.commandCenterOfferMeta} numberOfLines={1}>{item.intelligence.rating} · {item.intelligence.daysUntilExpiration === null ? 'No expiry found' : `${item.intelligence.daysUntilExpiration} days`} · {formatCurrency(item.intelligence.casinoPaysFor.casinoCoveredValue)}</Text>
                  </View>
                  <View style={styles.commandCenterActions}>
                    <TouchableOpacity style={styles.commandCenterAction} onPress={() => handleCommandCenterAction('view', item)} testID="command-center-view">
                      <Text style={styles.commandCenterActionText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.commandCenterAction} onPress={() => handleCommandCenterAction('decode', item)} testID="command-center-decode">
                      <Text style={styles.commandCenterActionText}>Decode</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.commandCenterActionsWide}>
                    <TouchableOpacity style={styles.commandCenterActionMuted} onPress={() => handleCommandCenterAction('compare', item)} testID="command-center-compare">
                      <Calculator size={12} color="#CBD5E1" />
                      <Text style={styles.commandCenterActionMutedText}>Compare</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.commandCenterActionMuted} onPress={() => handleCommandCenterAction('archive', item)} testID="command-center-archive">
                      <Archive size={12} color="#CBD5E1" />
                      <Text style={styles.commandCenterActionMutedText}>Archive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.commandCenterActionMuted} onPress={() => handleCommandCenterAction('skip', item)} testID="command-center-skip">
                      <CheckCircle size={12} color="#CBD5E1" />
                      <Text style={styles.commandCenterActionMutedText}>Mark skipped</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.commandCenterActionMuted}
                      onPress={() => {
                        setAgentMode('casinoHost');
                        router.push('/ask-my-data' as any);
                        void sendMessage(`Advise me on offer ${getOfferDisplayCode(item.offer)} using the current profile and filters.`);
                      }}
                      testID="command-center-ask-agentx"
                    >
                      <Bot size={12} color="#CBD5E1" />
                      <Text style={styles.commandCenterActionMutedText}>Ask</Text>
                    </TouchableOpacity>
                  </View>
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
        <CollapsibleSection
          title="Casino & Certificates"
          subtitle={`${availableCruisesCount} available`}
          icon={<Sparkles size={18} color="#FFFFFF" />}
          defaultExpanded={true}
          showBorder={false}
        >
          <CasinoCertificatesCard
            certificates={certificateSummary}
            totalCertificates={certificateSummary.reduce((sum, c) => sum + c.value, 0)}
            availableCruises={availableCruisesCount}
            onManagePress={() => setShowCertificateModal(true)}
            onViewOffersPress={() => router.push('/scheduling' as any)}
            onExaminePress={() => setShowCertificateExplorerModal(true)}
          />
        </CollapsibleSection>

        <TouchableOpacity
          style={styles.learnSystemCard}
          onPress={() => router.push('/learn-system' as any)}
          activeOpacity={0.85}
          testID="dashboard-learn-system"
        >
          <LinearGradient colors={['#0F2439', '#1E3A5F', '#0F766E']} style={styles.learnSystemGradient}>
            <View style={styles.learnSystemIcon}>
              <BookOpen size={20} color="#A7F3D0" />
            </View>
            <View style={styles.learnSystemCopy}>
              <Text style={styles.learnSystemTitle}>Learn the System</Text>
              <Text style={styles.learnSystemSubtitle}>Offer math, certificates, loyalty basics, machine logs, and EasySeas tutorials.</Text>
            </View>
            <Text style={styles.learnSystemAction}>Open</Text>
          </LinearGradient>
        </TouchableOpacity>

        <CollapsibleSection
          title="Machine Strategy"
          subtitle="Personalized recommendations"
          icon={<Target size={18} color="#FFFFFF" />}
          defaultExpanded={false}
          showBorder={false}
        >
          <MachineStrategyCard />
        </CollapsibleSection>

        {cruisesWithCasinoData.length > 0 && (
          <View style={styles.casinoHistorySection}>
            <View style={styles.casinoHistoryHeader}>
              <View style={styles.casinoHistoryTitleRow}>
                <Coins size={18} color={COLORS.navyDeep} />
                <Text style={styles.casinoHistoryTitle}>CASINO HISTORY</Text>
              </View>
              <Text style={styles.casinoHistorySubtitle}>
                {cruisesWithCasinoData.length} cruise{cruisesWithCasinoData.length !== 1 ? 's' : ''} with casino data
              </Text>
            </View>
            {cruisesWithCasinoData.map((cruise: BookedCruise) => {
              const winnings = cruise.winnings || 0;
              const earnedPoints = cruise.earnedPoints || cruise.casinoPoints || 0;
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
          </View>
        )}
      </View>
    </ResponsiveContainer>
  );

  const renderOfferCard = useCallback(({ item, index }: { item: CasinoOfferCardData | Cruise; index: number }) => {
    if ('cruises' in item) {
      const intelligence = item.representativeOffer
        ? calculateOfferIntelligenceScore(item.representativeOffer, cruisesData, certificates, currentTravelerProfile)
        : undefined;

      return (
        <ResponsiveContainer>
          <CasinoOfferCard
          offerCode={item.offerCode}
          offerName={item.offerName}
          expiryDate={item.expiryDate}
          tradeInValue={item.tradeInValue}
          freePlay={item.freePlay}
          obc={item.obc}
          cruises={item.cruises}
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
    }

    const offerNameOverride = item.offerCode ? offerNameByCode.get(item.offerCode) : undefined;
    if (item.offerCode) {
      console.log('[Overview] OfferCard name resolution:', {
        cruiseId: item.id,
        offerCode: item.offerCode,
        cruiseOfferName: item.offerName,
        offerNameOverride,
      });
    }

    return (
      <ResponsiveContainer>
        <OfferCard 
        offer={item as Cruise} 
        allCruises={cruisesData}
        offerNameOverride={offerNameOverride}
        onPress={() => handleOfferPress(item)} 
        isBooked={bookedCruiseIds.has(item.id)}
        recommended={index === 0}
        />
      </ResponsiveContainer>
    );
  }, [handleOfferPress, handleCruiseItemPress, bookedCruiseIds, cruisesData, offerNameByCode, certificates, currentTravelerProfile, handleDecodeOffer]);

  const keyExtractor = useCallback((item: CasinoOfferCardData | Cruise) => item.id, []);

  return (
    <View style={styles.container}>
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

      <Modal
        visible={decodedOffer !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDecodedOffer(null)}
      >
        <View style={styles.decodeOverlay}>
          <View style={styles.decodeCard} testID="decoded-offer-modal">
            <LinearGradient colors={['#ECFEFF', '#F8FAFC']} style={styles.decodeHeader}>
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
        <QuickActionsFAB
          onBrowseCruises={handleCruisesPress}
          onImportData={handleSettingsPress}
          onViewCalendar={handleCalendarPress}
          onAddCrewmember={handleAddCrewmemberPress}
          onAddSession={handleAddSessionPress}
        />
        
        <FlatList
          data={sortedOffers}
          renderItem={renderOfferCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <ResponsiveContainer>
              <AnimatedEmptyState onImportPress={() => router.push('/settings' as any)} />
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
    </View>
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

  if (coreLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.navyDeep} />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </SafeAreaView>
    );
  }

  return <OverviewScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
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
    backgroundColor: '#0A1628',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#E2E8F0',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: 0,
    paddingBottom: 120,
  },
  headerContent: {
    marginBottom: SPACING.md,
  },
  titleLogoCard: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D4AF37',
    minHeight: 245,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    ...SHADOW.card,
  },
  titleLogoImage: {
    width: '100%',
    height: 230,
  },
  footerContent: {
    marginTop: SPACING.md,
  },

  heroCard: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },

  heroOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#1A1A1A',
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: 'rgba(0,0,0,0.65)',
    marginTop: 6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  heroSignature: {
    width: 240,
    height: 100,
    marginTop: 14,
    opacity: 0.8,
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
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1,
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
    color: '#4B5563',
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
    ...SHADOW.md,
  },
  learnSystemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  learnSystemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(167, 243, 208, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnSystemCopy: {
    flex: 1,
  },
  learnSystemTitle: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  learnSystemSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 17,
    marginTop: 2,
  },
  learnSystemAction: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: '#A7F3D0',
  },
  commandCenterCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOW.lg,
  },
  commandCenterGradient: {
    padding: SPACING.md,
  },
  commandCenterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commandCenterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  commandCenterTitle: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  commandCenterCountPill: {
    minWidth: 72,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  commandCenterCountText: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#172554',
    lineHeight: 17,
  },
  commandCenterCountLabel: {
    fontSize: 9,
    fontWeight: '900' as const,
    color: '#172554',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  commandCenterSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
    marginBottom: SPACING.sm,
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
    backgroundColor: '#FDE68A',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  commandCenterUrgentChipText: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: '#172554',
  },
  commandCenterMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(186, 230, 253, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(186, 230, 253, 0.3)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  commandCenterMiniChipValue: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  commandCenterMiniChipLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#BAE6FD',
  },
  commandCenterMiniChipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  commandCenterMiniChipMutedValue: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  commandCenterMiniChipMutedLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.68)',
  },
  commandCenterOpenButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDE68A',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
  },
  commandCenterOpenButtonText: {
    color: '#172554',
    fontSize: 12,
    fontWeight: '900' as const,
  },
  commandCenterBucket: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  commandCenterBucketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  commandCenterBucketTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  commandCenterBucketSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.68)',
  },
  commandCenterOfferRow: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  commandCenterScoreBubble: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandCenterScoreText: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  commandCenterOfferCopy: {
    marginLeft: 52,
    marginRight: 0,
    marginBottom: SPACING.sm,
  },
  commandCenterOfferTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  commandCenterOfferMeta: {
    fontSize: 11,
    color: '#BAE6FD',
    marginTop: 2,
  },
  commandCenterActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginLeft: 52,
  },
  commandCenterActionsWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginLeft: 52,
    marginTop: SPACING.xs,
  },
  commandCenterAction: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  commandCenterActionText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  commandCenterActionMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  commandCenterActionMutedText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#CBD5E1',
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
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#4B5563',
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
    backgroundColor: '#E2E8F0',
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
});
