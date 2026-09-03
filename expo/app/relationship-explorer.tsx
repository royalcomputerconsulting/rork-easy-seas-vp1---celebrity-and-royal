import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Link2, Network } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/state/UserProvider';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';
import { InteractiveRelationshipMap, type MapEdge } from '@/components/ui/InteractiveRelationshipMap';
import { ProgressiveDisclosure } from '@/components/ui/ProgressiveDisclosure';
import { buildRelationshipGraph } from '@/lib/relationships/relationshipGraph';
import { useExperience } from '@/state/ExperienceProvider';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';

export default function RelationshipExplorer() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { authenticatedEmail } = useAuth();
  const core = useCoreData();
  const { searchableCertificates } = useCertificates();
  const { sessions } = useCasinoSessions();
  const loyalty = useLoyalty();
  const { colors, textScale, minimumControlSize } = useExperience();
  const ownerId = currentUser?.id || authenticatedEmail || 'local-default';
  const correctionKey = `@easyseas/relationshipCorrections/v1::${String(ownerId).toLowerCase()}`;
  const [corrections, setCorrections] = useState<Record<string, 'confirm' | 'reject'>>({});
  const [availableCruises, setAvailableCruises] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(correctionKey).then((raw) => {
      try { setCorrections(raw ? JSON.parse(raw) : {}); } catch { setCorrections({}); }
    });
  }, [correctionKey]);

  useEffect(() => {
    let active = true;
    void core.getAllCruises().then((rows) => {
      if (active) setAvailableCruises(rows as unknown as Record<string, unknown>[]);
    });
    return () => { active = false; };
  }, [core.getAllCruises]);

  const graph = useMemo(() => buildRelationshipGraph({
    bookedCruises: core.bookedCruises as unknown as Record<string, unknown>[],
    certificates: searchableCertificates as unknown as Record<string, unknown>[],
    offers: core.casinoOffers as unknown as Record<string, unknown>[],
    availableCruises,
    casinoSessions: sessions as unknown as Record<string, unknown>[],
    loyaltyRecords: [
      { id: 'club-royale', program: 'Club Royale', tier: loyalty.clubRoyaleTier, points: loyalty.clubRoyalePoints, pointsSource: loyalty.clubRoyalePointsSource },
      { id: 'crown-anchor', program: 'Crown & Anchor', tier: loyalty.crownAnchorLevel, points: loyalty.crownAnchorPoints, pointsSource: loyalty.extendedLoyalty?.crownAndAnchorPoints != null ? 'provider' : 'calculated' },
      { id: 'blue-chip', program: 'Blue Chip Club', tier: loyalty.blueChip.tier, points: loyalty.blueChip.points, pointsSource: 'saved loyalty profile' },
    ],
    corrections,
    activeOwnerId: ownerId,
    includeUnassignedPrivate: currentUser?.isOwner !== false,
  }), [availableCruises, core.bookedCruises, core.casinoOffers, corrections, currentUser?.isOwner, loyalty.blueChip.points, loyalty.blueChip.tier, loyalty.clubRoyalePoints, loyalty.clubRoyalePointsSource, loyalty.clubRoyaleTier, loyalty.crownAnchorLevel, loyalty.crownAnchorPoints, loyalty.extendedLoyalty?.crownAndAnchorPoints, ownerId, searchableCertificates, sessions]);
  const routedNodes = useMemo(() => graph.nodes.map((node) => node.routePath ? {
    ...node,
    route: () => router.push(node.routePath as never),
  } : node), [graph.nodes, router]);

  const review = (edge: MapEdge, decision: 'confirm' | 'reject') => {
    const next = { ...corrections, [edge.id]: decision };
    setCorrections(next);
    void AsyncStorage.setItem(correctionKey, JSON.stringify(next));
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
    <Stack.Screen options={{ headerShown: false }}/>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back" style={[styles.back, { minWidth: minimumControlSize, minHeight: minimumControlSize }]}><ArrowLeft color={T.color.deepNavy}/></TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>Money · points · certificates · value</Text>
        <Text style={[styles.title, { fontSize: 22 * textScale }]}>Relationship explorer</Text>
      </View>
      <Network color="#4EC0A5"/>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <TabIdentityBand tab="casino" compact detail={`${graph.unresolved.toLocaleString()} unresolved relationship${graph.unresolved === 1 ? '' : 's'}`} testID="relationship-explorer-story-card" />
      <ProgressiveDisclosure
        ownerId={ownerId}
        screenId="relationship-explorer"
        sectionId="summary"
        title="Three conclusions"
        conclusions={[
          { id: 'cruises', label: 'Earning cruises', value: String(graph.completed), status: graph.completed ? 'success' : 'missing' },
          { id: 'certs', label: 'Certificates', value: String(graph.certificates), status: graph.certificates ? 'info' : 'missing' },
          { id: 'realized', label: 'Recorded realized value', value: `$${graph.realized.toLocaleString()}`, status: graph.realized ? 'success' : 'estimated' },
        ]}
      >
        <Text style={[styles.copy, { color: colors.muted, fontSize: 13 * textScale }]}>The graph follows earning cruise → casino points → certificate → offer → eligible sailing → owner booking → realized value. Exact links use saved identifiers, codes, ship, and date. Inferred and estimated links remain labeled; {graph.unresolved} unresolved link{graph.unresolved === 1 ? '' : 's'} remain visible instead of being silently connected. {graph.corrections} review decision{graph.corrections === 1 ? '' : 's'} are saved only for this profile.</Text>
        <Text style={[styles.copy, { color: colors.muted, fontSize: 13 * textScale }]}>{graph.eligibleSailings.toLocaleString()} eligible sailing{graph.eligibleSailings === 1 ? '' : 's'} and {graph.bookings.toLocaleString()} owner booking{graph.bookings === 1 ? '' : 's'} are represented. {graph.truncated > 0 ? `${graph.truncated.toLocaleString()} lower-priority source records were omitted from this bounded graph; source data remains unchanged.` : 'No source records were omitted by the graph safety bound.'}</Text>
      </ProgressiveDisclosure>
      <TouchableOpacity style={[styles.reviewLinksButton, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/casino/certificate-link-review')} accessibilityRole="button" accessibilityLabel="Review certificate earning-cruise links">
        <Link2 size={18} color={colors.accent} />
        <View style={{ flex: 1 }}><Text style={[styles.reviewLinksTitle, { color: colors.text, fontSize: 14 * textScale }]}>Review certificate earning links</Text><Text style={[styles.reviewLinksText, { color: colors.muted, fontSize: 11 * textScale }]}>Confirm or correct issue-date suggestions before they become exact evidence.</Text></View>
      </TouchableOpacity>
      <ThemedSectionHeader
        tab="casino"
        emoji="🕸️"
        title="Interactive evidence map"
        subtitle="Inspect exact, inferred, rejected, and unresolved links without changing source records."
        tone="casino"
        compact
        testID="relationship-explorer-map-section"
      />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <InteractiveRelationshipMap nodes={routedNodes} edges={graph.edges} onReviewEdge={review}/>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.color.background },
  header: { backgroundColor: T.color.surface, padding: T.space.lg, flexDirection: 'row', alignItems: 'center', gap: T.space.md, borderBottomWidth: 1, borderBottomColor: T.color.border },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  eyebrow: { color: '#0E7FA7', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: T.color.deepNavy, fontSize: 22, fontWeight: '900' },
  content: { padding: T.space.lg, paddingBottom: 50 },
  card: { backgroundColor: T.color.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.color.border, padding: T.space.md },
  copy: { color: T.color.muted, lineHeight: 20 },
  reviewLinksButton: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm, borderWidth: 1, borderRadius: T.radius.md, padding: T.space.md, marginBottom: T.space.md },
  reviewLinksTitle: { fontWeight: '900' },
  reviewLinksText: { lineHeight: 16, marginTop: 2 },
});
