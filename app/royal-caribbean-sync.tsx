import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync } from '@/state/RoyalCaribbeanSyncProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { ChevronDown, ChevronUp, Loader2, CheckCircle, AlertCircle, XCircle, Ship, Calendar, Clock, ExternalLink, RefreshCcw, Download } from 'lucide-react-native';
import { WebViewMessage } from '@/lib/royalCaribbean/types';
import { AUTH_DETECTION_SCRIPT } from '@/lib/royalCaribbean/authDetection';
import { useCoreData } from '@/state/CoreDataProvider';

function RoyalCaribbeanSyncScreen() {
  const coreData = useCoreData();
  const loyalty = useLoyalty();
  const {
    state,
    webViewRef,
    openLogin,
    runIngestion,
    exportOffersCSV,
    exportBookedCruisesCSV,
    exportLog,
    resetState,
    syncToApp,
    cancelSync,
    handleWebViewMessage
  } = useRoyalCaribbeanSync();

  const [webViewVisible, setWebViewVisible] = useState(true);

  const onMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
      handleWebViewMessage(message);
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'not_logged_in':
        return '#94a3b8';
      case 'logged_in':
        return '#10b981';
      case 'running_step_1':
      case 'running_step_2':
      case 'running_step_3':
      case 'running_step_4':
        return '#3b82f6';
      case 'awaiting_confirmation':
        return '#f59e0b';
      case 'syncing':
        return '#3b82f6';
      case 'complete':
        return '#22c55e';
      case 'login_expired':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'not_logged_in':
        return 'Not Logged In';
      case 'logged_in':
        return 'Logged In - Ready to Scrape';
      case 'running_step_1':
        if (state.progress && state.progress.stepName) {
          return state.progress.stepName;
        }
        if (state.progress && state.progress.current > 0) {
          return `Scraping Offers - ${state.progress.current} scraped`;
        }
        return 'Loading Club Royale Offers Page...';
      case 'running_step_2':
        if (state.progress && state.progress.stepName) {
          return state.progress.stepName;
        }
        if (state.progress && state.progress.current > 0) {
          return `Scraping Upcoming - ${state.progress.current} scraped`;
        }
        return 'Loading Upcoming Cruises Page...';
      case 'running_step_3':
        if (state.progress && state.progress.stepName) {
          return state.progress.stepName;
        }
        if (state.progress && state.progress.current > 0) {
          return `Scraping Holds - ${state.progress.current} scraped`;
        }
        return 'Loading Courtesy Holds Page...';
      case 'running_step_4':
        return 'Loading Loyalty Programs Page...';
      case 'awaiting_confirmation':
        return 'Ready to Sync';
      case 'syncing':
        return 'Syncing to App...';
      case 'complete':
        return 'Complete';
      case 'login_expired':
        return 'Login Expired';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    const color = '#fff';
    const size = 16;
    
    switch (state.status) {
      case 'running_step_1':
      case 'running_step_2':
      case 'running_step_3':
      case 'running_step_4':
      case 'syncing':
        return <Loader2 size={size} color={color} />;
      case 'complete':
        return <CheckCircle size={size} color={color} />;
      case 'awaiting_confirmation':
        return <Clock size={size} color={color} />;
      case 'login_expired':
      case 'error':
        return <AlertCircle size={size} color={color} />;
      default:
        return null;
    }
  };

  const canRunIngestion = state.status === 'logged_in';
  const canExport = state.status === 'complete' || state.status === 'awaiting_confirmation';
  const isRunning = state.status.startsWith('running_') || state.status === 'syncing';
  const showConfirmation = state.status === 'awaiting_confirmation';

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Royal Caribbean Sync',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff'
        }}
      />
      
      <View style={styles.container}>
        <View style={[styles.statusPill, { backgroundColor: getStatusColor() }]}>
          {getStatusIcon()}
          <Text style={styles.statusText}>Status: {getStatusText()}</Text>
        </View>

        <Pressable 
          style={styles.webViewToggle}
          onPress={() => setWebViewVisible(!webViewVisible)}
        >
          <Text style={styles.webViewToggleText}>
            {webViewVisible ? 'Hide' : 'Show'} Browser
          </Text>
          {webViewVisible ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </Pressable>

        {webViewVisible && (
          <View style={styles.webViewContainer}>
            <WebView
              ref={(ref) => {
                if (ref) {
                  webViewRef.current = ref;
                }
              }}
              source={{ uri: 'https://www.royalcaribbean.com/club-royale' }}
              style={styles.webView}
              onMessage={onMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              injectedJavaScriptBeforeContentLoaded={AUTH_DETECTION_SCRIPT}
            />
          </View>
        )}

        <View style={styles.actionsContainer}>
          <View style={styles.quickActionsGrid}>
            <Pressable 
              style={styles.quickActionButton}
              onPress={openLogin}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 112, 201, 0.1)' }]}>
                <ExternalLink size={14} color="#0070C9" />
              </View>
              <Text style={styles.quickActionLabel}>Login</Text>
            </Pressable>

            <Pressable 
              style={[styles.quickActionButton, (!canRunIngestion || isRunning) && styles.buttonDisabled]}
              onPress={runIngestion}
              disabled={!canRunIngestion || isRunning}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                <RefreshCcw size={14} color="#4CAF50" />
              </View>
              <Text style={styles.quickActionLabel}>SYNC NOW</Text>
            </Pressable>

            <Pressable 
              style={[styles.quickActionButton, !canExport && styles.buttonDisabled]}
              onPress={exportOffersCSV}
              disabled={!canExport}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                <Download size={14} color="#9C27B0" />
              </View>
              <Text style={styles.quickActionLabel}>Export Offers</Text>
            </Pressable>

            <Pressable 
              style={[styles.quickActionButton, !canExport && styles.buttonDisabled]}
              onPress={exportBookedCruisesCSV}
              disabled={!canExport}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                <Download size={14} color="#2196F3" />
              </View>
              <Text style={styles.quickActionLabel}>Export Booked</Text>
            </Pressable>

            <Pressable 
              style={styles.quickActionButton}
              onPress={exportLog}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(96, 125, 139, 0.1)' }]}>
                <Download size={14} color="#607D8B" />
              </View>
              <Text style={styles.quickActionLabel}>Export Log</Text>
            </Pressable>

            <Pressable 
              style={styles.quickActionButton}
              onPress={resetState}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
                <XCircle size={14} color="#F44336" />
              </View>
              <Text style={styles.quickActionLabel}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.logsContainer}>
            <Text style={styles.logsTitle}>Sync Log</Text>
            <ScrollView style={styles.logsScroll}>
              {state.logs.map((log, index) => (
                <View key={index} style={[styles.logEntry, log.type === 'error' && styles.logError]}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={[
                    styles.logMessage,
                    log.type === 'error' && styles.logMessageError,
                    log.type === 'success' && styles.logMessageSuccess
                  ]}>
                    {log.message}
                  </Text>
                </View>
              ))}
              {state.logs.length === 0 && (
                <Text style={styles.logsEmpty}>No logs yet</Text>
              )}
            </ScrollView>
          </View>

        {state.error && (
          <View style={styles.errorContainer}>
            <XCircle size={20} color="#ef4444" />
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        )}

        <Modal
          visible={showConfirmation}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelSync}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmationModal}>
              <View style={styles.confirmationHeader}>
                <CheckCircle size={32} color="#10b981" />
                <Text style={styles.confirmationTitle}>Data Extraction Complete</Text>
                <Text style={styles.confirmationSubtitle}>Ready to sync to your app</Text>
              </View>

              <View style={styles.confirmationContent}>
                <View style={styles.countCard}>
                  <View style={styles.countIconContainer}>
                    <Ship size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.countInfo}>
                    <Text style={styles.countNumber}>
                      {state.syncCounts?.offerRows || 0} sailings
                    </Text>
                    <Text style={styles.countLabel}>Club Royale Offers</Text>
                    {state.syncCounts && state.syncCounts.offerRows > 0 && (
                      <Text style={styles.countDetail}>
                        {state.syncCounts.offerCount} unique offer{state.syncCounts.offerCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.countCard}>
                  <View style={styles.countIconContainer}>
                    <Calendar size={24} color="#10b981" />
                  </View>
                  <View style={styles.countInfo}>
                    <Text style={styles.countNumber}>{state.syncCounts?.upcomingCruises || 0}</Text>
                    <Text style={styles.countLabel}>Upcoming Cruises</Text>
                    <Text style={styles.countDetail}>Will be added to Booked</Text>
                  </View>
                </View>

                <View style={styles.countCard}>
                  <View style={styles.countIconContainer}>
                    <Clock size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.countInfo}>
                    <Text style={styles.countNumber}>{state.syncCounts?.courtesyHolds || 0}</Text>
                    <Text style={styles.countLabel}>Courtesy Holds</Text>
                    <Text style={styles.countDetail}>Marked as &ldquo;On Hold&rdquo;</Text>
                  </View>
                </View>

                {state.loyaltyData && (
                  <View style={styles.loyaltyCard}>
                    <Text style={styles.loyaltyTitle}>Loyalty Status Updates</Text>
                    {state.loyaltyData.clubRoyaleTier && (
                      <View style={styles.loyaltyRow}>
                        <Text style={styles.loyaltyLabel}>Club Royale:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.clubRoyaleTier}</Text>
                      </View>
                    )}
                    {state.loyaltyData.clubRoyalePoints && (
                      <View style={styles.loyaltyRow}>
                        <Text style={styles.loyaltyLabel}>CR Points:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.clubRoyalePoints}</Text>
                      </View>
                    )}
                    {state.loyaltyData.crownAndAnchorLevel && (
                      <View style={styles.loyaltyRow}>
                        <Text style={styles.loyaltyLabel}>Crown & Anchor:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.crownAndAnchorLevel}</Text>
                      </View>
                    )}
                    {state.loyaltyData.crownAndAnchorPoints && (
                      <View style={styles.loyaltyRow}>
                        <Text style={styles.loyaltyLabel}>C&A Points:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.crownAndAnchorPoints}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.warningBox}>
                  <AlertCircle size={16} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    Sync will update existing data. If conflicts exist, synced data wins.
                  </Text>
                </View>
              </View>

              <Text style={styles.confirmationQuestion}>Sync this data to the app?</Text>

              <View style={styles.confirmationButtons}>
                <Pressable 
                  style={[styles.button, styles.cancelButton]}
                  onPress={cancelSync}
                >
                  <Text style={styles.cancelButtonText}>No</Text>
                </Pressable>

                <Pressable 
                  style={[styles.button, styles.confirmButton]}
                  onPress={() => syncToApp(coreData, loyalty)}
                >
                  <Text style={styles.buttonText}>Yes, Sync Now</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {state.status === 'complete' && state.lastSyncTimestamp && (
          <View style={styles.successContainer}>
            <CheckCircle size={24} color="#10b981" />
            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Sync Complete!</Text>
              <Text style={styles.successMessage}>
                {state.syncCounts && (
                  `Successfully synced ${state.syncCounts.offerCount} offer with ${state.syncCounts.offerRows} sailing${state.syncCounts.offerRows !== 1 ? 's' : ''}, ${state.syncCounts.upcomingCruises} upcoming cruise${state.syncCounts.upcomingCruises !== 1 ? 's' : ''}, and ${state.syncCounts.courtesyHolds} courtesy hold${state.syncCounts.courtesyHolds !== 1 ? 's' : ''} to your app.`
                )}
              </Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 12,
    borderRadius: 24
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9
  },
  webViewToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  webViewToggleText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500' as const
  },
  webViewContainer: {
    height: 300,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  webView: {
    flex: 1
  },
  actionsContainer: {
    padding: 12
  },
  quickActionsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12
  },
  quickActionButton: {
    width: 'calc(33.333% - 8px)' as any,
    minWidth: 100,
    height: 48,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  quickActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  quickActionLabel: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center' as const
  },
  buttonDisabled: {
    opacity: 0.5
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  logsContainer: {
    flex: 1,
    margin: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden' as const
  },
  logsTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600' as const,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  logsScroll: {
    flex: 1,
    padding: 12
  },
  logEntry: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  logError: {
    backgroundColor: '#7f1d1d22'
  },
  logTimestamp: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 2
  },
  logMessage: {
    color: '#cbd5e1',
    fontSize: 12
  },
  logMessageError: {
    color: '#f87171'
  },
  logMessageSuccess: {
    color: '#4ade80'
  },
  logsEmpty: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center' as const,
    paddingVertical: 24
  },
  errorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: '#7f1d1d',
    borderRadius: 8
  },
  errorText: {
    flex: 1,
    color: '#fecaca',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20
  },
  confirmationModal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  confirmationHeader: {
    alignItems: 'center' as const,
    marginBottom: 24
  },
  confirmationTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700' as const,
    marginTop: 12,
    marginBottom: 4
  },
  confirmationSubtitle: {
    color: '#94a3b8',
    fontSize: 14
  },
  confirmationContent: {
    gap: 12,
    marginBottom: 24
  },
  countCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  countIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  countInfo: {
    flex: 1
  },
  countNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 2
  },
  countLabel: {
    color: '#94a3b8',
    fontSize: 14
  },
  countDetail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  confirmationQuestion: {
    color: '#cbd5e1',
    fontSize: 16,
    textAlign: 'center' as const,
    marginBottom: 24,
    fontWeight: '500' as const
  },
  confirmationButtons: {
    flexDirection: 'row' as const,
    gap: 12
  },
  cancelButton: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569'
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600' as const
  },
  confirmButton: {
    backgroundColor: '#059669',
    flex: 1.5
  },
  successContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    margin: 12,
    padding: 16,
    backgroundColor: '#064e3b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#059669'
  },
  successContent: {
    flex: 1
  },
  successTitle: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4
  },
  successMessage: {
    color: '#6ee7b7',
    fontSize: 13,
    lineHeight: 18
  },
  loyaltyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  loyaltyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12
  },
  loyaltyRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8
  },
  loyaltyLabel: {
    color: '#94a3b8',
    fontSize: 14
  },
  loyaltyValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  warningBox: {
    backgroundColor: '#78350f',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  warningText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 16
  }
});

export default function RoyalCaribbeanSyncScreenWrapper() {
  return (
    <RoyalCaribbeanSyncProvider>
      <RoyalCaribbeanSyncScreen />
    </RoyalCaribbeanSyncProvider>
  );
}
