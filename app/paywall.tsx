import { useCallback } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, RefreshCcw, Shield } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useEntitlement } from '@/state/EntitlementProvider';
export default function PaywallScreen() {
    const router = useRouter();
    const entitlement = useEntitlement();
    const handleClose = useCallback(() => {
        console.log('[Paywall] Close requested - navigating to home');
        router.replace('/(tabs)/(overview)' as any);
    }, [router]);
    return (<>
      <Stack.Screen options={{ headerShown: false }}/>
      <LinearGradient colors={['#0B1B33', '#123A63', '#E8F4FC']} locations={[0, 0.55, 1]} style={styles.bg}>
        <View style={styles.content} testID="paywall.scroll">
          <View style={styles.topRow}>
            <View />
            <TouchableOpacity onPress={handleClose} activeOpacity={0.8} testID="paywall.close">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.centerBlock}>
            <Text style={styles.title}>Annual Subscription</Text>
            <Text style={styles.priceHero}>$79.99<Text style={styles.priceUnit}> / year</Text></Text>

            <TouchableOpacity style={[styles.purchaseButton, (entitlement.isLoading || entitlement.isPro) && styles.purchaseButtonDisabled]} onPress={() => entitlement.subscribeProAnnual()} activeOpacity={0.85} disabled={entitlement.isLoading || entitlement.isPro} testID="paywall.subscribe-pro-annual">
              {entitlement.isLoading ? (<ActivityIndicator color={COLORS.white}/>) : (<Text style={styles.purchaseButtonText}>
                  {entitlement.isPro
                ? 'Subscribed'
                : Platform.OS === 'android'
                    ? 'Subscribe via Google Play'
                    : 'Subscribe Now'}
                </Text>)}
            </TouchableOpacity>

            

            <View style={styles.rowButtons}>
              <TouchableOpacity style={[styles.secondaryButton, entitlement.isLoading && styles.secondaryButtonDisabled]} onPress={() => entitlement.restore()} activeOpacity={0.9} disabled={entitlement.isLoading} testID="paywall.restore">
                <RefreshCcw size={18} color={COLORS.navyDeep}/>
                <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => entitlement.openManageSubscription()} activeOpacity={0.9} testID="paywall.manage">
                <ExternalLink size={18} color={COLORS.navyDeep}/>
                <Text style={styles.secondaryButtonText} numberOfLines={1}>Manage Subscription</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomBlock}>
            <View style={styles.disclosureBox}>
              <Text style={styles.disclosureBody}>
                Payment will be charged to your {Platform.OS === 'android' ? 'Google Play' : 'Apple ID'} account at confirmation of purchase. The subscription automatically renews at $79.99/year unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your {Platform.OS === 'android' ? 'Google Play' : 'App Store'} account settings.
              </Text>
            </View>

            <View style={styles.legalRow}>
              <TouchableOpacity style={styles.legalLink} onPress={() => entitlement.openPrivacyPolicy()} testID="paywall.privacy">
                <Shield size={16} color={'#333'}/>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.legalLink} onPress={() => entitlement.openTerms()} testID="paywall.terms">
                <Shield size={16} color={'#333'}/>
                <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
    </>);
}
const styles = StyleSheet.create({
    bg: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 44,
        paddingBottom: 36,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    badge: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    badgeText: {
        color: COLORS.white,
        fontWeight: '700' as const,
        fontSize: 14,
    },
    closeText: {
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '700' as const,
        fontSize: 18,
    },
    centerBlock: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '800' as const,
        color: COLORS.white,
        marginBottom: 4,
        textAlign: 'center',
    },
    priceHero: {
        fontSize: 42,
        fontWeight: '900' as const,
        color: '#4ADE80',
        textAlign: 'center',
        marginBottom: 18,
    },
    priceUnit: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: 'rgba(255,255,255,0.6)',
    },
    purchaseButton: {
        backgroundColor: '#22C55E',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        alignSelf: 'stretch',
        marginBottom: 10,
        width: '100%',
    },
    purchaseButtonDisabled: {
        opacity: 0.6,
    },
    purchaseButtonText: {
        color: COLORS.white,
        fontWeight: '800' as const,
        fontSize: 17,
    },
    rowButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    secondaryButtonDisabled: {
        opacity: 0.6,
    },
    secondaryButtonText: {
        color: COLORS.white,
        fontWeight: '700' as const,
        fontSize: 12,
        flexShrink: 1,
    },
    bottomBlock: {
        alignItems: 'center',
        marginTop: 12,
    },
    disclosureBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 16,
    },
    disclosureBody: {
        color: '#111111',
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '500' as const,
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
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    legalLinkText: {
        color: '#111111',
        fontWeight: '700' as const,
        fontSize: 20,
    },
    errorBox: {
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,100,100,0.3)',
        backgroundColor: 'rgba(255,100,100,0.12)',
        width: '100%',
    },
    errorTitle: {
        color: '#FF8A8A',
        fontWeight: '900' as const,
        marginBottom: 4,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    errorBody: {
        color: '#FF8A8A',
        fontSize: 15,
        lineHeight: 20,
    },
});
