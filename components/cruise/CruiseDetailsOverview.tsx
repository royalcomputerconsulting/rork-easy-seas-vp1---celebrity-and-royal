import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Ship } from 'lucide-react-native';
import {
  PremiumActionBar,
  PremiumDataSection,
  PremiumEmptyState,
  PremiumEntityCard,
  PremiumHeroCard,
  PremiumPageBackground,
  PremiumQuickFacts,
  PremiumStatGrid,
} from '@/components/cruise/UnifiedCruiseSystem';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  buildCruiseCardFields,
  buildDataSections,
  buildOfferCardFields,
  getCruiseBadge,
  getOfferBadge,
  pickCruiseImage,
  type DisplayField,
} from '@/lib/cruisePresentation';
import { formatDate, getDaysUntil } from '@/lib/date';
import { createCruiseListKey, dedupeCruisesByIdentity } from '@/lib/listKeys';
import { calculateCruiseValue, getCabinPriceFromEntity } from '@/lib/valueCalculator';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

interface CruiseLookupResult {
  cruise: Cruise | BookedCruise | null;
  linkedOffer?: CasinoOffer;
}

function isBookedCruise(cruise: Cruise | BookedCruise): cruise is BookedCruise {
  return typeof (cruise as BookedCruise).reservationNumber === 'string' || typeof (cruise as BookedCruise).bookingId === 'string';
}

export function CruiseDetailsOverview() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { cruises, bookedCruises, casinoOffers } = useCoreData();

  const cruiseLookup = useMemo<CruiseLookupResult>(() => {
    const combinedCruises = dedupeCruisesByIdentity<Cruise | BookedCruise>([...(bookedCruises || []), ...(cruises || [])]);
    const searchId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;

    console.log('[CruiseDetailsOverview] Resolving cruise detail for id:', searchId);

    if (!searchId) {
      return { cruise: null };
    }

    const directCruise = combinedCruises.find((cruiseItem) => {
      const bookedCruise = cruiseItem as BookedCruise;
      return cruiseItem.id === searchId || bookedCruise.bookingId === searchId || bookedCruise.reservationNumber === searchId;
    });

    if (directCruise) {
      const matchedOffer = casinoOffers.find((offer) => {
        if (offer.cruiseId === directCruise.id || offer.cruiseIds?.includes(directCruise.id)) {
          return true;
        }
        return Boolean(directCruise.offerCode && offer.offerCode && directCruise.offerCode === offer.offerCode);
      });

      console.log('[CruiseDetailsOverview] Direct cruise match found:', {
        cruiseId: directCruise.id,
        shipName: directCruise.shipName,
        linkedOfferCode: matchedOffer?.offerCode,
      });

      return {
        cruise: directCruise,
        linkedOffer: matchedOffer,
      };
    }

    const matchedOffer = casinoOffers.find((offer) => offer.id === searchId || offer.offerCode === searchId);
    if (!matchedOffer) {
      console.log('[CruiseDetailsOverview] No cruise or offer match found');
      return { cruise: null };
    }

    const fallbackCruise = combinedCruises.find((cruiseItem) => {
      if (matchedOffer.cruiseId === cruiseItem.id || matchedOffer.cruiseIds?.includes(cruiseItem.id)) {
        return true;
      }
      return Boolean(matchedOffer.offerCode && cruiseItem.offerCode && matchedOffer.offerCode === cruiseItem.offerCode);
    });

    console.log('[CruiseDetailsOverview] Offer fallback resolved:', {
      offerId: matchedOffer.id,
      offerCode: matchedOffer.offerCode,
      cruiseId: fallbackCruise?.id,
    });

    return {
      cruise: fallbackCruise ?? null,
      linkedOffer: matchedOffer,
    };
  }, [bookedCruises, casinoOffers, cruises, id]);

  const selectedCruise = cruiseLookup.cruise;
  const linkedOffer = cruiseLookup.linkedOffer;

  const cruiseValue = useMemo(() => {
    if (!selectedCruise) {
      return null;
    }

    return calculateCruiseValue(selectedCruise);
  }, [selectedCruise]);

  const cruiseCardFields = useMemo(() => {
    if (!selectedCruise) {
      return { primary: [] as DisplayField[], extra: [] as DisplayField[] };
    }

    return buildCruiseCardFields(selectedCruise, linkedOffer);
  }, [linkedOffer, selectedCruise]);

  const cruiseSections = useMemo(() => {
    if (!selectedCruise) {
      return [] as ReturnType<typeof buildDataSections>;
    }

    return buildDataSections(selectedCruise as unknown as Record<string, unknown>);
  }, [selectedCruise]);

  const offerCardFields = useMemo(() => {
    if (!linkedOffer) {
      return { primary: [] as DisplayField[], extra: [] as DisplayField[] };
    }

    return buildOfferCardFields(linkedOffer, selectedCruise ? [selectedCruise] : []);
  }, [linkedOffer, selectedCruise]);

  const sailDateLabel = selectedCruise ? formatDate(selectedCruise.sailDate, 'medium') : 'Date unavailable';
  const daysUntilSailing = selectedCruise ? getDaysUntil(selectedCruise.sailDate) : null;
  const guestCount = selectedCruise?.guests ?? linkedOffer?.guests ?? 2;
  const bestCabinPrice = selectedCruise ? (getCabinPriceFromEntity(selectedCruise, selectedCruise.cabinType ?? linkedOffer?.roomType) ?? 0) : 0;
  const imageUri = selectedCruise ? pickCruiseImage(selectedCruise, linkedOffer?.offerCode) : pickCruiseImage(linkedOffer ?? { id: 'cruise-detail-fallback' }, 'cruise-detail-fallback');

  const heroPills = useMemo(() => {
    if (!selectedCruise) {
      return [];
    }

    return [
      { label: 'Nights', value: `${selectedCruise.nights || 0}`, tone: 'gold' as const },
      { label: 'Guests', value: `${guestCount}`, tone: 'teal' as const },
      { label: 'Cabin', value: `${selectedCruise.cabinType || linkedOffer?.roomType || 'Flexible'}`, tone: 'violet' as const },
      {
        label: 'Value',
        value: cruiseValue ? `$${Math.round(cruiseValue.totalValueReceived || 0).toLocaleString()}` : '$0',
        tone: 'emerald' as const,
      },
    ];
  }, [cruiseValue, guestCount, linkedOffer?.roomType, selectedCruise]);

  const quickFacts = useMemo<DisplayField[]>(() => {
    if (!selectedCruise) {
      return [];
    }

    const sailingValue = daysUntilSailing == null
      ? sailDateLabel
      : daysUntilSailing >= 0
        ? `${sailDateLabel} • ${daysUntilSailing} days`
        : `${sailDateLabel} • Sailed`;

    return [
      {
        key: 'sailDate',
        label: 'Sailing',
        value: sailingValue,
        tone: daysUntilSailing != null && daysUntilSailing <= 14 ? 'warning' : 'accent',
      },
      {
        key: 'departurePort',
        label: 'Port',
        value: selectedCruise.departurePort || 'Port TBD',
        tone: 'default',
      },
      {
        key: 'offerCode',
        label: 'Offer',
        value: selectedCruise.offerCode || linkedOffer?.offerCode || 'Standalone cruise',
        tone: linkedOffer ? 'success' : 'default',
      },
    ];
  }, [daysUntilSailing, linkedOffer, sailDateLabel, selectedCruise]);

  const statFields = useMemo<DisplayField[]>(() => {
    if (!selectedCruise || !cruiseValue) {
      return [];
    }

    return [
      {
        key: 'retailValue',
        label: 'Retail Cabin',
        value: `$${Math.round(cruiseValue.totalRetailValue || bestCabinPrice * guestCount).toLocaleString()}`,
        tone: 'success',
      },
      {
        key: 'taxes',
        label: 'Taxes & Fees',
        value: `$${Math.round(cruiseValue.taxesFees || selectedCruise.taxes || 0).toLocaleString()}`,
        tone: 'warning',
      },
      {
        key: 'freePlay',
        label: 'Free Play + OBC',
        value: `$${Math.round((selectedCruise.freePlay || linkedOffer?.freePlay || linkedOffer?.freeplayAmount || 0) + (selectedCruise.freeOBC || linkedOffer?.OBC || linkedOffer?.obcAmount || 0)).toLocaleString()}`,
        tone: 'success',
      },
      {
        key: 'tradeInValue',
        label: 'Trade-In',
        value: `$${Math.round(selectedCruise.tradeInValue || linkedOffer?.tradeInValue || 0).toLocaleString()}`,
        tone: 'success',
      },
    ];
  }, [bestCabinPrice, cruiseValue, guestCount, linkedOffer, selectedCruise]);

  const linkedOfferSubtitle = useMemo(() => {
    if (!linkedOffer) {
      return undefined;
    }

    const pieces = [
      linkedOffer.offerCode,
      linkedOffer.offerName || linkedOffer.title,
      linkedOffer.expiryDate || linkedOffer.offerExpiryDate || linkedOffer.expires
        ? `Expires ${formatDate(linkedOffer.expiryDate || linkedOffer.offerExpiryDate || linkedOffer.expires || '', 'medium')}`
        : undefined,
    ].filter((value): value is string => Boolean(value));

    return pieces.join(' • ');
  }, [linkedOffer]);

  if (!selectedCruise) {
    return (
      <PremiumPageBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85} testID="cruise-details-back-button-empty">
              <ArrowLeft size={18} color="#EAF1FF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <PremiumEmptyState
              title="Cruise not found"
              subtitle="This cruise detail link no longer points to an active sailing. Go back and pick another card."
            />
          </View>
        </SafeAreaView>
      </PremiumPageBackground>
    );
  }

  const heroSubtitle = [
    sailDateLabel,
    `${selectedCruise.nights || 0} nights`,
    selectedCruise.destination || selectedCruise.itineraryName || 'Cruise itinerary',
  ].filter((value): value is string => Boolean(value)).join(' • ');

  const isBooked = isBookedCruise(selectedCruise);
  const primaryBadge = getCruiseBadge(selectedCruise);

  return (
    <PremiumPageBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} testID="cruise-details-scroll-view">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85} testID="cruise-details-back-button">
            <ArrowLeft size={18} color="#EAF1FF" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <PremiumHeroCard
            title={selectedCruise.shipName || 'Cruise Detail'}
            subtitle={heroSubtitle}
            badge={primaryBadge}
            imageUri={imageUri}
            pills={heroPills}
          >
            <PremiumQuickFacts fields={quickFacts} />
          </PremiumHeroCard>

          <PremiumStatGrid title="Cruise Economics" fields={statFields} />

          <PremiumActionBar
            actions={[
              {
                key: 'offer',
                label: linkedOffer?.offerCode ? 'Open Offer' : 'No Linked Offer',
                onPress: () => {
                  if (linkedOffer?.offerCode) {
                    router.push(`/offer-details?offerCode=${linkedOffer.offerCode}` as never);
                  }
                },
                tone: linkedOffer?.offerCode ? 'teal' : 'slate',
              },
              {
                key: 'timeline',
                label: daysUntilSailing != null && daysUntilSailing >= 0 ? `${daysUntilSailing} Days Out` : 'Sailed',
                onPress: () => undefined,
                tone: daysUntilSailing != null && daysUntilSailing <= 14 ? 'gold' : 'violet',
              },
            ]}
          />

          <PremiumEntityCard
            title={selectedCruise.shipName}
            subtitle={isBooked ? 'Booked cruise card with complete cabin and booking detail visibility.' : 'Eligible sailing card with the full cruise value story visible at a glance.'}
            imageUri={imageUri}
            badge={primaryBadge}
            chips={[
              selectedCruise.cabinType || linkedOffer?.roomType || 'Flexible cabin',
              selectedCruise.departurePort || 'Port TBD',
              selectedCruise.offerCode || linkedOffer?.offerCode || 'No offer code',
            ].filter((value): value is string => Boolean(value))}
            primaryFields={cruiseCardFields.primary}
            extraFields={cruiseCardFields.extra}
            footerText="Everything visible here mirrors the premium offer-detail treatment, but focused on one sailing."
          />

          {linkedOffer ? (
            <PremiumEntityCard
              title={linkedOffer.offerName || linkedOffer.title || 'Linked Offer'}
              subtitle={linkedOfferSubtitle}
              imageUri={pickCruiseImage(linkedOffer, createCruiseListKey(selectedCruise, 0))}
              badge={getOfferBadge(linkedOffer)}
              chips={linkedOffer.perks || []}
              primaryFields={offerCardFields.primary}
              extraFields={offerCardFields.extra}
              footerText="Linked offer card stays compact while preserving the full offer dataset."
              onPress={linkedOffer.offerCode ? () => router.push(`/offer-details?offerCode=${linkedOffer.offerCode}` as never) : undefined}
            />
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={styles.sectionTitle}>Full Cruise Data</Text>
              <Text style={styles.sectionSubtitle}>Structured sections keep the sailing readable without hiding the important details.</Text>
            </View>
            <View style={styles.sectionIconWrap}>
              <Ship size={18} color="#1E3A5F" />
            </View>
          </View>

          {cruiseSections.map((section) => (
            <PremiumDataSection
              key={section.key}
              title={section.title}
              fields={section.fields}
              defaultExpanded={section.key === 'overview' || section.key === 'pricing'}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </PremiumPageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 84,
    gap: SPACING.md,
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
    borderColor: 'rgba(255,255,255,0.10)',
  },
  backButtonText: {
    color: '#EAF1FF',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  sectionHeaderRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  sectionHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: 'rgba(234,241,255,0.74)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
