import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, Calculator, CheckCircle, Crown, Gauge, HelpCircle, Map, Ship, Sparkles, Target, Trophy } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { buildOfferRecommendations, buildTripStackCandidates, buildUpgradeMath, getCasinoPaysForLabel } from '@/lib/easySeasAdvisor';

export default function AdvisorScreen() {
  const router = useRouter();
  const { cruises, bookedCruises, casinoOffers } = useCoreData();
  const recommendations = useMemo(() => buildOfferRecommendations(cruises, bookedCruises, casinoOffers), [cruises, bookedCruises, casinoOffers]);
  const tripStacks = useMemo(() => buildTripStackCandidates(cruises, bookedCruises), [cruises, bookedCruises]);
  const top = recommendations[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CASINO CRUISE ADVISOR</Text>
          <Text style={styles.title}>Best Offer Right Now</Text>
          <Text style={styles.subtitle}>A casino-host style view of offers, conflicts, upgrade math, and trip-stacking opportunities.</Text>
        </View>

        {top ? (
          <TouchableOpacity
            style={styles.heroCard}
            activeOpacity={0.85}
            onPress={() => top.cruise && router.push({ pathname: '/cruise-details' as any, params: buildCruiseDetailsParams(top.cruise, { source: 'advisor-best-offer' }) })}
          >
            <View style={styles.heroIcon}><Trophy size={24} color="#FDE68A" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{top.title}</Text>
              <Text style={styles.heroSubtitle}>{top.subtitle}</Text>
              <Text style={styles.scoreText}>Advisor Score {top.score} · {top.valueLabel}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCard}>
            <HelpCircle size={22} color={COLORS.navyDeep} />
            <Text style={styles.emptyText}>No active offer sailings found yet. Sync Royal/Celebrity or import offers to unlock recommendations.</Text>
          </View>
        )}

        <Section title="Why this cruise?" icon={<Sparkles size={18} color={COLORS.navyDeep} />}>
          {(top?.reasons ?? ['Sync offers to generate a recommendation explanation.']).map((reason) => (
            <Bullet key={reason} text={reason} positive />
          ))}
        </Section>

        <Section title="Warnings before booking" icon={<AlertTriangle size={18} color="#B45309" />}>
          {top?.warnings.length ? top.warnings.map((warning) => <Bullet key={warning} text={warning} />) : <Bullet text="No direct overlap or immediate warning found for the current top candidate." positive />}
        </Section>

        <Section title="Casino pays for" icon={<Crown size={18} color={COLORS.navyDeep} />}>
          <Text style={styles.bodyText}>{top?.cruise ? getCasinoPaysForLabel(top.cruise, top.offer) : 'Cabin, guest, FreePlay, and OBC badges appear here after offer sync.'}</Text>
        </Section>

        <Section title="Upgrade math" icon={<Calculator size={18} color={COLORS.navyDeep} />}>
          {(top?.cruise ? buildUpgradeMath(top.cruise).details : ['Cabin spread calculator appears here when pricing is present.']).map((item) => <Bullet key={item} text={item} positive />)}
        </Section>

        <Section title="Casino / slot technician lens" icon={<Gauge size={18} color={COLORS.navyDeep} />}>
          <Bullet text="Check ship casino size, table/slot mix, and known machine families before choosing an offer." positive />
          <Bullet text="Use Slots tab machine logs as the watchlist for visible-pot, meter, and bank-location notes." positive />
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/machines' as any)}>
            <Text style={styles.secondaryButtonText}>Open Machine Watchlist</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Trip Stack Builder" icon={<Map size={18} color={COLORS.navyDeep} />}>
          {tripStacks.length ? tripStacks.slice(0, 3).map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              style={styles.stackCard}
              onPress={() => router.push({ pathname: '/cruise-details' as any, params: buildCruiseDetailsParams(candidate.cruise, { source: 'trip-stack-builder' }) })}
            >
              <Text style={styles.stackTitle}>{candidate.title}</Text>
              <Text style={styles.stackSubtitle}>{candidate.subtitle}</Text>
              {candidate.reasons.slice(0, 2).map((reason) => <Bullet key={reason} text={reason} positive />)}
              {candidate.warnings.map((warning) => <Bullet key={warning} text={warning} />)}
            </TouchableOpacity>
          )) : <Bullet text="No clean short-gap trip stacks found from current booked cruises and active offers." />}
        </Section>

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/data-health' as any)}>
            <Text style={styles.primaryButtonText}>Open Data Health</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/ask-my-data' as any)}>
            <Text style={styles.primaryButtonText}>Ask My Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Bullet({ text, positive }: { text: string; positive?: boolean }) {
  return (
    <View style={styles.bulletRow}>
      {positive ? <CheckCircle size={14} color={COLORS.success} /> : <AlertTriangle size={14} color="#B45309" />}
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  header: { marginBottom: SPACING.md },
  eyebrow: { fontSize: 12, fontWeight: '800', color: COLORS.gold, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.navyDeep },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#64748B', marginTop: 6 },
  heroCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.medium },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  heroSubtitle: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  scoreText: { color: '#FDE68A', fontWeight: '800', marginTop: 8 },
  emptyCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  emptyText: { flex: 1, color: '#475569', fontWeight: '600' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 16 },
  bodyText: { color: '#334155', lineHeight: 20, fontWeight: '600' },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  bulletText: { flex: 1, color: '#334155', lineHeight: 19, fontSize: 13, fontWeight: '600' },
  stackCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, backgroundColor: '#F8FAFC' },
  stackTitle: { fontWeight: '900', color: COLORS.navyDeep },
  stackSubtitle: { color: '#64748B', marginTop: 2, marginBottom: 8, fontSize: 12, fontWeight: '700' },
  rowButtons: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryButton: { backgroundColor: '#E0F2FE', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, alignItems: 'center', marginTop: 4 },
  secondaryButtonText: { color: COLORS.navyDeep, fontWeight: '900' },
});
