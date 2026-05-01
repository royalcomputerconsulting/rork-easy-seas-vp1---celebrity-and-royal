import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, ChevronRight, DatabaseZap, FileSearch, Search, Ship, Sparkles, Tag, Ticket, X } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useUser } from '@/state/UserProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { filterRecordsByIntelligence, getBrandLabel, getProgramLabel, getProfileDisplayName } from '@/lib/intelligenceFilters';
import { askMyDataSearch, type AskMyDataResult, type AskMyDataSource } from '@/lib/askMyData';
import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';

const SAMPLE_QUERIES = [
  'Show me balcony offers longer than seven nights',
  'What offer expires soon but has the highest value?',
  'Which sailings are booked or reserved?',
  'Find cruises that fit after my next sailing',
  'Show certificates that may fit active offers',
];

const SOURCE_STYLES: Record<AskMyDataSource, { label: string; color: string; icon: typeof Tag }> = {
  offers: { label: 'Offer', color: '#0F766E', icon: Tag },
  cruises: { label: 'Cruise', color: '#1D4ED8', icon: Ship },
  certificates: { label: 'Certificate', color: '#B45309', icon: Ticket },
  calendar: { label: 'Calendar', color: '#7C3AED', icon: FileSearch },
};

function buildScopeLabel(profileId: string, users: ReturnType<typeof useUser>['users'], brand: string, program: string): string {
  const profileLabel = profileId === 'all'
    ? 'All Profiles'
    : profileId === 'unassigned'
      ? 'Unassigned Imports'
      : getProfileDisplayName(users.find((profile) => profile.id === profileId));
  return `${profileLabel} • ${getBrandLabel(brand)} • ${getProgramLabel(program)}`;
}

export default function AskMyDataScreen() {
  const router = useRouter();
  const { cruises, bookedCruises, casinoOffers, calendarEvents } = useCoreData();
  const { certificates } = useCertificates();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const [query, setQuery] = useState<string>('');
  const [submittedQuery, setSubmittedQuery] = useState<string>('');

  const filterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const scopedOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, filterSnapshot, users), [casinoOffers, filterSnapshot, users]);
  const scopedCruises = useMemo(() => filterRecordsByIntelligence(cruises, filterSnapshot, users), [cruises, filterSnapshot, users]);
  const scopedBookedCruises = useMemo(() => filterRecordsByIntelligence(bookedCruises, filterSnapshot, users), [bookedCruises, filterSnapshot, users]);
  const scopedCertificates = useMemo(() => filterRecordsByIntelligence(certificates as Array<Certificate & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: string }>, filterSnapshot, users), [certificates, filterSnapshot, users]);
  const scopedCalendarEvents = useMemo(() => filterRecordsByIntelligence(calendarEvents, filterSnapshot, users), [calendarEvents, filterSnapshot, users]);

  const scopeLabel = useMemo(() => buildScopeLabel(selectedProfileId, users, selectedBrand, selectedProgram), [selectedBrand, selectedProfileId, selectedProgram, users]);

  const response = useMemo(() => {
    const activeQuery = submittedQuery.trim();
    if (!activeQuery) return null;
    const combinedCruises: Cruise[] = [...scopedCruises, ...(scopedBookedCruises as BookedCruise[])];
    return askMyDataSearch({
      query: activeQuery,
      offers: scopedOffers as CasinoOffer[],
      cruises: combinedCruises,
      certificates: scopedCertificates as Certificate[],
      calendarEvents: scopedCalendarEvents as CalendarEvent[],
    });
  }, [scopedBookedCruises, scopedCalendarEvents, scopedCertificates, scopedCruises, scopedOffers, submittedQuery]);

  const stats = useMemo(() => ({
    offers: scopedOffers.length,
    cruises: scopedCruises.length + scopedBookedCruises.length,
    certificates: scopedCertificates.length,
    calendar: scopedCalendarEvents.length,
  }), [scopedBookedCruises.length, scopedCalendarEvents.length, scopedCertificates.length, scopedCruises.length, scopedOffers.length]);

  const submitSearch = useCallback((nextQuery?: string) => {
    const searchText = (nextQuery ?? query).trim();
    if (!searchText) return;
    console.log('[AskMyDataScreen] Search submitted:', { searchText, filterSnapshot });
    setQuery(searchText);
    setSubmittedQuery(searchText);
  }, [filterSnapshot, query]);

  const clearSearch = useCallback(() => {
    console.log('[AskMyDataScreen] Search cleared');
    setQuery('');
    setSubmittedQuery('');
  }, []);

  const openResult = useCallback((result: AskMyDataResult) => {
    if (!result.actionRoute) return;
    console.log('[AskMyDataScreen] Opening result:', { id: result.id, route: result.actionRoute });
    router.push(result.actionRoute as any);
  }, [router]);

  const renderResult = useCallback((result: AskMyDataResult, index: number) => {
    const sourceStyle = SOURCE_STYLES[result.source];
    const SourceIcon = sourceStyle.icon;
    return (
      <View key={result.id} style={styles.resultCard} testID={`ask-my-data-result-${result.id}`}>
        <View style={styles.resultTopRow}>
          <View style={[styles.sourceBadge, { backgroundColor: `${sourceStyle.color}16`, borderColor: `${sourceStyle.color}33` }]}>
            <SourceIcon size={14} color={sourceStyle.color} />
            <Text style={[styles.sourceText, { color: sourceStyle.color }]}>{sourceStyle.label}</Text>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        </View>

        <Text style={styles.resultTitle}>{result.title}</Text>
        <Text style={styles.resultSubtitle}>{result.subtitle}</Text>

        <View style={styles.resultMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Relevance</Text>
            <Text style={styles.metaValue}>{result.score}</Text>
          </View>
          {result.offerScore !== undefined ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>Offer Score</Text>
              <Text style={styles.metaValue}>{result.offerScore}/100</Text>
            </View>
          ) : null}
        </View>

        {result.owner ? <Text style={styles.ownerText}>Owner: {result.owner}</Text> : null}
        {result.certificateFit ? <Text style={styles.fitText}>{result.certificateFit}</Text> : null}

        <TouchableOpacity
          style={[styles.actionButton, !result.actionRoute && styles.actionButtonDisabled]}
          onPress={() => openResult(result)}
          disabled={!result.actionRoute}
          activeOpacity={0.8}
          testID={`ask-my-data-action-${result.id}`}
        >
          <Text style={styles.actionButtonText}>{result.actionLabel}</Text>
          <ChevronRight size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    );
  }, [openResult]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#061826', '#0F2439', '#0F766E']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <DatabaseZap size={22} color="#A7F3D0" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Ask My Data</Text>
            <Text style={styles.headerSubtitle}>Natural-language search with active account scope</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} activeOpacity={0.75} testID="ask-my-data-close">
            <X size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <ResponsiveContainer>
            <View style={styles.heroCard} testID="ask-my-data-hero">
              <LinearGradient colors={['rgba(167,243,208,0.22)', 'rgba(56,189,248,0.10)']} style={StyleSheet.absoluteFill} />
              <View style={styles.heroKickerRow}>
                <Sparkles size={14} color="#FDE68A" />
                <Text style={styles.heroKicker}>Scoped data search</Text>
              </View>
              <Text style={styles.heroTitle}>Ask across offers, cruises, certificates, and calendar records.</Text>
              <Text style={styles.heroBody}>Results respect the selected profile/account, brand, and program filters unless you change the scope below.</Text>
              <Text style={styles.scopeLabel}>{scopeLabel}</Text>
            </View>

            <IntelligenceFilterStrip contextLabel="Ask My Data" compact={true} />

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.offers}</Text>
                <Text style={styles.statLabel}>Offers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.cruises}</Text>
                <Text style={styles.statLabel}>Cruises</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.certificates}</Text>
                <Text style={styles.statLabel}>Certs</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.calendar}</Text>
                <Text style={styles.statLabel}>Calendar</Text>
              </View>
            </View>

            <View style={styles.searchCard}>
              <View style={styles.searchInputRow}>
                <Search size={18} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Ask: Which offers expire soon?"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="search"
                  onSubmitEditing={() => submitSearch()}
                  testID="ask-my-data-input"
                />
                {query.length > 0 ? (
                  <TouchableOpacity onPress={clearSearch} activeOpacity={0.75} testID="ask-my-data-clear">
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity style={styles.searchButton} onPress={() => submitSearch()} activeOpacity={0.82} testID="ask-my-data-submit">
                <Bot size={16} color={COLORS.white} />
                <Text style={styles.searchButtonText}>Search My Data</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.samplesWrap}>
              <Text style={styles.samplesLabel}>Try asking</Text>
              {SAMPLE_QUERIES.map((sample) => (
                <TouchableOpacity key={sample} style={styles.sampleChip} onPress={() => submitSearch(sample)} activeOpacity={0.78} testID={`ask-my-data-sample-${sample.replace(/\s+/g, '-').toLowerCase()}`}>
                  <Text style={styles.sampleChipText}>{sample}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {response ? (
              <View style={styles.resultsSection}>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsTitle}>{response.results.length} result{response.results.length === 1 ? '' : 's'}</Text>
                  <Text style={styles.resultsSubtitle}>{response.filtersApplied.join(' • ')}</Text>
                </View>
                {response.results.length > 0 ? response.results.map(renderResult) : (
                  <View style={styles.emptyCard} testID="ask-my-data-empty">
                    <FileSearch size={32} color="#0F766E" />
                    <Text style={styles.emptyTitle}>No matching records</Text>
                    <Text style={styles.emptyBody}>{response.noResultsExplanation}</Text>
                  </View>
                )}
              </View>
            ) : null}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061826',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 243, 208, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.28)',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 42,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.22)',
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroKicker: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900' as const,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    marginTop: 8,
  },
  scopeLabel: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800' as const,
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.70)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '800' as const,
    marginTop: 2,
  },
  searchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    paddingVertical: 10,
  },
  searchButton: {
    marginTop: SPACING.sm,
    height: 46,
    borderRadius: BORDER_RADIUS.round,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
  },
  searchButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
  },
  samplesWrap: {
    marginBottom: SPACING.lg,
  },
  samplesLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sampleChip: {
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: 8,
  },
  sampleChipText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
  },
  resultsSection: {
    gap: SPACING.sm,
  },
  resultsHeader: {
    marginBottom: SPACING.xs,
  },
  resultsTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
  },
  resultsSubtitle: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 3,
  },
  resultCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  resultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '900' as const,
  },
  rankBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  rankText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '900' as const,
  },
  resultTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
  },
  resultSubtitle: {
    color: '#475569',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
    marginTop: 4,
  },
  resultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  metaPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800' as const,
  },
  metaValue: {
    color: COLORS.navyDeep,
    fontSize: 13,
    fontWeight: '900' as const,
    marginTop: 1,
  },
  ownerText: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: SPACING.sm,
    fontWeight: '700' as const,
  },
  fitText: {
    color: '#0F766E',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 4,
    fontWeight: '800' as const,
  },
  actionButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
    marginTop: SPACING.sm,
  },
  emptyBody: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
});
