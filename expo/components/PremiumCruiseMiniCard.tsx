import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, MapPin, Ship, Sparkles, Star, Ticket, Users } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { DEFAULT_CRUISE_IMAGE, getUniqueImageForCruise } from '@/constants/cruiseImages';
import type { BookedCruise, Cruise, ItineraryDay } from '@/types/models';

interface PremiumCruiseMiniCardProps {
  cruise: Cruise | BookedCruise;
  variant?: 'available' | 'booked' | 'completed';
  onPress?: () => void;
  showRetailValue?: boolean;
}

const CARD_TEXTURE_COLORS = ['#FBFDFF', '#EFF6FD', '#E3EEF8', '#D9E8F4'] as const;
const CARD_TEXTURE_VEINS = ['rgba(255,255,255,0.98)', 'rgba(187,207,228,0.28)', 'rgba(255,255,255,0.18)', 'rgba(153,186,214,0.20)'] as const;
const CARD_TEXTURE_LOCATIONS = [0, 0.22, 0.72, 1] as const;

function getCruiseStatus(cruise: BookedCruise): 'upcoming' | 'completed' | 'active' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (cruise.sailDate && cruise.returnDate) {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    sailDate.setHours(0, 0, 0, 0);
    returnDate.setHours(23, 59, 59, 999);

    if (today > returnDate) {
      return 'completed';
    }

    if (today >= sailDate && today <= returnDate) {
      return 'active';
    }
  }

  return 'upcoming';
}

function getStatusPresentation(status: 'AVAILABLE' | 'BOOKED' | 'COMPLETED' | 'ON BOARD') {
  switch (status) {
    case 'BOOKED':
      return { bg: 'rgba(228,247,236,0.96)', text: '#256B4E', border: 'rgba(126,193,160,0.38)' };
    case 'COMPLETED':
      return { bg: 'rgba(234,239,246,0.96)', text: '#42576D', border: 'rgba(177,193,211,0.38)' };
    case 'ON BOARD':
      return { bg: 'rgba(255,238,192,0.96)', text: '#8D6414', border: 'rgba(224,181,73,0.34)' };
    default:
      return { bg: 'rgba(255,255,255,0.94)', text: '#10233E', border: 'rgba(255,255,255,0.28)' };
  }
}

function formatDateRange(sailDate: string, returnDate?: string, nights?: number): string {
  const start = createDateFromString(sailDate);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const startDay = start.getDate();
  const startYear = start.getFullYear();

  if (returnDate) {
    const end = createDateFromString(returnDate);
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
    }

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }

  if (nights) {
    const end = new Date(start);
    end.setDate(end.getDate() + nights);
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
    }

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }

  return `${startMonth} ${startDay}, ${startYear}`;
}

function getItineraryName(cruise: Cruise | BookedCruise): string {
  if (cruise.itineraryName) {
    const parts = cruise.itineraryName.split(':');
    if (parts.length > 1) {
      return parts[1]?.trim() ?? cruise.itineraryName;
    }

    const trimmedName = cruise.itineraryName.trim();
    const isJustNumber = /^\d+$/.test(trimmedName);
    if (isJustNumber || trimmedName.length < 5) {
      return `${cruise.nights || 0}-Night ${cruise.destination || 'Cruise'}`;
    }

    return cruise.itineraryName;
  }

  return `${cruise.nights || 0}-Night ${cruise.destination || 'Cruise'}`;
}

export const PremiumCruiseMiniCard = React.memo(function PremiumCruiseMiniCard({
  cruise,
  variant = 'available',
  onPress,
  showRetailValue = true,
}: PremiumCruiseMiniCardProps) {
  const bookedCruise = cruise as BookedCruise;
  const isBooked = variant === 'booked' || variant === 'completed' || 'bookingId' in cruise || 'reservationNumber' in cruise;

  const cruiseStatus = useMemo(() => {
    if (variant === 'completed') {
      return 'completed';
    }

    if (isBooked) {
      return getCruiseStatus(bookedCruise);
    }

    return 'upcoming';
  }, [bookedCruise, isBooked, variant]);

  const statusBadgeText = useMemo(() => {
    switch (cruiseStatus) {
      case 'completed':
        return 'COMPLETED' as const;
      case 'active':
        return 'ON BOARD' as const;
      default:
        return isBooked ? 'BOOKED' as const : 'AVAILABLE' as const;
    }
  }, [cruiseStatus, isBooked]);

  const statusColors = useMemo(() => getStatusPresentation(statusBadgeText), [statusBadgeText]);

  const shipImageUrl = useMemo(() => getUniqueImageForCruise(cruise.id, cruise.destination, cruise.sailDate, cruise.shipName), [cruise.destination, cruise.id, cruise.sailDate, cruise.shipName]);
  const [heroImageUri, setHeroImageUri] = useState<string>(shipImageUrl || DEFAULT_CRUISE_IMAGE);

  useEffect(() => {
    setHeroImageUri(shipImageUrl || DEFAULT_CRUISE_IMAGE);
  }, [shipImageUrl]);

  const retailValue = useMemo(() => {
    if (!showRetailValue) {
      return null;
    }

    const guestCount = cruise.guests || 2;
    const cabinPrice = cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice || cruise.price || 0;
    return cabinPrice * guestCount;
  }, [cruise, showRetailValue]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 220,
    }).start();
  }, [scaleAnim]);

  const ports = useMemo(() => {
    const itineraryPorts = bookedCruise.itinerary?.map((day: ItineraryDay) => day.port).filter(Boolean) ?? [];
    if (itineraryPorts.length > 0) {
      return itineraryPorts;
    }

    return bookedCruise.ports ?? [];
  }, [bookedCruise.itinerary, bookedCruise.ports]);

  const guestCount = bookedCruise.guestNames?.length || bookedCruise.guests || cruise.guests || 2;
  const itineraryName = useMemo(() => getItineraryName(cruise), [cruise]);
  const sailDateLabel = useMemo(() => formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights), [cruise.nights, cruise.returnDate, cruise.sailDate]);
  const departureLabel = cruise.departurePort || cruise.destination || 'Featured sailing';
  const routeSummary = ports.length > 0 ? ports.slice(0, 4).join(' • ') : cruise.destination || 'Open route';
  const offerCode = bookedCruise.offerCode || cruise.offerCode || null;
  const offerLabel = bookedCruise.offerName || cruise.offerName || (isBooked ? 'Booked sailing' : 'March Instant Cruise Reward');
  const freePlayValue = bookedCruise.freePlay ?? cruise.freePlay;
  const freeObcValue = bookedCruise.freeOBC ?? cruise.freeOBC;

  const featuredCabin = useMemo(() => {
    if (bookedCruise.cabinType) {
      return String(bookedCruise.cabinType);
    }
    if (bookedCruise.stateroomType) {
      return bookedCruise.stateroomType;
    }
    if (cruise.cabinType) {
      return String(cruise.cabinType);
    }
    if ((cruise.balconyPrice ?? 0) > 0) {
      return 'Balcony';
    }
    if ((cruise.suitePrice ?? 0) > 0) {
      return 'Suite';
    }
    if ((cruise.oceanviewPrice ?? 0) > 0) {
      return 'Oceanview';
    }
    if ((cruise.interiorPrice ?? 0) > 0) {
      return 'Interior';
    }
    return 'TBD';
  }, [bookedCruise.cabinType, bookedCruise.stateroomType, cruise.balconyPrice, cruise.cabinType, cruise.interiorPrice, cruise.oceanviewPrice, cruise.suitePrice]);

  const valueLabel = useMemo(() => {
    if (retailValue !== null && retailValue > 0) {
      return {
        label: 'Value',
        value: `$${Math.round(retailValue).toLocaleString()}`,
        color: COLORS.moneyDark,
      };
    }

    const prices = [cruise.interiorPrice, cruise.oceanviewPrice, cruise.balconyPrice, cruise.suitePrice, cruise.price].filter(
      (value): value is number => typeof value === 'number' && value > 0,
    );
    if (prices.length > 0) {
      return {
        label: 'From',
        value: `$${Math.round(Math.min(...prices)).toLocaleString()}`,
        color: COLORS.navyDeep,
      };
    }

    return null;
  }, [cruise.balconyPrice, cruise.interiorPrice, cruise.oceanviewPrice, cruise.price, cruise.suitePrice, retailValue]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID="cruise-card-mini"
      >
        <LinearGradient
          colors={CARD_TEXTURE_COLORS}
          locations={CARD_TEXTURE_LOCATIONS}
          start={{ x: 0.02, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.textureBackground}
        >
          <LinearGradient
            colors={CARD_TEXTURE_VEINS}
            locations={CARD_TEXTURE_LOCATIONS}
            start={{ x: 0.14, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={styles.textureVein}
          />

          <View style={styles.topMetaRow}>
            <View style={styles.titleWrap}>
              <View style={styles.titleRow}>
                <Ship size={15} color={COLORS.navyDeep} />
                <Text style={styles.shipName} numberOfLines={1}>{cruise.shipName}</Text>
              </View>
              <Text style={styles.itineraryName} numberOfLines={2}>{itineraryName}</Text>
            </View>
            {offerCode ? (
              <View style={styles.offerCodeBadge}>
                <Text style={styles.offerCodeBadgeText}>{offerCode}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bannerWrap}>
            <Image
              source={{ uri: heroImageUri }}
              style={styles.bannerImage}
              resizeMode="cover"
              onError={() => {
                console.log('[PremiumCruiseMiniCard] Hero image failed, falling back to default for cruise:', cruise.id);
                setHeroImageUri(DEFAULT_CRUISE_IMAGE);
              }}
            />
            <LinearGradient
              colors={['rgba(10,24,49,0.06)', 'rgba(10,24,49,0.28)', 'rgba(10,24,49,0.78)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0.4, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.bannerTopRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
                <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>{statusBadgeText}</Text>
              </View>
              <View style={styles.nightsBadge}>
                <Text style={styles.nightsBadgeText}>{`${String(cruise.nights)}N`}</Text>
              </View>
            </View>
            <View style={styles.bannerBottomRow}>
              <View style={styles.departureBadge}>
                <MapPin size={11} color={COLORS.white} />
                <Text style={styles.departureBadgeText} numberOfLines={1}>{departureLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.routeStrip}>
              <Text style={styles.routeStripLabel}>Route</Text>
              <Text style={styles.routeStripValue} numberOfLines={2}>{routeSummary}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Calendar size={12} color={COLORS.navyDeep} />
                <Text style={styles.statLabel}>Sail Date</Text>
                <Text style={styles.statValue} numberOfLines={2}>{sailDateLabel}</Text>
              </View>
              <View style={styles.statCard}>
                <Users size={12} color={COLORS.navyDeep} />
                <Text style={styles.statLabel}>Guests</Text>
                <Text style={styles.statValue}>{String(guestCount)}</Text>
              </View>
              <View style={styles.statCard}>
                <Star size={12} color={COLORS.goldDark} />
                <Text style={styles.statLabel}>Cabin</Text>
                <Text style={[styles.statValue, styles.statValueGold]} numberOfLines={1}>{featuredCabin}</Text>
              </View>
              {valueLabel ? (
                <View style={styles.statCard}>
                  <Sparkles size={12} color={valueLabel.color} />
                  <Text style={styles.statLabel}>{valueLabel.label}</Text>
                  <Text style={[styles.statValue, { color: valueLabel.color }]} numberOfLines={1}>{valueLabel.value}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.offerBand}>
              <View style={styles.offerBandLeft}>
                <Sparkles size={12} color={COLORS.goldDark} />
                <Text style={styles.offerBandText} numberOfLines={1}>{offerLabel}</Text>
              </View>
            </View>

            {(freePlayValue !== undefined || freeObcValue !== undefined || bookedCruise.usedNextCruiseCertificate) ? (
              <View style={styles.benefitsRow}>
                {freePlayValue !== undefined ? (
                  <View style={[styles.benefitBadge, styles.benefitBadgeSuccess]}>
                    <Text style={[styles.benefitText, styles.benefitTextSuccess]}>{`FP $${freePlayValue.toLocaleString()}`}</Text>
                  </View>
                ) : null}
                {freeObcValue !== undefined ? (
                  <View style={styles.benefitBadge}>
                    <Text style={styles.benefitText}>{`OBC $${freeObcValue.toLocaleString()}`}</Text>
                  </View>
                ) : null}
                {bookedCruise.usedNextCruiseCertificate ? (
                  <View style={styles.benefitBadge}>
                    <Ticket size={11} color={COLORS.navyDeep} />
                    <Text style={styles.benefitText}>NCC</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <LinearGradient
              colors={['#17304F', '#28466F']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaButtonText}>View Details</Text>
              <ChevronRight size={15} color={COLORS.white} />
            </LinearGradient>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(213,225,238,0.96)',
    ...SHADOW.lg,
    shadowColor: '#081A2C',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  textureBackground: {
    position: 'relative',
    borderRadius: 24,
    padding: SPACING.md,
  },
  textureVein: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.92,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shipName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  itineraryName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    color: COLORS.navyLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.25,
  },
  offerCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.navyDeep,
  },
  offerCodeBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 0.4,
  },
  bannerWrap: {
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.navyDeep,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerTopRow: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBottomRow: {
    position: 'absolute',
    left: SPACING.sm,
    right: SPACING.sm,
    bottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  nightsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  nightsBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  departureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '86%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  departureBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
    flexShrink: 1,
  },
  body: {
    gap: SPACING.sm,
  },
  routeStrip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.78)',
  },
  routeStripLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  routeStripValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  statCard: {
    width: '48%',
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.78)',
    justifyContent: 'space-between',
  },
  statLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  statValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  statValueGold: {
    color: COLORS.goldDark,
  },
  offerBand: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(249,239,209,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(220,188,93,0.32)',
  },
  offerBandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerBandText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.goldDark,
  },
  benefitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  benefitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.78)',
  },
  benefitBadgeSuccess: {
    backgroundColor: 'rgba(226,247,236,0.92)',
    borderColor: 'rgba(120,195,154,0.36)',
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  benefitTextSuccess: {
    color: COLORS.moneyDark,
  },
  ctaButton: {
    marginTop: SPACING.xs,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 0.2,
  },
});
