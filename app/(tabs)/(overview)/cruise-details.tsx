import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ItineraryDay, BookedCruise, CasinoOffer } from '@/types/models';
import { Ship, Calendar, MapPin, Clock, DollarSign, Gift, Star, Users, Anchor, Tag, ArrowLeft, Edit3, X, Save, TrendingUp, Dice5, AlertCircle, CheckCircle, Award, Ticket, Target, CreditCard, Trash2, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatCurrency, formatNights } from '@/lib/format';
import { formatDate, getDaysUntil } from '@/lib/date';
import { useAppState } from '@/state/AppStateProvider';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { getCasinoStatusBadge, calculatePersonalizedPlayEstimate, PLAYER_SCHEDULE, PersonalizedPlayEstimate, PlayingHoursConfig } from '@/lib/casinoAvailability';
import { getUniqueImageForCruise, DEFAULT_CRUISE_IMAGE } from '@/constants/cruiseImages';

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
    // Priority: CruiseStore data > localData > BOOKED_CRUISES_DATA mock
    // CruiseStore has enriched itinerary data from enrichCruisesWithMockItineraries
    const allCruises = [
      ...(storeCruises || []),
      ...(storeBookedCruises || []),
      ...(localData.cruises || []),
      ...(localData.booked || []),
    ];
    
    let found = allCruises.find(c => c.id === id);
    
    // If cruise found but missing itinerary, try to enrich from mock data
    if (found && (!found.itinerary || found.itinerary.length === 0)) {
      const mockMatch = BOOKED_CRUISES_DATA.find(mc => 
        mc.id === found!.id || 
        mc.reservationNumber === (found as any).reservationNumber ||
        (mc.shipName === found!.shipName && mc.sailDate === found!.sailDate)
      );
      
      if (mockMatch?.itinerary && mockMatch.itinerary.length > 0) {
        console.log('[CruiseDetails] Enriching cruise with mock itinerary:', mockMatch.id);
        found = {
          ...found,
          itinerary: mockMatch.itinerary,
          seaDays: mockMatch.seaDays,
          portDays: mockMatch.portDays,
          casinoOpenDays: mockMatch.casinoOpenDays,
          ports: mockMatch.ports,
        };
      }
    }
    
    // If still not found, check mock data directly
    if (!found) {
      found = BOOKED_CRUISES_DATA.find(c => c.id === id);
    }
    
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

  useMemo((): { days: { day: number; port: string; isSeaDay: boolean }[]; needsManualEntry: boolean; source: string } => {
    if (!cruise) return { days: [], needsManualEntry: true, source: 'none' };
    
    const totalDays = (cruise.nights || 7) + 1;
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
  }, [cruise, linkedOffer, storeOffers, localData.offers]);

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
      freeOBC: String(cruise.freeOBC || ''),
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

  const { displayPrice, daysUntil, savings, hasPerks, isBooked } = cruiseDetails;

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
          <TouchableOpacity 
            style={styles.editAllButton} 
            onPress={openFullEditModal}
            activeOpacity={0.7}
          >
            <Edit3 size={18} color={COLORS.beigeWarm} />
            <Text style={styles.editAllButtonText}>Edit</Text>
          </TouchableOpacity>
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

          <View style={styles.compactInfoCard}>
            <View style={styles.infoGrid}>
              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>Sail Date</Text>
                <Text style={styles.infoGridValue}>{formatDate(cruise.sailDate, 'short')}</Text>
              </View>
              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>Duration</Text>
                <Text style={styles.infoGridValue}>{cruise.nights}N</Text>
              </View>
              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>Departs</Text>
                <Text style={styles.infoGridValue} numberOfLines={1}>{cruise.departurePort || 'TBD'}</Text>
              </View>
              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>Guests</Text>
                <Text style={styles.infoGridValue}>{cruise.guests || 2}</Text>
              </View>
              {cruise.cabinType && (
                <View style={styles.infoGridItem}>
                  <Text style={styles.infoGridLabel}>Cabin</Text>
                  <Text style={styles.infoGridValue} numberOfLines={1}>{cruise.cabinType}</Text>
                </View>
              )}
            </View>
          </View>

          {(cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice) && (
            <View style={styles.compactPriceCard}>
              <View style={styles.pricingRow}>
                {cruise.interiorPrice && cruise.interiorPrice > 0 && (
                  <View style={styles.pricingCol}>
                    <Text style={styles.pricingLabel}>INT</Text>
                    <Text style={styles.pricingValue}>{formatCurrency(cruise.interiorPrice)}</Text>
                  </View>
                )}
                {cruise.oceanviewPrice && cruise.oceanviewPrice > 0 && (
                  <View style={styles.pricingCol}>
                    <Text style={styles.pricingLabel}>OV</Text>
                    <Text style={styles.pricingValue}>{formatCurrency(cruise.oceanviewPrice)}</Text>
                  </View>
                )}
                {cruise.balconyPrice && cruise.balconyPrice > 0 && (
                  <View style={styles.pricingCol}>
                    <Text style={styles.pricingLabel}>BAL</Text>
                    <Text style={styles.pricingValue}>{formatCurrency(cruise.balconyPrice)}</Text>
                  </View>
                )}
                {cruise.suitePrice && cruise.suitePrice > 0 && (
                  <View style={styles.pricingCol}>
                    <Text style={styles.pricingLabel}>STE</Text>
                    <Text style={styles.pricingValue}>{formatCurrency(cruise.suitePrice)}</Text>
                  </View>
                )}
                {cruise.taxes && cruise.taxes > 0 && (
                  <View style={styles.pricingCol}>
                    <Text style={styles.pricingLabel}>Tax</Text>
                    <Text style={styles.pricingValue}>{formatCurrency(cruise.taxes)}</Text>
                  </View>
                )}
              </View>
            </View>
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

          {casinoAvailability && (
            <View style={styles.casinoSection}>
              <View style={styles.sectionHeader}>
                <Dice5 size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Casino Availability</Text>
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
                    <Text style={styles.expectedPointsTitle}>Your Play Schedule Estimate</Text>
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
                  <Text style={styles.combinedEstimateSubtext}>
                    {personalizedPlayEstimate.playDays} play days • {PLAYER_SCHEDULE.POINTS_PER_SESSION}/session • {playingHoursConfig.sessions.filter(s => s.enabled).length} enabled sessions
                  </Text>
                  <View style={styles.playScheduleBreakdown}>
                    {personalizedPlayEstimate.sessionBreakdown
                      .filter(d => d.casinoOpen && d.sessions > 0)
                      .map((dayEstimate, idx) => (
                        <View key={idx} style={styles.playDayRow}>
                          <View style={styles.playDayInfo}>
                            <Text style={styles.playDayLabel}>Day {dayEstimate.day}</Text>
                            <Text style={styles.playDayPort} numberOfLines={1}>
                              {dayEstimate.isSeaDay ? '🌊' : '📍'} {dayEstimate.port}
                            </Text>
                          </View>
                          <View style={styles.playDayStats}>
                            <Text style={styles.playDaySessions}>{dayEstimate.sessions}x</Text>
                            <Text style={styles.playDayHours}>{dayEstimate.hoursPlayed}h</Text>
                            <Text style={styles.playDayPoints}>{dayEstimate.pointsEarned.toLocaleString()}</Text>
                          </View>
                        </View>
                      ))}
                  </View>
                  <View style={styles.playScheduleNote}>
                    <Text style={styles.playScheduleNoteText}>
                      {playingHoursConfig.enabled && personalizedPlayEstimate.goldenHoursTotal > 0
                        ? `Based on your Golden Hours: ${playingHoursConfig.sessions.filter(s => s.enabled).map(s => s.name).join(', ')}`
                        : `Based on default schedule: ${PLAYER_SCHEDULE.SEA_DAY_SESSIONS_COUNT} sessions on sea days, ${PLAYER_SCHEDULE.FIRST_DAY_HOURS}h first day, ${PLAYER_SCHEDULE.LAST_DAY_HOURS}h last day`
                      }
                    </Text>
                  </View>
                </View>
              )}

              {expectedPointsCalculation && (
                <View style={styles.historicalComparisonSection}>
                  <View style={styles.expectedPointsHeader}>
                    <TrendingUp size={16} color={COLORS.textSecondary} />
                    <Text style={styles.historicalComparisonTitle}>Historical Comparison</Text>
                  </View>
                  <View style={styles.expectedPointsBreakdown}>
                    <View style={styles.expectedPointsRow}>
                      <Text style={styles.expectedPointsRowLabel}>Avg per night (past {expectedPointsCalculation.basedOnCruises} cruises):</Text>
                      <Text style={styles.expectedPointsRowValue}>{expectedPointsCalculation.avgPointsPerNight.toLocaleString()} pts</Text>
                    </View>
                    <View style={styles.expectedPointsRow}>
                      <Text style={styles.expectedPointsRowLabel}>Avg per casino day:</Text>
                      <Text style={styles.expectedPointsRowValue}>{expectedPointsCalculation.avgPointsPerCasinoDay.toLocaleString()} pts</Text>
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.casinoDescription}>
                {casinoAvailability.gamblingWindowsDescription}
              </Text>

              <View style={styles.casinoDayList}>
                {casinoAvailability.dailyAvailability.slice(0, 8).map((day, index) => (
                  <View key={index} style={styles.casinoDayItem}>
                    <View style={[styles.casinoDayIndicator, { backgroundColor: day.casinoOpen ? COLORS.success : COLORS.error }]}>
                      {day.casinoOpen ? (
                        <CheckCircle size={12} color={COLORS.white} />
                      ) : (
                        <AlertCircle size={12} color={COLORS.white} />
                      )}
                    </View>
                    <View style={styles.casinoDayContent}>
                      <Text style={styles.casinoDayLabel}>Day {day.day}</Text>
                      <Text style={styles.casinoDayPort} numberOfLines={1}>
                        {day.isSeaDay ? '🌊 At Sea' : `📍 ${day.port}`}
                      </Text>
                    </View>
                    <Text style={[styles.casinoDayStatus, { color: day.casinoOpen ? COLORS.success : COLORS.error }]}>
                      {day.casinoOpen ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                ))}
                {casinoAvailability.dailyAvailability.length > 8 && (
                  <Text style={styles.moreText}>+{casinoAvailability.dailyAvailability.length - 8} more days</Text>
                )}
              </View>
            </View>
          )}

          {valueBreakdown && (
            <View style={styles.valueSection}>
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Value Breakdown</Text>
                <TouchableOpacity
                  style={styles.editValueButton}
                  onPress={openFullEditModal}
                >
                  <Edit3 size={14} color={COLORS.beigeWarm} />
                </TouchableOpacity>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Cabin Value (×{cruise.guests || 2} guests)</Text>
                <Text style={styles.valueAmount}>{formatCurrency(valueBreakdown.cabinValueForTwo)}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Taxes & Fees</Text>
                <Text style={styles.valueAmount}>{formatCurrency(valueBreakdown.taxesFees)}</Text>
              </View>
              
              {(valueBreakdown.freePlayValue > 0 || cruise.freePlay || linkedOffer?.freePlay) && (
                <View style={styles.valueRow}>
                  <View style={styles.valueLabelWithIcon}>
                    <Ticket size={12} color={COLORS.success} />
                    <Text style={styles.valueLabel}>FreePlay (FPP)</Text>
                  </View>
                  <Text style={[styles.valueAmount, { color: COLORS.success }]}>
                    +{formatCurrency(valueBreakdown.freePlayValue || cruise.freePlay || linkedOffer?.freePlay || linkedOffer?.freeplayAmount || 0)}
                  </Text>
                </View>
              )}
              {(valueBreakdown.obcValue > 0 || cruise.freeOBC) && (
                <View style={styles.valueRow}>
                  <View style={styles.valueLabelWithIcon}>
                    <CreditCard size={12} color={COLORS.success} />
                    <Text style={styles.valueLabel}>Onboard Credit (OBC)</Text>
                  </View>
                  <Text style={[styles.valueAmount, { color: COLORS.success }]}>
                    +{formatCurrency(valueBreakdown.obcValue || cruise.freeOBC || 0)}
                  </Text>
                </View>
              )}
              {(valueBreakdown.tradeInValue > 0 || cruise.tradeInValue || linkedOffer?.tradeInValue) && (
                <View style={styles.valueRow}>
                  <View style={styles.valueLabelWithIcon}>
                    <Award size={12} color={COLORS.success} />
                    <Text style={styles.valueLabel}>Trade-In Value</Text>
                  </View>
                  <Text style={[styles.valueAmount, { color: COLORS.success }]}>
                    +{formatCurrency(valueBreakdown.tradeInValue || cruise.tradeInValue || linkedOffer?.tradeInValue || 0)}
                  </Text>
                </View>
              )}
              {(cruise.offerValue || linkedOffer?.offerValue) && cruise.offerValue! > 0 && (
                <View style={styles.valueRow}>
                  <View style={styles.valueLabelWithIcon}>
                    <Tag size={12} color={COLORS.beigeWarm} />
                    <Text style={styles.valueLabel}>Offer Value</Text>
                  </View>
                  <Text style={[styles.valueAmount, { color: COLORS.beigeWarm }]}>
                    {formatCurrency(cruise.offerValue || linkedOffer?.offerValue || 0)}
                  </Text>
                </View>
              )}
              {((cruise as any).nextCruiseCertificate > 0) && (
                <View style={styles.valueRow}>
                  <View style={styles.valueLabelWithIcon}>
                    <Star size={12} color={COLORS.success} />
                    <Text style={styles.valueLabel}>Next Cruise Certificate</Text>
                  </View>
                  <Text style={[styles.valueAmount, { color: COLORS.success }]}>
                    +{formatCurrency((cruise as any).nextCruiseCertificate || 0)}
                  </Text>
                </View>
              )}
              
              <View style={styles.valueDivider} />
              <View style={styles.valueRow}>
                <Text style={styles.valueTotalLabel}>Total Retail Value</Text>
                <Text style={styles.valueTotalAmount}>{formatCurrency(valueBreakdown.totalRetailValue)}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.amountPaidRow}
                onPress={openFullEditModal}
                activeOpacity={0.7}
              >
                <View style={styles.amountPaidLabel}>
                  <Text style={styles.valueLabel}>Amount Paid</Text>
                  <Edit3 size={12} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.valueAmount}>{formatCurrency(valueBreakdown.amountPaid)}</Text>
              </TouchableOpacity>
              
              <View style={[styles.valueRow, styles.netValueRow]}>
                <Text style={styles.netValueLabel}>Net Value</Text>
                <Text style={[styles.netValueAmount, { color: valueBreakdown.netValue >= 0 ? COLORS.success : COLORS.error }]}>
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
              
              {linkedOffer && (
                <View style={styles.linkedOfferInfo}>
                  <Text style={styles.linkedOfferLabel}>From Offer: {linkedOffer.offerCode || linkedOffer.title}</Text>
                </View>
              )}
            </View>
          )}

          {casinoAvailability && casinoAvailability.dailyAvailability.length > 0 && (
            <View style={styles.itinerarySection}>
              <View style={styles.sectionHeader}>
                <MapPin size={20} color={COLORS.beigeWarm} />
                <Text style={styles.sectionTitle}>Itinerary</Text>
              </View>
              
              <View style={styles.itineraryList}>
                {casinoAvailability.dailyAvailability.map((day, index) => (
                  <View key={index} style={styles.itineraryItem}>
                    <View style={[styles.itineraryDot, day.isSeaDay && styles.seaDayDot]} />
                    {index < casinoAvailability.dailyAvailability.length - 1 && <View style={styles.itineraryLine} />}
                    <View style={styles.itineraryContent}>
                      <Text style={styles.itineraryDay}>Day {day.day}</Text>
                      <Text style={styles.itineraryPort}>
                        {day.isSeaDay ? '\ud83c\udf0a ' : '\ud83d\udccd '}{day.port}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

{!isBooked && (
            <TouchableOpacity 
              style={styles.bookButton} 
              activeOpacity={0.8}
              onPress={handleBookCruise}
              testID="book-cruise-button"
            >
              <LinearGradient
                colors={[COLORS.beigeWarm, COLORS.goldDark]}
                style={styles.bookButtonGradient}
              >
                <Text style={styles.bookButtonText}>Book This Cruise</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isBooked && (
            <TouchableOpacity 
              style={styles.unbookButton} 
              activeOpacity={0.8}
              onPress={() => setUnbookModalVisible(true)}
              testID="unbook-cruise-button"
            >
              <Trash2 size={20} color={COLORS.error} />
              <Text style={styles.unbookButtonText}>Unbook This Cruise</Text>
            </TouchableOpacity>
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
                  <Text style={styles.inputLabel}>Sail Date (YYYY-MM-DD)</Text>
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

              <Text style={styles.sectionLabel}>Perks & Offers</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Onboard Credit ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.freeOBC}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, freeOBC: val }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FreePlay / FPP ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.freePlay}
                  onChangeText={(val) => setEditForm(prev => ({ ...prev, freePlay: val }))}
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
  editAllButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
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
  compactInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.08)',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  infoGridItem: {
    minWidth: '30%',
    flex: 1,
  },
  infoGridLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  infoGridValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
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
  itinerarySection: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: '#E0F2FE',
    ...SHADOW.sm,
  },
  itineraryList: {
    gap: 0,
  },
  itineraryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  itineraryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.beigeWarm,
    marginTop: 4,
    zIndex: 1,
  },
  seaDayDot: {
    backgroundColor: '#3b82f6',
  },
  itineraryLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -16,
    width: 2,
    backgroundColor: COLORS.cardBorder,
  },
  itineraryContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  itineraryDay: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  itineraryPort: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  bookButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  bookButtonGradient: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
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
  unbookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.error,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginTop: SPACING.lg,
  },
  unbookButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.error,
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
});
