import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Activity, AlertTriangle, CheckCircle, Database, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { buildDataHealthSummary } from '@/lib/easySeasAdvisor';

export default function DataHealthScreen() {
  const router = useRouter();
  const { cruises, bookedCruises, casinoOffers } = useCoreData();
  const summary = useMemo(() => buildDataHealthSummary(cruises, bookedCruises, casinoOffers), [cruises, bookedCruises, casinoOffers]);
  const issueCount = summary.duplicateAvailableRows + summary.duplicateOfferCodes + summary.possiblyMisclassifiedUpcoming;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ADMIN · DATA HEALTH</Text>
          <Text style={styles.title}>Trust the Counts</Text>
          <Text style={styles.subtitle}>Quick source-of-truth checks for brand separation, duplicate rows, completed cruises, and inflated upcoming counts.</Text>
        </View>

        <View style={[styles.statusCard, issueCount ? styles.warningCard : styles.goodCard]}>
          {issueCount ? <AlertTriangle size={24} color="#92400E" /> : <ShieldCheck size={24} color={COLORS.success} />}
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{issueCount ? 'Review recommended' : 'No obvious data-health issues'}</Text>
            <Text style={styles.statusSubtitle}>{issueCount ? `${issueCount} duplicate/misclassification signal${issueCount === 1 ? '' : 's'} found.` : 'Current local data looks clean by the production checks.'}</Text>
          </View>
        </View>

        <MetricGrid metrics={[
          ['Royal offers', summary.royalOffers],
          ['Celebrity offers', summary.celebrityOffers],
          ['Royal sailings', summary.royalAvailableCruises],
          ['Celebrity sailings', summary.celebrityAvailableCruises],
          ['Active upcoming', summary.activeUpcoming],
          ['Courtesy holds', summary.courtesyHolds],
          ['Completed cruises', summary.completedCruises],
          ['Duplicate rows', summary.duplicateAvailableRows],
          ['Duplicate offers', summary.duplicateOfferCodes],
          ['Misclassified upcoming', summary.possiblyMisclassifiedUpcoming],
        ]} />

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Database size={18} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Repair recommendations</Text>
          </View>
          <RepairLine good={summary.duplicateAvailableRows === 0} text={summary.duplicateAvailableRows === 0 ? 'No duplicate available-offer rows detected.' : 'Run a brand-scoped offer catalog repair before trusting available-cruise totals.'} />
          <RepairLine good={summary.possiblyMisclassifiedUpcoming === 0} text={summary.possiblyMisclassifiedUpcoming === 0 ? 'Available offers are not being counted as active bookings.' : 'Some offer catalog rows look like they may be in the booked/upcoming lane.'} />
          <RepairLine good={summary.completedCruises > 0} text={summary.completedCruises > 0 ? `${summary.completedCruises} completed cruise records are visible to the app.` : 'No completed cruise records are visible yet; sync history or import completed cruises.'} />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Activity size={18} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Production guardrails</Text>
          </View>
          <RepairLine good text="Royal sync should settle around 5 offers / 1,073 available sailings when current offer set is complete." />
          <RepairLine good text="Celebrity sync should update only Celebrity-owned Blue Chip rows and not overwrite Club Royale data." />
          <RepairLine good text="Completed cruises should never inflate active upcoming or offer-catalog counts." />
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/advisor' as any)}>
            <Text style={styles.primaryButtonText}>Open Advisor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/settings' as any)}>
            <RefreshCw size={16} color={COLORS.navyDeep} />
            <Text style={styles.secondaryButtonText}>Go to Admin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, number]> }) {
  return (
    <View style={styles.grid}>
      {metrics.map(([label, value]) => (
        <View key={label} style={styles.metricCard}>
          <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function RepairLine({ text, good }: { text: string; good?: boolean }) {
  return (
    <View style={styles.repairLine}>
      {good ? <CheckCircle size={15} color={COLORS.success} /> : <AlertTriangle size={15} color="#B45309" />}
      <Text style={styles.repairText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  header: { marginBottom: SPACING.md },
  eyebrow: { color: COLORS.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: COLORS.navyDeep, fontSize: 28, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#64748B', fontSize: 14, lineHeight: 20, marginTop: 6 },
  statusCard: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.small },
  warningCard: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  goodCard: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' },
  statusCopy: { flex: 1 },
  statusTitle: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 16 },
  statusSubtitle: { color: '#475569', marginTop: 2, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.md },
  metricCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#E2E8F0' },
  metricValue: { color: COLORS.navyDeep, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 4 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 16 },
  repairLine: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 9 },
  repairText: { flex: 1, color: '#334155', fontWeight: '700', lineHeight: 19, fontSize: 13 },
  buttons: { gap: 10 },
  primaryButton: { backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryButton: { backgroundColor: '#E0F2FE', borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryButtonText: { color: COLORS.navyDeep, fontWeight: '900' },
});
