import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, RefreshCcw, Shield, Sparkles } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { COLORS, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import { useEntitlement, PRO_PRODUCT_ID_MONTHLY, PRO_PRODUCT_ID_3MONTH } from '@/state/EntitlementProvider';

export default function PaywallScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();
  const [overrideLoading, setOverrideLoading] = useState(false);

  const handleManualOverride = () => {
    Alert.prompt(
      'Manual Override',
      'Enter password:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unlock',
          onPress: async (password) => {
            if (password === 'a1') {
              setOverrideLoading(true);
              try {
                await entitlement.manualUnlock();
                Alert.alert('Success', 'Full access unlocked via manual override.');
                router.back();
              } catch (e) {
                Alert.alert('Error', 'Failed to unlock. Please try again.');
              } finally {
                setOverrideLoading(false);
              }
            } else {
              Alert.alert('Error', 'Incorrect password.');
            }
          },
        },
      ],
      'secure-text'
    );
  };

  const find30DayPackage = useMemo(() => {
    for (const offering of entitlement.offerings) {
      const pkg = (offering.availablePackages ?? []).find(
        p => p.product.identifier === PRO_PRODUCT_ID_MONTHLY
      );
      if (pkg) return pkg;
    }
    return null;
  }, [entitlement.offerings]);

  const find90DayPackage = useMemo(() => {
    for (const offering of entitlement.offerings) {
      const pkg = (offering.availablePackages ?? []).find(
        p => p.product.identifier === PRO_PRODUCT_ID_3MONTH
      );
      if (pkg) return pkg;
    }
    return null;
  }, [entitlement.offerings]);

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

            <Text style={styles.title}>Sync Your Data</Text>
            <Text style={styles.subtitle}>
              Subscribe to sync your data across devices and keep your cruise information up to date.
            </Text>

            <View style={styles.subscriptionOptions}>
              <TouchableOpacity
                style={[styles.subscriptionCard, (entitlement.isLoading || entitlement.isPro) && styles.subscriptionCardDisabled]}
                onPress={() => entitlement.subscribeMonthly()}
                activeOpacity={0.9}
                disabled={entitlement.isLoading || entitlement.isPro}
                testID="paywall.subscribe30"
              >
                <View style={styles.subscriptionHeader}>
                  <Text style={styles.subscriptionTitle}>30 Days</Text>
                  {entitlement.isPro && <Text style={styles.activeBadge}>Active</Text>}
                </View>
                <Text style={styles.subscriptionPrice}>
                  {find30DayPackage ? find30DayPackage.product.priceString : '$29.99'}
                </Text>
                <Text style={styles.subscriptionId}>{PRO_PRODUCT_ID_MONTHLY}</Text>
                {entitlement.isLoading ? (
                  <ActivityIndicator color={COLORS.navyDeep} style={styles.loader} />
                ) : (
                  <View style={styles.subscriptionButtonContainer}>
                    <Text style={styles.subscriptionButtonText}>Subscribe</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subscriptionCard, (entitlement.isLoading || entitlement.isPro) && styles.subscriptionCardDisabled]}
                onPress={() => entitlement.subscribe3Month()}
                activeOpacity={0.9}
                disabled={entitlement.isLoading || entitlement.isPro}
                testID="paywall.subscribe90"
              >
                <View style={styles.subscriptionHeader}>
                  <Text style={styles.subscriptionTitle}>90 Days</Text>
                  {entitlement.isPro && <Text style={styles.activeBadge}>Active</Text>}
                </View>
                <Text style={styles.subscriptionPrice}>
                  {find90DayPackage ? find90DayPackage.product.priceString : '$79.99'}
                </Text>
                <Text style={styles.subscriptionId}>{PRO_PRODUCT_ID_3MONTH}</Text>
                {entitlement.isLoading ? (
                  <ActivityIndicator color={COLORS.navyDeep} style={styles.loader} />
                ) : (
                  <View style={styles.subscriptionButtonContainer}>
                    <Text style={styles.subscriptionButtonText}>Subscribe</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

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

            <TouchableOpacity
              style={styles.manualOverrideButton}
              onPress={handleManualOverride}
              activeOpacity={0.8}
              disabled={overrideLoading || entitlement.isPro}
              testID="paywall.manual-override"
            >
              {overrideLoading ? (
                <ActivityIndicator size="small" color={COLORS.navyDeep} />
              ) : (
                <Text style={styles.manualOverrideText}>Manual Override</Text>
              )}
            </TouchableOpacity>
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
  subscriptionOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  subscriptionCard: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.money,
    alignItems: 'center',
  },
  subscriptionCardDisabled: {
    opacity: 0.6,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  activeBadge: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.money,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  subscriptionPrice: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: COLORS.money,
    marginBottom: 6,
  },
  subscriptionId: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
    marginBottom: 12,
  },
  subscriptionButtonContainer: {
    backgroundColor: COLORS.money,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  subscriptionButtonText: {
    color: COLORS.white,
    fontWeight: '800' as const,
    fontSize: 14,
  },
  loader: {
    marginTop: 10,
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
  manualOverrideButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(18, 58, 99, 0.04)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(18, 58, 99, 0.08)',
  },
  manualOverrideText: {
    color: COLORS.navyDeep,
    fontWeight: '600' as const,
    fontSize: 11,
  },
});
