import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react-native';
import {
  PremiumActionBar,
  PremiumDataSection,
  PremiumEmptyState,
  PremiumEntityCard,
  PremiumHeroCard,
  PremiumPageBackground,
  PremiumQuickFacts,
  PremiumStatGrid,
} from '../../../components/cruise/UnifiedCruiseSystem';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import { formatDate, getDaysUntil } from '@/lib/date';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import {
  buildDataSections,
  buildOfferCardFields,
  getCruiseBadge,
  pickCruiseImage,
  mergeCruiseWithOffer,
  type DataSection,
  type DisplayField,
} from '../../../lib/cruisePresentation';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

interface EditFormState {
  shipName: string;
  sailDate: string;
  returnDate: string;
  departurePort: string;
  destination: string;
  itineraryName: string;
  nights: string;
  cabinType: string;
  guests: string;
  interiorPrice: string;
  oceanviewPrice: string;
  balconyPrice: string;
  suitePrice: string;
  taxes: string;
  freePlay: string;
  freeOBC: string;
  tradeInValue: string;
  earnedPoints: string;
  winnings: string;
  bookingId: string;
  reservationNumber: string;
  notes: string;
}

function createEditForm(cruise: Cruise | BookedCruise): EditFormState {
  const bookedCruise = cruise as BookedCruise;
  return {
    shipName: cruise.shipName || '',
    sailDate: cruise.sailDate || '',
    returnDate: cruise.returnDate || '',
    departurePort: cruise.departurePort || '',
    destination: cruise.destination || '',
    itineraryName: cruise.itineraryName || '',
    nights: `${cruise.nights || 0}`,
    cabinType: cruise.cabinType || '',
    guests: `${cruise.guests || 2}`,
    interiorPrice: `${cruise.interiorPrice || ''}`,
    oceanviewPrice: `${cruise.oceanviewPrice || ''}`,
    balconyPrice: `${cruise.balconyPrice || ''}`,
    suitePrice: `${cruise.suitePrice || ''}`,
    taxes: `${cruise.taxes || ''}`,
    freePlay: `${cruise.freePlay || ''}`,
    freeOBC: `${cruise.freeOBC || ''}`,
    tradeInValue: `${cruise.tradeInValue || ''}`,
    earnedPoints: `${bookedCruise.earnedPoints || bookedCruise.casinoPoints || ''}`,
    winnings: `${bookedCruise.winnings || bookedCruise.netResult || ''}`,
    bookingId: bookedCruise.bookingId || '',
    reservationNumber: bookedCruise.reservationNumber || '',
    notes: cruise.notes || '',
  };
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function CruiseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { localData } = useAppState();
  const {
    bookedCruises: storeBookedCruises,
    cruises: storeCruises,
    casinoOffers: storeOffers,
    updateBookedCruise,
    updateCruise,
    removeBookedCruise,
    addBookedCruise,
  } = useCoreData();

  const [editVisible, setEditVisible] = useState<boolean>(false);
  const [unbookVisible, setUnbookVisible] = useState<boolean>(false);
  const [form, setForm] = useState<EditFormState>({
    shipName: '',
    sailDate: '',
    returnDate: '',
    departurePort: '',
    destination: '',
    itineraryName: '',
    nights: '',
    cabinType: '',
    guests: '',
    interiorPrice: '',
    oceanviewPrice: '',
    balconyPrice: '',
    suitePrice: '',
    taxes: '',
    freePlay: '',
    freeOBC: '',
    tradeInValue: '',
    earnedPoints: '',
    winnings: '',
    bookingId: '',
    reservationNumber: '',
    notes: '',
  });

  const cruise = useMemo<Cruise | BookedCruise | undefined>(() => {
    const allCruises = [
      ...(storeBookedCruises || []),
      ...(storeCruises || []),
      ...(localData.booked || []),
      ...(localData.cruises || []),
    ];
    return allCruises.find((entry) => entry.id === id);
  }, [id, localData.booked, localData.cruises, storeBookedCruises, storeCruises]);

  const linkedOffer = useMemo<CasinoOffer | undefined>(() => {
    if (!cruise) return undefined;
    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
    return allOffers.find((offer) => (
      (cruise.offerCode && offer.offerCode === cruise.offerCode) ||
      offer.cruiseId === cruise.id ||
      offer.cruiseIds?.includes(cruise.id)
    ));
  }, [cruise, localData.offers, storeOffers]);

  const mergedCruise = useMemo(() => (cruise ? mergeCruiseWithOffer(cruise, linkedOffer) : undefined), [cruise, linkedOffer]);
  const isBooked = useMemo<boolean>(() => {
    if (!cruise) return false;
    const bookedCruise = cruise as BookedCruise;
    return Boolean(bookedCruise.bookingId || bookedCruise.reservationNumber || cruise.status === 'booked');
  }, [cruise]);

  useEffect(() => {
    if (cruise) {
      setForm(createEditForm(cruise));
    }
  }, [cruise]);

  const valueBreakdown = useMemo(() => (mergedCruise ? calculateCruiseValue(mergedCruise) : null), [mergedCruise]);
  const daysUntil = mergedCruise?.sailDate ? getDaysUntil(mergedCruise.sailDate) : null;
  const detailSections = useMemo<DataSection[]>(() => mergedCruise ? buildDataSections(mergedCruise as unknown as Record<string, unknown>) : [], [mergedCruise]);
  const linkedOfferSections = useMemo<DataSection[]>(() => linkedOffer ? buildDataSections(linkedOffer as unknown as Record<string, unknown>) : [], [linkedOffer]);
  const linkedOfferCard = useMemo(() => buildOfferCardFields(linkedOffer, mergedCruise ? [mergedCruise] : []), [linkedOffer, mergedCruise]);

  const heroPills = useMemo(() => ([
    { label: 'Sail Date', value: mergedCruise?.sailDate ? formatDate(mergedCruise.sailDate, 'medium') : 'Unknown', tone: 'gold' as const },
    { label: 'Nights', value: `${mergedCruise?.nights || 0}`, tone: 'teal' as const },
    { label: 'Guests', value: `${mergedCruise?.guests || 2}`, tone: 'violet' as const },
    { label: 'Retail', value: `${valueBreakdown ? formatCurrency(valueBreakdown.totalRetailValue) : '$0'}`, tone: 'emerald' as const },
  ]), [mergedCruise?.guests, mergedCruise?.nights, mergedCruise?.sailDate, valueBreakdown]);

  const quickFacts = useMemo<DisplayField[]>(() => ([
    { key: 'departurePort', label: 'Departure Port', value: mergedCruise?.departurePort || 'TBD', tone: 'accent' },
    { key: 'returnDate', label: 'Return', value: mergedCruise?.returnDate ? formatDate(mergedCruise.returnDate, 'medium') : 'Unknown', tone: 'accent' },
    { key: 'offerCode', label: 'Offer Code', value: mergedCruise?.offerCode || linkedOffer?.offerCode || 'None', tone: 'default' },
  ]), [linkedOffer?.offerCode, mergedCruise?.departurePort, mergedCruise?.offerCode, mergedCruise?.returnDate]);

  const statGridFields = useMemo<DisplayField[]>(() => ([
    { key: 'freePlay', label: 'Free Play', value: formatCurrency(mergedCruise?.freePlay || 0), tone: 'success' },
    { key: 'freeOBC', label: 'OBC', value: formatCurrency(mergedCruise?.freeOBC || 0), tone: 'success' },
    { key: 'tradeInValue', label: 'Trade-In', value: formatCurrency(mergedCruise?.tradeInValue || 0), tone: 'success' },
    { key: 'points', label: 'Earned Points', value: formatNumber((mergedCruise as BookedCruise | undefined)?.earnedPoints || (mergedCruise as BookedCruise | undefined)?.casinoPoints || 0), tone: 'accent' },
    { key: 'taxes', label: 'Taxes', value: formatCurrency(mergedCruise?.taxes || 0), tone: 'warning' },
    { key: 'net', label: 'Net Result', value: formatCurrency((mergedCruise as BookedCruise | undefined)?.netResult || (mergedCruise as BookedCruise | undefined)?.winnings || 0), tone: (((mergedCruise as BookedCruise | undefined)?.netResult || (mergedCruise as BookedCruise | undefined)?.winnings || 0) >= 0) ? 'success' : 'danger' },
  ]), [mergedCruise]);

  const handleSaveEdit = useCallback(() => {
    if (!cruise) return;

    const updates: Partial<BookedCruise> = {
      shipName: form.shipName,
      sailDate: form.sailDate,
      returnDate: form.returnDate,
      departurePort: form.departurePort,
      destination: form.destination,
      itineraryName: form.itineraryName,
      nights: Number(form.nights) || 0,
      cabinType: form.cabinType,
      guests: Number(form.guests) || 2,
      interiorPrice: parseOptionalNumber(form.interiorPrice),
      oceanviewPrice: parseOptionalNumber(form.oceanviewPrice),
      balconyPrice: parseOptionalNumber(form.balconyPrice),
      suitePrice: parseOptionalNumber(form.suitePrice),
      taxes: parseOptionalNumber(form.taxes),
      freePlay: parseOptionalNumber(form.freePlay),
      freeOBC: parseOptionalNumber(form.freeOBC),
      tradeInValue: parseOptionalNumber(form.tradeInValue),
      earnedPoints: parseOptionalNumber(form.earnedPoints),
      casinoPoints: parseOptionalNumber(form.earnedPoints),
      winnings: parseOptionalNumber(form.winnings),
      netResult: parseOptionalNumber(form.winnings),
      bookingId: form.bookingId || undefined,
      reservationNumber: form.reservationNumber || undefined,
      notes: form.notes || undefined,
    };

    console.log('[CruiseDetails] Saving cruise edits:', cruise.id, updates);
    updateCruise(cruise.id, updates);
    if (isBooked) {
      updateBookedCruise(cruise.id, updates);
    }
    setEditVisible(false);
  }, [cruise, form, isBooked, updateBookedCruise, updateCruise]);

  const handleBookCruise = useCallback(() => {
    if (!mergedCruise) return;
    const bookedCruise: BookedCruise = {
      ...(mergedCruise as BookedCruise),
      id: mergedCruise.id || `booked-${Date.now()}`,
      bookingId: (mergedCruise as BookedCruise).bookingId || `booking-${Date.now()}`,
      reservationNumber: (mergedCruise as BookedCruise).reservationNumber || `RES-${Date.now().toString().slice(-6)}`,
      status: 'booked',
      earnedPoints: (mergedCruise as BookedCruise).earnedPoints || 0,
      casinoPoints: (mergedCruise as BookedCruise).casinoPoints || 0,
      winnings: (mergedCruise as BookedCruise).winnings || 0,
    };
    console.log('[CruiseDetails] Booking cruise:', bookedCruise.id);
    addBookedCruise(bookedCruise);
    router.back();
  }, [addBookedCruise, mergedCruise, router]);

  if (!mergedCruise) {
    return (
      <PremiumPageBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.notFoundWrap}>
            <PremiumEmptyState title="Cruise not found" subtitle="The requested cruise could not be located in your current data sources." />
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
              <ArrowLeft size={18} color="#EAF1FF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </PremiumPageBackground>
    );
  }

  return (
    <PremiumPageBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerStack}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85} testID="cruise-details-back-button">
              <ArrowLeft size={18} color="#EAF1FF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <PremiumHeroCard
              title={mergedCruise.shipName}
              subtitle={`${mergedCruise.itineraryName || mergedCruise.destination || 'Cruise'} • ${mergedCruise.departurePort || 'Port TBD'}${daysUntil != null && daysUntil > 0 ? ` • ${daysUntil} days until sail` : ''}`}
              badge={getCruiseBadge(mergedCruise)}
              imageUri={pickCruiseImage(mergedCruise)}
              pills={heroPills}
            >
              <PremiumQuickFacts fields={quickFacts} />
            </PremiumHeroCard>

            <PremiumStatGrid title="Cruise Economics" fields={statGridFields} />

            <PremiumActionBar
              actions={[
                { key: 'edit', label: 'Edit Cruise', onPress: () => setEditVisible(true), tone: 'violet' },
                { key: 'booking', label: isBooked ? 'Unbook' : 'Book Cruise', onPress: isBooked ? () => setUnbookVisible(true) : handleBookCruise, tone: isBooked ? 'rose' : 'teal' },
                ...(linkedOffer?.offerCode ? [{ key: 'offer', label: 'View Offer', onPress: () => router.push(`/offer-details?offerCode=${encodeURIComponent(linkedOffer.offerCode || '')}` as never), tone: 'gold' as const }] : []),
              ]}
            />

            {linkedOffer ? (
              <PremiumEntityCard
                title={linkedOffer.offerName || linkedOffer.title || 'Linked Offer'}
                subtitle="Offer detail and cruise detail now share the same hero/card system."
                imageUri={pickCruiseImage(linkedOffer, linkedOffer.offerCode)}
                badge={{ label: 'LINKED OFFER', tone: 'gold' }}
                chips={linkedOffer.perks || []}
                primaryFields={linkedOfferCard.primary}
                extraFields={linkedOfferCard.extra}
                onPress={linkedOffer.offerCode ? () => router.push(`/offer-details?offerCode=${encodeURIComponent(linkedOffer.offerCode || '')}` as never) : undefined}
              />
            ) : null}

            {detailSections.map((section: DataSection) => (
              <PremiumDataSection key={section.key} title={section.title} fields={section.fields} defaultExpanded={section.key !== 'additional'} />
            ))}

            {linkedOfferSections.length > 0 ? (
              <View style={styles.linkedOfferSection}>
                <Text style={styles.sectionTitle}>Linked Offer Data</Text>
                <Text style={styles.sectionSubtitle}>No offer fields were dropped. The linked offer retains its own full detail sections below.</Text>
                {linkedOfferSections.map((section: DataSection) => (
                  <PremiumDataSection key={`offer-${section.key}`} title={section.title} fields={section.fields} defaultExpanded={section.key === 'overview' || section.key === 'pricing'} />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <PremiumPageBackground>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Edit Cruise</Text>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setEditVisible(false)} activeOpacity={0.85}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              {([
                ['Ship Name', 'shipName'],
                ['Sail Date', 'sailDate'],
                ['Return Date', 'returnDate'],
                ['Departure Port', 'departurePort'],
                ['Destination', 'destination'],
                ['Itinerary', 'itineraryName'],
                ['Nights', 'nights'],
                ['Cabin Type', 'cabinType'],
                ['Guests', 'guests'],
                ['Interior Price', 'interiorPrice'],
                ['Oceanview Price', 'oceanviewPrice'],
                ['Balcony Price', 'balconyPrice'],
                ['Suite Price', 'suitePrice'],
                ['Taxes', 'taxes'],
                ['Free Play', 'freePlay'],
                ['Free OBC', 'freeOBC'],
                ['Trade-In Value', 'tradeInValue'],
                ['Earned Points', 'earnedPoints'],
                ['Winnings / Net', 'winnings'],
                ['Booking ID', 'bookingId'],
                ['Reservation #', 'reservationNumber'],
                ['Notes', 'notes'],
              ] as [string, keyof EditFormState][]).map(([label, key]) => (
                <View key={key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(value: string) => setForm((current) => ({ ...current, [key]: value }))}
                    style={[styles.input, key === 'notes' && styles.textArea]}
                    placeholder={label}
                    placeholderTextColor="rgba(210,222,248,0.45)"
                    multiline={key === 'notes'}
                    testID={`edit-${key}`}
                  />
                </View>
              ))}

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit} activeOpacity={0.88} testID="save-cruise-edit">
                <Pencil size={16} color={COLORS.navyDeep} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </PremiumPageBackground>
      </Modal>

      <Modal visible={unbookVisible} transparent animationType="fade" onRequestClose={() => setUnbookVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Trash2 size={20} color="#FFD0DB" />
            </View>
            <Text style={styles.confirmTitle}>Unbook this cruise?</Text>
            <Text style={styles.confirmText}>{mergedCruise.shipName} on {formatDate(mergedCruise.sailDate, 'medium')} will be removed from booked cruises.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setUnbookVisible(false)} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={() => {
                  console.log('[CruiseDetails] Unbooking cruise:', mergedCruise.id);
                  removeBookedCruise(mergedCruise.id);
                  setUnbookVisible(false);
                  router.back();
                }}
                activeOpacity={0.88}
                testID="confirm-unbook-cruise"
              >
                <Text style={styles.dangerButtonText}>Unbook</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PremiumPageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 90,
  },
  headerStack: {
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backButtonText: {
    color: '#EAF1FF',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  linkedOfferSection: {
    gap: SPACING.md,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800' as const,
  },
  sectionSubtitle: {
    color: 'rgba(214, 225, 247, 0.76)',
    fontSize: 13,
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  confirmCard: {
    width: '100%',
    borderRadius: 24,
    padding: SPACING.xl,
    backgroundColor: '#0B1931',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: SPACING.md,
  },
  confirmIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 103, 145, 0.14)',
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800' as const,
  },
  confirmText: {
    color: 'rgba(214, 225, 247, 0.76)',
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  dangerButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 103, 145, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 189, 0.36)',
  },
  dangerButtonText: {
    color: '#FFD0DB',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  modalScroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800' as const,
  },
  modalCloseButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalCloseText: {
    color: '#EAF1FF',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: 'rgba(222, 233, 255, 0.78)',
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: SPACING.sm,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFE28F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
  },
});
