import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, ChevronRight, Clock, Ship, Sparkles } from 'lucide-react-native';
import { GlassSurface } from '@/components/premium/GlassSurface';
import { StableRemoteImage } from '@/components/ui/StableRemoteImage';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { getUniqueImageForCruise } from '@/constants/cruiseImages';
import { createDateFromString, getDaysUntil } from '@/lib/date';
import { formatCurrency } from '@/lib/format';
import { calculateCruiseValue, calculateOfferAggregateValue, getCabinPriceFromEntity, GUEST_COUNT_DEFAULT, type OfferAggregateValue, type ValueBreakdown } from '@/lib/valueCalculator';
import type { Cruise } from '@/types/models';

interface OfferCardProps {
  offer: Cruise;
  allCruises?: Cruise[];
  offerNameOverride?: string;
  onPress?: () => void;
  isBooked?: boolean;
  recommended?: boolean;
  showImage?: boolean;
  compact?: boolean;
  showValueBreakdown?: boolean;
}

const WEB_SHADOW_FIX = Platform.select<ViewStyle>({
  web: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});

function formatOfferDate(value: string | undefined): string {
  if (!value) {
    return 'TBD';
  }

  return createDateFromString(value).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function splitDestinationLines(destination: string | undefined): string[] {
  const cleaned = (destination ?? '').trim();
  if (!cleaned) {
    return [];
  }

  const pieces = cleaned
    .split(/\s*[•|]|\s*,\s*/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  if (pieces.length >= 3) {
    return pieces.slice(0, 3);
  }

  if (cleaned.length > 70) {
    const words = cleaned.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length > 26 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.slice(0, 3);
  }

  return [cleaned];
}

function collectUniqueDisplayValues(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value ?? '').trim())
        .filter((value) => value.length > 0)
    )
  );
}

function formatDisplayList(values: string[], fallback: string): string {
  if (values.length === 0) {
    return fallback;
  }

  if (values.length <= 3) {
    return values.join(' • ');
  }

  return `${values.slice(0, 3).join(' • ')} +${values.length - 3} more`;
}

function getEarliestOfferExpiry(values: Array<string | undefined | null>): string | undefined {
  const parsed = values
    .map((value) => {
      const normalized = (value ?? '').trim();
      if (!normalized) {
        return null;
      }

      const date = createDateFromString(normalized);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return {
        value: normalized,
        time: date.getTime(),
      };
    })
    .filter((entry): entry is { value: string; time: number } => entry !== null)
    .sort((left, right) => left.time - right.time);

  return parsed[0]?.value;
}

export const OfferCard = React.memo(function OfferCard({
  offer,
  allCruises = [],
  offerNameOverride,
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

  const heroImageUri = useMemo(() => {
    const explicitImageUrl = offer.imageUrl?.trim();
    if (explicitImageUrl) {
      return explicitImageUrl;
    }

    return getUniqueImageForCruise(
      offer.id,
      offer.destination || '',
      offer.sailDate,
      offer.shipName
    );
  }, [offer.destination, offer.id, offer.imageUrl, offer.sailDate, offer.shipName]);

  const valueBreakdown = useMemo((): ValueBreakdown | null => {
    if (!showValueBreakdown) {
      return null;
    }

    try {
      return calculateCruiseValue(offer);
    } catch (error) {
      console.log('[OfferCard] Error calculating value breakdown:', error);
      return null;
    }
  }, [offer, showValueBreakdown]);

  const inferredOfferName = useMemo(() => {
    const override = (offerNameOverride || '').trim();
    if (override.length > 0) {
      console.log('[OfferCard] Using offerNameOverride for code:', {
        offerId: offer.id,
        offerCode: offer.offerCode,
        offerNameOverride: override,
      });
      return override;
    }

    const direct = (offer.offerName || '').trim();
    if (direct.length > 0) {
      console.log('[OfferCard] Using offer.offerName (no override available):', {
        offerId: offer.id,
        offerCode: offer.offerCode,
        offerName: direct,
      });
      return direct;
    }

    if (offer.offerCode && allCruises.length > 0) {
      const match = allCruises.find((item) => item.offerCode === offer.offerCode && (item.offerName || '').trim().length > 0);
      const inferred = (match?.offerName || '').trim();
      if (inferred.length > 0) {
        console.log('[OfferCard] Inferred offer name from other cruises with same offerCode:', {
          offerId: offer.id,
          offerCode: offer.offerCode,
          inferred,
        });
        return inferred;
      }
    }

    return 'Casino Offer';
  }, [allCruises, offer.id, offer.offerCode, offer.offerName, offerNameOverride]);

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
  }, [allCruises, offer]);

  const availableCruiseCount = useMemo(() => {
    if (aggregateValue && aggregateValue.cruiseCount > 0) {
      return aggregateValue.cruiseCount;
    }

    if (offer.offerCode) {
      const relatedCruises = allCruises.filter((item) => item.offerCode === offer.offerCode);
      if (relatedCruises.length > 0) {
        return relatedCruises.length;
      }
    }

    return 1;
  }, [aggregateValue, allCruises, offer.offerCode]);

  const totalValue = useMemo(() => {
    if (aggregateValue && aggregateValue.cruiseCount > 0 && aggregateValue.aggregateTotalValue > 0) {
      console.log('[OfferCard] Using aggregate value:', aggregateValue.aggregateTotalValue);
      return aggregateValue.aggregateTotalValue;
    }

    if (valueBreakdown && valueBreakdown.totalValueReceived > 0) {
      console.log('[OfferCard] Using valueBreakdown total:', valueBreakdown.totalValueReceived);
      return valueBreakdown.totalValueReceived;
    }

    const roomType = offer.cabinType || 'Balcony';
    let cabinPrice = getCabinPriceFromEntity(offer, roomType) || offer.price || 0;

    if (cabinPrice === 0 && offer.nights > 0) {
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
      const typeKey = Object.keys(baseRates).find((key) => roomType.toLowerCase().includes(key.toLowerCase())) || 'Balcony';
      cabinPrice = (baseRates[typeKey] || 180) * (offer.nights || 7);
      console.log('[OfferCard] Using estimated cabin price:', { roomType, cabinPrice });
    }

    const guestCount = offer.guests || GUEST_COUNT_DEFAULT;
    const cabinValueForTwo = cabinPrice * guestCount;
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
  }, [aggregateValue, offer, valueBreakdown]);

  const statusBadge = useMemo(() => {
    if (isBooked) {
      return { text: 'BOOKED', colors: ['#059669', '#10B981'] as [string, string] };
    }

    if (recommended) {
      return { text: 'RECOMMENDED', colors: ['#D4A00A', '#F59E0B'] as [string, string] };
    }

    return { text: 'ACTIVE', colors: ['#0097A7', '#0EA5B7'] as [string, string] };
  }, [isBooked, recommended]);

  const displayValue = totalValue > 0
    ? `$${Math.round(totalValue).toLocaleString()}`
    : formatCurrency(offer.retailValue || valueBreakdown?.totalRetailValue || 0);

  const relatedOfferCruises = useMemo(() => {
    if (!offer.offerCode) {
      return [offer];
    }

    const matches = allCruises.filter((item) => item.offerCode === offer.offerCode);
    return matches.length > 0 ? matches : [offer];
  }, [allCruises, offer]);

  const destinationLines = useMemo(() => splitDestinationLines(offer.destination), [offer.destination]);
  const roomTypeValues = useMemo(
    () => collectUniqueDisplayValues([...relatedOfferCruises.map((item) => item.cabinType), offer.cabinType]),
    [offer.cabinType, relatedOfferCruises]
  );
  const roomTypeText = useMemo(
    () => formatDisplayList(roomTypeValues, (offer.cabinType || 'Balcony').trim() || 'Balcony'),
    [offer.cabinType, roomTypeValues]
  );
  const shipValues = useMemo(
    () => collectUniqueDisplayValues([...relatedOfferCruises.map((item) => item.shipName), offer.shipName]),
    [offer.shipName, relatedOfferCruises]
  );
  const shipLabel = useMemo(
    () => formatDisplayList(shipValues, offer.shipName || 'Cruise Offer'),
    [offer.shipName, shipValues]
  );
  const resolvedExpiry = useMemo(
    () => getEarliestOfferExpiry([...relatedOfferCruises.map((item) => item.offerExpiry), offer.offerExpiry]),
    [offer.offerExpiry, relatedOfferCruises]
  );
  const expiryLabel = formatOfferDate(resolvedExpiry);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactShadowShell}
        onPress={onPress}
        activeOpacity={0.9}
        testID="offer-card-compact"
      >
        <View style={styles.compactContainer}>
          <StableRemoteImage
            uri={heroImageUri}
            style={styles.compactImage}
            testID="offer-card-compact-image"
          />
          <LinearGradient colors={['rgba(8, 19, 37, 0.1)', 'rgba(8, 19, 37, 0.88)']} style={styles.compactOverlay}>
            <View style={styles.compactTopRow}>
              <View style={styles.compactBadge}>
                <Ship size={12} color="#FFFFFF" />
                <Text style={styles.compactBadgeText}>{shipLabel}</Text>
              </View>
              {isBooked ? (
                <View style={styles.compactBookedBadge}>
                  <CheckCircle size={11} color="#FFFFFF" />
                  <Text style={styles.compactBookedText}>Booked</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.compactTitle} numberOfLines={1}>{inferredOfferName}</Text>
            <Text style={styles.compactDestination} numberOfLines={1}>{offer.destination || 'Scenic sailings available'}</Text>
            <View style={styles.compactFooter}>
              <Text style={styles.compactPrice}>{offer.price !== undefined ? formatCurrency(offer.price) : displayValue}</Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.shadowShell} onPress={onPress} activeOpacity={0.94} testID="offer-card">
      <View style={styles.container}>
        <LinearGradient colors={['#FFFDF9', '#F8F0DB', '#E8F8FC']} style={styles.shellGradient}>
          <View style={styles.headerStrip}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{inferredOfferName}</Text>
              {offer.offerCode ? <Text style={styles.headerCode}>Code {offer.offerCode}</Text> : null}
            </View>
            <View style={styles.headerValueBlock}>
              <Text style={styles.headerValueLabel}>Total Value{availableCruiseCount > 1 ? ` (${availableCruiseCount})` : ''}</Text>
              <Text style={styles.headerValueText}>{displayValue}</Text>
            </View>
          </View>

          {showImage ? (
            <View style={styles.heroSection}>
              <StableRemoteImage
                uri={heroImageUri}
                style={styles.heroImage}
                testID="offer-card-hero-image"
              />
              <LinearGradient
                colors={['rgba(7, 20, 36, 0.08)', 'rgba(8, 24, 41, 0.42)', 'rgba(7, 18, 34, 0.92)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.heroOverlay}
              />
              <LinearGradient colors={statusBadge.colors} style={styles.statusPill}>
                <Text style={styles.statusPillText}>{statusBadge.text}</Text>
              </LinearGradient>
              {isExpiringSoon ? (
                <View style={styles.urgentPill}>
                  <Clock size={12} color="#FFFFFF" />
                  <Text style={styles.urgentPillText}>Expires in {getDaysUntil(offer.offerExpiry || '')} days</Text>
                </View>
              ) : null}
              <GlassSurface style={styles.heroInfoPill} contentStyle={styles.heroInfoPillContent}>
                <Sparkles size={13} color="#FFFFFF" />
                <Text style={styles.heroInfoText}>View all {availableCruiseCount} cruises</Text>
              </GlassSurface>
            </View>
          ) : null}

          <View style={styles.contentSection}>
            <View style={styles.primaryRow}>
              <View style={styles.destinationBlock}>
                <Text style={styles.eyebrow}>Destinations</Text>
                {destinationLines.length > 0 ? destinationLines.map((line, index) => (
                  <Text key={`${line}-${index}`} style={styles.destinationLine} numberOfLines={1}>{line}</Text>
                )) : (
                  <Text style={styles.destinationLine} numberOfLines={1}>Curated casino sailings</Text>
                )}
              </View>

              <View style={styles.valueBlock}>
                <Text style={styles.valueEyebrow}>Value</Text>
                <Text style={styles.valueText}>{displayValue}</Text>
                <Text style={styles.valueHint}>{availableCruiseCount} sailing{availableCruiseCount === 1 ? '' : 's'}</Text>
              </View>
            </View>

            <GlassSurface style={styles.infoPanel} contentStyle={styles.infoPanelContent}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{roomTypeValues.length > 1 ? 'Room Types' : 'Room Type'}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{roomTypeText}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Expires</Text>
                <Text style={[styles.infoValue, isExpiringSoon && styles.infoValueUrgent]} numberOfLines={1}>{expiryLabel}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{shipValues.length > 1 ? 'Ships' : 'Ship'}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{shipLabel}</Text>
              </View>
            </GlassSurface>

            <LinearGradient colors={['#0E3554', '#0A4C62', '#12706D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaButton}>
              <TouchableOpacity style={styles.ctaButtonInner} onPress={onPress} activeOpacity={0.85} testID="offer-card-view-all-button">
                <Text style={styles.ctaText}>View all {availableCruiseCount} cruises</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  shadowShell: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
    ...SHADOW.lg,
    ...(WEB_SHADOW_FIX ?? {}),
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: '#FFF9EF',
  },
  shellGradient: {
    borderRadius: 24,
    backgroundColor: '#FFF9EF',
  },
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: 'rgba(255, 249, 241, 0.84)',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#171630',
    letterSpacing: -0.4,
  },
  headerCode: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#2F2416',
  },
  headerValueBlock: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 252, 247, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    minWidth: 104,
  },
  headerValueLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#2F2416',
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  headerValueText: {
    marginTop: 1,
    fontSize: 16,
    fontWeight: '800' as const,
    color: COLORS.moneyDark,
  },
  heroSection: {
    height: 104,
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
    top: SPACING.sm,
    right: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.7,
  },
  urgentPill: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
  },
  urgentPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  heroInfoPill: {
    position: 'absolute',
    left: SPACING.sm,
    bottom: SPACING.sm,
    borderRadius: 16,
  },
  heroInfoPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroInfoText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  contentSection: {
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: 'rgba(255, 252, 247, 0.82)',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  destinationBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#314255',
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  destinationLine: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700' as const,
    color: '#12263C',
  },
  valueBlock: {
    minWidth: 98,
    alignItems: 'flex-end',
  },
  valueEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#314255',
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  valueText: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.moneyDark,
    letterSpacing: -0.8,
  },
  valueHint: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#405165',
  },
  infoPanel: {
    borderRadius: 20,
  },
  infoPanelContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
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
    color: '#405165',
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
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  ctaText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  compactShadowShell: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
    ...SHADOW.md,
    ...(WEB_SHADOW_FIX ?? {}),
  },
  compactContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: '#0D1723',
  },
  compactImage: {
    width: '100%',
    height: 132,
  },
  compactOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  compactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  compactBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  compactBookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(5,150,105,0.88)',
  },
  compactBookedText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  compactTitle: {
    marginTop: 'auto',
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  compactDestination: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.84)',
  },
  compactFooter: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactPrice: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
});
