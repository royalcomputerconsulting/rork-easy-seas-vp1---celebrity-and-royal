import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, ChevronRight, CloudSun, DatabaseZap, FileSearch, Gamepad2, Search, Ship, SlidersHorizontal, Tag, Ticket, Users, X, Wand2 } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { AgentXChat } from '@/components/AgentXChat';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useUser } from '@/state/UserProvider';
import { useAgentX } from '@/state/AgentXProvider';
import { usePersonalCertificateOptimizer } from '@/state/PersonalCertificateOptimizerProvider';
import { answerPersonalOptimizationQuestion } from '@/lib/optimization';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useAuth } from '@/state/AuthProvider';
import { filterRecordsByIntelligence, getBrandLabel, getProgramLabel, getProfileDisplayName } from '@/lib/intelligenceFilters';
import { askMyDataSearch, type AskMyDataResult, type AskMyDataSource } from '@/lib/askMyData';
import { buildAskMyDataOverview } from '@/lib/askMyDataOverview';
import { isKnownCasinoProfile } from '@/lib/knownProfileFallback';
import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';

const SOURCE_STYLES: Record<AskMyDataSource, { label: string; color: string; icon: typeof Tag }> = {
  overview: { label: 'Overview', color: '#0369A1', icon: DatabaseZap },
  offers: { label: 'Offer', color: '#0F766E', icon: Tag },
  cruises: { label: 'Cruise', color: '#1D4ED8', icon: Ship },
  certificates: { label: 'Certificate', color: '#B45309', icon: Ticket },
  calendar: { label: 'Calendar', color: '#7C3AED', icon: FileSearch },
  crew: { label: 'Crew', color: '#BE123C', icon: Users },
  machines: { label: 'Slots', color: '#4338CA', icon: Gamepad2 },
  weather: { label: 'Weather', color: '#0284C7', icon: CloudSun },
  system: { label: 'System', color: '#475569', icon: Wand2 },
};

function buildScopeLabel(profileId: string, users: ReturnType<typeof useUser>['users'], brand: string, program: string): string {
  const profileLabel = profileId === 'all'
    ? 'All Profiles'
    : profileId === 'unassigned'
      ? 'Unassigned Imports'
      : getProfileDisplayName(users.find((profile) => profile.id === profileId));
  return `${profileLabel} • ${getBrandLabel(brand)} • ${getProgramLabel(program)}`;
}

function hasBookedCruiseOfferData(cruise: BookedCruise): boolean {
  return Boolean(
    cruise.offerCode ||
    cruise.offerName ||
    cruise.offerCategory ||
    cruise.freePlay ||
    cruise.freeOBC ||
    cruise.compValue ||
    cruise.totalCasinoDiscount ||
    cruise.sourcePayload
  );
}

export default function AskMyDataScreen() {
  const router = useRouter();
  const { bundle: optimizationBundle } = usePersonalCertificateOptimizer();
  const { cruises, bookedCruises, casinoOffers, calendarEvents } = useCoreData();
  const { certificates } = useCertificates();
  const { users } = useUser();
  const { sessions } = useCasinoSessions();
  const { authenticatedEmail } = useAuth();
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    clubRoyalePointsSource,
    clubRoyaleSyncDiscrepancy,
  } = useLoyalty();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const {
    messages,
    isLoading: agentLoading,
    sendMessage,
    isExpanded,
    toggleExpanded,
    mode: agentMode,
    setMode: setAgentMode,
    clearMessages,
  } = useAgentX();
  const [query, setQuery] = useState<string>('');
  const [submittedQuery, setSubmittedQuery] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const filterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const scopedOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, filterSnapshot, users), [casinoOffers, filterSnapshot, users]);
  const scopedCruises = useMemo(() => filterRecordsByIntelligence(cruises, filterSnapshot, users), [cruises, filterSnapshot, users]);
  const scopedBookedCruises = useMemo(() => filterRecordsByIntelligence(bookedCruises, filterSnapshot, users), [bookedCruises, filterSnapshot, users]);
  const scopedCertificates = useMemo(() => filterRecordsByIntelligence(certificates as unknown as Array<Certificate & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: any }>, filterSnapshot, users), [certificates, filterSnapshot, users]);
  const scopedCalendarEvents = useMemo(() => filterRecordsByIntelligence(calendarEvents, filterSnapshot, users), [calendarEvents, filterSnapshot, users]);

  const scopeLabel = useMemo(() => buildScopeLabel(selectedProfileId, users, selectedBrand, selectedProgram), [selectedBrand, selectedProfileId, selectedProgram, users]);

  const askMyDataOverview = useMemo(() => buildAskMyDataOverview({
    bookedCruises: scopedBookedCruises as BookedCruise[],
    casinoSessions: sessions,
    currentTier: clubRoyaleTier,
    currentPoints: clubRoyalePoints,
    pointBalanceSource: clubRoyalePointsSource,
    clubRoyaleSyncDiscrepancy,
    useKnownAnnualReportFacts: isKnownCasinoProfile(authenticatedEmail),
  }), [authenticatedEmail, clubRoyalePoints, clubRoyalePointsSource, clubRoyaleSyncDiscrepancy, clubRoyaleTier, scopedBookedCruises, sessions]);

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
      overview: askMyDataOverview,
    });
  }, [askMyDataOverview, scopedBookedCruises, scopedCalendarEvents, scopedCertificates, scopedCruises, scopedOffers, submittedQuery]);

  const optimizationAnswer = useMemo(() => {
    const activeQuery = submittedQuery.trim();
    if (!activeQuery || !optimizationBundle) return null;
    return answerPersonalOptimizationQuestion(activeQuery, optimizationBundle);
  }, [optimizationBundle, submittedQuery]);

  const bookedCruiseOfferCount = useMemo(() => (
    (scopedBookedCruises as BookedCruise[]).filter(hasBookedCruiseOfferData).length
  ), [scopedBookedCruises]);

  const stats = useMemo(() => ({
    offers: scopedOffers.length + bookedCruiseOfferCount,
    standaloneOffers: scopedOffers.length,
    bookedCruiseOffers: bookedCruiseOfferCount,
    cruises: scopedCruises.length + scopedBookedCruises.length,
    certificates: scopedCertificates.length,
    calendar: scopedCalendarEvents.length,
  }), [bookedCruiseOfferCount, scopedBookedCruises.length, scopedCalendarEvents.length, scopedCertificates.length, scopedCruises.length, scopedOffers.length]);

  const submitSearch = useCallback((nextQuery?: string) => {
    const searchText = (nextQuery ?? query).trim();
    if (!searchText) return;
    console.log('[AskMyDataScreen] Search submitted:', { searchText, filterSnapshot });
    setQuery(searchText);
    setSubmittedQuery(searchText);
    void sendMessage(`Ask my data: ${searchText}`);
  }, [filterSnapshot, query, sendMessage]);

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
          <View style={styles.resultBadgeGroup}>
          <View style={[styles.sourceBadge, { backgroundColor: `${sourceStyle.color}16`, borderColor: `${sourceStyle.color}33` }]}>
            <SourceIcon size={14} color={sourceStyle.color} />
            <Text style={[styles.sourceText, { color: sourceStyle.color }]}>{sourceStyle.label}</Text>
          </View>
          <View style={[styles.confidenceBadge, result.confidence === 'high' ? styles.confidenceHigh : result.confidence === 'medium' ? styles.confidenceMedium : styles.confidenceLow]}>
            <Text style={styles.confidenceText}>{result.confidence}</Text>
          </View>
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
        {result.matchReasons.length > 0 ? (
          <View style={styles.reasonWrap}>
            {result.matchReasons.slice(0, 3).map((reason) => (
              <View key={`${result.id}-${reason}`} style={styles.reasonChip}>
                <Wand2 size={11} color="#0F766E" />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {result.matchedTerms.length > 0 ? <Text style={styles.matchedTermsText}>Matched: {result.matchedTerms.slice(0, 8).join(', ')}</Text> : null}
        {result.detail ? <Text style={styles.resultDetailText}>{result.detail}</Text> : null}

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
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} activeOpacity={0.75} testID="ask-my-data-close">
            <X size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <ResponsiveContainer>
            <View style={styles.commandCard} testID="ask-my-data-hero">
              <LinearGradient colors={['rgba(167,243,208,0.24)', 'rgba(56,189,248,0.10)', 'rgba(15,118,110,0.18)']} style={StyleSheet.absoluteFill} />
              <View style={styles.commandHeaderRow}>
                <View style={styles.commandIcon}>
                  <Bot size={20} color="#FDE68A" />
                </View>
                <View style={styles.commandCopy}>
                  <Text style={styles.commandTitle}>Ask anything about your data</Text>
                  <Text style={styles.commandSubtitle}>{scopeLabel}</Text>
                </View>
              </View>

              <View style={styles.searchInputRow}>
                <Search size={18} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Type a question about offers, cruises, certificates, imports, or tier progress..."
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
                <Text style={styles.searchButtonText}>Ask Easy Seas</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.scopeCard}>
              <View style={styles.scopeSummary}>
                <Text style={styles.scopeSummaryLabel}>Current scope</Text>
                <Text style={styles.scopeSummaryText}>{stats.offers} offer records ({stats.standaloneOffers} standalone + {stats.bookedCruiseOffers} booked) • {stats.cruises} cruises • {stats.certificates} certs • {stats.calendar} calendar</Text>
              </View>
              <TouchableOpacity style={styles.filterToggleButton} onPress={() => setFiltersOpen((open) => !open)} activeOpacity={0.78} testID="ask-my-data-toggle-filters">
                <SlidersHorizontal size={14} color={COLORS.navyDeep} />
                <Text style={styles.filterToggleText}>{filtersOpen ? 'Hide filters' : 'Filters'}</Text>
              </TouchableOpacity>
            </View>

            {filtersOpen ? <IntelligenceFilterStrip contextLabel="Ask My Data" compact={true} /> : null}

            <View style={styles.agentUnifiedCard} testID="ask-my-data-agentx-panel">
              <View style={styles.agentUnifiedHeader}>
                <View style={styles.agentUnifiedIcon}>
                  <Bot size={18} color="#FDE68A" />
                </View>
                <View style={styles.agentUnifiedCopy}>
                  <Text style={styles.agentUnifiedTitle}>Chat with Easy Seas</Text>
                </View>
                {messages.length > 0 ? (
                  <TouchableOpacity style={styles.clearConversationButton} onPress={clearMessages} activeOpacity={0.75} testID="ask-my-data-clear-agentx">
                    <Text style={styles.clearConversationText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={[styles.agentChatFrame, isExpanded && styles.agentChatFrameExpanded]}>
                <AgentXChat
                  messages={messages}
                  onSendMessage={sendMessage}
                  isLoading={agentLoading}
                  isExpanded={isExpanded}
                  onToggleExpand={toggleExpanded}
                  showHeader={false}
                  placeholder="Ask anything about your EasySeas data..."
                  mode={agentMode}
                  onModeChange={setAgentMode}
                  contextLabel="Ask My Data"
                  welcomeTitle="Ready when you are"
                  welcomeSubtitle="Ask anything about your saved offers, cruises, certificates, calendar, imports, tier progress, or replacement options."
                  disclaimerText="Uses your selected profile, brand, and program scope. Verify final cruise terms directly with the cruise line."
                  useSafeAreaPadding={false}
                  showDevAssistant={false}
                  showFilterStrip={false}
                  quickActions={[]}
                  defaultTtsEnabled={false}
                />
              </View>
            </View>

            {optimizationAnswer ? (
              <View style={styles.optimizationAnswerCard} testID="ask-my-data-optimization-answer">
                <View style={styles.optimizationAnswerHeader}>
                  <Wand2 size={16} color="#FDE68A" />
                  <Text style={styles.optimizationAnswerEyebrow}>PERSONAL CERTIFICATE OPTIMIZER</Text>
                </View>
                <Text style={styles.optimizationAnswerTitle}>{optimizationAnswer.headline}</Text>
                <Text style={styles.optimizationAnswerBody}>{optimizationAnswer.answer}</Text>
                {optimizationAnswer.estimates.slice(0, 4).map((estimate) => (
                  <View key={`${estimate.label}:${estimate.value}`} style={styles.optimizationAnswerRow}>
                    <Text style={styles.optimizationAnswerLabel}>{estimate.label}</Text>
                    <Text style={styles.optimizationAnswerValue}>{estimate.value}</Text>
                  </View>
                ))}
                {optimizationAnswer.missingData.length > 0 ? <Text style={styles.optimizationMissing}>Missing: {optimizationAnswer.missingData.join(' • ')}</Text> : null}
                {optimizationAnswer.safetyGateOverrideDenied ? <Text style={styles.optimizationSafety}>Safety gates were not changed.</Text> : null}
              </View>
            ) : null}

            {response ? (
              <View style={styles.resultsSection}>
                <View style={styles.interpretationCard} testID="ask-my-data-interpreted-intent">
                  <View style={styles.interpretationTopRow}>
                    <Wand2 size={15} color="#A7F3D0" />
                    <Text style={styles.interpretationLabel}>Indexed matches</Text>
                  </View>
                  <Text style={styles.interpretationText}>{response.interpretedIntent}</Text>
                </View>
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
  optimizationAnswerCard: {
    borderRadius: 22,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(15, 39, 71, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.32)',
  },
  optimizationAnswerHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  optimizationAnswerEyebrow: { color: '#FDE68A', fontSize: 10, fontWeight: '900' as const, letterSpacing: 1 },
  optimizationAnswerTitle: { color: COLORS.white, fontSize: 19, fontWeight: '900' as const },
  optimizationAnswerBody: { color: '#DCE8F5', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 10 },
  optimizationAnswerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  optimizationAnswerLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700' as const },
  optimizationAnswerValue: { color: COLORS.white, fontSize: 12, fontWeight: '900' as const, textAlign: 'right' },
  optimizationMissing: { color: '#FDE68A', fontSize: 11, lineHeight: 17, marginTop: 8 },
  optimizationSafety: { color: '#FCA5A5', fontSize: 12, fontWeight: '900' as const, marginTop: 8 },
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
  headerSpacer: {
    flex: 1,
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
  commandCard: {
    overflow: 'hidden',
    borderRadius: 28,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.24)',
    ...SHADOW.md,
  },
  commandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  commandIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 230, 138, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.24)',
  },
  commandCopy: {
    flex: 1,
  },
  commandTitle: {
    color: COLORS.white,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900' as const,
  },
  commandSubtitle: {
    color: '#A7F3D0',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    marginTop: 3,
  },
  toolStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  toolChipText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900' as const,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    borderRadius: 18,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.70)',
  },
  scopeSummary: {
    flex: 1,
  },
  scopeSummaryLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  scopeSummaryText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
    marginTop: 2,
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#D8F1FF',
    borderWidth: 1,
    borderColor: '#A9DDF8',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
  },
  filterToggleText: {
    color: COLORS.navyDeep,
    fontSize: 11,
    fontWeight: '900' as const,
  },
  agentUnifiedCard: {
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: 'rgba(3, 7, 18, 0.66)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.18)',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  agentUnifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(15, 118, 110, 0.22)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167, 243, 208, 0.14)',
  },
  agentUnifiedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 230, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.22)',
  },
  agentUnifiedCopy: {
    flex: 1,
  },
  agentUnifiedTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
  },
  agentUnifiedSubtitle: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    fontWeight: '700' as const,
  },
  clearConversationButton: {
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.70)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    minWidth: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearConversationText: {
    color: COLORS.white,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    fontWeight: '900' as const,
  },
  agentChatFrame: {
    height: 720,
    backgroundColor: 'rgba(224, 242, 254, 0.96)',
  },
  agentChatFrameExpanded: {
    height: 920,
  },
  lookupHeaderCard: {
    borderRadius: 18,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  lookupHeaderTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
  },
  lookupHeaderSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '700' as const,
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
  interpretationCard: {
    backgroundColor: 'rgba(15, 118, 110, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.26)',
    padding: SPACING.md,
    marginBottom: SPACING.xs,
  },
  interpretationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  interpretationLabel: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  interpretationText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    lineHeight: 18,
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
  resultBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
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
  confidenceBadge: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderWidth: 1,
  },
  confidenceHigh: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  confidenceMedium: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  confidenceLow: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    textTransform: 'uppercase' as const,
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
  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  reasonText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#0F766E',
  },
  matchedTermsText: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  resultDetailText: {
    marginTop: SPACING.sm,
    color: '#0F172A',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700' as const,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
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
  followUpCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  followUpTitle: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
  },
  followUpText: {
    flex: 1,
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
  },
});
