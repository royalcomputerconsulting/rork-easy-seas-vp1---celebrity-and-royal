import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useEntitlement } from '@/state/EntitlementProvider';

const MONTHLY_SUBSCRIPTION_AD_URI = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0241udq93h66h62ok6ab2.png' as const;
const PURCHASE_BUTTON_LABEL = 'PURCHASE SUBSCRIPTION FOR $9.99' as const;
const SUBSCRIBED_BUTTON_LABEL = 'SUBSCRIPTION ACTIVE' as const;

export default function PaywallMonthlyScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();

  const handleClose = useCallback(() => {
    console.log('[PaywallMonthly] Close requested');
    router.replace('/(tabs)/(overview)' as any);
  }, [router]);

  const handleSubscribe = useCallback(async () => {
    console.log('[PaywallMonthly] Subscribe monthly requested');
    await entitlement.subscribeProMonthly();
  }, [entitlement]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#04182C', '#0E4D82', '#0A79A8']} locations={[0, 0.52, 1]} style={styles.bg}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.topRow}>
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>Easy Seas Pro</Text>
            </View>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.82} testID="paywall-monthly.close">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            testID="paywall-monthly.scroll"
          >
            <View style={styles.posterShell}>
              <Image
                source={MONTHLY_SUBSCRIPTION_AD_URI}
                style={styles.posterImage}
                contentFit="cover"
                transition={150}
                testID="paywall-monthly.ad-image"
                onError={(event) => {
                  console.error('[PaywallMonthly] Failed to load monthly subscription ad image', event);
                }}
              />
            </View>

            <View style={styles.purchaseSection}>
              <TouchableOpacity
                style={[styles.purchaseButton, (entitlement.isLoading || entitlement.isPro) && styles.purchaseButtonDisabled]}
                onPress={() => {
                  void handleSubscribe();
                }}
                activeOpacity={0.88}
                disabled={entitlement.isLoading || entitlement.isPro}
                testID="paywall-monthly.subscribe-pro-monthly"
              >
                {entitlement.isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.purchaseButtonText}>
                    {entitlement.isPro ? SUBSCRIBED_BUTTON_LABEL : PURCHASE_BUTTON_LABEL}
                  </Text>
                )}
              </TouchableOpacity>

              {!!entitlement.error && (
                <View style={styles.errorBox} testID="paywall-monthly.error">
                  <Text style={styles.errorTitle}>Purchase unavailable</Text>
                  <Text style={styles.errorBody}>{entitlement.error}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  topBadgeText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  closeText: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '800' as const,
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  posterShell: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#001220',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  posterImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0B2D4C',
  },
  purchaseSection: {
    gap: 12,
  },
  purchaseButton: {
    minHeight: 64,
    backgroundColor: '#0A77A4',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#012338',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontWeight: '900' as const,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  errorBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.18)',
    backgroundColor: '#FFF2F2',
    width: '100%',
  },
  errorTitle: {
    color: '#B91C1C',
    fontWeight: '900' as const,
    marginBottom: 4,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  errorBody: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600' as const,
  },
});
