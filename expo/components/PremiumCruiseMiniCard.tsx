import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, Users, Ship, Sparkles, Ticket, MapPin, Star } from 'lucide-react-native';
import { COLORS, SPACING, SHADOW } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { DEFAULT_CRUISE_IMAGE, getUniqueImageForCruise } from '@/constants/cruiseImages';
import type { Cruise, BookedCruise, ItineraryDay } from '@/types/models';

interface PremiumCruiseMiniCardProps {
  cruise: Cruise | BookedCruise;
  variant?: 'available' | 'booked' | 'completed';
  onPress?: () => void;
  showRetailValue?: boolean;
}

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
      return { bg: 'rgba(228, 247, 236, 0.95)', text: '#256B4E', border: 'rgba(126, 193, 160, 0.38)' };
    case 'COMPLETED':
      return { bg: 'rgba(214, 240, 224, 0.96)', text: '#225741', border: 'rgba(96, 163, 130, 0.34)' };
    case 'ON BOARD':
      return { bg: 'rgba(255, 238, 192, 0.96)', text: '#8D6414', border: 'rgba(224, 181, 73, 0.34)' };
    default:
      return { bg: 'rgba(255,255,255,0.92)', text: '#10233E', border: 'rgba(255,255,255,0.24)' };
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

  const shipImageUrl = useMemo(() => {
    return getUniqueImageForCruise(cruise.id, cruise.destination, cruise.sailDate, cruise.shipName);
  }, [cruise.destination, cruise.id, cruise.sailDate, cruise.shipName]);

  const [heroImageUri, setHeroImageUri] = useState<string>(shipImageUrl || DEFAULT_CRUISE_IMAGE);

  useEffect(() => {
    setHeroImageUri(shipImageUrl || DEFAULT_CRUISE_IMAGE);
  }, [shipImageUrl]);

  const retailValue = useMemo(() => {
    if (!showRetailValue) {
      return null;
    }

    const guestCount = cruise.guests || 2;
    const bc = cruise as BookedCruise;

    if (bc.totalRetailCost && bc.pricePaid !== undefined) {
      return bc.totalRetailCost * 2;
    }

    const cabinPrice = cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice || cruise.price || 0;
    return cabinPrice * guestCount;
  }, [cruise, showRetailValue]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Animated.spring(scaleAnim, {
      toValue: 0.975,
      useNativeDriver: true,
      friction: 5,
      tension: 320,
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

    return null;
  }, [bookedCruise.cabinType, bookedCruise.stateroomType, cruise.balconyPrice, cruise.cabinType, cruise.interiorPrice, cruise.oceanviewPrice, cruise.suitePrice]);

  const lowestPrice = useMemo(() => {
    const prices = [cruise.interiorPrice, cruise.oceanviewPrice, cruise.balconyPrice, cruise.suitePrice, cruise.price].filter(
      (value): value is number => typeof value === 'number' && value > 0,
    );

    if (prices.length === 0) {
      return null;
    }

    return Math.min(...prices);
  }, [cruise.balconyPrice, cruise.interiorPrice, cruise.oceanviewPrice, cruise.price, cruise.suitePrice]);

  const valueLabel = useMemo(() => {
    if (retailValue !== null && retailValue > 0) {
      return {
        label: 'Value',
        value: `$${Math.round(retailValue).toLocaleString()}`,
        color: COLORS.moneyDark,
      };
    }

    if (lowestPrice !== null && lowestPrice > 0) {
      return {
        label: 'From',
        value: `$${Math.round(lowestPrice).toLocaleString()}`,
        color: COLORS.navyDeep,
      };
    }

    return null;
  }, [lowestPrice, retailValue]);

  const offerLabel = bookedCruise.offerName || cruise.offerName || (isBooked ? 'Booked sailing' : 'March Instant Cruise Reward');
  const offerCode = bookedCruise.offerCode || cruise.offerCode || null;
  const routeSummary = ports.length > 0 ? ports.slice(0, 4).join(' · ') : cruise.destination;
  const departureLabel = cruise.departurePort || cruise.destination || 'Featured sailing';
  const freePlayValue = bookedCruise.freePlay ?? cruise.freePlay;
  const freeObcValue = bookedCruise.freeOBC ?? cruise.freeOBC;

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
        <View style={styles.heroSection}>
          <Image
            source={{ uri: heroImageUri }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => {
              console.log('[PremiumCruiseMiniCard] Hero image failed, falling back to default for cruise:', cruise.id);
              setHeroImageUri(DEFAULT_CRUISE_IMAGE);
            }}
          />
          <LinearGradient
            colors={['rgba(10, 20, 36, 0.02)', 'rgba(12, 24, 46, 0.24)', 'rgba(10, 20, 36, 0.92)']}
            locations={[0, 0.48, 1]}
            start={{ x: 0.4, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(236, 190, 92, 0.34)', 'rgba(236, 190, 92, 0.08)', 'rgba(236, 190, 92, 0)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.2, y: 0.8 }}
            style={styles.sunGlow}
          />

          <View style={styles.heroTopRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
              <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>{statusBadgeText}</Text>
            </View>
            <View style={styles.heroTopRight}>
              {offerCode ? (
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{offerCode}</Text>
                </View>
              ) : null}
              <View style={styles.nightsBadge}>
                <Text style={styles.nightsBadgeText}>{`${String(cruise.nights)}N`}</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.departureBadge}>
              <MapPin size={11} color={COLORS.white} />
              <Text style={styles.departureBadgeText}>{departureLabel}</Text>
            </View>
            <Text style={styles.shipName} numberOfLines={1}>{cruise.shipName}</Text>
            <Text style={styles.itineraryName} numberOfLines={2}>{itineraryName}</Text>
            {!!routeSummary && (
              <View style={styles.routeRow}>
                <Ship size={12} color="rgba(255,255,255,0.82)" />
                <Text style={styles.routeText} numberOfLines={1}>{routeSummary}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoWrap}>
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(246,249,255,0.97)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoCard}
          >
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Calendar size={13} color={COLORS.navyDeep} />
                <Text style={styles.metricLabel}>Sail Date</Text>
                <Text style={styles.metricValue}>{sailDateLabel}</Text>
              </View>

              <View style={styles.metricCard}>
                <Users size={13} color={COLORS.navyDeep} />
                <Text style={styles.metricLabel}>Guests</Text>
                <Text style={styles.metricValue}>{String(guestCount)}</Text>
              </View>

              {featuredCabin ? (
                <View style={styles.metricCard}>
                  <Star size={13} color={COLORS.goldDark} />
                  <Text style={styles.metricLabel}>Cabin</Text>
                  <Text style={[styles.metricValue, styles.metricValueGold]} numberOfLines={1}>{featuredCabin}</Text>
                </View>
              ) : null}

              {valueLabel ? (
                <View style={styles.metricCard}>
                  <Sparkles size={13} color={valueLabel.color} />
                  <Text style={styles.metricLabel}>{valueLabel.label}</Text>
                  <Text style={[styles.metricValue, { color: valueLabel.color }]} numberOfLines={1}>{valueLabel.value}</Text>
                </View>
              ) : null}
            </View>

            {!!routeSummary && (
              <View style={styles.portStrip}>
                <MapPin size={12} color={COLORS.navyLight} />
                <Text style={styles.portStripText} numberOfLines={2}>{routeSummary}</Text>
              </View>
            )}

            <View style={styles.offerBand}>
              <View style={styles.offerBandLeft}>
                <Sparkles size={12} color={COLORS.goldDark} />
                <Text style={styles.offerBandText} numberOfLines={1}>{offerLabel}</Text>
              </View>
              {(cruise.offerValue ?? 0) > 0 ? (
                <View style={styles.offerValueBadge}>
                  <Text style={styles.offerValueBadgeText}>{`+$${Math.round(cruise.offerValue ?? 0).toLocaleString()}`}</Text>
                </View>
              ) : null}
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
          </LinearGradient>
        </View>
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
    borderColor: 'rgba(218, 228, 242, 0.95)',
    ...SHADOW.lg,
    shadowColor: '#071222',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  heroSection: {
    height: 208,
    position: 'relative',
    backgroundColor: COLORS.navyDeep,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  sunGlow: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 180,
    height: 180,
    borderRadius: 180,
  },
  heroTopRow: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  heroTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  codeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  nightsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  nightsBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.4,
  },
  heroBottom: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: SPACING.lg,
  },
  departureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  departureBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  shipName: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: -0.7,
    marginBottom: 2,
  },
  itineraryName: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.92)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.35,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600' as const,
  },
  infoWrap: {
    marginTop: -22,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  infoCard: {
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(222, 231, 243, 0.98)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...SHADOW.md,
    shadowColor: '#102238',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  metricCard: {
    width: '48%',
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    backgroundColor: 'rgba(246, 249, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(219, 229, 242, 0.96)',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800' as const,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  metricValueGold: {
    color: COLORS.goldDark,
  },
  portStrip: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(235, 242, 251, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(216, 227, 241, 0.95)',
  },
  portStripText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.navyLight,
    fontWeight: '600' as const,
  },
  offerBand: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(250, 241, 212, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(232, 204, 120, 0.46)',
  },
  offerBandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  offerBandText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.goldDark,
    fontWeight: '700' as const,
  },
  offerValueBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184, 134, 11, 0.15)',
  },
  offerValueBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.moneyDark,
  },
  benefitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  benefitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(241, 246, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(216, 226, 239, 0.95)',
  },
  benefitBadgeSuccess: {
    backgroundColor: 'rgba(226, 247, 236, 0.92)',
    borderColor: 'rgba(120, 195, 154, 0.36)',
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
    marginTop: SPACING.md,
    borderRadius: 15,
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
