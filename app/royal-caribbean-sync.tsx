import { View, Text, StyleSheet, Pressable, Modal, Switch, Platform, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useState, useEffect } from 'react';
import { RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync } from '@/state/RoyalCaribbeanSyncProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { ChevronDown, ChevronUp, Loader2, CheckCircle, AlertCircle, XCircle, Ship, Calendar, Clock, ExternalLink, RefreshCcw, Download, Anchor, LogIn } from 'lucide-react-native';
import { WebViewMessage } from '@/lib/royalCaribbean/types';
import { AUTH_DETECTION_SCRIPT } from '@/lib/royalCaribbean/authDetection';
import { useCoreData } from '@/state/CoreDataProvider';
import { WebSyncCredentialsModal } from '@/components/WebSyncCredentialsModal';
import { trpc } from '@/lib/trpc';

function RoyalCaribbeanSyncScreen() {
  const router = useRouter();
  const coreData = useCoreData();
  const loyalty = useLoyalty();
  const {
    state,
    webViewRef,
    cruiseLine,
    setCruiseLine,
    config,
    openLogin,
    runIngestion,
    exportLog,
    syncToApp,
    cancelSync,
    handleWebViewMessage,
    addLog
  } = useRoyalCaribbeanSync();
  
  const isCelebrity = cruiseLine === 'celebrity';
  const isRunningOrSyncing = state.status.startsWith('running_') || state.status === 'syncing';

  const [webViewVisible, setWebViewVisible] = useState(true);
  
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [webSyncError, setWebSyncError] = useState<string | null>(null);
  const [browserLoginWindow, setBrowserLoginWindow] = useState<Window | null>(null);
  const [showBrowserLoginInstructions, setShowBrowserLoginInstructions] = useState(false);
  
  const webLoginMutation = trpc.royalCaribbeanSync.webLogin.useMutation();
  
  const isBackendAvailable = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL && 
    !process.env.EXPO_PUBLIC_RORK_API_BASE_URL.includes('fallback');
  
  const handleBrowserLogin = () => {
    const loginUrl = isCelebrity 
      ? 'https://www.celebritycruises.com/account/sign-in'
      : 'https://www.royalcaribbean.com/account/sign-in';
    
    const width = 500;
    const height = 700;
    const left = (window.innerWidth - width) / 2 + window.screenX;
    const top = (window.innerHeight - height) / 2 + window.screenY;
    
    const popup = window.open(
      loginUrl,
      'RCLogin',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    if (popup) {
      setBrowserLoginWindow(popup);
      setShowBrowserLoginInstructions(true);
      addLog('Browser login window opened - complete login there', 'info');
      
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setBrowserLoginWindow(null);
          addLog('Browser login window closed', 'info');
        }
      }, 500);
    } else {
      addLog('Could not open popup - check popup blocker settings', 'warning');
    }
  };
  
  const closeBrowserLoginInstructions = () => {
    setShowBrowserLoginInstructions(false);
    if (browserLoginWindow && !browserLoginWindow.closed) {
      browserLoginWindow.close();
    }
    setBrowserLoginWindow(null);
  };
  
  const handleWebSync = async (username: string, password: string) => {
    console.log('[WebSync] Starting web-based sync...');
    console.log('[WebSync] Backend URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
    setWebSyncError(null);
    
    if (!isBackendAvailable) {
      const noBackendMsg = 'This deployment does not have a backend server. Please use the Easy Seas™ Browser Extension to sync your data:\n\n1. Download the extension below\n2. Open the Royal Caribbean website\n3. Use the extension to scrape your data';
      setWebSyncError(noBackendMsg);
      addLog('Backend not available - use browser extension', 'warning');
      return;
    }
    
    addLog('Starting web-based sync...', 'info');
    
    try {
      const result = await webLoginMutation.mutateAsync({
        username,
        password,
        cruiseLine,
      });
      
      console.log('[WebSync] Result received:', result);
      
      if (!result.success) {
        console.log('[WebSync] Sync not available:', result.error);
        const errorMsg = result.error || 'Web sync is not available';
        setWebSyncError(errorMsg);
        addLog('Web sync is not available - use mobile app or browser extension', 'warning');
        return;
      }
      
      addLog(`Web sync authenticated successfully`, 'success');
      addLog(`Retrieved ${result.offers.length} offers and ${result.bookedCruises.length} cruises`, 'info');
      
      if (result.offers.length === 0 && result.bookedCruises.length === 0) {
        setWebSyncError('Authentication succeeded but no data was retrieved. Please try the mobile app or browser extension instead.');
        addLog('No data retrieved from web sync', 'warning');
        return;
      }
      
      setShowCredentialsModal(false);
      addLog('Web sync completed! Data ready for review.', 'success');
      
    } catch (error) {
      console.error('[WebSync] Error:', error);
      let errorMessage = 'Unable to connect to sync service';
      if (error instanceof Error) {
        if (error.message.includes('transform') || error.message.includes('JSON')) {
          errorMessage = 'Server returned an invalid response. Please try again or use the browser extension.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('Unable to connect') || error.message.includes('NetworkError') || error.message.includes('CORS')) {
          errorMessage = 'Cannot connect to the sync server.\n\nThis is a static web deployment without backend support. Please use the Easy Seas™ Browser Extension instead:\n\n1. Click "Download Chrome Extension" below\n2. Install the extension in Chrome\n3. Visit the Royal Caribbean website and use the extension to sync';
        } else if (error.message.includes('Backend is not available')) {
          errorMessage = 'Backend server is not configured for this deployment. Please use the browser extension to sync your data.';
        } else {
          errorMessage = error.message;
        }
      }
      setWebSyncError(errorMessage);
      addLog(`Web sync error: ${errorMessage}`, 'error');
    }
  };

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
        if (state.progress && state.progress.stepName) {
          return state.progress.stepName;
        }
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

  const canRunIngestion = state.status === 'logged_in' || state.status === 'complete';
  const isRunning = state.status.startsWith('running_') || state.status === 'syncing';
  const showConfirmation = state.status === 'awaiting_confirmation';

  useEffect(() => {
    console.log('[RoyalCaribbeanSync Screen] Status changed:', state.status);
    console.log('[RoyalCaribbeanSync Screen] showConfirmation:', showConfirmation);
    console.log('[RoyalCaribbeanSync Screen] syncCounts:', state.syncCounts);
  }, [state.status, showConfirmation, state.syncCounts]);

  return (
    <>
      <Stack.Screen 
        options={{
          title: isCelebrity ? 'Celebrity Cruises Sync' : 'Royal Caribbean Sync',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff'
        }}
      />
      
      <View style={styles.container}>
        <View style={styles.cruiseLineToggleContainer}>
          <View style={styles.cruiseLineOption}>
            <Anchor size={18} color={!isCelebrity ? '#60a5fa' : '#64748b'} />
            <Text style={[styles.cruiseLineLabel, !isCelebrity && styles.cruiseLineLabelActive]}>
              Royal Caribbean
            </Text>
          </View>
          <Switch
            value={isCelebrity}
            onValueChange={(value) => {
              if (!isRunningOrSyncing) {
                setCruiseLine(value ? 'celebrity' : 'royal_caribbean');
              }
            }}
            disabled={isRunningOrSyncing}
            trackColor={{ false: '#1e40af', true: '#065f46' }}
            thumbColor={isCelebrity ? '#10b981' : '#3b82f6'}
          />
          <View style={styles.cruiseLineOption}>
            <Ship size={18} color={isCelebrity ? '#10b981' : '#64748b'} />
            <Text style={[styles.cruiseLineLabel, isCelebrity && styles.cruiseLineLabelCelebrity]}>
              Celebrity
            </Text>
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
            {state.logs.slice(-3).map((log, index) => (
              <View key={`${log.timestamp}-${index}`} style={[styles.logEntry, log.type === 'error' && styles.logError]}>
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
          {webViewVisible ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </Pressable>

        {webViewVisible && (
          <View style={styles.webViewContainer}>
            {Platform.OS === 'web' ? (
              <View style={styles.webNotSupported}>
                <Ship size={48} color="#60a5fa" />
                <Text style={styles.webNotSupportedTitle}>Web Browser Detected</Text>
                <Text style={styles.webNotSupportedText}>
                  For web sync, please use the Easy Seas™ Browser Extension.
                  The extension allows you to scrape data directly from Royal Caribbean&apos;s website.
                </Text>
                <Pressable
                  style={styles.webOpenButton}
                  onPress={() => {
                    const url = isCelebrity 
                      ? 'https://www.celebritycruises.com/blue-chip-club/offers'
                      : 'https://www.royalcaribbean.com/club-royale/offers';
                    Linking.openURL(url);
                  }}
                >
                  <ExternalLink size={18} color="#fff" />
                  <Text style={styles.webOpenButtonText}>
                    Open {isCelebrity ? 'Celebrity' : 'Royal Caribbean'} Website
                  </Text>
                </Pressable>
                <Text style={styles.webExtensionNote}>
                  Make sure the Easy Seas™ extension is installed in your browser.
                  After scraping, export the CSV and import it in the app.
                </Text>
              </View>
            ) : (
              <WebView
                ref={(ref) => {
                  if (ref) {
                    webViewRef.current = ref;
                  }
                }}
                source={{ uri: config.loginUrl }}
                style={styles.webView}
                onMessage={onMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                injectedJavaScriptBeforeContentLoaded={AUTH_DETECTION_SCRIPT}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView error:', nativeEvent);
                }}
              />
            )}
          </View>
        )}

<View style={styles.actionsContainer}>
          {Platform.OS === 'web' ? (
            showBrowserLoginInstructions ? (
              <View style={styles.webActionsContainer}>
                <Text style={styles.webActionsTitle}>Browser Login Active</Text>
                
                <View style={styles.browserLoginActiveCard}>
                  <View style={styles.browserLoginActiveHeader}>
                    <View style={styles.browserLoginPulse} />
                    <Text style={styles.browserLoginActiveTitle}>Login Window Open</Text>
                  </View>
                  <Text style={styles.browserLoginActiveDesc}>
                    Complete your login in the popup window. Once logged in, use the browser extension to scrape your data.
                  </Text>
                  
                  <View style={styles.browserLoginSteps}>
                    <Text style={styles.browserLoginStep}>1. Log in to {isCelebrity ? 'Celebrity Cruises' : 'Royal Caribbean'} in the popup</Text>
                    <Text style={styles.browserLoginStep}>2. Navigate to the offers page after login</Text>
                    <Text style={styles.browserLoginStep}>3. Use the Easy Seas™ extension to scrape</Text>
                    <Text style={styles.browserLoginStep}>4. Export and import the CSV</Text>
                  </View>
                  
                  <View style={styles.browserLoginActions}>
                    <Pressable
                      style={styles.browserLoginOpenOffers}
                      onPress={() => {
                        const url = isCelebrity 
                          ? 'https://www.celebritycruises.com/blue-chip-club/offers'
                          : 'https://www.royalcaribbean.com/club-royale/offers';
                        if (browserLoginWindow && !browserLoginWindow.closed) {
                          browserLoginWindow.location.href = url;
                          browserLoginWindow.focus();
                        } else {
                          Linking.openURL(url);
                        }
                      }}
                    >
                      <Ship size={18} color="#fff" />
                      <Text style={styles.browserLoginOpenOffersText}>Go to Offers Page</Text>
                    </Pressable>
                    
                    <Pressable
                      style={styles.browserLoginClose}
                      onPress={closeBrowserLoginInstructions}
                    >
                      <Text style={styles.browserLoginCloseText}>Done / Close</Text>
                    </Pressable>
                  </View>
                </View>
                
                <Pressable
                  style={styles.webBackButton}
                  onPress={() => {
                    closeBrowserLoginInstructions();
                    router.back();
                  }}
                >
                  <Text style={styles.webBackButtonText}>← Back</Text>
                </Pressable>
              </View>
            ) : (
            <View style={styles.webActionsContainer}>
              <Text style={styles.webActionsTitle}>Web Sync Options</Text>
              
              <View style={styles.webSyncOption}>
                <View style={styles.webSyncOptionHeader}>
                  <ExternalLink size={20} color="#10b981" />
                  <Text style={styles.webSyncOptionTitle}>Option 1: Browser Login</Text>
                </View>
                <Text style={styles.webSyncOptionDesc}>
                  Open {isCelebrity ? 'Celebrity Cruises' : 'Royal Caribbean'} in a popup to log in with your browser, then use the extension to scrape.
                </Text>
                <Pressable
                  style={styles.webBrowserLoginButton}
                  onPress={handleBrowserLogin}
                >
                  <ExternalLink size={18} color="#fff" />
                  <Text style={styles.webBrowserLoginButtonText}>Open Login Window</Text>
                </Pressable>
              </View>
              
              <View style={styles.webSyncDivider}>
                <View style={styles.webSyncDividerLine} />
                <Text style={styles.webSyncDividerText}>OR</Text>
                <View style={styles.webSyncDividerLine} />
              </View>
              
              <View style={styles.webSyncOption}>
                <View style={styles.webSyncOptionHeader}>
                  <LogIn size={20} color="#3b82f6" />
                  <Text style={styles.webSyncOptionTitle}>Option 2: Direct Credentials</Text>
                </View>
                <Text style={styles.webSyncOptionDesc}>
                  Enter your credentials and we&apos;ll attempt to sync automatically (requires backend).
                </Text>
                <Pressable
                  style={[styles.webPrimaryButton, webLoginMutation.isPending && styles.buttonDisabled]}
                  onPress={() => {
                    setWebSyncError(null);
                    setShowCredentialsModal(true);
                  }}
                  disabled={webLoginMutation.isPending}
                >
                  {webLoginMutation.isPending ? (
                    <Loader2 size={18} color="#fff" />
                  ) : (
                    <LogIn size={18} color="#fff" />
                  )}
                  <Text style={styles.webPrimaryButtonText}>
                    {webLoginMutation.isPending ? 'Syncing...' : 'Sign In & Sync'}
                  </Text>
                </Pressable>
              </View>
              
              <View style={styles.webSyncDivider}>
                <View style={styles.webSyncDividerLine} />
                <Text style={styles.webSyncDividerText}>OR</Text>
                <View style={styles.webSyncDividerLine} />
              </View>
              
              <View style={styles.webSyncOption}>
                <View style={styles.webSyncOptionHeader}>
                  <Download size={20} color="#64748b" />
                  <Text style={styles.webSyncOptionTitle}>Option 3: Extension Only</Text>
                </View>
                <Text style={styles.webSyncOptionDesc}>
                  Already logged in? Just use the browser extension directly.
                </Text>
                <Pressable
                  style={styles.webSecondaryButton}
                  onPress={() => {
                    const url = isCelebrity 
                      ? 'https://www.celebritycruises.com/blue-chip-club/offers'
                      : 'https://www.royalcaribbean.com/club-royale/offers';
                    Linking.openURL(url);
                  }}
                >
                  <ExternalLink size={18} color="#cbd5e1" />
                  <Text style={styles.webSecondaryButtonText}>Open Offers Page</Text>
                </Pressable>
              </View>
              
              <Pressable
                style={styles.webBackButton}
                onPress={() => router.back()}
              >
                <Text style={styles.webBackButtonText}>← Back</Text>
              </Pressable>
            </View>
            )
          ) : (
            <View style={styles.quickActionsGrid}>
              <Pressable 
                style={styles.quickActionButton}
                onPress={openLogin}
              >
                <ExternalLink size={20} color="#60a5fa" />
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
                onPress={exportLog}
              >
                <Download size={20} color="#94a3b8" />
                <Text style={styles.quickActionLabel}>EXPORT LOG</Text>
              </Pressable>
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
                    <Text style={styles.countLabel}>{config.loyaltyClubName} Offers</Text>
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
                        <Text style={styles.loyaltyLabel}>Club Royale Tier:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.clubRoyaleTier}</Text>
                      </View>
                    )}
                    {state.loyaltyData.clubRoyalePoints !== undefined && (
                      <View style={styles.loyaltyRow}>
                        <Text style={styles.loyaltyLabel}>Club Royale Points:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.clubRoyalePoints.toLocaleString()}</Text>
                      </View>
                    )}
                    {state.loyaltyData.crownAndAnchorLevel && (
                      <View style={styles.loyaltyRow}>
                        <Text style={styles.loyaltyLabel}>Crown & Anchor Level:</Text>
                        <Text style={styles.loyaltyValue}>{state.loyaltyData.crownAndAnchorLevel}</Text>
                      </View>
                    )}
                    <Text style={styles.loyaltyNote}>Crown & Anchor points are not modified</Text>
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
                  `Successfully synced ${state.syncCounts.offerCount} offer${state.syncCounts.offerCount !== 1 ? 's' : ''} with ${state.syncCounts.offerRows} sailing${state.syncCounts.offerRows !== 1 ? 's' : ''}, ${state.syncCounts.upcomingCruises} upcoming cruise${state.syncCounts.upcomingCruises !== 1 ? 's' : ''}, and ${state.syncCounts.courtesyHolds} courtesy hold${state.syncCounts.courtesyHolds !== 1 ? 's' : ''} to your app.`
                )}
              </Text>
            </View>
          </View>
        )}
        
        <WebSyncCredentialsModal
          visible={showCredentialsModal}
          onClose={() => {
            setShowCredentialsModal(false);
            setWebSyncError(null);
          }}
          onSubmit={handleWebSync}
          cruiseLine={cruiseLine}
          isLoading={webLoginMutation.isPending}
          error={webSyncError}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const
  },
  logsContainerTop: {
    margin: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: '#334155'
  },
  logsHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  logsScrollTop: {
    maxHeight: 200,
    padding: 12
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
  webNotSupported: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
    gap: 12
  },
  webNotSupportedTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center' as const
  },
  webNotSupportedText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20
  },
  webOpenButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16
  },
  webOpenButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  webExtensionNote: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 16,
    lineHeight: 18
  },
  webActionsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  webActionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center' as const
  },
  webInstructionsList: {
    gap: 8,
    marginBottom: 16
  },
  webInstruction: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18
  },
  webPrimaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  webPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const
  },
  webSecondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569'
  },
  webSecondaryButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500' as const
  },
  webSyncOption: {
    gap: 12
  },
  webSyncOptionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10
  },
  webSyncOptionTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600' as const
  },
  webSyncOptionDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18
  },
  webSyncDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginVertical: 16
  },
  webSyncDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155'
  },
  webSyncDividerText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500' as const
  },
  actionsContainer: {
    padding: 12
  },
  quickActionsGrid: {
    flexDirection: 'row' as const,
    gap: 12
  },
  quickActionButton: {
    flex: 1,
    height: 80,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  quickActionLabel: {
    color: '#e2e8f0',
    fontSize: 12,
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
  logsTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700' as const
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
    fontSize: 12,
    textAlign: 'center' as const,
    paddingVertical: 16,
    fontStyle: 'italic' as const
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
  loyaltyNote: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic' as const
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
  },
  settingsContainer: {
    margin: 12,
    marginTop: 0,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  settingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12
  },
  settingTextContainer: {
    flex: 1
  },
  settingLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4
  },
  settingDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16
  },
  cruiseLineToggleContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cruiseLineOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flex: 1
  },
  cruiseLineLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500' as const
  },
  cruiseLineLabelActive: {
    color: '#60a5fa',
    fontWeight: '600' as const
  },
  cruiseLineLabelCelebrity: {
    color: '#10b981',
    fontWeight: '600' as const
  },
  webBackButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  webBackButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500' as const
  },
  webBrowserLoginButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  webBrowserLoginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const
  },
  browserLoginActiveCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    gap: 16
  },
  browserLoginActiveHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10
  },
  browserLoginPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981'
  },
  browserLoginActiveTitle: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600' as const
  },
  browserLoginActiveDesc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20
  },
  browserLoginSteps: {
    gap: 8
  },
  browserLoginStep: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18
  },
  browserLoginActions: {
    gap: 10
  },
  browserLoginOpenOffers: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  browserLoginOpenOffersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  browserLoginClose: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center' as const
  },
  browserLoginCloseText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500' as const
  }
});

export default function RoyalCaribbeanSyncScreenWrapper() {
  return (
    <RoyalCaribbeanSyncProvider>
      <RoyalCaribbeanSyncScreen />
    </RoyalCaribbeanSyncProvider>
  );
}
