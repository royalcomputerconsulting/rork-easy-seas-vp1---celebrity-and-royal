import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Clock, ExternalLink, Sparkles } from 'lucide-react-native';
import { GlassSurface } from '@/components/premium/GlassSurface';
import { StableRemoteImage } from '@/components/ui/StableRemoteImage';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { getUniqueImageForCruise } from '@/constants/cruiseImages';
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
  compact?: boolean;
}

interface OfferSummaryCardProps {
  totalValue: number;
  totalCruises: number;
  totalOffers: number;
  expiringSoonCount?: number;
  onSoonestPress?: () => void;
  onHighestValuePress?: () => void;
  activeSortMode?: 'soonest' | 'highestValue';
}

export const OfferSummaryCard = React.memo(function OfferSummaryCard({
  totalValue,
  totalCruises,
  totalOffers,
  expiringSoonCount = 0,
  onSoonestPress,
  onHighestValuePress,
  activeSortMode = 'soonest',
}: OfferSummaryCardProps) {
  const expiringSoonLabel = expiringSoonCount === 1
    ? '1 expiring soon offer'
    : `${expiringSoonCount} expiring soon offers`;

  return (
    <View style={summaryStyles.container} testID="offer-summary-card">
      <LinearGradient colors={['#FFF8F3', '#FFEFE4', '#FAEEF7']} style={summaryStyles.overlay}>
        <View style={summaryStyles.summaryGlass}>
          <View style={summaryStyles.summaryGlassContent}>
            <View style={summaryStyles.summaryHeader}>
              <View style={summaryStyles.summaryHeaderCopy}>
                <Text style={summaryStyles.summaryEyebrow}>Offer command center</Text>
                <Text style={summaryStyles.summaryLeadValue}>${totalValue > 0 ? Math.round(totalValue).toLocaleString() : '---'}</Text>
                <Text style={summaryStyles.summaryLeadLabel}>Total value across your live casino inventory</Text>
              </View>
              <View
                style={[
                  summaryStyles.summaryChip,
                  expiringSoonCount > 0 ? summaryStyles.summaryChipUrgent : summaryStyles.summaryChipCalm,
                ]}
                testID="offer-summary-expiring-chip"
              >
                <Clock size={12} color={expiringSoonCount > 0 ? '#FFFFFF' : '#8A4D34'} />
                <Text style={summaryStyles.summaryChipText}>
                  {expiringSoonCount > 0 ? expiringSoonLabel : 'No urgent expirations'}
                </Text>
              </View>
            </View>

            <View style={summaryStyles.statRow}>
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
                testID="offer-summary-sort-soonest"
              >
                <Text style={[summaryStyles.summaryActionText, activeSortMode === 'soonest' && summaryStyles.summaryActionTextActive]}>Soonest expiring</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[summaryStyles.summaryAction, activeSortMode === 'highestValue' && summaryStyles.summaryActionActive]}
                onPress={onHighestValuePress}
                activeOpacity={0.85}
                testID="offer-summary-sort-highest-value"
              >
                <Text style={[summaryStyles.summaryActionText, activeSortMode === 'highestValue' && summaryStyles.summaryActionTextActive]}>Highest value</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  compact = false,
}: CasinoOfferCardProps) {
  const { localData } = useAppState();

  const cardImageUri = useMemo(() => {
    const firstCruise = cruises[0];
    const explicitImageUrl = firstCruise?.imageUrl?.trim();
    if (explicitImageUrl) {
      return explicitImageUrl;
    }

    return getUniqueImageForCruise(
      firstCruise?.id || offerCode,
      firstCruise?.destination || offerName,
      firstCruise?.sailDate,
      firstCruise?.shipName
    );
  }, [cruises, offerCode, offerName]);

  const relatedOffers = useMemo(
    () => (localData.offers || []).filter((item: CasinoOffer) => item.offerCode === offerCode),
    [localData.offers, offerCode]
  );

  const roomTypeValues = useMemo(
    () => collectUniqueDisplayValues([...relatedOffers.map((item) => item.roomType), ...cruises.map((item) => item.cabinType)]),
    [cruises, relatedOffers]
  );
  const primaryRoomType = roomTypeValues[0] || cruises[0]?.cabinType || relatedOffers[0]?.roomType || 'Balcony';
  const roomTypeLabel = useMemo(
    () => formatDisplayList(roomTypeValues, String(primaryRoomType)),
    [primaryRoomType, roomTypeValues]
  );
  const shipValues = useMemo(
    () => collectUniqueDisplayValues(cruises.map((item) => item.shipName)),
    [cruises]
  );
  const shipLabel = useMemo(
    () => formatDisplayList(shipValues, cruises[0]?.shipName || 'Cruise Offer'),
    [cruises, shipValues]
  );
  const resolvedTradeInValue = useMemo(
    () => relatedOffers.find((item) => item.tradeInValue != null)?.tradeInValue ?? tradeInValue ?? 0,
    [relatedOffers, tradeInValue]
  );
  const resolvedExpiryDate = useMemo(
    () => getEarliestOfferExpiry([
      expiryDate,
      ...relatedOffers.map((item) => item.expiryDate || item.expires || item.offerExpiryDate),
      ...cruises.map((item) => item.offerExpiry),
    ]),
    [cruises, expiryDate, relatedOffers]
  );

  const expiryDays = useMemo(() => {
    if (!resolvedExpiryDate) {
      return null;
    }

    const expiry = createDateFromString(resolvedExpiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [resolvedExpiryDate]);

  const aggregateValue = useMemo(() => {
    if (cruises.length === 0) {
      return null;
    }

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
      const cruiseRoomType = cruise.cabinType || primaryRoomType;
      let cabinPrice = getCabinPriceFromEntity(cruise, cruiseRoomType) || cruise.price || 0;

      if (cabinPrice === 0 && cruise.nights > 0) {
        const typeKey = Object.keys(baseRates).find((key) => cruiseRoomType.toLowerCase().includes(key.toLowerCase())) || 'Balcony';
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
    const aggregateTotalValue = totalCabinValue + totalTaxesFees + totalFreePlay + totalOBC + totalOfferValue + resolvedTradeInValue;

    console.log('[CasinoOfferCard] Aggregate value calculated:', {
      offerCode,
      roomTypes: roomTypeValues,
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
  }, [cruises, freePlay, obc, offerCode, primaryRoomType, resolvedTradeInValue, roomTypeValues]);

  const totalValue = aggregateValue?.aggregateTotalValue || 0;
  const destinationLines = useMemo(() => splitDestinationLines(cruises.map((cruise) => cruise.destination || '')), [cruises]);

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

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={offerSource === 'carnival' ? handleOpenCarnival : onPress}
        activeOpacity={0.94}
        testID="casino-offer-card-compact"
      >
        <LinearGradient colors={['#FFF8F3', '#FFEFE4', '#FBEAF2']} style={styles.compactShellGradient}>
          <View style={styles.compactBody}>
            <View style={styles.compactThumbShell}>
              <StableRemoteImage
                uri={cardImageUri}
                style={styles.compactThumbImage}
                testID="casino-offer-card-compact-image"
              />
              <LinearGradient colors={statusBadge.colors} style={styles.compactStatusPill}>
                <Text style={styles.compactStatusPillText}>{statusBadge.text}</Text>
              </LinearGradient>
              {expiryDays !== null && expiryDays <= 7 && expiryDays > 0 ? (
                <View style={styles.compactUrgentPill}>
                  <Clock size={11} color="#FFFFFF" />
                  <Text style={styles.compactUrgentPillText}>{expiryDays}d</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.compactMainContent}>
              <View style={styles.compactHeaderRow}>
                <View style={styles.compactTitleBlock}>
                  <Text style={styles.compactCardTitle} numberOfLines={2}>{offerName}</Text>
                  <Text style={styles.compactCardSubtitle} numberOfLines={1}>
                    {destinationLines[0] ?? shipLabel}
                  </Text>
                </View>
                <View style={styles.compactValueBlock}>
                  <Text style={styles.compactValueLabel}>Value</Text>
                  <Text style={styles.compactValueText}>${totalValue > 0 ? Math.round(totalValue).toLocaleString() : '---'}</Text>
                </View>
              </View>

              <View style={styles.compactMetaRow}>
                <View style={styles.compactMetaPill}>
                  <Text style={styles.compactMetaLabel}>Code</Text>
                  <Text style={styles.compactMetaValue} numberOfLines={1}>{offerCode}</Text>
                </View>
                <View style={styles.compactMetaPill}>
                  <Text style={styles.compactMetaLabel}>Room</Text>
                  <Text style={styles.compactMetaValue} numberOfLines={1}>{roomTypeLabel}</Text>
                </View>
                <View style={styles.compactMetaPill}>
                  <Text style={styles.compactMetaLabel}>Expires</Text>
                  <Text
                    style={[
                      styles.compactMetaValue,
                      expiryDays !== null && expiryDays <= 7 && expiryDays > 0 ? styles.compactMetaValueUrgent : null,
                    ]}
                    numberOfLines={1}
                  >
                    {formatDisplayDate(resolvedExpiryDate)}
                  </Text>
                </View>
              </View>

              <View style={styles.compactFooterRow}>
                <View style={styles.compactShipTag}>
                  <Sparkles size={12} color="#B7791F" />
                  <Text style={styles.compactShipTagText} numberOfLines={1}>{shipLabel}</Text>
                </View>
                <View style={styles.compactLinkRow}>
                  <Text style={styles.compactLinkText}>
                    {offerSource === 'carnival' ? 'Carnival.com' : `View ${cruises.length} cruises`}
                  </Text>
                  {offerSource === 'carnival' ? (
                    <ExternalLink size={15} color="#0E3554" />
                  ) : (
                    <ChevronRight size={16} color="#0E3554" />
                  )}
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.94} testID="casino-offer-card">
      <LinearGradient colors={['#FFF8F3', '#FFEFE4', '#FBEAF2']} style={styles.shellGradient}>
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
            style={styles.heroImage}
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
              <Text style={styles.infoLabel}>{roomTypeValues.length > 1 ? 'Room Types' : 'Room Type'}</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{roomTypeLabel}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Expires</Text>
              <Text style={[styles.infoValue, expiryDays !== null && expiryDays <= 7 && expiryDays > 0 ? styles.infoValueUrgent : null]} numberOfLines={1}>{formatDisplayDate(resolvedExpiryDate)}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{shipValues.length > 1 ? 'Ships' : 'Ship'}</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{shipLabel}</Text>
            </View>
          </GlassSurface>

          <LinearGradient colors={offerSource === 'carnival' ? ['#B91C1C', '#DC2626'] : ['#BB6A7A', '#E79876', '#F0C86A']} style={styles.ctaButton}>
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
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.18)',
    ...SHADOW.md,
  },
  overlay: {
    padding: 10,
  },
  summaryGlass: {
    borderRadius: 18,
    backgroundColor: 'rgba(255, 252, 248, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  summaryGlassContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  summaryHeaderCopy: {
    flex: 1,
  },
  summaryEyebrow: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: '#8A5A45',
  },
  summaryLeadValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#172033',
    letterSpacing: -0.8,
  },
  summaryLeadLabel: {
    marginTop: 3,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    lineHeight: 16,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    maxWidth: 158,
  },
  summaryChipUrgent: {
    backgroundColor: '#EF4444',
    borderColor: 'rgba(248, 113, 113, 0.32)',
  },
  summaryChipCalm: {
    backgroundColor: '#FFF1E8',
    borderColor: 'rgba(201, 149, 117, 0.18)',
  },
  summaryChipText: {
    flex: 1,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8A4D34',
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBlock: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.14)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.9,
    color: '#8A5A45',
  },
  statValue: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#172033',
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
    paddingVertical: 11,
    backgroundColor: '#FFF4ED',
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.14)',
  },
  summaryActionActive: {
    backgroundColor: '#172033',
    borderColor: '#172033',
  },
  summaryActionText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8A4D34',
  },
  summaryActionTextActive: {
    color: '#FFFFFF',
  },
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(214, 184, 111, 0.22)',
    ...SHADOW.lg,
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
  compactContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.16)',
    backgroundColor: '#FFF8F3',
    ...SHADOW.sm,
  },
  compactShellGradient: {
    borderRadius: 20,
  },
  compactBody: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  compactThumbShell: {
    width: 94,
    height: 94,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    position: 'relative',
  },
  compactThumbImage: {
    width: '100%',
    height: '100%',
  },
  compactStatusPill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  compactStatusPillText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  compactUrgentPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: 'rgba(220,38,38,0.92)',
  },
  compactUrgentPillText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  compactMainContent: {
    flex: 1,
    gap: SPACING.sm,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  compactTitleBlock: {
    flex: 1,
    gap: 4,
  },
  compactCardTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#171630',
    letterSpacing: -0.3,
    lineHeight: 19,
  },
  compactCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#5D6674',
  },
  compactValueBlock: {
    minWidth: 88,
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.12)',
  },
  compactValueLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#2F2416',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  compactValueText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: COLORS.moneyDark,
  },
  compactMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactMetaPill: {
    flexGrow: 1,
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.1)',
  },
  compactMetaLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#425466',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  compactMetaValue: {
    marginTop: 3,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: '#12263C',
  },
  compactMetaValueUrgent: {
    color: COLORS.error,
  },
  compactFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  compactShipTag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(201, 149, 117, 0.1)',
  },
  compactShipTagText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: '#12263C',
  },
  compactLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLinkText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
    color: '#0E3554',
  },
});
