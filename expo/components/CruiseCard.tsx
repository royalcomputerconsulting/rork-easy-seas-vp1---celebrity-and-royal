import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, ChevronRight, Users, Ship, Heart, Sparkles, Anchor, Ticket } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { StableRemoteImage } from '@/components/ui/StableRemoteImage';
import { CasinoCardBackground } from '@/components/ui/CasinoCardBackground';

import { createDateFromString } from '@/lib/date';
import { DEFAULT_CRUISE_IMAGE, getImageForShip, getUniqueImageForCruise } from '@/constants/cruiseImages';
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

const WEB_SHADOW_FIX = Platform.select<ViewStyle>({
  web: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});

const MINI_CARD_BACKDROP_PALETTES = [
  ['rgba(191, 240, 255, 0.88)', 'rgba(219, 246, 255, 0.74)', 'rgba(240, 249, 255, 0.96)'],
  ['rgba(216, 236, 255, 0.92)', 'rgba(232, 242, 255, 0.78)', 'rgba(247, 250, 255, 0.96)'],
  ['rgba(196, 244, 235, 0.9)', 'rgba(225, 249, 244, 0.76)', 'rgba(244, 252, 250, 0.96)'],
  ['rgba(255, 229, 214, 0.88)', 'rgba(255, 241, 230, 0.76)', 'rgba(255, 248, 243, 0.96)'],
] as const;

function getDeterministicHash(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getMiniCardBackdropColors(seed: string): readonly [string, string, string] {
  return MINI_CARD_BACKDROP_PALETTES[getDeterministicHash(seed) % MINI_CARD_BACKDROP_PALETTES.length] ?? MINI_CARD_BACKDROP_PALETTES[0];
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
  
  const generatedCruiseImageUri = useMemo(() => {
    return getUniqueImageForCruise(
      cruise.id,
      cruise.destination || '',
      cruise.sailDate,
      cruise.shipName
    );
  }, [cruise.destination, cruise.id, cruise.sailDate, cruise.shipName]);

  const cardImageUri = useMemo(() => {
    const explicitImageUrl = cruise.imageUrl?.trim();
    if (explicitImageUrl) {
      return explicitImageUrl;
    }

    return generatedCruiseImageUri;
  }, [cruise.imageUrl, generatedCruiseImageUri]);

  const cardImageFallbackUri = useMemo(() => {
    const shipImageUri = cruise.shipName ? getImageForShip(cruise.shipName) : null;

    if (shipImageUri && shipImageUri !== cardImageUri) {
      return shipImageUri;
    }

    if (generatedCruiseImageUri && generatedCruiseImageUri !== cardImageUri) {
      return generatedCruiseImageUri;
    }

    return DEFAULT_CRUISE_IMAGE;
  }, [cardImageUri, cruise.shipName, generatedCruiseImageUri]);

  const miniBackdropColors = useMemo(() => {
    const seed = `${cruise.id}-${cruise.shipName ?? 'ship'}-${cruise.destination ?? 'destination'}-${variant}`;
    return getMiniCardBackdropColors(seed);
  }, [cruise.destination, cruise.id, cruise.shipName, variant]);

  const retailValue = useMemo(() => {
    if (!showRetailValue) return null;
    
    const guestCount = cruise.guests || 2;
    let cabinValueForTwo = 0;
    
    const bookedCruise = cruise as BookedCruise;
    if (bookedCruise.totalRetailCost && bookedCruise.pricePaid !== undefined) {
      cabinValueForTwo = bookedCruise.totalRetailCost * 2;
    } else {
      const cabinPrice = cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice || cruise.price || 0;
      cabinValueForTwo = cabinPrice * guestCount;
    }
    
    return cabinValueForTwo;
  }, [cruise, showRetailValue]);

  const itineraryPorts = useMemo((): string[] => {
    const itineraryStops = bookedCruise.itinerary?.map((day: ItineraryDay) => day.port).filter((port): port is string => Boolean(port && port.trim())) ?? [];

    if (itineraryStops.length > 0) {
      return itineraryStops;
    }

    return bookedCruise.ports?.filter((port): port is string => Boolean(port && port.trim())) ?? [];
  }, [bookedCruise.itinerary, bookedCruise.ports]);

  const guestCount = bookedCruise.guestNames?.length || bookedCruise.guests || 2;
  const visiblePorts = itineraryPorts.slice(0, 4);
  const offerCodeValue = bookedCruise.offerCode || cruise.offerCode;
  const freePlayAmount = bookedCruise.freePlay ?? cruise.freePlay ?? 0;
  const obcAmount = bookedCruise.freeOBC ?? cruise.freeOBC ?? 0;
  const shouldUseBookedBackgroundLayout = isBooked && !mini && !compact;
  const shouldShowBookedFooter =
    (showRetailValue && retailValue !== null && retailValue > 0) ||
    Boolean(bookedCruise.cabinType) ||
    Boolean(offerCodeValue) ||
    freePlayAmount > 0 ||
    obcAmount > 0 ||
    Boolean(bookedCruise.usedNextCruiseCertificate);

  const formatDateRange = (sailDate: string, returnDate?: string, nights?: number) => {
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
  };

  const getStatusBadge = () => {
    switch (cruiseStatus) {
      case 'completed':
        return { text: 'COMPLETED', bg: COLORS.money };
      case 'active':
        return { text: 'ON BOARD', bg: COLORS.points };
      default:
        return isBooked 
          ? { text: 'BOOKED', bg: COLORS.loyalty }
          : { text: 'AVAILABLE', bg: COLORS.gold };
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

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  }, [scaleAnim]);

  if (mini) {
    const miniPorts = bookedCruise.itinerary?.map((day: ItineraryDay) => day.port).filter(Boolean) || bookedCruise.ports || [];
    const guestCount = bookedCruise.guestNames?.length || bookedCruise.guests || 2;

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.miniPressable}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          testID="cruise-card-mini"
        >
          <View style={styles.miniContainer}>
            <View style={styles.miniSurfaceContent}>
              <CasinoCardBackground />
              <LinearGradient
                colors={[miniBackdropColors[0], 'rgba(255,255,255,0.04)', miniBackdropColors[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.miniThemeTint}
              />
              <View style={styles.miniContentRow}>
                <View style={styles.miniIconShell}>
                  <Ship size={24} color="#FEF3C7" />
                  <Text style={styles.miniIconText}>{cruise.nights}N</Text>
                </View>
                <View style={styles.miniContent}>
                  <View style={styles.miniTopRow}>
                    <View style={styles.miniShipRow}>
                      <Ship size={13} color={COLORS.textBlack} />
                      <Text style={styles.miniShipName} numberOfLines={1}>{cruise.shipName}</Text>
                    </View>
                    <View style={[styles.miniStatusBadge, { backgroundColor: statusBadge.bg }]}>
                      <Text
                        style={[
                          styles.miniStatusBadgeText,
                          statusBadge.bg === COLORS.goldAccent || statusBadge.bg === COLORS.aquaAccent
                            ? { color: COLORS.navyDeep }
                            : { color: COLORS.white },
                        ]}
                      >
                        {statusBadge.text}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.miniItinerary} numberOfLines={1}>{getItineraryName()}</Text>
                  <Text style={styles.miniDestination} numberOfLines={1}>
                    {cruise.departurePort ? `From ${cruise.departurePort}` : cruise.destination}
                  </Text>
                  {miniPorts.length > 0 && (
                    <Text style={styles.miniPorts} numberOfLines={2}>
                      {miniPorts.join(' • ')}
                    </Text>
                  )}
                  <View style={styles.miniBottomRow}>
                    <View style={styles.miniMetaRow}>
                      <View style={styles.miniMeta}>
                        <Calendar size={13} color={COLORS.textBlack} />
                        <Text style={styles.miniDate}>
                          {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
                        </Text>
                      </View>
                      <View style={styles.miniMeta}>
                        <Users size={13} color={COLORS.textBlack} />
                        <Text style={styles.miniDate}>{guestCount}G</Text>
                      </View>
                    </View>
                    <Text style={styles.miniNights}>{cruise.nights}N</Text>
                  </View>
                  <View style={styles.miniValueRow}>
                    {showRetailValue && retailValue !== null && retailValue > 0 && (
                      <Text style={styles.miniRetailValue}>${Math.round(retailValue).toLocaleString()}</Text>
                    )}
                    {!!bookedCruise.cabinType && (
                      <View style={styles.miniCabinRow}>
                        <Text style={styles.miniCabin}>{bookedCruise.cabinType}</Text>
                        {cruise.nights != null && cruise.nights > 0 && (
                          <Text style={styles.miniExpectedPoints}>• {cruise.nights * 2} pts</Text>
                        )}
                      </View>
                    )}
                    {!!(bookedCruise.offerCode || cruise.offerCode) && (
                      <View style={styles.miniOfferBadge}>
                        <Sparkles size={10} color={COLORS.goldDark} />
                        <Text style={styles.miniOfferCode}>{bookedCruise.offerCode || cruise.offerCode}</Text>
                      </View>
                    )}
                  </View>
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
                        {bookedCruise.usedNextCruiseCertificate && (
                          <View style={styles.miniNccBadge}>
                            <Ticket size={11} color="#7C3AED" />
                            <Text style={styles.miniNccLabel}>NCC</Text>
                          </View>
                        )}
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
                  {((bookedCruise.taxes ?? cruise.taxes ?? 0) > 0) && (
                    <View style={styles.miniTaxesRow}>
                      <Text style={styles.miniTaxesLabel}>Port Taxes & Fees:</Text>
                      <Text style={styles.miniTaxesValue}>${Math.round(bookedCruise.taxes ?? cruise.taxes ?? 0).toLocaleString()}</Text>
                    </View>
                  )}
                  {isBooked && !!(bookedCruise.musterStation || bookedCruise.bookingStatus || bookedCruise.packageCode || bookedCruise.stateroomNumber || bookedCruise.stateroomCategoryCode) && (
                    <View style={styles.miniEnrichmentSection}>
                      {!!bookedCruise.bookingStatus && (
                        <View style={styles.miniEnrichmentRow}>
                          <Text style={styles.miniEnrichmentLabel}>Status:</Text>
                          <View
                            style={[
                              styles.miniEnrichmentBadge,
                              { backgroundColor: bookedCruise.bookingStatus === 'BK' ? '#DCFCE7' : bookedCruise.bookingStatus === 'OF' ? '#FEF3C7' : '#E0E7FF' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniEnrichmentBadgeText,
                                { color: bookedCruise.bookingStatus === 'BK' ? '#15803D' : bookedCruise.bookingStatus === 'OF' ? '#92400E' : '#4338CA' },
                              ]}
                            >
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
                      {!!bookedCruise.stateroomType && (
                        <View style={styles.miniEnrichmentRow}>
                          <Text style={styles.miniEnrichmentLabel}>Type:</Text>
                          <Text style={styles.miniEnrichmentValue}>
                            {bookedCruise.stateroomType === 'B' ? 'Balcony' : bookedCruise.stateroomType === 'O' ? 'Ocean View' : bookedCruise.stateroomType === 'I' ? 'Interior' : bookedCruise.stateroomType === 'S' ? 'Suite' : bookedCruise.stateroomType}
                          </Text>
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
                <View style={styles.miniChevronWrap}>
                  <ChevronRight size={20} color={COLORS.textBlack} style={styles.miniChevron} />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          style={styles.compactShadowShell}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          testID="cruise-card-compact"
        >
          <View style={styles.compactContainer}>
            <StableRemoteImage
              uri={cardImageUri}
              fallbackUri={cardImageFallbackUri}
              style={styles.compactImage}
              recyclingKey={`${cruise.id}-compact-image`}
              testID="cruise-card-compact-image"
            />
            <View style={styles.compactContent}>
              <Text style={styles.compactShipName}>{cruise.shipName}</Text>
              <Text style={styles.compactDestination} numberOfLines={1}>{cruise.destination}</Text>
              <View style={styles.compactMeta}>
                <Calendar size={12} color={COLORS.textBlack} />
                <Text style={styles.compactDate}>
                  {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={COLORS.textBlack} style={styles.compactChevron} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (shouldUseBookedBackgroundLayout) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.shadowShell}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          testID="cruise-card-booked"
        >
          <View style={styles.bookedContainer}>
            <CasinoCardBackground />
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.bookedThemeScrim}
            />
            <View style={styles.bookedContentSection}>
              <View style={styles.bookedHeaderRow}>
                <View style={styles.bookedTitleGroup}>
                  <View style={styles.bookedShipRow}>
                    <Ship size={15} color={COLORS.navyDeep} />
                    <Text style={styles.bookedShipName} numberOfLines={1}>{cruise.shipName}</Text>
                  </View>
                  <Text style={styles.bookedItinerary} numberOfLines={2}>{getItineraryName()}</Text>
                </View>
                <View style={[styles.bookedStatusBadge, { backgroundColor: statusBadge.bg }]}>
                  <Text style={styles.bookedStatusBadgeText}>{statusBadge.text}</Text>
                </View>
              </View>

              <View style={styles.bookedMetaGrid}>
                <View style={styles.bookedMetaChip}>
                  <Calendar size={14} color={COLORS.navyDeep} />
                  <Text style={styles.bookedMetaText}>{formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}</Text>
                </View>
                <View style={styles.bookedMetaChip}>
                  <Users size={14} color={COLORS.navyDeep} />
                  <Text style={styles.bookedMetaText}>{guestCount} Guests</Text>
                </View>
                <View style={styles.bookedMetaChip}>
                  <Anchor size={14} color={COLORS.navyDeep} />
                  <Text style={styles.bookedMetaText}>{cruise.nights} Nights</Text>
                </View>
              </View>

              <View style={styles.bookedRouteCard}>
                <Text style={styles.bookedRouteLabel}>Roundtrip from</Text>
                <Text style={styles.bookedRouteValue}>{cruise.departurePort || cruise.destination || 'Cruise itinerary'}</Text>
                {visiblePorts.length > 0 && (
                  <View style={styles.bookedPortsRow}>
                    {visiblePorts.map((port: string, index: number) => (
                      <View key={`${cruise.id}-${port}-${index}`} style={styles.bookedPortChip}>
                        <Text style={styles.bookedPortChipText}>{port}</Text>
                      </View>
                    ))}
                    {itineraryPorts.length > visiblePorts.length && (
                      <View style={styles.bookedPortChip}>
                        <Text style={styles.bookedPortChipText}>+{itineraryPorts.length - visiblePorts.length} more</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {shouldShowBookedFooter && (
                <View style={styles.bookedFooterRow}>
                  <View style={styles.bookedValueBlock}>
                    {showRetailValue && retailValue !== null && retailValue > 0 ? (
                      <>
                        <Text style={styles.bookedValueLabel}>Retail value</Text>
                        <Text style={styles.bookedValueText}>${Math.round(retailValue).toLocaleString()}</Text>
                      </>
                    ) : null}
                    {!!bookedCruise.cabinType && (
                      <Text style={styles.bookedSubValueText}>{bookedCruise.cabinType}</Text>
                    )}
                  </View>
                  <View style={styles.bookedBenefitsRow}>
                    {!!offerCodeValue && (
                      <View style={styles.bookedBenefitBadge}>
                        <Sparkles size={12} color={COLORS.goldDark} />
                        <Text style={styles.bookedBenefitText}>{offerCodeValue}</Text>
                      </View>
                    )}
                    {freePlayAmount > 0 && (
                      <View style={styles.bookedBenefitBadge}>
                        <Text style={styles.bookedBenefitText}>FP ${freePlayAmount.toLocaleString()}</Text>
                      </View>
                    )}
                    {obcAmount > 0 && (
                      <View style={styles.bookedBenefitBadge}>
                        <Text style={styles.bookedBenefitText}>OBC ${obcAmount.toLocaleString()}</Text>
                      </View>
                    )}
                    {bookedCruise.usedNextCruiseCertificate && (
                      <View style={styles.bookedBenefitBadge}>
                        <Ticket size={12} color="#7C3AED" />
                        <Text style={styles.bookedBenefitText}>NCC</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        style={styles.shadowShell}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID="cruise-card"
      >
        <View style={styles.container}>
          <CasinoCardBackground />
          <View style={styles.cruiseHeroPanel}>
            <View style={styles.cruiseHeroTopRow}>
              {cruiseStatus === 'upcoming' && !isBooked ? (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleBadgeText}>Casino Offer</Text>
                </View>
              ) : <View />}
              <View style={styles.nightsBadge}>
                <Text style={styles.nightsBadgeText}>{cruise.nights} Nights</Text>
              </View>
            </View>
            <View style={styles.cruiseNameOverlay}>
              <Text style={styles.cruiseNameText}>{getItineraryName()}</Text>
              <Text style={styles.cruiseHeroRoute}>{cruise.departurePort || cruise.destination || 'Cruise itinerary'}</Text>
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
                    statusBadge.bg === COLORS.goldAccent || statusBadge.bg === COLORS.aquaAccent 
                      ? { color: COLORS.navyDeep } 
                      : { color: COLORS.white }
                  ]}>
                    {statusBadge.text}
                  </Text>
                </View>
              </View>
              <View style={styles.actionIcons}>
                <TouchableOpacity style={styles.iconButton}>
                  <Heart size={18} color={COLORS.textBlack} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>ROUNDTRIP FROM:</Text>
              <Text style={styles.routeValue}>{cruise.departurePort || cruise.destination}</Text>
            </View>

            {bookedCruise.itinerary && bookedCruise.itinerary.length > 0 && (
              <View style={styles.visitingSection}>
                <Text style={styles.visitingLabel}>VISITING:</Text>
                <Text style={styles.visitingPorts}>
                  {bookedCruise.itinerary.map((day: ItineraryDay) => day.port).join(' • ')}
                </Text>
                <TouchableOpacity>
                  <Text style={styles.viewPortsLink}>+ View Ports & Map</Text>
                </TouchableOpacity>
              </View>
            )}

            {bookedCruise.ports && bookedCruise.ports.length > 0 && !bookedCruise.itinerary && (
              <View style={styles.visitingSection}>
                <Text style={styles.visitingLabel}>VISITING:</Text>
                <Text style={styles.visitingPorts}>
                  {bookedCruise.ports.join(' • ')}
                </Text>
              </View>
            )}

            <View style={styles.dateGuestRow}>
              <View style={styles.dateInfo}>
                <Calendar size={14} color={COLORS.textBlack} />
                <Text style={styles.dateText}>
                  {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
                </Text>
              </View>
              <View style={styles.guestInfo}>
                <Users size={14} color={COLORS.textBlack} />
                <Text style={styles.guestText}>
                  {bookedCruise.guestNames?.length || bookedCruise.guests || 2} Guests
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
                {(bookedCruise.cabinType) && (
                  <Text style={styles.cabinType}>{bookedCruise.cabinType}</Text>
                )}
              </View>
            </View>

            <View style={styles.compactActionRow}>
              <TouchableOpacity style={styles.compactPrimaryButton} onPress={onPress}>
                <Text style={styles.compactPrimaryButtonText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compactSecondaryButton}>
                <Text style={styles.compactSecondaryButtonText}>Itinerary</Text>
              </TouchableOpacity>
            </View>

            {!!(bookedCruise.offerName || cruise.offerName || cruise.offerCode) && (
              <View style={styles.offerSection}>
                <Sparkles size={14} color={COLORS.goldDark} />
                <Text style={styles.offerText}>
                  {bookedCruise.offerName || cruise.offerName || `Offer ${cruise.offerCode}`}
                </Text>
                {!!(bookedCruise.offerCode || cruise.offerCode) && (
                  <View style={styles.offerCodeBadge}>
                    <Anchor size={10} color={COLORS.loyalty} />
                    <Text style={styles.offerCodeText}>{bookedCruise.offerCode || cruise.offerCode}</Text>
                  </View>
                )}
                {!!(cruise.offerValue && cruise.offerValue > 0) && (
                  <View style={styles.offerValueBadge}>
                    <Text style={styles.offerValueText}>${cruise.offerValue.toLocaleString()}</Text>
                  </View>
                )}
              </View>
            )}

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
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

);

const styles = StyleSheet.create({
  shadowShell: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.md,
    ...(WEB_SHADOW_FIX ?? {}),
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  miniPressable: {
    marginBottom: SPACING.sm,
  },
  miniContainer: {
    borderRadius: 22,
    minHeight: 134,
    overflow: 'hidden',
    backgroundColor: 'rgba(248,251,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(208,221,236,0.88)',
    shadowColor: '#03111F',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    ...(WEB_SHADOW_FIX ?? {}),
  },
  miniSurfaceContent: {
    position: 'relative',
  },
  miniBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,248,255,0.78)',
  },
  miniThemeTint: {
    ...StyleSheet.absoluteFillObject,
  },
  miniBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  miniContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    paddingRight: SPACING.xs,
    gap: 10,
  },
  miniImageShell: {
    width: 96,
    height: 114,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  miniIconShell: {
    width: 96,
    height: 114,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  miniIconText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FEF3C7',
  },
  miniImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(244,248,255,0.78)',
  },
  miniImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  miniContent: {
    flex: 1,
    paddingVertical: 2,
    paddingRight: SPACING.xs,
  },
  miniTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  miniShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  miniShipName: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textBlack,
    flex: 1,
    marginRight: 4,
  },
  miniItinerary: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
    marginBottom: 2,
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  miniStatusBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.3,
  },
  miniDestination: {
    fontSize: 13,
    color: COLORS.textBlack,
    marginBottom: 2,
  },
  miniPorts: {
    fontSize: 11,
    color: COLORS.textBlack,
    marginBottom: 4,
    lineHeight: 15,
  },
  miniBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  miniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  miniMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniDate: {
    fontSize: 12,
    color: COLORS.textBlack,
  },
  miniNights: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
    backgroundColor: 'rgba(255,255,255,0.68)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  miniValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniRetailValue: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniCabinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  miniCabin: {
    fontSize: 10,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniExpectedPoints: {
    fontSize: 10,
    color: '#047857',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,250,235,0.86)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  miniOfferCode: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniChevronWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  miniChevron: {
    marginLeft: 0,
  },
  miniPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,39,66,0.12)',
  },
  miniPricingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.68)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  miniPricingLabel: {
    fontSize: 10,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniPricingValue: {
    fontSize: 10,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniTaxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  miniTaxesLabel: {
    fontSize: 10,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  miniTaxesValue: {
    fontSize: 10,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniFpObcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  miniFpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(220,252,231,0.86)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  miniFpLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniFpValue: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniObcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(219,234,254,0.86)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  miniObcLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniObcValue: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniNccBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(243,232,255,0.88)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  miniNccLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniNccValue: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  miniEnrichmentSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,39,66,0.12)',
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
    fontSize: 9,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  miniEnrichmentValue: {
    fontSize: 9,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniEnrichmentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
  },
  miniEnrichmentBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  bookedContainer: {
    minHeight: 248,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#F7FBFF',
    borderWidth: 1,
    borderColor: 'rgba(203,220,235,0.9)',
  },
  bookedMarbleBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
  },
  bookedMarbleGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  bookedMarbleVeinPrimary: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 244,
    height: 170,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(213,213,218,0.7)',
    transform: [{ rotate: '16deg' }],
  },
  bookedMarbleVeinSecondary: {
    position: 'absolute',
    top: 92,
    left: -42,
    width: 214,
    height: 110,
    borderRadius: 80,
    backgroundColor: 'rgba(236,236,239,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(205,205,211,0.66)',
    transform: [{ rotate: '-18deg' }],
  },
  bookedMarbleVeinTertiary: {
    position: 'absolute',
    bottom: -42,
    right: 32,
    width: 188,
    height: 132,
    borderRadius: 94,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(222,222,227,0.74)',
    transform: [{ rotate: '-10deg' }],
  },
  bookedMarbleVeinFine: {
    position: 'absolute',
    top: 134,
    right: -22,
    width: 176,
    height: 32,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(214,214,219,0.68)',
    transform: [{ rotate: '14deg' }],
  },
  bookedBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bookedBackgroundShade: {
    ...StyleSheet.absoluteFillObject,
  },
  bookedThemeScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  bookedContentSection: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  bookedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  bookedTitleGroup: {
    flex: 1,
    gap: 6,
  },
  bookedShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookedShipName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  bookedItinerary: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  bookedStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  bookedStatusBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
    color: COLORS.white,
  },
  bookedMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bookedMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  bookedMetaText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  bookedRouteCard: {
    gap: 8,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  bookedRouteLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#38506B',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  bookedRouteValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textBlack,
  },
  bookedPortsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bookedPortChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(226,236,247,0.92)',
  },
  bookedPortChipText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  bookedFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  bookedValueBlock: {
    flex: 1,
  },
  bookedValueLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#38506B',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bookedValueText: {
    fontSize: 30,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  bookedSubValueText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#38506B',
    marginTop: 4,
  },
  bookedBenefitsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  bookedBenefitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  bookedBenefitText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  compactShadowShell: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
    ...(WEB_SHADOW_FIX ?? {}),
  },
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactImage: {
    backgroundColor: 'rgba(244,248,255,0.78)',
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
    color: COLORS.textBlack,
    marginBottom: 2,
  },
  compactDestination: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textBlack,
    marginBottom: 4,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textBlack,
  },
  compactChevron: {
    marginRight: SPACING.sm,
  },
  cruiseHeroPanel: {
    minHeight: 128,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  cruiseHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  cruiseHeroRoute: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.88)',
  },
  imageSection: {
    height: 200,
    position: 'relative',
  },
  heroImage: {
    backgroundColor: 'rgba(244,248,255,0.78)',
    width: '100%',
    height: '100%',
  },
  saleBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: COLORS.loyalty,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  saleBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  nightsBadge: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.md,
    backgroundColor: 'rgba(0, 31, 63, 0.85)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  nightsBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  cruiseNameOverlay: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(0, 24, 48, 0.26)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  cruiseNameText: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  contentSection: {
    padding: SPACING.lg,
    backgroundColor: 'rgba(255,255,255,0.88)',
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
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
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
    color: COLORS.textBlack,
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
    color: COLORS.textBlack,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textBlack,
  },
  visitingSection: {
    marginBottom: SPACING.sm,
  },
  visitingLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  visitingPorts: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textBlack,
    lineHeight: 20,
  },
  viewPortsLink: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textBlack,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginTop: 4,
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
    color: COLORS.textBlack,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guestText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textBlack,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
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
    color: COLORS.textBlack,
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
    color: COLORS.textBlack,
    marginTop: 4,
  },
  priceValue: {
    fontSize: TYPOGRAPHY.fontSizeHero,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  cabinType: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textBlack,
    marginTop: 2,
  },
  compactActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  compactPrimaryButton: {
    flex: 1,
    backgroundColor: COLORS.textNavy,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  compactPrimaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  compactSecondaryButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.navyDeep,
  },
  compactSecondaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textBlack,
  },
  inlineStatusBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginLeft: SPACING.xs,
  },
  inlineStatusBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.3,
  },
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
  offerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textBlack,
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
    color: COLORS.textBlack,
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
    color: COLORS.textBlack,
  },
  fpObcSection: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fpContainer: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  fpLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fpValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
  obcContainer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  obcLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  obcValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textBlack,
  },
});
