import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { CoreDataProvider, useCoreData } from "@/state/CoreDataProvider";
import { clearAllAppData } from "@/lib/dataManager";
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
import { DeckPlanProvider } from "@/state/DeckPlanProvider";
import { UserDataSyncProvider, useUserDataSync } from "@/state/UserDataSyncProvider";
import { EntitlementProvider } from "@/state/EntitlementProvider";
import { CrewRecognitionProvider } from "@/state/CrewRecognitionProvider";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";

try {
  SplashScreen.preventAutoHideAsync();
} catch {
  // Safe to ignore - splash screen may not be available in all contexts
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
    fontWeight: "800",
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

function FreshStartHandler({ onComplete }: { onComplete: () => void }) {
  const { clearFreshStartFlag } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('Setting up your profile...');

  useEffect(() => {
    const handleFirstLaunch = async () => {
      try {
        const hasLaunchedBefore = await AsyncStorage.getItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE);
        
        if (!hasLaunchedBefore) {
          console.log('[FreshStartHandler] First time user - clearing all data...');
          setStatus('Setting up your profile...');
          await clearAllAppData();
          await AsyncStorage.setItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE, 'true');
          console.log('[FreshStartHandler] First launch flag set');
        } else {
          console.log('[FreshStartHandler] Returning user - preserving existing data');
          setStatus('Loading your profile...');
        }
        
        console.log('[FreshStartHandler] Clearing fresh start flag...');
        await clearFreshStartFlag();
        
        console.log('[FreshStartHandler] Redirecting to settings...');
        setTimeout(() => {
          router.replace('/(tabs)/settings' as any);
          onComplete();
        }, 500);
      } catch (error) {
        console.error('[FreshStartHandler] Error during fresh start:', error);
        setStatus('Error occurred, redirecting...');
        await clearFreshStartFlag();
        setTimeout(() => {
          router.replace('/(tabs)/settings' as any);
          onComplete();
        }, 1000);
      }
    };
    
    handleFirstLaunch();
  }, [clearFreshStartFlag, router, onComplete]);

  return (
    <View style={freshStartStyles.container}>
      <ActivityIndicator size="large" color={COLORS.navy} />
      <Text style={freshStartStyles.text}>{status}</Text>
      <Text style={freshStartStyles.subtext}>Please enter your profile information</Text>
    </View>
  );
}

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

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="paywall"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="modal" 
        options={{ 
          presentation: "modal",
          title: "Modal"
        }} 
      />
      <Stack.Screen 
        name="day-agenda" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="offer-details" 
        options={{ 
          presentation: "modal",
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="add-machine-wizard" 
        options={{ 
          presentation: "modal",
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="add-machines-to-ship" 
        options={{ 
          presentation: "modal",
          headerShown: false,
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
        }} 
      />
      <Stack.Screen 
        name="pricing-summary" 
        options={{ 
          presentation: "modal",
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="royal-caribbean-sync" 
        options={{ 
          headerShown: true,
        }} 
      />
    </Stack>
  );
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    console.log('[AppContent] === MOUNT ===');
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
        console.log('[AppContent] Native splash hidden');
      } catch {
        // Safe to ignore - splash screen may not be registered
      }
    };
    
    const timer = setTimeout(() => {
      hideSplash();
    }, 100);
    
    const timeout = setTimeout(() => {
      console.log('[AppContent] === TIMEOUT: Forcing splash to hide after 1.8s ===');
      setShowSplash(false);
    }, 1800);
    
    return () => {
      console.log('[AppContent] === UNMOUNT ===');
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, []);

  return <AppContentInner showSplash={showSplash} setShowSplash={setShowSplash} isClearing={isClearing} setIsClearing={setIsClearing} />;
}

function AppContentInner({ showSplash, setShowSplash, isClearing, setIsClearing }: { 
  showSplash: boolean; 
  setShowSplash: (show: boolean) => void;
  isClearing: boolean;
  setIsClearing: (clearing: boolean) => void;
}) {
  const { isAuthenticated, isLoading: authLoading, isFreshStart, authenticatedEmail, isWhitelisted } = useAuth();
  const { initialCheckComplete, isSyncing, syncError, hasCloudData, lastRestoreTime } = useUserDataSync();
  const { setIsUserWhitelisted } = useSlotMachineLibrary();
  const coreData = useCoreData();
  const { updateUser, ensureOwner, syncFromStorage: syncUserFromStorage } = useUser();
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [forceSkipRestore, setForceSkipRestore] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !initialCheckComplete && !forceSkipRestore) {
      const timeout = setTimeout(() => {
        console.log('[AppContent] Cloud restore safety timeout - forcing past restore screen');
        setForceSkipRestore(true);
      }, 8000);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, initialCheckComplete, forceSkipRestore]);

  const handleContinueToLogin = () => {
    console.log('[AppContent] Continue button pressed - moving to login screen');
    setShowLandingPage(false);
  };

  useEffect(() => {
    const syncEmailToProfile = async () => {
      if (isAuthenticated && authenticatedEmail) {
        try {
          const owner = await ensureOwner();
          if (owner && owner.email !== authenticatedEmail) {
            console.log('[AppContent] Syncing authenticated email to user profile:', authenticatedEmail);
            await updateUser(owner.id, { email: authenticatedEmail });
          }
        } catch (error) {
          console.error('[AppContent] Error syncing email to profile:', error);
        }
      }
    };
    syncEmailToProfile();
  }, [isAuthenticated, authenticatedEmail, ensureOwner, updateUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!lastRestoreTime) return;

    console.log('[AppContent] Cloud restore completed - refreshing providers:', { lastRestoreTime, authenticatedEmail });

    Promise.all([
      coreData.refreshData(),
      syncUserFromStorage(),
    ]).catch((error) => {
      console.error('[AppContent] Error refreshing providers after cloud restore:', error);
    });
  }, [isAuthenticated, lastRestoreTime, authenticatedEmail, coreData, syncUserFromStorage]);

  useEffect(() => {
    console.log('[AppContent] Syncing whitelist status to machine library:', isWhitelisted);
    setIsUserWhitelisted(isWhitelisted);
  }, [isWhitelisted, setIsUserWhitelisted]);

  const handleSplashComplete = () => {
    console.log('[AppContent] === SPLASH COMPLETE: Setting showSplash to false ===');
    setShowSplash(false);
  };

  console.log('[AppContent] Render - showSplash:', showSplash, 'isAuthenticated:', isAuthenticated, 'authLoading:', authLoading, 'isFreshStart:', isFreshStart, 'isClearing:', isClearing, 'initialCheckComplete:', initialCheckComplete, 'isSyncing:', isSyncing, 'hasCloudData:', hasCloudData, 'syncError:', syncError);

  if (authLoading) {
    return (
      <WelcomeSplash 
        onAnimationComplete={() => {}}
        duration={3000}
      />
    );
  }

  if (!isAuthenticated) {
    if (showLandingPage) {
      console.log('[AppContent] Rendering LandingPage');
      return <LandingPage onContinue={handleContinueToLogin} />;
    }
    console.log('[AppContent] Rendering LoginScreen');
    return <LoginScreen />;
  }

  if (showSplash) {
    return (
      <WelcomeSplash 
        onAnimationComplete={handleSplashComplete}
        duration={1500}
      />
    );
  }

  if (isAuthenticated && !initialCheckComplete && !forceSkipRestore) {
    return (
      <View style={rootStyles.cloudRestoreContainer} testID="cloudRestoreScreen">
        <View style={rootStyles.cloudRestoreCard}>
          <Text style={rootStyles.cloudRestoreTitle} testID="cloudRestoreTitle">Restoring your data</Text>
          <Text style={rootStyles.cloudRestoreSubtitle} testID="cloudRestoreSubtitle">
            Signing in as {authenticatedEmail ?? 'your account'}
          </Text>
          <Text style={rootStyles.cloudRestoreHint} testID="cloudRestoreHint">
            {isSyncing ? 'Checking cloud backup…' : 'Preparing your workspace…'}
          </Text>
          {!!syncError && (
            <Text style={rootStyles.cloudRestoreError} testID="cloudRestoreError">
              {syncError}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (isFreshStart && !isClearing) {
    return <FreshStartHandler onComplete={() => setIsClearing(false)} />;
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={rootStyles.gestureHandler}>
        <ErrorBoundary>
          <AuthProvider>
            <UserDataSyncProvider>
              <UserProvider>
                <EntitlementProvider>
                  <CoreDataProvider>
                    <CrewRecognitionProvider>
                <HistoricalPerformanceProvider>
                  <PriceHistoryProvider>
                    <PriceTrackingProvider>
                      <FinancialsProvider>
                      <CasinoStrategyProvider>
                        <LoyaltyProvider>
                          <SimpleAnalyticsProvider>
                            <CasinoSessionProvider>
                              <SlotMachineProvider>
                                <SlotMachineLibraryProvider>
                                  <DeckPlanProvider>
                                    <MachineStrategyProvider>
                                      <BankrollProvider>
                                        <TaxProvider>
                                          <GamificationProvider>
                                            <PPHAlertsProvider>
                                              <AlertsProvider>
                                                <AgentXProvider>
                                                  <CertificatesProvider>
                                                    <CelebrityProvider>
                                                      <AppContent />
                                                    </CelebrityProvider>
                                                  </CertificatesProvider>
                                                </AgentXProvider>
                                              </AlertsProvider>
                                            </PPHAlertsProvider>
                                          </GamificationProvider>
                                        </TaxProvider>
                                      </BankrollProvider>
                                    </MachineStrategyProvider>
                                  </DeckPlanProvider>
                                </SlotMachineLibraryProvider>
                              </SlotMachineProvider>
                            </CasinoSessionProvider>
                          </SimpleAnalyticsProvider>
                        </LoyaltyProvider>
                      </CasinoStrategyProvider>
                      </FinancialsProvider>
                    </PriceTrackingProvider>
                  </PriceHistoryProvider>
                </HistoricalPerformanceProvider>
                    </CrewRecognitionProvider>
                  </CoreDataProvider>
                </EntitlementProvider>
              </UserProvider>
            </UserDataSyncProvider>
          </AuthProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
