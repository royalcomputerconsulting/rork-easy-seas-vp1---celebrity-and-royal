import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Clock, ExternalLink, Sparkles } from 'lucide-react-native';
import { GlassSurface } from '@/components/premium/GlassSurface';
import { StableRemoteImage } from '@/components/ui/StableRemoteImage';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { DEFAULT_CRUISE_IMAGE, getUniqueImageForCruise } from '@/constants/cruiseImages';
import type { CasinoOffer, Cruise } from '@/types/models';
import { useAppState } from '@/state/AppStateProvider';
import { getCabinPriceFromEntity, GUEST_COUNT_DEFAULT } from '@/lib/valueCalculator';

interface CasinoOfferCardProps {
  offerCode: string;
  offerName: string;
  expiryDate?: string;
  tradeInValue?: number;
  freePlay?: number;
  obc?: number;
  cruises: Cruise[];
  onPress?: () => void;
  onCruisePress?: (cruiseId: string) => void;
  bookedCruiseIds?: Set<string>;
  isActive?: boolean;
  isBestValue?: boolean;
  offerSource?: 'royal' | 'celebrity' | 'carnival';
}

interface OfferSummaryCardProps {
  totalValue: number;
  totalCruises: number;
  totalOffers: number;
  onSoonestPress?: () => void;
  onHighestValuePress?: () => void;
  activeSortMode?: 'soonest' | 'highestValue';
}

const JACKPOT_BG = 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80';

export const OfferSummaryCard = React.memo(function OfferSummaryCard({
  totalValue,
  totalCruises,
  totalOffers,
  onSoonestPress,
  onHighestValuePress,
  activeSortMode = 'soonest',
}: OfferSummaryCardProps) {
  return (
    <View style={summaryStyles.container}>
      <StableRemoteImage
        uri={JACKPOT_BG}
        fallbackUri={DEFAULT_CRUISE_IMAGE}
        style={summaryStyles.backgroundImage}
        recyclingKey="offer-summary-background"
        testID="offer-summary-background-image"
      />
      <LinearGradient colors={['rgba(14, 52, 86, 0.18)', 'rgba(27, 41, 76, 0.48)', 'rgba(18, 28, 58, 0.62)']} style={summaryStyles.overlay}>
        <GlassSurface style={summaryStyles.summaryGlass} contentStyle={summaryStyles.summaryGlassContent}>
          <View style={summaryStyles.summaryHeader}>
            <View>
              <Text style={summaryStyles.summaryEyebrow}>Offer command center</Text>
              <Text style={summaryStyles.summaryTitle}>Your live casino inventory</Text>
            </View>
            <View style={summaryStyles.summaryChip}>
              <Sparkles size={14} color="#F8D56B" />
              <Text style={summaryStyles.summaryChipText}>{totalOffers} offers</Text>
            </View>
          </View>

          <View style={summaryStyles.statRow}>
            <View style={summaryStyles.statBlock}>
              <Text style={summaryStyles.statLabel}>Total Value</Text>
              <Text style={summaryStyles.statValueMoney}>${totalValue > 0 ? totalValue.toLocaleString() : '---'}</Text>
            </View>
            <View style={summaryStyles.statBlock}>
              <Text style={summaryStyles.statLabel}>Cruises</Text>
              <Text style={summaryStyles.statValue}>{totalCruises}</Text>
            </View>
            <View style={summaryStyles.statBlock}>
              <Text style={summaryStyles.statLabel}>Offers</Text>
              <Text style={summaryStyles.statValue}>{totalOffers}</Text>
            </View>
          </View>

          <View style={summaryStyles.summaryActionRow}>
            <TouchableOpacity
              style={[summaryStyles.summaryAction, activeSortMode === 'soonest' && summaryStyles.summaryActionActive]}
              onPress={onSoonestPress}
              activeOpacity={0.85}
            >
              <Text style={[summaryStyles.summaryActionText, activeSortMode === 'soonest' && summaryStyles.summaryActionTextActive]}>Soonest expiring</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[summaryStyles.summaryAction, activeSortMode === 'highestValue' && summaryStyles.summaryActionActive]}
              onPress={onHighestValuePress}
              activeOpacity={0.85}
            >
              <Text style={[summaryStyles.summaryActionText, activeSortMode === 'highestValue' && summaryStyles.summaryActionTextActive]}>Highest value</Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </LinearGradient>
    </View>
  );
});

export const JackpotDealsCard = OfferSummaryCard;

function formatDisplayDate(value: string | undefined): string {
  if (!value) {
    return 'TBD';
  }

  return createDateFromString(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function splitDestinationLines(destinations: string[]): string[] {
  const merged = Array.from(new Set(destinations.map((item) => item.trim()).filter((item) => item.length > 0)));
  if (merged.length >= 3) {
    return merged.slice(0, 3);
  }

  const joined = merged.join(' • ');
  if (joined.length === 0) {
    return [];
  }

  const parts = joined.split(/\s*[•|]|\s*,\s*/).map((item) => item.trim()).filter((item) => item.length > 0);
  return (parts.length > 0 ? parts : [joined]).slice(0, 3);
}

export const CasinoOfferCard = React.memo(function CasinoOfferCard({
  offerCode,
  offerName,
  expiryDate,
  tradeInValue,
  freePlay,
  obc,
  cruises,
  onPress,
  onCruisePress: _onCruisePress,
  bookedCruiseIds: _bookedCruiseIds = new Set(),
  isActive = true,
  isBestValue = false,
  offerSource,
}: CasinoOfferCardProps) {
  const { localData } = useAppState();

  const offerImageUrl = useMemo(() => {
    if (cruises.length > 0) {
      const firstCruise = cruises[0];
      return getUniqueImageForCruise(
        firstCruise.id,
        firstCruise.destination,
        firstCruise.sailDate,
        firstCruise.shipName,
      );
    }

    return DEFAULT_CRUISE_IMAGE;
  }, [cruises]);

  const cardImageUri = offerImageUrl || DEFAULT_CRUISE_IMAGE;

  const offerDetails = useMemo(() => {
    const offer = (localData.offers || []).find((item: CasinoOffer) => item.offerCode === offerCode);

    if (!offer && cruises.length > 0) {
      const firstCruise = cruises[0];
      return {
        roomType: firstCruise.cabinType,
        perks: firstCruise.perks || [],
        receivedDate: undefined,
        tradeInValue: tradeInValue || 0,
        totalCruises: cruises.length,
      };
    }

    return {
      roomType: offer?.roomType || cruises[0]?.cabinType || 'Balcony',
      perks: offer?.perks || [],
      receivedDate: offer?.received,
      tradeInValue: offer?.tradeInValue || tradeInValue || 0,
      totalCruises: cruises.length,
    };
  }, [cruises, localData.offers, offerCode, tradeInValue]);

  const expiryDays = useMemo(() => {
    if (!expiryDate) {
      return null;
    }

    const expiry = createDateFromString(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [expiryDate]);

  const aggregateValue = useMemo(() => {
    if (cruises.length === 0) {
      return null;
    }

    const roomType = String(offerDetails.roomType || 'Balcony');
    const baseRates: Record<string, number> = {
      Interior: 100,
      'Interior GTY': 80,
      Oceanview: 140,
      'Oceanview GTY': 120,
      Balcony: 180,
      'Balcony GTY': 150,
      Suite: 350,
      'Suite GTY': 280,
      'Junior Suite': 320,
      'Grand Suite': 500,
      "Owner's Suite": 600,
    };

    let totalCabinValue = 0;
    let totalTaxesFees = 0;
    let totalOfferValue = 0;

    cruises.forEach((cruise) => {
      let cabinPrice = getCabinPriceFromEntity(cruise, roomType) || cruise.price || 0;

      if (cabinPrice === 0 && cruise.nights > 0) {
        const typeKey = Object.keys(baseRates).find((key) => roomType.toLowerCase().includes(key.toLowerCase())) || 'Balcony';
        cabinPrice = (baseRates[typeKey] || 180) * (cruise.nights || 7);
      }

      const guestCount = cruise.guests || GUEST_COUNT_DEFAULT;
      const cabinValueForTwo = cabinPrice * guestCount;
      let taxesFees = cruise.taxes || 0;

      if (taxesFees === 0 && cruise.nights > 0) {
        taxesFees = Math.round((cruise.nights || 7) * 30 * guestCount);
      }

      totalCabinValue += cabinValueForTwo;
      totalTaxesFees += taxesFees;
      totalOfferValue += cruise.offerValue || 0;
    });

    const firstCruise = cruises[0];
    const totalFreePlay = firstCruise?.freePlay || freePlay || 0;
    const totalOBC = firstCruise?.freeOBC || obc || 0;
    const aggregateTotalValue = totalCabinValue + totalTaxesFees + totalFreePlay + totalOBC + totalOfferValue + (offerDetails.tradeInValue || 0);

    console.log('[CasinoOfferCard] Aggregate value calculated:', {
      offerCode,
      roomType,
      cruiseCount: cruises.length,
      totalCabinValue,
      totalTaxesFees,
      totalFreePlay,
      totalOBC,
      totalOfferValue,
      aggregateTotalValue,
    });

    return {
      aggregateTotalValue,
      cruiseCount: cruises.length,
    };
  }, [cruises, freePlay, obc, offerCode, offerDetails.roomType, offerDetails.tradeInValue]);

  const totalValue = aggregateValue?.aggregateTotalValue || 0;
  const destinationLines = useMemo(() => splitDestinationLines(cruises.map((cruise) => cruise.destination || '')), [cruises]);
  const shipName = cruises[0]?.shipName || 'Cruise Offer';
  const roomType = String(offerDetails.roomType || 'Balcony');

  const statusBadge = useMemo(() => {
    if (!isActive) {
      return { text: 'EXPIRED', colors: ['#DC2626', '#EF4444'] as [string, string] };
    }

    if (isBestValue) {
      return { text: 'BEST VALUE', colors: ['#0F766E', '#14B8A6'] as [string, string] };
    }

    return { text: 'ACTIVE', colors: ['#059669', '#10B981'] as [string, string] };
  }, [isActive, isBestValue]);

  const handleOpenCarnival = async () => {
    if (!onPress || offerSource !== 'carnival') {
      onPress?.();
      return;
    }

    try {
      await Linking.openURL('https://www.carnival.com');
    } catch (error) {
      console.log('[CasinoOfferCard] Error opening Carnival URL:', error);
      onPress();
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.94} testID="casino-offer-card">
      <LinearGradient colors={['#FFFDF9', '#F8F0DB', '#E8F8FC']} style={styles.shellGradient}>
        <View style={styles.headerStrip}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{offerName}</Text>
            <Text style={styles.headerCode}>Code {offerCode}</Text>
          </View>
          <View style={styles.headerValueBlock}>
            <Text style={styles.headerValueLabel}>Total Value ({cruises.length})</Text>
            <Text style={styles.headerValueText}>${totalValue > 0 ? Math.round(totalValue).toLocaleString() : '---'}</Text>
          </View>
        </View>

        <View style={styles.heroSection}>
          <StableRemoteImage
            uri={cardImageUri}
            fallbackUri={DEFAULT_CRUISE_IMAGE}
            style={styles.heroImage}
            recyclingKey={`${offerCode}-hero`}
            testID="casino-offer-card-hero-image"
          />
          <LinearGradient colors={['rgba(7, 20, 36, 0.08)', 'rgba(8, 24, 41, 0.42)', 'rgba(7, 18, 34, 0.92)']} style={styles.heroOverlay} />
          <LinearGradient colors={statusBadge.colors} style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusBadge.text}</Text>
          </LinearGradient>
          {expiryDays !== null && expiryDays <= 7 && expiryDays > 0 ? (
            <View style={styles.urgentPill}>
              <Clock size={12} color="#FFFFFF" />
              <Text style={styles.urgentPillText}>Expires in {expiryDays} days</Text>
            </View>
          ) : null}
          <GlassSurface style={styles.heroInfoPill} contentStyle={styles.heroInfoPillContent}>
            <Sparkles size={13} color="#FFFFFF" />
            <Text style={styles.heroInfoText}>
              {offerSource === 'carnival' ? 'Tap to view on Carnival.com' : `${cruises.length} cruises available`}
            </Text>
          </GlassSurface>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.primaryRow}>
            <View style={styles.destinationBlock}>
              <Text style={styles.eyebrow}>Destinations</Text>
              {destinationLines.length > 0 ? destinationLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.destinationLine} numberOfLines={1}>{line}</Text>
              )) : (
                <Text style={styles.destinationLine}>Curated casino sailings</Text>
              )}
            </View>

            <View style={styles.valueBlock}>
              <Text style={styles.valueEyebrow}>Value</Text>
              <Text style={styles.valueText}>${totalValue > 0 ? Math.round(totalValue).toLocaleString() : '---'}</Text>
              <Text style={styles.valueHint}>{cruises.length} sailings</Text>
            </View>
          </View>

          <GlassSurface style={styles.infoPanel} contentStyle={styles.infoPanelContent}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Room Type</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{roomType}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Expires</Text>
              <Text style={[styles.infoValue, expiryDays !== null && expiryDays <= 7 && expiryDays > 0 ? styles.infoValueUrgent : null]} numberOfLines={1}>{formatDisplayDate(expiryDate)}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ship</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{shipName}</Text>
            </View>
          </GlassSurface>

          <LinearGradient colors={offerSource === 'carnival' ? ['#B91C1C', '#DC2626'] : ['#0E3554', '#0A4C62', '#12706D']} style={styles.ctaButton}>
            <TouchableOpacity
              style={styles.ctaButtonInner}
              onPress={offerSource === 'carnival' ? handleOpenCarnival : onPress}
              activeOpacity={0.85}
              testID="casino-offer-card-view-all-button"
            >
              {offerSource === 'carnival' ? <ExternalLink size={18} color="#FFFFFF" /> : null}
              <Text style={styles.ctaText}>{offerSource === 'carnival' ? 'View cruises on Carnival.com' : `View all ${cruises.length} cruises`}</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const summaryStyles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    backgroundColor: '#F9F4EC',
    ...SHADOW.lg,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    padding: SPACING.lg,
  },
  summaryGlass: {
    borderRadius: 28,
    backgroundColor: 'rgba(255, 248, 239, 0.94)',
    borderColor: 'rgba(255,255,255,0.30)',
  },
  summaryGlassContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  summaryEyebrow: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: 'rgba(17,17,17,0.56)',
  },
  summaryTitle: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: '800' as const,
    color: '#111111',
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  summaryChipText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#111111',
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBlock: {
    flex: 1,
    borderRadius: 22,
    padding: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: 'rgba(17,17,17,0.56)',
  },
  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#111111',
  },
  statValueMoney: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#0F766E',
  },
  summaryActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  summaryActionActive: {
    backgroundColor: '#111111',
  },
  summaryActionText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#111111',
  },
  summaryActionTextActive: {
    color: '#FFFFFF',
  },
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.22)',
    ...SHADOW.lg,
  },
  shellGradient: {
    borderRadius: 30,
    backgroundColor: '#FFF9EF',
  },
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(255, 249, 241, 0.84)',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#171630',
    letterSpacing: -0.5,
  },
  headerCode: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#7B6541',
  },
  headerValueBlock: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 252, 247, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    minWidth: 126,
  },
  headerValueLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#846A1F',
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  headerValueText: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800' as const,
    color: COLORS.moneyDark,
  },
  heroSection: {
    height: 196,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  statusPill: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  urgentPill: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
  },
  urgentPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  heroInfoPill: {
    position: 'absolute',
    left: SPACING.md,
    bottom: SPACING.md,
    borderRadius: 18,
  },
  heroInfoPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroInfoText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  contentSection: {
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: 'rgba(255, 252, 247, 0.82)',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  destinationBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(17, 33, 52, 0.54)',
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  destinationLine: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    color: '#12263C',
  },
  valueBlock: {
    minWidth: 118,
    alignItems: 'flex-end',
  },
  valueEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(17, 33, 52, 0.54)',
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  valueText: {
    marginTop: 6,
    fontSize: 32,
    fontWeight: '800' as const,
    color: COLORS.moneyDark,
    letterSpacing: -1,
  },
  valueHint: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(18, 38, 60, 0.58)',
  },
  infoPanel: {
    borderRadius: 24,
  },
  infoPanelContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  infoItem: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
  },
  infoDivider: {
    width: 1,
    backgroundColor: 'rgba(17,17,17,0.08)',
    marginVertical: 8,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: 'rgba(18, 38, 60, 0.56)',
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
  },
  infoValue: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#12263C',
  },
  infoValueUrgent: {
    color: COLORS.error,
  },
  ctaButton: {
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  ctaButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
  },
  ctaText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
});
