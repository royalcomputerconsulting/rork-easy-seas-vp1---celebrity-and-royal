import React, { memo, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ItineraryDay, BookedCruise, CasinoOffer } from '@/types/models';
import { Ship, Calendar, MapPin, Clock, DollarSign, Gift, Star, Users, Anchor, Tag, ArrowLeft, Edit3, X, Save, TrendingUp, Dice5, AlertCircle, Target, Trash2, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatCurrency, formatNights } from '@/lib/format';
import { formatDate, getDaysUntil, createDateFromString } from '@/lib/date';
import { useAppState } from '@/state/AppStateProvider';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';

import { getCasinoStatusBadge, calculatePersonalizedPlayEstimate, PersonalizedPlayEstimate, PlayingHoursConfig } from '@/lib/casinoAvailability';
import { getUniqueImageForCruise, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';

type CompactFactProps = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  value: string;
  label?: string;
};

const CompactFact = memo(function CompactFact({ icon: Icon, value, label }: CompactFactProps) {
  return (
    <View style={styles.compactFact}>
      <Icon size={12} color={COLORS.textSecondary} />
      <Text style={styles.compactFactValue} numberOfLines={1}>{value}</Text>
      {label && <Text style={styles.compactFactLabel}>{label}</Text>}
    </View>
  );
});

interface EditFormData {
  shipName: string;
  departurePort: string;
  destination: string;
  nights: string;
  sailDate: string;
  cabinType: string;
  guests: string;
  interiorPrice: string;
  oceanviewPrice: string;
  balconyPrice: string;
  suitePrice: string;
  taxes: string;
  bwoNumber: string;
  freeOBC: string;
  freePlay: string;
  freeGratuities: boolean;
  freeDrinkPackage: boolean;
  freeWifi: boolean;
  freeSpecialtyDining: boolean;
  winnings: string;
  earnedPoints: string;
  amountPaid: string;
  tradeInValue: string;
  nextCruiseCertificate: string;
}

export default function CruiseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { localData } = useAppState();
  const { getCruiseValueBreakdown, getCruiseCasinoAvailability, completedCruises } = useSimpleAnalytics();

  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [fullEditModalVisible, setFullEditModalVisible] = useState<boolean>(false);
  const [editWinnings, setEditWinnings] = useState<string>('');
  const [editPoints, setEditPoints] = useState<string>('');
  const [editForm, setEditForm] = useState<EditFormData>({
    shipName: '',
    departurePort: '',
    destination: '',
    nights: '',
    sailDate: '',
    cabinType: '',
    guests: '',
    interiorPrice: '',
    oceanviewPrice: '',
    balconyPrice: '',
    suitePrice: '',
    taxes: '',
    bwoNumber: '',
    freeOBC: '',
    freePlay: '',
    freeGratuities: false,
    freeDrinkPackage: false,
    freeWifi: false,
    freeSpecialtyDining: false,
    winnings: '',
    earnedPoints: '',
    amountPaid: '',
    tradeInValue: '',
    nextCruiseCertificate: '',
  });

  const { bookedCruises: storeBookedCruises, cruises: storeCruises, casinoOffers: storeOffers, updateBookedCruise: updateCruiseInStore, removeBookedCruise, addBookedCruise } = useCruiseStore();
  const { currentUser } = useUser();
  
  const [heroImageUri, setHeroImageUri] = useState<string>(DEFAULT_CRUISE_IMAGE);
  const [unbookModalVisible, setUnbookModalVisible] = useState<boolean>(false);
  
  const playingHoursConfig: PlayingHoursConfig = useMemo(() => {
    const userPlayingHours = currentUser?.playingHours || DEFAULT_PLAYING_HOURS;
    return {
      enabled: userPlayingHours.enabled,
      sessions: userPlayingHours.sessions,
    };
  }, [currentUser?.playingHours]);

  const updateCruise = (updatedCruise: any) => {
    console.log('[CruiseDetails] Updating cruise:', updatedCruise);
    console.log('[CruiseDetails] Updated points:', updatedCruise.earnedPoints);
    console.log('[CruiseDetails] Updated winnings:', updatedCruise.winnings);
    
    // Update in CruiseStore - this is the single source of truth
    // CruiseStore updates CoreDataProvider, which LoyaltyProvider reads from
    updateCruiseInStore(updatedCruise.id, updatedCruise);
    
    console.log('[CruiseDetails] Cruise updated in store. LoyaltyProvider will recalculate automatically.');
  };

  const cruise = useMemo(() => {
    // Priority: CruiseStore data > localData
    // CruiseStore has enriched itinerary data from enrichCruisesWithMockItineraries
    const allCruises = [
      ...(storeCruises || []),
      ...(storeBookedCruises || []),
      ...(localData.cruises || []),
      ...(localData.booked || []),
    ];
    
    let found = allCruises.find(c => c.id === id);
    
    // Enrich pricing from linked offer if cruise has missing prices
    if (found && found.offerCode) {
      const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
      const linkedOff = allOffers.find(o => 
        o.offerCode === found!.offerCode || 
        o.id === found!.offerCode ||
        o.cruiseId === found!.id
      );
      
      if (linkedOff) {
        const needsPricing = !found.interiorPrice && !found.oceanviewPrice && !found.balconyPrice && !found.suitePrice;
        if (needsPricing) {
          console.log('[CruiseDetails] Enriching cruise pricing from linked offer:', linkedOff.offerCode);
          found = {
            ...found,
            interiorPrice: found.interiorPrice || linkedOff.interiorPrice,
            oceanviewPrice: found.oceanviewPrice || linkedOff.oceanviewPrice,
            balconyPrice: found.balconyPrice || linkedOff.balconyPrice,
            suitePrice: found.suitePrice || linkedOff.suitePrice,
            taxes: found.taxes || linkedOff.taxesFees,
            portsAndTimes: found.portsAndTimes || linkedOff.portsAndTimes,
            ports: found.ports || linkedOff.ports,
          };
        }
      }
    }
    
    console.log('[CruiseDetails] Found cruise:', found?.id, 'itinerary days:', found?.itinerary?.length, 'prices:', {
      interior: found?.interiorPrice,
      oceanview: found?.oceanviewPrice,
      balcony: found?.balconyPrice,
      suite: found?.suitePrice,
      taxes: found?.taxes,
    });
    return found;
  }, [storeCruises, storeBookedCruises, storeOffers, localData.cruises, localData.booked, localData.offers, id]);

  useEffect(() => {
    if (cruise) {
      const imageUrl = getUniqueImageForCruise(
        cruise.id,
        cruise.destination || cruise.itineraryName || '',
        cruise.sailDate,
        cruise.shipName
      );
      setHeroImageUri(imageUrl || DEFAULT_CRUISE_IMAGE);
    }
  }, [cruise]);

  const linkedOffer = useMemo((): CasinoOffer | undefined => {
    if (!cruise?.offerCode) return undefined;
    
    // Check CruiseStore offers first (primary), then localData offers (fallback)
    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
    
    return allOffers.find(o => 
      o.offerCode === cruise.offerCode || 
      o.id === cruise.offerCode ||
      o.cruiseId === cruise.id
    );
  }, [cruise, storeOffers, localData.offers]);

  // Calculate accurate nights from sailDate and returnDate
  const accurateNights = useMemo(() => {
    if (!cruise) return 0;
    
    if (cruise.sailDate && (cruise as BookedCruise).returnDate) {
      try {
        const sailDateObj = createDateFromString(cruise.sailDate);
        const returnDateObj = createDateFromString((cruise as BookedCruise).returnDate);
        const daysBetween = Math.round((returnDateObj.getTime() - sailDateObj.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysBetween > 0 && daysBetween < 365) {
          console.log('[CruiseDetails] Calculated accurate nights from dates:', daysBetween, 'sailDate:', cruise.sailDate, 'returnDate:', (cruise as BookedCruise).returnDate);
          return daysBetween;
        }
      } catch (e) {
        console.warn('[CruiseDetails] Error calculating nights from dates:', e);
      }
    }
    
    return cruise.nights || 0;
  }, [cruise]);

  const itineraryDisplay = useMemo((): { days: { day: number; port: string; isSeaDay: boolean }[]; needsManualEntry: boolean; source: string } => {
    if (!cruise) return { days: [], needsManualEntry: true, source: 'none' };
    
    const totalDays = accurateNights + 1;
    const result: { day: number; port: string; isSeaDay: boolean }[] = [];
    let source = 'none';
    let needsManualEntry = false;
    
    console.log('[CruiseDetails] Starting itinerary lookup for cruise:', {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
      hasItinerary: !!cruise.itinerary?.length,
      hasPortsAndTimes: !!cruise.portsAndTimes,
      hasPorts: !!cruise.ports?.length,
      linkedOfferCode: cruise.offerCode,
      linkedOfferHasPortsAndTimes: !!linkedOffer?.portsAndTimes,
      linkedOfferHasPorts: !!linkedOffer?.ports?.length,
    });
    
    const determineSeaDay = (port: string): boolean => {
      const normalizedPort = port.toLowerCase().trim();
      return normalizedPort === 'at sea' || 
             normalizedPort === 'sea day' ||
             normalizedPort === 'cruising' ||
             normalizedPort.includes('sea day') ||
             normalizedPort.includes('at sea');
    };
    
    const parsePortsAndTimes = (portsAndTimes: string): { day: number; port: string; isSeaDay: boolean }[] => {
      const parsed: { day: number; port: string; isSeaDay: boolean }[] = [];
      const lines = portsAndTimes.split(/\r?\n/).filter((line: string) => line.trim());
      lines.forEach((line: string, index: number) => {
        const parts = line.split(/[;|\t]/).map((p: string) => p.trim());
        const port = parts[0] || '';
        if (port) {
          parsed.push({
            day: index + 1,
            port,
            isSeaDay: determineSeaDay(port),
          });
        }
      });
      return parsed;
    };
    
    // Check cruise.itinerary first (structured data)
    if (cruise.itinerary && cruise.itinerary.length > 0) {
      source = 'cruise.itinerary';
      cruise.itinerary.forEach((day: ItineraryDay) => {
        result.push({
          day: day.day,
          port: day.port,
          isSeaDay: day.isSeaDay || determineSeaDay(day.port),
        });
      });
    } 
    // Check cruise.portsAndTimes (raw string)
    else if (cruise.portsAndTimes) {
      source = 'cruise.portsAndTimes';
      const parsed = parsePortsAndTimes(cruise.portsAndTimes);
      result.push(...parsed);
    } 
    // Check linkedOffer.portsAndTimes
    else if (linkedOffer?.portsAndTimes) {
      source = 'linkedOffer.portsAndTimes';
      const parsed = parsePortsAndTimes(linkedOffer.portsAndTimes);
      result.push(...parsed);
    } 
    // Check cruise.itineraryRaw (array of strings)
    else if (cruise.itineraryRaw && cruise.itineraryRaw.length > 0) {
      source = 'cruise.itineraryRaw';
      cruise.itineraryRaw.forEach((port: string, index: number) => {
        result.push({
          day: index + 1,
          port,
          isSeaDay: determineSeaDay(port),
        });
      });
    } 
    // Check cruise.ports (array of port names)
    else if (cruise.ports && cruise.ports.length > 0) {
      source = 'cruise.ports';
      cruise.ports.forEach((port: string, index: number) => {
        result.push({
          day: index + 1,
          port,
          isSeaDay: determineSeaDay(port),
        });
      });
    } 
    // Check linkedOffer.ports
    else if (linkedOffer?.ports && linkedOffer.ports.length > 0) {
      source = 'linkedOffer.ports';
      linkedOffer.ports.forEach((port: string, index: number) => {
        result.push({
          day: index + 1,
          port,
          isSeaDay: determineSeaDay(port),
        });
      });
    } 
    // Search all offers in both localData and storeOffers
    else {
      // Combine all offers from both sources
      const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
      
      // Try to find an offer matching ship and date
      const matchingOffer = allOffers.find(o => {
        const shipMatch = o.shipName === cruise.shipName || 
                         o.shipName?.toLowerCase().includes(cruise.shipName?.toLowerCase().split(' ')[0] || '');
        const dateMatch = o.sailingDate === cruise.sailDate;
        const hasItineraryData = o.portsAndTimes || (o.ports && o.ports.length > 0);
        return shipMatch && dateMatch && hasItineraryData;
      });
      
      // Also try matching by offer code
      const offerByCode = cruise.offerCode ? allOffers.find(o => 
        o.offerCode === cruise.offerCode && (o.portsAndTimes || (o.ports && o.ports.length > 0))
      ) : null;
      
      const fallbackOffer = matchingOffer || offerByCode;
      
      if (fallbackOffer?.portsAndTimes) {
        source = 'fallbackOffer.portsAndTimes';
        const parsed = parsePortsAndTimes(fallbackOffer.portsAndTimes);
        result.push(...parsed);
        console.log('[CruiseDetails] Found itinerary in fallback offer:', fallbackOffer.offerCode);
      } else if (fallbackOffer?.ports && fallbackOffer.ports.length > 0) {
        source = 'fallbackOffer.ports';
        fallbackOffer.ports.forEach((port: string, index: number) => {
          result.push({
            day: index + 1,
            port,
            isSeaDay: determineSeaDay(port),
          });
        });
        console.log('[CruiseDetails] Found ports in fallback offer:', fallbackOffer.offerCode);
      }
    }
    
    if (result.length === 0 || cruise.itineraryNeedsManualEntry) {
      needsManualEntry = true;
      source = 'manual_entry_required';
      console.log('[CruiseDetails] No itinerary data found, flagging for manual entry:', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        nights: cruise.nights,
        checkedSources: ['cruise.itinerary', 'cruise.portsAndTimes', 'linkedOffer', 'cruise.itineraryRaw', 'cruise.ports', 'allOffers'],
      });
    } else if (result.length < totalDays) {
      console.log('[CruiseDetails] Itinerary incomplete:', {
        actualDays: result.length,
        expectedDays: totalDays,
        source,
      });
    }
    
    console.log('[CruiseDetails] Itinerary resolved:', { source, days: result.length, needsManualEntry });
    return { days: result, needsManualEntry, source };
  }, [cruise, linkedOffer, storeOffers, localData.offers, accurateNights]);

  const cruiseDetails = useMemo(() => {
    if (!cruise) return null;
    const displayPrice = cruise.balconyPrice || cruise.oceanviewPrice || cruise.interiorPrice || cruise.price || 0;
    const retailPrice = cruise.retailValue || cruise.originalPrice || 0;
    const daysUntil = getDaysUntil(cruise.sailDate);
    const savings = retailPrice > displayPrice ? retailPrice - displayPrice : 0;
    const hasPerks = cruise.freeOBC || cruise.freeGratuities || cruise.freeDrinkPackage || cruise.freeWifi || cruise.freeSpecialtyDining;
    const isBooked = 'reservationNumber' in cruise || 'bookingId' in cruise;
    return { displayPrice, retailPrice, daysUntil, savings, hasPerks, isBooked };
  }, [cruise]);

  const valueBreakdown = useMemo(() => {
    if (!cruise) return null;
    return getCruiseValueBreakdown(cruise);
  }, [cruise, getCruiseValueBreakdown]);

  const casinoAvailability = useMemo(() => {
    if (!cruise) return null;
    return getCruiseCasinoAvailability(cruise);
  }, [cruise, getCruiseCasinoAvailability]);

  const casinoStatusBadge = useMemo(() => {
    if (!casinoAvailability) return null;
    return getCasinoStatusBadge(casinoAvailability.casinoOpenDays, casinoAvailability.totalDays);
  }, [casinoAvailability]);

  const personalizedPlayEstimate = useMemo((): PersonalizedPlayEstimate | null => {
    if (!casinoAvailability) return null;
    return calculatePersonalizedPlayEstimate(casinoAvailability, playingHoursConfig);
  }, [casinoAvailability, playingHoursConfig]);

  const expectedPointsCalculation = useMemo(() => {
    if (!cruise || !casinoAvailability || completedCruises.length === 0) {
      return null;
    }

    let totalPoints = 0;
    let totalNights = 0;
    let totalCasinoDays = 0;
    let totalCasinoHours = 0;
    let cruisesWithPoints = 0;

    completedCruises.forEach((c: BookedCruise) => {
      const points = c.earnedPoints || c.casinoPoints || 0;
      if (points > 0) {
        totalPoints += points;
        totalNights += c.nights || 0;
        cruisesWithPoints++;
        
        const completedCasinoAvail = getCruiseCasinoAvailability(c);
        totalCasinoDays += completedCasinoAvail.casinoOpenDays;
        totalCasinoHours += completedCasinoAvail.estimatedCasinoHours;
      }
    });

    if (cruisesWithPoints === 0 || totalCasinoDays === 0) {
      return null;
    }

    const avgPointsPerNight = totalNights > 0 ? totalPoints / totalNights : 0;
    const avgPointsPerCasinoDay = totalCasinoDays > 0 ? totalPoints / totalCasinoDays : 0;
    const avgPointsPerCasinoHour = totalCasinoHours > 0 ? totalPoints / totalCasinoHours : 0;
    
    const expectedPointsByNights = Math.round(avgPointsPerNight * cruise.nights);
    const expectedPointsByCasinoDays = Math.round(avgPointsPerCasinoDay * casinoAvailability.casinoOpenDays);
    const expectedPointsByHours = Math.round(avgPointsPerCasinoHour * casinoAvailability.estimatedCasinoHours);

    console.log('[CruiseDetails] Expected points calculation:', {
      totalPoints,
      totalNights,
      totalCasinoDays,
      totalCasinoHours,
      avgPointsPerNight,
      avgPointsPerCasinoDay,
      avgPointsPerCasinoHour,
      cruiseNights: cruise.nights,
      cruiseCasinoDays: casinoAvailability.casinoOpenDays,
      cruiseCasinoHours: casinoAvailability.estimatedCasinoHours,
      expectedPointsByNights,
      expectedPointsByCasinoDays,
      expectedPointsByHours,
    });

    return {
      avgPointsPerNight: Math.round(avgPointsPerNight),
      avgPointsPerCasinoDay: Math.round(avgPointsPerCasinoDay),
      avgPointsPerCasinoHour: Math.round(avgPointsPerCasinoHour),
      expectedPointsByNights,
      expectedPointsByCasinoDays,
      expectedPointsByHours,
      basedOnCruises: cruisesWithPoints,
    };
  }, [cruise, casinoAvailability, completedCruises, getCruiseCasinoAvailability]);

  const openFullEditModal = () => {
    if (!cruise) return;
    setEditForm({
      shipName: cruise.shipName || '',
      departurePort: cruise.departurePort || '',
      destination: cruise.destination || cruise.itineraryName || '',
      nights: String(cruise.nights || ''),
      sailDate: cruise.sailDate || '',
      cabinType: cruise.cabinType || '',
      guests: String(cruise.guests || 2),
      interiorPrice: String(cruise.interiorPrice || ''),
      oceanviewPrice: String(cruise.oceanviewPrice || ''),
      balconyPrice: String(cruise.balconyPrice || ''),
      suitePrice: String(cruise.suitePrice || ''),
      taxes: String(cruise.taxes || ''),
      bwoNumber: String((cruise as any).bwoNumber || ''),
      freeOBC: String(cruise.freeOBC || linkedOffer?.OBC || linkedOffer?.obcAmount || ''),
      freePlay: String(cruise.freePlay || linkedOffer?.freePlay || linkedOffer?.freeplayAmount || ''),
      freeGratuities: cruise.freeGratuities || false,
      freeDrinkPackage: cruise.freeDrinkPackage || false,
      freeWifi: cruise.freeWifi || false,
      freeSpecialtyDining: cruise.freeSpecialtyDining || false,
      winnings: String((cruise as any).winnings || ''),
      earnedPoints: String((cruise as any).earnedPoints || (cruise as any).casinoPoints || ''),
      amountPaid: String(cruise.totalPrice || cruise.price || ''),
      tradeInValue: String(cruise.tradeInValue || linkedOffer?.tradeInValue || ''),
      nextCruiseCertificate: String((cruise as any).nextCruiseCertificate || ''),
    });
    setFullEditModalVisible(true);
  };

  const saveFullEdit = () => {
    if (!cruise) return;
    
    const updatedCruise = {
      ...cruise,
      shipName: editForm.shipName || cruise.shipName,
      departurePort: editForm.departurePort || cruise.departurePort,
      destination: editForm.destination || cruise.destination,
      itineraryName: editForm.destination || cruise.itineraryName,
      nights: parseInt(editForm.nights) || cruise.nights,
      sailDate: editForm.sailDate || cruise.sailDate,
      cabinType: editForm.cabinType || cruise.cabinType,
      guests: parseInt(editForm.guests) || cruise.guests || 2,
      interiorPrice: parseFloat(editForm.interiorPrice) || 0,
      oceanviewPrice: parseFloat(editForm.oceanviewPrice) || 0,
      balconyPrice: parseFloat(editForm.balconyPrice) || 0,
      suitePrice: parseFloat(editForm.suitePrice) || 0,
      taxes: parseFloat(editForm.taxes) || 0,
      bwoNumber: editForm.bwoNumber || '',
      freeOBC: parseFloat(editForm.freeOBC) || 0,
      freeGratuities: editForm.freeGratuities,
      freeDrinkPackage: editForm.freeDrinkPackage,
      freeWifi: editForm.freeWifi,
      freeSpecialtyDining: editForm.freeSpecialtyDining,
      freePlay: parseFloat(editForm.freePlay) || 0,
      winnings: parseFloat(editForm.winnings) || 0,
      earnedPoints: parseFloat(editForm.earnedPoints) || 0,
      casinoPoints: parseFloat(editForm.earnedPoints) || 0,
      totalPrice: parseFloat(editForm.amountPaid) || 0,
      price: parseFloat(editForm.amountPaid) || 0,
      tradeInValue: parseFloat(editForm.tradeInValue) || 0,
      nextCruiseCertificate: parseFloat(editForm.nextCruiseCertificate) || 0,
    };
    
    console.log('[CruiseDetails] Saving full edit:', updatedCruise);
    updateCruise(updatedCruise);
    setFullEditModalVisible(false);
  };

  const handleBookCruise = () => {
    if (!cruise) return;
    
    const bookedCruise = {
      ...cruise,
      id: cruise.id || `booked-${Date.now()}`,
      bookingId: `booking-${Date.now()}`,
      reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
      status: 'booked' as const,
      isBooked: true,
      earnedPoints: 0,
      casinoPoints: 0,
      winnings: 0,
    };
    
    console.log('[CruiseDetails] Booking cruise:', bookedCruise);
    addBookedCruise(bookedCruise);
    router.back();
  };

  if (!cruise || !cruiseDetails) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.navyDeep, COLORS.navyMedium]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.notFoundContainer}>
          <Ship size={64} color={COLORS.beigeWarm} />
          <Text style={styles.notFoundTitle}>Cruise Not Found</Text>
          <Text style={styles.notFoundText}>The cruise you are looking for could not be found.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={COLORS.white} />
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { daysUntil, hasPerks, isBooked } = cruiseDetails;

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroPlaceholder}>
          <Image
            source={{ uri: heroImageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setHeroImageUri(DEFAULT_CRUISE_IMAGE)}
          />
          <LinearGradient
            colors={['rgba(0,31,63,0.3)', 'rgba(0,31,63,0.7)']}
            style={StyleSheet.absoluteFill}
          />
          {isBooked && (
            <View style={styles.bookedBadge}>
              <Text style={styles.bookedBadgeText}>BOOKED</Text>
            </View>
          )}
          <View style={styles.heroButtonsContainer}>
            <TouchableOpacity 
              style={styles.editAllButton} 
              onPress={openFullEditModal}
              activeOpacity={0.7}
            >
              <Edit3 size={18} color={COLORS.beigeWarm} />
              <Text style={styles.editAllButtonText}>Edit</Text>
            </TouchableOpacity>
            
            {!isBooked ? (
              <TouchableOpacity 
                style={styles.bookHeaderButton} 
                activeOpacity={0.8}
                onPress={handleBookCruise}
                testID="book-cruise-button"
              >
                <Text style={styles.bookHeaderButtonText}>Book</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.unbookHeaderButton} 
                activeOpacity={0.8}
                onPress={() => setUnbookModalVisible(true)}
                testID="unbook-cruise-button"
              >
                <Trash2 size={16} color={COLORS.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <View style={styles.shipRow}>
              <Ship size={24} color={COLORS.beigeWarm} />
              <Text style={styles.shipName}>{cruise.shipName}</Text>
            </View>
            <Text style={styles.destination}>{cruise.itineraryName || cruise.destination || 'Cruise'}</Text>
            
            {(linkedOffer?.offerName || linkedOffer?.title || cruise.offerCode) && (
              <View style={styles.offerNameContainer}>
                <Sparkles size={16} color={COLORS.goldDark} />
                <Text style={styles.offerNameText}>
                  {linkedOffer?.offerName || linkedOffer?.title || `Offer ${cruise.offerCode}`}
                </Text>
              </View>
            )}
            
            {cruise.offerCode && (
              <View style={styles.offerCodeBadge}>
                <Tag size={14} color={COLORS.beigeWarm} />
                <Text style={styles.offerCodeText}>{cruise.offerCode}</Text>
              </View>
            )}
            
            {daysUntil > 0 && (
              <View style={styles.countdownContainer}>
                <Clock size={16} color={COLORS.beigeWarm} />
                <Text style={styles.countdown}>{daysUntil} days until departure</Text>
              </View>
            )}
          </View>

          <View style={styles.compactFactsRow} testID="cruise-facts-card">
            <CompactFact icon={Calendar} value={formatDate(cruise.sailDate, 'short')} />
            <Text style={styles.factDivider}>•</Text>
            <CompactFact icon={Clock} value={formatNights(accurateNights)} />
            <Text style={styles.factDivider}>•</Text>
            <CompactFact icon={MapPin} value={cruise.departurePort || 'TBD'} />
          </View>
          <View style={styles.compactFactsRow}>
            <CompactFact icon={Users} value={`${cruise.guests || 2} guests`} />
            <Text style={styles.factDivider}>•</Text>
            <CompactFact icon={Anchor} value={cruise.cabinType || 'TBD'} />
            <Text style={styles.factDivider}>•</Text>
            <CompactFact icon={Dice5} value={casinoAvailability ? `${casinoAvailability.casinoOpenDays}/${casinoAvailability.totalDays} casino` : '—'} />
          </View>

          {isBooked && (
            <View style={styles.cruiseDetailsSection}>
              <View style={styles.sectionHeader}>
                <Ship size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Cruise Details</Text>
              </View>
              
              <View style={styles.detailsGrid}>
                <View style={styles.detailRow} testID="cruise-detail-booking-id">
                  <Text style={styles.detailRowLabel}>Booking ID</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).bookingId ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-reservation-number">
                  <Text style={styles.detailRowLabel}>Reservation #</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).reservationNumber ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-package-code">
                  <Text style={styles.detailRowLabel}>Package Code</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).packageCode ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-passenger-status">
                  <Text style={styles.detailRowLabel}>Passenger Status</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).passengerStatus ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-stateroom-number">
                  <Text style={styles.detailRowLabel}>Stateroom #</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).stateroomNumber ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-stateroom-category-code">
                  <Text style={styles.detailRowLabel}>Stateroom Category</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).stateroomCategoryCode ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-stateroom-type">
                  <Text style={styles.detailRowLabel}>Stateroom Type</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).stateroomType ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-deck-number">
                  <Text style={styles.detailRowLabel}>Deck</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).deckNumber ?? '—'}</Text>
                </View>

                <View style={styles.detailRow} testID="cruise-detail-muster-station">
                  <Text style={styles.detailRowLabel}>Muster Station</Text>
                  <Text style={styles.detailRowValue}>{(cruise as BookedCruise).musterStation ?? '—'}</Text>
                </View>
                
                {(cruise as BookedCruise).bookingStatus && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Booking Status</Text>
                    <Text style={styles.detailRowValue}>{(cruise as BookedCruise).bookingStatus}</Text>
                  </View>
                )}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Paid in Full</Text>
                  <Text style={styles.detailRowValue}>
                    {(cruise as any).paidInFull === 'Yes' || (cruise as any).paidInFull === true ? 'Yes' : 'No'}
                  </Text>
                </View>
                
                {((cruise as any).balanceDue && parseFloat((cruise as any).balanceDue) > 0) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Balance Due</Text>
                    <Text style={[styles.detailRowValue, { color: COLORS.error }]}>
                      {formatCurrency(parseFloat((cruise as any).balanceDue))}
                    </Text>
                  </View>
                )}
                
                {cruise.guests && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Number of Guests</Text>
                    <Text style={styles.detailRowValue}>{cruise.guests}</Text>
                  </View>
                )}
                
                {(cruise as BookedCruise).guestNames && (cruise as BookedCruise).guestNames!.length > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Guests</Text>
                    <Text style={styles.detailRowValue}>{(cruise as BookedCruise).guestNames!.join(', ')}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {((cruise.freePlay ?? linkedOffer?.freePlay ?? linkedOffer?.freeplayAmount ?? 0) > 0 || (cruise.freeOBC ?? linkedOffer?.OBC ?? linkedOffer?.obcAmount ?? 0) > 0) && (
            <View style={styles.fpObcQuickView}>
              {(cruise.freePlay ?? linkedOffer?.freePlay ?? linkedOffer?.freeplayAmount ?? 0) > 0 && (
                <View style={styles.fpQuickBadge}>
                  <Text style={styles.fpQuickLabel}>FreePlay</Text>
                  <Text style={styles.fpQuickValue}>${(cruise.freePlay ?? linkedOffer?.freePlay ?? linkedOffer?.freeplayAmount ?? 0).toLocaleString()}</Text>
                </View>
              )}
              {(cruise.freeOBC ?? linkedOffer?.OBC ?? linkedOffer?.obcAmount ?? 0) > 0 && (
                <View style={styles.obcQuickBadge}>
                  <Text style={styles.obcQuickLabel}>OBC</Text>
                  <Text style={styles.obcQuickValue}>${(cruise.freeOBC ?? linkedOffer?.OBC ?? linkedOffer?.obcAmount ?? 0).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          {(cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice || cruise.taxes) && (
            <View style={styles.pricingChipsCard} testID="cruise-pricing-chips">
              <View style={styles.pricingChipsRow}>
                {cruise.interiorPrice && cruise.interiorPrice > 0 && (
                  <View style={styles.pricingChip}>
                    <Text style={styles.pricingChipLabel}>INT</Text>
                    <Text style={styles.pricingChipValue}>{formatCurrency(cruise.interiorPrice)}</Text>
                  </View>
                )}
                {cruise.oceanviewPrice && cruise.oceanviewPrice > 0 && (
                  <View style={styles.pricingChip}>
                    <Text style={styles.pricingChipLabel}>OV</Text>
                    <Text style={styles.pricingChipValue}>{formatCurrency(cruise.oceanviewPrice)}</Text>
                  </View>
                )}
                {cruise.balconyPrice && cruise.balconyPrice > 0 && (
                  <View style={styles.pricingChip}>
                    <Text style={styles.pricingChipLabel}>BAL</Text>
                    <Text style={styles.pricingChipValue}>{formatCurrency(cruise.balconyPrice)}</Text>
                  </View>
                )}
                {cruise.suitePrice && cruise.suitePrice > 0 && (
                  <View style={styles.pricingChip}>
                    <Text style={styles.pricingChipLabel}>STE</Text>
                    <Text style={styles.pricingChipValue}>{formatCurrency(cruise.suitePrice)}</Text>
                  </View>
                )}
                {cruise.taxes && cruise.taxes > 0 && (
                  <View style={[styles.pricingChip, styles.pricingChipMuted]}>
                    <Text style={styles.pricingChipLabel}>TAX</Text>
                    <Text style={[styles.pricingChipValue, styles.pricingChipValueMuted]}>{formatCurrency(cruise.taxes)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {isBooked && (
            <TouchableOpacity 
              style={styles.bwoFpObcCard} 
              onPress={openFullEditModal}
              activeOpacity={0.7}
              testID="bwo-fp-obc-section"
            >
              <View style={styles.bwoFpObcHeader}>
                <Text style={styles.bwoFpObcTitle}>Cruise Receipt Details</Text>
                <Edit3 size={14} color={COLORS.textSecondary} />
              </View>
              {((cruise as any).bwoNumber || (cruise.freePlay ?? 0) > 0 || (cruise.freeOBC ?? 0) > 0) ? (
                <View style={styles.bwoFpObcRow}>
                  {(cruise as any).bwoNumber ? (
                    <View style={styles.bwoChip}>
                      <Text style={styles.bwoLabel}>BWO#</Text>
                      <Text style={styles.bwoValue}>{(cruise as any).bwoNumber}</Text>
                    </View>
                  ) : (
                    <View style={styles.bwoChipEmpty}>
                      <Text style={styles.bwoLabelEmpty}>BWO#</Text>
                      <Text style={styles.bwoValueEmpty}>—</Text>
                    </View>
                  )}
                  <View style={(cruise.freePlay ?? 0) > 0 ? styles.fpChip : styles.fpChipEmpty}>
                    <Text style={(cruise.freePlay ?? 0) > 0 ? styles.fpChipLabel : styles.fpChipLabelEmpty}>FreePlay</Text>
                    <Text style={(cruise.freePlay ?? 0) > 0 ? styles.fpChipValue : styles.fpChipValueEmpty}>
                      {(cruise.freePlay ?? 0) > 0 ? `${(cruise.freePlay ?? 0).toLocaleString()}` : '—'}
                    </Text>
                  </View>
                  <View style={(cruise.freeOBC ?? 0) > 0 ? styles.obcChip : styles.obcChipEmpty}>
                    <Text style={(cruise.freeOBC ?? 0) > 0 ? styles.obcChipLabel : styles.obcChipLabelEmpty}>OBC</Text>
                    <Text style={(cruise.freeOBC ?? 0) > 0 ? styles.obcChipValue : styles.obcChipValueEmpty}>
                      {(cruise.freeOBC ?? 0) > 0 ? `${(cruise.freeOBC ?? 0).toLocaleString()}` : '—'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.bwoFpObcPlaceholder}>Tap to add BWO#, FreePlay, or OBC from your receipt</Text>
              )}
            </TouchableOpacity>
          )}

          {isBooked && (
            <View style={styles.compactCasinoCard}>
              <View style={styles.casinoResultsRow}>
                <View style={styles.casinoResultCol}>
                  <Text style={styles.casinoResultLabel}>Win/Loss</Text>
                  <Text style={[
                    styles.casinoResultValue,
                    { color: ((cruise as any).winnings || 0) >= 0 ? COLORS.success : COLORS.error }
                  ]}>
                    {((cruise as any).winnings || 0) >= 0 ? '+' : ''}{formatCurrency((cruise as any).winnings || 0)}
                  </Text>
                </View>
                <View style={styles.casinoResultCol}>
                  <Text style={styles.casinoResultLabel}>Points</Text>
                  <Text style={[styles.casinoResultValue, { color: COLORS.points }]}>
                    {((cruise as any).earnedPoints || (cruise as any).casinoPoints || 0).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.casinoEditButton}
                  onPress={() => {
                    console.log('[CruiseDetails] Opening edit modal for cruise:', cruise);
                    const bookedCruise = cruise as any;
                    setEditWinnings(String(bookedCruise.winnings || 0));
                    setEditPoints(String(bookedCruise.earnedPoints || bookedCruise.casinoPoints || 0));
                    setEditModalVisible(true);
                  }}
                  testID="edit-casino-stats-button"
                >
                  <Edit3 size={16} color={COLORS.navyDeep} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(hasPerks || cruise.offerCode || (cruise as any).offerCode) && (
            <View style={styles.offersSection}>
              <View style={styles.sectionHeader}>
                <Gift size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Special Offers & Perks</Text>
              </View>
              
              {(cruise.offerCode || (cruise as any).offerCode) && (
                <View style={styles.offerCodeCard}>
                  <View style={styles.offerCodeHeader}>
                    <Sparkles size={16} color={COLORS.goldDark} />
                    <Text style={styles.offerCodeLabel}>Offer Code</Text>
                  </View>
                  <Text style={styles.offerCodeValue}>{cruise.offerCode || (cruise as any).offerCode}</Text>
                </View>
              )}

              {((cruise.freePlay ?? 0) > 0 || ((cruise as any).freeOBC ?? cruise.freeOBC ?? 0) > 0) && (
                <View style={styles.fpObcHighlight}>
                  {(cruise.freePlay ?? 0) > 0 && (
                    <View style={styles.fpHighlightCard}>
                      <Text style={styles.fpHighlightLabel}>FreePlay</Text>
                      <Text style={styles.fpHighlightValue}>${(cruise.freePlay ?? 0).toLocaleString()}</Text>
                    </View>
                  )}
                  {((cruise as any).freeOBC ?? cruise.freeOBC ?? 0) > 0 && (
                    <View style={styles.obcHighlightCard}>
                      <Text style={styles.obcHighlightLabel}>Onboard Credit</Text>
                      <Text style={styles.obcHighlightValue}>${((cruise as any).freeOBC ?? cruise.freeOBC ?? 0).toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              )}
              
              <View style={styles.offersList}>
                {cruise.freeGratuities && (
                  <View style={styles.offerItem}>
                    <Star size={16} color={COLORS.success} />
                    <Text style={styles.offerText}>Free Gratuities Included</Text>
                  </View>
                )}
                {cruise.freeDrinkPackage && (
                  <View style={styles.offerItem}>
                    <Star size={16} color={COLORS.success} />
                    <Text style={styles.offerText}>Free Drink Package</Text>
                  </View>
                )}
                {cruise.freeWifi && (
                  <View style={styles.offerItem}>
                    <Star size={16} color={COLORS.success} />
                    <Text style={styles.offerText}>Free WiFi</Text>
                  </View>
                )}
                {cruise.freeSpecialtyDining && (
                  <View style={styles.offerItem}>
                    <Star size={16} color={COLORS.success} />
                    <Text style={styles.offerText}>Free Specialty Dining</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {isBooked && (cruise as BookedCruise).bookingId && (
            <View style={styles.payloadDetailsSection}>
              <View style={styles.sectionHeader}>
                <Ship size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Booking Payload Details</Text>
              </View>
              
              <View style={styles.payloadGrid}>
                {(cruise as any).bookingChannel && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Booking Channel</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).bookingChannel}</Text>
                  </View>
                )}
                
                {(cruise as any).bookingCurrency && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Currency</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).bookingCurrency}</Text>
                  </View>
                )}
                
                {(cruise as any).bookingOfficeCountryCode && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Office Country</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).bookingOfficeCountryCode}</Text>
                  </View>
                )}
                
                {(cruise as any).bookingType && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Booking Type</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).bookingType}</Text>
                  </View>
                )}
                
                {(cruise as any).brand && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Brand</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).brand}</Text>
                  </View>
                )}
                
                {(cruise as any).consumerId && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Consumer ID</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).consumerId}</Text>
                  </View>
                )}
                
                {(cruise as any).grantorPassengerId && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Grantor Passenger</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).grantorPassengerId}</Text>
                  </View>
                )}
                
                {(cruise as any).lastName && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Last Name</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).lastName}</Text>
                  </View>
                )}
                
                {(cruise as any).linkFlow && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Link Flow</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).linkFlow}</Text>
                  </View>
                )}
                
                {(cruise as any).linkType && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Link Type</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).linkType}</Text>
                  </View>
                )}
                
                {(cruise as any).masterBookingId && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Master Booking ID</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).masterBookingId}</Text>
                  </View>
                )}
                
                {(cruise as any).masterPassengerId && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Master Passenger ID</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).masterPassengerId}</Text>
                  </View>
                )}
                
                {(cruise as any).numberOfNights !== undefined && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Number of Nights</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).numberOfNights}</Text>
                  </View>
                )}
                
                {(cruise as any).officeCode && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Office Code</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).officeCode}</Text>
                  </View>
                )}
                
                {(cruise as any).passengerId && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Passenger ID</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).passengerId}</Text>
                  </View>
                )}
                
                {(cruise as any).passengersInStateroom !== undefined && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Passengers in Stateroom</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).passengersInStateroom}</Text>
                  </View>
                )}
                
                {(cruise as any).preferred !== undefined && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Preferred</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).preferred ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                
                {(cruise as any).shipCode && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Ship Code</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).shipCode}</Text>
                  </View>
                )}
                
                {(cruise as any).stateroomDescription && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Stateroom Description</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).stateroomDescription}</Text>
                  </View>
                )}
                
                {(cruise as any).stateroomSubtype && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Stateroom Subtype</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).stateroomSubtype}</Text>
                  </View>
                )}
                
                {(cruise as any).stateroomType && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Stateroom Type</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).stateroomType}</Text>
                  </View>
                )}
                
                {(cruise as any).isDirect !== undefined && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Is Direct</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).isDirect ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                
                {(cruise as any).isBoardingExpressEnabled !== undefined && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Boarding Express</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).isBoardingExpressEnabled ? 'Enabled' : 'Disabled'}</Text>
                  </View>
                )}
                
                {(cruise as any).isInternationalBooking !== undefined && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>International Booking</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).isInternationalBooking ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                
                {(cruise as any).amendToken && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Amend Token</Text>
                    <Text style={styles.payloadValue} numberOfLines={1}>{(cruise as any).amendToken}</Text>
                  </View>
                )}
                
                {(cruise as any).passengers && Array.isArray((cruise as any).passengers) && (
                  <View style={styles.payloadRow}>
                    <Text style={styles.payloadLabel}>Passengers</Text>
                    <Text style={styles.payloadValue}>{(cruise as any).passengers.length} guest(s)</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {casinoAvailability && (
            <View style={styles.casinoSection}>
              <View style={styles.sectionHeader}>
                <MapPin size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Itinerary & Casino</Text>
                {casinoStatusBadge && (
                  <View style={[styles.casinoStatusBadge, { backgroundColor: casinoStatusBadge.color + '30' }]}>
                    <Text style={[styles.casinoStatusText, { color: casinoStatusBadge.color }]}>
                      {casinoStatusBadge.label}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.casinoStatsCompact}>
                <View style={styles.casinoStatCompact}>
                  <Text style={styles.casinoStatCompactLabel}>Casino</Text>
                  <Text style={styles.casinoStatCompactValue}>{casinoAvailability.casinoOpenDays}d</Text>
                </View>
                <View style={styles.casinoStatCompact}>
                  <Text style={styles.casinoStatCompactLabel}>Sea</Text>
                  <Text style={styles.casinoStatCompactValue}>{casinoAvailability.seaDays}d</Text>
                </View>
                <View style={styles.casinoStatCompact}>
                  <Text style={styles.casinoStatCompactLabel}>Play</Text>
                  <Text style={styles.casinoStatCompactValue}>{personalizedPlayEstimate?.playDays || 0}d</Text>
                </View>
                <View style={styles.casinoStatCompact}>
                  <Text style={styles.casinoStatCompactLabel}>Golden</Text>
                  <Text style={styles.casinoStatCompactValue}>{personalizedPlayEstimate?.goldenHoursTotal || personalizedPlayEstimate?.estimatedPlayHours || 0}h</Text>
                </View>
                <View style={styles.casinoStatCompact}>
                  <Text style={styles.casinoStatCompactLabel}>Est Pts</Text>
                  <Text style={styles.casinoStatCompactValue}>~{((personalizedPlayEstimate?.estimatedPoints || 0) / 1000).toFixed(1)}k</Text>
                </View>
              </View>

              {personalizedPlayEstimate && (
                <View style={styles.expectedPointsSection}>
                  <View style={styles.expectedPointsHeader}>
                    <Target size={16} color={COLORS.beigeWarm} />
                    <Text style={styles.expectedPointsTitle}>Play Schedule Estimate</Text>
                  </View>
                  <View style={styles.combinedEstimateRow}>
                    <View style={styles.combinedEstimateItem}>
                      <View style={styles.combinedEstimateIconBadge}>
                        <Star size={14} color={COLORS.navyDeep} />
                      </View>
                      <View>
                        <Text style={styles.combinedEstimateValue}>
                          ~{personalizedPlayEstimate.estimatedPoints.toLocaleString()} pts
                        </Text>
                        <Text style={styles.combinedEstimateLabel}>Est. Points</Text>
                      </View>
                    </View>
                    <View style={styles.combinedEstimateDivider} />
                    <View style={styles.combinedEstimateItem}>
                      <View style={[styles.combinedEstimateIconBadge, styles.goldenIconBadge]}>
                        <Clock size={14} color={COLORS.navyDeep} />
                      </View>
                      <View>
                        <Text style={styles.combinedEstimateValue}>
                          {personalizedPlayEstimate.goldenHoursTotal > 0 
                            ? `${personalizedPlayEstimate.goldenHoursTotal}h`
                            : `${personalizedPlayEstimate.estimatedPlayHours}h`
                          }
                        </Text>
                        <Text style={styles.combinedEstimateLabel}>Golden Time</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {expectedPointsCalculation && (
                <View style={styles.historicalComparisonSection}>
                  <View style={styles.expectedPointsHeader}>
                    <TrendingUp size={16} color={COLORS.textSecondary} />
                    <Text style={styles.historicalComparisonTitle}>Historical Avg</Text>
                  </View>
                  <View style={styles.historicalStatsRow}>
                    <View style={styles.historicalStatItem}>
                      <Text style={styles.historicalStatValue}>{expectedPointsCalculation.avgPointsPerNight.toLocaleString()}</Text>
                      <Text style={styles.historicalStatLabel}>pts/night</Text>
                    </View>
                    <View style={styles.historicalStatItem}>
                      <Text style={styles.historicalStatValue}>{expectedPointsCalculation.avgPointsPerCasinoDay.toLocaleString()}</Text>
                      <Text style={styles.historicalStatLabel}>pts/casino day</Text>
                    </View>
                  </View>
                  <Text style={styles.historicalStatNote}>Based on {expectedPointsCalculation.basedOnCruises} past cruises</Text>
                </View>
              )}

              <View style={styles.itineraryList}>
                {casinoAvailability.dailyAvailability.map((day, index) => (
                  <View key={index} style={styles.itineraryDayRow}>
                    <View style={[styles.itineraryDayDot, day.isSeaDay && styles.seaDayDot]} />
                    {index < casinoAvailability.dailyAvailability.length - 1 && <View style={styles.itineraryDayLine} />}
                    <View style={styles.itineraryDayContent}>
                      <View style={styles.itineraryDayHeader}>
                        <Text style={styles.itineraryDayLabel}>Day {day.day}</Text>
                        <View style={[styles.casinoDayStatusChip, { backgroundColor: day.casinoOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                          <Text style={[styles.casinoDayStatusChipText, { color: day.casinoOpen ? COLORS.success : COLORS.error }]}>
                            {day.casinoOpen ? 'Casino Open' : 'Casino Closed'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.itineraryDayPort}>
                        {day.isSeaDay ? '🌊 At Sea' : `📍 ${day.port}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {valueBreakdown && (
            <View style={styles.valueSection}>
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Value Summary</Text>
                <TouchableOpacity
                  style={styles.editValueButton}
                  onPress={openFullEditModal}
                >
                  <Edit3 size={14} color={COLORS.beigeWarm} />
                </TouchableOpacity>
              </View>

              <View style={styles.valueCompactGrid}>
                <View style={styles.valueCompactRow}>
                  <Text style={styles.valueCompactLabel}>Retail</Text>
                  <Text style={styles.valueCompactValue}>{formatCurrency(valueBreakdown.totalRetailValue)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.valueCompactRow}
                  onPress={openFullEditModal}
                  activeOpacity={0.7}
                >
                  <View style={styles.valueCompactLabelWithIcon}>
                    <Text style={styles.valueCompactLabel}>Paid</Text>
                    <Edit3 size={10} color={COLORS.textSecondary} />
                  </View>
                  <Text style={styles.valueCompactValue}>{formatCurrency(valueBreakdown.amountPaid)}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.valueNetRow}>
                <Text style={styles.valueNetLabel}>Net Value</Text>
                <Text style={[styles.valueNetAmount, { color: valueBreakdown.netValue >= 0 ? COLORS.success : COLORS.error }]}>
                  {valueBreakdown.netValue >= 0 ? '+' : ''}{formatCurrency(valueBreakdown.netValue)}
                </Text>
              </View>
              
              <View style={styles.coverageBar}>
                <View 
                  style={[
                    styles.coverageFill, 
                    { width: `${Math.min(100, valueBreakdown.coverageFraction * 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.coverageText}>
                {(valueBreakdown.coverageFraction * 100).toFixed(0)}% Coverage
                {valueBreakdown.isFullyComped && ' • Fully Comped!'}
              </Text>
            </View>
          )}


        </View>
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Casino Statistics</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Won/Loss ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editWinnings}
                  onChangeText={setEditWinnings}
                  keyboardType="numeric"
                  placeholder="Enter winnings or losses"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Points Earned</Text>
                <TextInput
                  style={styles.input}
                  value={editPoints}
                  onChangeText={setEditPoints}
                  keyboardType="numeric"
                  placeholder="Enter points earned"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  console.log('[CruiseDetails] Saving casino stats');
                  const winningsValue = parseFloat(editWinnings) || 0;
                  const pointsValue = parseFloat(editPoints) || 0;
                  
                  const updatedCruise = {
                    ...cruise,
                    winnings: winningsValue,
                    earnedPoints: pointsValue,
                    casinoPoints: pointsValue,
                  };
                  
                  console.log('[CruiseDetails] Updated cruise:', updatedCruise);
                  updateCruise(updatedCruise);
                  setEditModalVisible(false);
                }}
              >
                <Save size={18} color={COLORS.white} />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={fullEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFullEditModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Cruise Details</Text>
              <TouchableOpacity
                onPress={() => setFullEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.fullModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Basic Info</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ship Name</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.shipName}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, shipName: val }))}
                  placeholder="Ship name"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Destination / Itinerary</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.destination}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, destination: val }))}
                  placeholder="Destination"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Departure Port</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.departurePort}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, departurePort: val }))}
                    placeholder="Port"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>Nights</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.nights}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, nights: val }))}
                    keyboardType="numeric"
                    placeholder="# Nights"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Sail Date (MM-DD-YYYY)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.sailDate}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, sailDate: val }))}
                    placeholder="2025-01-15"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>Guests</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.guests}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, guests: val }))}
                    keyboardType="numeric"
                    placeholder="2"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cabin Type</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.cabinType}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, cabinType: val }))}
                  placeholder="Balcony, Suite, etc."
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <Text style={styles.sectionLabel}>Pricing</Text>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Interior ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.interiorPrice}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, interiorPrice: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>Ocean View ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.oceanviewPrice}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, oceanviewPrice: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Balcony ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.balconyPrice}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, balconyPrice: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>Suite ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.suitePrice}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, suitePrice: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Taxes & Fees ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.taxes}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, taxes: val }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <Text style={styles.sectionLabel}>Casino Offer Details</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BWO# (Booking/Offer Reference)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.bwoNumber}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, bwoNumber: val }))}
                  placeholder="e.g., 2501A01"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>FreePlay ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.freePlay}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, freePlay: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>OBC ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.freeOBC}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, freeOBC: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Additional Perks</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Additional Onboard Credit ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.freeOBC}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, freeOBC: val }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Trade-In Value ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.tradeInValue}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, tradeInValue: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>Next Cruise Cert ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.nextCruiseCertificate}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, nextCruiseCertificate: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount Paid ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.amountPaid}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, amountPaid: val }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Gratuities</Text>
                <Switch
                  value={editForm.freeGratuities}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, freeGratuities: val }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Drink Package</Text>
                <Switch
                  value={editForm.freeDrinkPackage}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, freeDrinkPackage: val }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free WiFi</Text>
                <Switch
                  value={editForm.freeWifi}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, freeWifi: val }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Specialty Dining</Text>
                <Switch
                  value={editForm.freeSpecialtyDining}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, freeSpecialtyDining: val }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <Text style={styles.sectionLabel}>Casino Stats</Text>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Won/Loss ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.winnings}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, winnings: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                  <Text style={styles.inputLabel}>Points Earned</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.earnedPoints}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, earnedPoints: val }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={{ height: SPACING.xl }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setFullEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveFullEdit}
              >
                <Save size={18} color={COLORS.white} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={unbookModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnbookModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Unbook Cruise</Text>
              <TouchableOpacity
                onPress={() => setUnbookModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.unbookWarningContainer}>
                <AlertCircle size={48} color={COLORS.error} />
                <Text style={styles.unbookWarningTitle}>Are you sure?</Text>
                <Text style={styles.unbookWarningText}>
                  This will remove <Text style={styles.unbookWarningBold}>{cruise?.shipName}</Text> ({formatDate(cruise?.sailDate || '', 'medium')}) from your booked cruises.
                </Text>
                <Text style={styles.unbookWarningSubtext}>
                  This action cannot be undone.
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setUnbookModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.unbookConfirmButton}
                onPress={() => {
                  if (cruise?.id) {
                    console.log('[CruiseDetails] Unbooking cruise:', cruise.id);
                    removeBookedCruise(cruise.id);
                    setUnbookModalVisible(false);
                    router.back();
                  }
                }}
              >
                <Trash2 size={18} color={COLORS.white} />
                <Text style={styles.unbookConfirmButtonText}>Unbook</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  notFoundTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  notFoundText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookedBadge: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  bookedBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    letterSpacing: 1,
  },
  heroButtonsContainer: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  editAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.4)',
  },
  bookHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.beigeWarm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.goldDark,
  },
  bookHeaderButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  unbookHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  editAllButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.beigeWarm,
  },
  content: {
    padding: SPACING.lg,
  },
  headerSection: {
    marginBottom: SPACING.lg,
  },
  shipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  shipName: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  destination: {
    fontSize: TYPOGRAPHY.fontSizeTitle,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  offerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  offerNameText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#92400E',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  offerCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 151, 167, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  offerCodeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  countdown: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  factsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.08)',
    ...SHADOW.sm,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  factPill: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 31, 63, 0.03)',
    borderRadius: BORDER_RADIUS.sm,
  },
  factIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(219, 234, 254, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  factTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  factLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  factValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  pricingChipsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.08)',
  },
  pricingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pricingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.15)',
  },
  pricingChipMuted: {
    backgroundColor: 'rgba(15, 23, 42, 0.03)',
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  pricingChipLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  pricingChipValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.money,
  },
  pricingChipValueMuted: {
    color: COLORS.textPrimary,
  },
  compactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactInfoValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
    flex: 1,
  },
  compactInfoDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.sm,
  },
  compactPriceCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.08)',
  },
  pricingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pricingCol: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.sm,
  },
  pricingLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pricingValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.money,
  },
  compactPriceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  compactPriceTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    flex: 1,
  },
  compactSavingsBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  compactSavingsText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.success,
  },
  compactPriceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  compactPriceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.xs,
    gap: 6,
  },
  compactPriceLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  compactPriceValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.money,
  },
  compactTaxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.06)',
  },
  compactTaxesLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  compactTaxesValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textPrimary,
  },
  compactCasinoCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.08)',
  },
  casinoResultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  casinoResultCol: {
    flex: 1,
    alignItems: 'center',
  },
  casinoResultLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  casinoResultValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  casinoEditButton: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.sm,
  },
  compactCasinoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  compactCasinoTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    flex: 1,
  },
  compactEditButton: {
    padding: 4,
  },
  compactCasinoStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactCasinoStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  compactCasinoStatLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  compactCasinoStatValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  compactCasinoStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.md,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginTop: SPACING.sm,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginTop: 2,
  },
  offersSection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: '#E0F2FE',
    ...SHADOW.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
  },
  offersList: {
    gap: SPACING.sm,
  },
  offerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  offerText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  itineraryList: {
    gap: 0,
    marginTop: SPACING.md,
  },
  itineraryDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 60,
  },
  itineraryDayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.beigeWarm,
    marginTop: 6,
    zIndex: 1,
  },
  seaDayDot: {
    backgroundColor: '#3b82f6',
  },
  itineraryDayLine: {
    position: 'absolute',
    left: 5,
    top: 18,
    bottom: -18,
    width: 2,
    backgroundColor: COLORS.cardBorder,
  },
  itineraryDayContent: {
    marginLeft: SPACING.md,
    flex: 1,
    backgroundColor: '#DBEAFE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  itineraryDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itineraryDayLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  itineraryDayPort: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  casinoDayStatusChip: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  casinoDayStatusChipText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },

  editButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    padding: SPACING.xs,
  },
  casinoSection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: '#E0F2FE',
    ...SHADOW.sm,
  },
  casinoStatusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  casinoStatusText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  casinoStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  casinoStatsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  casinoStatCompact: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.sm,
  },
  casinoStatCompactLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginBottom: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  casinoStatCompactValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  casinoStatCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.sm,
    marginHorizontal: 2,
  },
  casinoStatValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  casinoStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginTop: 2,
  },
  casinoDescription: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  casinoDayList: {
    gap: SPACING.xs,
  },
  casinoDayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.sm,
  },
  casinoDayIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoDayContent: {
    flex: 1,
  },
  casinoDayLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  casinoDayPort: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  casinoDayStatus: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  moreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  manualEntryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: 'auto',
    gap: 4,
  },
  manualEntryBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.warning,
  },
  manualEntryContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderStyle: 'dashed',
  },
  manualEntryTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.warning,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  manualEntryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.beigeWarm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  manualEntryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  itinerarySourceText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.7,
  },
  valueSection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: '#E0F2FE',
    ...SHADOW.sm,
  },
  valueCompactGrid: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  valueCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.sm,
  },
  valueCompactLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  valueCompactLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueCompactValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  valueNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  valueNetLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  valueNetAmount: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  valueLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
  },
  valueAmount: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  valueDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: SPACING.sm,
  },
  valueTotalLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  valueTotalAmount: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.money,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  netValueRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: -SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  netValueLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  netValueAmount: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  coverageBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  coverageFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  coverageText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  expectedPointsSection: {
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 151, 167, 0.2)',
  },
  expectedPointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  expectedPointsTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.points,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  expectedPointsCard: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  expectedPointsValue: {
    fontSize: TYPOGRAPHY.fontSizeTitle,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.points,
  },
  expectedPointsLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  expectedPointsBreakdown: {
    gap: SPACING.xs,
  },
  expectedPointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expectedPointsRowLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  expectedPointsRowValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  editValueButton: {
    marginLeft: 'auto',
    padding: SPACING.xs,
  },
  valueLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amountPaidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: -SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  amountPaidLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkedOfferInfo: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  linkedOfferLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.lg,
  },
  fullModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.bgSecondary,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  modalBody: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  fullModalBody: {
    padding: SPACING.lg,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  switchLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.bgSecondary,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.bgTertiary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  playScheduleBreakdown: {
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  playDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DBEAFE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  playDayInfo: {
    flex: 1,
  },
  playDayLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
  },
  playDayPort: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  playDayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  playDaySessions: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    backgroundColor: COLORS.pointsBg,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  playDayHours: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    minWidth: 30,
    textAlign: 'center' as const,
  },
  playDayPoints: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    minWidth: 50,
    textAlign: 'right' as const,
  },
  playScheduleNote: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  playScheduleNoteText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    lineHeight: 16,
  },
  combinedEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.lg,
  },
  combinedEstimateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  combinedEstimateIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.points,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldenIconBadge: {
    backgroundColor: '#F59E0B',
  },
  combinedEstimateValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.points,
  },
  combinedEstimateLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  combinedEstimateDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.borderLight,
  },
  combinedEstimateSubtext: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    textAlign: 'center' as const,
    marginBottom: SPACING.sm,
  },
  historicalComparisonSection: {
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  historicalComparisonTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textDarkGrey,
  },
  historicalStatsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  historicalStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  historicalStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.points,
  },
  historicalStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historicalStatNote: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    textAlign: 'center' as const,
    marginTop: SPACING.xs,
    fontStyle: 'italic' as const,
  },
  casinoStatsCard: {
    width: '100%',
  },
  casinoStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  casinoStatsValues: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  casinoStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  casinoStatRowLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
  },
  casinoStatRowValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },

  unbookWarningContainer: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  unbookWarningTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  unbookWarningText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textDarkGrey,
    textAlign: 'center',
    lineHeight: 22,
  },
  unbookWarningBold: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  unbookWarningSubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  unbookConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  unbookConfirmButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  offerCodeCard: {
    backgroundColor: '#FFFBEB',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  offerCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  offerCodeLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  offerCodeValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  compactFactsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  compactFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactFactValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  compactFactLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  factDivider: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.sm,
  },
  fpObcHighlight: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  fpHighlightCard: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
  },
  fpHighlightLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  fpHighlightValue: {
    fontSize: TYPOGRAPHY.fontSizeTitle,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  obcHighlightCard: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignItems: 'center',
  },
  obcHighlightLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  obcHighlightValue: {
    fontSize: TYPOGRAPHY.fontSizeTitle,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  fpObcQuickView: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  fpQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  fpQuickLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  fpQuickValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  obcQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  obcQuickLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  obcQuickValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  bwoFpObcCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    ...SHADOW.sm,
  },
  bwoFpObcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  bwoFpObcTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  bwoFpObcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  bwoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  bwoLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  bwoValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  fpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  fpChipLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  fpChipValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#15803D',
  },
  obcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  obcChipLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  obcChipValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E40AF',
  },
  bwoFpObcPlaceholder: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    paddingVertical: SPACING.sm,
  },
  bwoChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 243, 199, 0.4)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.4)',
    borderStyle: 'dashed',
  },
  bwoLabelEmpty: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(146, 64, 14, 0.5)',
  },
  bwoValueEmpty: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(146, 64, 14, 0.4)',
  },
  fpChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220, 252, 231, 0.4)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.4)',
    borderStyle: 'dashed',
  },
  fpChipLabelEmpty: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(21, 128, 61, 0.5)',
  },
  fpChipValueEmpty: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(21, 128, 61, 0.4)',
  },
  obcChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(219, 234, 254, 0.4)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
    borderStyle: 'dashed',
  },
  obcChipLabelEmpty: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(30, 64, 175, 0.5)',
  },
  obcChipValueEmpty: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(30, 64, 175, 0.4)',
  },
  cruiseDetailsSection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: '#E0F2FE',
    ...SHADOW.sm,
  },
  payloadDetailsSection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: '#FEF3C7',
    ...SHADOW.sm,
  },
  payloadGrid: {
    gap: SPACING.xs,
  },
  payloadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.05)',
  },
  payloadLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    opacity: 0.7,
    flex: 1,
  },
  payloadValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    flex: 1,
    textAlign: 'right' as const,
  },
  detailsGrid: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.sm,
  },
  detailRowLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  detailRowValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
