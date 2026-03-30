import { View, Text, StyleSheet, Pressable, Modal, Platform, Linking, ScrollView, useWindowDimensions, ActivityIndicator, Alert } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/state/AuthProvider';
import { WebView } from 'react-native-webview';
import { useCallback, useMemo, useState } from 'react';
import { CarnivalSyncProvider, useRoyalCaribbeanSync } from '@/state/RoyalCaribbeanSyncProvider';
import { exportFile } from '@/lib/importExport';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { ChevronDown, ChevronUp, LoaderCircle, CheckCircle, AlertCircle, XCircle, Ship, Calendar, Clock, ExternalLink, RefreshCcw, Anchor, Star, Award, Cookie, Download, FileDown, FileText } from 'lucide-react-native';
import { LogEntry, WebViewMessage } from '@/lib/royalCaribbean/types';
import { AUTH_DETECTION_SCRIPT } from '@/lib/royalCaribbean/authDetection';
import { useCoreData } from '@/state/CoreDataProvider';
import { WebSyncCredentialsModal } from '@/components/WebSyncCredentialsModal';
import { WebCookieSyncModal } from '@/components/WebCookieSyncModal';
import { trpc, isWebSyncAvailable } from '@/lib/trpc';
import { downloadScraperExtension } from '@/lib/chromeExtension';
const CARNIVAL_RED = '#CC2232';
const CARNIVAL_GOLD = '#FFB400';
const CARNIVAL_DARK = '#0c1520';
const CARNIVAL_CARD = '#1a2535';
const CARNIVAL_BORDER = '#2a3a50';
const MAX_WEBVIEW_MESSAGE_SIZE = 350000;

function CarnivalSyncScreen() {
  const router = useRouter();
  const coreData = useCoreData();
  const loyalty = useLoyalty();
  const {
    state,
    webViewRef,
    cruiseLine: _cruiseLine,
    setCruiseLine: _setCruiseLine,
    config: _config,
    openLogin,
    runIngestion,
    syncToApp,
    cancelSync,
    handleWebViewMessage,
    addLog,
    extendedLoyaltyData,
    webViewUrl,
    onPageLoaded,
  } = useRoyalCaribbeanSync();

  const [webViewVisible, setWebViewVisible] = useState(true);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [webSyncError, setWebSyncError] = useState<string | null>(null);
  const [cookieSyncError, setCookieSyncError] = useState<string | null>(null);
  const [isExportingLog, setIsExportingLog] = useState(false);
  const [isDownloadingExtension, setIsDownloadingExtension] = useState(false);
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

  const handleDownloadExtension = async () => {
    console.log('[CarnivalSync] Starting browser extension download...');
    setWebSyncError(null);
    setCookieSyncError(null);
    setIsDownloadingExtension(true);
    addLog('Preparing Easy Seas browser sync extension...', 'info');

    try {
      const result = await downloadScraperExtension();
      if (!result.success) {
        const errorMessage = result.error || 'Unable to download Easy Seas browser extension';
        setWebSyncError(errorMessage);
        addLog(`Extension download failed: ${errorMessage}`, 'error');
        return;
      }

      addLog(`Extension download started${result.filesAdded ? ` (${result.filesAdded} files)` : ''}`, 'success');
      Alert.alert(
        'Extension Ready',
        '1. Unzip the download and install it in Chrome.\n2. Open Carnival and sign in.\n3. Run the Easy Seas overlay on carnival.com and download offers.csv and booked.csv.\n4. Import those CSV files from Settings in Easy Seas.\n\nCarnival imports now stay separate from Royal Caribbean and Celebrity data.'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to download Easy Seas browser extension';
      setWebSyncError(errorMessage);
      addLog(`Extension download error: ${errorMessage}`, 'error');
    } finally {
      setIsDownloadingExtension(false);
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
      }
      logContent += `\n--- DETAILED LOG ---\n`;
      state.logs.forEach((log: LogEntry) => {
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

  const canRunIngestion = state.status === 'logged_in' || state.status === 'complete';
  const isRunning = state.status.startsWith('running_') || state.status === 'syncing';
  const showConfirmation = state.status === 'awaiting_confirmation';

  const handleRunIngestion = useCallback(() => {
    if (isRunning || !canRunIngestion) {
      return;
    }

    void runIngestion().catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Carnival sync could not start';
      console.error('[CarnivalSync] Failed to start ingestion:', error);
      addLog(`Unable to start Carnival sync: ${errorMessage}`, 'error');
    });
  }, [addLog, canRunIngestion, isRunning, runIngestion]);

  const handleConfirmSync = useCallback(() => {
    if (isConfirmingSync) {
      return;
    }

    setIsConfirmingSync(true);
    void syncToApp(coreData, loyalty)
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Carnival sync failed';
        console.error('[CarnivalSync] Sync-to-app error:', error);
        addLog(`Unable to finish Carnival sync: ${errorMessage}`, 'error');
      })
      .finally(() => {
        setIsConfirmingSync(false);
      });
  }, [addLog, coreData, isConfirmingSync, loyalty, syncToApp]);

  const handleOpenImportTools = () => {
    router.push('/settings');
  };

  const forceMarkLoggedIn = () => {
    console.log('[CarnivalSync] User manually confirmed login');
    addLog('User manually confirmed login', 'success');
    if (Platform.OS !== 'web' && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          window.__easySeasForceLoggedIn = true;
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth_status', loggedIn: true }));
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'Manual login confirmation applied', logType: 'success' }));
          } catch(e) {}
        })();
        true;
      `);
    }
    handleWebViewMessage({ type: 'auth_status', loggedIn: true } as any);
  };

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
              {state.logs.slice(-2).map((log: LogEntry, index: number) => (
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
                      <Ship size={14} color={CARNIVAL_RED} />
                      <Text style={styles.webWorkspaceBadgeText}>Carnival web sync uses a browser-assisted flow</Text>
                    </View>
                    <Text style={styles.webWorkspaceTitle}>Use Carnival on desktop without the old blocker screen</Text>
                    <Text style={styles.webWorkspaceText}>
                      Download the Easy Seas extension, open carnival.com in a new tab, sign in there, run the sync overlay on the website, then import the downloaded offers.csv and booked.csv files into Easy Seas. This is the web-safe Carnival path instead of the embedded mobile browser flow.
                    </Text>
                  </View>

                  <View style={[styles.webWorkspaceButtonRow, isCompactWindow && styles.webWorkspaceButtonRowCompact]}>
                    <Pressable
                      style={[styles.webOpenButton, isDownloadingExtension && styles.buttonDisabled]}
                      onPress={() => { void handleDownloadExtension(); }}
                      disabled={isDownloadingExtension}
                      testID="carnival-download-extension-button"
                    >
                      {isDownloadingExtension ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Download size={18} color="#fff" />
                      )}
                      <Text style={styles.webOpenButtonText}>
                        {isDownloadingExtension ? 'Preparing Extension...' : 'Download Extension'}
                      </Text>
                    </Pressable>

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
                    Best results: use Chrome, keep the Carnival tab signed in, run the overlay after the page fully loads, then import the downloaded CSV files from Settings.
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
                  onLoadEnd={(e) => {
                    onPageLoaded(e);
                    const url = e.nativeEvent.url || '';
                    console.log('[CarnivalSync] Page loaded, URL:', url);
                    if (url.includes('carnival.com') && !url.includes('login') && !url.includes('sign-in') && !url.includes('okta') && !url.includes('auth0') && !url.includes('identitytoolkit')) {
                      console.log('[CarnivalSync] On carnival.com (non-auth page) after load, injecting re-check');
                      if (webViewRef.current) {
                        webViewRef.current.injectJavaScript(`
                          (function() {
                            try {
                              var hasForm = document.querySelector('input[type="password"]') !== null;
                              var isLoggedIn = !hasForm;
                              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth_status', loggedIn: isLoggedIn }));
                              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'Carnival page loaded: ' + (isLoggedIn ? 'logged in (no password form)' : 'not logged in (password form found)'), logType: isLoggedIn ? 'success' : 'info' }));
                            } catch(e) {}
                          })();
                          true;
                        `);
                      }
                    }
                  }}
                  onNavigationStateChange={(navState) => {
                    const url = navState.url || '';
                    console.log('[CarnivalSync] Navigation state change, URL:', url);
                    if (url.includes('carnival.com') && !url.includes('login') && !url.includes('sign-in') && !url.includes('okta') && !url.includes('auth0')) {
                      setTimeout(() => {
                        if (webViewRef.current) {
                          webViewRef.current.injectJavaScript(`
                            (function() {
                              try {
                                var hasForm = document.querySelector('input[type="password"]') !== null;
                                var signOutPresent = document.body ? document.body.innerHTML.toLowerCase().includes('sign out') : false;
                                var isLoggedIn = !hasForm || signOutPresent;
                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth_status', loggedIn: isLoggedIn }));
                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'Nav change on carnival.com: ' + (isLoggedIn ? 'logged in' : 'not yet'), logType: 'info' }));
                              } catch(e) {}
                            })();
                            true;
                          `);
                        }
                      }, 1500);
                    }
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
                    console.error('[CarnivalSync] WebView content process terminated, reloading...');
                    addLog('⚠️ Carnival browser process restarted - reloading page', 'warning');
                    if (webViewRef.current) {
                      webViewRef.current.reload();
                    }
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
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: `${CARNIVAL_RED}20` }]}>
                      <Download size={24} color={CARNIVAL_RED} />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Desktop Browser Sync</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        Download the Easy Seas extension, run Carnival sync directly on carnival.com, then import the downloaded CSV files back into Easy Seas.
                      </Text>
                      <Pressable
                        style={[styles.webSyncButton, { marginTop: 12, backgroundColor: CARNIVAL_RED }, isDownloadingExtension && styles.buttonDisabled]}
                        onPress={() => { void handleDownloadExtension(); }}
                        disabled={isDownloadingExtension}
                        testID="carnival-download-extension-card-button"
                      >
                        {isDownloadingExtension ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Download size={18} color="#fff" />
                        )}
                        <Text style={styles.webSyncButtonText}>
                          {isDownloadingExtension ? 'Preparing Extension...' : 'Download Extension'}
                        </Text>
                      </Pressable>
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
                        Once the extension downloads offers.csv and booked.csv, open Easy Seas Settings and import them here without overwriting your other cruise lines.
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
                    <Text style={styles.loginHintStep}>{"3. Once logged in, press \"I'm Logged In\" to confirm"}</Text>
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
                    onPress={forceMarkLoggedIn}
                  >
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.forceLoginButtonText}>
                      {state.status === 'logged_in' ? '✓ Logged In — Ready to Sync' : "I'm Logged In to Carnival — Start Sync"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
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

                      {(state.loyaltyData?.crownAndAnchorLevel) && (
                        <View style={styles.loyaltySection}>
                          <View style={styles.loyaltySectionHeader}>
                            <Star size={16} color={CARNIVAL_RED} />
                            <Text style={styles.loyaltySectionTitle}>VIFP Club</Text>
                          </View>
                          <View style={styles.loyaltyRow}>
                            <Text style={styles.loyaltyLabel}>Tier:</Text>
                            <Text style={styles.loyaltyValue}>
                              {state.loyaltyData?.crownAndAnchorLevel}
                            </Text>
                          </View>
                          {state.loyaltyData?.crownAndAnchorPoints ? (
                            <View style={styles.loyaltyRow}>
                              <Text style={styles.loyaltyLabel}>VIFP #:</Text>
                              <Text style={styles.loyaltyValue}>
                                {state.loyaltyData.crownAndAnchorPoints}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {(state.loyaltyData?.clubRoyaleTier) && (
                        <View style={styles.loyaltySection}>
                          <View style={styles.loyaltySectionHeader}>
                            <Award size={16} color={CARNIVAL_GOLD} />
                            <Text style={styles.loyaltySectionTitle}>Players Club</Text>
                          </View>
                          <View style={styles.loyaltyRow}>
                            <Text style={styles.loyaltyLabel}>Tier:</Text>
                            <Text style={styles.loyaltyValue}>
                              {state.loyaltyData.clubRoyaleTier}
                            </Text>
                          </View>
                        </View>
                      )}
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

          {state.status === 'complete' && state.lastSyncTimestamp && (
            <View style={styles.successContainer}>
              <CheckCircle size={24} color="#10b981" />
              <View style={styles.successContent}>
                <Text style={styles.successTitle}>Sync Complete!</Text>
                <Text style={styles.successMessage}>
                  {state.syncCounts
                    ? `Synced ${state.syncCounts.offerCount} deal${state.syncCounts.offerCount !== 1 ? 's' : ''} with ${state.syncCounts.offerRows} sailing${state.syncCounts.offerRows !== 1 ? 's' : ''} and ${state.syncCounts.upcomingCruises} booked cruise${state.syncCounts.upcomingCruises !== 1 ? 's' : ''}.`
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

          {state.logs.length > 0 && state.status !== 'complete' && (
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
    paddingHorizontal: 32,
    gap: 16,
  },
  adminGateTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  adminGateText: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  adminGateButton: {
    marginTop: 12,
    backgroundColor: CARNIVAL_RED,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  adminGateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});

export default function CarnivalSyncScreenWrapper() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Carnival Cruises Sync',
            headerStyle: { backgroundColor: CARNIVAL_DARK },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.adminGateContainer}>
          <Ship size={48} color={CARNIVAL_RED} />
          <Text style={styles.adminGateTitle}>Admin Only</Text>
          <Text style={styles.adminGateText}>
            Carnival Cruises sync is restricted to admin users. Please contact your administrator for access.
          </Text>
          <Pressable style={styles.adminGateButton} onPress={() => router.back()}>
            <Text style={styles.adminGateButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <CarnivalSyncProvider>
        <CarnivalSyncScreen />
      </CarnivalSyncProvider>
    </ErrorBoundary>
  );
}
