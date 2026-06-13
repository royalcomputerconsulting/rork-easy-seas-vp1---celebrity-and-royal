import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Anchor, ChevronRight, Flag, Globe2, MapPin, Ship } from 'lucide-react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { createDateFromString, formatDate } from '@/lib/date';
import { buildPortTracker, deriveCruiseDayPlan } from '@/lib/cruisePlanningIntelligence';
import { filterRecordsByIntelligence, getProfileDisplayName } from '@/lib/intelligenceFilters';
import type { Cruise, TravelerProfile } from '@/types/models';

type PortScope = 'individual' | 'household';

interface PortVisitRow {
  port: string;
  country: string;
  count: number;
  isNewForTarget: boolean;
  isRepeated: boolean;
  targetDay?: number;
}

function normalizePort(value: string): string {
  return value.toLowerCase().trim();
}

function getPortCountry(port: string): string {
  const pieces = port.split(',').map((part) => part.trim()).filter(Boolean);
  return pieces.length >= 2 ? pieces[pieces.length - 1] : 'Unknown country';
}

function buildTravelerProfile(user: ReturnType<typeof useUser>['currentUser']): Partial<TravelerProfile> | null {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName || user.name,
    email: user.email,
    royalCaribbeanNumber: user.royalCaribbeanNumber || user.crownAnchorNumber,
    clubRoyaleId: user.clubRoyaleId,
    celebrityCaptainsClubNumber: user.celebrityCaptainsClubNumber,
    blueChipId: user.blueChipId,
  };
}

export default function PortHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cruiseId?: string }>();
  const { localData } = useAppState();
  const { cruises, bookedCruises } = useCoreData();
  const { currentUser, users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const [scope, setScope] = useState<PortScope>('individual');

  const filterSnapshot = useMemo(() => ({ selectedProfileId, selectedBrand, selectedProgram }), [selectedBrand, selectedProfileId, selectedProgram]);

  const allCruises = useMemo((): Cruise[] => {
    const combined = [
      ...(bookedCruises || []),
      ...(cruises || []),
      ...((localData.booked || []) as Cruise[]),
      ...((localData.cruises || []) as Cruise[]),
    ];
    const scopeFilter = scope === 'household'
      ? { ...filterSnapshot, selectedProfileId: 'all' as const }
      : filterSnapshot;
    const seen = new Set<string>();
    return filterRecordsByIntelligence(combined, scopeFilter, users).filter((cruise) => {
      if (seen.has(cruise.id)) return false;
      seen.add(cruise.id);
      return true;
    });
  }, [bookedCruises, cruises, filterSnapshot, localData.booked, localData.cruises, scope, users]);

  const targetCruise = useMemo(() => {
    if (!params.cruiseId) return undefined;
    return allCruises.find((cruise) => cruise.id === params.cruiseId);
  }, [allCruises, params.cruiseId]);

  const currentProfile = useMemo(() => buildTravelerProfile(currentUser), [currentUser]);
  const profileForScope = scope === 'individual' ? currentProfile : null;

  const tracker = useMemo(() => buildPortTracker(allCruises, targetCruise, profileForScope), [allCruises, profileForScope, targetCruise]);

  const targetPortDays = useMemo(() => {
    if (!targetCruise) return [];
    return deriveCruiseDayPlan(targetCruise).filter((day) => !day.isSeaDay && day.port.trim().length > 0);
  }, [targetCruise]);

  const portRows = useMemo((): PortVisitRow[] => {
    const targetDayByPort = new Map(targetPortDays.map((day) => [normalizePort(day.port), day.day]));
    const rows = tracker.portVisitCounts.map((entry) => ({
      port: entry.port,
      country: getPortCountry(entry.port),
      count: entry.count,
      isNewForTarget: tracker.newPorts.some((port) => normalizePort(port) === normalizePort(entry.port)),
      isRepeated: entry.count > 1,
      targetDay: targetDayByPort.get(normalizePort(entry.port)),
    }));

    tracker.newPorts.forEach((port) => {
      if (rows.some((row) => normalizePort(row.port) === normalizePort(port))) return;
      rows.unshift({
        port,
        country: getPortCountry(port),
        count: 0,
        isNewForTarget: true,
        isRepeated: false,
        targetDay: targetDayByPort.get(normalizePort(port)),
      });
    });

    return rows.sort((left, right) => {
      if (left.isNewForTarget !== right.isNewForTarget) return left.isNewForTarget ? -1 : 1;
      return right.count - left.count || left.port.localeCompare(right.port);
    });
  }, [targetPortDays, tracker.newPorts, tracker.portVisitCounts]);

  const countryRows = useMemo(() => {
    const counts = new Map<string, number>();
    portRows.forEach((row) => counts.set(row.country, (counts.get(row.country) ?? 0) + Math.max(1, row.count)));
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [portRows]);

  const profileLabel = scope === 'individual' ? getProfileDisplayName(currentUser ?? undefined) : 'Household / active filter scope';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <View style={styles.heroCard}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8} testID="port-history-back">
                <ArrowLeft size={18} color={COLORS.white} />
              </TouchableOpacity>
              <View style={styles.heroIcon}><MapPin size={28} color="#A7F3D0" /></View>
              <Text style={styles.heroEyebrow}>Port repetition tracker</Text>
              <Text style={styles.heroTitle}>{targetCruise ? targetCruise.shipName : 'Port history'} details</Text>
              <Text style={styles.heroSubtitle}>{targetCruise ? `${targetCruise.itineraryName || targetCruise.destination || 'Cruise'} • ${formatDate(targetCruise.sailDate, 'medium')}` : 'Visited ports, countries, visit counts, and repeated itinerary patterns.'}</Text>
            </View>

            <IntelligenceFilterStrip contextLabel="Port History" />

            <View style={styles.scopeSwitch} testID="port-history-scope-toggle">
              <TouchableOpacity style={[styles.scopeButton, scope === 'individual' && styles.scopeButtonActive]} onPress={() => setScope('individual')} activeOpacity={0.78}>
                <Text style={[styles.scopeButtonText, scope === 'individual' && styles.scopeButtonTextActive]}>Individual</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.scopeButton, scope === 'household' && styles.scopeButtonActive]} onPress={() => setScope('household')} activeOpacity={0.78}>
                <Text style={[styles.scopeButtonText, scope === 'household' && styles.scopeButtonTextActive]}>Household</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.scopeLabel}>Scope: {profileLabel}</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}><Text style={styles.summaryValue}>{tracker.visitedPorts.length}</Text><Text style={styles.summaryLabel}>Ports</Text></View>
                <View style={styles.summaryCell}><Text style={styles.summaryValue}>{tracker.countriesVisited.length || countryRows.length}</Text><Text style={styles.summaryLabel}>Countries</Text></View>
                <View style={styles.summaryCell}><Text style={styles.summaryValue}>{tracker.newPorts.length}</Text><Text style={styles.summaryLabel}>New</Text></View>
                <View style={styles.summaryCell}><Text style={styles.summaryValue}>{tracker.repeatedItineraries.length}</Text><Text style={styles.summaryLabel}>Repeats</Text></View>
              </View>
              {targetCruise ? <Text style={styles.noveltyText}>Target itinerary novelty score: {tracker.itineraryNoveltyScore}/100</Text> : null}
            </View>

            <View style={styles.sectionCard} testID="port-history-visited-ports">
              <View style={styles.sectionHeader}>
                <Anchor size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Visited Ports</Text>
                <Text style={styles.countBadge}>{portRows.length}</Text>
              </View>
              {portRows.length === 0 ? (
                <Text style={styles.emptyText}>No port history is available yet. Import booked/completed cruises with itinerary data to build this history.</Text>
              ) : portRows.map((row) => (
                <View key={`${row.port}-${row.targetDay ?? 'history'}`} style={styles.portRow}>
                  <View style={styles.portIcon}><MapPin size={15} color={row.isNewForTarget ? '#0F766E' : COLORS.navyDeep} /></View>
                  <View style={styles.portCopy}>
                    <View style={styles.portTitleRow}>
                      <Text style={styles.portName} numberOfLines={1}>{row.port}</Text>
                      {row.isNewForTarget ? <Text style={styles.newBadge}>New</Text> : null}
                      {row.isRepeated ? <Text style={styles.repeatBadge}>Repeated</Text> : null}
                    </View>
                    <Text style={styles.portMeta}>{row.country}{row.targetDay ? ` • target day ${row.targetDay}` : ''}</Text>
                  </View>
                  <View style={styles.visitCountPill}>
                    <Text style={styles.visitCount}>{row.count}</Text>
                    <Text style={styles.visitCountLabel}>visits</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard} testID="port-history-countries">
              <View style={styles.sectionHeader}>
                <Globe2 size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Countries</Text>
                <Text style={styles.countBadge}>{countryRows.length}</Text>
              </View>
              <View style={styles.countryGrid}>
                {countryRows.length === 0 ? <Text style={styles.emptyText}>Countries will appear when ports include country names.</Text> : countryRows.map(([country, count]) => (
                  <View key={country} style={styles.countryChip}>
                    <Flag size={13} color="#0F766E" />
                    <Text style={styles.countryText}>{country}</Text>
                    <Text style={styles.countryCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionCard} testID="port-history-repeated-itineraries">
              <View style={styles.sectionHeader}>
                <Ship size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Repeated Itinerary Badges</Text>
                <Text style={styles.countBadge}>{tracker.repeatedItineraries.length}</Text>
              </View>
              {tracker.repeatedItineraries.length === 0 ? (
                <Text style={styles.emptyText}>No repeated itinerary pattern detected in this scope.</Text>
              ) : tracker.repeatedItineraries.map((itinerary, index) => (
                <View key={`${itinerary}-${index}`} style={styles.repeatItineraryRow}>
                  <Text style={styles.repeatItineraryLabel}>Repeated route #{index + 1}</Text>
                  <Text style={styles.repeatItineraryText}>{itinerary}</Text>
                </View>
              ))}
            </View>

            {targetCruise ? (
              <TouchableOpacity style={styles.openCruiseButton} onPress={() => router.push({ pathname: '/cruise-details' as any, params: buildCruiseDetailsParams(targetCruise, { source: 'port-history' }) })} activeOpacity={0.82}>
                <Text style={styles.openCruiseText}>Back to cruise planning intelligence</Text>
                <ChevronRight size={18} color={COLORS.white} />
              </TouchableOpacity>
            ) : null}
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
  heroCard: { margin: SPACING.md, borderRadius: 28, padding: SPACING.lg, backgroundColor: COLORS.navyDeep, ...SHADOW.lg },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  heroIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167, 243, 208, 0.12)', borderWidth: 1, borderColor: 'rgba(167, 243, 208, 0.25)', marginBottom: SPACING.md },
  heroEyebrow: { fontSize: 12, fontWeight: '900' as const, color: '#A7F3D0', letterSpacing: 1, textTransform: 'uppercase' as const },
  heroTitle: { marginTop: 6, fontSize: 28, fontWeight: '900' as const, color: COLORS.white, lineHeight: 34 },
  heroSubtitle: { marginTop: SPACING.sm, fontSize: TYPOGRAPHY.fontSizeSM, color: 'rgba(255,255,255,0.78)', lineHeight: 20 },
  scopeSwitch: { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: 4, borderWidth: 1, borderColor: '#CBD5E1' },
  scopeButton: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  scopeButtonActive: { backgroundColor: COLORS.navyDeep },
  scopeButtonText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' as const, color: COLORS.navyDeep },
  scopeButtonTextActive: { color: COLORS.white },
  summaryCard: { margin: SPACING.md, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(0,31,63,0.1)', ...SHADOW.sm },
  scopeLabel: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' as const, color: COLORS.navyDeep, marginBottom: SPACING.md },
  summaryGrid: { flexDirection: 'row', gap: SPACING.sm },
  summaryCell: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '900' as const, color: COLORS.navyDeep },
  summaryLabel: { marginTop: 2, fontSize: 10, fontWeight: '800' as const, color: COLORS.textSecondary, textTransform: 'uppercase' as const },
  noveltyText: { marginTop: SPACING.md, fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '800' as const, color: '#0F766E' },
  sectionCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.white, borderRadius: 22, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(0,31,63,0.08)', ...SHADOW.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitle: { flex: 1, fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' as const, color: COLORS.navyDeep },
  countBadge: { overflow: 'hidden', backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.round, paddingHorizontal: SPACING.sm, paddingVertical: 3, color: COLORS.white, fontWeight: '900' as const },
  portRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: '#E2E8F0', padding: SPACING.sm, marginBottom: SPACING.xs, backgroundColor: '#F8FAFC' },
  portIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, marginRight: SPACING.sm },
  portCopy: { flex: 1, minWidth: 0 },
  portTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  portName: { flex: 1, fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' as const, color: COLORS.navyDeep },
  portMeta: { marginTop: 2, fontSize: TYPOGRAPHY.fontSizeXS, color: COLORS.textSecondary },
  newBadge: { overflow: 'hidden', borderRadius: BORDER_RADIUS.round, backgroundColor: '#CCFBF1', paddingHorizontal: 7, paddingVertical: 2, color: '#0F766E', fontSize: 10, fontWeight: '900' as const },
  repeatBadge: { overflow: 'hidden', borderRadius: BORDER_RADIUS.round, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, color: '#92400E', fontSize: 10, fontWeight: '900' as const },
  visitCountPill: { alignItems: 'center', minWidth: 42 },
  visitCount: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '900' as const, color: COLORS.navyDeep },
  visitCountLabel: { fontSize: 9, fontWeight: '800' as const, color: COLORS.textSecondary, textTransform: 'uppercase' as const },
  countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  countryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDFA', borderRadius: BORDER_RADIUS.round, paddingHorizontal: SPACING.sm, paddingVertical: 7, borderWidth: 1, borderColor: '#CCFBF1' },
  countryText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '800' as const, color: COLORS.navyDeep },
  countryCount: { fontSize: 11, fontWeight: '900' as const, color: '#0F766E' },
  repeatItineraryRow: { backgroundColor: '#F8FAFC', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs, borderWidth: 1, borderColor: '#E2E8F0' },
  repeatItineraryLabel: { fontSize: 10, fontWeight: '900' as const, color: '#92400E', textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  repeatItineraryText: { marginTop: 3, fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.navyDeep, lineHeight: 18 },
  emptyText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.textSecondary, lineHeight: 20 },
  openCruiseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md },
  openCruiseText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' as const, color: COLORS.white },
});
