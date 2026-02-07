import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ship,
  Clock,
  ChevronRight,
  CheckCircle,
  X,
  Dice5,
  Star,
  DollarSign,
  Ban,
  Archive,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { useAppState } from '@/state/AppStateProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { calculateCasinoAvailabilityForCruise, calculatePersonalizedPlayEstimate, getCasinoStatusBadge } from '@/lib/casinoAvailability';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { createDateFromString, getDaysUntil, formatDate } from '@/lib/date';
import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';

type SortOption = 'soonest' | 'highest-value' | 'lowest-price' | 'longest' | 'shortest';

export default function OfferDetailsScreen() {
  const router = useRouter();
  const { offerCode } = useLocalSearchParams<{ offerCode: string }>();
  const { localData } = useAppState();
  const { cruises: storeCruises, bookedCruises: storeBookedCruises, casinoOffers: storeOffers, updateCasinoOffer, removeCasinoOffer } = useCruiseStore();
  const { currentUser } = useUser();
  const [sortBy, setSortBy] = useState<SortOption>('soonest');

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
    const allCruises = [...(storeCruises || []), ...(localData.cruises || [])];
    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
    
    console.log('[OfferDetails] Data sources:', {
      storeCruisesCount: (storeCruises || []).length,
      localCruisesCount: (localData.cruises || []).length,
      storeOffersCount: (storeOffers || []).length,
      localOffersCount: (localData.offers || []).length,
      targetOfferCode: offerCode,
    });
    
    // Remove duplicates by ID
    const uniqueCruises = allCruises.filter((cruise, index, self) =>
      index === self.findIndex(c => c.id === cruise.id)
    );
    
    // Find cruises matching this offer code
    let matchingCruises = uniqueCruises.filter(
      (c: Cruise) => c.offerCode === offerCode
    );
    
    const offer = allOffers.find(
      (o: CasinoOffer) => o.offerCode === offerCode
    );
    
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
          portsAndTimes: cruise.portsAndTimes || offer.portsAndTimes,
          ports: cruise.ports || offer.ports,
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
  }, [storeCruises, storeOffers, localData.cruises, localData.offers, offerCode, sortBy]);

  const offerInfo = useMemo(() => {
    const { cruises, offer } = offerData;
    const guestCount = 2;
    
    // Calculate aggregate total value from ALL cruises in this offer
    // This is the sum of (2x room price + taxes) for each cruise
    let aggregateTotalValue = 0;
    let minRetailValue = Infinity;
    let maxRetailValue = 0;
    
    cruises.forEach(cruise => {
      // Get the lowest and highest available prices for this cruise
      const interiorPrice = cruise.interiorPrice || 0;
      const balconyPrice = cruise.balconyPrice || 0;
      const suitePrice = cruise.suitePrice || 0;
      const taxes = cruise.taxes || 0;
      
      // Calculate retail value using balcony as default (or whatever is available)
      const cabinPrice = balconyPrice || interiorPrice || suitePrice || 0;
      const retailValueForCruise = (cabinPrice * guestCount) + taxes;
      aggregateTotalValue += retailValueForCruise;
      
      // Track min (interior) and max (suite) values for range display
      if (interiorPrice > 0) {
        const minVal = (interiorPrice * guestCount) + taxes;
        if (minVal < minRetailValue) minRetailValue = minVal;
      }
      if (suitePrice > 0) {
        const maxVal = (suitePrice * guestCount) + taxes;
        if (maxVal > maxRetailValue) maxRetailValue = maxVal;
      }
      // Fallback to balcony if no interior/suite
      if (minRetailValue === Infinity && balconyPrice > 0) {
        minRetailValue = (balconyPrice * guestCount) + taxes;
      }
      if (maxRetailValue === 0 && balconyPrice > 0) {
        maxRetailValue = (balconyPrice * guestCount) + taxes;
      }
    });
    
    // If still no min/max, use aggregate
    if (minRetailValue === Infinity) minRetailValue = aggregateTotalValue / Math.max(cruises.length, 1);
    if (maxRetailValue === 0) maxRetailValue = aggregateTotalValue / Math.max(cruises.length, 1);
    
    console.log('[OfferDetails] Aggregate offer value calculated:', {
      cruiseCount: cruises.length,
      aggregateTotalValue,
      minRetailValue,
      maxRetailValue,
    });
    
    if (offer) {
      return {
        offerCode: offer.offerCode || offerCode,
        offerName: offer.title || offer.offerName || offer.offerCode || 'Casino Offer',
        expiryDate: offer.expiryDate || offer.offerExpiryDate,
        tradeInValue: offer.value || offer.tradeInValue,
        freePlay: offer.freePlay || offer.freeplayAmount,
        obc: offer.obcAmount || offer.OBC,
        roomType: offer.roomType,
        received: offer.received,
        perks: offer.perks,
        interiorPrice: offer.interiorPrice,
        oceanviewPrice: offer.oceanviewPrice,
        balconyPrice: offer.balconyPrice,
        suitePrice: offer.suitePrice,
        taxesFees: offer.taxesFees,
        totalValue: aggregateTotalValue,
        minRetailValue,
        maxRetailValue,
      };
    }
    if (cruises.length > 0) {
      const first = cruises[0];
      
      return {
        offerCode: first.offerCode || offerCode,
        offerName: first.offerName || first.offerCode || 'Casino Offer',
        expiryDate: first.offerExpiry,
        tradeInValue: first.tradeInValue || 0,
        freePlay: first.freePlay || 0,
        obc: first.freeOBC,
        roomType: first.cabinType,
        received: first.received,
        perks: first.perks,
        interiorPrice: first.interiorPrice,
        oceanviewPrice: first.oceanviewPrice,
        balconyPrice: first.balconyPrice,
        suitePrice: first.suitePrice,
        taxesFees: first.taxes,
        totalValue: aggregateTotalValue,
        minRetailValue,
        maxRetailValue,
      };
    }
    return {
      offerCode: offerCode || 'Unknown',
      offerName: 'Casino Offer',
      expiryDate: undefined,
      tradeInValue: 0,
      freePlay: 0,
      obc: 0,
      roomType: undefined,
      received: undefined,
      perks: undefined,
      interiorPrice: undefined,
      oceanviewPrice: undefined,
      balconyPrice: undefined,
      suitePrice: undefined,
      taxesFees: undefined,
      totalValue: 0,
      minRetailValue: 0,
      maxRetailValue: 0,
    };
  }, [offerData, offerCode]);

  const daysUntilExpiry = offerInfo.expiryDate ? getDaysUntil(offerInfo.expiryDate) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7;

  const handleCruisePress = useCallback((cruiseId: string) => {
    console.log('[OfferDetails] Cruise pressed:', cruiseId);
    router.push(`/cruise-details?id=${cruiseId}` as any);
  }, [router]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleMarkAsUsed = useCallback(() => {
    const { offer } = offerData;
    if (!offer) return;
    
    console.log('[OfferDetails] Deleting used offer:', offer.offerCode);
    removeCasinoOffer(offer.id);
    router.back();
  }, [offerData, router, removeCasinoOffer]);

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
    const casinoAvail = calculateCasinoAvailabilityForCruise(cruise, storeOffers);
    const playEstimate = calculatePersonalizedPlayEstimate(casinoAvail, playingHoursConfig);
    const valueBreakdown = calculateCruiseValue(cruise);
    const statusBadge = getCasinoStatusBadge(casinoAvail.casinoOpenDays, casinoAvail.totalDays);
    
    // Calculate retail value range: 2x room + taxes
    const guestCount = 2;
    const taxes = cruise.taxes || 0;
    const interiorPrice = cruise.interiorPrice || 0;
    const suitePrice = cruise.suitePrice || 0;
    
    // Min retail = 2x interior + taxes, Max retail = 2x suite + taxes
    const minRetailValue = interiorPrice > 0 ? (interiorPrice * guestCount) + taxes : 0;
    const maxRetailValue = suitePrice > 0 ? (suitePrice * guestCount) + taxes : 0;
    
    return {
      casinoDays: casinoAvail.casinoOpenDays,
      seaDays: casinoAvail.seaDays,
      totalDays: casinoAvail.totalDays,
      estimatedPoints: playEstimate.estimatedPoints,
      goldenHours: playEstimate.goldenHoursTotal || playEstimate.estimatedPlayHours,
      totalValue: valueBreakdown.totalRetailValue,
      minRetailValue,
      maxRetailValue,
      coveragePercent: Math.round(valueBreakdown.coverageFraction * 100),
      statusBadge,
      balconyPrice: cruise.balconyPrice,
      interiorPrice: cruise.interiorPrice,
      suitePrice: cruise.suitePrice,
      taxes,
    };
  }, [storeOffers, playingHoursConfig]);

  const renderCruiseCard = useCallback(({ item }: { item: Cruise }) => {
    const isBooked = bookedCruiseIds.has(item.id);
    const sailDate = createDateFromString(item.sailDate);
    const daysUntilSail = getDaysUntil(item.sailDate);
    const summary = getCruiseSummary(item);

    return (
      <TouchableOpacity
        style={[styles.cruiseCard, isBooked && styles.bookedCard]}
        onPress={() => handleCruisePress(item.id)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={isBooked 
            ? ['#34D399', '#10B981', '#059669'] 
            : ['#0EA5E9', '#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Compact Summary Row - Top - White with Navy Text */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryStatBox}>
            <Dice5 size={16} color={summary.statusBadge.color} />
            <Text style={[styles.summaryStatValue, { color: summary.statusBadge.color }]}>
              {summary.casinoDays}
            </Text>
            <Text style={styles.summaryStatLabel}>Casino Days</Text>
          </View>
          <View style={styles.summaryStatBox}>
            <Star size={16} color={COLORS.goldDark} />
            <Text style={styles.summaryStatValue}>~{(summary.estimatedPoints / 1000).toFixed(1)}k</Text>
            <Text style={styles.summaryStatLabel}>Est. Points</Text>
          </View>
          <View style={styles.summaryStatBox}>
            <Clock size={16} color={COLORS.goldDark} />
            <Text style={styles.summaryStatValue}>{summary.goldenHours}h</Text>
            <Text style={styles.summaryStatLabel}>Golden</Text>
          </View>
          <View style={[styles.summaryStatBox, styles.summaryStatBoxMoney]}>
            <DollarSign size={16} color={'#166534'} />
            <Text style={[styles.summaryStatValue, styles.summaryStatValueMoney]}>
              {summary.minRetailValue > 0 && summary.maxRetailValue > 0 && summary.minRetailValue !== summary.maxRetailValue
                ? `${(summary.minRetailValue / 1000).toFixed(1)}k-${(summary.maxRetailValue / 1000).toFixed(1)}k`
                : `${(Math.round(summary.maxRetailValue || summary.minRetailValue || 0) / 1000).toFixed(1)}k`}
            </Text>
            <Text style={styles.summaryStatLabel}>Retail</Text>
          </View>
        </View>

        {/* White Header Section with Navy Text */}
        <View style={styles.cardHeaderWhite}>
          {/* Line 1: Ship Icon + Ship Name */}
          <View style={styles.headerLine1}>
            <Ship size={20} color={COLORS.navyDeep} />
            <Text style={styles.shipNameNavy} numberOfLines={1}>{item.shipName}</Text>
            {isBooked && (
              <View style={styles.bookedBadgeInline}>
                <CheckCircle size={12} color={COLORS.white} />
                <Text style={styles.bookedBadgeTextInline}>BOOKED</Text>
              </View>
            )}
            <ChevronRight size={20} color={COLORS.navyDeep} style={styles.chevronRight} />
          </View>

          {/* Line 2: # Nights + Destination */}
          <View style={styles.headerLine2}>
            <Text style={styles.nightsDestinationText}>
              {item.nights} Nights • {item.destination || item.itineraryName || 'Caribbean Cruise'}
            </Text>
          </View>

          {/* Line 3: Sailing Date + Departure Port with labels */}
          <View style={styles.headerLine3}>
            <View style={styles.headerDetailBlock}>
              <Text style={styles.headerDetailLabel}>Sail Date:</Text>
              <Text style={styles.headerDetailValue}>
                {sailDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
            </View>
            <View style={styles.headerDetailBlock}>
              <Text style={styles.headerDetailLabel}>Departs:</Text>
              <Text style={styles.headerDetailValue} numberOfLines={1}>
                {item.departurePort || 'TBD'}
              </Text>
            </View>
          </View>

          {daysUntilSail > 0 && (
            <Text style={styles.daysAwayNavy}>{daysUntilSail} days away</Text>
          )}
        </View>

        {/* Pricing Row - Bottom - White with Navy Text */}
        {(summary.balconyPrice || summary.interiorPrice || summary.suitePrice) && (
          <View style={styles.pricingMiniRow}>
            {summary.interiorPrice && summary.interiorPrice > 0 && (
              <View style={styles.pricingMiniItem}>
                <Text style={styles.pricingMiniLabel}>Int</Text>
                <Text style={styles.pricingMiniValue}>${summary.interiorPrice}</Text>
              </View>
            )}
            {summary.balconyPrice && summary.balconyPrice > 0 && (
              <View style={styles.pricingMiniItem}>
                <Text style={styles.pricingMiniLabel}>Bal</Text>
                <Text style={styles.pricingMiniValue}>${summary.balconyPrice}</Text>
              </View>
            )}
            {summary.suitePrice && summary.suitePrice > 0 && (
              <View style={styles.pricingMiniItem}>
                <Text style={styles.pricingMiniLabel}>Suite</Text>
                <Text style={styles.pricingMiniValue}>${summary.suitePrice}</Text>
              </View>
            )}
            <View style={[styles.pricingMiniItem, styles.coverageBadge]}>
              <Text style={styles.coverageText}>{summary.coveragePercent}%</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [bookedCruiseIds, handleCruisePress, getCruiseSummary]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Merged Header - Offer Name, Code, Expiry, Value, Cruises */}
        <LinearGradient
          colors={['#E0F2FE', '#DBEAFE', '#E0F7FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mergedHeader}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={COLORS.navyDeep} />
          </TouchableOpacity>

          {/* Featured Offer Name & Code */}
          <View style={styles.featuredOfferSection}>
            <Image 
              source={{ uri: IMAGES.logo }}
              style={styles.offerLogo}
              resizeMode="contain"
            />
            <View style={styles.offerNameRow}>
              <Text style={styles.featuredOfferName} numberOfLines={2}>{offerInfo.offerName}</Text>
              {offerInfo.totalValue > 0 && (
                <View style={styles.totalValueBadge}>
                  <DollarSign size={18} color="#166534" />
                  <View>
                    <Text style={styles.totalValueLabel}>Total Value</Text>
                    <Text style={styles.totalValueAmount}>${Math.round(offerInfo.totalValue).toLocaleString()}</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.offerCodeBadge}>
              <Text style={styles.offerCodeText}>{offerInfo.offerCode}</Text>
            </View>
          </View>

          {/* FP/OBC Highlight Row */}
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
                  <Text style={styles.obcLabelOffer}>Onboard Credit</Text>
                  <Text style={styles.obcValueOffer}>${(offerInfo.obc ?? 0).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          {/* Stats Row - Expiry, Cruises */}
          <View style={styles.statsRow}>
            {offerInfo.expiryDate && (
              <View style={styles.statItem}>
                <Clock size={16} color={isExpiringSoon ? COLORS.warning : COLORS.navyDeep} />
                <View style={styles.statTextGroup}>
                  <Text style={styles.statLabel}>Expires</Text>
                  <Text style={[styles.statValue, isExpiringSoon && styles.statValueWarning]}>
                    {formatDate(offerInfo.expiryDate, 'short')}
                    {isExpiringSoon && ` (${daysUntilExpiry}d)`}
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.statItem}>
              <Ship size={16} color={COLORS.navyDeep} />
              <View style={styles.statTextGroup}>
                <Text style={styles.statLabel}>Cruises</Text>
                <Text style={styles.statValue}>{offerData.cruises.length}</Text>
              </View>
            </View>
          </View>

          {/* Status Actions */}
          {offerInfo.offerCode && offerData.offer && offerData.offer.status !== 'used' && offerData.offer.status !== 'booked' && (
            <View style={styles.statusActionsRow}>
              <TouchableOpacity
                style={styles.statusActionButton}
                onPress={handleMarkAsInProgress}
                activeOpacity={0.7}
              >
                <Archive size={16} color={COLORS.white} />
                <Text style={styles.statusActionText}>Mark In Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusActionButton, styles.statusActionButtonUsed]}
                onPress={handleMarkAsUsed}
                activeOpacity={0.7}
              >
                <Ban size={16} color={COLORS.white} />
                <Text style={styles.statusActionText}>Mark as Used</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Status Badge if already marked */}
          {offerData.offer && (offerData.offer.status === 'used' || offerData.offer.status === 'booked') && (
            <View style={styles.statusBadgeContainer}>
              <View style={[styles.statusBadge, offerData.offer.status === 'used' && styles.statusBadgeUsed]}>
                {offerData.offer.status === 'used' ? (
                  <Ban size={16} color={COLORS.white} />
                ) : (
                  <Archive size={16} color={COLORS.white} />
                )}
                <Text style={styles.statusBadgeText}>
                  {offerData.offer.status === 'used' ? 'Used' : 'In Progress'}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Sort Controls */}
        <View style={styles.sortSection}>
          <Text style={styles.sortLabel} testID="offer-sort-label">Sort by:</Text>
          <View style={styles.sortRowCentered}>
            <TouchableOpacity
              style={[styles.sortPillMain, sortBy === 'soonest' && styles.sortPillMainActive]}
              onPress={() => setSortBy('soonest')}
              activeOpacity={0.7}
              testID="sort-soonest"
            >
              <Text style={[styles.sortPillMainText, sortBy === 'soonest' && styles.sortPillMainTextActive]}>Soonest Expiring</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortPillMain, sortBy === 'highest-value' && styles.sortPillMainActive]}
              onPress={() => setSortBy('highest-value')}
              activeOpacity={0.7}
              testID="sort-highest-value"
            >
              <Text style={[styles.sortPillMainText, sortBy === 'highest-value' && styles.sortPillMainTextActive]}>Highest Value</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={offerData.cruises}
          renderItem={renderCruiseCard}
          keyExtractor={(item) => item.id}
          extraData={sortBy}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ship size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No cruises found for this offer</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const THEME = {
  background: COLORS.white,
  cardBg: COLORS.white,
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.1)',
  },
  closeButton: {
    position: 'absolute' as const,
    top: SPACING.sm,
    right: SPACING.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  offerLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  featuredOfferName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    textAlign: 'left' as const,
    flex: 1,
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  offerCodeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 1,
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
    marginHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
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
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
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
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  fpObcRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  fpBadgeOffer: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: '#86EFAC',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  fpLabelOffer: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fpValueOffer: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#15803D',
  },
  obcBadgeOffer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: '#93C5FD',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  obcLabelOffer: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1E40AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  obcValueOffer: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1E40AF',
  },
  statusActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
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
    backgroundColor: '#DC2626',
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
    backgroundColor: '#DC2626',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
});
