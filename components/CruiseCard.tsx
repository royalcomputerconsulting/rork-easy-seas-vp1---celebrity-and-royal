import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, Users, Ship, Heart, Sparkles, Anchor, Ticket } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

import { createDateFromString } from '@/lib/date';
import { calculateCruiseValue } from '@/lib/valueCalculator';
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
  showPricePerNight = true, 
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

  useEffect(() => {
    setHeroImageUri(shipImageUrl || DEFAULT_CRUISE_IMAGE);
  }, [shipImageUrl]);

  useEffect(() => {
    setCompactImageUri(destinationImage || DEFAULT_CRUISE_IMAGE);
  }, [destinationImage]);

  const retailValue = useMemo(() => {
    if (!showRetailValue) return null;
    
    const cabinType = cruise.cabinType || 'Balcony';
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
        style={styles.miniContainer}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID="cruise-card-mini"
      >
        <Image 
          source={{ uri: compactImageUri }} 
          style={styles.miniImage}
          resizeMode="cover"
          onError={() => {
            console.log('Mini image load error, using default');
            setCompactImageUri(DEFAULT_CRUISE_IMAGE);
          }}
        />
        <View style={styles.miniContent}>
          <View style={styles.miniTopRow}>
            <View style={styles.miniShipRow}>
              <Ship size={13} color={COLORS.navyDeep} />
              <Text style={styles.miniShipName} numberOfLines={1}>{cruise.shipName}</Text>
            </View>
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
          </View>
          <Text style={styles.miniItinerary} numberOfLines={1}>{getItineraryName()}</Text>
          <Text style={styles.miniDestination} numberOfLines={1}>
            {cruise.departurePort ? `From ${cruise.departurePort}` : cruise.destination}
          </Text>
          {miniPorts.length > 0 && (
            <Text style={styles.miniPorts}>
              {miniPorts.join(' • ')}
            </Text>
          )}
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
                <Text style={styles.miniDate}>{guestCount}G</Text>
              </View>
            </View>
            <Text style={styles.miniNights}>{cruise.nights}N</Text>
          </View>
          <View style={styles.miniValueRow}>
            {showRetailValue && retailValue !== null && retailValue > 0 && (
              <Text style={styles.miniRetailValue}>${Math.round(retailValue).toLocaleString()}</Text>
            )}
            {bookedCruise.cabinType && (
              <View style={styles.miniCabinRow}>
                <Text style={styles.miniCabin}>{bookedCruise.cabinType}</Text>
                {cruise.nights != null && cruise.nights > 0 && (
                  <Text style={styles.miniExpectedPoints}>• {cruise.nights * 2} pts</Text>
                )}
              </View>
            )}
            {(bookedCruise.offerCode || cruise.offerCode) && (
              <View style={styles.miniOfferBadge}>
                <Sparkles size={10} color={COLORS.goldDark} />
                <Text style={styles.miniOfferCode}>{bookedCruise.offerCode || cruise.offerCode}</Text>
              </View>
            )}
          </View>
          {(isBooked || bookedCruise.offerCode || cruise.offerCode) && (
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
          {((cruise.interiorPrice && cruise.interiorPrice > 0) || (cruise.oceanviewPrice && cruise.oceanviewPrice > 0) || (cruise.balconyPrice && cruise.balconyPrice > 0) || (cruise.suitePrice && cruise.suitePrice > 0)) && (
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
          {/* Booking Enrichment Data from Sync */}
          {isBooked && (bookedCruise.musterStation || bookedCruise.bookingStatus || bookedCruise.packageCode || bookedCruise.stateroomNumber || bookedCruise.stateroomCategoryCode) && (
            <View style={styles.miniEnrichmentSection}>
              {bookedCruise.bookingStatus && (
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
              {bookedCruise.stateroomNumber && bookedCruise.stateroomNumber !== 'GTY' && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Cabin #:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.stateroomNumber}</Text>
                </View>
              )}
              {bookedCruise.stateroomCategoryCode && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Category:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.stateroomCategoryCode}</Text>
                </View>
              )}
              {bookedCruise.stateroomType && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Type:</Text>
                  <Text style={styles.miniEnrichmentValue}>
                    {bookedCruise.stateroomType === 'B' ? 'Balcony' : bookedCruise.stateroomType === 'O' ? 'Ocean View' : bookedCruise.stateroomType === 'I' ? 'Interior' : bookedCruise.stateroomType === 'S' ? 'Suite' : bookedCruise.stateroomType}
                  </Text>
                </View>
              )}
              {bookedCruise.musterStation && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Muster:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.musterStation}</Text>
                </View>
              )}
              {bookedCruise.packageCode && (
                <View style={styles.miniEnrichmentRow}>
                  <Text style={styles.miniEnrichmentLabel}>Offer Code:</Text>
                  <Text style={styles.miniEnrichmentValue}>{bookedCruise.packageCode}</Text>
                </View>
              )}
              {bookedCruise.passengerStatus && (
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
        <ChevronRight size={20} color={COLORS.navyDeep} style={styles.miniChevron} />
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
          onError={() => {
            console.log('Compact image load error, using default');
            setCompactImageUri(DEFAULT_CRUISE_IMAGE);
          }}
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
          onError={() => {
            console.log('Hero image load error, using default');
            setHeroImageUri(DEFAULT_CRUISE_IMAGE);
          }}
        />
        
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
              <Heart size={18} color="#9CA3AF" />
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
            <Calendar size={14} color="#6B7280" />
            <Text style={styles.dateText}>
              {formatDateRange(cruise.sailDate, cruise.returnDate, cruise.nights)}
            </Text>
          </View>
          <View style={styles.guestInfo}>
            <Users size={14} color="#6B7280" />
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

        {(bookedCruise.offerName || cruise.offerName || cruise.offerCode) && (
          <View style={styles.offerSection}>
            <Sparkles size={14} color={COLORS.goldDark} />
            <Text style={styles.offerText}>
              {bookedCruise.offerName || cruise.offerName || `Offer ${cruise.offerCode}`}
            </Text>
            {(bookedCruise.offerCode || cruise.offerCode) && (
              <View style={styles.offerCodeBadge}>
                <Anchor size={10} color={COLORS.loyalty} />
                <Text style={styles.offerCodeText}>{bookedCruise.offerCode || cruise.offerCode}</Text>
              </View>
            )}
            {(cruise.offerValue && cruise.offerValue > 0) && (
              <View style={styles.offerValueBadge}>
                <Text style={styles.offerValueText}>${cruise.offerValue.toLocaleString()}</Text>
              </View>
            )}
          </View>
        )}

        {(isBooked || bookedCruise.offerCode || cruise.offerCode) && (
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
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  miniContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.sm,
    ...SHADOW.sm,
  },
  miniImage: {
    width: 91,
    height: 110,
    borderRadius: BORDER_RADIUS.sm,
    margin: SPACING.sm,
  },
  miniContent: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
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
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    flex: 1,
    marginRight: 4,
  },
  miniItinerary: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    marginBottom: 2,
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStatusBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.3,
  },
  miniDestination: {
    fontSize: 13,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  miniPorts: {
    fontSize: 11,
    color: '#4B5563',
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
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    color: '#000000',
  },
  miniCabinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  miniCabin: {
    fontSize: 10,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniExpectedPoints: {
    fontSize: 10,
    color: '#059669',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  miniOfferCode: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  miniChevron: {
    marginLeft: 2,
  },
  miniPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    fontSize: 10,
    color: '#0369A1',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  miniPricingValue: {
    fontSize: 10,
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
    fontSize: 10,
    color: '#6B7280',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  miniTaxesValue: {
    fontSize: 10,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
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
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  miniFpValue: {
    fontSize: 10,
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
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  miniObcValue: {
    fontSize: 10,
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
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#7C3AED',
  },
  miniNccValue: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#7C3AED',
  },
  miniEnrichmentSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    color: '#6B7280',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  miniEnrichmentValue: {
    fontSize: 9,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  miniEnrichmentBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  miniEnrichmentBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
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
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
  },
  compactChevron: {
    marginRight: SPACING.sm,
  },
  imageSection: {
    height: 200,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 31, 63, 0.75)',
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
    color: '#6B7280',
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
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1F2937',
  },
  visitingSection: {
    marginBottom: SPACING.sm,
  },
  visitingLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  visitingPorts: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1F2937',
    lineHeight: 20,
  },
  viewPortsLink: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.points,
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
    color: '#6B7280',
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guestText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
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
    color: '#6B7280',
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
    fontSize: TYPOGRAPHY.fontSizeHero,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  cabinType: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
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
    color: COLORS.navyDeep,
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
    color: '#059669',
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
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fpValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
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
    color: '#1E40AF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  obcValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
});
