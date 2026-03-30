import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, ArrowLeft, Save, Ship, Trash2, X } from 'lucide-react-native';
import type { BookedCruise, CasinoOffer } from '@/types/models';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, DS } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { createDateFromString, getDaysUntil } from '@/lib/date';
import { useAppState } from '@/state/AppStateProvider';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { DEFAULT_PLAYING_HOURS, useUser } from '@/state/UserProvider';
import { calculatePersonalizedPlayEstimate, getResolvedCruiseItinerary, type PersonalizedPlayEstimate, type PlayingHoursConfig } from '@/lib/casinoAvailability';
import { DEFAULT_CRUISE_IMAGE, getUniqueImageForCruise } from '@/constants/cruiseImages';
import { CruiseDetailsOverview } from '@/components/cruise/CruiseDetailsOverview';

const PAGE_MARBLE_COLORS = ['#FCFEFF', '#EEF7FF', '#DDEEFF', '#CAE3F8'] as const;
const PAGE_MARBLE_VEIN_COLORS = ['rgba(255,255,255,0.98)', 'rgba(188,216,241,0.3)', 'rgba(255,255,255,0.18)', 'rgba(142,182,221,0.24)'] as const;
const PAGE_MARBLE_LOCATIONS = [0, 0.22, 0.72, 1] as const;

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
  singleOccupancy: boolean;
  winnings: string;
  earnedPoints: string;
  amountPaid: string;
  tradeInValue: string;
  nextCruiseCertificate: string;
}

function createEmptyEditForm(): EditFormData {
  return {
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
    singleOccupancy: true,
    winnings: '',
    earnedPoints: '',
    amountPaid: '',
    tradeInValue: '',
    nextCruiseCertificate: '',
  };
}

export default function CruiseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { localData } = useAppState();
  const { getCruiseValueBreakdown, getCruiseCasinoAvailability } = useSimpleAnalytics();
  const {
    bookedCruises: storeBookedCruises,
    cruises: storeCruises,
    casinoOffers: storeOffers,
    updateBookedCruise: updateCruiseInStore,
    updateCruise: updateCruiseInCruisesStore,
    removeBookedCruise,
    addBookedCruise,
  } = useCoreData();
  const { currentUser } = useUser();

  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [fullEditModalVisible, setFullEditModalVisible] = useState<boolean>(false);
  const [unbookModalVisible, setUnbookModalVisible] = useState<boolean>(false);
  const [editWinnings, setEditWinnings] = useState<string>('');
  const [editPoints, setEditPoints] = useState<string>('');
  const [heroImageUri, setHeroImageUri] = useState<string>(DEFAULT_CRUISE_IMAGE);
  const [editForm, setEditForm] = useState<EditFormData>(createEmptyEditForm());

  const playingHoursConfig: PlayingHoursConfig = useMemo(() => {
    const userPlayingHours = currentUser?.playingHours || DEFAULT_PLAYING_HOURS;

    return {
      enabled: userPlayingHours.enabled,
      sessions: userPlayingHours.sessions,
    };
  }, [currentUser?.playingHours]);

  const updateCruise = (updatedCruise: BookedCruise & Record<string, unknown>) => {
    console.log('[CruiseDetails] Updating cruise record', {
      cruiseId: updatedCruise.id,
      sailDate: updatedCruise.sailDate,
      returnDate: updatedCruise.returnDate,
      earnedPoints: updatedCruise.earnedPoints,
      winnings: updatedCruise.winnings,
    });

    updateCruiseInStore(updatedCruise.id, updatedCruise);

    const existsInCruises = (storeCruises || []).some((item) => item.id === updatedCruise.id);
    if (existsInCruises) {
      updateCruiseInCruisesStore(updatedCruise.id, updatedCruise);
    }
  };

  const cruise = useMemo(() => {
    const allCruises = [
      ...(storeBookedCruises || []),
      ...(storeCruises || []),
      ...(localData.booked || []),
      ...(localData.cruises || []),
    ];

    let found = allCruises.find((item) => item.id === id);

    if (found && found.offerCode) {
      const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
      const linkedOffer = allOffers.find((offer) => (
        offer.offerCode === found?.offerCode
        || offer.id === found?.offerCode
        || offer.cruiseId === found?.id
      ));

      if (linkedOffer) {
        const needsPricing = !found.interiorPrice && !found.oceanviewPrice && !found.balconyPrice && !found.suitePrice;
        if (needsPricing) {
          console.log('[CruiseDetails] Enriching cruise pricing from linked offer', {
            cruiseId: found.id,
            offerCode: linkedOffer.offerCode,
          });

          found = {
            ...found,
            interiorPrice: found.interiorPrice || linkedOffer.interiorPrice,
            oceanviewPrice: found.oceanviewPrice || linkedOffer.oceanviewPrice,
            balconyPrice: found.balconyPrice || linkedOffer.balconyPrice,
            suitePrice: found.suitePrice || linkedOffer.suitePrice,
            taxes: found.taxes || linkedOffer.taxesFees,
            portsAndTimes: found.portsAndTimes || linkedOffer.portsAndTimes,
            ports: found.ports || linkedOffer.ports,
          };
        }
      }
    }

    console.log('[CruiseDetails] Located cruise', {
      cruiseId: found?.id,
      shipName: found?.shipName,
      offerCode: found?.offerCode,
    });

    return found;
  }, [id, localData.booked, localData.cruises, localData.offers, storeBookedCruises, storeCruises, storeOffers]);

  useEffect(() => {
    if (!cruise) {
      return;
    }

    const imageUrl = getUniqueImageForCruise(
      cruise.id,
      cruise.destination || cruise.itineraryName || '',
      cruise.sailDate,
      cruise.shipName,
    );

    setHeroImageUri(imageUrl || DEFAULT_CRUISE_IMAGE);
  }, [cruise]);

  const linkedOffer = useMemo((): CasinoOffer | undefined => {
    if (!cruise?.offerCode) {
      return undefined;
    }

    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];

    return allOffers.find((offer) => (
      offer.offerCode === cruise.offerCode
      || offer.id === cruise.offerCode
      || offer.cruiseId === cruise.id
    ));
  }, [cruise, localData.offers, storeOffers]);

  const accurateNights = useMemo(() => {
    if (!cruise) {
      return 0;
    }

    const bookedCruise = cruise as BookedCruise;
    if (cruise.sailDate && bookedCruise.returnDate) {
      try {
        const sailDate = createDateFromString(cruise.sailDate);
        const returnDate = createDateFromString(bookedCruise.returnDate);
        const diffDays = Math.round((returnDate.getTime() - sailDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
          return diffDays;
        }
      } catch (error) {
        console.log('[CruiseDetails] Failed to calculate nights from dates', error);
      }
    }

    return cruise.nights || 0;
  }, [cruise]);

  const cruiseDetails = useMemo(() => {
    if (!cruise) {
      return null;
    }

    const retailPrice = cruise.retailValue || cruise.originalPrice || 0;
    const displayPrice = cruise.balconyPrice || cruise.oceanviewPrice || cruise.interiorPrice || cruise.price || 0;
    const daysUntil = getDaysUntil(cruise.sailDate);
    const hasPerks = !!(
      cruise.freeOBC
      || cruise.freeGratuities
      || cruise.freeDrinkPackage
      || cruise.freeWifi
      || cruise.freeSpecialtyDining
    );
    const isBooked = 'reservationNumber' in cruise || 'bookingId' in cruise;

    return {
      displayPrice,
      retailPrice,
      daysUntil,
      hasPerks,
      isBooked,
    };
  }, [cruise]);

  const valueBreakdown = useMemo(() => {
    if (!cruise) {
      return null;
    }

    return getCruiseValueBreakdown(cruise);
  }, [cruise, getCruiseValueBreakdown]);

  const casinoAvailability = useMemo(() => {
    if (!cruise) {
      return null;
    }

    return getCruiseCasinoAvailability(cruise);
  }, [cruise, getCruiseCasinoAvailability]);

  const itineraryDays = useMemo(() => {
    if (!cruise) {
      return [];
    }

    return getResolvedCruiseItinerary(cruise, [...(storeOffers || []), ...(localData.offers || [])]);
  }, [cruise, localData.offers, storeOffers]);

  const personalizedPlayEstimate = useMemo((): PersonalizedPlayEstimate | null => {
    if (!casinoAvailability) {
      return null;
    }

    return calculatePersonalizedPlayEstimate(casinoAvailability, playingHoursConfig);
  }, [casinoAvailability, playingHoursConfig]);

  const openFullEditModal = () => {
    if (!cruise) {
      return;
    }

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
      bwoNumber: String((cruise as BookedCruise & { bwoNumber?: string }).bwoNumber || ''),
      freeOBC: String(cruise.freeOBC || linkedOffer?.OBC || linkedOffer?.obcAmount || ''),
      freePlay: String(cruise.freePlay || linkedOffer?.freePlay || linkedOffer?.freeplayAmount || ''),
      freeGratuities: cruise.freeGratuities || false,
      freeDrinkPackage: cruise.freeDrinkPackage || false,
      freeWifi: cruise.freeWifi || false,
      freeSpecialtyDining: cruise.freeSpecialtyDining || false,
      singleOccupancy: (cruise as BookedCruise & { singleOccupancy?: boolean }).singleOccupancy !== false,
      winnings: String((cruise as BookedCruise & { winnings?: number }).winnings || ''),
      earnedPoints: String((cruise as BookedCruise & { earnedPoints?: number; casinoPoints?: number }).earnedPoints || (cruise as BookedCruise & { earnedPoints?: number; casinoPoints?: number }).casinoPoints || ''),
      amountPaid: String(cruise.totalPrice || cruise.price || ''),
      tradeInValue: String(cruise.tradeInValue || linkedOffer?.tradeInValue || ''),
      nextCruiseCertificate: String((cruise as BookedCruise & { nextCruiseCertificate?: number }).nextCruiseCertificate || ''),
    });

    setFullEditModalVisible(true);
  };

  const saveFullEdit = () => {
    if (!cruise) {
      return;
    }

    const newNights = parseInt(editForm.nights, 10) || cruise.nights;
    const newSailDate = editForm.sailDate || cruise.sailDate;
    let newReturnDate = (cruise as BookedCruise).returnDate;

    if (newSailDate !== cruise.sailDate || newNights !== cruise.nights) {
      try {
        const sailDate = createDateFromString(newSailDate);
        const returnDate = new Date(sailDate);
        returnDate.setDate(returnDate.getDate() + newNights);
        const mm = String(returnDate.getMonth() + 1).padStart(2, '0');
        const dd = String(returnDate.getDate()).padStart(2, '0');
        const yyyy = String(returnDate.getFullYear());
        newReturnDate = `${mm}-${dd}-${yyyy}`;
      } catch (error) {
        console.log('[CruiseDetails] Failed to recalculate return date', error);
      }
    }

    const updatedCruise = {
      ...cruise,
      shipName: editForm.shipName || cruise.shipName,
      departurePort: editForm.departurePort || cruise.departurePort,
      destination: editForm.destination || cruise.destination,
      itineraryName: editForm.destination || cruise.itineraryName,
      nights: newNights,
      sailDate: newSailDate,
      returnDate: newReturnDate,
      cabinType: editForm.cabinType || cruise.cabinType,
      guests: parseInt(editForm.guests, 10) || cruise.guests || 2,
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
      singleOccupancy: editForm.singleOccupancy,
      freePlay: parseFloat(editForm.freePlay) || 0,
      winnings: parseFloat(editForm.winnings) || 0,
      earnedPoints: parseFloat(editForm.earnedPoints) || 0,
      casinoPoints: parseFloat(editForm.earnedPoints) || 0,
      totalPrice: parseFloat(editForm.amountPaid) || 0,
      price: parseFloat(editForm.amountPaid) || 0,
      tradeInValue: parseFloat(editForm.tradeInValue) || 0,
      nextCruiseCertificate: parseFloat(editForm.nextCruiseCertificate) || 0,
    };

    console.log('[CruiseDetails] Saving full edit', {
      cruiseId: updatedCruise.id,
      shipName: updatedCruise.shipName,
    });

    updateCruise(updatedCruise);
    setFullEditModalVisible(false);
  };

  const handleBookCruise = () => {
    if (!cruise) {
      return;
    }

    const bookedCruise: BookedCruise = {
      ...cruise,
      id: cruise.id || `booked-${Date.now()}`,
      bookingId: `booking-${Date.now()}`,
      reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
      status: 'booked',
      earnedPoints: 0,
      casinoPoints: 0,
      winnings: 0,
    };

    console.log('[CruiseDetails] Booking cruise', {
      cruiseId: bookedCruise.id,
      shipName: bookedCruise.shipName,
    });

    addBookedCruise(bookedCruise);
    router.back();
  };

  const openCasinoEditModal = () => {
    if (!cruise) {
      return;
    }

    const bookedCruise = cruise as BookedCruise & { winnings?: number; earnedPoints?: number; casinoPoints?: number };
    setEditWinnings(String(bookedCruise.winnings || 0));
    setEditPoints(String(bookedCruise.earnedPoints || bookedCruise.casinoPoints || 0));
    setEditModalVisible(true);
  };

  if (!cruise || !cruiseDetails) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={PAGE_MARBLE_COLORS}
          locations={PAGE_MARBLE_LOCATIONS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={PAGE_MARBLE_VEIN_COLORS}
          locations={PAGE_MARBLE_LOCATIONS}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.88, y: 1 }}
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
      <LinearGradient
        colors={PAGE_MARBLE_COLORS}
        locations={PAGE_MARBLE_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={PAGE_MARBLE_VEIN_COLORS}
        locations={PAGE_MARBLE_LOCATIONS}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <CruiseDetailsOverview
          cruise={cruise}
          linkedOffer={linkedOffer}
          heroImageUri={heroImageUri}
          accurateNights={accurateNights}
          daysUntil={daysUntil}
          isBooked={isBooked}
          hasPerks={hasPerks}
          valueBreakdown={valueBreakdown}
          casinoAvailability={casinoAvailability}
          personalizedPlayEstimate={personalizedPlayEstimate}
          itineraryDays={itineraryDays}
          onEditPress={openFullEditModal}
          onBookPress={handleBookCruise}
          onUnbookPress={() => setUnbookModalVisible(true)}
          onEditCasinoPress={openCasinoEditModal}
        />
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
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseButton}>
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
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  console.log('[CruiseDetails] Saving casino stats');
                  const winningsValue = parseFloat(editWinnings) || 0;
                  const pointsValue = parseFloat(editPoints) || 0;

                  updateCruise({
                    ...(cruise as BookedCruise & Record<string, unknown>),
                    winnings: winningsValue,
                    earnedPoints: pointsValue,
                    casinoPoints: pointsValue,
                  });

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
              <TouchableOpacity onPress={() => setFullEditModalVisible(false)} style={styles.modalCloseButton}>
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
                  onChangeText={(value) => setEditForm((prev) => ({ ...prev, shipName: value }))}
                  placeholder="Ship name"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Destination / Itinerary</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.destination}
                  onChangeText={(value) => setEditForm((prev) => ({ ...prev, destination: value }))}
                  placeholder="Destination"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Departure Port</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.departurePort}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, departurePort: value }))}
                    placeholder="Port"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Nights</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.nights}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, nights: value }))}
                    keyboardType="numeric"
                    placeholder="# Nights"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Sail Date (MM-DD-YYYY)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.sailDate}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, sailDate: value }))}
                    placeholder="04-02-2026"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Guests</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.guests}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, guests: value }))}
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
                  onChangeText={(value) => setEditForm((prev) => ({ ...prev, cabinType: value }))}
                  placeholder="Balcony, Suite, etc."
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <Text style={styles.sectionLabel}>Pricing</Text>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Interior ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.interiorPrice}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, interiorPrice: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Ocean View ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.oceanviewPrice}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, oceanviewPrice: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Balcony ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.balconyPrice}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, balconyPrice: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Suite ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.suitePrice}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, suitePrice: value }))}
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
                  onChangeText={(value) => setEditForm((prev) => ({ ...prev, taxes: value }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <Text style={styles.sectionLabel}>Casino Offer Details</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BWO#</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.bwoNumber}
                  onChangeText={(value) => setEditForm((prev) => ({ ...prev, bwoNumber: value }))}
                  placeholder="e.g. 2501A01"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>FreePlay ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.freePlay}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, freePlay: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>OBC ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.freeOBC}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, freeOBC: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Trade-In Value ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.tradeInValue}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, tradeInValue: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Next Cruise Cert ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.nextCruiseCertificate}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, nextCruiseCertificate: value }))}
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
                  onChangeText={(value) => setEditForm((prev) => ({ ...prev, amountPaid: value }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={[styles.switchRow, styles.switchRowHighlighted]}>
                <View style={styles.switchCopyWrap}>
                  <Text style={styles.switchLabel}>Solo Sailing</Text>
                  <Text style={styles.switchHelpText}>
                    {editForm.singleOccupancy ? 'Earns +1 bonus C&A point/night' : 'Base 1 C&A point/night'}
                  </Text>
                </View>
                <Switch
                  value={editForm.singleOccupancy}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, singleOccupancy: value }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#3B82F6' }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Gratuities</Text>
                <Switch
                  value={editForm.freeGratuities}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, freeGratuities: value }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Drink Package</Text>
                <Switch
                  value={editForm.freeDrinkPackage}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, freeDrinkPackage: value }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free WiFi</Text>
                <Switch
                  value={editForm.freeWifi}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, freeWifi: value }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Specialty Dining</Text>
                <Switch
                  value={editForm.freeSpecialtyDining}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, freeSpecialtyDining: value }))}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.success }}
                  thumbColor={COLORS.white}
                />
              </View>

              <Text style={styles.sectionLabel}>Casino Stats</Text>

              <View style={styles.inputRow}>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Won/Loss ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.winnings}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, winnings: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.rowInputGroup}>
                  <Text style={styles.inputLabel}>Points Earned</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.earnedPoints}
                    onChangeText={(value) => setEditForm((prev) => ({ ...prev, earnedPoints: value }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.modalSpacer} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setFullEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={saveFullEdit}>
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
              <TouchableOpacity onPress={() => setUnbookModalVisible(false)} style={styles.modalCloseButton}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.unbookWarningContainer}>
                <AlertCircle size={48} color={COLORS.error} />
                <Text style={styles.unbookWarningTitle}>Are you sure?</Text>
                <Text style={styles.unbookWarningText}>
                  This will remove <Text style={styles.unbookWarningBold}>{cruise.shipName}</Text> ({formatDate(cruise.sailDate || '', 'medium')}) from your booked cruises.
                </Text>
                <Text style={styles.unbookWarningSubtext}>This action cannot be undone.</Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setUnbookModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.unbookConfirmButton}
                onPress={() => {
                  if (cruise.id) {
                    console.log('[CruiseDetails] Unbooking cruise', { cruiseId: cruise.id });
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
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 120,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  notFoundTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: DS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  notFoundText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: DS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: DS.text.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 18, 32, 0.48)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 18, 32, 0.42)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.lg,
  },
  fullModalContent: {
    maxHeight: '90%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  modalBody: {
    gap: SPACING.md,
  },
  fullModalBody: {
    flexGrow: 0,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(17,24,39,0.06)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.navyDeep,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.9)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.navyDeep,
    backgroundColor: 'rgba(246,250,255,0.88)',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  rowInputGroup: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(197,213,228,0.9)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(246,250,255,0.88)',
  },
  switchRowHighlighted: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.18)',
  },
  switchCopyWrap: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  switchHelpText: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  modalSpacer: {
    height: SPACING.xl,
  },
  unbookWarningContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  unbookWarningTitle: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    fontSize: 22,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  unbookWarningText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  unbookWarningBold: {
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  unbookWarningSubtext: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '700' as const,
  },
  unbookConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.error,
  },
  unbookConfirmButtonText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
});
