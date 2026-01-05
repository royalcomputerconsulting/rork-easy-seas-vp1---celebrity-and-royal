import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle,
  ChevronRight,
  Clock,
  Ship,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { formatCurrency } from '@/lib/format';
import { getDaysUntil, createDateFromString } from '@/lib/date';
import { getUniqueImageForCruise, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import type { Cruise } from '@/types/models';
import { calculateCruiseValue, calculateOfferAggregateValue, getCabinPriceFromEntity, GUEST_COUNT_DEFAULT, type ValueBreakdown, type OfferAggregateValue } from '@/lib/valueCalculator';

interface OfferCardProps {
  offer: Cruise;
  allCruises?: Cruise[];
  onPress?: () => void;
  isBooked?: boolean;
  recommended?: boolean;
  showImage?: boolean;
  compact?: boolean;
  showValueBreakdown?: boolean;
}



function getOfferImage(offer: Cruise): string {
  if (offer.imageUrl) return offer.imageUrl;
  return getUniqueImageForCruise(
    offer.id,
    offer.destination,
    offer.sailDate,
    offer.shipName,
  );
}

export function OfferCard({
  offer,
  allCruises = [],
  onPress,
  isBooked = false,
  recommended = false,
  showImage = true,
  compact = false,
  showValueBreakdown = false,
}: OfferCardProps) {
  const isExpiringSoon = offer.offerExpiry
    ? getDaysUntil(offer.offerExpiry) <= 7 && getDaysUntil(offer.offerExpiry) > 0
    : false;

  const imageUrl = getOfferImage(offer);
  const [heroImageUri, setHeroImageUri] = useState<string>(imageUrl || DEFAULT_CRUISE_IMAGE);

  useEffect(() => {
    setHeroImageUri(imageUrl || DEFAULT_CRUISE_IMAGE);
  }, [imageUrl]);

  const valueBreakdown = useMemo((): ValueBreakdown | null => {
    if (!showValueBreakdown) return null;
    try {
      return calculateCruiseValue(offer);
    } catch (error) {
      console.log('[OfferCard] Error calculating value breakdown:', error);
      return null;
    }
  }, [offer, showValueBreakdown]);

  const aggregateValue = useMemo((): OfferAggregateValue | null => {
    try {
      if (allCruises.length > 0 && offer.offerCode) {
        return calculateOfferAggregateValue(offer, allCruises, offer.cabinType);
      }
      return null;
    } catch (error) {
      console.log('[OfferCard] Error calculating aggregate value:', error);
      return null;
    }
  }, [offer, allCruises]);

  const totalValue = useMemo(() => {
    if (aggregateValue && aggregateValue.cruiseCount > 0 && aggregateValue.aggregateTotalValue > 0) {
      console.log('[OfferCard] Using aggregate value:', aggregateValue.aggregateTotalValue);
      return aggregateValue.aggregateTotalValue;
    }
    
    // Always try valueBreakdown first as it includes estimated pricing
    if (valueBreakdown && valueBreakdown.totalValueReceived > 0) {
      console.log('[OfferCard] Using valueBreakdown total:', valueBreakdown.totalValueReceived);
      return valueBreakdown.totalValueReceived;
    }
    
    // Fallback: calculate manually using getCabinPriceFromEntity which supports estimation
    const roomType = offer.cabinType || 'Balcony';
    let cabinPrice = getCabinPriceFromEntity(offer, roomType) || offer.price || 0;
    
    // If still no price, estimate based on cabin type and nights
    if (cabinPrice === 0 && offer.nights > 0) {
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
      const typeKey = Object.keys(baseRates).find(key => 
        roomType.toLowerCase().includes(key.toLowerCase())
      ) || 'Balcony';
      cabinPrice = (baseRates[typeKey] || 180) * (offer.nights || 7);
      console.log('[OfferCard] Using estimated cabin price:', { roomType, cabinPrice });
    }
    
    const guestCount = offer.guests || GUEST_COUNT_DEFAULT;
    const cabinValueForTwo = cabinPrice * guestCount;
    
    // Estimate taxes if not provided (roughly $30/night per guest)
    let taxes = offer.taxes || 0;
    if (taxes === 0 && offer.nights > 0) {
      taxes = Math.round((offer.nights || 7) * 30 * guestCount);
    }
    
    const freePlay = offer.freePlay || 0;
    const obc = offer.freeOBC || 0;
    const tradeIn = offer.tradeInValue || 0;
    
    const total = cabinValueForTwo + taxes + freePlay + obc + tradeIn;
    
    console.log('[OfferCard] Total value calculated:', {
      offerId: offer.id,
      offerCode: offer.offerCode,
      cabinPrice,
      guestCount,
      cabinValueForTwo,
      taxes,
      freePlay,
      obc,
      tradeIn,
      total,
    });
    
    return total;
  }, [offer, valueBreakdown, aggregateValue]);

  const getStatusBadge = () => {
    if (isBooked) {
      return { text: 'BOOKED', bg: COLORS.money };
    }
    if (recommended) {
      return { text: 'RECOMMENDED', bg: COLORS.gold };
    }
    return { text: 'CASINO OFFER', bg: COLORS.loyalty };
  };

  const statusBadge = getStatusBadge();

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, isBooked && styles.compactBooked]}
        onPress={onPress}
        activeOpacity={0.7}
        testID="offer-card-compact"
      >
        <View style={styles.compactContent}>
          <View style={styles.compactLeft}>
            <View style={styles.compactShipRow}>
              <Ship size={12} color={COLORS.navyDeep} />
              <Text style={styles.compactShipName} numberOfLines={1}>
                {offer.shipName}
              </Text>
            </View>
            <Text style={styles.compactDestination} numberOfLines={1}>
              {offer.destination}
            </Text>
            <View style={styles.compactDetails}>
              <Text style={styles.compactDate}>
                {createDateFromString(offer.sailDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <View style={styles.compactDot} />
              <Text style={styles.compactNights}>{offer.nights} nights</Text>
            </View>
          </View>

          <View style={styles.compactRight}>
            {offer.price !== undefined && (
              <Text style={styles.compactPrice}>{formatCurrency(offer.price)}</Text>
            )}
            {isBooked && (
              <View style={styles.compactBookedBadge}>
                <CheckCircle size={10} color={COLORS.white} />
                <Text style={styles.compactBookedText}>Booked</Text>
              </View>
            )}
            <ChevronRight size={16} color={COLORS.navyDeep} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      testID="offer-card"
    >
      <LinearGradient
        colors={MARBLE_TEXTURES.lightBlue.gradientColors}
        locations={MARBLE_TEXTURES.lightBlue.gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.marbleBackground}
      >
      {/* OFFER NAME & CODE - BLACK BOLD AT TOP */}
      {(offer.offerName || offer.offerCode) && (
        <View style={styles.offerHeaderSection}>
          <Text style={styles.offerNameHeader}>
            {offer.offerName && offer.offerName !== offer.offerCode ? offer.offerName : 'Casino Offer'}
          </Text>
          <View style={styles.offerCodeRow}>
            {offer.offerCode && (
              <View style={styles.offerCodeHeaderBadge}>
                <Text style={styles.offerCodeHeaderText}>CODE: {offer.offerCode}</Text>
              </View>
            )}
            <View style={styles.totalValueHeaderCard}>
              <Text style={styles.totalValueHeaderLabel}>
                TOTAL VALUE{aggregateValue && aggregateValue.cruiseCount > 1 ? ` (${aggregateValue.cruiseCount})` : ''}
              </Text>
              <Text
                style={styles.totalValueHeaderAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                ${totalValue > 0
                  ? Math.round(totalValue).toLocaleString()
                  : Math.round(offer.retailValue || valueBreakdown?.totalRetailValue || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {showImage && (
        <View style={styles.imageSection}>
          <Image
            source={{ uri: heroImageUri }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroImageUri(DEFAULT_CRUISE_IMAGE)}
          />
          
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>{statusBadge.text}</Text>
          </View>

          {isExpiringSoon && (
            <View style={styles.expiresUrgentBadge}>
              <Clock size={12} color="#DC2626" />
              <Text style={styles.expiresUrgentText}>Expires in {getDaysUntil(offer.offerExpiry || '')} days</Text>
            </View>
          )}

          <View style={styles.cruiseCountBadge}>
            <Text style={styles.cruiseCountText}>
              {aggregateValue && aggregateValue.cruiseCount > 0 
                ? `${aggregateValue.cruiseCount} cruises available`
                : `${offer.nights} cruises available`}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.contentSection}>
        {offer.destination && (
          <View style={styles.destinationsSection}>
            <Text style={styles.destinationsLabel}>DESTINATIONS</Text>
            <Text style={styles.destinationsText} numberOfLines={2}>
              {offer.destination}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {offer.cabinType && (
            <View style={styles.metaInfoBox}>
              <Text style={styles.metaInfoLabel}>ROOM TYPE</Text>
              <Text style={styles.metaInfoValue} numberOfLines={1}>{offer.cabinType}</Text>
            </View>
          )}
          {offer.offerExpiry && (
            <View style={styles.metaInfoBox}>
              <Text style={styles.metaInfoLabel}>EXPIRES</Text>
              <Text
                style={[styles.metaInfoValue, isExpiringSoon && styles.metaInfoValueUrgent]}
                numberOfLines={1}
              >
                {createDateFromString(offer.offerExpiry).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.viewAllCruisesButton} onPress={onPress}>
          <Text style={styles.viewAllCruisesText}>View All Cruises</Text>
          <ChevronRight size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  marbleBackground: {
    borderRadius: BORDER_RADIUS.lg,
  },
  offerHeaderSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  offerNameHeader: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#000000',
    marginBottom: 6,
  },
  offerCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  offerCodeHeaderBadge: {
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
  totalValueHeaderCard: {
    backgroundColor: COLORS.moneyBg,
    borderWidth: 1,
    borderColor: COLORS.money,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'flex-end',
  },
  totalValueHeaderLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: COLORS.moneyDark,
    letterSpacing: 0.5,
  },
  totalValueHeaderAmount: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: COLORS.money,
  },
  imageSection: {
    height: 80,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  saleBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: COLORS.loyalty,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  saleBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  nightsBadge: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.85)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  nightsBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  contentSection: {
    padding: SPACING.md,
  },
  actionIcons: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    padding: 4,
  },
  expiresUrgentBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  expiresUrgentText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#DC2626',
  },
  cruiseCountBadge: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.9)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
  },
  cruiseCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  destinationsSection: {
    marginBottom: SPACING.md,
  },
  destinationsLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  destinationsText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metaInfoBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaInfoLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaInfoValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  metaInfoValueUrgent: {
    color: '#DC2626',
  },

  viewAllCruisesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  viewAllCruisesText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: SPACING.md,
  },
  valueSectionLarge: {
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valueColumn: {},
  valueLabelLarge: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valueAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  valueDollarLarge: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginTop: 4,
  },
  valueAmountLarge: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  tradeInColumn: {
    alignItems: 'flex-end',
  },
  tradeInValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradeInAmountLarge: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  valueBreakdownSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  retailValueSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  retailValueSubLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  retailValueSubAmount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  perksSectionLarge: {
    marginBottom: SPACING.md,
  },
  perksHeaderLabel: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  perkItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#E0F2F1',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  perkTextContainer: {},
  perkLabelLarge: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  perkValueLarge: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  casinoInfoRow: {
    marginBottom: SPACING.md,
  },
  casinoInfoItem: {},
  casinoInfoLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  casinoInfoValue: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: COLORS.navyDeep,
  },
  actionRowLarge: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  primaryButtonLarge: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
  },
  primaryButtonTextLarge: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  secondaryButtonLarge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.navyDeep,
  },
  secondaryButtonTextLarge: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  compactBooked: {
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  compactLeft: {
    flex: 1,
  },
  compactShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  compactShipName: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  compactDestination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1F2937',
    marginBottom: 4,
  },
  compactDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
  },
  compactDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#9CA3AF',
    marginHorizontal: SPACING.xs,
  },
  compactNights: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
  },
  compactRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  compactPrice: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  compactBookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    gap: 2,
  },
  compactBookedText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
