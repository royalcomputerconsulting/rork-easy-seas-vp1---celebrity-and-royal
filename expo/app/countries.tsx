import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Anchor, CalendarDays, ChevronLeft, Globe2, MapPin, Ship } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCoreData } from '@/state/CoreDataProvider';
import { ADMIN_EMAILS, useAuth } from '@/state/AuthProvider';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { COMPLETED_CRUISES_DATA } from '@/mocks/completedCruises';
import { buildCountryVisits, summarizeVisitsByYear, type CountryVisit, type CruiseCountryFilter } from '@/lib/cruiseCountries';
import { createDateFromString } from '@/lib/date';
import type { BookedCruise } from '@/types/models';

const FILTERS: { key: CruiseCountryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getInitialFilter(value: string | string[] | undefined): CruiseCountryFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'upcoming' || raw === 'completed') return raw;
  return 'all';
}

function formatVisitDate(date: string): string {
  return createDateFromString(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCruiseIdentity(cruise: BookedCruise): string {
  const directId = cruise.reservationNumber || cruise.bookingId || cruise.bwoNumber;
  if (directId) return `reservation:${directId.toLowerCase().trim()}`;
  return `sailing:${cruise.shipName.toLowerCase().trim()}:${cruise.sailDate}:${cruise.returnDate}:${(cruise.itineraryName || cruise.destination || '').toLowerCase().trim()}`;
}

function mergeCruiseData(primaryCruises: BookedCruise[], fallbackCruises: BookedCruise[]): BookedCruise[] {
  const cruiseMap = new Map<string, BookedCruise>();
  fallbackCruises.forEach((cruise) => cruiseMap.set(getCruiseIdentity(cruise), cruise));
  primaryCruises.forEach((cruise) => cruiseMap.set(getCruiseIdentity(cruise), cruise));
  return Array.from(cruiseMap.values());
}

export default function CountriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { bookedCruises, cruises } = useCoreData();
  const { authenticatedEmail } = useAuth();
  const [filter, setFilter] = useState<CruiseCountryFilter>(() => getInitialFilter(params.filter));

  const sourceCruises = useMemo(() => {
    const normalizedEmail = authenticatedEmail?.toLowerCase().trim() ?? null;
    const shouldIncludeKnownAdminCruises = !!normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail as typeof ADMIN_EMAILS[number]);
    const knownAdminCruises = shouldIncludeKnownAdminCruises ? [...COMPLETED_CRUISES_DATA, ...BOOKED_CRUISES_DATA] : [];
    const bookedLikeCruises = cruises.filter((cruise) => cruise.status === 'booked' || cruise.status === 'completed' || Boolean((cruise as BookedCruise).reservationNumber || (cruise as BookedCruise).bookingId));
    const storedCruises = mergeCruiseData(bookedCruises, bookedLikeCruises);
    const mergedCruises = mergeCruiseData(storedCruises, knownAdminCruises);
    console.log('[Countries] Resolved country cruise source:', {
      authenticatedEmail: normalizedEmail,
      storedBookedCruises: bookedCruises.length,
      storedBookedLikeCruises: bookedLikeCruises.length,
      knownAdminCruises: knownAdminCruises.length,
      mergedCruises: mergedCruises.length,
    });
    return mergedCruises;
  }, [authenticatedEmail, bookedCruises, cruises]);

  const visits = useMemo(() => {
    const builtVisits = buildCountryVisits(sourceCruises, filter);
    console.log('[Countries] Built country visits:', {
      cruises: sourceCruises.length,
      visits: builtVisits.length,
      filter,
    });
    return builtVisits;
  }, [sourceCruises, filter]);

  const summaries = useMemo(() => summarizeVisitsByYear(visits), [visits]);
  const yearOptions = useMemo(() => summaries.map((summary) => summary.year), [summaries]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const activeYear = selectedYear ?? yearOptions[0] ?? new Date().getFullYear();

  const activeYearVisits = useMemo(() => visits.filter((visit) => visit.year === activeYear), [activeYear, visits]);
  const activeYearCountries = useMemo(
    () => Array.from(new Set(activeYearVisits.map((visit) => visit.country))).sort((a, b) => a.localeCompare(b)),
    [activeYearVisits]
  );
  const activeYearPorts = useMemo(
    () => Array.from(new Set(activeYearVisits.map((visit) => visit.port))).sort((a, b) => a.localeCompare(b)),
    [activeYearVisits]
  );
  const lifetimeCountries = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.country))).sort((a, b) => a.localeCompare(b)),
    [visits]
  );

  const visitsByMonth = useMemo(() => {
    const grouped = new Map<number, CountryVisit[]>();
    activeYearVisits.forEach((visit) => {
      const month = createDateFromString(visit.date).getMonth();
      const current = grouped.get(month) ?? [];
      current.push(visit);
      grouped.set(month, current);
    });
    return grouped;
  }, [activeYearVisits]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <View style={styles.container} testID="countries-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.75} testID="countries-back-button">
                <ChevronLeft size={22} color={COLORS.navyDeep} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Countries</Text>
              <View style={styles.headerSpacer} />
            </View>

            <LinearGradient
              colors={[COLORS.navyDeep, '#0B7285', '#0E7490']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconBadge}>
                  <Globe2 size={26} color={COLORS.white} />
                </View>
                <View style={styles.heroTextGroup}>
                  <Text style={styles.heroEyebrow}>PORTS & COUNTRIES</Text>
                  <Text style={styles.heroTitle}>Your cruise map by year</Text>
                </View>
              </View>
              <Text style={styles.heroSubtitle}>See the countries and ports from your upcoming and completed cruises using your booked cruise data.</Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{lifetimeCountries.length}</Text>
                  <Text style={styles.heroStatLabel}>Countries</Text>
                </View>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{visits.length}</Text>
                  <Text style={styles.heroStatLabel}>Port visits</Text>
                </View>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{yearOptions.length}</Text>
                  <Text style={styles.heroStatLabel}>Years</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.filterRow} testID="countries-filter-tabs">
              {FILTERS.map((item) => {
                const isActive = filter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => {
                      console.log('[Countries] Filter selected:', item.key);
                      setFilter(item.key);
                      setSelectedYear(null);
                    }}
                    activeOpacity={0.78}
                    testID={`countries-filter-${item.key}`}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {yearOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScrollContent}>
                {yearOptions.map((year) => {
                  const isActive = year === activeYear;
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[styles.yearPill, isActive && styles.yearPillActive]}
                      onPress={() => {
                        console.log('[Countries] Year selected:', year);
                        setSelectedYear(year);
                      }}
                      activeOpacity={0.78}
                      testID={`countries-year-${year}`}
                    >
                      <CalendarDays size={14} color={isActive ? COLORS.white : COLORS.navyDeep} />
                      <Text style={[styles.yearPillText, isActive && styles.yearPillTextActive]}>{year}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {visits.length === 0 ? (
              <View style={styles.emptyCard} testID="countries-empty-state">
                <View style={styles.emptyIconBadge}>
                  <MapPin size={34} color={COLORS.navyDeep} />
                </View>
                <Text style={styles.emptyTitle}>No countries found yet</Text>
                <Text style={styles.emptyText}>Add booked cruises with ports or itineraries, then return here to see your yearly country calendar.</Text>
              </View>
            ) : (
              <>
                <View style={styles.yearSummaryCard} testID="countries-year-summary">
                  <Text style={styles.sectionEyebrow}>{activeYear}</Text>
                  <Text style={styles.sectionTitle}>{activeYearCountries.length} countries • {activeYearPorts.length} ports</Text>
                  <View style={styles.countryChipsWrap}>
                    {activeYearCountries.map((country) => (
                      <View key={country} style={styles.countryChip}>
                        <Text style={styles.countryChipText}>{country}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.calendarGrid} testID="countries-year-calendar">
                  {MONTH_LABELS.map((month, index) => {
                    const monthVisits = visitsByMonth.get(index) ?? [];
                    const monthCountries = Array.from(new Set(monthVisits.map((visit) => visit.country)));
                    return (
                      <View key={month} style={[styles.monthCard, monthVisits.length > 0 && styles.monthCardActive]}>
                        <Text style={[styles.monthLabel, monthVisits.length > 0 && styles.monthLabelActive]}>{month}</Text>
                        {monthVisits.length > 0 ? (
                          <>
                            <Text style={styles.monthCount}>{monthCountries.length} {monthCountries.length === 1 ? 'country' : 'countries'}</Text>
                            <Text style={styles.monthCountries} numberOfLines={3}>{monthCountries.join(', ')}</Text>
                          </>
                        ) : (
                          <Text style={styles.monthEmpty}>No ports</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.visitsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Anchor size={18} color={COLORS.navyDeep} />
                    <Text style={styles.visitsSectionTitle}>Port visits in {activeYear}</Text>
                  </View>
                  {activeYearVisits.map((visit) => (
                    <View key={visit.id} style={styles.visitCard} testID="countries-visit-card">
                      <View style={styles.visitIconBadge}>
                        <MapPin size={16} color={COLORS.white} />
                      </View>
                      <View style={styles.visitTextGroup}>
                        <Text style={styles.visitTitle}>{visit.port}</Text>
                        <Text style={styles.visitSubtitle}>{visit.country} • {formatVisitDate(visit.date)}</Text>
                        <View style={styles.visitShipRow}>
                          <Ship size={12} color={COLORS.textMuted} />
                          <Text style={styles.visitShipText}>{visit.shipName} • {visit.cruiseName}</Text>
                        </View>
                      </View>
                      <View style={[styles.visitStatusPill, visit.isCompleted ? styles.completedPill : styles.upcomingPill]}>
                        <Text style={[styles.visitStatusText, visit.isCompleted ? styles.completedText : styles.upcomingText]}>
                          {visit.isCompleted ? 'Done' : 'Soon'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F1',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  headerSpacer: {
    width: 42,
  },
  heroCard: {
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  heroIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroTextGroup: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    color: COLORS.beigeLight,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '900' as const,
    color: COLORS.white,
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
    marginBottom: SPACING.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroStatPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroStatValue: {
    fontSize: 21,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 4,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  filterPillActive: {
    backgroundColor: COLORS.navyDeep,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  yearScrollContent: {
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.md,
  },
  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  yearPillActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  yearPillTextActive: {
    color: COLORS.white,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: SPACING.md,
  },
  emptyIconBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  yearSummaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.tealAccent,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  countryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  countryChip: {
    backgroundColor: 'rgba(0,151,167,0.1)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,151,167,0.18)',
  },
  countryChipText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  monthCard: {
    width: '31.9%',
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  monthCardActive: {
    backgroundColor: COLORS.white,
    borderColor: 'rgba(0,151,167,0.35)',
    ...SHADOW.sm,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  monthLabelActive: {
    color: COLORS.tealAccent,
  },
  monthCount: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  monthCountries: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textDarkGrey,
  },
  monthEmpty: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  visitsSection: {
    gap: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  visitsSectionTitle: {
    fontSize: 17,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  visitIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.tealAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitTextGroup: {
    flex: 1,
  },
  visitTitle: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  visitSubtitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  visitShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  visitShipText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  visitStatusPill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  completedPill: {
    backgroundColor: 'rgba(5,150,105,0.12)',
  },
  upcomingPill: {
    backgroundColor: 'rgba(245,158,11,0.14)',
  },
  visitStatusText: {
    fontSize: 11,
    fontWeight: '900' as const,
  },
  completedText: {
    color: COLORS.success,
  },
  upcomingText: {
    color: COLORS.warning,
  },
});
