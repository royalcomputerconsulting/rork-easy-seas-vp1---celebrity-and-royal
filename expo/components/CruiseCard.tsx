import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, Users, Ship, Sparkles, Ticket } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { getUniqueImageForCruise, getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import type { Cruise, BookedCruise, ItineraryDay } from '@/types/models';

interface CruiseCardProps {
  cruise: Cruise | BookedCruise;
  onPress?: () => void;
  showPricePerNight?: boolean;
  compact?: boolean;
  mini?: boolean;
  variant?: 'default' | 'booked' | 'available' | 'completed';
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
    if (today > returnDate) return 'completed';
    if (today >= sailDate && today <= returnDate) return 'active';
  }
  return 'upcoming';
}

export const CruiseCard = React.memo(function CruiseCard({
  cruise,
  onPress,
  showPricePerNight: _showPricePerNight = true,
  compact = false,
  mini = false,
  variant = 'default',
  showRetailValue = true,
}: CruiseCardProps) {
  const isBooked = variant === 'booked' || variant === 'completed' || 'bookingId' in cruise || 'reservationNumber' in cruise;
  const bookedCruise = cruise as BookedCruise;

  const cruiseStatus = useMemo(() => {
    if (variant === 'completed') return 'completed';
    if (isBooked) return getCruiseStatus(bookedCruise);
    return 'upcoming';
  }, [variant, isBooked, bookedCruise]);

  const shipImageUrl = useMemo(() => {
    return getUniqueImageForCruise(cruise.id, cruise.destination, cruise.sailDate, cruise.shipName);
  }, [cruise.id, cruise.destination, cruise.sailDate, cruise.shipName]);

  const destinationImage = useMemo(() => {
    const hash = cruise.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return getImageForDestination(cruise.destination, hash + 1);
  }, [cruise.id, cruise.destination]);

  const [heroImageUri, setHeroImageUri] = useState<string>(shipImageUrl || DEFAULT_CRUISE_IMAGE);
  const [compactImageUri, setCompactImageUri] = useState<string>(destinationImage || DEFAULT_CRUISE_IMAGE);

  useEffect(() => { setHeroImageUri(shipImageUrl || DEFAULT_CRUISE_IMAGE); }, [shipImageUrl]);
  useEffect(() => { setCompactImageUri(destinationImage || DEFAULT_CRUISE_IMAGE); }, [destinationImage]);

  const retailValue = useMemo(() => {
    if (!showRetailValue) return null;
    const guestCount = cruise.guests || 2;
    const bc = cruise as BookedCruise;
    if (bc.totalRetailCost && bc.pricePaid !== undefined) return bc.totalRetailCost * 2;
    const cabinPrice = cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice || cruise.price || 0;
    return cabinPrice * guestCount;
  }, [cruise, showRetailValue]);

  const formatDateRange = (sailDate: string, returnDate?: string, nights?: number) => {
    const start = createDateFromString(sailDate);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const startDay = start.getDate();
    const startYear = start.getFullYear();
    if (returnDate) {
      const end = createDateFromString(returnDate);
      const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const endDay = end.getDate();
      if (startMonth === endMonth) return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
    }
    if (nights) {
      const end = new Date(start);
      end.setDate(end.getDate() + nights);
      const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const endDay = end.getDate();
      if (startMonth === endMonth) return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
    }
    return `${startMonth} ${startDay}, ${startYear}`;
  };

  const getStatusBadge = () => {
    switch (cruiseStatus) {
      case 'completed': return { text: 'COMPLETED', bg: COLORS.money };
      case 'active': return { text: 'ON BOARD', bg: COLORS.points };
      default: return isBooked ? { text: 'BOOKED', bg: COLORS.loyalty } : { text: 'AVAILABLE', bg: COLORS.gold };
    }
  };

  const getItineraryName = () => {
    if (cruise.itineraryName) {
      const parts = cruise.itineraryName.split(':');
      if (parts.length > 1) return parts[1].trim();
      const isJustNumber = /^\d+$/.test(cruise.itineraryName.trim());
      if (isJustNumber || cruise.itineraryName.length < 5) return `${cruise.nights || 0}-Night ${cruise.destination || 'Cruise'}`;
      return cruise.itineraryName;
    }
    return `${cruise.nights || 0}-Night ${cruise.destination || 'Cruise'}`;
  };

  const statusBadge = getStatusBadge();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 5, tension: 300 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  }, [scaleAnim]);

  if (mini) {
    const miniPorts = bookedCruise.itinerary?.map((day: ItineraryDay) => day.port).filter(Boolean) || bookedCruise.ports || [];
    const guestCount = bookedCruise.guestNames?.length || bookedCruise.guests || 2;
    const hasPricing = !!(
      (cruise.interiorPrice && cruise.interiorPrice > 0) ||
      (cruise.oceanviewPrice && cruise.oceanviewPrice > 0) ||
      (cruise.balconyPrice && cruise.balconyPrice > 0) ||
      (cruise.suitePrice && cruise.suitePrice > 0)
    );
    const hasFpObc = (
      bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined ||
      bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined ||
      !!bookedCruise.usedNextCruiseCertificate
    );
    const hasEnrichment = isBooked && !!(
      bookedCruise.musterStation || bookedCruise.bookingStatus ||
      bookedCruise.packageCode || bookedCruise.stateroomNumber ||
      bookedCruise.stateroomCategoryCode
    );

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.uniContainer}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          testID="cruise-card-mini"
        >
          {/* HEADER - matches offer card name header style */}
          <View style={styles.uniHeader}>
            <View style={styles.uniHeaderLeft}>
              <View style={styles.uniShipRow}>
                <Ship size={13} color={COLORS.navyDeep} />
                <Text style={styles.uniShipName} numberOfLines={1}>{cruise.shipName}</Text>
              </View>
              {(bookedCruise.offerCode || cruise.offerCode) ? (
                <View style={styles.uniCodeBadge}>
                  <Text style={styles.uniCodeText}>{'CODE: ' + (bookedCruise.offerCode || cruise.offerCode)}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.uniStatusBadge, { backgroundColor: statusBadge.bg }]}>
              <Text style={[
                styles.uniStatusText,
                (statusBadge.bg === COLORS.goldAccent || statusBadge.bg === COLORS.aquaAccent)
                  ? { color: COLORS.navyDeep }
                  : { color: COLORS.white },
              ]}>
                {statusBadge.text}
              </Text>
            </View>
          </View>

          {/* IMAGE - full-width like offer card */}
          <View style={styles.uniImageSection}>
            <Image
              source={{ uri: compactImageUri }}
              style={styles.uniImage}
              resizeMode="cover"
              onError={() => setCompactImageUri(DEFAULT_CRUISE_IMAGE)}
            />
            {cruiseStatus === 'upcoming' && !isBooked ? (
              <View style={styles.uniSaleBadge}>
                <Text style={styles.uniSaleBadgeText}>{'Casino Offer'}</Text>
              </View>
            ) : null}
            <View style={styles.uniNightsBadge}>
              <Text style={styles.uniNightsBadgeText}>{String(cruise.nights) + 'N'}</Text>
            </View>
            <View style={styles.uniItineraryOverlay}>
              <Text style={styles.uniItineraryText} numberOfLines={1}>{getItineraryName()}</Text>
            </View>
          </View>

          {/* CONTENT */}
          <View style={styles.uniContent}>
            {/* Route */}
            {(cruise.departurePort || cruise.destination) ? (
              <View style={styles.uniRouteRow}>
                <Text style={styles.uniRouteLabel}>{'ROUNDTRIP FROM'}</Text>
                <Text style={styles.uniRouteValue} numberOfLines={1}>
                  {cruise.departurePort || cruise.destination}
                </Text>
              </View>
            ) : null}
            {miniPorts.length > 0 ? (
              <Text style={styles.uniPortsText} numberOfLines={2}>
                {miniPorts.join(' \u2022 ')}
              </Text>
            ) : null}

            <View style={styles.uniDivider} />

            {/* Date + guests row */}
            <View style={styles.uniMetaRow}>
              <View style={styles.uniMetaItem}>
                <Calendar size={13} color={'#6B7280'} />
                <Text style={styles.uniMetaText}>
                  {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
                </Text>
              </View>
              <View style={styles.uniMetaItem}>
                <Users size={13} color={'#6B7280'} />
                <Text style={styles.uniMetaText}>{String(guestCount) + 'G'}</Text>
              </View>
            </View>

            <View style={styles.uniDivider} />

            {/* Key info chips - Cabin + Retail */}
            <View style={styles.uniKeyInfoRow}>
              {bookedCruise.cabinType ? (
                <View style={styles.uniCabinChip}>
                  <Text style={styles.uniCabinChipLabel}>{'ROOM TYPE'}</Text>
                  <Text style={styles.uniCabinChipValue}>{bookedCruise.cabinType}</Text>
                  {cruise.nights != null && cruise.nights > 0 ? (
                    <Text style={styles.uniPointsText}>{String(cruise.nights * 2) + ' pts'}</Text>
                  ) : null}
                </View>
              ) : null}
              {showRetailValue && retailValue !== null && retailValue > 0 ? (
                <View style={styles.uniRetailChip}>
                  <Text style={styles.uniRetailLabel}>{'RETAIL VALUE'}</Text>
                  <Text style={styles.uniRetailValue}>{'$' + Math.round(retailValue).toLocaleString()}</Text>
                </View>
              ) : null}
            </View>

            {/* FP / OBC / NCC */}
            {hasFpObc ? (
              <View style={styles.uniFpObcRow}>
                {bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined ? (
                  <View style={styles.uniFpBadge}>
                    <Text style={styles.uniFpLabel}>{'FreePlay:'}</Text>
                    <Text style={styles.uniFpValue}>{'$' + (bookedCruise.freePlay ?? cruise.freePlay ?? 0).toLocaleString()}</Text>
                  </View>
                ) : null}
                {bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined ? (
                  <View style={styles.uniObcBadge}>
                    <Text style={styles.uniObcLabel}>{'OBC:'}</Text>
                    <Text style={styles.uniObcValue}>{'$' + (bookedCruise.freeOBC ?? cruise.freeOBC ?? 0).toLocaleString()}</Text>
                  </View>
                ) : null}
                {bookedCruise.usedNextCruiseCertificate ? (
                  <View style={styles.uniNccBadge}>
                    <Ticket size={11} color={'#7C3AED'} />
                    <Text style={styles.uniNccLabel}>{'NCC'}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Offer name */}
            {(bookedCruise.offerName || cruise.offerName) ? (
              <View style={styles.uniOfferRow}>
                <Sparkles size={12} color={COLORS.goldDark} />
                <Text style={styles.uniOfferText} numberOfLines={1}>
                  {bookedCruise.offerName || cruise.offerName}
                </Text>
                {cruise.offerValue != null && cruise.offerValue > 0 ? (
                  <View style={styles.uniOfferValueBadge}>
                    <Text style={styles.uniOfferValueText}>{'$' + cruise.offerValue.toLocaleString()}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Pricing row */}
            {hasPricing ? (
              <View style={styles.uniPricingRow}>
                {cruise.interiorPrice != null && cruise.interiorPrice > 0 ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>{'Int:'}</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.interiorPrice).toLocaleString()}</Text>
                  </View>
                ) : null}
                {cruise.oceanviewPrice != null && cruise.oceanviewPrice > 0 ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>{'OV:'}</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.oceanviewPrice).toLocaleString()}</Text>
                  </View>
                ) : null}
                {cruise.balconyPrice != null && cruise.balconyPrice > 0 ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>{'Bal:'}</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.balconyPrice).toLocaleString()}</Text>
                  </View>
                ) : null}
                {cruise.suitePrice != null && cruise.suitePrice > 0 ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>{'Suite:'}</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.suitePrice).toLocaleString()}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Taxes */}
            {(bookedCruise.taxes ?? cruise.taxes ?? 0) > 0 ? (
              <View style={styles.uniTaxesRow}>
                <Text style={styles.uniTaxesLabel}>{'Port Taxes & Fees:'}</Text>
                <Text style={styles.uniTaxesValue}>{'$' + Math.round(bookedCruise.taxes ?? cruise.taxes ?? 0).toLocaleString()}</Text>
              </View>
            ) : null}

            {/* Booking enrichment */}
            {hasEnrichment ? (
              <View style={styles.uniEnrichmentSection}>
                {bookedCruise.bookingStatus ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Status:'}</Text>
                    <View style={[
                      styles.uniEnrichmentBadge,
                      { backgroundColor: bookedCruise.bookingStatus === 'BK' ? '#DCFCE7' : bookedCruise.bookingStatus === 'OF' ? '#FEF3C7' : '#E0E7FF' },
                    ]}>
                      <Text style={[
                        styles.uniEnrichmentBadgeText,
                        { color: bookedCruise.bookingStatus === 'BK' ? '#15803D' : bookedCruise.bookingStatus === 'OF' ? '#92400E' : '#4338CA' },
                      ]}>
                        {bookedCruise.bookingStatus === 'BK' ? 'Confirmed' : bookedCruise.bookingStatus === 'OF' ? 'Offer/Hold' : bookedCruise.bookingStatus}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {bookedCruise.stateroomNumber && bookedCruise.stateroomNumber !== 'GTY' ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Cabin #:'}</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.stateroomNumber}</Text>
                  </View>
                ) : null}
                {bookedCruise.stateroomCategoryCode ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Category:'}</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.stateroomCategoryCode}</Text>
                  </View>
                ) : null}
                {bookedCruise.stateroomType ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Type:'}</Text>
                    <Text style={styles.uniEnrichmentValue}>
                      {bookedCruise.stateroomType === 'B' ? 'Balcony' : bookedCruise.stateroomType === 'O' ? 'Ocean View' : bookedCruise.stateroomType === 'I' ? 'Interior' : bookedCruise.stateroomType === 'S' ? 'Suite' : bookedCruise.stateroomType}
                    </Text>
                  </View>
                ) : null}
                {bookedCruise.musterStation ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Muster:'}</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.musterStation}</Text>
                  </View>
                ) : null}
                {bookedCruise.packageCode ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Pkg Code:'}</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.packageCode}</Text>
                  </View>
                ) : null}
                {bookedCruise.passengerStatus ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>{'Pax Status:'}</Text>
                    <Text style={styles.uniEnrichmentValue}>
                      {bookedCruise.passengerStatus === 'AC' ? 'Active' : bookedCruise.passengerStatus}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ACTION BUTTON - like offer card CTA */}
            <TouchableOpacity style={styles.uniActionButton} onPress={onPress} activeOpacity={0.85}>
              <Text style={styles.uniActionButtonText}>{'View Details'}</Text>
              <ChevronRight size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
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
          testID="cruise-card-compact"
        >
          <Image
            source={{ uri: compactImageUri }}
            style={styles.compactImage}
            resizeMode="cover"
            onError={() => setCompactImageUri(DEFAULT_CRUISE_IMAGE)}
          />
          <View style={styles.compactContent}>
            <Text style={styles.compactShipName}>{cruise.shipName}</Text>
            <Text style={styles.compactDestination} numberOfLines={1}>{cruise.destination}</Text>
            <View style={styles.compactMeta}>
              <Calendar size={12} color="#6B7280" />
              <Text style={styles.compactDate}>
                {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color="#9CA3AF" style={styles.compactChevron} />
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
        testID="cruise-card"
      >
        <View style={styles.imageSection}>
          <Image
            source={{ uri: heroImageUri }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroImageUri(DEFAULT_CRUISE_IMAGE)}
          />
          {cruiseStatus === 'upcoming' && !isBooked ? (
            <View style={styles.saleBadge}>
              <Text style={styles.saleBadgeText}>{'Casino Offer'}</Text>
            </View>
          ) : null}
          <View style={styles.nightsBadge}>
            <Text style={styles.nightsBadgeText}>{String(cruise.nights) + ' Nights'}</Text>
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
              <View style={[styles.inlineStatusBadge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[
                  styles.inlineStatusBadgeText,
                  (statusBadge.bg === COLORS.goldAccent || statusBadge.bg === COLORS.aquaAccent)
                    ? { color: COLORS.navyDeep }
                    : { color: COLORS.white },
                ]}>
                  {statusBadge.text}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>{'ROUNDTRIP FROM:'}</Text>
            <Text style={styles.routeValue}>{cruise.departurePort || cruise.destination}</Text>
          </View>

          {bookedCruise.itinerary && bookedCruise.itinerary.length > 0 ? (
            <View style={styles.visitingSection}>
              <Text style={styles.visitingLabel}>{'VISITING:'}</Text>
              <Text style={styles.visitingPorts}>
                {bookedCruise.itinerary.map((day: ItineraryDay) => day.port).join(' \u2022 ')}
              </Text>
            </View>
          ) : null}

          {bookedCruise.ports && bookedCruise.ports.length > 0 && !bookedCruise.itinerary ? (
            <View style={styles.visitingSection}>
              <Text style={styles.visitingLabel}>{'VISITING:'}</Text>
              <Text style={styles.visitingPorts}>{bookedCruise.ports.join(' \u2022 ')}</Text>
            </View>
          ) : null}

          <View style={styles.dateGuestRow}>
            <View style={styles.dateInfo}>
              <Calendar size={14} color="#6B7280" />
              <Text style={styles.dateText}>{formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}</Text>
            </View>
            <View style={styles.guestInfo}>
              <Users size={14} color="#6B7280" />
              <Text style={styles.guestText}>{String(bookedCruise.guestNames?.length || bookedCruise.guests || 2) + ' Guests'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {showRetailValue && retailValue !== null && retailValue > 0 ? (
            <View style={styles.priceActionRow}>
              <View style={styles.priceSection}>
                <Text style={styles.priceLabel}>{'RETAIL VALUE*'}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceDollar}>{'$'}</Text>
                  <Text style={styles.priceValue}>{Math.round(retailValue).toLocaleString()}</Text>
                </View>
                {bookedCruise.cabinType ? (
                  <Text style={styles.cabinType}>{bookedCruise.cabinType}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.compactActionRow}>
            <TouchableOpacity style={styles.compactPrimaryButton} onPress={onPress}>
              <Text style={styles.compactPrimaryButtonText}>{'Details'}</Text>
            </TouchableOpacity>
          </View>

          {(bookedCruise.offerName || cruise.offerName || cruise.offerCode) ? (
            <View style={styles.offerSection}>
              <Sparkles size={14} color={COLORS.goldDark} />
              <Text style={styles.offerText}>
                {bookedCruise.offerName || cruise.offerName || ('Offer ' + cruise.offerCode)}
              </Text>
              {(bookedCruise.offerCode || cruise.offerCode) ? (
                <View style={styles.offerCodeBadge}>
                  <Text style={styles.offerCodeText}>{bookedCruise.offerCode || cruise.offerCode}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {(bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined ||
            bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined) ? (
            <View style={styles.fpObcSection}>
              {bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined ? (
                <View style={styles.fpContainer}>
                  <Text style={styles.fpLabel}>{'FreePlay (FP$)'}</Text>
                  <Text style={styles.fpValue}>{'$' + (bookedCruise.freePlay ?? cruise.freePlay ?? 0).toLocaleString()}</Text>
                </View>
              ) : null}
              {bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined ? (
                <View style={styles.obcContainer}>
                  <Text style={styles.obcLabel}>{'Onboard Credit (OBC)'}</Text>
                  <Text style={styles.obcValue}>{'$' + (bookedCruise.freeOBC ?? cruise.freeOBC ?? 0).toLocaleString()}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // ─── UNIFIED MINI CARD (offer card style) ───────────────────────
  uniContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  uniHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  uniHeaderLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  uniShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  uniShipName: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#000000',
    flex: 1,
  },
  uniCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  uniCodeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.4,
  },
  uniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  uniStatusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  uniImageSection: {
    height: 110,
    position: 'relative',
  },
  uniImage: {
    width: '100%',
    height: '100%',
  },
  uniSaleBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: COLORS.loyalty,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  uniSaleBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  uniNightsBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.88)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  uniNightsBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  uniItineraryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 31, 63, 0.78)',
    paddingVertical: 5,
    paddingHorizontal: SPACING.sm,
  },
  uniItineraryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.white,
  },
  uniContent: {
    padding: SPACING.md,
  },
  uniRouteRow: {
    marginBottom: 4,
  },
  uniRouteLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  uniRouteValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  uniPortsText: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 4,
    lineHeight: 16,
  },
  uniDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: SPACING.sm,
  },
  uniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  uniMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uniMetaText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500' as const,
  },
  uniKeyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  uniCabinChip: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  uniCabinChipLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  uniCabinChipValue: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  uniPointsText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700' as const,
    marginTop: 1,
  },
  uniRetailChip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginLeft: 'auto' as const,
    alignItems: 'flex-end',
  },
  uniRetailLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
  uniRetailValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#2E7D32',
  },
  uniFpObcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  uniFpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  uniFpLabel: { fontSize: 11, fontWeight: '700' as const, color: '#15803D' },
  uniFpValue: { fontSize: 11, fontWeight: '700' as const, color: '#15803D' },
  uniObcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  uniObcLabel: { fontSize: 11, fontWeight: '700' as const, color: '#1E40AF' },
  uniObcValue: { fontSize: 11, fontWeight: '700' as const, color: '#1E40AF' },
  uniNccBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  uniNccLabel: { fontSize: 11, fontWeight: '700' as const, color: '#7C3AED' },
  uniOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  uniOfferText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500' as const,
    flex: 1,
  },
  uniOfferValueBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  uniOfferValueText: { fontSize: 11, fontWeight: '700' as const, color: '#059669' },
  uniPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  uniPricingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  uniPricingLabel: { fontSize: 10, color: '#0369A1', fontWeight: '700' as const },
  uniPricingValue: { fontSize: 11, color: COLORS.navyDeep, fontWeight: '700' as const },
  uniTaxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.xs,
  },
  uniTaxesLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' as const },
  uniTaxesValue: { fontSize: 11, color: COLORS.navyDeep, fontWeight: '700' as const },
  uniEnrichmentSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  uniEnrichmentRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  uniEnrichmentLabel: { fontSize: 9, color: '#6B7280', fontWeight: '500' as const },
  uniEnrichmentValue: { fontSize: 9, color: COLORS.navyDeep, fontWeight: '600' as const },
  uniEnrichmentBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  uniEnrichmentBadgeText: { fontSize: 9, fontWeight: '700' as const },
  uniActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.md,
  },
  uniActionButtonText: { fontSize: 13, fontWeight: '700' as const, color: COLORS.white },

  // ─── COMPACT ────────────────────────────────────────────────────
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.sm,
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
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactDate: { fontSize: TYPOGRAPHY.fontSizeXS, color: '#6B7280' },
  compactChevron: { marginRight: SPACING.sm },

  // ─── DEFAULT (full card) ──────────────────────────────────────────
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  imageSection: { height: 200, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  saleBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: COLORS.loyalty,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  saleBadgeText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  nightsBadge: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.md,
    backgroundColor: 'rgba(0, 31, 63, 0.85)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  nightsBadgeText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  cruiseNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 31, 63, 0.75)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  cruiseNameText: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  contentSection: { padding: SPACING.lg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  shipInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  shipName: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.navyDeep },
  inlineStatusBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginLeft: SPACING.xs,
  },
  inlineStatusBadgeText: { fontSize: 9, fontWeight: TYPOGRAPHY.fontWeightBold, letterSpacing: 0.3 },
  routeInfo: { marginBottom: SPACING.sm },
  routeLabel: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#6B7280', letterSpacing: 0.5, marginBottom: 2 },
  routeValue: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#1F2937' },
  visitingSection: { marginBottom: SPACING.sm },
  visitingLabel: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#6B7280', letterSpacing: 0.5, marginBottom: 2 },
  visitingPorts: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#1F2937', lineHeight: 20 },
  dateGuestRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#6B7280' },
  guestInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guestText: { fontSize: TYPOGRAPHY.fontSizeSM, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: SPACING.md },
  priceActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  priceSection: { flex: 1 },
  priceLabel: { fontSize: TYPOGRAPHY.fontSizeXS, color: '#6B7280', letterSpacing: 0.3, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  priceDollar: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.navyDeep, marginTop: 4 },
  priceValue: { fontSize: TYPOGRAPHY.fontSizeHero, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.navyDeep },
  cabinType: { fontSize: TYPOGRAPHY.fontSizeXS, color: '#6B7280', marginTop: 2 },
  compactActionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  compactPrimaryButton: {
    flex: 1,
    backgroundColor: COLORS.textNavy,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  compactPrimaryButtonText: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  offerText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightMedium, color: '#92400E', flex: 1 },
  offerCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  offerCodeText: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.loyalty },
  fpObcSection: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  fpContainer: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  fpLabel: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#15803D', letterSpacing: 0.5, marginBottom: 2 },
  fpValue: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#15803D' },
  obcContainer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  obcLabel: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#1E40AF', letterSpacing: 0.5, marginBottom: 2 },
  obcValue: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#1E40AF' },
});
