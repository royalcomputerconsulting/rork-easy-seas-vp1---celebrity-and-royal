import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { CoreDataProvider } from "@/state/CoreDataProvider";
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
import { CasinoSessionProvider } from "@/state/CasinoSessionProvider";
import { GamificationProvider } from "@/state/GamificationProvider";
import { PPHAlertsProvider } from "@/state/PPHAlertsProvider";
import { BankrollProvider } from "@/state/BankrollProvider";
import { TaxProvider } from "@/state/TaxProvider";
import { MachineStrategyProvider } from "@/state/MachineStrategyProvider";
import { SlotMachineProvider } from "@/state/SlotMachineProvider";
import { SlotMachineLibraryProvider, useSlotMachineLibrary } from "@/state/SlotMachineLibraryProvider";
import { DeckPlanProvider } from "@/state/DeckPlanProvider";
import { UserDataSyncProvider } from "@/state/UserDataSyncProvider";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";

try {
  SplashScreen.preventAutoHideAsync();
} catch (error) {
  // Safe to ignore - splash screen may not be available in all contexts
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

const rootStyles = StyleSheet.create({
  gestureHandler: {
    flex: 1,
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
      } catch (error) {
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
  const { setIsUserWhitelisted } = useSlotMachineLibrary();
  const { updateUser, ensureOwner } = useUser();
  const [showLandingPage, setShowLandingPage] = useState(true);

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
    console.log('[AppContent] Syncing whitelist status to machine library:', isWhitelisted);
    setIsUserWhitelisted(isWhitelisted);
  }, [isWhitelisted, setIsUserWhitelisted]);

  const handleSplashComplete = () => {
    console.log('[AppContent] === SPLASH COMPLETE: Setting showSplash to false ===');
    setShowSplash(false);
  };

  console.log('[AppContent] Render - showSplash:', showSplash, 'isAuthenticated:', isAuthenticated, 'authLoading:', authLoading, 'isFreshStart:', isFreshStart, 'isClearing:', isClearing);

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
      return <LandingPage onContinue={() => setShowLandingPage(false)} />;
    }
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
                <CoreDataProvider>
                <HistoricalPerformanceProvider>
                  <PriceHistoryProvider>
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
                  </PriceHistoryProvider>
                </HistoricalPerformanceProvider>
              </CoreDataProvider>
              </UserProvider>
            </UserDataSyncProvider>
          </AuthProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
