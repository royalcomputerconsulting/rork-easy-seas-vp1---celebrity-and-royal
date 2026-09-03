import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Linking } from 'react-native';
import { 
  X,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Ship,
  DollarSign,
  Tag,
  Gauge,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, COLORS } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { getUniqueImageForCruise, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import type { Cruise, CasinoOffer } from '@/types/models';
import type { OfferRatingLabel } from '@/lib/offerIntelligence';
import { useAppState } from '@/state/AppStateProvider';
import { getCertificatePdfMatch, openCertificatePdf } from '@/lib/royalCaribbean/certificatePdf';
import { knownNightCount } from '@/lib/cruiseRecordIntegrity';
import { normalizeOfferValue } from '@/lib/offers/offerValueNormalization';
import { resolveOfferCabinEntitlement, resolveOfferGuestEntitlement, resolveOfferPointRequirement } from '@/lib/offers/offerDisplayTruth';
import type { CruiseOfferSailingSummary } from '@/lib/cruiseInventory/CruiseInventoryRepository';

interface CasinoOfferCardProps {
  offerId?: string;
  offerCode: string;
  offerName: string;
  expiryDate?: string;
  tradeInValue?: number;
  freePlay?: number;
  obc?: number;
  cruises: Cruise[];
  cruiseCountOverride?: number;
  cruiseCountLoading?: boolean;
  sailingSummary?: CruiseOfferSailingSummary;
  onPress?: () => void;
  onCruisePress?: (cruiseId: string) => void;
  bookedCruiseIds?: Set<string>;
  isActive?: boolean;
  isBestValue?: boolean;
  intelligenceScore?: number;
  intelligenceRating?: OfferRatingLabel;
  intelligenceExplanation?: string;
  onDecodePress?: () => void;
}

interface OfferSummaryCardProps {
  totalValue: number;
  totalCruises: number;
  totalOffers: number;
  onSoonestPress?: () => void;
  onHighestValuePress?: () => void;
  activeSortMode?: 'soonest' | 'highestValue';
  isLoading?: boolean;
}

export const OfferSummaryCard = React.memo(function OfferSummaryCard({
  totalValue,
  totalCruises,
  totalOffers,
  onSoonestPress,
  onHighestValuePress,
  activeSortMode = 'soonest',
  isLoading = false,
}: OfferSummaryCardProps) {
  return (
    <View style={summaryStyles.container} testID="offers-overview-card">
      <View style={summaryStyles.header}>
        <View>
          <Text style={summaryStyles.title}>Offer portfolio</Text>
        </View>
        <View style={summaryStyles.titleIcon}>
          <Sparkles size={19} color="#0E7FA7" />
        </View>
      </View>

      <View style={summaryStyles.statsRow}>
        <View style={summaryStyles.statItem}>
          <DollarSign size={18} color="#0E7FA7" />
          <Text style={summaryStyles.statValue}>{isLoading ? '…' : totalValue > 0 ? `$${totalValue.toLocaleString()}` : '—'}</Text>
          <Text style={summaryStyles.statLabel}>Estimated value</Text>
        </View>
        <View style={summaryStyles.statDivider} />
        <View style={summaryStyles.statItem}>
          <Tag size={18} color="#0E7FA7" />
          <Text style={summaryStyles.statValue}>{isLoading ? '…' : totalOffers.toLocaleString()}</Text>
          <Text style={summaryStyles.statLabel}>Active offers</Text>
        </View>
        <View style={summaryStyles.statDivider} />
        <View style={summaryStyles.statItem}>
          <Ship size={18} color="#0E7FA7" />
          <Text style={summaryStyles.statValue}>{isLoading ? '…' : totalCruises.toLocaleString()}</Text>
          <Text style={summaryStyles.statLabel}>Eligible sailings</Text>
        </View>
      </View>

      <View style={summaryStyles.buttonRow}>
        <TouchableOpacity
          style={[summaryStyles.filterButton, activeSortMode === 'soonest' && summaryStyles.filterButtonActive]}
          onPress={onSoonestPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: activeSortMode === 'soonest' }}
          testID="offers-sort-soonest"
        >
          <Text style={[summaryStyles.filterButtonText, activeSortMode === 'soonest' && summaryStyles.filterButtonTextActive]}>Soonest expiring</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[summaryStyles.filterButton, activeSortMode === 'highestValue' && summaryStyles.filterButtonActive]}
          onPress={onHighestValuePress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: activeSortMode === 'highestValue' }}
          testID="offers-sort-value"
        >
          <Text style={[summaryStyles.filterButtonText, activeSortMode === 'highestValue' && summaryStyles.filterButtonTextActive]}>Highest value</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Keep JackpotDealsCard for backwards compatibility but mark as deprecated
/** @deprecated Use OfferSummaryCard instead */
export const JackpotDealsCard = OfferSummaryCard;

const summaryStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 14,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#167C80',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 21,
    lineHeight: 27,
    color: '#17324D',
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF4F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    backgroundColor: '#F7F9FA',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    color: '#66737F',
    textAlign: 'center',
    marginTop: 2,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 19,
    lineHeight: 23,
    color: '#17324D',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#D9E1E6',
    marginHorizontal: SPACING.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#FFFCF7',
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B9C9C8',
  },
  filterButtonActive: {
    backgroundColor: '#167C80',
    borderColor: '#167C80',
  },
  filterButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    color: '#425466',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
});

export const CasinoOfferCard = React.memo(function CasinoOfferCard({
  offerId,
  offerCode,
  offerName,
  expiryDate,
  tradeInValue,
  freePlay,
  obc,
  cruises,
  cruiseCountOverride,
  cruiseCountLoading = false,
  sailingSummary,
  onPress,
  onCruisePress: _onCruisePress,
  bookedCruiseIds: _bookedCruiseIds = new Set(),
  isActive = true,
  isBestValue = false,
  intelligenceScore,
  intelligenceRating,
  intelligenceExplanation,
  onDecodePress,
}: CasinoOfferCardProps) {
  const { localData } = useAppState();
  const [showOfferImage, setShowOfferImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showScoreEvidence, setShowScoreEvidence] = useState(false);

  const offerImageUrl = useMemo(() => {
    if (cruises.length > 0) {
      const firstCruise = cruises[0];
      return getUniqueImageForCruise(
        firstCruise.id,
        firstCruise.destination,
        firstCruise.sailDate,
        firstCruise.shipName
      );
    }
    return DEFAULT_CRUISE_IMAGE;
  }, [cruises]);

  const [cardImageUri, setCardImageUri] = useState<string>(offerImageUrl);
  const certificatePdfMatch = useMemo(() => {
    return getCertificatePdfMatch({ offerCode, offerName });
  }, [offerCode, offerName]);

  const savedOffer = useMemo(() => {
    const offers = (localData.offers || []) as CasinoOffer[];
    const exact = offerId ? offers.find((offer) => offer.id === offerId) : undefined;
    if (exact) return exact;
    const codeMatches = offers.filter((offer) => offer.offerCode === offerCode);
    return codeMatches.length === 1 ? codeMatches[0] : undefined;
  }, [localData.offers, offerCode, offerId]);

  const offerDetails = useMemo(() => {
    const offer = savedOffer;
    
    const sailingCabins = Array.from(new Set(cruises
      .map((cruise) => String(cruise.cabinType || '').trim())
      .filter(Boolean)));
    const sailingRoomType = sailingCabins.length === 1
      ? sailingCabins[0]
      : sailingCabins.length > 1
        ? 'Varies by sailing'
        : undefined;

    if (!offer && cruises.length > 0) {
      const firstCruise = cruises[0];
      const guestTruth = resolveOfferGuestEntitlement(undefined, cruises);
      return {
        roomType: sailingRoomType || firstCruise.cabinType,
        guestCount: guestTruth.value ?? undefined,
        guestCountsVary: guestTruth.varies,
        perks: firstCruise.perks || [],
        receivedDate: undefined,
        updatedAt: undefined,
        sourceLabel: 'Eligible sailing catalog',
        tradeInValue: tradeInValue || 0,
        totalCruises: cruises.length,
        totalValue: 0,
        averageValue: 0,
      };
    }

    const totalValue = cruises.reduce((sum, cruise) => {
      const price = cruise.totalPrice || cruise.price || 0;
      return sum + price;
    }, 0);

    const averageValue = cruises.length > 0 ? totalValue / cruises.length : 0;
    const guestTruth = resolveOfferGuestEntitlement(offer, cruises);
    const offerRecord = offer as (CasinoOffer & { source?: string; parserSource?: string; provider?: string }) | undefined;
    const rawSource = offerRecord?.provider || offerRecord?.parserSource || offerRecord?.source || offer?.offerSource;
    const sourceLabel = rawSource
      ? `${String(rawSource).replace(/[_-]+/g, ' ')}${offer?.updatedAt ? ` · ${new Date(offer.updatedAt).toLocaleDateString()}` : ''}`
      : 'Saved offer catalog';

    return {
      roomType: sailingRoomType || offer?.roomType || offer?.cabinType || 'Not supplied by Royal',
      guestCount: guestTruth.value ?? undefined,
      guestCountsVary: guestTruth.varies,
      perks: offer?.perks || [],
      receivedDate: offer?.received,
      updatedAt: offer?.updatedAt,
      sourceLabel,
      tradeInValue: offer?.tradeInValue || tradeInValue || 0,
      totalCruises: cruises.length,
      totalValue,
      averageValue,
    };
  }, [cruises, savedOffer, tradeInValue]);
  
  const getActualOfferImageUrl = (code: string): string => {
    return `https://image.royalcaribbeanmarketing.com/lib/fe9415737666017570/m/1/${code}.jpg`;
  };

  const handleOpenInBrowser = async () => {
    const url = getActualOfferImageUrl(offerCode);
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('[CasinoOfferCard] Error opening URL:', error);
    }
  };

  const handleOpenCertificatePdf = useCallback(() => {
    if (!certificatePdfMatch) {
      console.log('[CasinoOfferCard] No certificate PDF available for offer:', offerCode);
      return;
    }

    void openCertificatePdf(certificatePdfMatch.pdfUrl);
  }, [certificatePdfMatch, offerCode]);

  const getStatusBadge = () => {
    if (!isActive) {
      return { text: 'Expired', bg: '#A52B34' };
    }
    if (isBestValue) {
      return { text: 'Best value', bg: COLORS.success };
    }
    return { text: 'Active', bg: COLORS.success };
  };

  const statusBadge = getStatusBadge();

  const scoreColor = useMemo(() => {
    if (intelligenceScore === undefined) return COLORS.navyDeep;
    if (intelligenceScore >= 85) return '#16755F';
    if (intelligenceScore >= 70) return '#0F766E';
    if (intelligenceScore >= 50) return '#B45309';
    return '#B91C1C';
  }, [intelligenceScore]);

  const getExpiryDaysLeft = () => {
    if (!expiryDate) return null;
    const expiry = createDateFromString(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const expiryDays = getExpiryDaysLeft();

  const displayedCruiseCount = sailingSummary?.total ?? cruiseCountOverride ?? offerDetails.totalCruises;
  const cruiseCountLabel = cruiseCountLoading && displayedCruiseCount === 0
    ? 'Loading cruises…'
    : `${displayedCruiseCount} cruise${displayedCruiseCount !== 1 ? 's' : ''} available`;
  const pointTruth = useMemo(() => resolveOfferPointRequirement(savedOffer ?? { offerCode }, cruises), [cruises, offerCode, savedOffer]);
  const cabinTruth = useMemo(() => resolveOfferCabinEntitlement(savedOffer, cruises), [cruises, savedOffer]);
  const guestTruth = useMemo(() => resolveOfferGuestEntitlement(savedOffer, cruises), [cruises, savedOffer]);
  const displayedPointTruth = useMemo(() => {
    const values = sailingSummary?.pointRequirements ?? [];
    if (values.length === 1) return { ...pointTruth, value: values[0], label: values[0].toLocaleString(), evidence: 'sailing_rows' as const, source: 'All eligible sailing rows', varies: false };
    if (values.length > 1) return { ...pointTruth, value: null, label: 'Varies by sailing', evidence: 'sailing_rows' as const, source: 'All eligible sailing rows', varies: true };
    return pointTruth;
  }, [pointTruth, sailingSummary?.pointRequirements]);
  const displayedCabinTruth = useMemo(() => {
    const values = sailingSummary?.cabinTypes ?? [];
    if (values.length === 1) return { ...cabinTruth, value: values[0], label: values[0], evidence: 'sailing_rows' as const, source: 'All eligible sailing rows', varies: false };
    if (values.length > 1) return { ...cabinTruth, value: null, label: 'Varies by sailing', evidence: 'sailing_rows' as const, source: `${values.length} stateroom categories`, varies: true };
    return cabinTruth;
  }, [cabinTruth, sailingSummary?.cabinTypes]);
  const displayedGuestTruth = useMemo(() => {
    const values = sailingSummary?.guestCounts ?? [];
    if (values.length === 1) return { ...guestTruth, value: values[0], label: `${values[0]} guest${values[0] === 1 ? '' : 's'}`, evidence: 'sailing_rows' as const, source: 'All eligible sailing rows', varies: false };
    if (values.length > 1) return { ...guestTruth, value: null, label: values.map((value) => `${value}-guest`).join(' / '), evidence: 'sailing_rows' as const, source: 'Varies by eligible sailing', varies: true };
    return guestTruth;
  }, [guestTruth, sailingSummary?.guestCounts]);

  const normalizedOfferValue = useMemo(() => {
    return normalizeOfferValue(
      savedOffer ?? {
        id: offerId || offerCode,
        offerCode,
        roomType: offerDetails.roomType,
        guests: offerDetails.guestCount,
        value: offerDetails.tradeInValue || undefined,
        freePlay,
        obcAmount: obc,
      },
      cruises,
    );
  }, [cruises, freePlay, obc, offerCode, offerDetails.guestCount, offerDetails.roomType, offerDetails.tradeInValue, offerId, savedOffer]);

  const representativeEstimatedValue = useMemo(() => {
    if (cruises.length === 0) return 0;
    const cabin = String(offerDetails.roomType || '').toLowerCase();
    const nightlyRate = cabin.includes('suite') ? 350
      : cabin.includes('balcony') ? 180
        : cabin.includes('ocean') ? 140
          : cabin.includes('interior') ? 100
            : 0;
    if (nightlyRate === 0) return 0;
    const nights = cruises.map((cruise) => knownNightCount(cruise.nights)).filter((value): value is number => Boolean(value)).sort((a, b) => a - b);
    if (nights.length === 0) return 0;
    const middle = Math.floor(nights.length / 2);
    const medianNights = nights.length % 2 ? nights[middle] : (nights[middle - 1] + nights[middle]) / 2;
    return Math.round(nightlyRate * medianNights * 2);
  }, [cruises, offerDetails.roomType]);
  const displayedStateroomValue = normalizedOfferValue.components.cabinRetail.value ?? representativeEstimatedValue;
  const displayedStateroomValueIsEstimate = normalizedOfferValue.components.cabinRetail.evidence !== 'provider' && displayedStateroomValue > 0;
  const indexedValueRange = sailingSummary?.minimumRoomValue != null && sailingSummary?.maximumRoomValue != null
    ? { minimum: sailingSummary.minimumRoomValue, maximum: sailingSummary.maximumRoomValue }
    : null;
  const displayedStateroomValueLabel = indexedValueRange
    ? indexedValueRange.minimum === indexedValueRange.maximum
      ? `$${Math.round(indexedValueRange.minimum).toLocaleString()}`
      : `$${Math.round(indexedValueRange.minimum).toLocaleString()}–$${Math.round(indexedValueRange.maximum).toLocaleString()}`
    : `$${displayedStateroomValue > 0 ? Math.round(displayedStateroomValue).toLocaleString() : '—'}`;

  const uniqueDestinations = useMemo(() => {
    const destinations = new Set<string>();
    cruises.forEach(cruise => {
      if (cruise.destination) {
        destinations.add(cruise.destination);
      }
    });
    return Array.from(destinations);
  }, [cruises]);

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      testID="casino-offer-card"
    >
      <View style={styles.offerHeaderSection}>
        <View style={styles.offerTitleCopy}>
          <Text style={styles.offerEyebrow}>Casino offer</Text>
          <Text style={styles.offerNameHeader}>{offerName}</Text>
          <Text style={styles.offerCodeText}>{offerCode}</Text>
        </View>
        <View style={[styles.statusBadgeLarge, { backgroundColor: statusBadge.bg }]}> 
          <Text style={styles.statusBadgeLargeText}>{statusBadge.text}</Text>
        </View>
      </View>

      <View style={styles.imageSection}>
        <Image 
          source={{ uri: cardImageUri }} 
          style={styles.heroImage}
          resizeMode="cover"
          onError={() => setCardImageUri(DEFAULT_CRUISE_IMAGE)}
        />
        
        {expiryDays !== null && expiryDays <= 7 && expiryDays > 0 && (
          <View style={styles.expiryAlertBadge}>
            <Clock size={14} color={COLORS.white} />
            <Text style={styles.expiryAlertText}>Expires in {expiryDays} days</Text>
          </View>
        )}

        <View style={styles.cruiseCountBadge}>
          <Text style={styles.cruiseCountBadgeText}>
            {cruiseCountLabel}
          </Text>
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.offerFactsGrid} testID="casino-offer-card.primary-facts">
          <View style={styles.offerFact}>
            <Text style={styles.offerFactLabel}>Points level</Text>
            <Text style={styles.offerFactValue}>{displayedPointTruth.label}</Text>
            <Text style={styles.offerFactSource} numberOfLines={2}>{displayedPointTruth.source}</Text>
          </View>
          <View style={styles.offerFact}>
            <Text style={styles.offerFactLabel}>Guests</Text>
            <Text style={styles.offerFactValue} numberOfLines={2}>{displayedGuestTruth.label}</Text>
            <Text style={styles.offerFactSource} numberOfLines={2}>{displayedGuestTruth.source}</Text>
          </View>
          <View style={styles.offerFact}>
            <Text style={styles.offerFactLabel}>Stateroom</Text>
            <Text style={styles.offerFactValue} numberOfLines={2}>{displayedCabinTruth.label}</Text>
            <Text style={styles.offerFactSource} numberOfLines={2}>{displayedCabinTruth.source}</Text>
          </View>
          <View style={styles.offerFact}>
            <Text style={styles.offerFactLabel}>{displayedStateroomValueIsEstimate ? 'Est. stateroom value' : 'Stateroom value'}</Text>
            <Text style={styles.offerFactValue}>{displayedStateroomValueLabel}</Text>
            <Text style={styles.offerFactSource} numberOfLines={2}>
              {indexedValueRange ? 'All eligible sailing prices' : normalizedOfferValue.components.cabinRetail.sourceField || 'No eligible sailing price'}
            </Text>
          </View>
        </View>

        {normalizedOfferValue.faceValue.evidence === 'provider' && normalizedOfferValue.faceValue.value != null ? (
          <View style={styles.providerValueStrip} testID="casino-offer-card.provider-offer-value">
            <DollarSign size={15} color="#167C80" />
            <Text style={styles.providerValueText}>
              Provider offer value ${Math.round(normalizedOfferValue.faceValue.value).toLocaleString()} · {normalizedOfferValue.faceValue.sourceField}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaSummaryRow}>
          <View style={styles.metaSummaryItem}>
            <Ship size={15} color="#167C80" />
            <Text style={styles.metaSummaryText}>{cruiseCountLabel}</Text>
          </View>
          {expiryDate ? (
            <View style={styles.metaSummaryItem}>
              <Clock size={15} color={expiryDays !== null && expiryDays <= 7 ? '#A52B34' : '#167C80'} />
              <Text style={[styles.metaSummaryText, expiryDays !== null && expiryDays <= 7 && styles.metaSummaryUrgent]}>
                Expires {createDateFromString(expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          ) : null}
        </View>

        {uniqueDestinations.length > 0 && (
          <View style={styles.destinationsRow}>
            <Text style={styles.destLabel}>Destinations</Text>
            <Text style={styles.destValue} numberOfLines={2}>
              {uniqueDestinations.join(' • ')}
            </Text>
          </View>
        )}

        {intelligenceScore !== undefined ? (
          <View style={styles.intelligenceStrip} testID="casino-offer-card.intelligence-score">
            <View style={[styles.scorePuck, { borderColor: scoreColor }]}> 
              <Gauge size={16} color={scoreColor} />
              <Text style={[styles.scorePuckValue, { color: scoreColor }]}>{intelligenceScore}</Text>
            </View>
            <View style={styles.scoreCopy}>
              <Text style={styles.scoreTitle}>{intelligenceRating ?? 'Scored'} offer</Text>
              <Text style={styles.scoreSubtitle}>Planning score · {intelligenceScore}/100</Text>
            </View>
            <TouchableOpacity
              style={styles.scoreEvidenceButton}
              onPress={(event) => {
                event.stopPropagation();
                setShowScoreEvidence((current) => !current);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showScoreEvidence }}
              testID="casino-offer-card.why-score"
            >
              <Text style={styles.scoreEvidenceButtonText}>Why this score?</Text>
              {showScoreEvidence ? <ChevronUp size={15} color="#17324D" /> : <ChevronDown size={15} color="#17324D" />}
            </TouchableOpacity>
          </View>
        ) : null}

        {showScoreEvidence ? (
          <View style={styles.scoreEvidencePanel} testID="casino-offer-card.score-evidence">
            <Text style={styles.scoreEvidenceText}>{intelligenceExplanation || 'The score combines expiration timing, estimated casino-paid value, cabin entitlement, eligible-sailing inventory, and saved traveler fit.'}</Text>
            <Text style={styles.scoreEvidenceFormula}>Derived planning score — verify official terms before booking.</Text>
          </View>
        ) : null}

        <View style={styles.provenanceRow} testID="casino-offer-card.provenance">
          <Text style={styles.provenanceLabel}>Source</Text>
          <Text style={styles.provenanceValue} numberOfLines={3}>
            {offerDetails.sourceLabel} · Points: {displayedPointTruth.evidence} · Cabin: {displayedCabinTruth.evidence} · Value: {indexedValueRange ? 'all sailing rows' : normalizedOfferValue.components.cabinRetail.evidence}
          </Text>
        </View>

        <View style={styles.actionRowLarge}>
          <TouchableOpacity style={styles.primaryButtonLarge} onPress={onPress} testID="casino-offer-card.view-all-cruises">
            <Text style={styles.primaryButtonTextLarge}>View eligible sailings</Text>
            <ChevronRight size={18} color={COLORS.white} />
          </TouchableOpacity>

          {onDecodePress ? (
            <TouchableOpacity
              style={styles.secondaryButtonLarge}
              onPress={(event) => {
                event.stopPropagation();
                onDecodePress();
              }}
              testID="casino-offer-card.decode-offer"
            >
              <FileText size={16} color={COLORS.navyDeep} />
              <Text style={styles.secondaryButtonLargeText}>Decode</Text>
            </TouchableOpacity>
          ) : null}

          {certificatePdfMatch ? (
            <TouchableOpacity
              style={styles.secondaryButtonLarge}
              onPress={(event) => {
                event.stopPropagation();
                handleOpenCertificatePdf();
              }}
              testID="casino-offer-card.view-pdf-of-offer"
            >
              <ExternalLink size={16} color={COLORS.navyDeep} />
              <Text style={styles.secondaryButtonLargeText}>PDF</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Modal
        visible={showOfferImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOfferImage(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Offer: {offerCode}</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowOfferImage(false)}
              >
                <X size={24} color="#676A70" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalImageContainer}>
              {imageError ? (
                <View style={styles.imageErrorContainer}>
                  <Text style={styles.imageErrorTitle}>Image Not Available</Text>
                  <Text style={styles.imageErrorText}>
                    This offer code ({offerCode}) does not have an image on Royal Caribbean&apos;s server.
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: getActualOfferImageUrl(offerCode) }}
                  style={styles.modalImage}
                  resizeMode="contain"
                  onError={() => setImageError(true)}
                />
              )}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.openInBrowserButton}
                onPress={handleOpenInBrowser}
              >
                <ExternalLink size={16} color={COLORS.navyDeep} />
                <Text style={styles.openInBrowserText}>Open in Browser</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setShowOfferImage(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  offerHeaderSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E3DDD4',
  },
  offerTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  offerEyebrow: {
    color: '#167C80',
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  offerNameHeader: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 18,
    color: '#17324D',
    lineHeight: 23,
    marginBottom: 2,
  },
  offerCodeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#66737F',
    letterSpacing: 0.4,
  },
  offerCodeHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
  },
  offerCodeHeaderText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  imageSection: {
    height: 116,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  statusBadgeLarge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeLargeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  expiryAlertBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#A52B34',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  expiryAlertText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  cruiseCountBadge: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.85)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cruiseCountBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  contentSection: {
    padding: 14,
  },
  offerFactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 10,
  },
  offerFact: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 70,
    backgroundColor: '#F7F9FA',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 12,
    padding: 9,
  },
  offerFactLabel: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#66737F',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  offerFactValue: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 17,
    lineHeight: 21,
    color: '#17324D',
  },
  offerFactSource: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: '#66737F',
  },
  providerValueStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#C6DEDC',
    backgroundColor: '#EDF4F3',
  },
  providerValueText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    color: '#17324D',
  },
  metaSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 5,
    marginBottom: 10,
  },
  metaSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaSummaryText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#425466',
    fontWeight: '600' as const,
  },
  metaSummaryUrgent: {
    color: '#A52B34',
  },
  intelligenceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#EDF4F3',
    borderWidth: 1,
    borderColor: '#C6DEDC',
    borderRadius: 12,
    padding: 9,
    marginBottom: 8,
  },
  scorePuck: {
    minWidth: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: '#FFFCF7',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePuckValue: {
    fontSize: 18,
    fontWeight: '900' as const,
    marginTop: 2,
  },
  scoreCopy: {
    flex: 1,
    minWidth: 78,
  },
  scoreTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.6,
  },
  scoreSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginTop: 2,
  },
  scoreEvidenceButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 7,
  },
  scoreEvidenceButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#17324D',
  },
  scoreEvidencePanel: {
    backgroundColor: '#FFF9EA',
    borderWidth: 1,
    borderColor: '#E8D5A2',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  scoreEvidenceText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  scoreEvidenceFormula: {
    color: '#7A5A0A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    marginTop: 7,
  },
  provenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E3DDD4',
    paddingTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  provenanceLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#167C80',
    letterSpacing: 0.8,
  },
  provenanceValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#66737F',
  },
  keyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  roomTypeBadge: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  roomTypeBadgeLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  roomTypeBadgeValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F5F4',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  expiryBadgeUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  expiryBadgeLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
  },
  expiryBadgeValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  expiryBadgeValueUrgent: {
    color: '#A52B34',
  },
  totalValueCompact: {
    marginLeft: 'auto' as const,
    alignItems: 'flex-end',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  totalValueCompactLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
  totalValueCompactAmount: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#2E7D32',
  },
  destinationsRow: {
    marginBottom: SPACING.md,
  },
  destLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  destValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  metaRowLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  metaItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTextLarge: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  cabinBadgeLarge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  cabinBadgeLargeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  divider: {
    height: 1,
    backgroundColor: '#D5D5D0',
    marginBottom: SPACING.lg,
  },
  valueSectionLarge: {
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  valueBreakdownSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
  },
  valueBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  valueBreakdownLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  valueBreakdownAmount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  valueRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valueColumn: {},
  valueLabelLarge: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  valueAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  valueDollarLarge: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginTop: 4,
  },
  valueAmountLarge: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  tradeInColumn: {
    alignItems: 'flex-end',
  },
  tradeInValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeInAmountLarge: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  perksSectionLarge: {
    marginBottom: SPACING.lg,
  },
  perksHeaderLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  perkItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  perkTextContainer: {},
  perkLabelLarge: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  perkValueLarge: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  actionRowLarge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  primaryButtonLarge: {
    flex: 1,
    minWidth: 180,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17324D',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
  },
  primaryButtonTextLarge: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  secondaryButtonLarge: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFCF7',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9C9C8',
  },
  secondaryButtonLargeText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#D5D5D0',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1F2937',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '100%',
    aspectRatio: 0.65,
    backgroundColor: '#F9FAFB',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  openInBrowserButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.goldAccent,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  openInBrowserText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  closeModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F2',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  closeModalButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#676A70',
  },
  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  imageErrorTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  imageErrorText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#676A70',
    textAlign: 'center',
  },
});
