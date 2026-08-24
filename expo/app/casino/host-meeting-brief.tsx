import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, FileDown, ShieldCheck } from 'lucide-react-native';

import { DARK_ROYAL_COLORS } from '@/constants/darkRoyalTheme';
import { buildCasinoHostBriefHtml, buildCasinoHostMeetingBrief, type HostBriefRedaction } from '@/lib/analytics/hostMeetingBrief';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useUser } from '@/state/UserProvider';

const DEFAULT_REDACTION: HostBriefRedaction = { identity: false, loyaltyIds: false, cashResults: false, reservationNumbers: false, cruiseDetails: false };

export default function HostMeetingBriefScreen() {
  const router = useRouter();
  const { bookedCruises } = useCasinoEconomicsData();
  const { sessions } = useCasinoSessions();
  const { certificates } = useCertificates();
  const { currentUser } = useUser();
  const [request, setRequest] = useState('Please review my recent play and upcoming cruises and advise what documented casino consideration may be available.');
  const [redaction, setRedaction] = useState(DEFAULT_REDACTION);
  const [exporting, setExporting] = useState(false);

  const brief = useMemo(() => buildCasinoHostMeetingBrief({
    profile: currentUser ? { displayName: currentUser.displayName || currentUser.name, email: currentUser.email, clubRoyaleId: currentUser.clubRoyaleId, blueChipId: currentUser.blueChipId, clubRoyaleTier: currentUser.clubRoyaleTier, clubRoyalePoints: currentUser.clubRoyalePoints } : null,
    bookedCruises,
    sessions,
    certificates,
    request,
    redaction,
  }), [bookedCruises, certificates, currentUser, redaction, request, sessions]);

  const setField = useCallback((field: keyof HostBriefRedaction, value: boolean) => setRedaction((current) => ({ ...current, [field]: value })), []);
  const applySafeShare = useCallback(() => setRedaction({ identity: true, loyaltyIds: true, cashResults: true, reservationNumbers: true, cruiseDetails: false }), []);

  const exportPdf = useCallback(async () => {
    try {
      setExporting(true);
      const html = buildCasinoHostBriefHtml(brief);
      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `EasySeas-Host-Brief-${new Date().toISOString().slice(0, 10)}.html`;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }
      const file = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share Casino Host Meeting Brief' });
    } catch (error) {
      console.error('[HostMeetingBrief] Export failed:', error);
    } finally {
      setExporting(false);
    }
  }, [brief]);

  const metrics = [
    ['Points', brief.points?.toLocaleString() ?? 'Not recorded'],
    ['Coin-in', brief.coinIn == null ? 'Not recorded' : `$${Math.round(brief.coinIn).toLocaleString()}`],
    ['Theo', brief.theoreticalLoss == null ? 'Not recorded' : `$${Math.round(brief.theoreticalLoss).toLocaleString()}`],
    ['Avg points/day', brief.averagePointsPerDay == null ? 'Not recorded' : Math.round(brief.averagePointsPerDay).toLocaleString()],
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="host-brief-back"><ArrowLeft size={20} color={DARK_ROYAL_COLORS.gold} /></TouchableOpacity>
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>Host Meeting Brief</Text><Text style={styles.headerSubtitle}>One-page, sourced, and redactable</Text></View>
          <TouchableOpacity onPress={applySafeShare} style={styles.safeButton} testID="host-brief-safe-share"><ShieldCheck size={15} color={DARK_ROYAL_COLORS.deepNavy} /><Text style={styles.safeButtonText}>Redact</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Specific request to make</Text>
          <TextInput style={styles.requestInput} multiline value={request} onChangeText={setRequest} testID="host-brief-request" />

          <View style={styles.metricGrid} testID="host-brief-metrics">
            {metrics.map(([label, value]) => <View key={label} style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>)}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Redaction controls</Text>
            {([
              ['identity', 'Hide name and email'],
              ['loyaltyIds', 'Hide loyalty IDs'],
              ['cashResults', 'Hide cash results'],
              ['reservationNumbers', 'Hide reservation numbers'],
              ['cruiseDetails', 'Hide detailed cruise rows'],
            ] as Array<[keyof HostBriefRedaction, string]>).map(([field, label]) => <View key={field} style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Switch value={redaction[field]} onValueChange={(value) => setField(field, value)} /></View>)}
          </View>

          <View style={styles.panel} testID="host-brief-preview">
            <Text style={styles.panelTitle}>Recent casino evidence</Text>
            {brief.recentCruises.slice(0, 6).map((cruise) => <View key={cruise.id} style={styles.cruiseRow}><View style={styles.cruiseCopy}><Text style={styles.cruiseTitle}>{cruise.ship}</Text><Text style={styles.cruiseMeta}>{cruise.sailDate} · {cruise.nights} nights · {cruise.confidence}</Text></View><Text style={styles.cruisePoints}>{cruise.points == null ? '—' : `${cruise.points.toLocaleString()} pts`}</Text></View>)}
            {brief.recentCruises.length === 0 ? <Text style={styles.emptyText}>No recent casino cruise closeouts are recorded.</Text> : null}
            <Text style={styles.panelTitle}>Upcoming cruises</Text>
            {brief.upcomingCruises.slice(0, 5).map((cruise) => <Text key={`${cruise.ship}-${cruise.sailDate}`} style={styles.lineText}>• {cruise.ship} — {cruise.sailDate}{cruise.offerCode ? ` · ${cruise.offerCode}` : ''}</Text>)}
            <Text style={styles.panelTitle}>Certificates earned / held</Text>
            {brief.certificatesEarned.slice(0, 8).map((certificate, index) => <Text key={`${certificate.code}-${index}`} style={styles.lineText}>• {certificate.code}{certificate.value == null ? '' : ` · $${certificate.value.toLocaleString()}`}</Text>)}
          </View>

          <View style={styles.warningPanel}>{brief.sourceNotes.map((note) => <Text key={note} style={styles.warningText}>• {note}</Text>)}</View>

          <TouchableOpacity style={styles.exportButton} onPress={() => void exportPdf()} disabled={exporting} testID="host-brief-export-pdf">
            {exporting ? <ActivityIndicator color={DARK_ROYAL_COLORS.deepNavy} /> : <FileDown size={18} color={DARK_ROYAL_COLORS.deepNavy} />}
            <Text style={styles.exportText}>{exporting ? 'Preparing one-page brief…' : 'Export / Share PDF Brief'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_ROYAL_COLORS.deepNavy }, safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 }, headerTitle: { color: DARK_ROYAL_COLORS.textPrimary, fontSize: 17, fontWeight: '900' }, headerSubtitle: { color: DARK_ROYAL_COLORS.mutedText, fontSize: 11, marginTop: 2 },
  safeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DARK_ROYAL_COLORS.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 }, safeButtonText: { color: DARK_ROYAL_COLORS.deepNavy, fontSize: 11, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 60 }, sectionLabel: { color: DARK_ROYAL_COLORS.gold, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7 },
  requestInput: { minHeight: 90, backgroundColor: DARK_ROYAL_COLORS.card, borderWidth: 1, borderColor: DARK_ROYAL_COLORS.borderStrong, borderRadius: 14, color: DARK_ROYAL_COLORS.textPrimary, padding: 12, textAlignVertical: 'top' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, metricCard: { width: '48%', backgroundColor: DARK_ROYAL_COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: DARK_ROYAL_COLORS.border, padding: 12 }, metricLabel: { color: DARK_ROYAL_COLORS.mutedText, fontSize: 10, textTransform: 'uppercase' }, metricValue: { color: DARK_ROYAL_COLORS.textPrimary, fontSize: 18, fontWeight: '900', marginTop: 3 },
  panel: { backgroundColor: DARK_ROYAL_COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: DARK_ROYAL_COLORS.border, padding: 14, marginTop: 14 }, panelTitle: { color: DARK_ROYAL_COLORS.gold, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 6, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DARK_ROYAL_COLORS.border }, toggleLabel: { color: DARK_ROYAL_COLORS.textSecondary, fontSize: 13 },
  cruiseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DARK_ROYAL_COLORS.border }, cruiseCopy: { flex: 1 }, cruiseTitle: { color: DARK_ROYAL_COLORS.textPrimary, fontSize: 13, fontWeight: '800' }, cruiseMeta: { color: DARK_ROYAL_COLORS.mutedText, fontSize: 10, marginTop: 2 }, cruisePoints: { color: DARK_ROYAL_COLORS.gold, fontSize: 12, fontWeight: '900' },
  lineText: { color: DARK_ROYAL_COLORS.textSecondary, fontSize: 12, lineHeight: 18 }, emptyText: { color: DARK_ROYAL_COLORS.mutedText, fontSize: 12 },
  warningPanel: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', borderRadius: 12, padding: 12, marginTop: 14 }, warningText: { color: '#FDE68A', fontSize: 11, lineHeight: 17 },
  exportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: DARK_ROYAL_COLORS.gold, borderRadius: 14, paddingVertical: 14, marginTop: 16 }, exportText: { color: DARK_ROYAL_COLORS.deepNavy, fontSize: 14, fontWeight: '900' },
});
