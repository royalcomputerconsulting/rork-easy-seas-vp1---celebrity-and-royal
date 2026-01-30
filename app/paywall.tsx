import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ExternalLink, RefreshCcw, Shield, Sparkles } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import { useEntitlement, PRO_PRODUCT_ID } from '@/state/EntitlementProvider';

export default function PaywallScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();

  const primaryCtaLabel = useMemo(() => {
    if (entitlement.isPro) return 'You’re Pro';
    if (entitlement.isLoading) return 'Loading…';
    return Platform.OS === 'web' ? 'Unlock Pro (Web Preview)' : 'Subscribe — $30/month';
  }, [entitlement.isLoading, entitlement.isPro]);

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
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} testID="paywall.close">
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Pro Tier</Text>
            <Text style={styles.subtitle}>
              Unlock the full Slot Machine Advantage Players Handbook (726 machines), unlimited detail views, and full exports.
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Crown size={16} color={COLORS.goldDark} />
                <Text style={styles.metaPillText}>Product: {PRO_PRODUCT_ID}</Text>
              </View>
            </View>

            {!!entitlement.error && (
              <View style={styles.errorBox} testID="paywall.error">
                <Text style={styles.errorTitle}>Purchase unavailable</Text>
                <Text style={styles.errorBody}>{entitlement.error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, (entitlement.isLoading || entitlement.isPro) && styles.primaryButtonDisabled]}
              onPress={() => entitlement.subscribeMonthly()}
              activeOpacity={0.9}
              disabled={entitlement.isLoading || entitlement.isPro}
              testID="paywall.subscribe"
            >
              {entitlement.isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{primaryCtaLabel}</Text>
              )}
            </TouchableOpacity>

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

            <Text style={styles.disclosureTitle}>Auto-renew disclosure</Text>
            <Text style={styles.disclosureBody}>
              Payment will be charged to your Apple ID account at confirmation of purchase. The subscription automatically renews unless it is cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscription in your App Store account settings.
            </Text>

            <View style={styles.legalRow}>
              <TouchableOpacity style={styles.legalLink} onPress={() => entitlement.openPrivacyPolicy()} testID="paywall.privacy">
                <Shield size={16} color={COLORS.navyDeep} />
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.legalLink} onPress={() => entitlement.openTerms()} testID="paywall.terms">
                <Shield size={16} color={COLORS.navyDeep} />
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
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.xl,
    padding: 18,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    color: COLORS.white,
    fontWeight: '800' as const,
    fontSize: 12,
  },
  closeText: {
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
    fontSize: 13,
  },
  title: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.textDarkGrey,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212, 160, 10, 0.12)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 10, 0.22)',
  },
  metaPillText: {
    color: COLORS.navyDeep,
    fontWeight: '700' as const,
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.money,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '900' as const,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 31, 68, 0.10)',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
    fontSize: 13,
  },
  disclosureTitle: {
    marginTop: 16,
    color: COLORS.navyDeep,
    fontWeight: '900' as const,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  disclosureBody: {
    marginTop: 8,
    color: COLORS.textDarkGrey,
    fontSize: 13,
    lineHeight: 18,
  },
  legalRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  legalLink: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 58, 99, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(18, 58, 99, 0.10)',
  },
  legalLinkText: {
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
    fontSize: 12,
  },
  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
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
