import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, ChevronRight, Search, Ship } from 'lucide-react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ThemedSectionCard } from '@/components/ui/ThemedSectionCard';
import { EASY_SEAS_UX, TYPOGRAPHY } from '@/constants/theme';
import { getUniqueImageForCruise } from '@/constants/cruiseImages';
import { formatDate } from '@/lib/date';
import { isCompletedBookedCruise, isInProgressBookedCruise } from '@/lib/bookedCruiseStatus';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise } from '@/types/models';

type VoyageState = 'current' | 'upcoming' | 'completed';

function getVoyageState(cruise: BookedCruise): VoyageState {
  if (isInProgressBookedCruise(cruise)) return 'current';
  if (isCompletedBookedCruise(cruise)) return 'completed';
  return 'upcoming';
}

const STATE_ORDER: Record<VoyageState, number> = { current: 0, upcoming: 1, completed: 2 };

export default function CruiseFinancialEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { bookedCruises } = useCoreData();
  const [query, setQuery] = useState('');
  const isReceiptMode = String(params.mode ?? '').toLowerCase() === 'receipt';

  const voyages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...bookedCruises]
      .filter((cruise) => {
        if (!normalizedQuery) return true;
        return [cruise.shipName, cruise.itineraryName, cruise.destination, cruise.sailDate, cruise.reservationNumber, cruise.bookingId]
          .some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        const leftState = getVoyageState(left);
        const rightState = getVoyageState(right);
        if (leftState !== rightState) return STATE_ORDER[leftState] - STATE_ORDER[rightState];
        return leftState === 'completed'
          ? String(right.sailDate).localeCompare(String(left.sailDate))
          : String(left.sailDate).localeCompare(String(right.sailDate));
      });
  }, [bookedCruises, query]);
  const groupedVoyages = useMemo(() => {
    const groups: Array<{ state: VoyageState; label: string; voyages: BookedCruise[] }> = [
      { state: 'current', label: 'Currently sailing', voyages: [] },
      { state: 'upcoming', label: 'Upcoming voyages', voyages: [] },
      { state: 'completed', label: 'Completed voyages', voyages: [] },
    ];
    const byState = new Map(groups.map((group) => [group.state, group]));
    voyages.slice(0, 100).forEach((cruise) => byState.get(getVoyageState(cruise))?.voyages.push(cruise));
    return groups.filter((group) => group.voyages.length > 0);
  }, [voyages]);

  const openTotals = (cruise: BookedCruise) => {
    if (isReceiptMode) {
      router.push({ pathname: '/casino/invoice-import', params: { cruiseId: cruise.id } } as never);
      return;
    }
    router.push({
      pathname: '/cruise-details',
      params: {
        ...buildCruiseDetailsParams(cruise, { source: getVoyageState(cruise) === 'completed' ? 'completed' : 'booked' }),
        openFinancialEntry: '1',
      },
    } as never);
  };

  return (
    <LinearGradient colors={[EASY_SEAS_UX.color.canvas, EASY_SEAS_UX.color.sand]} style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
                <ArrowLeft size={20} color={EASY_SEAS_UX.color.brandNavy} />
              </TouchableOpacity>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>{isReceiptMode ? 'CRUISE RECEIPT' : 'VOYAGE VALUES'}</Text>
                <Text style={styles.pageTitle}>Choose a voyage</Text>
                <Text style={styles.pageSubtitle}>{isReceiptMode ? 'Attach a local Royal receipt PDF to any upcoming, current, or completed saved cruise.' : 'Enter exact totals for any upcoming, current, or completed saved cruise.'}</Text>
              </View>
            </View>

            <ThemedSectionCard
              tab="booked"
              emoji="🧾"
              title="Saved voyages"
              subtitle={`${voyages.length.toLocaleString()} matching cruise${voyages.length === 1 ? '' : 's'}`}
              compact
              testID="cruise-financial-entry-list"
            >
              <View style={styles.searchField}>
                <Search size={18} color={EASY_SEAS_UX.color.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search ship, itinerary, date, or reservation"
                  placeholderTextColor={EASY_SEAS_UX.color.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  accessibilityLabel="Search saved voyages"
                  testID="cruise-financial-entry-search"
                />
              </View>

              {voyages.length === 0 ? (
                <View style={styles.emptyState} testID="cruise-financial-entry-empty">
                  <Ship size={28} color={EASY_SEAS_UX.color.oceanTeal} />
                  <Text style={styles.emptyTitle}>No saved voyage matches</Text>
                  <Text style={styles.emptyText}>{bookedCruises.length === 0 ? `Sync or add a booked cruise before ${isReceiptMode ? 'loading a receipt' : 'entering financial totals'}.` : 'Clear the search and try another ship, date, or reservation.'}</Text>
                </View>
              ) : <ScrollView
                style={styles.voyageList}
                contentContainerStyle={styles.voyageListContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={voyages.length > 5}
                accessibilityLabel="Saved voyages grouped by sailing status"
              >
                {groupedVoyages.map((group) => <View key={group.state}>
                  <View style={styles.groupHeading}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupCount}>{group.voyages.length.toLocaleString()}</Text>
                  </View>
                  {group.voyages.map((cruise) => {
                const state = getVoyageState(cruise);
                const image = getUniqueImageForCruise(cruise.id, cruise.destination || cruise.itineraryName || '', cruise.sailDate, cruise.shipName);
                const sailDateLabel = cruise.sailDate ? formatDate(cruise.sailDate) : 'Date not recorded';
                    return (
                      <TouchableOpacity
                        key={cruise.id}
                        style={styles.voyageRow}
                        onPress={() => openTotals(cruise)}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel={`${isReceiptMode ? 'Load receipt' : 'Enter totals'} for ${cruise.shipName || 'saved voyage'}, ${sailDateLabel}`}
                        testID={`cruise-financial-entry-${cruise.id}`}
                      >
                        <Image source={{ uri: image }} style={styles.voyageImage} accessibilityIgnoresInvertColors />
                        <View style={styles.voyageCopy}>
                          <View style={styles.stateRow}>
                            <View style={[styles.stateBadge, state === 'current' && styles.currentBadge, state === 'completed' && styles.completedBadge]}>
                              <Text style={[styles.stateText, state === 'current' && styles.currentText, state === 'completed' && styles.completedText]}>{state}</Text>
                            </View>
                            <Text style={styles.nights}>{cruise.nights || '—'} nights</Text>
                          </View>
                          <Text style={styles.shipName} numberOfLines={1}>{cruise.shipName || 'Ship not recorded'}</Text>
                          <Text style={styles.itinerary} numberOfLines={1}>{cruise.itineraryName || cruise.destination || 'Itinerary not recorded'}</Text>
                          <View style={styles.dateRow}>
                            <CalendarDays size={13} color={EASY_SEAS_UX.color.oceanTeal} />
                            <Text style={styles.date}>{sailDateLabel}</Text>
                          </View>
                          <Text style={styles.identity} numberOfLines={1}>{cruise.reservationNumber || cruise.bookingId ? `Reservation ${cruise.reservationNumber || cruise.bookingId}` : 'Reservation not recorded'} · {cruise.cabinNumber || cruise.stateroomType || cruise.cabinType || cruise.stateroomCategoryCode || 'Cabin not recorded'}</Text>
                        </View>
                        <ChevronRight size={20} color={EASY_SEAS_UX.color.oceanTeal} />
                      </TouchableOpacity>
                    );
                  })}
                </View>)}
                {voyages.length > 100 ? <Text style={styles.resultLimit}>Showing the first 100 matches. Search by ship, date, or reservation to find another voyage.</Text> : null}
              </ScrollView>}
            </ThemedSectionCard>
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: EASY_SEAS_UX.color.surface, borderWidth: 1, borderColor: EASY_SEAS_UX.color.border },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: EASY_SEAS_UX.color.oceanTeal, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  pageTitle: { marginTop: 3, color: EASY_SEAS_UX.color.brandNavy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 29, lineHeight: 34 },
  pageSubtitle: { marginTop: 4, color: EASY_SEAS_UX.color.textMuted, fontSize: 13, lineHeight: 18 },
  searchField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: EASY_SEAS_UX.color.border, backgroundColor: EASY_SEAS_UX.color.surface },
  searchInput: { flex: 1, minWidth: 0, color: EASY_SEAS_UX.color.textStrong, fontSize: 14, paddingVertical: 0 },
  voyageList: { maxHeight: 560 },
  voyageListContent: { paddingBottom: 4 },
  groupHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderBottomWidth: 1, borderBottomColor: EASY_SEAS_UX.color.border },
  groupTitle: { color: EASY_SEAS_UX.color.oceanTeal, fontSize: 11, fontWeight: '900', letterSpacing: 0.75, textTransform: 'uppercase' },
  groupCount: { color: EASY_SEAS_UX.color.textMuted, fontSize: 11, fontWeight: '700' },
  voyageRow: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: EASY_SEAS_UX.color.border },
  voyageImage: { width: 76, height: 86, borderRadius: 12, backgroundColor: EASY_SEAS_UX.color.seafoam },
  voyageCopy: { flex: 1, minWidth: 0 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  stateBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: EASY_SEAS_UX.color.seafoam },
  currentBadge: { backgroundColor: '#E1F3E8' },
  completedBadge: { backgroundColor: '#EEF1F3' },
  stateText: { color: EASY_SEAS_UX.color.oceanTeal, fontSize: 9, fontWeight: '900', letterSpacing: 0.65, textTransform: 'uppercase' },
  currentText: { color: EASY_SEAS_UX.color.success },
  completedText: { color: EASY_SEAS_UX.color.textMuted },
  nights: { color: EASY_SEAS_UX.color.textMuted, fontSize: 11 },
  shipName: { color: EASY_SEAS_UX.color.brandNavy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 17, lineHeight: 21 },
  itinerary: { marginTop: 1, color: EASY_SEAS_UX.color.textMuted, fontSize: 12, lineHeight: 16 },
  dateRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { color: EASY_SEAS_UX.color.textStrong, fontSize: 11, fontWeight: '600' },
  identity: { marginTop: 4, color: EASY_SEAS_UX.color.textMuted, fontSize: 10, lineHeight: 14 },
  resultLimit: { paddingVertical: 12, color: EASY_SEAS_UX.color.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 16 },
  emptyTitle: { marginTop: 10, color: EASY_SEAS_UX.color.brandNavy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18 },
  emptyText: { marginTop: 4, color: EASY_SEAS_UX.color.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
