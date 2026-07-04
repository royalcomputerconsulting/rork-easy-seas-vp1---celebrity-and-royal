import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, ChevronLeft, X, Check, Ban, Trash2, Link2 } from 'lucide-react-native';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoBenefits, type CertificateWalletStatus } from '@/state/CasinoBenefitsProvider';
import { getCertificatePdfMatch } from '@/lib/royalCaribbean/certificatePdf';
import { formatCurrency } from '@/lib/format';
import { createDateFromString } from '@/lib/date';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles } from '@/constants/darkRoyalTheme';
import { useDrillDown } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import type { BookedCruise } from '@/types/models';

type CertType = 'A' | 'C' | 'D';

interface WalletCertificate {
  id: string;
  shipName: string;
  sailDate: string;
  offerCode: string;
  value: number;
  notes: string;
  certType: CertType;
  earnedOn: string;
  status: CertificateWalletStatus;
  appliedToCruiseId?: string;
  estimatedExpiry: string;
}

/**
 * Stage 9.4 - Full Instant Certificate Wallet (replaces the simple bank list).
 * Every certificate shows real status, an estimated expiration window, and a
 * detail drawer with Apply to Cruise / Edit / Mark Used / Mark Expired /
 * Delete actions. Certificates themselves are derived from real cruise
 * records (instantCertificateWon); this screen only adds a persisted status
 * layer on top so nothing about the underlying cruise data changes.
 */
export default function CertificateWalletScreen() {
  const router = useRouter();
  const { bookedCruises } = useCasinoEconomicsData();
  const { clubRoyaleTier, clubRoyaleCurrentYearPoints } = useLoyalty();
  const {
    certificateOverrides,
    setCertificateStatus,
    applyCertificateToCruise,
    removeCertificateOverride,
  } = useCasinoBenefits();
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && width >= LARGE_SCREEN_BREAKPOINT;
  const drill = useDrillDown();
  const [applyPickerCertId, setApplyPickerCertId] = useState<string | null>(null);

  const upcomingCruises = useMemo(() => {
    const today = new Date();
    return bookedCruises
      .filter((c) => {
        const sail = c.sailDate ? createDateFromString(c.sailDate) : null;
        return sail && sail.getTime() >= today.getTime();
      })
      .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());
  }, [bookedCruises]);

  const wallet = useMemo((): WalletCertificate[] => {
    return bookedCruises
      .filter((c) => c.instantCertificateWon)
      .map((cruise): WalletCertificate => {
        const pdfMatch = getCertificatePdfMatch({ offerCode: cruise.instantCertificateOfferCode, offerName: cruise.instantCertificateNotes });
        const certType: CertType = pdfMatch?.certificateType ?? ((cruise.nights ?? 0) >= 6 ? 'D' : 'A');
        const override = certificateOverrides[cruise.id];
        const earnedOn = cruise.returnDate || cruise.sailDate;
        const earnedDate = earnedOn ? createDateFromString(earnedOn) : null;
        const estimatedExpiryDate = earnedDate ? new Date(earnedDate.getTime() + 365 * 86400000) : null;
        const computedStatus: CertificateWalletStatus = override?.status
          ?? (estimatedExpiryDate && estimatedExpiryDate.getTime() < Date.now() ? 'expired' : 'unused');
        return {
          id: cruise.id,
          shipName: cruise.shipName || 'Unknown Ship',
          sailDate: cruise.sailDate,
          offerCode: cruise.instantCertificateOfferCode || '',
          value: cruise.instantCertificateValue || 0,
          notes: cruise.instantCertificateNotes || '',
          certType,
          earnedOn,
          status: computedStatus,
          appliedToCruiseId: override?.appliedToCruiseId,
          estimatedExpiry: estimatedExpiryDate ? estimatedExpiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unknown',
        };
      })
      .filter((cert) => cert.status !== 'removed')
      .sort((a, b) => createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime());
  }, [bookedCruises, certificateOverrides]);

  const totals = useMemo(() => {
    const unused = wallet.filter((c) => c.status === 'unused');
    return {
      count: wallet.length,
      unusedCount: unused.length,
      unusedValue: unused.reduce((sum, c) => sum + c.value, 0),
    };
  }, [wallet]);

  const findCruiseName = useCallback((cruiseId?: string): string | null => {
    if (!cruiseId) return null;
    const found = bookedCruises.find((c) => c.id === cruiseId);
    return found ? `${found.shipName || 'Unknown Ship'} — ${found.sailDate}` : null;
  }, [bookedCruises]);

  const openCertDrill = useCallback((cert: WalletCertificate) => {
    const appliedCruiseName = findCruiseName(cert.appliedToCruiseId);
    drill.open({
      title: `${cert.certType} Certificate`,
      subtitle: `${cert.shipName} — ${cert.sailDate}`,
      summary: `Won as an instant certificate on this cruise. Status: ${cert.status === 'unused' ? 'Unused, available to apply' : cert.status === 'used' ? `Used${appliedCruiseName ? ` on ${appliedCruiseName}` : ''}` : 'Expired (estimated)'}.`,
      inputs: [
        { label: 'Certificate level', value: cert.certType },
        { label: 'Estimated value', value: formatCurrency(cert.value) },
        { label: 'Offer code', value: cert.offerCode || '—' },
        { label: 'Earned on', value: cert.earnedOn },
        { label: 'Estimated expiration', value: cert.estimatedExpiry },
      ],
      assumptions: [
        'Redeem-by, sail-by, and room-type restrictions are set by Royal Caribbean per offer and are not published in a machine-readable form, so expiration here is estimated as 12 months from the cruise it was earned on.',
        'Actual certificate rules always take precedence over this estimate — confirm with your official offer letter before booking.',
      ],
      sourceRecords: [
        { label: 'Earned on cruise', value: `${cert.shipName} — ${cert.sailDate}`, confidence: 'user-entered' },
        ...(appliedCruiseName ? [{ label: 'Applied to cruise', value: appliedCruiseName, confidence: 'user-entered' as const }] : []),
      ],
      relatedActions: [
        { label: 'Edit Certificate', onPress: () => { drill.close(); router.push({ pathname: '/(tabs)/analytics', params: { tab: 'portfolio' } } as any); } },
        ...(cert.status === 'unused' ? [{ label: 'Apply to Cruise', onPress: () => { drill.close(); setApplyPickerCertId(cert.id); } }] : []),
        ...(cert.status !== 'used' ? [{ label: 'Mark Used', emphasis: 'secondary' as const, onPress: () => { setCertificateStatus(cert.id, 'used'); drill.close(); } }] : []),
        ...(cert.status !== 'expired' ? [{ label: 'Mark Expired', emphasis: 'secondary' as const, onPress: () => { setCertificateStatus(cert.id, 'expired'); drill.close(); } }] : []),
        { label: 'Delete from Wallet', emphasis: 'secondary', onPress: () => { removeCertificateOverride(cert.id); drill.close(); } },
      ],
    });
  }, [drill, findCruiseName, router, setCertificateStatus, removeCertificateOverride]);

  const signaturePct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / CLUB_ROYALE_TIERS.Signature.threshold) * 100));

  const body = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={dashStyles.screenTitle}>Instant Certificate Wallet</Text>
        <Text style={dashStyles.screenSubtitle}>Every instant certificate you've won, with status and expiration</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[dashStyles.card, styles.summaryCard]}>
          <Text style={dashStyles.cardLabel}>Total Certificates</Text>
          <Text style={[dashStyles.bigNumber, { fontSize: 22 }]}>{totals.count}</Text>
        </View>
        <View style={[dashStyles.card, styles.summaryCard]}>
          <Text style={dashStyles.cardLabel}>Available Now</Text>
          <Text style={[dashStyles.bigNumber, { fontSize: 22, color: COLORS.green }]}>{totals.unusedCount}</Text>
        </View>
        <View style={[dashStyles.card, styles.summaryCard]}>
          <Text style={dashStyles.cardLabel}>Available Value</Text>
          <Text style={[dashStyles.bigNumber, { fontSize: 22, color: COLORS.gold }]}>{formatCurrency(totals.unusedValue)}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {wallet.map((cert) => (
          <TouchableOpacity
            key={cert.id}
            style={[dashStyles.card, styles.certCard]}
            activeOpacity={0.8}
            onPress={() => openCertDrill(cert)}
            testID={`wallet-cert-${cert.id}`}
          >
            <View style={[styles.certIcon, { backgroundColor: cert.status === 'unused' ? 'rgba(51,199,126,0.14)' : cert.status === 'used' ? 'rgba(59,130,246,0.14)' : 'rgba(239,68,68,0.14)' }]}>
              <Ticket size={18} color={cert.status === 'unused' ? COLORS.green : cert.status === 'used' ? COLORS.royalBlue : COLORS.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.certTitle} numberOfLines={1}>{cert.certType} Certificate — {cert.shipName}</Text>
              <Text style={styles.certSub} numberOfLines={1}>Earned {cert.sailDate} · Est. expires {cert.estimatedExpiry}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.certValue}>{formatCurrency(cert.value)}</Text>
              <View style={[styles.statusPill, { backgroundColor: cert.status === 'unused' ? 'rgba(51,199,126,0.18)' : cert.status === 'used' ? 'rgba(59,130,246,0.18)' : 'rgba(239,68,68,0.18)' }]}>
                <Text style={[styles.statusPillText, { color: cert.status === 'unused' ? COLORS.green : cert.status === 'used' ? COLORS.royalBlue : COLORS.red }]}>
                  {cert.status === 'unused' ? 'Available' : cert.status === 'used' ? 'Used' : 'Expired'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        {wallet.length === 0 && (
          <View style={[dashStyles.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Ticket size={22} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontSize: 13 }}>No instant certificates recorded yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!showSidebar && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.75} onPress={() => router.back()} testID="cert-wallet-back-button">
            <ChevronLeft size={20} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Casino</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.contentRow}>
        {showSidebar && (
          <CasinoSidebar
            activeTab="action"
            onTabChange={(tab) => router.replace({ pathname: '/(tabs)/analytics' as any, params: { tab } })}
            onOverviewPress={() => router.push('/(tabs)/(overview)' as any)}
            onSettingsPress={() => router.push('/(tabs)/settings' as any)}
            clubRoyaleTier={clubRoyaleTier}
            clubRoyalePoints={clubRoyaleCurrentYearPoints}
            tierProgressPct={signaturePct}
            tierProgressLabel="Signature progress"
            onStatusPress={() => router.push('/casino/loyalty-data' as any)}
          />
        )}
        <View style={{ flex: 1 }}>{body}</View>
      </View>

      <Modal visible={Boolean(applyPickerCertId)} transparent animationType="fade" onRequestClose={() => setApplyPickerCertId(null)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setApplyPickerCertId(null)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Apply Certificate To Cruise</Text>
              <TouchableOpacity onPress={() => setApplyPickerCertId(null)}><X size={18} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {upcomingCruises.map((cruise: BookedCruise) => (
                <TouchableOpacity
                  key={cruise.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    if (applyPickerCertId) applyCertificateToCruise(applyPickerCertId, cruise.id);
                    setApplyPickerCertId(null);
                  }}
                >
                  <Text style={styles.pickerRowText} numberOfLines={1}>{cruise.shipName || 'Unknown Ship'} — {cruise.sailDate}</Text>
                </TouchableOpacity>
              ))}
              {upcomingCruises.length === 0 && (
                <Text style={{ color: COLORS.textMuted, fontSize: 13, paddingVertical: 16, textAlign: 'center' as const }}>No upcoming cruises booked yet.</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {drill.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  contentRow: { flex: 1, flexDirection: 'row' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  backButtonText: { fontSize: 15, fontWeight: '600' as const, color: COLORS.textPrimary },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, gap: 4 },
  certCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  certIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  certTitle: { fontSize: 13.5, fontWeight: '700' as const, color: COLORS.textPrimary },
  certSub: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 },
  certValue: { fontSize: 14, fontWeight: '800' as const, color: COLORS.gold },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '700' as const },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(2,8,25,0.65)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, maxHeight: 440 },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { fontSize: 15, fontWeight: '700' as const, color: COLORS.textPrimary },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerRowText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' as const },
});
