import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bot, ChevronRight, Gauge, Network, ShieldAlert, Sparkles, Target, TrendingUp } from 'lucide-react-native';

import { DARK_ROYAL_COLORS as C } from '@/constants/darkRoyalTheme';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { calculateOfferIntelligenceScore } from '@/lib/offerIntelligence';
import { buildOfferHistoryReport } from '@/lib/offerHistoryIntelligence';
import { buildCasinoRelationshipSnapshot, type EvidenceMetric } from '@/lib/casino/casinoRelationshipIntelligence';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { usePersonalCertificateOptimizer } from '@/state/PersonalCertificateOptimizerProvider';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { buildRelationshipGraph } from '@/lib/relationships/relationshipGraph';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';

const money = (metric: EvidenceMetric) => metric.value == null ? 'Not recorded' : `${metric.value < 0 ? '-' : ''}$${Math.abs(Math.round(metric.value)).toLocaleString()}`;
const number = (metric: EvidenceMetric) => metric.value == null ? 'Not recorded' : Math.round(metric.value).toLocaleString();
const percent = (metric: EvidenceMetric) => metric.value == null ? 'Not enough evidence' : `${metric.value.toFixed(1)}%`;
const sourceLabel = (source: EvidenceMetric['source']) => source.replaceAll('_', ' ');

export default function CasinoRelationshipIntelligenceScreen() {
  const router = useRouter();
  const { bookedCruises } = useCasinoEconomicsData();
  const core = useCoreData();
  const { casinoOffers } = core;
  const { sessions } = useCasinoSessions();
  const { certificates, searchableCertificates } = useCertificates();
  const loyalty = useLoyalty();
  const { clubRoyalePoints, clubRoyalePointsSource } = loyalty;
  const { bundle } = usePersonalCertificateOptimizer();
  const { currentUser } = useUser();
  const { authenticatedEmail } = useAuth();
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [availableCruises, setAvailableCruises] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    let active = true;
    void core.getAllCruises().then((rows) => {
      if (active) setAvailableCruises(rows as unknown as Record<string, unknown>[]);
    });
    return () => { active = false; };
  }, [core.getAllCruises]);

  const snapshot = useMemo(() => buildCasinoRelationshipSnapshot({
    cruises: bookedCruises,
    sessions,
    offers: casinoOffers,
    currentPoints: clubRoyalePoints,
    currentPointsSource: clubRoyalePointsSource === 'manual' ? 'user_entered' : clubRoyalePointsSource === 'api' ? 'provider_reported' : 'estimated',
  }), [bookedCruises, casinoOffers, clubRoyalePoints, clubRoyalePointsSource, sessions]);
  const history = useMemo(() => buildOfferHistoryReport(casinoOffers, bookedCruises), [bookedCruises, casinoOffers]);
  const scoredOffers = useMemo(() => casinoOffers
    .filter((offer) => offer.status !== 'expired' && offer.status !== 'archived' && offer.archiveStatus !== 'archived')
    .map((offer) => ({ offer, score: calculateOfferIntelligenceScore(offer, [], certificates) }))
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, 5), [casinoOffers, certificates]);
  const attributionCounts = useMemo(() => history.records.reduce<Record<string, number>>((counts, record) => {
    counts[record.attribution] = (counts[record.attribution] ?? 0) + 1;
    return counts;
  }, {}), [history.records]);

  const tripRows = [...snapshot.trips].sort((a, b) => b.sailDate.localeCompare(a.sailDate));
  const optimizer = bundle?.currentRecommendation;
  const ownerId = currentUser?.id || authenticatedEmail || 'local-default';
  const lifecycle = useMemo(() => buildRelationshipGraph({
    bookedCruises: bookedCruises as unknown as Record<string, unknown>[],
    certificates: searchableCertificates as unknown as Record<string, unknown>[],
    offers: casinoOffers as unknown as Record<string, unknown>[],
    availableCruises,
    casinoSessions: sessions as unknown as Record<string, unknown>[],
    loyaltyRecords: [
      { id: 'club-royale', program: 'Club Royale', tier: loyalty.clubRoyaleTier, points: loyalty.clubRoyalePoints, pointsSource: loyalty.clubRoyalePointsSource },
      { id: 'crown-anchor', program: 'Crown & Anchor', tier: loyalty.crownAnchorLevel, points: loyalty.crownAnchorPoints, pointsSource: loyalty.extendedLoyalty?.crownAndAnchorPoints != null ? 'provider' : 'calculated' },
      { id: 'blue-chip', program: 'Blue Chip Club', tier: loyalty.blueChip.tier, points: loyalty.blueChip.points, pointsSource: 'saved loyalty profile' },
    ],
    activeOwnerId: ownerId,
    includeUnassignedPrivate: currentUser?.isOwner !== false,
  }), [availableCruises, bookedCruises, casinoOffers, currentUser?.isOwner, loyalty.blueChip.points, loyalty.blueChip.tier, loyalty.clubRoyalePoints, loyalty.clubRoyalePointsSource, loyalty.clubRoyaleTier, loyalty.crownAnchorLevel, loyalty.crownAnchorPoints, loyalty.extendedLoyalty?.crownAndAnchorPoints, ownerId, searchableCertificates, sessions]);

  return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><ArrowLeft size={20} color={C.gold} /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.title}>Casino Relationship Intelligence</Text><Text style={styles.subtitle}>Transparent evidence, economics, and offer response</Text></View><Sparkles size={20} color={C.gold} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <TabIdentityBand tab="casino" compact detail={`${lifecycle.completed.toLocaleString()} earning cruises · ${lifecycle.bookings.toLocaleString()} owner bookings`} testID="casino-relationship-story-card" />
      <View style={styles.hero}><Text style={styles.eyebrow}>WHAT AM I WORTH?</Text><Text style={styles.heroValue}>{money(snapshot.playerWorth.relationshipValueProxy)}</Text><Text style={styles.heroBody}>Transparent relationship-value proxy across theo, captured cruise value, and unique offer instances.</Text><Evidence metric={snapshot.playerWorth.relationshipValueProxy} /></View>
      <View style={styles.notice}><ShieldAlert size={18} color="#FBBF24" /><Text style={styles.noticeText}>{snapshot.playerWorth.warning}</Text></View>

      <Section title="Hourly win/loss & points pace" icon={<Gauge size={18} color={C.gold} />}>
        <MetricRow label="Portfolio win/loss per hour" value={money(snapshot.portfolioHourlyWinLoss)} metric={snapshot.portfolioHourlyWinLoss} />
        <MetricRow label="Current Club Royale points" value={number(snapshot.pointsPace.currentPoints)} metric={snapshot.pointsPace.currentPoints} />
        <MetricRow label="Historical points per cruise" value={number(snapshot.pointsPace.historicalPointsPerCruise)} metric={snapshot.pointsPace.historicalPointsPerCruise} />
        <MetricRow label="Historical points per night" value={number(snapshot.pointsPace.historicalPointsPerNight)} metric={snapshot.pointsPace.historicalPointsPerNight} />
        <MetricRow label="Booked-cruise projection" value={number(snapshot.pointsPace.projectedSeasonPoints)} metric={snapshot.pointsPace.projectedSeasonPoints} />
        <Text style={styles.body}>{snapshot.pointsPace.nextTier ? `${snapshot.pointsPace.pointsToNextTier.toLocaleString()} points to ${snapshot.pointsPace.nextTier}. Across ${snapshot.pointsPace.futureCruises} booked future cruise(s), the arithmetic pace is ${number(snapshot.pointsPace.requiredPointsPerFutureCruise)} per cruise.` : 'Masters threshold is already reached for this points balance.'}</Text>
      </Section>

      <Section title="Tier progress simulator" icon={<TrendingUp size={18} color={C.gold} />}>
        {snapshot.tierSimulation.map((row) => <View key={row.additionalCruises} style={styles.simRow}><View><Text style={styles.rowLabel}>{row.label}</Text><Text style={styles.muted}>{row.source.replaceAll('_', ' ')} scenario</Text></View><View style={styles.right}><Text style={styles.rowValue}>{row.projectedPoints.toLocaleString()}</Text><Text style={styles.tier}>{row.projectedTier}</Text></View></View>)}
        <Text style={styles.caution}>Scenario only. Tier math never overrides a bankroll or loss limit.</Text>
      </Section>

      <Section title="Certificate threshold economics" icon={<Target size={18} color={C.gold} />}>
        {optimizer ? <><Text style={styles.large}>{optimizer.actionLabel}</Text><Text style={styles.body}>{optimizer.currentPoints.toLocaleString()} current points · target {optimizer.recommendedTargetPoints?.toLocaleString() ?? 'stop at current certificate'}</Text><MetricRow label="Expected additional loss" value={`$${Math.round(optimizer.expectedAdditionalLoss).toLocaleString()}`} metric={{ value: optimizer.expectedAdditionalLoss, source: 'estimated', formula: 'saved optimizer recommendation model', explanation: 'Personal optimizer output with its saved assumptions and safety gates.' }} /><Text style={styles.caution}>“Keep playing” is never automatic. EasySeas exposes marginal value and expected loss, then honors the optimizer’s safety gates.</Text></> : <Text style={styles.body}>No saved profile-scoped optimizer snapshot exists. Start a tracked casino session or open the Personal Gambling Profile to build one.</Text>}
        <TouchableOpacity style={styles.link} onPress={() => bundle?.liveState ? router.push({ pathname: '/casino/live-certificate-advisor' as any, params: { ownerProfileId: bundle.ownerProfileId, cruiseId: bundle.liveState.cruiseId } }) : router.push('/casino/personal-gambling-profile' as any)}><Text style={styles.linkText}>{bundle?.liveState ? 'Open full threshold calculation' : 'Set up personal optimizer'}</Text><ChevronRight size={16} color={C.gold} /></TouchableOpacity>
      </Section>

      <Section title="Casino trip reports" icon={<Sparkles size={18} color={C.gold} />}>
        {tripRows.length === 0 ? <Text style={styles.body}>No booked or completed cruise records are available.</Text> : tripRows.map((trip) => <TouchableOpacity key={trip.cruiseId} style={styles.trip} onPress={() => setExpandedTripId(expandedTripId === trip.cruiseId ? null : trip.cruiseId)} activeOpacity={0.8}><View style={styles.tripHead}><View style={styles.flex}><Text style={styles.large}>{trip.ship}</Text><Text style={styles.muted}>{trip.sailDate} · {trip.nights} nights · {trip.sessionCount} session(s)</Text></View><ChevronRight size={18} color={C.gold} /></View><View style={styles.tripMetrics}><Mini label="Cash" value={money(trip.cashResult)} /><Mini label="Hourly" value={money(trip.hourlyWinLoss)} /><Mini label="Points" value={number(trip.points)} /></View>{expandedTripId === trip.cruiseId ? <View style={styles.expanded}><MetricRow label="Actual vs theoretical" value={percent(trip.actualVsTheoretical)} metric={trip.actualVsTheoretical} /><MetricRow label="Comp reinvestment" value={percent(trip.compReinvestmentPercent)} metric={trip.compReinvestmentPercent} /><MetricRow label="FreePlay outcome proxy" value={percent(trip.freePlayOutcomeProxy)} metric={trip.freePlayOutcomeProxy} /><MetricRow label="True cruise casino ROI" value={percent(trip.trueCruiseCasinoRoi)} metric={trip.trueCruiseCasinoRoi} /><MetricRow label="Casino cost per night" value={money(trip.casinoCostPerNight)} metric={trip.casinoCostPerNight} /></View> : null}</TouchableOpacity>)}
      </Section>

      <Section title="Historical offer response" icon={<TrendingUp size={18} color={C.gold} />}>
        {snapshot.offerResponse.map((band) => <View key={band.key} style={styles.band}><Text style={styles.rowLabel}>{band.label}</Text><Text style={styles.rowValue}>{band.subsequentOfferInstances} later offer instance(s) · {band.averageSubsequentOfferValue == null ? 'value unavailable' : `$${Math.round(band.averageSubsequentOfferValue).toLocaleString()} avg`}</Text><Text style={styles.muted}>{band.explanation}</Text></View>)}
      </Section>

      <Section title="Offer value, use & attribution" icon={<Target size={18} color={C.gold} />}>
        <View style={styles.tripMetrics}><Mini label="Instances" value={history.totalInstances.toLocaleString()} /><Mini label="Redeemed" value={history.redeemed.toLocaleString()} /><Mini label="Captured" value={`$${Math.round(history.capturedValue).toLocaleString()}`} /></View>
        <Text style={styles.body}>Earned-vs-redeemed view: {history.redeemed} of {history.totalInstances} saved offer instances are booked/used. Capture rate is {history.captureRate == null ? 'unavailable' : `${history.captureRate}%`}.</Text>
        <Text style={styles.body}>Attribution evidence: {attributionCounts['provider-instance'] ?? 0} provider-instance · {attributionCounts['explicit-cruise'] ?? 0} explicit cruise · {attributionCounts['unique-code'] ?? 0} unique-code · {attributionCounts.none ?? 0} unlinked.</Text>
        <Text style={styles.caution}>Shared marketing codes are never collapsed or guessed. Only provider instance IDs, explicit cruise links, or genuinely unique codes can attribute redemption.</Text>
        {scoredOffers.map(({ offer, score }) => <TouchableOpacity key={offer.id} style={styles.offer} onPress={() => router.push({ pathname: '/offer-details' as any, params: { offerId: offer.id } })}><View style={styles.flex}><Text style={styles.rowLabel}>{offer.offerCode || offer.title}</Text><Text numberOfLines={2} style={styles.muted}>{score.explanation}</Text></View><Text style={styles.score}>{score.score}</Text></TouchableOpacity>)}
      </Section>

      <Section title="Casino relationship lifecycle" icon={<Network size={18} color={C.gold} />}>
        <View style={styles.tripMetrics}><Mini label="Earning cruises" value={lifecycle.completed.toLocaleString()} /><Mini label="Eligible sailings" value={lifecycle.eligibleSailings.toLocaleString()} /><Mini label="Bookings" value={lifecycle.bookings.toLocaleString()} /></View>
        <Text style={styles.body}>One deduplicated evidence chain follows play and points → certificate → offer → eligible sailing → this profile’s booking → recorded realized value.</Text>
        <Text style={styles.body}>{lifecycle.unresolved.toLocaleString()} unresolved link{lifecycle.unresolved === 1 ? '' : 's'} remain visible for review. Missing or ambiguous evidence is never silently joined, and shared marketing codes never collapse distinct provider offer instances.</Text>
        <Text style={styles.body}>Recorded realized value: ${Math.round(lifecycle.realized).toLocaleString()}.</Text>
        <TouchableOpacity style={styles.link} onPress={() => router.push('/relationship-explorer' as any)} testID="casino-lifecycle-open-relationship-explorer"><Text style={styles.linkText}>Open lifecycle evidence map</Text><ChevronRight size={16} color={C.gold} /></TouchableOpacity>
      </Section>

      <Section title="Easy Seas Casino Intelligence" icon={<Bot size={18} color={C.gold} />}>
        <Text style={styles.body}>Ask one agent about hourly results, tier pace, certificate thresholds, offer value, redemptions, attribution, or the cruise behind a tier reward. Answers use saved local data and cite their source records.</Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/ask-my-data' as any)} testID="relationship-intelligence-ask-agent"><Bot size={17} color={C.deepNavy} /><Text style={styles.primaryText}>Agent SEA</Text></TouchableOpacity>
      </Section>
    </ScrollView>
  </SafeAreaView></View>;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const emojiByTitle: Record<string, string> = {
    'Hourly win/loss & points pace': '⏱️',
    'Tier progress simulator': '👑',
    'Certificate threshold economics': '🎟️',
    'Casino trip reports': '🚢',
    'Historical offer response': '📈',
    'Offer value, use & attribution': '💎',
    'Casino relationship lifecycle': '🔗',
    'Easy Seas Casino Intelligence': '🤖',
  };
  void icon;
  return <View style={styles.section}>
    <ThemedSectionHeader tab="casino" emoji={emojiByTitle[title] || '🎰'} title={title} tone="casino" compact />
    <View style={styles.sectionBody}>{children}</View>
  </View>;
}
function Evidence({ metric }: { metric: EvidenceMetric }) { return <View style={styles.evidence}><Text style={styles.evidenceSource}>{sourceLabel(metric.source)}</Text><Text style={styles.evidenceText}>{metric.formula}</Text></View>; }
function MetricRow({ label, value, metric }: { label: string; value: string; metric: EvidenceMetric }) { return <View style={styles.metric}><View style={styles.flex}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.muted}>{metric.explanation}</Text><Evidence metric={metric} /></View><Text style={styles.metricValue}>{value}</Text></View>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.background},safe:{flex:1},header:{flexDirection:'row',alignItems:'center',gap:10,padding:16,borderBottomWidth:1,borderColor:C.border},back:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.08)'},headerCopy:{flex:1},title:{color:C.textPrimary,fontSize:18,fontWeight:'900'},subtitle:{color:C.mutedText,fontSize:11,marginTop:2},content:{padding:14,paddingBottom:80},hero:{backgroundColor:C.cardAlt,borderRadius:18,borderWidth:1,borderColor:C.borderStrong,padding:18,marginBottom:10},eyebrow:{color:C.gold,fontSize:11,fontWeight:'900',letterSpacing:1.2},heroValue:{color:C.textPrimary,fontSize:34,fontWeight:'900',marginTop:6},heroBody:{color:C.textSecondary,lineHeight:19,marginTop:5},notice:{flexDirection:'row',gap:9,backgroundColor:'rgba(245,158,11,.1)',borderWidth:1,borderColor:'rgba(245,158,11,.3)',borderRadius:13,padding:12,marginBottom:10},noticeText:{color:'#FDE68A',fontSize:11,lineHeight:16,flex:1},section:{backgroundColor:C.card,borderRadius:16,borderWidth:1,borderColor:C.border,padding:14,marginBottom:12},sectionTitle:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12},sectionTitleText:{color:C.textPrimary,fontSize:16,fontWeight:'900'},sectionBody:{paddingTop:12},metric:{flexDirection:'row',gap:10,borderTopWidth:1,borderTopColor:C.border,paddingVertical:11,alignItems:'flex-start'},flex:{flex:1},rowLabel:{color:C.textSecondary,fontSize:12,fontWeight:'800'},rowValue:{color:C.textPrimary,fontSize:13,fontWeight:'900',marginTop:3},metricValue:{color:C.textPrimary,fontSize:17,fontWeight:'900',textAlign:'right',maxWidth:120},muted:{color:C.mutedText,fontSize:10,lineHeight:14,marginTop:3},evidence:{flexDirection:'row',alignItems:'center',gap:5,marginTop:5,flexWrap:'wrap'},evidenceSource:{color:C.deepNavy,backgroundColor:C.gold,paddingHorizontal:6,paddingVertical:2,borderRadius:999,fontSize:8,fontWeight:'900',textTransform:'uppercase'},evidenceText:{color:C.mutedText,fontSize:9,flexShrink:1},body:{color:C.textSecondary,fontSize:12,lineHeight:18,marginVertical:6},large:{color:C.textPrimary,fontSize:16,fontWeight:'900'},caution:{color:'#FDE68A',fontSize:10,lineHeight:15,marginTop:8},simRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:9,borderTopWidth:1,borderTopColor:C.border},right:{alignItems:'flex-end'},tier:{color:C.gold,fontSize:10,fontWeight:'900',marginTop:2},link:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12,marginTop:6},linkText:{color:C.gold,fontWeight:'900'},trip:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:12},tripHead:{flexDirection:'row',alignItems:'center'},tripMetrics:{flexDirection:'row',gap:7,marginTop:9},mini:{flex:1,backgroundColor:C.cardAlt,borderRadius:10,padding:8},miniLabel:{color:C.mutedText,fontSize:8,textTransform:'uppercase',fontWeight:'900'},miniValue:{color:C.textPrimary,fontSize:12,fontWeight:'900',marginTop:3},expanded:{marginTop:8},band:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:10},offer:{flexDirection:'row',gap:12,alignItems:'center',borderTopWidth:1,borderTopColor:C.border,paddingVertical:10},score:{color:C.deepNavy,backgroundColor:C.gold,width:42,height:42,borderRadius:21,textAlign:'center',textAlignVertical:'center',fontSize:16,fontWeight:'900',paddingTop:10},primary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.gold,borderRadius:12,padding:13,marginTop:10},primaryText:{color:C.deepNavy,fontWeight:'900'},
});
