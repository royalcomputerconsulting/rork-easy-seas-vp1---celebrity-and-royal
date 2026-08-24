import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, InteractionManager, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { DatabaseZap, SlidersHorizontal, X } from 'lucide-react-native';
import { AgentXChat } from '@/components/AgentXChat';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useAgentX } from '@/state/AgentXProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { filterRecordsByIntelligence, getBrandLabel, getProgramLabel, getProfileDisplayName } from '@/lib/intelligenceFilters';
import type { BookedCruise } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';

function hasOfferData(cruise: BookedCruise): boolean {
  return Boolean(cruise.offerCode || cruise.offerName || cruise.offerCategory || cruise.freePlay || cruise.freeOBC || cruise.compValue || cruise.totalCasinoDiscount || cruise.sourcePayload);
}

function getCruiseEndDate(cruise: BookedCruise): string {
  return String(cruise.returnDate || cruise.sailDate || '').slice(0, 10);
}

export default function AskMyDataScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string; prompt?: string }>();
  const incomingQuery = String(params.query || params.prompt || '').trim();
  const sentIncomingPromptRef = useRef<string>('');
  const initialLibraryLoadRequestedRef = useRef(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { cruises, bookedCruises, casinoOffers, calendarEvents } = useCoreData();
  const { totalCruises } = useCruiseInventory();
  const { searchableCertificates: certificates, refreshCertificateDocuments } = useCertificates();
  const { encyclopedia, reload: reloadSlotLibrary } = useSlotMachineLibrary();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const { messages, isLoading, isVisible, sendMessage, clearMessages, setMode, setVisible, conversationThreads, activeConversationId, startNewConversation, openConversation, confirmAgentAction, cancelAgentAction } = useAgentX();

  useEffect(() => {
    setVisible(true);
    return () => setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    if (initialLibraryLoadRequestedRef.current) return;
    initialLibraryLoadRequestedRef.current = true;
    const interaction = InteractionManager.runAfterInteractions(() => {
      void refreshCertificateDocuments();
      if (encyclopedia.length === 0) void reloadSlotLibrary();
    });
    return () => interaction.cancel();
  }, [encyclopedia.length, refreshCertificateDocuments, reloadSlotLibrary]);

  useEffect(() => {
    setMode('easySeasGuide');
  }, [setMode]);

  useEffect(() => {
    if (!isVisible || !incomingQuery || sentIncomingPromptRef.current === incomingQuery) return;
    sentIncomingPromptRef.current = incomingQuery;
    void sendMessage(incomingQuery);
  }, [incomingQuery, isVisible, sendMessage]);

  const filterSnapshot = useMemo(() => ({ selectedProfileId, selectedBrand, selectedProgram }), [selectedBrand, selectedProfileId, selectedProgram]);
  const scopedOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, filterSnapshot, users), [casinoOffers, filterSnapshot, users]);
  const scopedCruises = useMemo(() => filterRecordsByIntelligence(cruises, filterSnapshot, users), [cruises, filterSnapshot, users]);
  const scopedBooked = useMemo(() => filterRecordsByIntelligence(bookedCruises, filterSnapshot, users), [bookedCruises, filterSnapshot, users]);
  const scopedCertificates = useMemo(() => filterRecordsByIntelligence(certificates as Array<Certificate & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: string }>, filterSnapshot, users), [certificates, filterSnapshot, users]);
  const scopedCalendar = useMemo(() => filterRecordsByIntelligence(calendarEvents, filterSnapshot, users), [calendarEvents, filterSnapshot, users]);

  const scopeLabel = useMemo(() => {
    const profile = selectedProfileId === 'all'
      ? 'All Profiles'
      : selectedProfileId === 'unassigned'
        ? 'Unassigned Imports'
        : getProfileDisplayName(users.find((candidate) => candidate.id === selectedProfileId));
    return `${profile} • ${getBrandLabel(selectedBrand)} • ${getProgramLabel(selectedProgram)}`;
  }, [selectedBrand, selectedProfileId, selectedProgram, users]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pastCruises = (scopedBooked as BookedCruise[]).filter((cruise) => {
      const status = String(cruise.status || '').toLowerCase();
      const endDate = getCruiseEndDate(cruise);
      return status === 'completed' || Boolean(endDate && endDate < today);
    }).length;
    const currentBooked = Math.max(0, scopedBooked.length - pastCruises);
    const bookedOfferRecords = (scopedBooked as BookedCruise[]).filter(hasOfferData).length;
    const certificateSailings = scopedCertificates.reduce((total, certificate) => total + (certificate.parsedSailings?.length ?? 0), 0);
    return {
      offerRecords: scopedOffers.length + bookedOfferRecords,
      availableCruises: totalCruises || scopedCruises.length,
      bookedCruises: currentBooked,
      pastCruises,
      certificates: scopedCertificates.length,
      certificateSailings,
      calendar: scopedCalendar.length,
    };
  }, [scopedBooked, scopedCalendar.length, scopedCertificates, scopedCruises.length, scopedOffers.length, totalCruises]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#061826', '#0F2439', '#0F766E']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardSurface}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          testID="ask-my-data-keyboard-surface"
        >
          <View style={styles.header}>
            <View style={styles.titleIcon}><DatabaseZap size={20} color="#A7F3D0" /></View>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Easy Seas Agent</Text>
              <Text style={styles.subtitle}>Chat with all of your saved cruise data</Text>
            </View>
            {messages.length > 0 ? <TouchableOpacity style={styles.clearButton} onPress={clearMessages} testID="ask-my-data-clear-agent"><Text style={styles.clearText}>Clear</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} testID="ask-my-data-close"><X size={20} color={COLORS.white} /></TouchableOpacity>
          </View>

          <View style={styles.scopeCard} testID="ask-my-data-current-scope">
            <View style={styles.scopeTitleGroup}>
              <Text style={styles.scopeLabel}>Local data ready</Text>
              <Text style={styles.scopeProfile} numberOfLines={1}>{scopeLabel}</Text>
              <Text style={styles.scopeCounts} numberOfLines={2}>
                {stats.offerRecords.toLocaleString()} current offer records • {stats.availableCruises.toLocaleString()} available cruises • {stats.bookedCruises.toLocaleString()} booked • {stats.pastCruises.toLocaleString()} past cruises • {stats.certificates.toLocaleString()} certificates ({stats.certificateSailings.toLocaleString()} sailings) • {stats.calendar.toLocaleString()} calendar records
              </Text>
            </View>
            <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersOpen((open) => !open)} testID="ask-my-data-toggle-filters">
              <SlidersHorizontal size={14} color={COLORS.navyDeep} />
              <Text style={styles.filterText}>{filtersOpen ? 'Hide' : 'Filters'}</Text>
            </TouchableOpacity>
          </View>
          {filtersOpen ? <View style={styles.filterStrip}><IntelligenceFilterStrip contextLabel="Easy Seas Agent" compact /></View> : null}

          <View style={styles.historyRow} testID="ask-my-data-saved-conversations">
            <TouchableOpacity style={styles.newChatButton} onPress={startNewConversation} testID="ask-my-data-new-conversation"><Text style={styles.newChatText}>+ New chat</Text></TouchableOpacity>
            <FlatList horizontal data={conversationThreads.filter((thread) => !thread.archivedAt).slice(0, 8)} keyExtractor={(thread) => thread.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll} renderItem={({ item: thread }) => (
              <TouchableOpacity style={[styles.historyChip, activeConversationId === thread.id && styles.historyChipActive]} onPress={() => openConversation(thread.id)} testID={`ask-my-data-conversation-${thread.id}`}>
                <Text style={[styles.historyChipText, activeConversationId === thread.id && styles.historyChipTextActive]} numberOfLines={1}>{thread.title}</Text>
              </TouchableOpacity>
            )} />
          </View>

          <View style={styles.chatCard} testID="ask-my-data-unified-agent">
            <AgentXChat
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={isLoading}
              showHeader={false}
              placeholder="Message Easy Seas…"
              mode="easySeasGuide"
              contextLabel="Easy Seas Agent"
              welcomeTitle="How can I help?"
              welcomeSubtitle="Ask about offers, cruises, certificates, bookings, calendar events, loyalty benefits, casino sessions, or weather reports. I’ll search your saved local records and explain the evidence."
              disclaimerText="Answers use your selected local data."
              useSafeAreaPadding={false}
              showDevAssistant={false}
              showFilterStrip={false}
              showAgentModes={false}
              unifiedComposer
              keyboardAvoidanceEnabled={false}
              quickActions={[]}
              defaultTtsEnabled={false}
              onConfirmAction={confirmAgentAction}
              onCancelAction={cancelAgentAction}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#061826' },
  safeArea: { flex: 1 },
  keyboardSurface: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  titleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167,243,208,0.12)', borderWidth: 1, borderColor: 'rgba(167,243,208,0.3)' },
  titleCopy: { flex: 1 },
  title: { color: COLORS.white, fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold },
  subtitle: { color: '#BFDBFE', fontSize: TYPOGRAPHY.fontSizeXS, marginTop: 2 },
  clearButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: BORDER_RADIUS.round, backgroundColor: '#B91C1C' },
  clearText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  scopeCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.md, marginBottom: 6, paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: BORDER_RADIUS.lg, backgroundColor: '#F8FAFC', ...SHADOW.sm },
  scopeTitleGroup: { flex: 1 },
  scopeLabel: { color: '#0F766E', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  scopeProfile: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '800', marginTop: 1 },
  scopeCounts: { color: '#475569', fontSize: 10, fontWeight: '700', lineHeight: 14, marginTop: 2 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: BORDER_RADIUS.round, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#7DD3FC' },
  filterText: { color: COLORS.navyDeep, fontSize: 11, fontWeight: '800' },
  filterStrip: { paddingHorizontal: SPACING.sm, marginBottom: SPACING.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingBottom: 6 },
  newChatButton: { backgroundColor: '#A7F3D0', borderRadius: BORDER_RADIUS.round, paddingHorizontal: 11, paddingVertical: 7 },
  newChatText: { color: '#064E3B', fontSize: 11, fontWeight: '900' },
  historyScroll: { gap: 6, paddingRight: SPACING.md },
  historyChip: { maxWidth: 180, borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.08)' },
  historyChipActive: { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' },
  historyChipText: { color: '#BFDBFE', fontSize: 10, fontWeight: '700' },
  historyChipTextActive: { color: COLORS.navyDeep },
  chatCard: { flex: 1, minHeight: 0, marginHorizontal: 6, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(167,243,208,0.35)', backgroundColor: '#E0F2FE' },
});
