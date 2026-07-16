import { View, Text, StyleSheet, Pressable, Modal, Platform, Linking, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Stack, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useCallback, useMemo, useState } from 'react';
import { CarnivalSyncProvider, useRoyalCaribbeanSync } from '@/state/RoyalCaribbeanSyncProvider';
import { exportFile } from '@/lib/importExport';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { ChevronDown, ChevronUp, LoaderCircle, CheckCircle, AlertCircle, XCircle, Ship, Calendar, Clock, ExternalLink, RefreshCcw, Anchor, Star, Award, Cookie, FileDown, FileText } from 'lucide-react-native';
import { WebViewMessage } from '@/lib/royalCaribbean/types';
import { AUTH_DETECTION_SCRIPT } from '@/lib/royalCaribbean/authDetection';
import { useCoreData } from '@/state/CoreDataProvider';
import { WebSyncCredentialsModal } from '@/components/WebSyncCredentialsModal';
import { WebCookieSyncModal } from '@/components/WebCookieSyncModal';
import { LoyaltyPill } from '@/components/ui/LoyaltyPill';
import { getCarnivalPlayersClubTierColor, getCarnivalVifpTierColor } from '@/constants/loyaltyTheme';
import { useAuth } from '@/state/AuthProvider';
import { trpc, isWebSyncAvailable } from '@/lib/trpc';
const CARNIVAL_RED = '#CC2232';
const CARNIVAL_GOLD = '#FFB400';
const CARNIVAL_DARK = '#0c1520';
const CARNIVAL_CARD = '#1a2535';
const CARNIVAL_BORDER = '#2a3a50';
const MAX_WEBVIEW_MESSAGE_SIZE = 350000;

function CarnivalSyncScreen() {
  const router = useRouter();
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const coreData = useCoreData();
  const loyalty = useLoyalty();
  const {
    state,
    webViewRef,
    cruiseLine: _cruiseLine,
    setCruiseLine: _setCruiseLine,
    config: _config,
    openLogin,
    confirmCarnivalLogin,
    runIngestion,
    syncToApp,
    cancelSync,
    handleWebViewMessage,
    addLog,
    extendedLoyaltyData,
    webViewUrl,
    onPageLoadStarted,
    onPageLoaded,
  } = useRoyalCaribbeanSync();

  const [webViewVisible, setWebViewVisible] = useState(true);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [webSyncError, setWebSyncError] = useState<string | null>(null);
  const [cookieSyncError, setCookieSyncError] = useState<string | null>(null);
  const [isExportingLog, setIsExportingLog] = useState(false);
  const [isConfirmingSync, setIsConfirmingSync] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const webLoginMutation = trpc.royalCaribbeanSync.webLogin.useMutation();
  const cookieSyncMutation = trpc.royalCaribbeanSync.cookieSync.useMutation();

  const isBackendAvailable = isWebSyncAvailable();
  const isCompactWindow = windowWidth < 420;
  const browserPanelHeight = useMemo(() => {
    const preferredHeight = Platform.OS === 'web' ? windowHeight * 0.4 : windowHeight * 0.42;
    const minHeight = Platform.OS === 'web' ? 260 : 280;
    const maxHeight = Platform.OS === 'web' ? 460 : 420;
    return Math.max(minHeight, Math.min(preferredHeight, maxHeight));
  }, [windowHeight]);

  const handleCookieSync = async (cookies: string) => {
    console.log('[CarnivalCookieSync] Starting...');
    setCookieSyncError(null);

    if (!isBackendAvailable) {
      setCookieSyncError('Backend not available for cookie sync. Use the mobile app browser instead.');
      addLog('Backend not available for cookie sync', 'warning');
      return;
    }

    addLog('Starting cookie-based sync...', 'info');

    try {
      const result = await cookieSyncMutation.mutateAsync({ cookies, cruiseLine: 'carnival' });
      if (!result.success) {
        setCookieSyncError(result.error || 'Cookie sync failed');
        addLog('Cookie sync failed', 'error');
        return;
      }
      addLog(`Cookie sync successful - ${result.offers.length} offers, ${result.bookedCruises.length} cruises`, 'success');
      setShowCookieModal(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to connect to sync service';
      setCookieSyncError(msg);
      addLog(`Cookie sync error: ${msg}`, 'error');
    }
  };

  const handleWebSync = async (username: string, password: string) => {
    console.log('[CarnivalWebSync] Starting...');
    setWebSyncError(null);

    if (!isBackendAvailable) {
      setWebSyncError('Backend not available. Use the Easy Seas browser extension or the in-app browser to sync Carnival.');
      addLog('Backend not available - use browser-assisted Carnival sync', 'warning');
      return;
    }

    addLog('Starting web-based sync...', 'info');

    try {
      const result = await webLoginMutation.mutateAsync({ username, password, cruiseLine: 'carnival' });
      if (!result.success) {
        setWebSyncError(result.error || 'Web sync is not available');
        addLog('Web sync not available - use Carnival browser-assisted sync', 'warning');
        return;
      }
      addLog('Web sync completed!', 'success');
      setShowCredentialsModal(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to connect to sync service';
      setWebSyncError(msg);
      addLog(`Web sync error: ${msg}`, 'error');
    }
  };


  const onMessage = (event: any) => {
    const rawData = typeof event?.nativeEvent?.data === 'string' ? event.nativeEvent.data : '';

    if (!rawData) {
      return;
    }

    if (rawData.length > MAX_WEBVIEW_MESSAGE_SIZE) {
      console.warn('[CarnivalSync] Ignoring oversized WebView message:', rawData.length);
      addLog('Ignored an oversized browser message to prevent a crash. Sync will continue with chunked data.', 'warning');
      return;
    }

    try {
      const parsedMessage = JSON.parse(rawData) as unknown;
      if (!parsedMessage || typeof parsedMessage !== 'object') {
        return;
      }
      handleWebViewMessage(parsedMessage as WebViewMessage);
    } catch (error) {
      console.error('[CarnivalSync] Failed to parse WebView message:', error, rawData.slice(0, 240));
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'not_logged_in': return '#64748b';
      case 'logged_in': return '#10b981';
      case 'running_step_1':
      case 'running_step_2':
      case 'running_step_3': return CARNIVAL_RED;
      case 'awaiting_confirmation': return CARNIVAL_GOLD;
      case 'syncing': return CARNIVAL_RED;
      case 'complete': return '#22c55e';
      case 'partial': return '#f59e0b';
      case 'cancelled': return '#f59e0b';
      case 'login_expired': return CARNIVAL_GOLD;
      case 'error': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'not_logged_in': return 'Not Logged In';
      case 'logged_in': return 'Logged In - Ready to Sync';
      case 'running_step_1':
        if (state.progress?.stepName) return state.progress.stepName;
        return 'Loading Cruise Deals Page...';
      case 'running_step_2':
        if (state.progress?.stepName) return state.progress.stepName;
        return 'Loading Bookings Page...';
      case 'running_step_3':
        if (state.progress?.stepName) return state.progress.stepName;
        return 'Loading VIFP Loyalty Page...';
      case 'awaiting_confirmation': return 'Ready to Sync';
      case 'syncing': return 'Syncing to App...';
      case 'complete': return 'Complete';
      case 'partial': return 'Partial — Resume Available';
      case 'cancelled': return 'Cancelled — Ready to Resume';
      case 'login_expired': return 'Login Expired';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    const color = '#fff';
    const size = 16;
    switch (state.status) {
      case 'running_step_1':
      case 'running_step_2':
      case 'running_step_3':
      case 'syncing': return <LoaderCircle size={size} color={color} />;
      case 'complete': return <CheckCircle size={size} color={color} />;
      case 'partial': return <AlertCircle size={size} color={color} />;
      case 'cancelled': return <XCircle size={size} color={color} />;
      case 'awaiting_confirmation': return <Clock size={size} color={color} />;
      case 'login_expired':
      case 'error': return <AlertCircle size={size} color={color} />;
      default: return null;
    }
  };

  const handleExportSyncLog = async () => {
    try {
      setIsExportingLog(true);
      console.log('[CarnivalSync] Exporting sync log...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `carnival_sync_log_${timestamp}.txt`;
      
      let logContent = `CARNIVAL CRUISE LINE - SYNC LOG\n`;
      logContent += `Generated: ${new Date().toLocaleString()}\n`;
      logContent += `Status: ${state.status}\n`;
      if (state.lastSyncTimestamp) {
        logContent += `Last Sync: ${new Date(state.lastSyncTimestamp).toLocaleString()}\n`;
      }
      if (state.syncCounts) {
        logContent += `\n--- SYNC SUMMARY ---\n`;
        logContent += `Offers: ${state.syncCounts.offerCount} unique deal(s)\n`;
        logContent += `Sailings: ${state.syncCounts.offerRows} total sailing(s)\n`;
        logContent += `Booked Cruises: ${state.syncCounts.upcomingCruises}\n`;
        logContent += `Courtesy Holds: ${state.syncCounts.courtesyHolds}\n`;
        logContent += `Completed Cruises: ${state.syncCounts.completedCruises}\n`;
      }
      logContent += `\n--- DETAILED LOG ---\n`;
      state.logs.forEach(log => {
        const typeTag = log.type === 'error' ? '[ERROR]' : log.type === 'success' ? '[OK]' : log.type === 'warning' ? '[WARN]' : '[INFO]';
        logContent += `${log.timestamp} ${typeTag} ${log.message}\n`;
      });
      logContent += `\n--- END OF LOG ---\n`;
      
      const success = await exportFile(logContent, fileName);
      if (success) {
        addLog('Sync log exported: ' + fileName, 'success');
      } else {
        addLog('Log saved but sharing may not be available', 'info');
      }
    } catch (error) {
      console.error('[CarnivalSync] Export log error:', error);
      addLog('Failed to export sync log', 'error');
    } finally {
      setIsExportingLog(false);
    }
  };

  const canRunIngestion = state.status === 'logged_in' || state.status === 'complete' || state.status === 'partial' || state.status === 'cancelled';
  const isRunning = state.status.startsWith('running_') || state.status === 'syncing';
  const showConfirmation = state.status === 'awaiting_confirmation';

  const handleRunIngestion = useCallback(() => {
    if (isRunning || !canRunIngestion) {
      return;
    }

    void runIngestion().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Carnival sync could not start';
      console.error('[CarnivalSync] Failed to start ingestion:', error);
      addLog(`Unable to start Carnival sync: ${errorMessage}`, 'error');
    });
  }, [addLog, canRunIngestion, isRunning, runIngestion]);

  const handleOpenImportTools = () => {
    router.push('/settings');
  };

  const handleConfirmCarnivalLogin = useCallback(() => {
    if (isRunning) return;
    addLog('Verifying the active Carnival account before sync...', 'info');
    void confirmCarnivalLogin().then((verified) => {
      if (!verified) {
        addLog('Carnival login could not be verified. Sign in in the browser, then verify again.', 'warning');
      }
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Carnival login verification failed';
      addLog(message, 'error');
    });
  }, [addLog, confirmCarnivalLogin, isRunning]);

  const handleConfirmSync = useCallback(() => {
    if (isConfirmingSync) {
      return;
    }

    setIsConfirmingSync(true);
    void syncToApp(coreData, loyalty)
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Carnival sync failed';
        console.error('[CarnivalSync] Sync-to-app error:', error);
        addLog(`Unable to finish Carnival sync: ${errorMessage}`, 'error');
      })
      .finally(() => {
        setIsConfirmingSync(false);
      });
  }, [addLog, coreData, isConfirmingSync, loyalty, syncToApp]);

  if (isAuthLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Carnival Cruises Sync', headerStyle: { backgroundColor: CARNIVAL_DARK }, headerTintColor: '#fff' }} />
        <View style={styles.adminGateContainer}>
          <ActivityIndicator size="large" color={CARNIVAL_RED} />
          <Text style={styles.adminGateSubtitle}>Checking administrator access…</Text>
        </View>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Carnival Cruises Sync', headerStyle: { backgroundColor: CARNIVAL_DARK }, headerTintColor: '#fff' }} />
        <View style={styles.adminGateContainer}>
          <View style={styles.adminGateCard}>
            <View style={styles.adminGateIcon}>
              <Anchor size={30} color={CARNIVAL_RED} />
            </View>
            <Text style={styles.adminGateTitle}>Administrator access required</Text>
            <Text style={styles.adminGateSubtitle}>Carnival synchronization is currently available only to Easy Seas administrators. No Carnival browser or sync process has been started.</Text>
            <Pressable style={styles.adminGateButton} onPress={() => router.replace('/settings' as any)}>
              <Text style={styles.adminGateButtonText}>Back to Settings</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Carnival Cruises Sync',
          headerStyle: { backgroundColor: CARNIVAL_DARK },
          headerTintColor: '#fff',
        }}
      />

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.contentColumn, Platform.OS === 'web' && styles.contentColumnWeb]}>
            <View style={styles.brandBanner}>
            <View style={styles.brandIconWrap}>
              <Ship size={28} color={CARNIVAL_RED} />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>Carnival Cruise Line</Text>
              <Text style={styles.brandSubtitle}>Sync cruise deals, bookings & VIFP loyalty</Text>
            </View>
          </View>

          <View style={[styles.pillRow, isCompactWindow && styles.pillRowCompact]}>
            <View style={[styles.pill, { backgroundColor: `${CARNIVAL_RED}20`, borderColor: `${CARNIVAL_RED}40` }]}>
              <Star size={12} color={CARNIVAL_RED} />
              <Text style={[styles.pillText, { color: CARNIVAL_RED }]}>VIFP Club</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: `${CARNIVAL_GOLD}20`, borderColor: `${CARNIVAL_GOLD}40` }]}>
              <Award size={12} color={CARNIVAL_GOLD} />
              <Text style={[styles.pillText, { color: CARNIVAL_GOLD }]}>Players Club</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: '#10b98120', borderColor: '#10b98140' }]}>
              <Anchor size={12} color="#10b981" />
              <Text style={[styles.pillText, { color: '#10b981' }]}>Cruise Deals</Text>
            </View>
          </View>

          <View style={styles.logsContainerTop}>
            <View style={[styles.logsHeaderRow, isCompactWindow && styles.logsHeaderRowCompact]}>
              <Text style={styles.logsTitle}>Sync Log</Text>
              <View style={[styles.statusBadge, isCompactWindow && styles.statusBadgeCompact, { backgroundColor: getStatusColor() }]}>

                {getStatusIcon()}
                <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
              </View>
            </View>
            <View style={styles.logsScrollTop}>
              {state.logs.slice(-3).map((log, index) => (
                <View key={`${log.timestamp}-${index}`} style={[styles.logEntry, log.type === 'error' && styles.logError]}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={[
                    styles.logMessage,
                    log.type === 'error' && styles.logMessageError,
                    log.type === 'success' && styles.logMessageSuccess,
                  ]}>
                    {log.message}
                  </Text>
                </View>
              ))}
              {state.logs.length === 0 && (
                <Text style={styles.logsEmpty}>No sync activity yet</Text>
              )}
            </View>
          </View>

          <Pressable
            style={styles.webViewToggle}
            onPress={() => setWebViewVisible(!webViewVisible)}
          >
            <Text style={styles.webViewToggleText}>
              {webViewVisible ? 'Hide' : 'Show'} Browser
            </Text>
            {webViewVisible
              ? <ChevronUp size={16} color="#64748b" />
              : <ChevronDown size={16} color="#64748b" />
            }
          </Pressable>

          {webViewVisible && (
            <View style={[styles.webViewContainer, { height: browserPanelHeight }, isCompactWindow && styles.webViewContainerCompact]}>
              {Platform.OS === 'web' ? (
                <View style={[styles.webWorkspace, isCompactWindow && styles.webWorkspaceCompact]} testID="carnival-web-workspace">
                  <View style={styles.webWorkspaceHero}>
                    <View style={styles.webWorkspaceBadge}>
                      <AlertCircle size={14} color={CARNIVAL_GOLD} />
                      <Text style={styles.webWorkspaceBadgeText}>Legacy Carnival extension sync is disabled</Text>
                    </View>
                    <Text style={styles.webWorkspaceTitle}>Use the authenticated mobile browser for live Carnival sync</Text>
                    <Text style={styles.webWorkspaceText}>
                      The older desktop Carnival scraper was intentionally retired because it could produce results that differed from the protected native sync engine. Existing Carnival CSV exports can still be imported from Settings.
                    </Text>
                  </View>

                  <View style={[styles.webWorkspaceButtonRow, isCompactWindow && styles.webWorkspaceButtonRowCompact]}>
                    <Pressable
                      style={styles.webSecondaryButton}
                      onPress={() => Linking.openURL(webViewUrl || 'https://www.carnival.com/')}
                      testID="carnival-open-website-button"
                    >
                      <ExternalLink size={18} color="#e2e8f0" />
                      <Text style={styles.webSecondaryButtonText}>Open Carnival</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={[styles.webSecondaryButton, styles.webImportButton]}
                    onPress={handleOpenImportTools}
                    testID="carnival-open-import-tools-button"
                  >
                    <FileText size={18} color="#e2e8f0" />
                    <Text style={styles.webSecondaryButtonText}>Open Import Tools</Text>
                  </Pressable>

                  <Text style={styles.webWorkspaceFootnote}>
                    Live Carnival extraction is available in the Easy Seas iOS and Android authenticated browser. Desktop users may import existing CSV exports from Settings.
                  </Text>
                </View>
              ) : (
                <WebView
                  ref={(ref) => {
                    if (ref) {
                      webViewRef.current = ref;
                    }
                  }}
                  source={{ uri: webViewUrl || 'https://www.carnival.com/profilemanagement/profiles/cruises' }}
                  style={styles.webView}
                  onMessage={onMessage}
                  onLoadStart={onPageLoadStarted}
                  onLoadEnd={(e) => {
                    onPageLoaded(e);
                    const url = e.nativeEvent.url || '';
                    console.log('[CarnivalSync] Page loaded, URL:', url);
                    // Authentication is determined only by the hardened shared detector.
                    // A public Carnival page without a password form is not proof of login.
                  }}
                  onNavigationStateChange={(navState) => {
                    console.log('[CarnivalSync] Navigation state change, URL:', navState.url || '');
                  }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  sharedCookiesEnabled={true}
                  thirdPartyCookiesEnabled={true}
                  injectedJavaScriptBeforeContentLoaded={AUTH_DETECTION_SCRIPT}
                  keyboardDisplayRequiresUserAction={false}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  allowsLinkPreview={false}
                  bounces={false}
                  scrollEnabled={true}
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('[CarnivalSync] WebView error:', nativeEvent);
                    addLog(`⚠️ Browser error: ${nativeEvent.description || 'Unknown error'}`, 'warning');
                  }}
                  onHttpError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('[CarnivalSync] WebView HTTP error:', nativeEvent);
                    addLog(`⚠️ Browser HTTP ${String(nativeEvent.statusCode || 'error')} while loading Carnival`, 'warning');
                  }}
                  onContentProcessDidTerminate={() => {
                    console.error('[CarnivalSync] WebView content process terminated');
                    if (isRunning) {
                      addLog('⚠️ Carnival browser process restarted during sync. The sync was stopped safely; existing Carnival data was not changed.', 'warning');
                      cancelSync('iOS WebView content process terminated');
                      setWebViewVisible(false);
                      setTimeout(() => setWebViewVisible(true), 800);
                    } else {
                      addLog('⚠️ Carnival browser process restarted - reloading the current page', 'warning');
                      webViewRef.current?.reload();
                    }
                  }}
                  onRenderProcessGone={() => {
                    console.error('[CarnivalSync] Android WebView render process exited');
                    addLog('⚠️ Carnival browser render process exited. Existing data was preserved and the browser will restart.', 'warning');
                    if (isRunning) cancelSync('Android WebView render process exited');
                    setWebViewVisible(false);
                    setTimeout(() => setWebViewVisible(true), 800);
                  }}
                />
              )}
            </View>
          )}

          <View style={styles.actionsContainer}>
            {Platform.OS === 'web' ? (
              <View style={styles.webCredentialsContainer}>
                <View style={styles.webCredentialsHeader}>
                  <View style={styles.webCredentialsIcon}>
                    <Ship size={28} color={CARNIVAL_RED} />
                  </View>
                  <Text style={styles.webCredentialsTitle}>Carnival Web Sync</Text>
                  <Text style={styles.webCredentialsSubtitle}>
                    Carnival works a little differently on web. Use the browser-assisted flow below instead of the old mobile-only blocker.
                  </Text>
                </View>

                {(webSyncError || cookieSyncError) && (
                  <View style={styles.webInlineError}>
                    <AlertCircle size={16} color="#fca5a5" />
                    <Text style={styles.webInlineErrorText}>{webSyncError || cookieSyncError}</Text>
                  </View>
                )}

                <View style={styles.webSyncOptionsContainer}>
                  <View style={[styles.webSyncOptionCard, isCompactWindow && styles.webSyncOptionCardCompact]}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: `${CARNIVAL_GOLD}20` }]}>
                      <AlertCircle size={24} color={CARNIVAL_GOLD} />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Desktop Scraper Retired</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        The legacy Carnival extension is disabled until it can share the exact protected parser, request-correlation, checkpoint, and manifest engine used by the native app.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.webSyncOptionCard, isCompactWindow && styles.webSyncOptionCardCompact]}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: '#10b98120' }]}>
                      <ExternalLink size={24} color="#10b981" />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Open Carnival in a New Tab</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        Open Carnival, sign in, and keep that tab ready for the browser-assisted sync flow before importing the resulting CSV files here.
                      </Text>
                      <Pressable
                        style={[styles.webSyncButton, { marginTop: 12, backgroundColor: '#0f766e' }]}
                        onPress={() => Linking.openURL('https://www.carnival.com/')}
                        testID="carnival-open-website-card-button"
                      >
                        <ExternalLink size={18} color="#fff" />
                        <Text style={styles.webSyncButtonText}>Open Carnival Website</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.webSyncOptionCard, isCompactWindow && styles.webSyncOptionCardCompact]}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: '#0f766e20' }]}> 
                      <FileText size={24} color="#0f766e" />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Import Downloaded CSV Files</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        Import previously downloaded Carnival offers.csv and booked.csv files without overwriting Royal Caribbean or Celebrity data.
                      </Text>
                      <Pressable
                        style={[styles.webSyncButton, { marginTop: 12, backgroundColor: '#0f766e' }]}
                        onPress={handleOpenImportTools}
                        testID="carnival-import-tools-card-button"
                      >
                        <FileText size={18} color="#fff" />
                        <Text style={styles.webSyncButtonText}>Open Import Tools</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.webSyncOptionCard, isCompactWindow && styles.webSyncOptionCardCompact]}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: '#8b5cf620' }]}>
                      <Cookie size={24} color="#8b5cf6" />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Advanced Cookie Tools</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        If cookie sync is enabled for this deployment later, you can paste a valid Carnival session here without changing the mobile flow.
                      </Text>
                      <Pressable
                        style={[styles.webSyncButton, { marginTop: 12, backgroundColor: '#8b5cf6' }]}
                        onPress={() => setShowCookieModal(true)}
                        testID="carnival-cookie-sync-button"
                      >
                        <Cookie size={18} color="#fff" />
                        <Text style={styles.webSyncButtonText}>Open Cookie Tools</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.mobileActionsContainer}>
                {state.status === 'not_logged_in' && (
                  <View style={styles.loginHintBox}>
                    <Text style={styles.loginHintTitle}>How to sync Carnival:</Text>
                    <Text style={styles.loginHintStep}>1. Press LOGIN below to open Carnival in the browser above</Text>
                    <Text style={styles.loginHintStep}>2. Sign in to your Carnival account</Text>
                    <Text style={styles.loginHintStep}>{"3. Once logged in, press \"VERIFY LOGIN\""}</Text>
                    <Text style={styles.loginHintStep}>4. Press SYNC NOW to start syncing your data</Text>
                  </View>
                )}

                <View style={styles.quickActionsGrid}>
                  <Pressable
                    style={styles.quickActionButton}
                    onPress={openLogin}
                  >
                    <ExternalLink size={20} color={CARNIVAL_GOLD} />
                    <Text style={styles.quickActionLabel}>LOGIN</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.quickActionButton, (!canRunIngestion || isRunning) && styles.buttonDisabled]}
                    onPress={handleRunIngestion}
                    disabled={!canRunIngestion || isRunning}
                    testID="carnival-run-ingestion-button"
                  >
                    <RefreshCcw size={20} color="#34d399" />
                    <Text style={styles.quickActionLabel}>SYNC NOW</Text>
                  </Pressable>

                  <Pressable
                    style={styles.quickActionButton}
                    onPress={() => {
                      void Linking.openURL('https://www.carnival.com/profilemanagement/profiles/cruises');
                    }}
                  >
                    <FileDown size={20} color={CARNIVAL_RED} />
                    <Text style={styles.quickActionLabel}>BOOKINGS</Text>
                  </Pressable>
                </View>

                {!isRunning && state.status !== 'complete' && (
                  <Pressable
                    style={styles.forceLoginButton}
                    onPress={state.status === 'cancelled' || state.status === 'partial' ? handleRunIngestion : handleConfirmCarnivalLogin}
                    testID="carnival-verify-login-button"
                  >
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.forceLoginButtonText}>
                      {state.status === 'cancelled' || state.status === 'partial'
                        ? 'Resume Carnival Sync'
                        : state.status === 'logged_in'
                          ? '✓ Carnival Login Verified'
                          : 'VERIFY CARNIVAL LOGIN'}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {state.error ? (
            <View style={styles.errorContainer}>
              <XCircle size={20} color="#ef4444" />
              <Text style={styles.errorText}>{state.error}</Text>
            </View>
          ) : null}

          <Modal
            visible={showConfirmation}
            transparent={true}
            animationType="fade"
            onRequestClose={cancelSync}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.confirmationModal}>
                <View style={styles.confirmationHeader}>
                  <View style={styles.confirmationIconWrap}>
                    <Ship size={32} color={CARNIVAL_RED} />
                  </View>
                  <Text style={styles.confirmationTitle}>Data Ready to Sync</Text>
                  <Text style={styles.confirmationSubtitle}>Carnival Cruise Line data captured</Text>
                </View>

                <ScrollView
                  style={styles.confirmationScroll}
                  contentContainerStyle={styles.confirmationContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.countCard}>
                    <View style={[styles.countIconContainer, { backgroundColor: `${CARNIVAL_RED}20` }]}>
                      <Star size={24} color={CARNIVAL_RED} />
                    </View>
                    <View style={styles.countInfo}>
                      <Text style={styles.countNumber}>
                        {state.syncCounts?.offerRows || 0} sailings
                      </Text>
                      <Text style={styles.countLabel}>Carnival Cruise Deals</Text>
                      {state.syncCounts && state.syncCounts.offerRows > 0 && (
                        <Text style={styles.countDetail}>
                          {state.syncCounts.offerCount} unique deal{state.syncCounts.offerCount !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.countCard}>
                    <View style={[styles.countIconContainer, { backgroundColor: '#10b98120' }]}>
                      <Calendar size={24} color="#10b981" />
                    </View>
                    <View style={styles.countInfo}>
                      <Text style={styles.countNumber}>{state.syncCounts?.upcomingCruises || 0}</Text>
                      <Text style={styles.countLabel}>Booked Cruises</Text>
                      <Text style={styles.countDetail}>Will be added to Booked tab</Text>
                    </View>
                  </View>


                  <View style={styles.countCard}>
                    <View style={[styles.countIconContainer, { backgroundColor: '#3b82f620' }]}>
                      <Ship size={24} color="#3b82f6" />
                    </View>
                    <View style={styles.countInfo}>
                      <Text style={styles.countNumber}>{state.syncCounts?.completedCruises || 0}</Text>
                      <Text style={styles.countLabel}>Completed Cruises</Text>
                      <Text style={styles.countDetail}>Will be added to Carnival cruise history</Text>
                    </View>
                  </View>

                  {(state.syncCounts?.courtesyHolds ?? 0) > 0 && (
                    <View style={styles.countCard}>
                      <View style={[styles.countIconContainer, { backgroundColor: `${CARNIVAL_GOLD}20` }]}>
                        <Clock size={24} color={CARNIVAL_GOLD} />
                      </View>
                      <View style={styles.countInfo}>
                        <Text style={styles.countNumber}>{state.syncCounts?.courtesyHolds || 0}</Text>
                        <Text style={styles.countLabel}>Holds</Text>
                        <Text style={styles.countDetail}>Added as booked (marked as hold)</Text>
                      </View>
                    </View>
                  )}

                  {(state.loyaltyData || extendedLoyaltyData) && (
                    <View style={styles.loyaltyCard}>
                      <Text style={styles.loyaltyTitle}>Loyalty Status</Text>

                      {state.loyaltyData?.carnivalVifpTier && (
                        <View style={styles.loyaltySection}>
                          <View style={styles.loyaltySectionHeader}>
                            <Star size={16} color={CARNIVAL_RED} />
                            <Text style={styles.loyaltySectionTitle}>VIFP Club</Text>
                          </View>
                          <View style={styles.loyaltyRow}>
                            <Text style={styles.loyaltyLabel}>Tier:</Text>
                            <LoyaltyPill
                              label={state.loyaltyData?.carnivalVifpTier || 'N/A'}
                              color={getCarnivalVifpTierColor(state.loyaltyData?.carnivalVifpTier)}
                              size="small"
                            />
                          </View>
                          {state.loyaltyData?.carnivalVifpNumber ? (
                            <View style={styles.loyaltyRow}>
                              <Text style={styles.loyaltyLabel}>VIFP #:</Text>
                              <Text style={styles.loyaltyValue}>{state.loyaltyData.carnivalVifpNumber}</Text>
                            </View>
                          ) : null}
                          {state.loyaltyData?.carnivalVifpPoints ? (
                            <View style={styles.loyaltyRow}>
                              <Text style={styles.loyaltyLabel}>VIFP Points:</Text>
                              <Text style={styles.loyaltyValue}>{state.loyaltyData.carnivalVifpPoints}</Text>
                            </View>
                          ) : null}
                          {state.loyaltyData?.carnivalTotalCruises ? (
                            <View style={styles.loyaltyRow}>
                              <Text style={styles.loyaltyLabel}>Total Cruises:</Text>
                              <Text style={styles.loyaltyValue}>{state.loyaltyData.carnivalTotalCruises}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {state.loyaltyData?.carnivalPlayersClubTier && (
                        <View style={styles.loyaltySection}>
                          <View style={styles.loyaltySectionHeader}>
                            <Award size={16} color={CARNIVAL_GOLD} />
                            <Text style={styles.loyaltySectionTitle}>Players Club</Text>
                          </View>
                          <View style={styles.loyaltyRow}>
                            <Text style={styles.loyaltyLabel}>Tier:</Text>
                            <LoyaltyPill
                              label={state.loyaltyData.carnivalPlayersClubTier || 'N/A'}
                              color={getCarnivalPlayersClubTierColor(state.loyaltyData.carnivalPlayersClubTier)}
                              size="small"
                            />
                          </View>
                          {state.loyaltyData?.carnivalPlayersClubPoints ? (
                            <View style={styles.loyaltyRow}>
                              <Text style={styles.loyaltyLabel}>Points:</Text>
                              <Text style={styles.loyaltyValue}>{state.loyaltyData.carnivalPlayersClubPoints}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  )}

                  {(state.carnivalCodeLedger?.length ?? 0) > 0 && (
                    <View style={styles.loyaltyCard}>
                      <Text style={styles.loyaltyTitle}>Per-Code Result Ledger</Text>
                      {(state.carnivalCodeLedger ?? []).map((entry) => (
                        <View key={entry.code} style={styles.loyaltyRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.loyaltyLabel}>{entry.code}</Text>
                            {entry.message ? <Text style={styles.countDetail}>{entry.message}</Text> : null}
                          </View>
                          <Text style={[styles.loyaltyValue, { textTransform: 'capitalize' }]}>
                            {entry.status.replace(/_/g, ' ')}{entry.rowCount ? ` · ${entry.rowCount}` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.warningBox}>
                    <AlertCircle size={16} color={CARNIVAL_GOLD} />
                    <Text style={styles.warningText}>
                      Sync will update existing data. If conflicts exist, synced data wins.
                    </Text>
                  </View>
                </ScrollView>

                <Text style={styles.confirmationQuestion}>Sync this Carnival data to the app?</Text>

                <View style={styles.confirmationButtons}>
                  <Pressable style={[styles.button, styles.cancelButton]} onPress={cancelSync}>
                    <Text style={styles.cancelButtonText}>No</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.confirmButton, isConfirmingSync && styles.buttonDisabled]}
                    onPress={handleConfirmSync}
                    disabled={isConfirmingSync}
                    testID="carnival-confirm-sync-button"
                  >
                    <Text style={styles.buttonText}>{isConfirmingSync ? 'Syncing…' : 'Yes, Sync Now'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {(state.status === 'complete' || state.status === 'partial') && state.lastSyncTimestamp && (
            <View style={styles.successContainer}>
              {state.status === 'partial' ? <AlertCircle size={24} color="#f59e0b" /> : <CheckCircle size={24} color="#10b981" />}
              <View style={styles.successContent}>
                <Text style={styles.successTitle}>{state.status === 'partial' ? 'Partial Sync Saved' : 'Sync Complete!'}</Text>
                <Text style={styles.successMessage}>
                  {state.syncCounts
                    ? `${state.status === 'partial' ? 'Saved' : 'Synced'} ${state.syncCounts.offerCount} deal${state.syncCounts.offerCount !== 1 ? 's' : ''} with ${state.syncCounts.offerRows} unique sailing${state.syncCounts.offerRows !== 1 ? 's' : ''} and ${state.syncCounts.upcomingCruises} booked cruise${state.syncCounts.upcomingCruises !== 1 ? 's' : ''}.${state.status === 'partial' ? ' One or more offer codes remain resumable.' : ''}`
                    : 'Carnival data synced successfully.'
                  }
                </Text>
                <Pressable
                  style={styles.exportLogButton}
                  onPress={handleExportSyncLog}
                  disabled={isExportingLog}
                >
                  <FileDown size={14} color="#10b981" />
                  <Text style={styles.exportLogButtonText}>
                    {isExportingLog ? 'Exporting...' : 'Export Sync Log'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {state.logs.length > 0 && state.status !== 'complete' && state.status !== 'partial' && (
            <Pressable
              style={styles.exportLogFloatingButton}
              onPress={handleExportSyncLog}
              disabled={isExportingLog}
            >
              <FileDown size={16} color="#94a3b8" />
              <Text style={styles.exportLogFloatingText}>
                {isExportingLog ? 'Exporting...' : 'Export Current Log'}
              </Text>
            </Pressable>
          )}
          </View>

          <WebSyncCredentialsModal
            visible={showCredentialsModal}
            onClose={() => { setShowCredentialsModal(false); setWebSyncError(null); }}
            onSubmit={handleWebSync}
            cruiseLine="carnival"
            isLoading={webLoginMutation.isPending}
            error={webSyncError}
          />

          <WebCookieSyncModal
            visible={showCookieModal}
            onClose={() => { setShowCookieModal(false); setCookieSyncError(null); }}
            onSubmit={handleCookieSync}
            cruiseLine="carnival"
            isLoading={cookieSyncMutation.isPending}
            error={cookieSyncError}
          />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARNIVAL_DARK,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center' as const,
  },
  contentColumnWeb: {
    maxWidth: 980,
  },
  brandBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    margin: 12,
    padding: 16,
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${CARNIVAL_RED}50`,
  },
  brandIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${CARNIVAL_RED}20`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  pillRow: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    flexWrap: 'wrap' as const,
  },
  pillRowCompact: {
    gap: 6,
  },
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  logsContainerTop: {
    margin: 12,
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  logsHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: CARNIVAL_BORDER,
    gap: 10,
  },
  logsHeaderRowCompact: {
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const,
  },
  logsScrollTop: {
    maxHeight: 60,
    padding: 12,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  statusBadgeCompact: {
    alignSelf: 'flex-start' as const,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  logsTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  logEntry: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: CARNIVAL_BORDER,
  },
  logError: {
    backgroundColor: '#7f1d1d22',
  },
  logTimestamp: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 2,
  },
  logMessage: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  logMessageError: {
    color: '#f87171',
  },
  logMessageSuccess: {
    color: '#4ade80',
  },
  logsEmpty: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center' as const,
    paddingVertical: 12,
    fontStyle: 'italic' as const,
  },
  webViewToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARNIVAL_CARD,
  },
  webViewToggleText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  webViewContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  webViewContainerCompact: {
    marginHorizontal: 12,
  },
  webView: {
    flex: 1,
  },
  webNotSupported: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
    gap: 12,
  },
  webNotSupportedTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  webNotSupportedText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  webWorkspace: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-start' as const,
    gap: 14,
    backgroundColor: '#101a27',
  },
  webWorkspaceCompact: {
    padding: 16,
  },
  webWorkspaceHero: {
    gap: 10,
  },
  webWorkspaceBadge: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${CARNIVAL_RED}18`,
    borderWidth: 1,
    borderColor: `${CARNIVAL_RED}35`,
  },
  webWorkspaceBadgeText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  webWorkspaceTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800' as const,
    lineHeight: 24,
  },
  webWorkspaceText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 640,
  },
  webWorkspaceButtonRow: {
    flexDirection: 'row' as const,
    gap: 10,
    flexWrap: 'wrap' as const,
    width: '100%',
  },
  webWorkspaceButtonRowCompact: {
    flexDirection: 'column' as const,
  },
  webWorkspaceFootnote: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  webImportButton: {
    marginTop: 12,
  },
  webOpenButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: CARNIVAL_RED,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 48,
    flexGrow: 1,
    minWidth: 220,
  },
  webSecondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 48,
    backgroundColor: '#182334',
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
    flexGrow: 1,
    minWidth: 220,
  },
  webOpenButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  webSecondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionsContainer: {
    padding: 12,
  },
  webInlineError: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: '#7f1d1d40',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  webInlineErrorText: {
    flex: 1,
    color: '#fecaca',
    fontSize: 12,
    lineHeight: 17,
  },
  quickActionsGrid: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    height: 80,
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  quickActionLabel: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    color: '#fecaca',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  confirmationModal: {
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    padding: 24,
    borderWidth: 1,
    borderColor: `${CARNIVAL_RED}50`,
  },
  confirmationHeader: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  confirmationIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${CARNIVAL_RED}20`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
  },
  confirmationTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  confirmationSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
  },
  confirmationScroll: {
    maxHeight: 460,
  },
  confirmationContent: {
    gap: 12,
    paddingBottom: 8,
  },
  countCard: {
    backgroundColor: CARNIVAL_DARK,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  countIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  countInfo: {
    flex: 1,
  },
  countNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  countLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  countDetail: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  loyaltyCard: {
    backgroundColor: CARNIVAL_DARK,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  loyaltyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  loyaltySection: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: CARNIVAL_BORDER,
  },
  loyaltySectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginBottom: 7,
  },
  loyaltySectionTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  loyaltyRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  loyaltyLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  loyaltyValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  warningBox: {
    backgroundColor: '#78350f',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: CARNIVAL_GOLD,
  },
  warningText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 16,
  },
  confirmationQuestion: {
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center' as const,
    marginVertical: 18,
    fontWeight: '500' as const,
  },
  confirmationButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  cancelButton: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  confirmButton: {
    backgroundColor: CARNIVAL_RED,
    flex: 1.5,
  },
  successContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    margin: 12,
    padding: 14,
    backgroundColor: '#064e3b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  successMessage: {
    color: '#6ee7b7',
    fontSize: 13,
    lineHeight: 18,
  },
  exportLogButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignSelf: 'flex-start' as const,
  },
  exportLogButtonText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  exportLogFloatingButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    margin: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  exportLogFloatingText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  mobileActionsContainer: {
    gap: 12,
  },
  loginHintBox: {
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${CARNIVAL_GOLD}40`,
    gap: 6,
  },
  loginHintTitle: {
    color: CARNIVAL_GOLD,
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  loginHintStep: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  forceLoginButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  forceLoginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  webCredentialsContainer: {
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  webCredentialsHeader: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  webCredentialsIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: `${CARNIVAL_RED}20`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
  },
  webCredentialsTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700' as const,
    marginBottom: 5,
    textAlign: 'center' as const,
  },
  webCredentialsSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  webSyncOptionsContainer: {
    gap: 14,
  },
  webSyncOptionCard: {
    backgroundColor: CARNIVAL_DARK,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row' as const,
    gap: 12,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
  },
  webSyncOptionCardCompact: {
    flexDirection: 'column' as const,
  },
  webSyncOptionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  webSyncOptionContent: {
    flex: 1,
  },
  webSyncOptionTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  webSyncOptionDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  webSyncButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  webSyncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  adminGateContainer: {
    flex: 1,
    backgroundColor: CARNIVAL_DARK,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 24,
  },
  adminGateCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: CARNIVAL_CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARNIVAL_BORDER,
    padding: 24,
    alignItems: 'center' as const,
  },
  adminGateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${CARNIVAL_RED}20`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  adminGateTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  adminGateSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center' as const,
    marginTop: 10,
  },
  adminGateButton: {
    marginTop: 22,
    minWidth: 190,
    backgroundColor: CARNIVAL_RED,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  adminGateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});

export default function CarnivalSyncScreenWrapper() {
  return (
    <ErrorBoundary>
      <CarnivalSyncProvider>
        <CarnivalSyncScreen />
      </CarnivalSyncProvider>
    </ErrorBoundary>
  );
}
