import { useCallback } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, RefreshCcw, Shield } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useEntitlement } from '@/state/EntitlementProvider';

const MONTHLY_SUBSCRIPTION_AD_URI = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0241udq93h66h62ok6ab2.png' as const;
const INCLUDED_FEATURES = ['Advanced Sonar', 'GPS & Charts', 'Fish Finder', 'Exclusive Perks'] as const;

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

  const handleRestore = useCallback(async () => {
    console.log('[PaywallMonthly] Restore purchases requested');
    await entitlement.restore();
  }, [entitlement]);

  const handleManage = useCallback(async () => {
    console.log('[PaywallMonthly] Manage subscription requested');
    await entitlement.openManageSubscription();
  }, [entitlement]);

  const handlePrivacy = useCallback(async () => {
    console.log('[PaywallMonthly] Privacy policy requested');
    await entitlement.openPrivacyPolicy();
  }, [entitlement]);

  const handleTerms = useCallback(async () => {
    console.log('[PaywallMonthly] Terms requested');
    await entitlement.openTerms();
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

            <View style={styles.offerCard}>
              <View style={styles.offerHeaderRow}>
                <View style={styles.planPill}>
                  <Text style={styles.planPillText}>Monthly subscription</Text>
                </View>
                <Text style={styles.priceCaption}>Cancel anytime</Text>
              </View>

              <Text style={styles.priceHero}>
                $9.99
                <Text style={styles.priceUnit}> / month</Text>
              </Text>
              <Text style={styles.subtitle}>One full month of Easy Seas access with every premium feature included.</Text>

              <View style={styles.featuresGrid}>
                {INCLUDED_FEATURES.map((feature) => (
                  <View key={feature} style={styles.featureChip}>
                    <Text style={styles.featureChipText}>{feature}</Text>
                  </View>
                ))}
              </View>

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
                    {entitlement.isPro
                      ? 'Subscribed'
                      : Platform.OS === 'android'
                        ? 'Subscribe for $9.99 on Google Play'
                        : 'Start Monthly Access for $9.99'}
                  </Text>
                )}
              </TouchableOpacity>

              {!!entitlement.error && (
                <View style={styles.errorBox} testID="paywall-monthly.error">
                  <Text style={styles.errorTitle}>Purchase unavailable</Text>
                  <Text style={styles.errorBody}>{entitlement.error}</Text>
                </View>
              )}

              <View style={styles.rowButtons}>
                <TouchableOpacity
                  style={[styles.secondaryButton, entitlement.isLoading && styles.secondaryButtonDisabled]}
                  onPress={() => {
                    void handleRestore();
                  }}
                  activeOpacity={0.9}
                  disabled={entitlement.isLoading}
                  testID="paywall-monthly.restore"
                >
                  <RefreshCcw size={18} color={COLORS.navyDeep} />
                  <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void handleManage();
                  }}
                  activeOpacity={0.9}
                  testID="paywall-monthly.manage"
                >
                  <ExternalLink size={18} color={COLORS.navyDeep} />
                  <Text style={styles.secondaryButtonText} numberOfLines={1}>Manage Subscription</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.disclosureBox}>
              <Text style={styles.disclosureBody}>
                Payment will be charged to your {Platform.OS === 'android' ? 'Google Play' : 'Apple ID'} account at confirmation of purchase. The subscription automatically renews at $9.99/month unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your {Platform.OS === 'android' ? 'Google Play' : 'App Store'} account settings.
              </Text>
            </View>

            <View style={styles.legalRow}>
              <TouchableOpacity
                style={styles.legalLink}
                onPress={() => {
                  void handlePrivacy();
                }}
                testID="paywall-monthly.privacy"
              >
                <Shield size={16} color={'#163754'} />
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.legalLink}
                onPress={() => {
                  void handleTerms();
                }}
                testID="paywall-monthly.terms"
              >
                <Shield size={16} color={'#163754'} />
                <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
              </TouchableOpacity>
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
    gap: 16,
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
  offerCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  offerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  planPill: {
    backgroundColor: '#D9F3FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  planPillText: {
    color: '#0A4C77',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  priceCaption: {
    color: '#486274',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  priceHero: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900' as const,
    color: '#0C3454',
  },
  priceUnit: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#486274',
  },
  subtitle: {
    marginTop: 10,
    color: '#23445F',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600' as const,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  featureChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ECF8FF',
    borderWidth: 1,
    borderColor: '#D2ECFB',
  },
  featureChipText: {
    color: '#0D4A73',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  purchaseButton: {
    backgroundColor: '#0A77A4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontWeight: '900' as const,
    fontSize: 16,
    textAlign: 'center',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF7FB',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D7EAF2',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: '#163754',
    fontWeight: '800' as const,
    fontSize: 12,
    flexShrink: 1,
  },
  disclosureBox: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  disclosureBody: {
    color: '#173754',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  legalLink: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  legalLinkText: {
    color: '#163754',
    fontWeight: '800' as const,
    fontSize: 14,
  },
  errorBox: {
    marginBottom: 12,
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
