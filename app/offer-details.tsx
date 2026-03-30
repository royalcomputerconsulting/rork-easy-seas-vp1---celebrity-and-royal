import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Filter } from 'lucide-react-native';
import {
  PremiumActionBar,
  PremiumChipBar,
  PremiumCompactCruiseCard,
  PremiumDataSection,
  PremiumEmptyState,
  PremiumEntityCard,
  PremiumHeroCard,
  PremiumPageBackground,
  PremiumQuickFacts,
  PremiumStatGrid,
} from '../components/cruise/UnifiedCruiseSystem';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { calculateOfferValue } from '@/lib/valueCalculator';
import { createDateFromString, formatDate, getDaysUntil } from '@/lib/date';
import {
  buildCompactCruiseCardFields,
  buildDataSections,
  buildOfferCardFields,
  getCruiseBadge,
  getOfferBadge,
  pickCruiseImage,
  type DisplayField,
} from '../lib/cruisePresentation';
import { createCruiseListKey, dedupeCruisesByIdentity } from '@/lib/listKeys';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

type SortOption = 'soonest' | 'highest-value' | 'lowest-price' | 'longest' | 'shortest';

export default function OfferDetailsScreen() {
  const router = useRouter();
  const { offerCode } = useLocalSearchParams<{ offerCode: string }>();
  const { localData } = useAppState();
  const {
    cruises: storeCruises,
    bookedCruises: storeBookedCruises,
    casinoOffers: storeOffers,
    updateCasinoOffer,
    removeCasinoOffer,
  } = useCoreData();

  const [sortBy, setSortBy] = useState<SortOption>('soonest');
  const [filterShip, setFilterShip] = useState<string | null>(null);
  const [filterGuests, setFilterGuests] = useState<number | null>(null);
  const [filterRoomType, setFilterRoomType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(true);

  const bookedCruiseIds = useMemo<Set<string>>(() => {
    const allBooked = [...(storeBookedCruises || []), ...(localData.booked || [])];
    return new Set(allBooked.map((cruise: BookedCruise) => cruise.id));
  }, [localData.booked, storeBookedCruises]);

  const offerData = useMemo(() => {
    const allCruises = [...(storeCruises || []), ...(localData.cruises || [])];
    const allOffers = [...(storeOffers || []), ...(localData.offers || [])];
    const uniqueCruises = dedupeCruisesByIdentity(allCruises);

    const offer = allOffers.find((entry: CasinoOffer) => entry.offerCode === offerCode);
    let matchingCruises = uniqueCruises.filter((cruise: Cruise) => cruise.offerCode === offerCode);

    matchingCruises = matchingCruises.map((cruise) => {
      if (!offer) {
        return cruise;
      }
      const hasPricing = cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice;
      if (hasPricing) {
        return cruise;
      }
      return {
        ...cruise,
        interiorPrice: cruise.interiorPrice || offer.interiorPrice,
        oceanviewPrice: cruise.oceanviewPrice || offer.oceanviewPrice,
        balconyPrice: cruise.balconyPrice || offer.balconyPrice,
        suitePrice: cruise.suitePrice || offer.suitePrice,
        taxes: cruise.taxes || offer.taxesFees,
        portsAndTimes: cruise.portsAndTimes || offer.portsAndTimes,
        ports: cruise.ports || offer.ports,
      } satisfies Cruise;
    });

    const filteredCruises = matchingCruises.filter((cruise) => {
      if (filterShip && cruise.shipName !== filterShip) return false;
      if (filterGuests) {
        const cruiseGuests = cruise.guests || 2;
        if (cruiseGuests !== filterGuests) return false;
      }
      if (filterRoomType) {
        const cabinType = (cruise.cabinType || '').toLowerCase();
        if (!cabinType.includes(filterRoomType.toLowerCase())) return false;
      }
      return true;
    });

    const cruises = [...filteredCruises].sort((left, right) => {
      switch (sortBy) {
        case 'soonest':
          return createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime();
        case 'highest-value': {
          const leftValue = Math.max(left.suitePrice || 0, left.balconyPrice || 0, left.oceanviewPrice || 0, left.interiorPrice || 0);
          const rightValue = Math.max(right.suitePrice || 0, right.balconyPrice || 0, right.oceanviewPrice || 0, right.interiorPrice || 0);
          return rightValue - leftValue;
        }
        case 'lowest-price': {
          const getLowest = (cruise: Cruise) => {
            const values = [cruise.interiorPrice, cruise.oceanviewPrice, cruise.balconyPrice, cruise.suitePrice].filter((value): value is number => value != null && value > 0);
            return values.length > 0 ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
          };
          return getLowest(left) - getLowest(right);
        }
        case 'longest':
          return (right.nights || 0) - (left.nights || 0);
        case 'shortest':
          return (left.nights || 0) - (right.nights || 0);
        default:
          return 0;
      }
    });

    return { cruises, offer };
  }, [filterGuests, filterRoomType, filterShip, localData.cruises, localData.offers, offerCode, sortBy, storeCruises, storeOffers]);

  const filterOptions = useMemo(() => {
    const allCruises = [...(storeCruises || []), ...(localData.cruises || [])].filter((cruise: Cruise) => cruise.offerCode === offerCode);
    const uniqueCruises = dedupeCruisesByIdentity(allCruises);
    const ships = [...new Set(uniqueCruises.map((cruise) => cruise.shipName).filter(Boolean))].sort();
    const guestCounts = [...new Set(uniqueCruises.map((cruise) => cruise.guests || 2))].sort((left, right) => left - right);
    const roomTypes = [...new Set(uniqueCruises.map((cruise) => cruise.cabinType).filter((room): room is string => Boolean(room)))].sort();
    return { ships, guestCounts, roomTypes };
  }, [localData.cruises, offerCode, storeCruises]);

  const offerInfo = useMemo(() => {
    const { cruises, offer } = offerData;
    const guestCount = 2;
    let aggregateTotalValue = 0;
    let minRetailValue = Number.POSITIVE_INFINITY;
    let maxRetailValue = 0;

    cruises.forEach((cruise) => {
      const interiorPrice = cruise.interiorPrice || 0;
      const balconyPrice = cruise.balconyPrice || 0;
      const suitePrice = cruise.suitePrice || 0;
      const taxes = cruise.taxes || 0;
      const cabinPrice = balconyPrice || interiorPrice || suitePrice || 0;
      const retailValueForCruise = (cabinPrice * guestCount) + taxes;
      aggregateTotalValue += retailValueForCruise;

      if (interiorPrice > 0) {
        minRetailValue = Math.min(minRetailValue, (interiorPrice * guestCount) + taxes);
      }
      if (suitePrice > 0) {
        maxRetailValue = Math.max(maxRetailValue, (suitePrice * guestCount) + taxes);
      }
      if (minRetailValue === Number.POSITIVE_INFINITY && balconyPrice > 0) {
        minRetailValue = (balconyPrice * guestCount) + taxes;
      }
      if (maxRetailValue === 0 && balconyPrice > 0) {
        maxRetailValue = (balconyPrice * guestCount) + taxes;
      }
    });

    if (minRetailValue === Number.POSITIVE_INFINITY) {
      minRetailValue = aggregateTotalValue / Math.max(cruises.length, 1);
    }
    if (maxRetailValue === 0) {
      maxRetailValue = aggregateTotalValue / Math.max(cruises.length, 1);
    }

    if (offer) {
      return {
        offerCode: offer.offerCode || offerCode || 'Unknown',
        offerName: offer.title || offer.offerName || offer.offerCode || 'Casino Offer',
        expiryDate: offer.expiryDate || offer.offerExpiryDate || offer.expires,
        tradeInValue: offer.value || offer.tradeInValue,
        freePlay: offer.freePlay || offer.freeplayAmount,
        obc: offer.obcAmount || offer.OBC,
        roomType: offer.roomType,
        perks: offer.perks,
        interiorPrice: offer.interiorPrice,
        oceanviewPrice: offer.oceanviewPrice,
        balconyPrice: offer.balconyPrice,
        suitePrice: offer.suitePrice,
        taxesFees: offer.taxesFees,
        totalValue: aggregateTotalValue,
        minRetailValue,
        maxRetailValue,
      };
    }

    const fallbackCruise = cruises[0];
    return {
      offerCode: fallbackCruise?.offerCode || offerCode || 'Unknown',
      offerName: fallbackCruise?.offerName || 'Casino Offer',
      expiryDate: fallbackCruise?.offerExpiry,
      tradeInValue: fallbackCruise?.tradeInValue || 0,
      freePlay: fallbackCruise?.freePlay || 0,
      obc: fallbackCruise?.freeOBC || 0,
      roomType: fallbackCruise?.cabinType,
      perks: fallbackCruise?.perks,
      interiorPrice: fallbackCruise?.interiorPrice,
      oceanviewPrice: fallbackCruise?.oceanviewPrice,
      balconyPrice: fallbackCruise?.balconyPrice,
      suitePrice: fallbackCruise?.suitePrice,
      taxesFees: fallbackCruise?.taxes,
      totalValue: aggregateTotalValue,
      minRetailValue,
      maxRetailValue,
    };
  }, [offerCode, offerData]);

  const daysUntilExpiry = offerInfo.expiryDate ? getDaysUntil(offerInfo.expiryDate) : null;
  const offerValue = useMemo(() => offerData.offer ? calculateOfferValue(offerData.offer) : null, [offerData.offer]);
  const offerCardFields = useMemo(() => buildOfferCardFields(offerData.offer, offerData.cruises), [offerData.cruises, offerData.offer]);
  const offerSections = useMemo(() => buildDataSections(offerData.offer ? (offerData.offer as Record<string, unknown>) : ({
    offerCode: offerInfo.offerCode,
    offerName: offerInfo.offerName,
    expiryDate: offerInfo.expiryDate,
    tradeInValue: offerInfo.tradeInValue,
    freePlay: offerInfo.freePlay,
    OBC: offerInfo.obc,
    roomType: offerInfo.roomType,
    totalValue: offerInfo.totalValue,
    minRetailValue: offerInfo.minRetailValue,
    maxRetailValue: offerInfo.maxRetailValue,
    cruisesAvailable: offerData.cruises.length,
    perks: offerInfo.perks,
  })), [offerData.cruises.length, offerData.offer, offerInfo.expiryDate, offerInfo.freePlay, offerInfo.maxRetailValue, offerInfo.minRetailValue, offerInfo.obc, offerInfo.offerCode, offerInfo.offerName, offerInfo.perks, offerInfo.roomType, offerInfo.totalValue, offerInfo.tradeInValue]);

  const heroPills = useMemo(() => ([
    { label: 'Cruises', value: `${offerData.cruises.length}`, tone: 'gold' as const },
    { label: 'Free Play', value: `${offerInfo.freePlay ? `$${offerInfo.freePlay.toLocaleString()}` : '$0'}`, tone: 'teal' as const },
    { label: 'OBC', value: `${offerInfo.obc ? `$${offerInfo.obc.toLocaleString()}` : '$0'}`, tone: 'violet' as const },
    { label: 'Value', value: `${Math.round(offerInfo.totalValue || offerValue?.totalValueReceived || 0) > 0 ? `$${Math.round(offerInfo.totalValue || offerValue?.totalValueReceived || 0).toLocaleString()}` : '$0'}`, tone: 'emerald' as const },
  ]), [offerData.cruises.length, offerInfo.freePlay, offerInfo.obc, offerInfo.totalValue, offerValue?.totalValueReceived]);

  const quickFacts = useMemo<DisplayField[]>(() => ([
    { key: 'expiry', label: 'Expiration', value: offerInfo.expiryDate ? formatDate(offerInfo.expiryDate, 'medium') : 'No date', tone: daysUntilExpiry != null && daysUntilExpiry <= 7 ? 'warning' : 'accent' },
    { key: 'roomType', label: 'Room Type', value: offerInfo.roomType || 'Flexible', tone: 'default' },
    { key: 'range', label: 'Retail Range', value: `$${Math.round(offerInfo.minRetailValue || 0).toLocaleString()} - $${Math.round(offerInfo.maxRetailValue || 0).toLocaleString()}`, tone: 'success' },
  ]), [daysUntilExpiry, offerInfo.expiryDate, offerInfo.maxRetailValue, offerInfo.minRetailValue, offerInfo.roomType]);

  const statGridFields = useMemo<DisplayField[]>(() => ([
    { key: 'tradeIn', label: 'Trade-In', value: `${offerInfo.tradeInValue ? `$${offerInfo.tradeInValue.toLocaleString()}` : '$0'}`, tone: 'success' },
    { key: 'totalValue', label: 'Offer Value', value: `${offerValue ? `$${Math.round(offerValue.totalValueReceived).toLocaleString()}` : `$${Math.round(offerInfo.totalValue || 0).toLocaleString()}`}`, tone: 'success' },
    { key: 'retail', label: 'Retail Cabin', value: `${offerValue ? `$${Math.round(offerValue.totalRetailValue).toLocaleString()}` : `$${Math.round(offerInfo.maxRetailValue || 0).toLocaleString()}`}`, tone: 'success' },
    { key: 'taxesFees', label: 'Taxes & Fees', value: `${offerInfo.taxesFees ? `$${Math.round(offerInfo.taxesFees).toLocaleString()}` : '$0'}`, tone: 'warning' },
  ]), [offerInfo.maxRetailValue, offerInfo.taxesFees, offerInfo.totalValue, offerInfo.tradeInValue, offerValue]);

  const handleCruisePress = useCallback((cruiseId: string) => {
    console.log('[OfferDetails] Cruise pressed:', cruiseId);
    router.push(`/cruise-details?id=${cruiseId}` as never);
  }, [router]);

  const handleMarkAsUsed = useCallback(() => {
    if (!offerData.offer) return;
    console.log('[OfferDetails] Marking offer used:', offerData.offer.offerCode);
    removeCasinoOffer(offerData.offer.id);
    router.back();
  }, [offerData.offer, removeCasinoOffer, router]);

  const handleMarkAsInProgress = useCallback(() => {
    if (!offerData.offer) return;
    updateCasinoOffer(offerData.offer.id, { status: 'booked' });
    console.log('[OfferDetails] Marked as booked:', offerData.offer.offerCode);
  }, [offerData.offer, updateCasinoOffer]);

  const renderCruiseCard = useCallback(({ item }: { item: Cruise }) => {
    const fields = buildCompactCruiseCardFields(item, offerData.offer);
    const badge = bookedCruiseIds.has(item.id) ? { label: 'BOOKED', tone: 'teal' as const } : getCruiseBadge(item);
    return (
      <PremiumCompactCruiseCard
        title={item.shipName}
        subtitle={`${formatDate(item.sailDate, 'medium')} • ${item.nights || 0} nights • ${item.departurePort || 'Port TBD'}`}
        imageUri={pickCruiseImage(item)}
        badge={badge}
        chips={[
          item.destination || item.itineraryName || 'Cruise',
          item.cabinType || offerInfo.roomType || 'Cabin TBD',
        ].filter(Boolean)}
        highlights={fields.highlights}
        details={fields.details}
        footerText="Tap to open the full cruise detail screen."
        onPress={() => handleCruisePress(item.id)}
      />
    );
  }, [bookedCruiseIds, handleCruisePress, offerData.offer, offerInfo.roomType]);

  return (
    <PremiumPageBackground>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={offerData.cruises}
          keyExtractor={(item, index) => createCruiseListKey(item, index)}
          renderItem={renderCruiseCard}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.spacer} />}
          ListHeaderComponent={(
            <View style={styles.headerStack}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85} testID="offer-details-back-button">
                <ArrowLeft size={18} color="#EAF1FF" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <PremiumHeroCard
                title={offerInfo.offerName}
                subtitle={`${offerInfo.offerCode} • ${offerData.cruises.length} eligible cruises • ${daysUntilExpiry != null && daysUntilExpiry >= 0 ? `${daysUntilExpiry} days left` : 'Offer detail aligned with cruise detail styling'}`}
                badge={getOfferBadge(offerData.offer)}
                imageUri={pickCruiseImage(offerData.offer ?? offerData.cruises[0], offerInfo.offerCode)}
                pills={heroPills}
                compact
              >
                <PremiumQuickFacts fields={quickFacts} />
              </PremiumHeroCard>

              <PremiumStatGrid title="Offer Economics" fields={statGridFields} />

              <PremiumActionBar
                actions={[
                  { key: 'in-progress', label: 'Mark Booked', onPress: handleMarkAsInProgress, tone: 'teal' },
                  { key: 'used', label: 'Mark Used', onPress: handleMarkAsUsed, tone: 'rose' },
                  { key: 'filters', label: showFilters ? 'Hide Filters' : 'Show Filters', onPress: () => setShowFilters((current) => !current), tone: 'violet' },
                ]}
              />

              <PremiumEntityCard
                title="Offer Master Card"
                subtitle="The unified hero summary card preserves the full union of offer fields used across this experience."
                imageUri={pickCruiseImage(offerData.offer ?? offerData.cruises[0], `${offerInfo.offerCode}-master`)}
                badge={getOfferBadge(offerData.offer)}
                chips={offerInfo.perks || []}
                primaryFields={offerCardFields.primary}
                extraFields={offerCardFields.extra}
              />

              <PremiumChipBar
                chips={[
                  { key: 'soonest', label: 'Soonest', active: sortBy === 'soonest', onPress: () => setSortBy('soonest'), tone: 'gold' },
                  { key: 'highest-value', label: 'Best Value', active: sortBy === 'highest-value', onPress: () => setSortBy('highest-value'), tone: 'emerald' },
                  { key: 'lowest-price', label: 'Lowest Price', active: sortBy === 'lowest-price', onPress: () => setSortBy('lowest-price'), tone: 'teal' },
                  { key: 'longest', label: 'Longest', active: sortBy === 'longest', onPress: () => setSortBy('longest'), tone: 'violet' },
                  { key: 'shortest', label: 'Shortest', active: sortBy === 'shortest', onPress: () => setSortBy('shortest'), tone: 'slate' },
                ]}
              />

              {showFilters ? (
                <View style={styles.filterStack}>
                  <View style={styles.filterHeader}>
                    <Filter size={16} color="#EAF1FF" />
                    <Text style={styles.filterHeaderText}>Filter cruises under this offer</Text>
                  </View>
                  {filterOptions.ships.length > 1 ? (
                    <PremiumChipBar
                      chips={[
                        { key: 'all-ships', label: 'All Ships', active: !filterShip, onPress: () => setFilterShip(null), tone: 'slate' },
                        ...filterOptions.ships.map((ship) => ({ key: ship, label: ship, active: filterShip === ship, onPress: () => setFilterShip(filterShip === ship ? null : ship), tone: 'teal' as const })),
                      ]}
                    />
                  ) : null}
                  {filterOptions.guestCounts.length > 1 ? (
                    <PremiumChipBar
                      chips={[
                        { key: 'all-guests', label: 'All Guests', active: !filterGuests, onPress: () => setFilterGuests(null), tone: 'slate' },
                        ...filterOptions.guestCounts.map((count) => ({ key: `${count}`, label: `${count} Guests`, active: filterGuests === count, onPress: () => setFilterGuests(filterGuests === count ? null : count), tone: 'gold' as const })),
                      ]}
                    />
                  ) : null}
                  {filterOptions.roomTypes.length > 1 ? (
                    <PremiumChipBar
                      chips={[
                        { key: 'all-rooms', label: 'All Rooms', active: !filterRoomType, onPress: () => setFilterRoomType(null), tone: 'slate' },
                        ...filterOptions.roomTypes.map((room) => ({ key: room, label: room, active: filterRoomType === room, onPress: () => setFilterRoomType(filterRoomType === room ? null : room), tone: 'violet' as const })),
                      ]}
                    />
                  ) : null}
                </View>
              ) : null}

              {offerSections.map((section) => (
                <PremiumDataSection key={section.key} title={section.title} fields={section.fields} defaultExpanded={section.key !== 'additional'} />
              ))}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Eligible Cruises</Text>
                <Text style={styles.sectionSubtitle}>{offerData.cruises.length} sailings • compact at-a-glance cards with full values visible</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<PremiumEmptyState title="No cruises match this offer filter" subtitle="The offer still retains all of its fields above. Clear filters to see every linked sailing again." />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </PremiumPageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 80,
  },
  headerStack: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  spacer: {
    height: SPACING.md,
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
  filterStack: {
    gap: SPACING.sm,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterHeaderText: {
    color: '#EAF1FF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
  },
  sectionHeaderRow: {
    gap: 4,
    marginTop: 4,
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
});
