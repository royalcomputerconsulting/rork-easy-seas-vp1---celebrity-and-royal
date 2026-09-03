import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, Users, Ship, Heart, Sparkles, Anchor, Ticket, Gauge, AlertTriangle, Clock3, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

import { createDateFromString } from '@/lib/date';

import { getUniqueImageForCruise, getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import type { Cruise, BookedCruise, ItineraryDay } from '@/types/models';
import { calculateSeaDayDensityScore } from '@/lib/cruisePlanningIntelligence';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { displayKnownCount, formatGuestEligibility, getCanonicalCruiseCabinLabel, getCruiseGuestEligibility } from '@/lib/cruiseRecordIntegrity';
import { projectCrownAnchorCruisePoints } from '@/lib/loyalty/crownAnchorCruisePoints';
import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { useExperience } from '@/state/ExperienceProvider';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { calculateCasinoAvailabilityForCruise, calculatePersonalizedPlayEstimate } from '@/lib/casinoAvailability';

interface CruiseCardProps {
  cruise: Cruise | BookedCruise;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  showPricePerNight?: boolean;
  compact?: boolean;
  mini?: boolean;
  variant?: 'default' | 'booked' | 'available' | 'completed';
  showRetailValue?: boolean;
  conflictWarning?: string;
  relatedOfferOptionCount?: number;
  relatedReservationCount?: number;
}

function getCruiseStatus(cruise: BookedCruise): 'upcoming' | 'completed' | 'active' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (cruise.sailDate && cruise.returnDate) {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    sailDate.setHours(0, 0, 0, 0);
    returnDate.setHours(23, 59, 59, 999);
    
    if (today > returnDate) return 'completed';
    if (today >= sailDate && today <= returnDate) return 'active';
  }
  return 'upcoming';
}

type FutureTopTierBadge = {
  text: 'Pinnacle' | 'Zenith';
  bg: string;
  textColor: string;
};

const TOP_TIER_BADGE_START_DATE = new Date(2026, 6, 24);

function getFutureTopTierBadge(cruise: Cruise | BookedCruise, isBooked: boolean): FutureTopTierBadge | null {
  if (!isBooked || !cruise.sailDate) return null;

  const sailDate = createDateFromString(cruise.sailDate);
  sailDate.setHours(0, 0, 0, 0);

  if (sailDate.getTime() <= TOP_TIER_BADGE_START_DATE.getTime()) return null;

  const brandIdentifier = `${cruise.brand ?? ''} ${cruise.cruiseSource ?? ''} ${cruise.shipName ?? ''}`.toLowerCase();

  if (brandIdentifier.includes('celebrity')) {
    return { text: 'Zenith', bg: '#2B2930', textColor: COLORS.white };
  }

  if (brandIdentifier.includes('royal')) {
    return { text: 'Pinnacle', bg: COLORS.tierPinnacle, textColor: COLORS.white };
  }

  return null;
}

export const CruiseCard = React.memo(function CruiseCard({ 
  cruise, 
  onPress, 
  onToggleFavorite,
  isFavorite = false,
  showPricePerNight: _showPricePerNight = true, 
  compact = false,
  mini = false,
  variant = 'default',
  showRetailValue = true,
  conflictWarning,
  relatedOfferOptionCount = 1,
  relatedReservationCount = 1,
}: CruiseCardProps) {
  const { preferences } = useExperience();
  const { currentUser } = useUser();
  const isBooked = variant === 'booked' || variant === 'completed' || 'bookingId' in cruise || 'reservationNumber' in cruise;
  const bookedCruise = cruise as BookedCruise;
  
  const cruiseStatus = useMemo(() => {
    if (variant === 'completed') return 'completed';
    if (isBooked) return getCruiseStatus(bookedCruise);
    return 'upcoming';
  }, [variant, isBooked, bookedCruise]);
  
  const shipImageUrl = useMemo(() => {
    return getUniqueImageForCruise(
      cruise.id,
      cruise.destination,
      cruise.sailDate,
      cruise.shipName
    );
  }, [cruise.id, cruise.destination, cruise.sailDate, cruise.shipName]);
  
  const destinationImage = useMemo(() => {
    const hash = cruise.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return getImageForDestination(cruise.destination, hash + 1);
  }, [cruise.id, cruise.destination]);

  const [heroImageUri, setHeroImageUri] = useState<string>(shipImageUrl || DEFAULT_CRUISE_IMAGE);
  const [compactImageUri, setCompactImageUri] = useState<string>(destinationImage || DEFAULT_CRUISE_IMAGE);
  const [showHeroImage, setShowHeroImage] = useState<boolean>(true);
  const [showCompactImage, setShowCompactImage] = useState<boolean>(true);

  useEffect(() => {
    setHeroImageUri(shipImageUrl || DEFAULT_CRUISE_IMAGE);
    setShowHeroImage(true);
  }, [shipImageUrl]);

  useEffect(() => {
    setCompactImageUri(destinationImage || DEFAULT_CRUISE_IMAGE);
    setShowCompactImage(true);
  }, [destinationImage]);

  const retailValue = useMemo(() => {
    if (!showRetailValue) return null;
    return calculateCruiseValue(cruise).totalRetailValue;
  }, [cruise, showRetailValue]);

  const financialFacts = useMemo(() => {
    const row = cruise as BookedCruise & Record<string, unknown>;
    const firstFinite = (...values: unknown[]): number | null => {
      for (const raw of values) {
        if (raw === undefined || raw === null || raw === '') continue;
        const parsed = Number(String(raw).replace(/[$, ]/g, ''));
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };
    return {
      actualPaid: isBooked ? firstFinite(row.netEffectivePaid, row.amountPaid, row.pricePaid) : null,
      advertisedPrice: firstFinite(row.price, row.totalPrice),
      suppliedValue: firstFinite(row.totalValue, row.compValue, row.offerValue),
      casinoPoints: isBooked ? getBookedCruiseCasinoPoints(row) : 0,
    };
  }, [cruise, isBooked]);

  const formatDateRange = (sailDate: string, returnDate?: string, nights?: number) => {
    const start = createDateFromString(sailDate);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const startYear = start.getFullYear();
    
    if (returnDate) {
      const end = createDateFromString(returnDate);
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const endDay = end.getDate();
      
      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
      }
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
    }
    
    if (nights) {
      const end = new Date(start);
      end.setDate(end.getDate() + nights);
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const endDay = end.getDate();
      
      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
      }
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
    }
    
    return `${startMonth} ${startDay}, ${startYear}`;
  };

  const getStatusBadge = () => {
    switch (cruiseStatus) {
      case 'completed':
        return { text: 'Completed', bg: COLORS.money };
      case 'active':
        return { text: 'On board', bg: COLORS.points };
      default:
        return isBooked 
          ? { text: 'Booked', bg: COLORS.loyalty }
          : { text: 'Available', bg: COLORS.gold };
    }
  };

  const getItineraryName = () => {
    if (cruise.itineraryName) {
      const parts = cruise.itineraryName.split(':');
      if (parts.length > 1) {
        return parts[1].trim();
      }
      
      const isJustNumber = /^\d+$/.test(cruise.itineraryName.trim());
      if (isJustNumber || cruise.itineraryName.length < 5) {
        return `${cruise.nights || 0}-Night ${cruise.destination || 'Cruise'}`;
      }
      
      return cruise.itineraryName;
    }
    return `${cruise.nights || 0}-Night ${cruise.destination || 'Cruise'}`;
  };

  const statusBadge = getStatusBadge();
  const futureTopTierBadge = useMemo(
    () => getFutureTopTierBadge(cruise, isBooked),
    [cruise, isBooked]
  );

  const seaDayDensity = useMemo(() => {
    return calculateSeaDayDensityScore(cruise);
  }, [cruise]);

  const operationalMetrics = useMemo(() => {
    if (!seaDayDensity.isItineraryKnown) return null;
    const casino = calculateCasinoAvailabilityForCruise(cruise, undefined, { quiet: true });
    if (casino.totalDays <= 0) return null;
    const playingHours = currentUser?.playingHours ?? DEFAULT_PLAYING_HOURS;
    const play = calculatePersonalizedPlayEstimate(casino, {
      enabled: playingHours.enabled,
      sessions: playingHours.sessions,
    });
    const savedCasinoPoints = isBooked ? getBookedCruiseCasinoPoints(bookedCruise) : 0;
    const pointsForRate = savedCasinoPoints > 0 ? savedCasinoPoints : play.estimatedPoints;
    const pointsPerHour = play.estimatedPlayHours > 0 ? pointsForRate / play.estimatedPlayHours : null;
    return {
      casinoOpenDays: casino.casinoOpenDays,
      casinoOpenHours: casino.estimatedCasinoHours,
      modeledPlayerHours: play.estimatedPlayHours,
      goldenHours: play.goldenHoursTotal || play.estimatedPlayHours,
      estimatedCasinoPoints: play.estimatedPoints,
      pointsForRate,
      pointsPerHour,
      pointsBasis: savedCasinoPoints > 0 ? 'saved points' : 'modeled points',
    };
  }, [bookedCruise, cruise, currentUser?.playingHours, isBooked, seaDayDensity.isItineraryKnown]);

  const catalogFacts = useMemo(() => {
    const row = cruise as Cruise & Record<string, unknown>;
    const firstPositiveNumber = (...values: unknown[]) => {
      for (const raw of values) {
        const value = Number(String(raw ?? '').replace(/[, ]/g, ''));
        if (Number.isFinite(value) && value > 0) return value;
      }
      return null;
    };
    const shipClass = String(row.shipClass || row.shipClassName || row.vesselClass || '').trim();
    const pointRequirement = firstPositiveNumber(row.pointsRequired, row.pointRequirement, row.pointsLevel, row.thresholdPoints);
    const certificateCode = String(row.certificateCode || '').trim();
    const gtyValue = row.gty;
    const isGty = gtyValue === true || /^(?:y|yes|true|gty|guarantee)$/i.test(String(gtyValue ?? '')) || /\bgty\b|guarantee/i.test(String(cruise.cabinType ?? ''));
    const hasNextCruiseBonus = Boolean(row.nextCruiseBonus || row.nextCruiseBonusValue || row.bookingBonus)
      || (cruise.perks ?? []).some((perk) => /next\s*cruise|booking bonus/i.test(perk));
    return { shipClass, pointRequirement, certificateCode, isGty, hasNextCruiseBonus };
  }, [cruise]);

  const crownAnchorProjection = useMemo(
    () => isBooked ? projectCrownAnchorCruisePoints(bookedCruise) : null,
    [bookedCruise, isBooked],
  );

  const provenanceLabel = useMemo(() => {
    return cruise.sourceProvider || cruise.pricingSource || cruise.sourceAuthority || cruise.cruiseSource || '';
  }, [cruise.cruiseSource, cruise.pricingSource, cruise.sourceAuthority, cruise.sourceProvider]);
  const canonicalCabinLabel = useMemo(() => getCanonicalCruiseCabinLabel(cruise), [cruise]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (preferences.reducedMotion) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  }, [preferences.reducedMotion, scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (preferences.reducedMotion) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  }, [preferences.reducedMotion, scaleAnim]);

  const miniGradientColors = useMemo((): [string, string, string] => {
    // Status belongs in the bounded badge. Every catalog card keeps the same
    // calm SeaPass surface instead of turning the whole row green or yellow.
    if (cruiseStatus === 'completed') return ['#F3F3F2', '#F5F5F4', '#FFFFFF'];
    if (cruiseStatus === 'active') return ['#F3F3F2', '#FFFFFF', '#F5F5F4'];
    return ['#FFFFFF', '#F5F5F4', '#F3F3F2'];
  }, [cruiseStatus]);

  const handleCompactImageError = useCallback(() => {
    console.log('[CruiseCard] Compact image load error', { currentUri: compactImageUri });
    if (compactImageUri !== DEFAULT_CRUISE_IMAGE) {
      setCompactImageUri(DEFAULT_CRUISE_IMAGE);
      return;
    }
    setShowCompactImage(false);
  }, [compactImageUri]);

  const handleHeroImageError = useCallback(() => {
    console.log('[CruiseCard] Hero image load error', { currentUri: heroImageUri });
    if (heroImageUri !== DEFAULT_CRUISE_IMAGE) {
      setHeroImageUri(DEFAULT_CRUISE_IMAGE);
      return;
    }
    setShowHeroImage(false);
  }, [heroImageUri]);

  if (mini) {
    const miniPorts = bookedCruise.itinerary?.map((day: ItineraryDay) => day.port).filter(Boolean) || bookedCruise.ports || [];
    const guestCount = bookedCruise.guestNames?.length || getCruiseGuestEligibility(bookedCruise);
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        style={styles.miniContainer}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`Open ${cruise.shipName} cruise details`}
        testID="cruise-card-mini"
      >
        <LinearGradient
          colors={miniGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {showCompactImage ? (
          <Image 
            source={{ uri: compactImageUri }} 
            style={styles.miniBackgroundImage}
            resizeMode="cover"
            onError={handleCompactImageError}
          />
        ) : null}
        <View style={styles.miniImageOverlay} pointerEvents="none" />
        <View style={styles.miniContent}>
          <View style={styles.miniTopRow}>
            <View style={styles.miniShipRow}>
              <Ship size={13} color={COLORS.navyDeep} />
              <Text style={styles.miniShipName} numberOfLines={1}>{cruise.shipName}</Text>
            </View>
            <View style={styles.miniBadgeStack}>
              <View style={[styles.miniStatusBadge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[
                  styles.miniStatusBadgeText,
                  statusBadge.bg === COLORS.goldAccent || statusBadge.bg === COLORS.aquaAccent 
                    ? { color: COLORS.navyDeep } 
                    : { color: COLORS.white }
                ]}>
                  {statusBadge.text}
                </Text>
              </View>
              {futureTopTierBadge ? (
                <View style={[styles.miniTopTierBadge, { backgroundColor: futureTopTierBadge.bg }]} testID="cruise-card-top-tier-badge">
                  <Text style={[styles.miniTopTierBadgeText, { color: futureTopTierBadge.textColor }]}>{futureTopTierBadge.text}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.miniItinerary} numberOfLines={2}>{getItineraryName()}</Text>
          {conflictWarning ? (
            <View style={styles.miniConflictRow} testID="cruise-card-overlap-warning">
              <AlertTriangle size={11} color="#92400E" />
              <Text style={styles.miniConflictText} numberOfLines={2}>{conflictWarning}</Text>
            </View>
          ) : null}
          <View style={styles.miniPlanningRow} testID="cruise-card-mini-sea-day-score">
            <Gauge size={10} color="#0F766E" />
            {seaDayDensity.isItineraryKnown ? (
              <>
                <Text style={styles.miniPlanningText}>Casino Opp {seaDayDensity.casinoOpportunityScore}</Text>
                <Text style={styles.miniPlanningMuted}>{seaDayDensity.seaDays} sea • {seaDayDensity.portDays} port{operationalMetrics ? ` • ${operationalMetrics.casinoOpenDays} casino-open • ~${Math.round(operationalMetrics.casinoOpenHours)}h` : ''}</Text>
              </>
            ) : <Text style={styles.miniPlanningMuted}>Itinerary needed for casino score</Text>}
          </View>
          {operationalMetrics ? (
            <View style={styles.miniModeledRow} testID="cruise-card-modeled-casino-metrics">
              <View style={styles.miniModeledFact}>
                <Clock3 size={10} color="#0E7FA7" />
                <Text style={styles.miniModeledText}>~{Number(operationalMetrics.modeledPlayerHours.toFixed(1))} modeled player hours</Text>
              </View>
              <View style={styles.miniModeledFact}>
                <Clock3 size={10} color="#0F766E" />
                <Text style={styles.miniModeledText}>~{Number(operationalMetrics.goldenHours.toFixed(1))} modeled golden hours</Text>
              </View>
              <View style={styles.miniModeledFact}>
                <Star size={10} color="#8A5A00" />
                <Text style={styles.miniModeledText}>{operationalMetrics.pointsForRate > 0 ? Math.round(operationalMetrics.pointsForRate).toLocaleString() : 'No'} {operationalMetrics.pointsBasis}</Text>
              </View>
              {operationalMetrics.pointsPerHour !== null ? (
                <View style={styles.miniModeledFact} testID="cruise-card-points-per-hour">
                  <Gauge size={10} color="#2C1D9A" />
                  <Text style={styles.miniModeledText}>~{Number(operationalMetrics.pointsPerHour.toFixed(1))} points/hour</Text>
                </View>
              ) : null}
              <View style={styles.miniModeledFact}>
                <Star size={10} color="#8A5A00" />
                <Text style={styles.miniModeledText}>~{Math.round(operationalMetrics.estimatedCasinoPoints).toLocaleString()} modeled casino points</Text>
              </View>
            </View>
          ) : null}
          <Text style={styles.miniDestination} numberOfLines={1}>
            {cruise.departurePort ? `From ${cruise.departurePort}` : cruise.destination}
          </Text>
          {miniPorts.length > 0 ? (
            <Text style={styles.miniPorts}>
              {miniPorts.join(' • ')}
            </Text>
          ) : null}
          <View style={styles.miniBottomRow}>
            <View style={styles.miniMetaRow}>
              <View style={styles.miniMeta}>
                <Calendar size={13} color={COLORS.navyDeep} />
                <Text style={styles.miniDate}>
                  {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
                </Text>
              </View>
              <View style={styles.miniMeta}>
                <Users size={13} color={COLORS.navyDeep} />
                <Text style={styles.miniDate}>{guestCount ? `${guestCount}G` : 'Guests ?'}</Text>
              </View>
            </View>
            <Text style={styles.miniNights}>{cruise.nights}N</Text>
          </View>
          <View style={styles.miniValueRow}>
            {showRetailValue && retailValue !== null && retailValue > 0 && (
              <Text style={styles.miniRetailValue}>${Math.round(retailValue).toLocaleString()}</Text>
            )}
            {canonicalCabinLabel ? (
              <View style={styles.miniCabinRow}>
                <Text style={styles.miniCabin}>{canonicalCabinLabel}</Text>
              </View>
            ) : <Text style={styles.miniMissingFact}>Stateroom not stated</Text>}
            {crownAnchorProjection?.points != null ? (
              <Text style={styles.miniExpectedPoints}>+{crownAnchorProjection.points.toLocaleString()} C&amp;A pts</Text>
            ) : null}
            {financialFacts.casinoPoints > 0 ? <Text style={styles.miniCatalogFact}>{financialFacts.casinoPoints.toLocaleString()} casino pts</Text> : null}
            {catalogFacts.shipClass ? <Text style={styles.miniCatalogFact}>{catalogFacts.shipClass} class</Text> : null}
            {catalogFacts.pointRequirement ? <Text style={styles.miniCatalogFact}>{catalogFacts.pointRequirement.toLocaleString()} point level</Text> : null}
            {catalogFacts.isGty ? <Text style={styles.miniCatalogFact}>GTY</Text> : null}
            {catalogFacts.hasNextCruiseBonus ? <Text style={styles.miniCatalogFact}>NextCruise bonus</Text> : null}
            {(bookedCruise.offerCode || cruise.offerCode) ? (
              <View style={styles.miniOfferBadge}>
                <Sparkles size={10} color={COLORS.goldDark} />
                <Text style={styles.miniOfferCode}>{bookedCruise.offerCode || cruise.offerCode}</Text>
              </View>
            ) : null}
            {catalogFacts.certificateCode ? (
              <View style={styles.miniOfferBadge}>
                <Ticket size={10} color="#273D9A" />
                <Text style={styles.miniOfferCode}>{catalogFacts.certificateCode}</Text>
              </View>
            ) : null}
          </View>
          {(financialFacts.actualPaid != null || financialFacts.advertisedPrice != null || financialFacts.suppliedValue != null) ? (
            <View style={styles.miniFinancialFacts} testID="cruise-card-financial-facts">
              {financialFacts.actualPaid != null ? <Text style={styles.miniFinancialFact}>Paid ${financialFacts.actualPaid.toLocaleString()}</Text> : null}
              {financialFacts.advertisedPrice != null ? <Text style={styles.miniFinancialFact}>Price ${financialFacts.advertisedPrice.toLocaleString()}</Text> : null}
              {financialFacts.suppliedValue != null ? <Text style={styles.miniFinancialFact}>Value ${financialFacts.suppliedValue.toLocaleString()}</Text> : null}
            </View>
          ) : null}
          {(relatedOfferOptionCount > 1 || relatedReservationCount > 1 || Boolean(cruise.offerCode || catalogFacts.certificateCode)) ? (
            <View style={styles.miniRelationshipRow} testID="cruise-card-physical-voyage-relationship">
              <Anchor size={10} color="#0E7FA7" />
              <Text style={styles.miniRelationshipText}>
                {relatedReservationCount > 1
                  ? `${relatedReservationCount} separate reservations share this physical voyage`
                  : relatedOfferOptionCount > 1
                    ? `${relatedOfferOptionCount} offer rows share this one physical voyage`
                    : 'Offer eligibility row · one physical voyage'}
              </Text>
            </View>
          ) : null}
          {(isBooked || !!(bookedCruise.offerCode || cruise.offerCode)) && (
            (bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined || 
             bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined || 
             bookedCruise.usedNextCruiseCertificate) && (
              <View style={styles.miniFpObcRow}>
                {(bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined) && (
                  <View style={styles.miniFpBadge}>
                    <Text style={styles.miniFpLabel}>FreePlay:</Text>
                    <Text style={styles.miniFpValue}>${(bookedCruise.freePlay ?? cruise.freePlay ?? 0).toLocaleString()}</Text>
                  </View>
                )}
                {(bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined) && (
                  <View style={styles.miniObcBadge}>
                    <Text style={styles.miniObcLabel}>OBC:</Text>
                    <Text style={styles.miniObcValue}>${(bookedCruise.freeOBC ?? cruise.freeOBC ?? 0).toLocaleString()}</Text>
                  </View>
                )}
                {bookedCruise.usedNextCruiseCertificate ? (
                  <View style={styles.miniNccBadge}>
                    <Ticket size={11} color="#7C3AED" />
                    <Text style={styles.miniNccLabel}>NCC</Text>
                  </View>
                ) : null}
              </View>
            )
          )}
          {!!((cruise.interiorPrice && cruise.interiorPrice > 0) || (cruise.oceanviewPrice && cruise.oceanviewPrice > 0) || (cruise.balconyPrice && cruise.balconyPrice > 0) || (cruise.suitePrice && cruise.suitePrice > 0)) && (
            <View style={styles.miniPricingRow}>
              {cruise.interiorPrice != null && cruise.interiorPrice > 0 && (
                <View style={styles.miniPricingItem}>
                  <Text style={styles.miniPricingLabel}>Int:</Text>
                  <Text style={styles.miniPricingValue}>${Math.round(cruise.interiorPrice).toLocaleString()}</Text>
                </View>
              )}
              {cruise.oceanviewPrice != null && cruise.oceanviewPrice > 0 && (
                <View style={styles.miniPricingItem}>
                  <Text style={styles.miniPricingLabel}>OV:</Text>
                  <Text style={styles.miniPricingValue}>${Math.round(cruise.oceanviewPrice).toLocaleString()}</Text>
                </View>
              )}
              {cruise.balconyPrice != null && cruise.balconyPrice > 0 && (
                <View style={styles.miniPricingItem}>
                  <Text style={styles.miniPricingLabel}>Bal:</Text>
                  <Text style={styles.miniPricingValue}>${Math.round(cruise.balconyPrice).toLocaleString()}</Text>
                </View>
              )}
              {cruise.suitePrice != null && cruise.suitePrice > 0 && (
                <View style={styles.miniPricingItem}>
                  <Text style={styles.miniPricingLabel}>Suite:</Text>
                  <Text style={styles.miniPricingValue}>${Math.round(cruise.suitePrice).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}
          {provenanceLabel ? <Text style={styles.miniProvenance} testID="cruise-card-mini-provenance">Source: {provenanceLabel}</Text> : null}
          {((bookedCruise.taxes ?? cruise.taxes ?? 0) > 0) && (
            <View style={styles.miniTaxesRow}>
              <Text style={styles.miniTaxesLabel}>Port Taxes & Fees:</Text>
              <Text style={styles.miniTaxesValue}>${Math.round(bookedCruise.taxes ?? cruise.taxes ?? 0).toLocaleString()}</Text>
            </View>
          )}
          {/* Booking Enrichment Data from Sync */}
          {isBooked && !!(bookedCruise.musterStation || bookedCruise.bookingStatus || bookedCruise.packageCode || bookedCruise.stateroomNumber || bookedCruise.stateroomCategoryCode) && (
            <View style={styles.miniEnrichmentSection}>
              {!!bookedCruise.bookingStatus && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Status:</Text>
                  <View style={[
                    styles.miniEnrichmentBadge,
                    { backgroundColor: bookedCruise.bookingStatus === 'BK' ? '#DCFCE7' : bookedCruise.bookingStatus === 'OF' ? '#FEF3C7' : '#E0E7FF' }
                  ]}>
                    <Text style={[
                      styles.miniEnrichmentBadgeText,
                      { color: bookedCruise.bookingStatus === 'BK' ? '#15803D' : bookedCruise.bookingStatus === 'OF' ? '#92400E' : '#4338CA' }
                    ]}>
                      {bookedCruise.bookingStatus === 'BK' ? 'Confirmed' : bookedCruise.bookingStatus === 'OF' ? 'Offer/Hold' : bookedCruise.bookingStatus}
                    </Text>
                  </View>
                </View>
              )}
              {!!bookedCruise.stateroomNumber && bookedCruise.stateroomNumber !== 'GTY' && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Cabin #:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.stateroomNumber}</Text>
                </View>
              )}
              {!!bookedCruise.stateroomCategoryCode && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Category:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.stateroomCategoryCode}</Text>
                </View>
              )}
              {!!bookedCruise.musterStation && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Muster:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.musterStation}</Text>
                </View>
              )}
              {!!bookedCruise.packageCode && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Offer Code:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.packageCode}</Text>
                </View>
              )}
              {!!bookedCruise.passengerStatus && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Pax Status:</Text>
                  <Text style={styles.miniEnrichmentValue}>
                    {bookedCruise.passengerStatus === 'AC' ? 'Active' : bookedCruise.passengerStatus}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        <ChevronRight size={20} color={COLORS.navyDeep} style={styles.miniChevron} pointerEvents="none" />
      </TouchableOpacity>
      </Animated.View>
    );
  }

  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        style={styles.compactContainer}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`Open ${cruise.shipName} cruise details`}
        testID="cruise-card-compact"
      >
        {showCompactImage ? (
          <Image 
            source={{ uri: compactImageUri }} 
            style={styles.compactImage}
            resizeMode="cover"
            onError={handleCompactImageError}
          />
        ) : null}
        <View style={styles.compactContent}>
          <Text style={styles.compactShipName}>{cruise.shipName}</Text>
          <Text style={styles.compactDestination} numberOfLines={1}>{cruise.destination}</Text>
          <View style={styles.compactMeta}>
            <Calendar size={12} color="#676A70" />
            <Text style={styles.compactDate}>
              {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color="#8E8A89" style={styles.compactChevron} />
      </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`Open ${cruise.shipName} cruise details`}
      testID="cruise-card"
    >
      <View style={styles.imageSection}>
        {showHeroImage ? (
          <Image 
            source={{ uri: heroImageUri }} 
            style={styles.heroImage}
            resizeMode="cover"
            onError={handleHeroImageError}
          />
        ) : null}
        
        {cruiseStatus === 'upcoming' && !isBooked && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>Casino Offer</Text>
          </View>
        )}

        <View style={styles.nightsBadge}>
          <Text style={styles.nightsBadgeText}>{cruise.nights} Nights</Text>
        </View>

        <View style={styles.cruiseNameOverlay}>
          <Text style={styles.cruiseNameText}>{getItineraryName()}</Text>
        </View>
      </View>
      
      <View style={styles.contentSection}>
        <View style={styles.headerRow}>
          <View style={styles.shipInfo}>
            <Ship size={16} color={COLORS.navyDeep} />
            <Text style={styles.shipName}>{cruise.shipName}</Text>
            <View style={styles.inlineBadgeStack}>
              <View style={[styles.inlineStatusBadge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[
                  styles.inlineStatusBadgeText,
                  statusBadge.bg === COLORS.goldAccent || statusBadge.bg === COLORS.aquaAccent 
                    ? { color: COLORS.navyDeep } 
                    : { color: COLORS.white }
                ]}>
                  {statusBadge.text}
                </Text>
              </View>
              {futureTopTierBadge ? (
                <View style={[styles.inlineTopTierBadge, { backgroundColor: futureTopTierBadge.bg }]} testID="cruise-card-top-tier-badge">
                  <Text style={[styles.inlineTopTierBadgeText, { color: futureTopTierBadge.textColor }]}>{futureTopTierBadge.text}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {onToggleFavorite ? (
            <View style={styles.actionIcons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleFavorite();
                }}
                accessibilityRole="button"
                accessibilityLabel={isFavorite ? `Remove ${cruise.shipName} from favorites` : `Add ${cruise.shipName} to favorites`}
                accessibilityState={{ selected: isFavorite }}
              >
                <Heart size={18} color={isFavorite ? COLORS.loyalty : '#8E8A89'} fill={isFavorite ? COLORS.loyalty : 'transparent'} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel}>Round trip from</Text>
          <Text style={styles.routeValue}>{cruise.departurePort || cruise.destination}</Text>
        </View>

        {conflictWarning ? (
          <View style={styles.conflictRow} testID="cruise-card-overlap-warning">
            <AlertTriangle size={14} color="#92400E" />
            <Text style={styles.conflictText}>{conflictWarning}</Text>
          </View>
        ) : null}

        {bookedCruise.itinerary && bookedCruise.itinerary.length > 0 ? (
          <View style={styles.visitingSection}>
            <Text style={styles.visitingLabel}>Visiting</Text>
            <Text style={styles.visitingPorts}>
              {bookedCruise.itinerary.map((day: ItineraryDay) => day.port).join(' • ')}
            </Text>
            <TouchableOpacity
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={`View ports and itinerary for ${cruise.shipName}`}
            >
              <Text style={styles.viewPortsLink}>+ View Ports & Map</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {bookedCruise.ports && bookedCruise.ports.length > 0 && !bookedCruise.itinerary ? (
          <View style={styles.visitingSection}>
            <Text style={styles.visitingLabel}>Visiting</Text>
            <Text style={styles.visitingPorts}>
              {bookedCruise.ports.join(' • ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.planningBadgeRow} testID="cruise-card-sea-day-score">
          {seaDayDensity.isItineraryKnown ? (
            <>
              <View style={styles.planningBadge}>
                <Gauge size={13} color="#0F766E" />
                <Text style={styles.planningBadgeText}>Casino Opportunity {seaDayDensity.casinoOpportunityScore}</Text>
              </View>
              <Text style={styles.planningBadgeMeta}>{seaDayDensity.seaDays} sea • {seaDayDensity.portDays} port</Text>
            </>
          ) : <Text style={styles.planningBadgeMeta}>Itinerary needed for sea-day and casino opportunity scoring</Text>}
        </View>

        {operationalMetrics ? (
          <View style={styles.miniModeledRow} testID="cruise-card-full-modeled-casino-metrics">
            <View style={styles.miniModeledFact}><Clock3 size={10} color="#0E7FA7" /><Text style={styles.miniModeledText}>~{Math.round(operationalMetrics.casinoOpenHours)} casino-open hours</Text></View>
            <View style={styles.miniModeledFact}><Clock3 size={10} color="#0F766E" /><Text style={styles.miniModeledText}>~{Number(operationalMetrics.modeledPlayerHours.toFixed(1))} modeled player hours</Text></View>
            <View style={styles.miniModeledFact}><Star size={10} color="#8A5A00" /><Text style={styles.miniModeledText}>~{Number(operationalMetrics.goldenHours.toFixed(1))} modeled golden hours</Text></View>
            {operationalMetrics.pointsPerHour !== null ? <View style={styles.miniModeledFact} testID="cruise-card-full-points-per-hour"><Gauge size={10} color="#2C1D9A" /><Text style={styles.miniModeledText}>~{Number(operationalMetrics.pointsPerHour.toFixed(1))} points/hour · {operationalMetrics.pointsBasis}</Text></View> : null}
          </View>
        ) : null}

        <View style={styles.dateGuestRow}>
          <View style={styles.dateInfo}>
            <Calendar size={14} color="#676A70" />
            <Text style={styles.dateText}>
              {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
            </Text>
          </View>
          <View style={styles.guestInfo}>
            <Users size={14} color="#676A70" />
            <Text style={styles.guestText}>
              {bookedCruise.guestNames?.length
                ? displayKnownCount(bookedCruise.guestNames.length, 'Guest')
                : formatGuestEligibility(bookedCruise, 'Guests not stated')}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.priceActionRow}>
          <View style={styles.priceSection}>
            {showRetailValue && retailValue !== null && retailValue > 0 && (
              <>
                <Text style={styles.priceLabel}>RETAIL VALUE*</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceDollar}>$</Text>
                  <Text style={styles.priceValue}>{Math.round(retailValue).toLocaleString()}</Text>
                </View>
              </>
            )}
            {canonicalCabinLabel ? (
              <Text style={styles.cabinType}>{canonicalCabinLabel}</Text>
            ) : <Text style={styles.cabinType}>Stateroom not stated</Text>}
            {isBooked ? (
              <Text style={styles.crownAnchorProjection} testID="cruise-card-crown-anchor-projection">
                {crownAnchorProjection?.points == null
                  ? crownAnchorProjection?.explanation ?? 'Occupancy and nights are required for Crown & Anchor points.'
                  : `+${crownAnchorProjection.points.toLocaleString()} Crown & Anchor points · ${crownAnchorProjection.explanation}`}
              </Text>
            ) : null}
            {provenanceLabel ? <Text style={styles.provenanceText} testID="cruise-card-provenance">Source: {provenanceLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.compactActionRow}>
          <TouchableOpacity style={styles.compactPrimaryButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View details for ${cruise.shipName}`}>
            <Text style={styles.compactPrimaryButtonText}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactSecondaryButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View itinerary for ${cruise.shipName}`}>
            <Text style={styles.compactSecondaryButtonText}>Itinerary</Text>
          </TouchableOpacity>
        </View>

        {(bookedCruise.offerName || cruise.offerName || cruise.offerCode) ? (
          <View style={styles.offerSection}>
            <Sparkles size={14} color={COLORS.goldDark} />
            <Text style={styles.offerText}>
              {bookedCruise.offerName || cruise.offerName || `Offer ${cruise.offerCode}`}
            </Text>
            {(bookedCruise.offerCode || cruise.offerCode) ? (
              <View style={styles.offerCodeBadge}>
                <Anchor size={10} color={COLORS.loyalty} />
                <Text style={styles.offerCodeText}>{bookedCruise.offerCode || cruise.offerCode}</Text>
              </View>
            ) : null}
            {cruise.offerValue && cruise.offerValue > 0 ? (
              <View style={styles.offerValueBadge}>
                <Text style={styles.offerValueText}>${cruise.offerValue.toLocaleString()}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {(isBooked || !!(bookedCruise.offerCode || cruise.offerCode)) && (
          (bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined || 
           bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined) && (
            <View style={styles.fpObcSection}>
              {(bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined) && (
                <View style={styles.fpContainer}>
                  <Text style={styles.fpLabel}>FreePlay (FP$)</Text>
                  <Text style={styles.fpValue}>${(bookedCruise.freePlay ?? cruise.freePlay ?? 0).toLocaleString()}</Text>
                </View>
              )}
              {(bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined) && (
                <View style={styles.obcContainer}>
                  <Text style={styles.obcLabel}>Onboard Credit (OBC)</Text>
                  <Text style={styles.obcValue}>${(bookedCruise.freeOBC ?? cruise.freeOBC ?? 0).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )
        )}


      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFCF7',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D8D2C8',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 4,
  },
  miniContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D2C8',
    backgroundColor: '#FFFCF7',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  miniBackgroundImage: {
    width: '100%',
    height: 176,
    opacity: 1,
  },
  miniImageOverlay: {
    display: 'none',
  },
  miniContent: {
    width: '100%',
    padding: 16,
  },
  miniTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  miniShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  miniShipName: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    flex: 1,
    marginRight: 4,
  },
  miniItinerary: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#333334',
    marginBottom: 6,
  },
  miniBadgeStack: {
    alignItems: 'flex-end',
    gap: 3,
    marginLeft: 6,
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStatusBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.3,
  },
  miniTopTierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 54,
    alignItems: 'center',
  },
  miniTopTierBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
  },
  miniDestination: {
    fontSize: 13,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  miniConflictRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginBottom: 5,
  },
  miniConflictText: {
    flex: 1,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#78350F',
    lineHeight: 13,
  },
  miniPlanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 3,
  },
  miniPlanningText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0F766E',
  },
  miniPlanningMuted: {
    fontSize: 11,
    color: '#64748B',
    flexShrink: 1,
  },
  miniModeledRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 4,
  },
  miniModeledFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 24,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: '#FFFFFF',
  },
  miniModeledText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#425466',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniPorts: {
    fontSize: 11,
    color: '#676A70',
    marginBottom: 3,
  },
  miniBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  miniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniDate: {
    fontSize: 12,
    color: COLORS.navyDeep,
  },
  miniNights: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    backgroundColor: '#EDF4F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
  },
  miniValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniRetailValue: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#333334',
  },
  miniCabinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF4F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
  },
  miniCabin: {
    fontSize: 11,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniExpectedPoints: {
    fontSize: 11,
    color: '#16755F',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniMissingFact: {
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8A89',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniCatalogFact: {
    fontSize: 11,
    lineHeight: 14,
    color: '#17324D',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    backgroundColor: '#EDF4F3',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
  },
  miniOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F9F0DC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
  },
  miniOfferCode: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  miniFinancialFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  miniFinancialFact: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#123D73',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#C6DDE6',
    backgroundColor: '#EDF4F3',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  miniRelationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B8DEE1',
    backgroundColor: '#F0FAFA',
  },
  miniRelationshipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#315E68',
  },
  miniChevron: {
    position: 'absolute',
    right: 12,
    top: 190,
  },
  miniPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#D8D2C8',
  },
  miniPricingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  miniPricingLabel: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniPricingValue: {
    fontSize: 11,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniTaxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  miniTaxesLabel: {
    fontSize: 11,
    color: '#676A70',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  miniTaxesValue: {
    fontSize: 11,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniProvenance: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
    color: '#66737F',
    fontSize: 11,
    lineHeight: 14,
  },
  miniFpObcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  miniFpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniFpLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  miniFpValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  miniObcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniObcLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  miniObcValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  miniNccBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniNccLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#7C3AED',
  },
  miniNccValue: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#7C3AED',
  },
  miniEnrichmentSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#D5D5D0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniEnrichmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniEnrichmentLabel: {
    fontSize: 11,
    color: '#676A70',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  miniEnrichmentValue: {
    fontSize: 11,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniEnrichmentBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  miniEnrichmentBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  compactContainer: {
    backgroundColor: '#FFFCF7',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8D2C8',
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  compactImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    margin: SPACING.sm,
  },
  compactContent: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  compactShipName: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  compactDestination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1F2937',
    marginBottom: 4,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#676A70',
  },
  compactChevron: {
    marginRight: SPACING.sm,
  },
  imageSection: {
    height: 232,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  saleBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: '#17324D',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  saleBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  nightsBadge: {
    position: 'absolute',
    bottom: 48,
    left: SPACING.md,
    backgroundColor: 'rgba(21, 40, 59, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  nightsBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  cruiseNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(21, 40, 59, 0.82)',
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  cruiseNameText: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  contentSection: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  shipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  shipName: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: SPACING.xs,
  },
  ratingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#676A70',
  },
  actionIcons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    padding: 4,
  },
  routeInfo: {
    marginBottom: SPACING.sm,
  },
  routeLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#676A70',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 15,
    color: '#425466',
  },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  conflictText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#78350F',
    lineHeight: 17,
  },
  visitingSection: {
    marginBottom: SPACING.sm,
  },
  visitingLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#676A70',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  visitingPorts: {
    fontSize: 14,
    color: '#425466',
    lineHeight: 21,
  },
  viewPortsLink: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginTop: 4,
  },
  planningBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    backgroundColor: '#EDF4F3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#C6DEDC',
  },
  planningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  planningBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0F766E',
  },
  planningBadgeMeta: {
    fontSize: 11,
    color: '#475569',
  },
  dateGuestRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#676A70',
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guestText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#676A70',
  },
  divider: {
    height: 1,
    backgroundColor: '#E3DDD4',
    marginBottom: SPACING.md,
  },
  priceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  priceSection: {
    flex: 1,
  },
  priceLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#676A70',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priceDollar: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginTop: 4,
  },
  priceValue: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  cabinType: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#676A70',
    marginTop: 2,
  },
  crownAnchorProjection: {
    marginTop: 4,
    color: COLORS.tierPinnacle,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  provenanceText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    color: '#60727F',
    textTransform: 'capitalize',
  },
  compactActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  compactPrimaryButton: {
    flex: 1,
    backgroundColor: COLORS.textNavy,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
  },
  compactPrimaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  compactSecondaryButton: {
    flex: 1,
    backgroundColor: '#FFFCF7',
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  compactSecondaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  inlineBadgeStack: {
    alignItems: 'flex-start',
    gap: 3,
    marginLeft: SPACING.xs,
  },
  inlineStatusBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  inlineStatusBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.3,
  },
  inlineTopTierBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    minWidth: 58,
    alignItems: 'center',
  },
  inlineTopTierBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
  },
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9F0DC',
    padding: 12,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  offerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#92400E',
    flex: 1,
  },
  offerCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  offerCodeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.loyalty,
  },
  offerValueBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginLeft: 4,
  },
  offerValueText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#16755F',
  },
  fpObcSection: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fpContainer: {
    flex: 1,
    backgroundColor: '#EDF4F3',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#C6DEDC',
  },
  fpLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#167C80',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fpValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#167C80',
  },
  obcContainer: {
    flex: 1,
    backgroundColor: '#EEF2F7',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D3DCE8',
  },
  obcLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#17324D',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  obcValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#17324D',
  },
});
