import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, Lock, RefreshCw, Target, TrendingUp } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { liveCasinoAdvisorRepository, type LiveCasinoAdvisorSnapshot, type LiveCasinoStateRecord } from '@/lib/optimization';

export default function LiveCertificateAdvisorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ownerProfileId?: string; cruiseId?: string }>();
  const ownerProfileId = typeof params.ownerProfileId === 'string' ? params.ownerProfileId : '';
  const cruiseId = typeof params.cruiseId === 'string' ? params.cruiseId : '';
  const [state, setState] = useState<LiveCasinoStateRecord | null>(null);
  const [snapshot, setSnapshot] = useState<LiveCasinoAdvisorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (!ownerProfileId || !cruiseId) return;
      const [savedState, savedSnapshot] = await Promise.all([
        liveCasinoAdvisorRepository.loadState(ownerProfileId, cruiseId),
        liveCasinoAdvisorRepository.loadLatestSnapshot(ownerProfileId, cruiseId),
      ]);
      setState(savedState);
      setSnapshot(savedSnapshot);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [ownerProfileId, cruiseId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><ArrowLeft color={COLORS.navyDeep} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.title}>Live Certificate Advisor</Text><Text style={styles.subtitle}>Saved, explainable casino recommendation</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh saved advisor data" onPress={() => void load()}><RefreshCw color={COLORS.navyDeep} /></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.navyDeep} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {!ownerProfileId || !cruiseId ? <Notice text="Open this screen from a profile-scoped cruise so EasySeas can load the correct saved live state." /> : null}
          {snapshot ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.heroEyebrow}>CURRENT RECOMMENDATION</Text>
                <Text style={styles.heroAction}>{snapshot.recommendation.actionLabel}</Text>
                <Text style={styles.heroMeta}>{snapshot.recommendation.currentPoints.toLocaleString()} points · {snapshot.recommendation.confidence} confidence</Text>
              </View>
              <Metric icon={<Target size={18} color={COLORS.navyDeep} />} label="Recommended target" value={snapshot.recommendation.recommendedTargetPoints?.toLocaleString() ?? 'Stop at current certificate'} />
              <Metric icon={<TrendingUp size={18} color={COLORS.navyDeep} />} label="Expected end-of-cruise points" value={snapshot.endOfCruiseProjection.expectedPoints.toLocaleString()} />
              <Metric icon={<Lock size={18} color={COLORS.navyDeep} />} label="Expected additional loss" value={`$${snapshot.recommendation.expectedAdditionalLoss.toFixed(0)}`} />
              <View style={styles.card}><Text style={styles.cardTitle}>Why</Text>{snapshot.recommendation.topReasons.map(reason => <Text key={reason} style={styles.row}>• {reason}</Text>)}</View>
              <View style={styles.card}><Text style={styles.cardTitle}>One more bounded session</Text><Text style={styles.row}>{snapshot.oneMoreSessionScenario.permitted ? 'Permitted by current safety gates' : 'Not permitted by current safety gates'}</Text><Text style={styles.row}>Expected points: +{snapshot.oneMoreSessionScenario.expectedAdditionalPoints}</Text><Text style={styles.row}>Expected loss: ${snapshot.oneMoreSessionScenario.expectedAdditionalLoss.toFixed(0)}</Text></View>
              {snapshot.stale || snapshot.offline ? <Notice text={snapshot.refreshReasons.join(' ')} /> : null}
            </>
          ) : <Notice text={state ? 'A live state exists, but no saved recommendation snapshot is available yet.' : 'No saved live casino state exists for this profile and cruise.'} />}
          <Text style={styles.disclaimer}>EasySeas maximizes expected net vacation value. No recommendation makes gambling risk-free or guarantees a certificate.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <View style={styles.metric}>{icon}<View style={{ flex: 1 }}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View></View>; }
function Notice({ text }: { text: string }) { return <View style={styles.notice}><AlertTriangle size={18} color="#B45309" /><Text style={styles.noticeText}>{text}</Text></View>; }
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.lg, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.navyDeep }, subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 }, content: { padding: SPACING.lg, paddingBottom: 100 },
  hero: { backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md }, heroEyebrow: { color: '#FDE68A', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, heroAction: { color: '#FFF', fontSize: 26, fontWeight: '900', marginTop: 8 }, heroMeta: { color: '#CBD5E1', marginTop: 8, fontWeight: '700' },
  metric: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, alignItems: 'center' }, metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '700' }, metricValue: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 16, marginTop: 2 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm }, cardTitle: { color: COLORS.navyDeep, fontSize: 16, fontWeight: '900', marginBottom: 8 }, row: { color: '#334155', lineHeight: 20, marginBottom: 5 },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md }, noticeText: { flex: 1, color: '#9A3412', lineHeight: 19, fontWeight: '600' }, disclaimer: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: SPACING.lg },
});
