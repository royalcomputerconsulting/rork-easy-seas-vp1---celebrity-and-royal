import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Award, CalendarDays, Clock, Gift, MapPin, Plane, Ship, User, Users } from 'lucide-react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { createDateFromString } from '@/lib/date';
import { deriveCruiseDayPlan } from '@/lib/cruisePlanningIntelligence';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { getNormalizedCruiseDateRange } from '@/lib/calendar/cruiseEvents';
import type { BookedCruise, CalendarEvent, CasinoOffer } from '@/types/models';

const DAY_COLORS = {
  sea: '#2563EB',
  port: '#16A34A',
  land: '#94A3B8',
  gap: '#DC2626',
  expiration: '#D97706',
  tier: '#7C3AED',
  personal: '#EA580C',
} as const;

type PassengerDayKind = keyof typeof DAY_COLORS;
type PassengerFilter = 'all' | PassengerDayKind | 'shared' | 'solo';

interface PassengerDayItem {
  id: string;
  date: string;
  kind: PassengerDayKind;
  title: string;
  subtitle: string;
  color: string;
  cruiseId?: string;
  sharedType?: 'Shared' | 'Solo';
}

const FILTERS: { id: PassengerFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sea', label: 'Sea' },
  { id: 'port', label: 'Port' },
  { id: 'land', label: 'Land' },
  { id: 'gap', label: 'Gaps' },
  { id: 'expiration', label: 'Expiry' },
  { id: 'tier', label: 'Tier' },
  { id: 'shared', label: 'Shared' },
  { id: 'solo', label: 'Solo' },
];

function formatDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getMonthLabel(dateString: string): string {
  const date = createDateFromString(dateString);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function buildPassengerDayItems(input: {
  bookedCruises: BookedCruise[];
  calendarEvents: CalendarEvent[];
  offers: CasinoOffer[];
  certificates: { id: string; label?: string; type?: string; expiryDate?: string }[];
}): PassengerDayItem[] {
  const items = new Map<string, PassengerDayItem>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const todayString = formatDateOnly(today);
  const yearEndString = formatDateOnly(yearEnd);

  const addItem = (item: PassengerDayItem) => {
    if (!items.has(item.id)) items.set(item.id, item);
  };

  input.bookedCruises.forEach((cruise) => {
    const sailDate = createDateFromString(cruise.sailDate);
    if (Number.isNaN(sailDate.getTime())) return;
    const sharedType: 'Shared' | 'Solo' = (cruise.guestNames?.length ?? cruise.guests ?? 1) > 1 ? 'Shared' : 'Solo';
    deriveCruiseDayPlan(cruise).forEach((plan) => {
      const dayDate = new Date(sailDate);
      dayDate.setDate(sailDate.getDate() + plan.day - 1);
      const date = formatDateOnly(dayDate);
      const isSea = plan.isSeaDay;
      addItem({
        id: `passenger-${cruise.id}-${plan.day}`,
        date,
        kind: isSea ? 'sea' : 'port',
        title: isSea ? 'Day at Sea' : plan.isEmbarkation ? 'Embarkation Day' : plan.isDisembarkation ? 'Disembarkation Day' : 'Port Day',
        subtitle: `${cruise.shipName} • ${plan.port || cruise.departurePort || 'Cruise'} • ${sharedType}`,
        color: isSea ? DAY_COLORS.sea : DAY_COLORS.port,
        cruiseId: cruise.id,
        sharedType,
      });
    });
  });

  const sortedCruises = [...input.bookedCruises].sort((left, right) => createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime());
  sortedCruises.forEach((cruise, index) => {
    const nextCruise = sortedCruises[index + 1];
    if (!nextCruise) return;
    const returnDate = createDateFromString(cruise.returnDate || cruise.sailDate);
    const nextSailDate = createDateFromString(nextCruise.sailDate);
    if (Number.isNaN(returnDate.getTime()) || Number.isNaN(nextSailDate.getTime())) return;
    const gapStart = new Date(returnDate);
    gapStart.setDate(returnDate.getDate() + 1);
    const gapEnd = new Date(nextSailDate);
    gapEnd.setDate(nextSailDate.getDate() - 1);
    if (gapStart <= gapEnd) {
      addItem({
        id: `gap-${cruise.id}-${nextCruise.id}`,
        date: formatDateOnly(gapStart),
        kind: 'gap',
        title: 'Travel Gap',
        subtitle: `${Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1} land day(s) before ${nextCruise.shipName}`,
        color: DAY_COLORS.gap,
      });
    }
  });

  input.calendarEvents.forEach((event) => {
    const date = (event.startDate || event.start || '').split('T')[0];
    if (!date) return;
    addItem({
      id: `personal-${event.id}`,
      date,
      kind: 'personal',
      title: event.title,
      subtitle: event.location || event.type,
      color: DAY_COLORS.personal,
    });
  });

  input.offers.forEach((offer) => {
    const expiry = offer.expiryDate || offer.expires || offer.offerExpiryDate;
    if (!expiry) return;
    addItem({
      id: `offer-expiration-${offer.id}`,
      date: expiry.split('T')[0],
      kind: 'expiration',
      title: 'Offer Expiration',
      subtitle: offer.offerCode || offer.offerName || offer.title || 'Casino offer',
      color: DAY_COLORS.expiration,
    });
  });

  input.certificates.forEach((certificate) => {
    if (!certificate.expiryDate) return;
    addItem({
      id: `certificate-expiration-${certificate.id}`,
      date: certificate.expiryDate.split('T')[0],
      kind: 'expiration',
      title: 'Certificate Expiration',
      subtitle: certificate.label || certificate.type || 'Certificate',
      color: DAY_COLORS.expiration,
    });
  });

  input.bookedCruises.forEach((cruise) => {
    const points = cruise.earnedPoints || cruise.casinoPoints || 0;
    if (points <= 0) return;
    addItem({
      id: `tier-milestone-${cruise.id}`,
      date: cruise.returnDate || cruise.sailDate,
      kind: 'tier',
      title: 'Tier Milestone',
      subtitle: `${points.toLocaleString()} casino points from ${cruise.shipName}`,
      color: DAY_COLORS.tier,
      cruiseId: cruise.id,
    });
  });

  for (let cursor = new Date(today); cursor <= yearEnd; cursor.setDate(cursor.getDate() + 1)) {
    const date = formatDateOnly(cursor);
    const hasSailing = Array.from(items.values()).some((item) => item.date === date && (item.kind === 'sea' || item.kind === 'port'));
    if (!hasSailing) {
      addItem({
        id: `land-${date}`,
        date,
        kind: 'land',
        title: 'Land Day',
        subtitle: 'No sailing loaded for this date',
        color: DAY_COLORS.land,
      });
    }
  }

  return Array.from(items.values())
    .filter((item) => item.date >= todayString && item.date <= yearEndString)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export default function PassengerCalendarScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { localData } = useAppState();
  const { bookedCruises } = useCoreData();
  const { certificates } = useCertificates();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const [activeFilter, setActiveFilter] = useState<PassengerFilter>('all');

  const filterSnapshot = useMemo(() => ({ selectedProfileId, selectedBrand, selectedProgram }), [selectedBrand, selectedProfileId, selectedProgram]);

  const normalizedBookedCruises = useMemo((): BookedCruise[] => {
    return filterRecordsByIntelligence(bookedCruises, filterSnapshot, users)
      .map((cruise) => {
        const range = getNormalizedCruiseDateRange(cruise);
        return range ? { ...cruise, sailDate: range.sailDate, returnDate: range.returnDate } : null;
      })
      .filter((cruise): cruise is BookedCruise => cruise !== null);
  }, [bookedCruises, filterSnapshot, users]);

  const sourceEvents = useMemo(() => {
    const mergedEvents = [...((localData.calendar || []) as CalendarEvent[]), ...((localData.tripit || []) as CalendarEvent[])];
    return filterRecordsByIntelligence(mergedEvents, filterSnapshot, users);
  }, [filterSnapshot, localData.calendar, localData.tripit, users]);

  const filteredOffers = useMemo(() => filterRecordsByIntelligence((localData.offers || []) as CasinoOffer[], filterSnapshot, users), [filterSnapshot, localData.offers, users]);
  const filteredCertificates = useMemo(() => filterRecordsByIntelligence(certificates, filterSnapshot, users), [certificates, filterSnapshot, users]);

  const passengerItems = useMemo(() => buildPassengerDayItems({
    bookedCruises: normalizedBookedCruises,
    calendarEvents: sourceEvents,
    offers: filteredOffers,
    certificates: filteredCertificates,
  }), [filteredCertificates, filteredOffers, normalizedBookedCruises, sourceEvents]);

  const visibleItems = useMemo(() => {
    if (activeFilter === 'all') return passengerItems;
    if (activeFilter === 'shared') return passengerItems.filter((item) => item.sharedType === 'Shared');
    if (activeFilter === 'solo') return passengerItems.filter((item) => item.sharedType === 'Solo');
    return passengerItems.filter((item) => item.kind === activeFilter);
  }, [activeFilter, passengerItems]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, PassengerDayItem[]>();
    visibleItems.forEach((item) => {
      const label = getMonthLabel(item.date);
      const group = groups.get(label) ?? [];
      group.push(item);
      groups.set(label, group);
    });
    return Array.from(groups.entries());
  }, [visibleItems]);

  const summary = useMemo(() => ({
    sea: passengerItems.filter((item) => item.kind === 'sea').length,
    port: passengerItems.filter((item) => item.kind === 'port').length,
    land: passengerItems.filter((item) => item.kind === 'land').length,
    expirations: passengerItems.filter((item) => item.kind === 'expiration').length,
    shared: passengerItems.filter((item) => item.sharedType === 'Shared').length,
    solo: passengerItems.filter((item) => item.sharedType === 'Solo').length,
  }), [passengerItems]);

  const timelineListMaxHeight = useMemo(() => Math.max(360, Math.min(640, windowHeight * 0.58)), [windowHeight]);

  const handleItemPress = useCallback((item: PassengerDayItem) => {
    if (item.cruiseId) {
      router.push({ pathname: '/(tabs)/(overview)/cruise-details' as any, params: { id: item.cruiseId } });
      return;
    }
    router.push({ pathname: '/day-agenda' as any, params: { date: item.date } });
  }, [router]);

  const renderIcon = (item: PassengerDayItem) => {
    const Icon = item.kind === 'sea' ? Ship : item.kind === 'port' ? MapPin : item.kind === 'expiration' ? Gift : item.kind === 'tier' ? Award : item.kind === 'gap' ? Plane : item.kind === 'personal' ? User : Clock;
    return <Icon size={16} color={item.color} />;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <View style={styles.heroCard}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8} testID="passenger-calendar-back">
                <ArrowLeft size={18} color={COLORS.white} />
              </TouchableOpacity>
              <View style={styles.heroIcon}><CalendarDays size={26} color="#A7F3D0" /></View>
              <Text style={styles.heroEyebrow}>Permanent Passenger Calendar</Text>
              <Text style={styles.heroTitle}>Your year at sea, on land, and on deadline.</Text>
              <Text style={styles.heroSubtitle}>Full drill-down for passenger days, port days, expirations, gaps, shared sailings, and solo travel.</Text>
            </View>

            <IntelligenceFilterStrip contextLabel="Passenger Calendar" />

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}><Text style={styles.summaryValue}>{summary.sea}</Text><Text style={styles.summaryLabel}>Sea</Text></View>
              <View style={styles.summaryCell}><Text style={styles.summaryValue}>{summary.port}</Text><Text style={styles.summaryLabel}>Port</Text></View>
              <View style={styles.summaryCell}><Text style={styles.summaryValue}>{summary.land}</Text><Text style={styles.summaryLabel}>Land</Text></View>
              <View style={styles.summaryCell}><Text style={styles.summaryValue}>{summary.expirations}</Text><Text style={styles.summaryLabel}>Expiry</Text></View>
              <View style={styles.summaryCell}><Text style={styles.summaryValue}>{summary.shared}</Text><Text style={styles.summaryLabel}>Shared</Text></View>
              <View style={styles.summaryCell}><Text style={styles.summaryValue}>{summary.solo}</Text><Text style={styles.summaryLabel}>Solo</Text></View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} testID="passenger-calendar-filter-row">
              {FILTERS.map((filter) => {
                const active = activeFilter === filter.id;
                return (
                  <TouchableOpacity key={filter.id} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setActiveFilter(filter.id)} activeOpacity={0.78} testID={`passenger-filter-${filter.id}`}>
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.timelineCard} testID="passenger-calendar-drilldown">
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineTitle}>Schedule Drill-Down</Text>
                <Text style={styles.timelineCount}>{visibleItems.length}</Text>
              </View>

              {groupedItems.length === 0 ? (
                <View style={styles.emptyCard}>
                  <CalendarDays size={42} color={COLORS.navyDeep} />
                  <Text style={styles.emptyTitle}>No passenger days found</Text>
                  <Text style={styles.emptyText}>Try another filter or import booked cruises and calendar data.</Text>
                </View>
              ) : (
                <ScrollView
                  style={[styles.timelineList, { maxHeight: timelineListMaxHeight }]}
                  contentContainerStyle={styles.timelineListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  testID="passenger-calendar-scrollable-days"
                >
                  {groupedItems.map(([month, items]) => (
                    <View key={month} style={styles.monthGroup}>
                      <Text style={styles.monthLabel}>{month}</Text>
                      {items.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.timelineItem} onPress={() => handleItemPress(item)} activeOpacity={0.78} testID={`passenger-calendar-item-${item.id}`}>
                          <View style={[styles.timelineRail, { backgroundColor: item.color }]} />
                          <View style={[styles.timelineIcon, { backgroundColor: `${item.color}22` }]}>{renderIcon(item)}</View>
                          <View style={styles.timelineCopy}>
                            <View style={styles.timelineTitleRow}>
                              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                              {item.sharedType ? <Text style={styles.sharedBadge}>{item.sharedType}</Text> : null}
                            </View>
                            <Text style={styles.itemSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                          </View>
                          <Text style={styles.itemDate}>{item.date.slice(5)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0F2F1' },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  heroCard: {
    margin: SPACING.md,
    borderRadius: 28,
    padding: SPACING.lg,
    backgroundColor: COLORS.navyDeep,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 243, 208, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.25)',
    marginBottom: SPACING.md,
  },
  heroEyebrow: { fontSize: 12, fontWeight: '900' as const, color: '#A7F3D0', letterSpacing: 1, textTransform: 'uppercase' as const },
  heroTitle: { marginTop: 6, fontSize: 28, fontWeight: '900' as const, color: COLORS.white, lineHeight: 34 },
  heroSubtitle: { marginTop: SPACING.sm, fontSize: TYPOGRAPHY.fontSizeSM, color: 'rgba(255,255,255,0.78)', lineHeight: 20 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginHorizontal: SPACING.md, marginTop: SPACING.md },
  summaryCell: { width: '31.5%', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(0,31,63,0.08)', ...SHADOW.sm },
  summaryValue: { fontSize: 24, fontWeight: '900' as const, color: COLORS.navyDeep },
  summaryLabel: { marginTop: 2, fontSize: 11, fontWeight: '800' as const, color: COLORS.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  filterRow: { gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: BORDER_RADIUS.round, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#CBD5E1' },
  filterChipActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep },
  filterChipText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold, color: COLORS.navyDeep },
  filterChipTextActive: { color: COLORS.white },
  timelineCard: { marginHorizontal: SPACING.md, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(0,31,63,0.1)', ...SHADOW.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  timelineTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' as const, color: COLORS.navyDeep },
  timelineCount: { overflow: 'hidden', backgroundColor: COLORS.navyDeep, color: COLORS.white, borderRadius: BORDER_RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: 4, fontWeight: '900' as const },
  timelineList: { borderRadius: BORDER_RADIUS.lg },
  timelineListContent: { paddingBottom: SPACING.sm },
  monthGroup: { marginBottom: SPACING.md },
  monthLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' as const, color: COLORS.navyDeep, marginBottom: SPACING.sm, textTransform: 'uppercase' as const, letterSpacing: 0.7 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: SPACING.xs, overflow: 'hidden' },
  timelineRail: { width: 5, alignSelf: 'stretch' },
  timelineIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.sm },
  timelineCopy: { flex: 1, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  itemTitle: { flex: 1, fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' as const, color: COLORS.navyDeep },
  sharedBadge: { overflow: 'hidden', fontSize: 10, fontWeight: '900' as const, color: '#0F766E', backgroundColor: '#CCFBF1', borderRadius: BORDER_RADIUS.round, paddingHorizontal: 7, paddingVertical: 2 },
  itemSubtitle: { marginTop: 2, fontSize: TYPOGRAPHY.fontSizeXS, color: COLORS.textSecondary, lineHeight: 16 },
  itemDate: { fontSize: TYPOGRAPHY.fontSizeXS, fontWeight: '900' as const, color: COLORS.navyDeep, paddingRight: SPACING.sm },
  emptyCard: { alignItems: 'center', padding: SPACING.xl },
  emptyTitle: { marginTop: SPACING.md, fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' as const, color: COLORS.navyDeep },
  emptyText: { marginTop: SPACING.xs, fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, textAlign: 'center' },
});
