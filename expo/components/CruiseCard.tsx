import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, Users, Ship, Sparkles, Ticket, MapPin, Star } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { createDateFromString } from '@/lib/date';
import { getUniqueImageForCruise, getImageForDestination, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';
import type { Cruise, BookedCruise, ItineraryDay } from '@/types/models';

const CARD_BG = 'rgba(8, 20, 40, 0.92)' as const;
const CARD_BORDER = 'rgba(151, 176, 255, 0.16)' as const;
const INNER_BG = 'rgba(255,255,255,0.06)' as const;
const INNER_BORDER = 'rgba(255,255,255,0.09)' as const;
const TEXT_PRIMARY = '#FFFFFF' as const;
const TEXT_SECONDARY = 'rgba(213, 224, 255, 0.72)' as const;
const TEXT_MUTED = 'rgba(180, 195, 240, 0.5)' as const;

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

function getStatusColors(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'BOOKED':
      return { bg: 'rgba(31,212,194,0.18)', text: '#9EFDF2', border: 'rgba(90,255,233,0.45)' };
    case 'COMPLETED':
      return { bg: 'rgba(39,210,137,0.18)', text: '#A8F5C7', border: 'rgba(113,255,188,0.45)' };
    case 'ON BOARD':
      return { bg: 'rgba(245,185,59,0.18)', text: '#FFE18A', border: 'rgba(255,214,92,0.55)' };
    case 'AVAILABLE':
      return { bg: 'rgba(245,185,59,0.18)', text: '#FFE18A', border: 'rgba(255,214,92,0.55)' };
    default:
      return { bg: 'rgba(255,255,255,0.12)', text: '#E5ECFF', border: 'rgba(255,255,255,0.18)' };
  }
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
      case 'completed': return { text: 'COMPLETED' };
      case 'active': return { text: 'ON BOARD' };
      default: return isBooked ? { text: 'BOOKED' } : { text: 'AVAILABLE' };
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
  const statusColors = getStatusColors(statusBadge.text);
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
          {/* HERO IMAGE with gradient overlay */}
          <View style={styles.uniImageWrap}>
            <Image
              source={{ uri: compactImageUri }}
              style={styles.uniImage}
              resizeMode="cover"
              onError={() => setCompactImageUri(DEFAULT_CRUISE_IMAGE)}
            />
            <LinearGradient
              colors={['rgba(6,14,30,0.1)', 'rgba(7,19,40,0.75)', 'rgba(10,26,52,0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* TOP ROW: status badge + nights */}
            <View style={styles.uniImageTopRow}>
              <View style={[styles.uniStatusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
                <Text style={[styles.uniStatusText, { color: statusColors.text }]}>{statusBadge.text}</Text>
              </View>
              <View style={styles.uniNightsBadge}>
                <Text style={styles.uniNightsBadgeText}>{String(cruise.nights)}N</Text>
              </View>
            </View>

            {/* BOTTOM: ship name + itinerary */}
            <View style={styles.uniImageBottom}>
              <View style={styles.uniShipRow}>
                <Ship size={13} color="rgba(255,255,255,0.7)" />
                <Text style={styles.uniShipName} numberOfLines={1}>{cruise.shipName}</Text>
              </View>
              <Text style={styles.uniItineraryText} numberOfLines={1}>{getItineraryName()}</Text>
            </View>
          </View>

          {/* BODY: dark glass */}
          <View style={styles.uniBody}>
            {/* Header chips row */}
            <View style={styles.uniChipsRow}>
              {(bookedCruise.offerCode || cruise.offerCode) ? (
                <View style={styles.uniCodeBadge}>
                  <Text style={styles.uniCodeText}>{'CODE: ' + (bookedCruise.offerCode || cruise.offerCode)}</Text>
                </View>
              ) : (
                <View style={styles.uniCasinoBadge}>
                  <Sparkles size={10} color="#FFE28F" />
                  <Text style={styles.uniCasinoBadgeText}>Casino Offer</Text>
                </View>
              )}
              {bookedCruise.bookingId ? (
                <View style={styles.uniBookingBadge}>
                  <Text style={styles.uniBookingText}>#{bookedCruise.bookingId}</Text>
                </View>
              ) : null}
            </View>

            {/* Route */}
            {(cruise.departurePort || cruise.destination) ? (
              <View style={styles.uniRouteSection}>
                <Text style={styles.uniRouteLabel}>ROUNDTRIP FROM</Text>
                <Text style={styles.uniRouteValue} numberOfLines={1}>
                  {cruise.departurePort || cruise.destination}
                </Text>
              </View>
            ) : null}

            {miniPorts.length > 0 ? (
              <View style={styles.uniPortsRow}>
                <MapPin size={11} color="rgba(158,253,242,0.7)" />
                <Text style={styles.uniPortsText} numberOfLines={2}>
                  {miniPorts.join(' · ')}
                </Text>
              </View>
            ) : null}

            {/* Stats grid */}
            <View style={styles.uniStatsGrid}>
              <View style={styles.uniStatTile}>
                <Calendar size={12} color="rgba(158,253,242,0.8)" />
                <Text style={styles.uniStatLabel}>SAIL DATE</Text>
                <Text style={styles.uniStatValue}>
                  {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
                </Text>
              </View>
              <View style={styles.uniStatTile}>
                <Users size={12} color="rgba(168,198,255,0.8)" />
                <Text style={styles.uniStatLabel}>GUESTS</Text>
                <Text style={styles.uniStatValue}>{String(guestCount)}</Text>
              </View>
              {bookedCruise.cabinType ? (
                <View style={styles.uniStatTile}>
                  <Star size={12} color="rgba(255,226,143,0.8)" />
                  <Text style={styles.uniStatLabel}>CABIN</Text>
                  <Text style={[styles.uniStatValue, { color: '#FFE28F' }]}>{bookedCruise.cabinType}</Text>
                </View>
              ) : null}
              {showRetailValue && retailValue !== null && retailValue > 0 ? (
                <View style={styles.uniStatTile}>
                  <Text style={styles.uniStatLabel}>VALUE</Text>
                  <Text style={[styles.uniStatValue, { color: '#A8F5C7' }]}>
                    {'$' + Math.round(retailValue).toLocaleString()}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* FP / OBC / NCC badges */}
            {hasFpObc ? (
              <View style={styles.uniFpObcRow}>
                {(bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined) ? (
                  <View style={styles.uniFpBadge}>
                    <Text style={styles.uniFpLabel}>FP$</Text>
                    <Text style={styles.uniFpValue}>{'$' + (bookedCruise.freePlay ?? cruise.freePlay ?? 0).toLocaleString()}</Text>
                  </View>
                ) : null}
                {(bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined) ? (
                  <View style={styles.uniObcBadge}>
                    <Text style={styles.uniObcLabel}>OBC</Text>
                    <Text style={styles.uniObcValue}>{'$' + (bookedCruise.freeOBC ?? cruise.freeOBC ?? 0).toLocaleString()}</Text>
                  </View>
                ) : null}
                {bookedCruise.usedNextCruiseCertificate ? (
                  <View style={styles.uniNccBadge}>
                    <Ticket size={10} color="#D8C0FF" />
                    <Text style={styles.uniNccLabel}>NCC</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Offer name */}
            {(bookedCruise.offerName || cruise.offerName) ? (
              <View style={styles.uniOfferRow}>
                <Sparkles size={11} color="#FFE28F" />
                <Text style={styles.uniOfferText} numberOfLines={1}>
                  {bookedCruise.offerName || cruise.offerName}
                </Text>
                {(cruise.offerValue != null && cruise.offerValue > 0) ? (
                  <View style={styles.uniOfferValueBadge}>
                    <Text style={styles.uniOfferValueText}>{'$' + cruise.offerValue.toLocaleString()}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Pricing row */}
            {hasPricing ? (
              <View style={styles.uniPricingRow}>
                {(cruise.interiorPrice != null && cruise.interiorPrice > 0) ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>Int</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.interiorPrice).toLocaleString()}</Text>
                  </View>
                ) : null}
                {(cruise.oceanviewPrice != null && cruise.oceanviewPrice > 0) ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>OV</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.oceanviewPrice).toLocaleString()}</Text>
                  </View>
                ) : null}
                {(cruise.balconyPrice != null && cruise.balconyPrice > 0) ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>Bal</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.balconyPrice).toLocaleString()}</Text>
                  </View>
                ) : null}
                {(cruise.suitePrice != null && cruise.suitePrice > 0) ? (
                  <View style={styles.uniPricingItem}>
                    <Text style={styles.uniPricingLabel}>Suite</Text>
                    <Text style={styles.uniPricingValue}>{'$' + Math.round(cruise.suitePrice).toLocaleString()}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Taxes */}
            {(bookedCruise.taxes ?? cruise.taxes ?? 0) > 0 ? (
              <View style={styles.uniTaxesRow}>
                <Text style={styles.uniTaxesLabel}>Port Taxes & Fees:</Text>
                <Text style={styles.uniTaxesValue}>{'$' + Math.round(bookedCruise.taxes ?? cruise.taxes ?? 0).toLocaleString()}</Text>
              </View>
            ) : null}

            {/* Booking enrichment */}
            {hasEnrichment ? (
              <View style={styles.uniEnrichmentSection}>
                {bookedCruise.bookingStatus ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>Status:</Text>
                    <View style={[
                      styles.uniEnrichmentBadge,
                      { backgroundColor: bookedCruise.bookingStatus === 'BK' ? 'rgba(39,210,137,0.18)' : 'rgba(245,185,59,0.18)' },
                    ]}>
                      <Text style={[
                        styles.uniEnrichmentBadgeText,
                        { color: bookedCruise.bookingStatus === 'BK' ? '#A8F5C7' : '#FFE18A' },
                      ]}>
                        {bookedCruise.bookingStatus === 'BK' ? 'Confirmed' : bookedCruise.bookingStatus === 'OF' ? 'Offer/Hold' : bookedCruise.bookingStatus}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {(bookedCruise.stateroomNumber && bookedCruise.stateroomNumber !== 'GTY') ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>Cabin #:</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.stateroomNumber}</Text>
                  </View>
                ) : null}
                {bookedCruise.stateroomCategoryCode ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>Category:</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.stateroomCategoryCode}</Text>
                  </View>
                ) : null}
                {bookedCruise.musterStation ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>Muster:</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.musterStation}</Text>
                  </View>
                ) : null}
                {bookedCruise.packageCode ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>Pkg Code:</Text>
                    <Text style={styles.uniEnrichmentValue}>{bookedCruise.packageCode}</Text>
                  </View>
                ) : null}
                {bookedCruise.passengerStatus ? (
                  <View style={styles.uniEnrichmentRow}>
                    <Text style={styles.uniEnrichmentLabel}>Pax Status:</Text>
                    <Text style={styles.uniEnrichmentValue}>
                      {bookedCruise.passengerStatus === 'AC' ? 'Active' : bookedCruise.passengerStatus}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* CTA Button */}
            <TouchableOpacity style={styles.uniActionButton} onPress={onPress} activeOpacity={0.85}>
              <Text style={styles.uniActionButtonText}>View Details</Text>
              <ChevronRight size={15} color="#9EFDF2" />
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
              <Calendar size={12} color="rgba(158,253,242,0.7)" />
              <Text style={styles.compactDate}>
                {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.3)" style={styles.compactChevron} />
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
        {/* Hero image */}
        <View style={styles.imageSection}>
          <Image
            source={{ uri: heroImageUri }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroImageUri(DEFAULT_CRUISE_IMAGE)}
          />
          <LinearGradient
            colors={['rgba(6,14,30,0.08)', 'rgba(7,19,40,0.72)', 'rgba(10,26,52,0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.imageTopRow}>
            {cruiseStatus === 'upcoming' && !isBooked ? (
              <View style={styles.saleBadge}>
                <Text style={styles.saleBadgeText}>Casino Offer</Text>
              </View>
            ) : (
              <View style={[styles.statusBadgeFull, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
                <Text style={[styles.statusBadgeFullText, { color: statusColors.text }]}>{statusBadge.text}</Text>
              </View>
            )}
            <View style={styles.nightsBadge}>
              <Text style={styles.nightsBadgeText}>{String(cruise.nights) + ' Nights'}</Text>
            </View>
          </View>
          <View style={styles.cruiseNameOverlay}>
            <Text style={styles.cruiseNameText}>{getItineraryName()}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentSection}>
          <View style={styles.headerRow}>
            <View style={styles.shipInfo}>
              <Ship size={15} color="rgba(158,253,242,0.8)" />
              <Text style={styles.shipName}>{cruise.shipName}</Text>
              <View style={[styles.inlineStatusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
                <Text style={[styles.inlineStatusBadgeText, { color: statusColors.text }]}>{statusBadge.text}</Text>
              </View>
            </View>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>ROUNDTRIP FROM:</Text>
            <Text style={styles.routeValue}>{cruise.departurePort || cruise.destination}</Text>
          </View>

          {(bookedCruise.itinerary && bookedCruise.itinerary.length > 0) ? (
            <View style={styles.visitingSection}>
              <Text style={styles.visitingLabel}>VISITING:</Text>
              <Text style={styles.visitingPorts}>
                {bookedCruise.itinerary.map((day: ItineraryDay) => day.port).join(' · ')}
              </Text>
            </View>
          ) : null}

          {(bookedCruise.ports && bookedCruise.ports.length > 0 && !bookedCruise.itinerary) ? (
            <View style={styles.visitingSection}>
              <Text style={styles.visitingLabel}>VISITING:</Text>
              <Text style={styles.visitingPorts}>{bookedCruise.ports.join(' · ')}</Text>
            </View>
          ) : null}

          <View style={styles.dateGuestRow}>
            <View style={styles.dateInfo}>
              <Calendar size={13} color="rgba(158,253,242,0.7)" />
              <Text style={styles.dateText}>{formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}</Text>
            </View>
            <View style={styles.guestInfo}>
              <Users size={13} color="rgba(168,198,255,0.7)" />
              <Text style={styles.guestText}>{String(bookedCruise.guestNames?.length || bookedCruise.guests || 2) + ' Guests'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {showRetailValue && retailValue !== null && retailValue > 0 ? (
            <View style={styles.priceActionRow}>
              <View style={styles.priceSection}>
                <Text style={styles.priceLabel}>RETAIL VALUE</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceDollar}>$</Text>
                  <Text style={styles.priceValue}>{Math.round(retailValue).toLocaleString()}</Text>
                </View>
                {bookedCruise.cabinType ? (
                  <Text style={styles.cabinType}>{bookedCruise.cabinType}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <TouchableOpacity style={styles.actionButton} onPress={onPress}>
            <Text style={styles.actionButtonText}>View Details</Text>
            <ChevronRight size={15} color="#9EFDF2" />
          </TouchableOpacity>

          {(bookedCruise.offerName || cruise.offerName || cruise.offerCode) ? (
            <View style={styles.offerSection}>
              <Sparkles size={13} color="#FFE28F" />
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
              {(bookedCruise.freePlay !== undefined || cruise.freePlay !== undefined) ? (
                <View style={styles.fpContainer}>
                  <Text style={styles.fpLabel}>FreePlay (FP$)</Text>
                  <Text style={styles.fpValue}>{'$' + (bookedCruise.freePlay ?? cruise.freePlay ?? 0).toLocaleString()}</Text>
                </View>
              ) : null}
              {(bookedCruise.freeOBC !== undefined || cruise.freeOBC !== undefined) ? (
                <View style={styles.obcContainer}>
                  <Text style={styles.obcLabel}>Onboard Credit</Text>
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
  // ─── MINI (offer-style dark glass card) ─────────────────────────────
  uniContainer: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  uniImageWrap: {
    height: 160,
    position: 'relative',
  },
  uniImage: {
    width: '100%',
    height: '100%',
  },
  uniImageTopRow: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uniStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  uniStatusText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  uniNightsBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  uniNightsBadgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  uniImageBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  uniShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  uniShipName: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    flex: 1,
  },
  uniItineraryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(232,240,255,0.85)',
    lineHeight: 18,
  },
  uniBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  uniChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  uniCodeBadge: {
    backgroundColor: 'rgba(30,58,95,0.8)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(151,176,255,0.3)',
  },
  uniCodeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#A6C6FF',
    letterSpacing: 0.4,
  },
  uniCasinoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,185,59,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,214,92,0.3)',
  },
  uniCasinoBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFE28F',
  },
  uniBookingBadge: {
    backgroundColor: 'rgba(39,210,137,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(113,255,188,0.3)',
  },
  uniBookingText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#A8F5C7',
  },
  uniRouteSection: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    backgroundColor: INNER_BG,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  uniRouteLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  uniRouteValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: TEXT_PRIMARY,
  },
  uniPortsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  uniPortsText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    flex: 1,
    lineHeight: 17,
  },
  uniStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uniStatTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: INNER_BG,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    gap: 3,
  },
  uniStatLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: TEXT_MUTED,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  uniStatValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: TEXT_PRIMARY,
    lineHeight: 18,
  },
  uniFpObcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap' as const,
  },
  uniFpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(39,210,137,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(113,255,188,0.3)',
  },
  uniFpLabel: { fontSize: 10, fontWeight: '700' as const, color: '#A8F5C7' },
  uniFpValue: { fontSize: 11, fontWeight: '800' as const, color: '#A8F5C7' },
  uniObcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,198,255,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(168,198,255,0.3)',
  },
  uniObcLabel: { fontSize: 10, fontWeight: '700' as const, color: '#A6C6FF' },
  uniObcValue: { fontSize: 11, fontWeight: '800' as const, color: '#A6C6FF' },
  uniNccBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(216,192,255,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(216,192,255,0.3)',
  },
  uniNccLabel: { fontSize: 10, fontWeight: '700' as const, color: '#D8C0FF' },
  uniOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,185,59,0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,92,0.25)',
    flexWrap: 'wrap' as const,
  },
  uniOfferText: {
    fontSize: 12,
    color: '#FFE28F',
    fontWeight: '600' as const,
    flex: 1,
  },
  uniOfferValueBadge: {
    backgroundColor: 'rgba(39,210,137,0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(113,255,188,0.3)',
  },
  uniOfferValueText: { fontSize: 11, fontWeight: '700' as const, color: '#A8F5C7' },
  uniPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: INNER_BORDER,
  },
  uniPricingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,198,255,0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(168,198,255,0.25)',
  },
  uniPricingLabel: { fontSize: 10, color: TEXT_MUTED, fontWeight: '700' as const },
  uniPricingValue: { fontSize: 11, color: '#A6C6FF', fontWeight: '700' as const },
  uniTaxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  uniTaxesLabel: { fontSize: 11, color: TEXT_MUTED, fontWeight: '500' as const },
  uniTaxesValue: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '700' as const },
  uniEnrichmentSection: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: INNER_BORDER,
  },
  uniEnrichmentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  uniEnrichmentLabel: { fontSize: 10, color: TEXT_MUTED, fontWeight: '500' as const },
  uniEnrichmentValue: { fontSize: 10, color: TEXT_SECONDARY, fontWeight: '600' as const },
  uniEnrichmentBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  uniEnrichmentBadgeText: { fontSize: 10, fontWeight: '700' as const },
  uniActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,58,95,0.7)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(151,176,255,0.25)',
    marginTop: SPACING.xs,
  },
  uniActionButtonText: { fontSize: 13, fontWeight: '700' as const, color: '#9EFDF2' },

  // ─── COMPACT ────────────────────────────────────────────────────────
  compactContainer: {
    backgroundColor: CARD_BG,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.sm,
  },
  compactImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
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
    color: TEXT_SECONDARY,
    marginBottom: 2,
  },
  compactDestination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactDate: { fontSize: TYPOGRAPHY.fontSizeXS, color: TEXT_SECONDARY },
  compactChevron: { marginRight: SPACING.sm },

  // ─── DEFAULT (full card) ────────────────────────────────────────────
  container: {
    backgroundColor: CARD_BG,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  imageSection: { height: 200, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  imageTopRow: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saleBadge: {
    backgroundColor: 'rgba(123,45,142,0.85)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(196,156,255,0.4)',
  },
  saleBadgeText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  statusBadgeFull: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeFullText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  nightsBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  nightsBadgeText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  cruiseNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  cruiseNameText: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.white },
  contentSection: { padding: SPACING.lg, gap: SPACING.sm },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shipInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  shipName: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: TYPOGRAPHY.fontWeightBold, color: TEXT_PRIMARY },
  inlineStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: SPACING.xs,
    borderWidth: 1,
  },
  inlineStatusBadgeText: { fontSize: 10, fontWeight: TYPOGRAPHY.fontWeightBold, letterSpacing: 0.4 },
  routeInfo: {
    backgroundColor: INNER_BG,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  routeLabel: { fontSize: 9, fontWeight: TYPOGRAPHY.fontWeightBold, color: TEXT_MUTED, letterSpacing: 0.8, marginBottom: 2 },
  routeValue: { fontSize: TYPOGRAPHY.fontSizeSM, color: TEXT_PRIMARY, fontWeight: '600' as const },
  visitingSection: {},
  visitingLabel: { fontSize: 9, fontWeight: TYPOGRAPHY.fontWeightBold, color: TEXT_MUTED, letterSpacing: 0.8, marginBottom: 2 },
  visitingPorts: { fontSize: TYPOGRAPHY.fontSizeSM, color: TEXT_SECONDARY, lineHeight: 20 },
  dateGuestRow: { flexDirection: 'row', gap: SPACING.lg },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: TYPOGRAPHY.fontSizeSM, color: TEXT_SECONDARY },
  guestInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guestText: { fontSize: TYPOGRAPHY.fontSizeSM, color: TEXT_SECONDARY },
  divider: { height: 1, backgroundColor: INNER_BORDER },
  priceActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  priceSection: { flex: 1 },
  priceLabel: { fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.8, marginBottom: 2, fontWeight: '700' as const },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  priceDollar: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A8F5C7', marginTop: 4 },
  priceValue: { fontSize: TYPOGRAPHY.fontSizeHero, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A8F5C7' },
  cabinType: { fontSize: TYPOGRAPHY.fontSizeXS, color: TEXT_MUTED, marginTop: 2 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,58,95,0.7)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(151,176,255,0.25)',
  },
  actionButtonText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#9EFDF2' },
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,185,59,0.12)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,92,0.25)',
    flexWrap: 'wrap' as const,
  },
  offerText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightMedium, color: '#FFE28F', flex: 1 },
  offerCodeBadge: {
    backgroundColor: 'rgba(168,198,255,0.15)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(168,198,255,0.3)',
  },
  offerCodeText: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A6C6FF' },
  fpObcSection: { flexDirection: 'row', gap: SPACING.sm },
  fpContainer: {
    flex: 1,
    backgroundColor: 'rgba(39,210,137,0.15)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(113,255,188,0.3)',
  },
  fpLabel: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A8F5C7', letterSpacing: 0.5, marginBottom: 2 },
  fpValue: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A8F5C7' },
  obcContainer: {
    flex: 1,
    backgroundColor: 'rgba(168,198,255,0.15)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(168,198,255,0.3)',
  },
  obcLabel: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A6C6FF', letterSpacing: 0.5, marginBottom: 2 },
  obcValue: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightBold, color: '#A6C6FF' },
});
