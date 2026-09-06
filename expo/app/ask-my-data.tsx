import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Bot, FileDown, List, MessageCirclePlus, Printer, Save, Settings2, Share2, SlidersHorizontal, X } from 'lucide-react-native';
import { AgentXChat } from '@/components/AgentXChat';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useAgentX } from '@/state/AgentXProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { filterRecordsByIntelligence, getBrandLabel, getProgramLabel, getProfileDisplayName } from '@/lib/intelligenceFilters';
import type { BookedCruise } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { loadAgentSeaAIConfig, saveAgentSeaAIConfig, type AgentSeaAIConfig } from '@/lib/agentSeaAI';
import { useAuth } from '@/state/AuthProvider';
import { exportAgentSeaConversationLog, printAgentSeaConversation, saveAgentSeaConversation, shareAgentSeaConversation } from '@/lib/agentSea/conversationLogExport';
import { useExperience } from '@/state/ExperienceProvider';

function hasOfferData(cruise: BookedCruise): boolean {
  return Boolean(cruise.offerCode || cruise.offerName || cruise.offerCategory || cruise.freePlay || cruise.freeOBC || cruise.compValue || cruise.totalCasinoDiscount || cruise.sourcePayload);
}

function getCruiseEndDate(cruise: BookedCruise): string {
  return String(cruise.returnDate || cruise.sailDate || '').slice(0, 10);
}

export default function AskMyDataScreen() {
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const params = useLocalSearchParams<{ query?: string; prompt?: string }>();
  const incomingQuery = String(params.query || params.prompt || '').trim();
  const sentIncomingPromptRef = useRef<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiSettingsOpen, setAISettingsOpen] = useState(false);
  const [aiKey, setAIKey] = useState('');
  const [aiModel, setAIModel] = useState('gpt-5.5');
  const [aiConnected, setAIConnected] = useState(false);
  const [aiSource, setAISource] = useState<AgentSeaAIConfig['source']>('none');
  const [secureAIStorageAvailable, setSecureAIStorageAvailable] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [exportingLog, setExportingLog] = useState(false);
  const { cruises, bookedCruises, casinoOffers, calendarEvents } = useCoreData();
  const { totalCruises, totalSourceCruises } = useCruiseInventory();
  const { searchableCertificates: certificates } = useCertificates();
  const { users, currentUser } = useUser();
  const { authenticatedEmail } = useAuth();
  const { colors, preferences } = useExperience();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const { messages, isLoading, isVisible, error: agentError, sendMessage, clearMessages, setMode, setVisible, conversationThreads, activeConversationId, startNewConversation, openConversation, confirmAgentAction, cancelAgentAction } = useAgentX();

  const leaveAgentSea = useCallback(() => {
    Keyboard.dismiss();
    setAISettingsOpen(false);
    // Tear down the large Agent SEA data scope before starting the native back
    // transition so no index or network callback can compete with navigation.
    setVisible(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/analytics');
    }
  }, [router, setVisible]);

  useEffect(() => {
    let cancelled = false;
    void loadAgentSeaAIConfig(authenticatedEmail).then((config) => {
      if (cancelled) return;
      setAIKey(config.apiKey);
      setAIModel(config.model);
      setAIConnected(config.isConfigured);
      setAISource(config.source);
      setSecureAIStorageAvailable(config.secureStorageAvailable);
    });
    return () => { cancelled = true; };
  }, [authenticatedEmail]);

  const saveAISettings = async () => {
    setSavingAI(true);
    try {
      const config = await saveAgentSeaAIConfig({ apiKey: aiKey, model: aiModel, authenticatedEmail });
      setAIConnected(config.isConfigured);
      setAISource(config.source);
      setSecureAIStorageAvailable(config.secureStorageAvailable);
      setAIModel(config.model);
      setAISettingsOpen(false);
    } catch (saveError) {
      Alert.alert('AI Settings Not Saved', saveError instanceof Error ? saveError.message : 'Agent SEA could not securely save the AI settings.');
    } finally {
      setSavingAI(false);
    }
  };

  useEffect(() => {
    setVisible(true);
    return () => setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    setMode('easySeasGuide');
  }, [setMode]);

  useEffect(() => {
    if (!isVisible || !incomingQuery || sentIncomingPromptRef.current === incomingQuery) return;
    sentIncomingPromptRef.current = incomingQuery;
    void sendMessage(incomingQuery);
  }, [incomingQuery, isVisible, sendMessage]);

  const activePrivateProfileId = selectedProfileId === 'all' ? (currentUser?.id ?? 'unassigned') : selectedProfileId;
  const privateFilterSnapshot = useMemo(() => ({ selectedProfileId: activePrivateProfileId, selectedBrand, selectedProgram }), [activePrivateProfileId, selectedBrand, selectedProgram]);
  const sharedFilterSnapshot = useMemo(() => ({ selectedProfileId: 'all' as const, selectedBrand, selectedProgram }), [selectedBrand, selectedProgram]);
  const scopedOffers = useMemo(() => filterRecordsByIntelligence(casinoOffers, sharedFilterSnapshot, users), [casinoOffers, sharedFilterSnapshot, users]);
  const scopedCruises = useMemo(() => filterRecordsByIntelligence(cruises, sharedFilterSnapshot, users), [cruises, sharedFilterSnapshot, users]);
  const scopedBooked = useMemo(() => filterRecordsByIntelligence(bookedCruises, privateFilterSnapshot, users), [bookedCruises, privateFilterSnapshot, users]);
  const scopedCertificates = useMemo(() => filterRecordsByIntelligence(certificates as Array<Certificate & { ownerProfileId?: string; sourceEmail?: string; brand?: string; casinoProgram?: string }>, sharedFilterSnapshot, users), [certificates, sharedFilterSnapshot, users]);
  const scopedCalendar = useMemo(() => filterRecordsByIntelligence(calendarEvents, privateFilterSnapshot, users), [calendarEvents, privateFilterSnapshot, users]);

  const scopeLabel = useMemo(() => {
    const profile = activePrivateProfileId === 'unassigned'
        ? 'Unassigned Imports'
        : getProfileDisplayName(users.find((candidate) => candidate.id === activePrivateProfileId));
    return `${profile} • ${getBrandLabel(selectedBrand)} • ${getProgramLabel(selectedProgram)}`;
  }, [activePrivateProfileId, selectedBrand, selectedProgram, users]);

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
      availableCruises: totalSourceCruises || totalCruises || scopedCruises.length,
      bookedCruises: currentBooked,
      pastCruises,
      certificates: scopedCertificates.length,
      certificateSailings,
      calendar: scopedCalendar.length,
    };
  }, [scopedBooked, scopedCalendar.length, scopedCertificates, scopedCruises.length, scopedOffers.length, totalCruises, totalSourceCruises]);

  const handleExportLog = async () => {
    if (messages.length === 0) return;
    try {
      setExportingLog(true);
      await exportAgentSeaConversationLog(messages, conversationThreads, {
        activeConversationId,
        scopeLabel,
        scopeCounts: stats,
        aiConnected,
        aiModel,
        providerError: agentError,
        isLoading,
      });
    } catch (exportError) {
      console.error('[Agent SEA] Conversation log export failed:', exportError);
      Alert.alert('Export Log Failed', exportError instanceof Error ? exportError.message : 'The Agent SEA conversation log could not be exported.');
    } finally {
      setExportingLog(false);
    }
  };

  const handleSaveConversation = async () => {
    if (messages.length === 0) return;
    try {
      const saved = await saveAgentSeaConversation(messages);
      if (saved) Alert.alert('Conversation Saved', 'A readable Agent SEA conversation file is ready to share or save in Files.');
    } catch (saveError) {
      Alert.alert('Save Failed', saveError instanceof Error ? saveError.message : 'The conversation could not be saved.');
    }
  };

  const handlePrintConversation = async () => {
    if (messages.length === 0) return;
    try {
      await printAgentSeaConversation(messages);
    } catch (printError) {
      Alert.alert('Print Failed', printError instanceof Error ? printError.message : 'The conversation could not be printed.');
    }
  };

  const handleShareConversation = async () => {
    if (messages.length === 0) return;
    try {
      await shareAgentSeaConversation(messages);
    } catch (shareError) {
      Alert.alert('Share Failed', shareError instanceof Error ? shareError.message : 'The conversation could not be shared.');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {preferences.theme === 'light' ? <Image source={require('../assets/images/section-themes/offers-certificates-v1.png')} style={styles.nauticalBackdrop} contentFit="cover" cachePolicy="memory-disk" accessibilityIgnoresInvertColors /> : null}
      <LinearGradient colors={preferences.theme === 'high-contrast' || preferences.theme === 'dark' ? [colors.background, colors.surface, colors.background] : ['rgba(243,246,247,.86)', 'rgba(255,253,249,.94)', 'rgba(232,247,251,.97)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardSurface}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          testID="ask-my-data-keyboard-surface"
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={leaveAgentSea} testID="ask-my-data-close" accessibilityLabel="Close Agent SEA"><X size={21} color="#1C2F7A" /></TouchableOpacity>
            <View style={styles.agentAvatar}><Bot size={22} color="#0E7FA7" /></View>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Agent SEA</Text>
              <View style={styles.readyRow}><View style={[styles.readyDot, aiConnected && styles.readyDotAI]} /><Text style={styles.subtitle}>{aiConnected ? `AI + Easy Seas data · ${aiModel}` : 'Easy Seas data ready · AI enhances automatically when configured'}</Text></View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setAISettingsOpen(true)} testID="agent-sea-ai-settings" accessibilityLabel="Agent SEA AI settings"><Settings2 size={19} color="#1C2F7A" /></TouchableOpacity>
          </View>

          <View style={[styles.actionBar, styles.actionBarContent]} testID="agent-sea-top-actions" accessibilityLabel="Agent SEA conversation actions">
            <TouchableOpacity style={styles.actionButton} onPress={startNewConversation} testID="ask-my-data-new-conversation" accessibilityLabel="New Agent SEA conversation"><MessageCirclePlus size={17} color="#1C2F7A" /><Text style={styles.actionText}>New</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, historyOpen && styles.actionButtonActive]} onPress={() => setHistoryOpen((open) => !open)} accessibilityLabel="Saved conversations"><List size={17} color="#1C2F7A" /><Text style={styles.actionText}>Chats</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, filtersOpen && styles.actionButtonActive]} onPress={() => setFiltersOpen((open) => !open)} testID="ask-my-data-toggle-filters" accessibilityLabel="Agent SEA data filters"><SlidersHorizontal size={17} color="#1C2F7A" /><Text style={styles.actionText}>Filter</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, messages.length === 0 && styles.actionButtonDisabled]} disabled={messages.length === 0} onPress={() => void handleSaveConversation()} testID="agent-sea-save-conversation" accessibilityLabel="Save Agent SEA conversation"><Save size={17} color="#1C2F7A" /><Text style={styles.actionText}>Save</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, messages.length === 0 && styles.actionButtonDisabled]} disabled={messages.length === 0} onPress={() => void handlePrintConversation()} testID="agent-sea-print-conversation" accessibilityLabel="Print Agent SEA conversation"><Printer size={17} color="#1C2F7A" /><Text style={styles.actionText}>Print</Text></TouchableOpacity>
          </View>

          <View style={styles.scopeLine} testID="ask-my-data-current-scope"><Text style={styles.scopeLineText} numberOfLines={1}>{scopeLabel} · {stats.bookedCruises} booked · {stats.pastCruises} past · {stats.certificates} certificates</Text></View>
          {filtersOpen ? <View style={styles.filterStrip}><IntelligenceFilterStrip contextLabel="Agent SEA" compact /></View> : null}
          {historyOpen ? <View style={styles.historyRow} testID="ask-my-data-saved-conversations"><FlatList horizontal data={conversationThreads.filter((thread) => !thread.archivedAt).slice(0, 12)} keyExtractor={(thread) => thread.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll} renderItem={({ item: thread }) => (
            <TouchableOpacity style={[styles.historyChip, activeConversationId === thread.id && styles.historyChipActive]} onPress={() => { openConversation(thread.id); setHistoryOpen(false); }} testID={`ask-my-data-conversation-${thread.id}`}><Text style={[styles.historyChipText, activeConversationId === thread.id && styles.historyChipTextActive]} numberOfLines={1}>{thread.title}</Text></TouchableOpacity>
          )} /></View> : null}

          <View style={styles.chatCard} testID="agent-sea-unified-agent">
            <AgentXChat
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={isLoading}
              showHeader={false}
              placeholder="Message Agent SEA…"
              mode="easySeasGuide"
              contextLabel="Agent SEA"
              welcomeTitle="Agent SEA is ready."
              welcomeSubtitle="Ask naturally about offers, cruises, certificates, booked and completed cruises, casino points, crew recognition, calendar, or weather. I’ll reason across your local Easy Seas records, cite what I used, and tell you when data is missing."
              disclaimerText="Agent SEA uses your selected local Easy Seas data and cites its evidence."
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

          <View style={styles.bottomActions} testID="agent-sea-bottom-actions">
            <TouchableOpacity style={[styles.bottomActionButton, messages.length === 0 && styles.actionButtonDisabled]} disabled={messages.length === 0} onPress={() => void handleShareConversation()} testID="agent-sea-share-conversation" accessibilityLabel="Share Agent SEA conversation"><Share2 size={17} color="#1C2F7A" /><Text style={styles.bottomActionText}>Share conversation</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.bottomActionButton, (messages.length === 0 || exportingLog) && styles.actionButtonDisabled]} disabled={messages.length === 0 || exportingLog} onPress={() => void handleExportLog()} testID="agent-sea-export-log" accessibilityLabel="Export Agent SEA diagnostic log">{exportingLog ? <ActivityIndicator size="small" color="#1C2F7A" /> : <FileDown size={17} color="#1C2F7A" />}<Text style={styles.bottomActionText}>Export log</Text></TouchableOpacity>
          </View>

          <Modal visible={aiSettingsOpen} transparent animationType="fade" onRequestClose={() => setAISettingsOpen(false)}>
            <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView style={[styles.aiModal, { maxHeight: Math.max(280, windowHeight * (isLandscape ? 0.84 : 0.9)) }]} contentContainerStyle={styles.aiModalContent} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} testID="agent-sea-ai-settings-modal">
                <View style={styles.aiModalHeader}>
                  <View style={styles.aiModalTitleRow}><Bot size={20} color="#0F766E" /><Text style={styles.aiModalTitle}>Agent SEA AI</Text></View>
                  <TouchableOpacity onPress={() => setAISettingsOpen(false)}><X size={22} color={COLORS.navyDeep} /></TouchableOpacity>
                </View>
                <Text style={styles.aiModalBody}>Agent SEA works immediately. AI reasoning receives a bounded owner-scoped evidence manifest; deterministic Easy Seas calculations still answer first and remain available offline.</Text>
                {aiSource === 'proxy' ? (
                  <View style={styles.aiConnectionCard} testID="agent-sea-built-in-ai-status">
                    <Text style={styles.aiConnectionTitle}>Built-in AI is ready</Text>
                    <Text style={styles.aiConnectionBody}>This account uses the Easy Seas server connection. The provider credential is never stored in this app, its backups, conversation exports, logs, or source bundle.</Text>
                    <TouchableOpacity style={styles.aiSaveButton} onPress={() => setAISettingsOpen(false)}><Text style={styles.aiSaveText}>Done</Text></TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.aiFieldLabel}>OpenAI API key</Text>
                    <TextInput
                      value={aiKey}
                      onChangeText={setAIKey}
                      placeholder="sk-…"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      editable={secureAIStorageAvailable}
                      style={[styles.aiInput, !secureAIStorageAvailable && styles.aiInputDisabled]}
                      testID="agent-sea-api-key-input"
                    />
                    {!secureAIStorageAvailable ? <Text style={styles.aiStorageWarning}>SecureStore is unavailable on this device. Agent SEA will not save a personal provider key in ordinary app storage.</Text> : null}
                    <Text style={styles.aiFieldLabel}>Model</Text>
                    <TextInput
                      value={aiModel}
                      onChangeText={setAIModel}
                      placeholder="gpt-5.5"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.aiInput}
                      testID="agent-sea-model-input"
                    />
                    <View style={styles.aiModalActions}>
                      <TouchableOpacity style={styles.aiDisconnectButton} onPress={() => setAIKey('')}><Text style={styles.aiDisconnectText}>Use local only</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.aiSaveButton} disabled={savingAI || (!secureAIStorageAvailable && Boolean(aiKey.trim()))} onPress={() => void saveAISettings()} testID="agent-sea-save-ai-settings">
                        {savingAI ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.aiSaveText}>Save AI</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F2EA' },
  safeArea: { flex: 1 },
  keyboardSurface: { flex: 1, minHeight: 0 },
  nauticalBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D5D0', backgroundColor: 'rgba(255,253,249,.91)' },
  agentAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#B8D1DC' },
  titleCopy: { flex: 1 },
  title: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: TYPOGRAPHY.fontWeightBold },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  readyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E6B63D' },
  readyDotAI: { backgroundColor: '#4EC0A5' },
  subtitle: { flex: 1, color: '#676A70', fontSize: 10 },
  actionBar: { flexGrow: 0, backgroundColor: 'rgba(255,253,249,.91)' },
  actionBarContent: { flexDirection: 'row', alignItems: 'stretch', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 7 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 50, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2, borderRadius: 14, borderWidth: 1, borderColor: '#D5D5D0', backgroundColor: '#F5F5F4' },
  actionButtonActive: { backgroundColor: '#E0F2FE', borderColor: '#0E7FA7' },
  actionButtonDisabled: { opacity: 0.35 },
  actionText: { color: '#1C2F7A', fontSize: 10, fontWeight: '800' },
  scopeLine: { paddingHorizontal: SPACING.md, paddingVertical: 5, backgroundColor: 'rgba(234,247,250,.94)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D5D0' },
  scopeLineText: { color: '#676A70', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  aiButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: BORDER_RADIUS.round, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  aiButtonConnected: { backgroundColor: '#A7F3D0', borderColor: '#6EE7B7' },
  aiButtonText: { color: '#E0F2FE', fontSize: 11, fontWeight: '900' },
  aiButtonTextConnected: { color: '#064E3B' },
  logButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: BORDER_RADIUS.round, backgroundColor: 'rgba(14,165,233,0.18)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.45)' },
  logButtonDisabled: { opacity: 0.42 },
  logButtonText: { color: '#E0F2FE', fontSize: 10, fontWeight: '900' },
  clearButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: BORDER_RADIUS.round, backgroundColor: '#B91C1C' },
  clearText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#D5D5D0' },
  scopeCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.md, marginBottom: 6, paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: BORDER_RADIUS.lg, backgroundColor: '#F5F5F4', ...SHADOW.sm },
  scopeTitleGroup: { flex: 1 },
  scopeLabel: { color: '#0F766E', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  scopeProfile: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '800', marginTop: 1 },
  scopeCounts: { color: '#475569', fontSize: 10, fontWeight: '700', lineHeight: 14, marginTop: 2 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: BORDER_RADIUS.round, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#3D87BF' },
  filterText: { color: COLORS.navyDeep, fontSize: 11, fontWeight: '800' },
  filterStrip: { paddingHorizontal: SPACING.sm, marginBottom: SPACING.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: SPACING.sm, paddingVertical: 5, backgroundColor: '#F5F5F4' },
  newChatButton: { backgroundColor: '#A7F3D0', borderRadius: BORDER_RADIUS.round, paddingHorizontal: 11, paddingVertical: 7 },
  newChatText: { color: '#064E3B', fontSize: 11, fontWeight: '900' },
  historyScroll: { gap: 6, paddingRight: SPACING.md },
  historyChip: { maxWidth: 180, borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: '#D5D5D0', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  historyChipActive: { backgroundColor: '#E0F2FE', borderColor: '#3D87BF' },
  historyChipText: { color: '#676A70', fontSize: 10, fontWeight: '700' },
  historyChipTextActive: { color: COLORS.navyDeep },
  chatCard: { flex: 1, minHeight: 0, overflow: 'hidden', marginHorizontal: 8, marginTop: 6, borderWidth: 1, borderColor: 'rgba(14,127,167,.18)', borderRadius: 20, backgroundColor: 'rgba(255,253,249,.95)', ...SHADOW.sm },
  bottomActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D5D5D0', backgroundColor: 'rgba(255,253,249,.93)' },
  bottomActionButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: BORDER_RADIUS.round, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#D5D5D0' },
  bottomActionText: { color: '#1C2F7A', fontSize: 10, fontWeight: '900' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, backgroundColor: 'rgba(2, 12, 27, 0.72)' },
  aiModal: { width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: BORDER_RADIUS.xl, backgroundColor: '#F5F5F4', ...SHADOW.lg },
  aiModalContent: { padding: SPACING.lg },
  aiModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  aiModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  aiModalTitle: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: '900' },
  aiModalBody: { color: '#475569', fontSize: 13, lineHeight: 19, marginBottom: SPACING.md },
  aiFieldLabel: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  aiInput: { minHeight: 46, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: BORDER_RADIUS.md, backgroundColor: '#FFFFFF', color: COLORS.navyDeep, paddingHorizontal: 12, paddingVertical: 10, marginBottom: SPACING.md },
  aiInputDisabled: { opacity: 0.5, backgroundColor: '#E2E8F0' },
  aiStorageWarning: { color: '#9A3412', fontSize: 12, lineHeight: 17, marginTop: -8, marginBottom: SPACING.md },
  aiConnectionCard: { gap: SPACING.sm, borderWidth: 1, borderColor: '#4EC0A5', borderRadius: BORDER_RADIUS.lg, backgroundColor: '#ECFDF5', padding: SPACING.md },
  aiConnectionTitle: { color: '#065F46', fontSize: 17, fontWeight: '900' },
  aiConnectionBody: { color: '#334155', fontSize: 13, lineHeight: 19 },
  aiModalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACING.sm },
  aiDisconnectButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: '#D5D5D0' },
  aiDisconnectText: { color: '#334155', fontWeight: '800' },
  aiSaveButton: { minWidth: 110, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: '#0F766E' },
  aiSaveText: { color: '#FFFFFF', fontWeight: '900' },
});
