import { useCallback } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, RefreshCcw, Shield, Sparkles } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import { useEntitlement } from '@/state/EntitlementProvider';

export default function PaywallScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();

  const handleClose = useCallback(() => {
    console.log('[Paywall] Close requested - navigating to home');
    router.replace('/(tabs)/(overview)' as any);
  }, [router]);


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#0B1B33', '#123A63', '#E8F4FC']} locations={[0, 0.55, 1]} style={styles.bg}>
        <ScrollView contentContainerStyle={styles.content} testID="paywall.scroll">
          <View style={styles.card} testID="paywall.card">
            <View style={styles.headerRow}>
              <View style={styles.badge}>
                <Sparkles size={16} color={COLORS.white} />
                <Text style={styles.badgeText}>Unlock Full Access</Text>
              </View>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.8} testID="paywall.close">
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Annual Subscription</Text>
            <Text style={styles.priceHero}>$79.99<Text style={styles.priceUnit}> / year</Text></Text>

            <TouchableOpacity
              style={[styles.purchaseButton, (entitlement.isLoading || entitlement.isPro) && styles.purchaseButtonDisabled]}
              onPress={() => entitlement.subscribeProAnnual()}
              activeOpacity={0.85}
              disabled={entitlement.isLoading || entitlement.isPro}
              testID="paywall.subscribe-pro-annual"
            >
              {entitlement.isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.purchaseButtonText}>{entitlement.isPro ? 'Subscribed' : 'Subscribe Now'}</Text>
              )}
            </TouchableOpacity>

            {!!entitlement.error && (
              <View style={styles.errorBox} testID="paywall.error">
                <Text style={styles.errorTitle}>Purchase unavailable</Text>
                <Text style={styles.errorBody}>{entitlement.error}</Text>
              </View>
            )}

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.secondaryButton, entitlement.isLoading && styles.secondaryButtonDisabled]}
                onPress={() => entitlement.restore()}
                activeOpacity={0.9}
                disabled={entitlement.isLoading}
                testID="paywall.restore"
              >
                <RefreshCcw size={16} color={COLORS.navyDeep} />
                <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => entitlement.openManageSubscription()}
                activeOpacity={0.9}
                testID="paywall.manage"
              >
                <ExternalLink size={16} color={COLORS.navyDeep} />
                <Text style={styles.secondaryButtonText}>Manage</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.disclosureBody}>
              Payment will be charged to your {Platform.OS === 'android' ? 'Google Play' : 'Apple ID'} account at confirmation of purchase. The subscription automatically renews at $79.99/year unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your {Platform.OS === 'android' ? 'Google Play' : 'App Store'} account settings.
            </Text>

            <View style={styles.legalRow}>
              <TouchableOpacity style={styles.legalLink} onPress={() => entitlement.openPrivacyPolicy()} testID="paywall.privacy">
                <Shield size={14} color={COLORS.navyDeep} />
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.legalLink} onPress={() => entitlement.openTerms()} testID="paywall.terms">
                <Shield size={14} color={COLORS.navyDeep} />
                <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: BORDER_RADIUS.xl,
    padding: 20,
    ...SHADOW.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    color: COLORS.white,
    fontWeight: '700' as const,
    fontSize: 13,
  },
  closeText: {
    color: COLORS.navyDeep,
    fontWeight: '700' as const,
    fontSize: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    marginBottom: 2,
    textAlign: 'center',
  },
  priceHero: {
    fontSize: 34,
    fontWeight: '900' as const,
    color: COLORS.money,
    textAlign: 'center',
    marginBottom: 14,
  },
  priceUnit: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  purchaseButton: {
    backgroundColor: COLORS.money,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontWeight: '800' as const,
    fontSize: 16,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(10, 31, 68, 0.10)',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: COLORS.navyDeep,
    fontWeight: '700' as const,
    fontSize: 13,
  },
  disclosureBody: {
    color: COLORS.textDarkGrey,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  legalLink: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(18, 58, 99, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(18, 58, 99, 0.10)',
  },
  legalLinkText: {
    color: COLORS.navyDeep,
    fontWeight: '700' as const,
    fontSize: 11,
  },
  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(176,0,32,0.22)',
    backgroundColor: 'rgba(176,0,32,0.06)',
  },
  errorTitle: {
    color: '#8A0020',
    fontWeight: '900' as const,
    marginBottom: 4,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  errorBody: {
    color: '#8A0020',
    fontSize: 13,
    lineHeight: 18,
  },
});
