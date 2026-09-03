import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, View, Text, ActivityIndicator, Platform, useWindowDimensions, Pressable } from "react-native";
import { CoreDataProvider, useCoreData } from "@/state/CoreDataProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FinancialsProvider } from "@/state/FinancialsProvider";
import { CasinoStrategyProvider } from "@/state/CasinoStrategyProvider";
import { SimpleAnalyticsProvider } from "@/state/SimpleAnalyticsProvider";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { LoginScreen } from "@/components/LoginScreen";
import { LandingPage } from "@/components/LandingPage";
import { UserProvider, useUser } from "@/state/UserProvider";
import { AuthProvider, useAuth } from "@/state/AuthProvider";
import { CelebrityProvider } from "@/state/CelebrityProvider";
import { LoyaltyProvider } from "@/state/LoyaltyProvider";
import { AlertsProvider } from "@/state/AlertsProvider";
import { AgentXProvider } from "@/state/AgentXProvider";
import { CertificatesProvider } from "@/state/CertificatesProvider";
import { HistoricalPerformanceProvider } from "@/state/HistoricalPerformanceProvider";
import { PriceHistoryProvider } from "@/state/PriceHistoryProvider";
import { PriceTrackingProvider } from "@/state/PriceTrackingProvider";
import { CasinoSessionProvider } from "@/state/CasinoSessionProvider";
import { GamificationProvider } from "@/state/GamificationProvider";
import { PPHAlertsProvider } from "@/state/PPHAlertsProvider";
import { BankrollProvider } from "@/state/BankrollProvider";
import { TaxProvider } from "@/state/TaxProvider";
import { MachineStrategyProvider } from "@/state/MachineStrategyProvider";
import { SlotMachineProvider } from "@/state/SlotMachineProvider";
import { SlotMachineLibraryProvider, useSlotMachineLibrary } from "@/state/SlotMachineLibraryProvider";
import { MachineConditionLogProvider } from "@/state/MachineConditionLogProvider";
import { DeckPlanProvider } from "@/state/DeckPlanProvider";
import { UserDataSyncProvider, useUserDataSync } from "@/state/UserDataSyncProvider";
import { EntitlementProvider } from "@/state/EntitlementProvider";
import { CrewRecognitionProvider } from "@/state/CrewRecognitionProvider";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { composeProviders } from "@/lib/composeProviders";
import { ensureStorageHealthy } from "@/lib/storage/storageRecovery";
import { recoverIncompleteSyncTransaction } from "@/lib/storage/syncTransaction";
import { SailingWeatherProvider } from "@/state/SailingWeatherProvider";
import { IntelligenceFiltersProvider } from "@/state/IntelligenceFiltersProvider";
import { AskAllOffersProvider } from "@/state/AskAllOffersProvider";
import { CasinoBenefitsProvider } from "@/state/CasinoBenefitsProvider";
import { CasinoSettingsProvider } from "@/state/CasinoSettingsProvider";
import { PersonalCertificateOptimizerProvider } from "@/state/PersonalCertificateOptimizerProvider";
import { PersonalOptimizationAlertsProvider } from "@/state/PersonalOptimizationAlertsProvider";
import { VoyageNotificationObserver } from "@/components/VoyageNotificationObserver";
import { DataTrustObserver } from "@/components/DataTrustObserver";
import { ExperienceProvider, useExperience } from "@/state/ExperienceProvider";
import { useFonts } from "expo-font";

try {
  void SplashScreen.preventAutoHideAsync();
} catch {
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});

const rootStyles = StyleSheet.create({
  gestureHandler: {
    flex: 1,
  },
  storageBootstrapContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  storageBootstrapCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    backgroundColor: "#F7FAFF",
    borderWidth: 1,
    borderColor: "#E6EEF9",
    padding: SPACING.xl,
  },
  storageBootstrapTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: COLORS.navy,
    marginBottom: 8,
  },
  storageBootstrapSubtitle: {
    fontSize: 14,
    color: "#2A3B55",
    marginTop: 12,
  },
  storageBootstrapError: {
    fontSize: 13,
    color: "#B00020",
    marginTop: 12,
  },
  storageRetryButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  storageRetryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  storageWarningBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 54,
    zIndex: 9999,
    borderRadius: 10,
    backgroundColor: '#FFF5D6',
    borderWidth: 1,
    borderColor: '#E2B93B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storageWarningText: {
    color: '#5A4300',
    fontSize: 12,
    flex: 1,
    marginRight: 12,
  },
  storageWarningDismiss: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  cloudRestoreContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  cloudRestoreCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    backgroundColor: "#F7FAFF",
    borderWidth: 1,
    borderColor: "#E6EEF9",
    padding: SPACING.xl,
  },
  cloudRestoreTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: COLORS.navy,
    marginBottom: 6,
  },
  cloudRestoreSubtitle: {
    fontSize: 14,
    color: "#2A3B55",
    marginBottom: 14,
  },
  cloudRestoreHint: {
    fontSize: 13,
    color: "#4C6588",
  },
  cloudRestoreError: {
    marginTop: 10,
    fontSize: 12,
    color: "#B00020",
  },
});

const freshStartStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  text: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  subtext: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

function FreshStartHandler({ onComplete }: { onComplete: () => void }) {
  const { clearFreshStartFlag } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('Setting up your profile...');

  useEffect(() => {
    let finished = false;
    const finish = (reason: 'complete' | 'timeout' | 'error') => {
      if (finished) return;
      finished = true;
      console.log('[FreshStartHandler] Releasing startup:', reason);
      void clearFreshStartFlag().catch((error) => {
        console.warn('[FreshStartHandler] Could not clear fresh-start flag; navigation is still being released:', error);
      });
      try {
        router.replace('/(tabs)/settings' as any);
      } catch (error) {
        console.warn('[FreshStartHandler] Settings redirect failed; opening the app anyway:', error);
      }
      onComplete();
    };

    const failOpenTimer = setTimeout(() => {
      setStatus('Opening EasySeas...');
      console.warn('[FreshStartHandler] Local setup exceeded 2500ms; releasing navigation without waiting.');
      finish('timeout');
    }, 2500);

    const handleFirstLaunch = async () => {
      try {
        const hasLaunchedBefore = await AsyncStorage.getItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE);

        if (!hasLaunchedBefore) {
          if (__DEV__) console.log('[FreshStartHandler] First time user');
          setStatus('Setting up your profile...');
          // Missing launch metadata must never erase recognized local data.
          await AsyncStorage.setItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE, 'true');
        } else {
          setStatus('Loading your profile...');
        }

        finish('complete');
      } catch (error) {
        console.error('[FreshStartHandler] Error:', error);
        setStatus('Opening EasySeas...');
        finish('error');
      }
    };

    void handleFirstLaunch();
    return () => clearTimeout(failOpenTimer);
  }, [clearFreshStartFlag, router, onComplete]);

  return (
    <View style={freshStartStyles.container}>
      <ActivityIndicator size="large" color={COLORS.navy} />
      <Text style={freshStartStyles.text}>{status}</Text>
      <Text style={freshStartStyles.subtext}>Preparing saved data on this device</Text>
    </View>
  );
}

const SCREEN_ANIMATION: 'default' | 'fade_from_bottom' = Platform.OS === 'ios' ? 'default' : 'fade_from_bottom';

const WEB_MAX_WIDTH = 430;
const WEB_BREAKPOINT = 600;

function WebResponsiveWrapper({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const isWide = width > WEB_BREAKPOINT;

  if (!isWide) {
    return <>{children}</>;
  }

  return (
    <View style={webStyles.outerContainer}>
      <View style={webStyles.background}>
        <View style={webStyles.bgPattern} />
        <View style={webStyles.bgAccent} />
      </View>
      <View style={[webStyles.phoneFrame, { maxHeight: height - 40 }]}> 
        <View style={webStyles.phoneNotch} />
        <View style={webStyles.phoneContent}>
          {children}
        </View>
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const { preferences, colors } = useExperience();
  const screenOptions = useMemo(() => ({
    headerShown: false,
    headerBackTitle: "Back",
    contentStyle: { backgroundColor: colors.background },
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    animation: preferences.reducedMotion ? 'none' as const : SCREEN_ANIMATION,
    animationDuration: preferences.reducedMotion ? 0 : 200,
  }), [colors.background, colors.surface, colors.text, preferences.reducedMotion]);

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="paywall"
        options={{
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }}
      />
      <Stack.Screen
        name="paywall-monthly"
        options={{
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }}
      />
      <Stack.Screen 
        name="modal" 
        options={{ 
          presentation: "modal",
          title: "Modal",
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="day-agenda" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen
        name="cruise-details"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="offer-details" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="learn-system" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="ask-my-data" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen
        name="ask-all-offers"
        options={{
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }}
      />
      <Stack.Screen 
        name="add-machine-wizard" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="add-machines-to-ship" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="deck-plan" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="global-library" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="machine-detail/[id]" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="edit-machine/[id]" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="pricing-summary" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="import-review" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="command-center" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="war-room" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: preferences.reducedMotion ? 'none' as const : 'slide_from_bottom' as const,
        }} 
      />
      <Stack.Screen 
        name="royal-caribbean-sync" 
        options={{ 
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="carnival-sync" 
        options={{ 
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="seapass-generator" 
        options={{ 
          headerShown: true,
        }} 
      />
    </Stack>
  );
}

function ExperienceRootSurface({ children }: { children: React.ReactNode }) {
  const { colors } = useExperience();
  return <View style={[rootStyles.gestureHandler, { backgroundColor: colors.background }]}>{children}</View>;
}

function LocalDataStartup({ message = 'Opening your saved data…' }: { message?: string }) {
  return (
    <View style={freshStartStyles.container}>
      <ActivityIndicator size="large" color={COLORS.navy} />
      <Text style={freshStartStyles.text}>{message}</Text>
      <Text style={freshStartStyles.subtext}>Loading saved EasySeas data from this device.</Text>
    </View>
  );
}

function SlotMachineWhitelistBridge() {
  const { isWhitelisted } = useAuth();
  const { setIsUserWhitelisted } = useSlotMachineLibrary();

  useEffect(() => {
    setIsUserWhitelisted(isWhitelisted);
  }, [isWhitelisted, setIsUserWhitelisted]);

  return null;
}

function AuthenticatedAppContent() {
  const { isFreshStart, authenticatedEmail } = useAuth();
  const { lastRestoreTime } = useUserDataSync();
  const { refreshData } = useCoreData();
  const { updateUser, ensureOwner, syncFromStorage: syncUserFromStorage } = useUser();
  const [freshStartReleased, setFreshStartReleased] = useState(false);
  const releaseFreshStart = useCallback(() => setFreshStartReleased(true), []);

  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;
  const syncUserRef = useRef(syncUserFromStorage);
  syncUserRef.current = syncUserFromStorage;
  const ensureOwnerRef = useRef(ensureOwner);
  ensureOwnerRef.current = ensureOwner;
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const emailSyncDoneRef = useRef<string | null>(null);
  const lastRestoreHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticatedEmail) {
      emailSyncDoneRef.current = null;
      return;
    }
    if (emailSyncDoneRef.current === authenticatedEmail) return;

    void (async () => {
      try {
        const owner = await ensureOwnerRef.current();
        if (owner && owner.email !== authenticatedEmail) {
          await updateUserRef.current(owner.id, { email: authenticatedEmail });
        }
        emailSyncDoneRef.current = authenticatedEmail;
      } catch (error) {
        console.error('[AppContent] Error syncing local profile email:', error);
      }
    })();
  }, [authenticatedEmail]);

  useEffect(() => {
    if (!lastRestoreTime || lastRestoreHandledRef.current === lastRestoreTime) return;
    lastRestoreHandledRef.current = lastRestoreTime;
    Promise.all([refreshDataRef.current(), syncUserRef.current()]).catch((error) => {
      console.error('[AppContent] Error refreshing after manual cloud restore:', error);
    });
  }, [lastRestoreTime]);

  if (isFreshStart && !freshStartReleased) {
    return <FreshStartHandler onComplete={releaseFreshStart} />;
  }

  return (
    <>
      <VoyageNotificationObserver />
      <RootLayoutNav />
    </>
  );
}

const FeatureDataProviders = composeProviders(
  CrewRecognitionProvider,
  HistoricalPerformanceProvider,
  PriceHistoryProvider,
  PriceTrackingProvider,
  FinancialsProvider,
  LoyaltyProvider,
  SimpleAnalyticsProvider,
  DeckPlanProvider,
  CelebrityProvider,
);

const CasinoProviders = composeProviders(
  CasinoSettingsProvider,
  CasinoStrategyProvider,
  CasinoSessionProvider,
  SlotMachineProvider,
  SlotMachineLibraryProvider,
  MachineConditionLogProvider,
  MachineStrategyProvider,
  BankrollProvider,
  GamificationProvider,
  PPHAlertsProvider,
);

const ServiceProviders = composeProviders(
  TaxProvider,
  AlertsProvider,
  CertificatesProvider,
  CasinoBenefitsProvider,
  PersonalCertificateOptimizerProvider,
  PersonalOptimizationAlertsProvider,
  IntelligenceFiltersProvider,
  AskAllOffersProvider,
  SailingWeatherProvider,
  AgentXProvider,
);

function AuthenticatedFeatureGate() {
  const { isLoading } = useCoreData();
  const startupLoggedRef = useRef(false);

  useEffect(() => {
    if (isLoading && !startupLoggedRef.current) {
      startupLoggedRef.current = true;
      console.log('[Startup] Main navigation rendered immediately; local providers are hydrating in the background.');
      return;
    }

    if (!isLoading && startupLoggedRef.current) {
      console.log('[Startup] Core local-data hydration completed without blocking navigation.');
    }
  }, [isLoading]);

  // Build 336: startup is fail-open. All providers mount around the usable app,
  // but no provider hydration flag is allowed to gate navigation. Feature
  // screens may show their own local loading state while their cache hydrates.
  return (
    <FeatureDataProviders>
      <CasinoProviders>
        <ServiceProviders>
          <SlotMachineWhitelistBridge />
          <DataTrustObserver />
          <AuthenticatedAppContent />
        </ServiceProviders>
      </CasinoProviders>
    </FeatureDataProviders>
  );
}

function AuthenticatedProviderTree() {
  return (
    <UserDataSyncProvider>
      <UserProvider>
        <EntitlementProvider>
          <CoreDataProvider>
            <AuthenticatedFeatureGate />
          </CoreDataProvider>
        </EntitlementProvider>
      </UserProvider>
    </UserDataSyncProvider>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showLandingPage, setShowLandingPage] = useState(true);
  const ignoreSplashCompletion = useCallback(() => {}, []);

  if (isLoading) {
    return <WelcomeSplash onAnimationComplete={ignoreSplashCompletion} duration={1800} />;
  }

  if (!isAuthenticated) {
    return showLandingPage
      ? <LandingPage onContinue={() => setShowLandingPage(false)} />
      : <LoginScreen />;
  }

  return <AuthenticatedProviderTree />;
}

export default function RootLayout() {
  const [storageError, setStorageError] = useState<string | null>(null);
  // Register stable aliases on every platform. Navigation remains fail-open:
  // the system font is used for the first frame if these local assets have not
  // finished loading, then React redraws editorial text in Source Serif.
  useFonts({
    'SourceSerif4-Regular': require('../assets/fonts/source-serif-4/SourceSerif4-Regular.ttf'),
    'SourceSerif4-SemiBold': require('../assets/fonts/source-serif-4/SourceSerif4-Semibold.ttf'),
    'SourceSerif4-Bold': require('../assets/fonts/source-serif-4/SourceSerif4-Bold.ttf'),
  });

  useEffect(() => {
    let mounted = true;
    // The native launch screen must never wait for storage diagnostics. React
    // has already committed the fail-open navigation tree at this point, so
    // reveal it immediately and let recovery continue in the background.
    void SplashScreen.hideAsync().catch(() => undefined);
    void ensureStorageHealthy()
      .then((result) => {
        if (mounted && !result.healthy) setStorageError(result.errorMessage ?? 'Local storage check did not finish.');
      })
      .catch((error) => {
        if (mounted) setStorageError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        // An interrupted sync only needs its small manifest closed. Recovery is
        // intentionally background work and must never hold the splash screen or
        // provider tree hostage during cold start.
        void recoverIncompleteSyncTransaction().catch((error) => {
          console.warn('[Startup] Interrupted sync recovery will be retried later:', error);
        });
      });
    return () => { mounted = false; };
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={rootStyles.gestureHandler}>
          <ErrorBoundary>
            <AuthProvider>
              <ExperienceProvider>
                <ExperienceRootSurface>
                  <WebResponsiveWrapper>
                    <View style={rootStyles.gestureHandler}>
                    <AuthGate />
                {storageError ? (
                  <View style={rootStyles.storageWarningBanner}>
                    <Text style={rootStyles.storageWarningText}>Local storage warning: {storageError}</Text>
                    <Pressable onPress={() => setStorageError(null)} accessibilityRole="button">
                      <Text style={rootStyles.storageWarningDismiss}>Dismiss</Text>
                    </Pressable>
                  </View>
                ) : null}
                    </View>
                  </WebResponsiveWrapper>
                </ExperienceRootSurface>
              </ExperienceProvider>
            </AuthProvider>
          </ErrorBoundary>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const webStyles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F2',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(14, 127, 167, 0.10)',
  },
  bgAccent: {
    position: 'absolute',
    bottom: -150,
    left: -80,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(0, 151, 167, 0.15)',
  },
  phoneFrame: {
    width: WEB_MAX_WIDTH,
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  phoneNotch: {
    width: 120,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginTop: 8,
  },
  phoneContent: {
    flex: 1,
  },
});
