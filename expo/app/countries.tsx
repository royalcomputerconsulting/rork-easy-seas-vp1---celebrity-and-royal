import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Anchor, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Globe2, MapPin, Ship } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCoreData } from '@/state/CoreDataProvider';
import { ADMIN_EMAILS, useAuth } from '@/state/AuthProvider';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { COMPLETED_CRUISES_DATA } from '@/mocks/completedCruises';
import { CRUISE_HISTORY_SUPPLEMENT_DATA } from '@/mocks/cruiseHistorySupplement';
import { buildCountryVisits, summarizeVisitsByYear, type CountryVisit, type CruiseCountryFilter } from '@/lib/cruiseCountries';
import { createDateFromString } from '@/lib/date';
import type { BookedCruise } from '@/types/models';

const FILTERS: { key: CruiseCountryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DetailMode = 'countries' | 'ports' | null;

type CountryListItem = {
  country: string;
  visitCount: number;
  portCount: number;
  shipCount: number;
  latestDate: string;
};

type PortDestinationListItem = {
  key: string;
  port: string;
  country: string;
  visitCount: number;
  shipCount: number;
  latestDate: string;
  visits: CountryVisit[];
};

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

function getDestinationKey(visit: CountryVisit): string {
  return `${visit.port.toLowerCase().trim()}|${visit.country.toLowerCase().trim()}`;
}

function formatCount(value: number, singular: string, plural: string = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showYearFilter, setShowYearFilter] = useState<boolean>(false);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [expandedDestinationKey, setExpandedDestinationKey] = useState<string | null>(null);

  const sourceCruises = useMemo(() => {
    const normalizedEmail = authenticatedEmail?.toLowerCase().trim() ?? null;
    const shouldIncludeKnownAdminCruises = !!normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail as typeof ADMIN_EMAILS[number]);
    const knownAdminCruises = shouldIncludeKnownAdminCruises ? [...COMPLETED_CRUISES_DATA, ...BOOKED_CRUISES_DATA, ...CRUISE_HISTORY_SUPPLEMENT_DATA] : [];
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

  const lifetimeCountryRows = useMemo<CountryListItem[]>(() => {
    const countryMap = new Map<string, CountryVisit[]>();
    visits.forEach((visit) => {
      const current = countryMap.get(visit.country) ?? [];
      current.push(visit);
      countryMap.set(visit.country, current);
    });

    return Array.from(countryMap.entries())
      .map(([country, countryVisits]) => {
        const latestVisit = [...countryVisits].sort((left, right) => {
          const leftTime = createDateFromString(left.date).getTime();
          const rightTime = createDateFromString(right.date).getTime();
          return rightTime - leftTime;
        })[0];

        return {
          country,
          visitCount: countryVisits.length,
          portCount: new Set(countryVisits.map((visit) => visit.port)).size,
          shipCount: new Set(countryVisits.map((visit) => visit.shipName)).size,
          latestDate: latestVisit?.date ?? countryVisits[0]?.date ?? '',
        };
      })
      .sort((left, right) => left.country.localeCompare(right.country));
  }, [visits]);

  const destinationRows = useMemo<PortDestinationListItem[]>(() => {
    const destinationMap = new Map<string, CountryVisit[]>();
    visits.forEach((visit) => {
      const key = getDestinationKey(visit);
      const current = destinationMap.get(key) ?? [];
      current.push(visit);
      destinationMap.set(key, current);
    });

    return Array.from(destinationMap.entries())
      .map(([key, destinationVisits]) => {
        const sortedVisits = [...destinationVisits].sort((left, right) => {
          const leftTime = createDateFromString(left.date).getTime();
          const rightTime = createDateFromString(right.date).getTime();
          return rightTime - leftTime;
        });
        const firstVisit = sortedVisits[0];

        return {
          key,
          port: firstVisit?.port ?? 'Unknown destination',
          country: firstVisit?.country ?? 'Unknown country',
          visitCount: sortedVisits.length,
          shipCount: new Set(sortedVisits.map((visit) => visit.shipName)).size,
          latestDate: firstVisit?.date ?? '',
          visits: sortedVisits,
        };
      })
      .sort((left, right) => left.port.localeCompare(right.port));
  }, [visits]);

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

  const handleCountriesSummaryPress = useCallback(() => {
    console.log('[Countries] Countries summary pressed:', { countries: lifetimeCountries.length, filter });
    setDetailMode((current) => (current === 'countries' ? null : 'countries'));
  }, [filter, lifetimeCountries.length]);

  const handlePortVisitsSummaryPress = useCallback(() => {
    console.log('[Countries] Port visits summary pressed:', { visits: visits.length, destinations: destinationRows.length, filter });
    setDetailMode((current) => (current === 'ports' ? null : 'ports'));
    setExpandedDestinationKey(null);
  }, [destinationRows.length, filter, visits.length]);

  const handleDestinationPress = useCallback((destination: PortDestinationListItem) => {
    console.log('[Countries] Destination row pressed:', {
      port: destination.port,
      country: destination.country,
      visits: destination.visitCount,
    });
    setExpandedDestinationKey((current) => (current === destination.key ? null : destination.key));
  }, []);

  const handleCloseDetailPanel = useCallback(() => {
    console.log('[Countries] Detail panel closed');
    setDetailMode(null);
    setExpandedDestinationKey(null);
  }, []);

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
                <TouchableOpacity
                  style={[styles.heroStatPill, detailMode === 'countries' && styles.heroStatPillActive]}
                  onPress={handleCountriesSummaryPress}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${lifetimeCountries.length} countries`}
                  testID="countries-summary-countries-button"
                >
                  <Text style={styles.heroStatValue}>{lifetimeCountries.length}</Text>
                  <Text style={styles.heroStatLabel}>Countries</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heroStatPill, detailMode === 'ports' && styles.heroStatPillActive]}
                  onPress={handlePortVisitsSummaryPress}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${visits.length} port visits`}
                  testID="countries-summary-port-visits-button"
                >
                  <Text style={styles.heroStatValue}>{visits.length}</Text>
                  <Text style={styles.heroStatLabel}>Port visits</Text>
                </TouchableOpacity>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{yearOptions.length}</Text>
                  <Text style={styles.heroStatLabel}>Years</Text>
                </View>
              </View>
            </LinearGradient>

            {detailMode !== null && visits.length > 0 && (
              <View style={styles.detailPanel} testID={`countries-detail-panel-${detailMode}`}>
                <View style={styles.detailHeaderRow}>
                  <View style={styles.detailHeaderTitleRow}>
                    {detailMode === 'countries' ? <Globe2 size={18} color={COLORS.navyDeep} /> : <Anchor size={18} color={COLORS.navyDeep} />}
                    <Text style={styles.detailTitle}>{detailMode === 'countries' ? `${lifetimeCountries.length} countries` : `${destinationRows.length} destinations`}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detailCloseButton}
                    onPress={handleCloseDetailPanel}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel="Close list"
                    testID="countries-detail-close-button"
                  >
                    <Text style={styles.detailCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.detailSubtitle}>{detailMode === 'ports' ? `${formatCount(visits.length, 'individual port visit')} batched by destination` : filter === 'all' ? 'All upcoming and completed cruises' : filter === 'completed' ? 'Completed cruises only' : 'Upcoming cruises only'}</Text>
                {detailMode === 'countries' ? (
                  <View style={styles.detailList} testID="countries-all-countries-list">
                    {lifetimeCountryRows.map((item, index) => (
                      <View key={item.country} style={styles.detailRow} testID={`countries-country-row-${index}`}>
                        <View style={styles.detailIndexBadge}>
                          <Text style={styles.detailIndexText}>{index + 1}</Text>
                        </View>
                        <View style={styles.detailTextGroup}>
                          <Text style={styles.detailRowTitle}>{item.country}</Text>
                          <Text style={styles.detailRowSubtitle}>{item.visitCount} visits • {item.portCount} ports • {item.shipCount} ships</Text>
                        </View>
                        {item.latestDate.length > 0 && <Text style={styles.detailDateText}>{formatVisitDate(item.latestDate)}</Text>}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.detailList} testID="countries-all-port-visits-list">
                    {destinationRows.map((destination, index) => {
                      const isExpanded = expandedDestinationKey === destination.key;
                      return (
                        <View key={destination.key} style={styles.destinationGroup} testID={`countries-destination-group-${index}`}>
                          <TouchableOpacity
                            style={[styles.detailRow, isExpanded && styles.detailRowExpanded]}
                            onPress={() => handleDestinationPress(destination)}
                            activeOpacity={0.78}
                            accessibilityRole="button"
                            accessibilityLabel={`Show ${destination.visitCount} visits to ${destination.port}`}
                            testID={`countries-destination-row-${index}`}
                          >
                            <View style={[styles.detailIndexBadge, styles.detailPortIndexBadge]}>
                              <Text style={styles.detailIndexText}>{destination.visitCount}</Text>
                            </View>
                            <View style={styles.detailTextGroup}>
                              <Text style={styles.detailRowTitle}>{destination.port}</Text>
                              <Text style={styles.detailRowSubtitle}>{destination.country} • {formatCount(destination.visitCount, 'visit')} • {formatCount(destination.shipCount, 'ship')}</Text>
                              {destination.latestDate.length > 0 && <Text style={styles.detailShipText}>Latest: {formatVisitDate(destination.latestDate)}</Text>}
                            </View>
                            {isExpanded ? <ChevronDown size={18} color={COLORS.tealAccent} /> : <ChevronRight size={18} color={COLORS.textMuted} />}
                          </TouchableOpacity>
                          {isExpanded && (
                            <View style={styles.destinationVisitsWrap} testID={`countries-destination-visits-${index}`}>
                              {destination.visits.map((visit, visitIndex) => (
                                <View key={`${visit.id}-${visitIndex}`} style={styles.destinationVisitRow} testID={`countries-destination-visit-${index}-${visitIndex}`}>
                                  <View style={[styles.visitStatusDot, visit.isCompleted ? styles.completedDot : styles.upcomingDot]} />
                                  <View style={styles.destinationVisitTextGroup}>
                                    <Text style={styles.destinationVisitTitle}>{visit.shipName}</Text>
                                    <Text style={styles.destinationVisitSubtitle}>{formatVisitDate(visit.date)} • {visit.cruiseName}</Text>
                                  </View>
                                  <View style={[styles.detailStatusPill, visit.isCompleted ? styles.completedPill : styles.upcomingPill]}>
                                    <Text style={[styles.detailStatusText, visit.isCompleted ? styles.completedText : styles.upcomingText]}>{visit.isCompleted ? 'Done' : 'Soon'}</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

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
                      setDetailMode(null);
                      setExpandedDestinationKey(null);
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
              <View style={styles.yearFilterWrap} testID="countries-year-filter">
                <TouchableOpacity
                  style={styles.yearFilterButton}
                  onPress={() => setShowYearFilter((current) => !current)}
                  activeOpacity={0.78}
                  testID="countries-year-filter-button"
                >
                  <View style={styles.yearFilterIconBadge}>
                    <CalendarDays size={15} color={COLORS.white} />
                  </View>
                  <View style={styles.yearFilterTextGroup}>
                    <Text style={styles.yearFilterLabel}>Year filter</Text>
                    <Text style={styles.yearFilterValue}>{activeYear}</Text>
                  </View>
                  <Text style={styles.yearFilterCount}>{yearOptions.length} years</Text>
                </TouchableOpacity>
                {showYearFilter && (
                  <View style={styles.yearOptionsPanel} testID="countries-year-options-panel">
                    {yearOptions.map((year) => {
                      const isActive = year === activeYear;
                      const summary = summaries.find((item) => item.year === year);
                      return (
                        <TouchableOpacity
                          key={year}
                          style={[styles.yearOptionRow, isActive && styles.yearOptionRowActive]}
                          onPress={() => {
                            console.log('[Countries] Year selected:', year);
                            setSelectedYear(year);
                            setShowYearFilter(false);
                          }}
                          activeOpacity={0.78}
                          testID={`countries-year-option-${year}`}
                        >
                          <Text style={[styles.yearOptionText, isActive && styles.yearOptionTextActive]}>{year}</Text>
                          <Text style={[styles.yearOptionMeta, isActive && styles.yearOptionTextActive]}>{summary?.countries.length ?? 0} countries • {summary?.ports.length ?? 0} ports</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
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
                    const monthPortLines = monthVisits.slice(0, 3);
                    return (
                      <View key={month} style={[styles.monthCard, monthVisits.length > 0 && styles.monthCardActive]}>
                        <Text style={[styles.monthLabel, monthVisits.length > 0 && styles.monthLabelActive]}>{month}</Text>
                        {monthVisits.length > 0 ? (
                          <>
                            <Text style={styles.monthCount}>{monthCountries.length} {monthCountries.length === 1 ? 'country' : 'countries'}</Text>
                            {monthPortLines.map((visit) => (
                              <Text key={`${month}-${visit.id}`} style={styles.monthPortLine} numberOfLines={2}>{visit.port} • {visit.shipName}</Text>
                            ))}
                            {monthVisits.length > monthPortLines.length && (
                              <Text style={styles.monthMoreText}>+{monthVisits.length - monthPortLines.length} more port visits</Text>
                            )}
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
  heroStatPillActive: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderColor: 'rgba(255,255,255,0.52)',
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
  detailPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,151,167,0.22)',
    ...SHADOW.md,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  detailHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  detailCloseButton: {
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.bgTertiary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  detailCloseText: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  detailSubtitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  detailList: {
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FBFB',
    borderRadius: 16,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  detailRowExpanded: {
    backgroundColor: '#ECFEFF',
    borderColor: 'rgba(0,151,167,0.4)',
  },
  destinationGroup: {
    gap: 0,
  },
  destinationVisitsWrap: {
    marginLeft: 16,
    marginTop: 0,
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.sm,
    paddingTop: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0,151,167,0.18)',
    gap: SPACING.xs,
  },
  destinationVisitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,151,167,0.12)',
    gap: SPACING.sm,
  },
  visitStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  completedDot: {
    backgroundColor: COLORS.success,
  },
  upcomingDot: {
    backgroundColor: COLORS.warning,
  },
  destinationVisitTextGroup: {
    flex: 1,
  },
  destinationVisitTitle: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  destinationVisitSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  detailIndexBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  detailPortIndexBadge: {
    backgroundColor: COLORS.tealAccent,
  },
  detailIndexText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  detailTextGroup: {
    flex: 1,
  },
  detailRowTitle: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  detailRowSubtitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  detailShipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  detailDateText: {
    maxWidth: 82,
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.tealAccent,
    textAlign: 'right' as const,
  },
  detailStatusPill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailStatusText: {
    fontSize: 10,
    fontWeight: '900' as const,
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
  yearFilterWrap: {
    marginBottom: SPACING.md,
  },
  yearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  yearFilterIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearFilterTextGroup: {
    flex: 1,
  },
  yearFilterLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  yearFilterValue: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginTop: 1,
  },
  yearFilterCount: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.tealAccent,
  },
  yearOptionsPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: SPACING.sm,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  yearOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  yearOptionRowActive: {
    backgroundColor: COLORS.navyDeep,
  },
  yearOptionText: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  yearOptionMeta: {
    flex: 1,
    textAlign: 'right' as const,
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textMuted,
  },
  yearOptionTextActive: {
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
  monthPortLine: {
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  monthMoreText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.tealAccent,
    marginTop: 4,
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
