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
  BedDouble,
  Users,
  Gauge,
  FileText,
  Layers,
  Calculator,
  AlertCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { calculateCasinoAvailabilityForCruise, calculatePersonalizedPlayEstimate, getCasinoStatusBadge } from '@/lib/casinoAvailability';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { createDateFromString, getDaysUntil, formatDate } from '@/lib/date';
import { useCertificates } from '@/state/CertificatesProvider';
import { formatCurrency } from '@/lib/format';
import {
  buildCertificateStackingNotes,
  calculateOfferIntelligenceScore,
  decodeOffer,
} from '@/lib/offerIntelligence';
import { useDrillDown } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';

type SortOption = 'soonest' | 'highest-value' | 'lowest-price' | 'longest' | 'shortest';

export default function OfferDetailsScreen() {
  const router = useRouter();
  const { offerCode } = useLocalSearchParams<{ offerCode: string }>();
  const { localData } = useAppState();
  const { cruises: storeCruises, bookedCruises: storeBookedCruises, casinoOffers: storeOffers, updateCasinoOffer, removeCasinoOffer } = useCoreData();
  const { currentUser } = useUser();
  const { certificates } = useCertificates();
  const [sortBy, setSortBy] = useState<SortOption>('soonest');
  const [showDecodedOffer, setShowDecodedOffer] = useState<boolean>(false);
  const drill = useDrillDown();

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
    
    // Calculate aggregate total value from ALL cruises in this offer.
    // Imported cabin prices are already full-booking retail prices.
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
      const retailValueForCruise = cabinPrice + taxes;
      aggregateTotalValue += retailValueForCruise;
      
      // Track min (interior) and max (suite) values for range display
      if (interiorPrice > 0) {
        const minVal = interiorPrice + taxes;
        if (minVal < minRetailValue) minRetailValue = minVal;
      }
      if (suitePrice > 0) {
        const maxVal = suitePrice + taxes;
        if (maxVal > maxRetailValue) maxRetailValue = maxVal;
      }
      // Fallback to balcony if no interior/suite
      if (minRetailValue === Infinity && balconyPrice > 0) {
        minRetailValue = balconyPrice + taxes;
      }
      if (maxRetailValue === 0 && balconyPrice > 0) {
        maxRetailValue = balconyPrice + taxes;
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

  const conflictRisk = useMemo(() => {
    const { offer, cruises } = offerData;
    const overlappingBooked = cruises.filter((c) => bookedCruiseIds.has(c.id)).length;
    const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
    const isUsed = offer?.status === 'used';
    const notes: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';

    if (isExpired) {
      notes.push('This offer has already expired based on its expiry date.');
      level = 'high';
    }
    if (isUsed) {
      notes.push('This offer is already marked as used.');
      level = 'high';
    }
    if (overlappingBooked > 0 && overlappingBooked === cruises.length && !isExpired && !isUsed) {
      notes.push('Every matching sailing for this offer is already booked — low conflict risk.');
    } else if (overlappingBooked > 0) {
      notes.push(`${overlappingBooked} of ${cruises.length} matching sailing(s) are already booked on another offer/reservation.`);
      if (level === 'low') level = 'medium';
    }
    if (isExpiringSoon) {
      notes.push(`Expires in ${daysUntilExpiry} day(s) — use it soon or it will lapse.`);
      if (level === 'low') level = 'medium';
    }
    if (notes.length === 0) {
      notes.push('No known conflicts — this offer looks usable as-is.');
    }

    return {
      level,
      overlappingBooked,
      notes,
      summary: 'Conflict Risk flags offers that may not be realistically usable: already expired, already marked used, expiring very soon, or where matching sailings overlap with cruises you\'ve already booked elsewhere.',
    };
  }, [offerData, bookedCruiseIds, daysUntilExpiry, isExpiringSoon]);

  const handleCruisePress = useCallback((cruiseId: string) => {
    console.log('[OfferDetails] Cruise pressed:', cruiseId);
    const cruise = offerData.cruises.find((item: any) => item.id === cruiseId) as any;
    router.push({
      pathname: '/cruise-details' as any,
      params: buildCruiseDetailsParams(cruise, {
        id: cruiseId,
        source: 'offer-details',
        offerCode: offerData.offer?.offerCode || offerInfo.offerCode || '',
      }),
    });
  }, [router, offerData.cruises, offerData.offer?.offerCode, offerInfo.offerCode]);

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
    
    // Calculate retail value range; imported cabin prices are already full-booking totals.
    const taxes = cruise.taxes || 0;
    const interiorPrice = cruise.interiorPrice || 0;
    const suitePrice = cruise.suitePrice || 0;
    
    // Min retail = interior + taxes, Max retail = suite + taxes.
    const minRetailValue = interiorPrice > 0 ? interiorPrice + taxes : 0;
    const maxRetailValue = suitePrice > 0 ? suitePrice + taxes : 0;
    
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
          <TouchableOpacity
            style={styles.summaryStatBox}
            activeOpacity={0.75}
            testID={`offer-casino-days-drill-${item.id}`}
            onPress={(e) => {
              e.stopPropagation();
              drill.open({
                title: 'Casino Days',
                subtitle: `${item.shipName} · ${item.nights} nights`,
                summary: 'Casino Days counts every day this cruise\'s casino is expected to be open based on the itinerary — sea days count fully, port days are excluded (or partial for late-night departures), and overnight port stops are excluded entirely per maritime law.',
                formula: 'Casino Days = Sea Days + Partial-Credit Late-Departure Port Days',
                inputs: [
                  { label: 'Casino Days', value: `${summary.casinoDays} of ${summary.totalDays}` },
                  { label: 'Sea Days', value: String(summary.seaDays) },
                  { label: 'Total Nights', value: String(item.nights) },
                ],
                sourceRecords: [{ label: 'Source', value: 'Itinerary-based assumption', confidence: 'estimated-default' }],
              });
            }}
          >
            <Dice5 size={16} color={summary.statusBadge.color} />
            <Text style={[styles.summaryStatValue, { color: summary.statusBadge.color }]}>
              {summary.casinoDays}
            </Text>
            <Text style={styles.summaryStatLabel}>Casino Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.summaryStatBox}
            activeOpacity={0.75}
            testID={`offer-expected-points-drill-${item.id}`}
            onPress={(e) => {
              e.stopPropagation();
              drill.open({
                title: 'Expected Points',
                subtitle: `${item.shipName} · ${item.nights} nights`,
                summary: 'Expected points project what you\'d likely earn on this sailing using your own playing-hours settings and casino-open days from the itinerary, times your historical points-per-hour rate.',
                formula: 'Expected Points = Casino Days × Golden Hours per Day × Historical Points per Hour',
                inputs: [
                  { label: 'Casino Days', value: String(summary.casinoDays) },
                  { label: 'Golden Hours', value: `${summary.goldenHours}h` },
                  { label: 'Estimated Points', value: `${Math.round(summary.estimatedPoints).toLocaleString()} pts` },
                  { label: 'Coin-In Equivalent', value: `$${Math.round(summary.estimatedPoints * 5).toLocaleString()}` },
                ],
                assumptions: ['Conservative/Base/Aggressive scenarios use your default points-per-hour from Casino Settings unless you\'ve logged enough real sessions to override it.'],
                sourceRecords: [{ label: 'Source', value: 'Projected from your playing-hours settings + itinerary', confidence: 'estimated-default' }],
              });
            }}
          >
            <Star size={16} color={COLORS.goldDark} />
            <Text style={styles.summaryStatValue}>~{(summary.estimatedPoints / 1000).toFixed(1)}k</Text>
            <Text style={styles.summaryStatLabel}>Est. Points</Text>
          </TouchableOpacity>
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

          {/* Cabin Type & Guest Count */}
          {(item.cabinType || offerData.offer?.roomType || item.guests || item.guestsInfo || offerData.offer?.guestsInfo || offerData.offer?.guests) && (
            <View style={styles.cabinGuestRow}>
              {(item.cabinType || offerData.offer?.roomType) && (
                <View style={styles.cabinBadge}>
                  <BedDouble size={13} color="#1E40AF" />
                  <Text style={styles.cabinBadgeText}>{item.cabinType || offerData.offer?.roomType}</Text>
                </View>
              )}
              {(item.guests || item.guestsInfo || offerData.offer?.guestsInfo || offerData.offer?.guests) && (
                <View style={styles.guestBadge}>
                  <Users size={13} color="#7C3AED" />
                  <Text style={styles.guestBadgeText}>
                    {item.guestsInfo || offerData.offer?.guestsInfo || `${item.guests || offerData.offer?.guests || 2} Guest${(item.guests || offerData.offer?.guests || 2) === 1 ? '' : 's'}`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Line 3: Sailing Date + Departure Port with labels */}
          <View style={styles.headerLine3}>
            <View style={styles.headerDetailBlock}>
              <Text style={styles.headerDetailLabel}>Sail Date:</Text>
              <Text style={styles.headerDetailValue}>{formatDate(sailDate, 'medium')}</Text>
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
  }, [bookedCruiseIds, handleCruisePress, getCruiseSummary, offerData.offer?.roomType, offerData.offer?.guests, offerData.offer?.guestsInfo]);

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
            <View style={styles.offerLogoGroup}>
              <Image 
                source={require('../assets/images/easyseas-scott-astin-logo.jpeg')}
                style={styles.offerLogo}
                resizeMode="contain"
              />

            </View>
            <View style={styles.offerNameRow}>
              <Text style={styles.featuredOfferName} numberOfLines={2}>{offerInfo.offerName}</Text>
              {offerInfo.totalValue > 0 && (
                <TouchableOpacity
                  style={styles.totalValueBadge}
                  activeOpacity={0.8}
                  testID="offer-value-drill-trigger"
                  onPress={() => drill.open({
                    title: 'Offer Value',
                    subtitle: offerInfo.offerName,
                    summary: 'The total value of this offer is the retail room price (interior/oceanview/balcony/suite as available) plus taxes and fees, averaged across every cruise this offer applies to, plus any FreePlay, OBC, or trade-in value attached to the offer itself.',
                    formula: 'Offer Value = Room Retail Price + Taxes/Fees + FreePlay + OBC + Trade-In Value',
                    inputs: [
                      { label: 'Room Type', value: offerInfo.roomType || 'Not specified' },
                      { label: 'Retail Price Range', value: offerInfo.minRetailValue && offerInfo.maxRetailValue ? `$${Math.round(offerInfo.minRetailValue).toLocaleString()} – $${Math.round(offerInfo.maxRetailValue).toLocaleString()}` : 'Not available' },
                      { label: 'Taxes/Fees', value: offerInfo.taxesFees ? `$${offerInfo.taxesFees.toLocaleString()}` : '$0' },
                      { label: 'FreePlay', value: `$${(offerInfo.freePlay ?? 0).toLocaleString()}` },
                      { label: 'Onboard Credit', value: `$${(offerInfo.obc ?? 0).toLocaleString()}` },
                      { label: 'Trade-In Value', value: `$${(offerInfo.tradeInValue ?? 0).toLocaleString()}` },
                    ],
                    sourceRecords: [{ label: 'Matching Cruises Used', value: `${offerData.cruises.length} sailing(s)`, confidence: offerData.cruises.length > 0 ? 'verified-invoice' : 'needs-review' }],
                    missing: offerData.cruises.length === 0 ? ['No matching cruises found for this offer code — value is based on the offer record alone.'] : [],
                  })}
                >
                  <DollarSign size={18} color="#166534" />
                  <View>
                    <Text style={styles.totalValueLabel}>Total Value</Text>
                    <Text style={styles.totalValueAmount}>${Math.round(offerInfo.totalValue).toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.fpBadgeOffer}
                  activeOpacity={0.8}
                  testID="offer-freeplay-drill-trigger"
                  onPress={() => drill.open({
                    title: 'FreePlay',
                    subtitle: offerInfo.offerCode,
                    summary: 'FreePlay is casino credit loaded onto your SeaPass card that can only be wagered, not withdrawn directly — winnings from it are yours to keep or cash out.',
                    inputs: [
                      { label: 'FreePlay Amount', value: `$${(offerInfo.freePlay ?? 0).toLocaleString()}` },
                      { label: 'Source Offer Code', value: offerInfo.offerCode },
                      { label: 'Used?', value: offerData.offer?.status === 'used' ? 'Yes — marked used' : 'Not yet marked used' },
                    ],
                    sourceRecords: [
                      { label: 'Included in Win/Loss?', value: 'No — FreePlay wagers/results are tracked in your casino sessions, not added again here to avoid double-counting.' },
                      { label: 'Included in Total Value?', value: 'Yes, unless the Comp Value Calculator or a cruise edit already counted it — check the Duplicate-Counting note on that cruise\'s value breakdown.' },
                    ],
                  })}
                >
                  <Text style={styles.fpLabelOffer}>FreePlay</Text>
                  <Text style={styles.fpValueOffer}>${(offerInfo.freePlay ?? 0).toLocaleString()}</Text>
                </TouchableOpacity>
              )}
              {(offerInfo.obc ?? 0) > 0 && (
                <TouchableOpacity
                  style={styles.obcBadgeOffer}
                  activeOpacity={0.8}
                  testID="offer-obc-drill-trigger"
                  onPress={() => drill.open({
                    title: 'Onboard Credit & Trade-In',
                    subtitle: offerInfo.offerCode,
                    summary: 'Onboard Credit (OBC) reduces what you spend onboard for drinks, dining, shore excursions, and more. Trade-In value is what this offer is worth if exchanged for a different sailing instead of used as-is.',
                    inputs: [
                      { label: 'Onboard Credit', value: `$${(offerInfo.obc ?? 0).toLocaleString()}` },
                      { label: 'Trade-In Value', value: `$${(offerInfo.tradeInValue ?? 0).toLocaleString()}` },
                      { label: 'Expires', value: offerInfo.expiryDate ? formatDate(offerInfo.expiryDate, 'short') : 'No expiry on file' },
                    ],
                    missing: !offerInfo.tradeInValue ? ['No trade-in value on file for this offer.'] : [],
                  })}
                >
                  <Text style={styles.obcLabelOffer}>Onboard Credit</Text>
                  <Text style={styles.obcValueOffer}>${(offerInfo.obc ?? 0).toLocaleString()}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.statsRow}>
            {offerInfo.expiryDate ? (
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
            ) : null}
            <View style={styles.statItem}>
              <Ship size={16} color={COLORS.navyDeep} />
              <View style={styles.statTextGroup}>
                <Text style={styles.statLabel}>Cruises</Text>
                <Text style={styles.statValue}>{offerData.cruises.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.statItem, styles.statItemHighlight, conflictRisk.level !== 'low' && { backgroundColor: 'rgba(217, 119, 6, 0.12)' }]}
              activeOpacity={0.75}
              testID="offer-conflict-risk-drill-trigger"
              onPress={() => drill.open({
                title: 'Conflict Risk',
                subtitle: offerInfo.offerCode,
                summary: conflictRisk.summary,
                inputs: [
                  { label: 'Risk Level', value: conflictRisk.level === 'low' ? 'Low' : conflictRisk.level === 'medium' ? 'Medium' : 'High' },
                  { label: 'Overlapping Booked Cruises', value: String(conflictRisk.overlappingBooked) },
                  { label: 'Offer Status', value: offerData.offer?.status ?? 'available' },
                  { label: 'Expired?', value: daysUntilExpiry !== null && daysUntilExpiry < 0 ? 'Yes — expired' : 'No' },
                ],
                sourceRecords: conflictRisk.notes.map((note) => ({ label: 'Note', value: note })),
                missing: conflictRisk.overlappingBooked === 0 && offerData.cruises.length === 0 ? ['No matching sailings found for this offer code yet — conflict risk cannot be fully assessed.'] : [],
              })}
            >
              <AlertCircle size={16} color={conflictRisk.level === 'low' ? COLORS.navyDeep : COLORS.warning} />
              <View style={styles.statTextGroup}>
                <Text style={styles.statLabel}>Conflict Risk</Text>
                <Text style={[styles.statValue, conflictRisk.level !== 'low' && styles.statValueWarning]}>
                  {conflictRisk.level === 'low' ? 'Low' : conflictRisk.level === 'medium' ? 'Medium' : 'High'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {offerIntelligence ? (
            <View style={styles.intelligencePanel} testID="offer-details-intelligence-panel">
              <View style={styles.intelligenceHeaderRow}>
                <View style={styles.intelligenceScoreBadge}>
                  <Gauge size={18} color="#0F766E" />
                  <Text style={styles.intelligenceScoreText}>{offerIntelligence.score}</Text>
                </View>
                <View style={styles.intelligenceCopy}>
                  <Text style={styles.intelligenceTitle}>Offer Intelligence Score</Text>
                  <Text style={styles.intelligenceSubtitle}>{offerIntelligence.rating} · {offerIntelligence.brandLabel}</Text>
                </View>
              </View>
              <Text style={styles.intelligenceExplanation}>{offerIntelligence.explanation}</Text>
              <View style={styles.calculatorGrid} testID="casino-pays-for-calculator">
                <View style={styles.calculatorCell}>
                  <Text style={styles.calculatorLabel}>Casino Pays</Text>
                  <Text style={styles.calculatorValue}>{formatCurrency(offerIntelligence.casinoPaysFor.casinoCoveredValue)}</Text>
                </View>
                <View style={styles.calculatorCell}>
                  <Text style={styles.calculatorLabel}>You Pay</Text>
                  <Text style={styles.calculatorValue}>{formatCurrency(offerIntelligence.casinoPaysFor.userOutOfPocket)}</Text>
                </View>
                <View style={styles.calculatorCell}>
                  <Text style={styles.calculatorLabel}>Savings</Text>
                  <Text style={styles.calculatorValue}>{offerIntelligence.casinoPaysFor.effectiveSavingsPercentage}%</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.decodeButton}
                onPress={() => setShowDecodedOffer((current) => !current)}
                activeOpacity={0.8}
                testID="offer-details-decode-offer"
              >
                <FileText size={16} color={COLORS.white} />
                <Text style={styles.decodeButtonText}>{showDecodedOffer ? 'Hide Decoded Offer' : 'Decode Offer'}</Text>
              </TouchableOpacity>
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
            </View>
          ) : null}

          {certificateStackingNotes.length > 0 ? (
            <View style={styles.stackingPanel} testID="certificate-stacking-notes">
              <View style={styles.stackingHeaderRow}>
                <Layers size={17} color={COLORS.navyDeep} />
                <Text style={styles.stackingTitle}>Certificate Stacking Notes</Text>
              </View>
              {certificateStackingNotes.map((note) => (
                <View key={note.certificateId} style={styles.stackingItem}>
                  <Text style={styles.stackingLabel}>{note.label}</Text>
                  <Text style={styles.stackingAction}>{note.recommendedAction}</Text>
                  <Text style={styles.stackingWarning}>{note.poorUseWarnings[0]}</Text>
                </View>
              ))}
            </View>
          ) : null}

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
  intelligencePanel: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
  },
  intelligenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  intelligenceScoreBadge: {
    width: 58,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intelligenceScoreText: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: '#0F766E',
    marginTop: 2,
  },
  intelligenceCopy: {
    flex: 1,
  },
  intelligenceTitle: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  intelligenceSubtitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#0F766E',
    marginTop: 2,
  },
  intelligenceExplanation: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  calculatorGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  calculatorCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calculatorLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#64748B',
    marginBottom: 3,
  },
  calculatorValue: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  decodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  decodeButtonText: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  decodedPanel: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  decodedBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: '#F8FAFC',
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
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 64, 175, 0.14)',
  },
  stackingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  stackingTitle: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  stackingItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
