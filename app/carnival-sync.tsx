import { View, Text, StyleSheet, Pressable, Modal, Switch, Platform, Linking, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useState, useEffect } from 'react';
import { CarnivalSyncProvider, useRoyalCaribbeanSync } from '@/state/RoyalCaribbeanSyncProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { ChevronDown, ChevronUp, Loader2, CheckCircle, AlertCircle, XCircle, Ship, Calendar, Clock, ExternalLink, RefreshCcw, Anchor, Star, Award, Cookie, Download, FileDown } from 'lucide-react-native';
import { WebViewMessage } from '@/lib/royalCaribbean/types';
import { AUTH_DETECTION_SCRIPT } from '@/lib/royalCaribbean/authDetection';
import { useCoreData } from '@/state/CoreDataProvider';
import { WebSyncCredentialsModal } from '@/components/WebSyncCredentialsModal';
import { WebCookieSyncModal } from '@/components/WebCookieSyncModal';
import { trpc, isWebSyncAvailable, RENDER_BACKEND_URL } from '@/lib/trpc';
import { useEntitlement } from '@/state/EntitlementProvider';

const CARNIVAL_RED = '#CC2232';
const CARNIVAL_GOLD = '#FFB400';
const CARNIVAL_DARK = '#0c1520';
const CARNIVAL_CARD = '#1a2535';
const CARNIVAL_BORDER = '#2a3a50';

function CarnivalSyncScreen() {
  const router = useRouter();
  const coreData = useCoreData();
  const loyalty = useLoyalty();
  const entitlement = useEntitlement();

  const {
    state,
    webViewRef,
    cruiseLine,
    setCruiseLine,
    config,
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

  const webLoginMutation = trpc.royalCaribbeanSync.webLogin.useMutation();
  const cookieSyncMutation = trpc.royalCaribbeanSync.cookieSync.useMutation();

  const isBackendAvailable = isWebSyncAvailable();

  useEffect(() => {
    if (entitlement.tier === 'view') {
      router.replace('/paywall' as any);
    }
  }, [entitlement.tier, router]);

  if (entitlement.tier === 'view') return null;

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
      setWebSyncError('Backend not available. Use the in-app browser to log in to Carnival directly.');
      addLog('Backend not available - use mobile browser', 'warning');
      return;
    }

    addLog('Starting web-based sync...', 'info');

    try {
      const result = await webLoginMutation.mutateAsync({ username, password, cruiseLine: 'carnival' });
      if (!result.success) {
        setWebSyncError(result.error || 'Web sync is not available');
        addLog('Web sync not available - use mobile browser', 'warning');
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
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
      handleWebViewMessage(message);
    } catch (error) {
      console.error('[CarnivalSync] Failed to parse WebView message:', error);
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
      case 'syncing': return <Loader2 size={size} color={color} />;
      case 'complete': return <CheckCircle size={size} color={color} />;
      case 'awaiting_confirmation': return <Clock size={size} color={color} />;
      case 'login_expired':
      case 'error': return <AlertCircle size={size} color={color} />;
      default: return null;
    }
  };

  const canRunIngestion = state.status === 'logged_in' || state.status === 'complete';
  const isRunning = state.status.startsWith('running_') || state.status === 'syncing';
  const showConfirmation = state.status === 'awaiting_confirmation';

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
          <View style={styles.brandBanner}>
            <View style={styles.brandIconWrap}>
              <Ship size={28} color={CARNIVAL_RED} />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>Carnival Cruise Line</Text>
              <Text style={styles.brandSubtitle}>Sync cruise deals, bookings & VIFP loyalty</Text>
            </View>
          </View>

          <View style={styles.pillRow}>
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
            <View style={styles.logsHeaderRow}>
              <Text style={styles.logsTitle}>Sync Log</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                {getStatusIcon()}
                <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
              </View>
            </View>
            <View style={styles.logsScrollTop}>
              {state.logs.slice(-2).map((log, index) => (
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
            <View style={styles.webViewContainer}>
              {Platform.OS === 'web' ? (
                <View style={styles.webNotSupported}>
                  <Ship size={48} color={CARNIVAL_RED} />
                  <Text style={styles.webNotSupportedTitle}>Open Carnival Website</Text>
                  <Text style={styles.webNotSupportedText}>
                    Log in to your Carnival account, then return here and press &ldquo;I&apos;m Logged In&rdquo; to start syncing.
                  </Text>
                  <Pressable
                    style={styles.webOpenButton}
                    onPress={() => Linking.openURL(webViewUrl || 'https://www.carnival.com/cruise-deals')}
                  >
                    <ExternalLink size={18} color="#fff" />
                    <Text style={styles.webOpenButtonText}>Open Carnival Website</Text>
                  </Pressable>
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
                    onPageLoaded();
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
                  }}
                  onContentProcessDidTerminate={() => {
                    console.error('[CarnivalSync] WebView content process terminated, reloading...');
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
                  <Text style={styles.webCredentialsTitle}>Sync Options</Text>
                  <Text style={styles.webCredentialsSubtitle}>
                    Carnival doesn&apos;t provide a public API. Use one of these methods:
                  </Text>
                </View>

                <View style={styles.webSyncOptionsContainer}>
                  <View style={styles.webSyncOptionCard}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: '#8b5cf620' }]}>
                      <Cookie size={24} color="#8b5cf6" />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Cookie-Based Sync (Beta)</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        Log in to Carnival, copy your browser cookies, and paste them here to sync.
                      </Text>
                      <Pressable
                        style={[styles.webSyncButton, { marginTop: 12, backgroundColor: '#8b5cf6' }]}
                        onPress={() => setShowCookieModal(true)}
                      >
                        <Cookie size={18} color="#fff" />
                        <Text style={styles.webSyncButtonText}>Sync with Cookies</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.webSyncOptionCard}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: `${CARNIVAL_RED}20` }]}>
                      <Download size={24} color={CARNIVAL_RED} />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Browser Extension</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        Install the Easy Seas™ Chrome Extension to scrape data from carnival.com.
                      </Text>
                      <Pressable
                        style={[styles.webSyncButton, { marginTop: 12, backgroundColor: CARNIVAL_RED }]}
                        onPress={() => Linking.openURL('https://www.carnival.com/cruise-deals')}
                      >
                        <ExternalLink size={18} color="#fff" />
                        <Text style={styles.webSyncButtonText}>Open Carnival Website</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.webSyncOptionCard}>
                    <View style={[styles.webSyncOptionIconContainer, { backgroundColor: '#10b98120' }]}>
                      <ExternalLink size={24} color="#10b981" />
                    </View>
                    <View style={styles.webSyncOptionContent}>
                      <Text style={styles.webSyncOptionTitle}>Mobile App</Text>
                      <Text style={styles.webSyncOptionDesc}>
                        Use the Easy Seas™ mobile app to sync via the in-app browser. Download from the App Store.
                      </Text>
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
                    <Text style={styles.loginHintStep}>3. Once logged in, press "I'm Logged In" to confirm</Text>
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
                    onPress={runIngestion}
                    disabled={!canRunIngestion || isRunning}
                  >
                    <RefreshCcw size={20} color="#34d399" />
                    <Text style={styles.quickActionLabel}>SYNC NOW</Text>
                  </Pressable>

                  <Pressable
                    style={styles.quickActionButton}
                    onPress={() => {
                      Linking.openURL('https://www.carnival.com/profilemanagement/profiles/cruises');
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

                      {(extendedLoyaltyData?.crownAndAnchorTier || state.loyaltyData?.crownAndAnchorLevel) && (
                        <View style={styles.loyaltySection}>
                          <View style={styles.loyaltySectionHeader}>
                            <Star size={16} color={CARNIVAL_RED} />
                            <Text style={styles.loyaltySectionTitle}>VIFP Club</Text>
                          </View>
                          <View style={styles.loyaltyRow}>
                            <Text style={styles.loyaltyLabel}>Level:</Text>
                            <Text style={styles.loyaltyValue}>
                              {extendedLoyaltyData?.crownAndAnchorTier || state.loyaltyData?.crownAndAnchorLevel}
                            </Text>
                          </View>
                        </View>
                      )}

                      {(extendedLoyaltyData?.clubRoyaleTierFromApi || state.loyaltyData?.clubRoyaleTier) && (
                        <View style={styles.loyaltySection}>
                          <View style={styles.loyaltySectionHeader}>
                            <Award size={16} color={CARNIVAL_GOLD} />
                            <Text style={styles.loyaltySectionTitle}>Players Club</Text>
                          </View>
                          <View style={styles.loyaltyRow}>
                            <Text style={styles.loyaltyLabel}>Tier:</Text>
                            <Text style={styles.loyaltyValue}>
                              {extendedLoyaltyData?.clubRoyaleTierFromApi || state.loyaltyData?.clubRoyaleTier}
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
                  {state.syncCounts
                    ? `Synced ${state.syncCounts.offerCount} deal${state.syncCounts.offerCount !== 1 ? 's' : ''} with ${state.syncCounts.offerRows} sailing${state.syncCounts.offerRows !== 1 ? 's' : ''} and ${state.syncCounts.upcomingCruises} booked cruise${state.syncCounts.upcomingCruises !== 1 ? 's' : ''}.`
                    : 'Carnival data synced successfully.'
                  }
                </Text>
              </View>
            </View>
          )}

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
    height: 300,
    borderBottomWidth: 1,
    borderBottomColor: CARNIVAL_CARD,
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
  webOpenButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: CARNIVAL_RED,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  webOpenButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionsContainer: {
    padding: 12,
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
});

export default function CarnivalSyncScreenWrapper() {
  return (
    <CarnivalSyncProvider>
      <CarnivalSyncScreen />
    </CarnivalSyncProvider>
  );
}
