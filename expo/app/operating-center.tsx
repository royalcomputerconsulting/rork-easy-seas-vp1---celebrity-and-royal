import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Bell, Bookmark, Bot, ChevronRight, Search, Star } from 'lucide-react-native';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';

type Capability = {
  id: number;
  title: string;
  detail: string;
  route: string;
  group: 'Everyday' | 'Casino' | 'Travel' | 'Experience' | 'Trust';
};

const STORAGE_KEY = '@easyseas/operatingCenterPreferences/v1';

const CAPABILITIES: Capability[] = [
  { id: 1, title: 'Personalized Today command center', detail: 'The next trips, expiring value, missing results, and highest-value actions in one place.', route: '/productivity-center?item=1', group: 'Everyday' },
  { id: 2, title: 'Universal search', detail: 'Search trips, offers, ships, certificates, hosts, and saved casino evidence.', route: '/productivity-center?item=2', group: 'Everyday' },
  { id: 3, title: 'Cross-record relationship explorer', detail: 'Follow cruise → points → certificate → redeemed booking → actual value.', route: '/productivity-center?item=3', group: 'Everyday' },
  { id: 4, title: 'Action inbox', detail: 'Review expiring certificates, unallocated points, incomplete closeouts, and follow-ups.', route: '/productivity-center?item=4', group: 'Everyday' },
  { id: 5, title: 'Configurable home screen', detail: 'Star the tools you use most; favorites stay at the top for this user.', route: '/productivity-center?item=5', group: 'Everyday' },
  { id: 6, title: 'Saved searches and watchlists', detail: 'Save ships, offers, and questions you want to revisit.', route: '/productivity-center?item=6', group: 'Everyday' },
  { id: 7, title: 'Compare-anything workspace', detail: 'Use Agent SEA to compare offers, sailings, ships, cabins, or casino outcomes.', route: '/productivity-center?item=7', group: 'Everyday' },
  { id: 8, title: 'Unified trip timeline', detail: 'See booking, payment, sailing, casino result, certificate, and recognition events together.', route: '/productivity-center?item=8', group: 'Everyday' },
  { id: 9, title: 'Contextual quick actions', detail: 'Jump directly to the correct edit, closeout, certificate, weather, or planning workflow.', route: '/productivity-center?item=9', group: 'Everyday' },
  { id: 10, title: 'Explain this casino screen', detail: 'Definitions, formulas, sources, confidence, and contributing cruise records.', route: '/productivity-center?item=10', group: 'Casino' },
  { id: 11, title: 'Casino relationship lifecycle', detail: 'Connect play, host contact, offer, certificate, redemption, and realized value.', route: '/casino/relationship-intelligence', group: 'Casino' },
  { id: 12, title: 'Host portfolio view', detail: 'Host-ready view of play value, tier pace, trips, and follow-up opportunities.', route: '/casino/host-meeting-brief', group: 'Casino' },
  { id: 13, title: 'Host promise fulfillment ledger', detail: 'Track promises, dates, outcomes, and unresolved follow-ups.', route: '/casino/host-crm', group: 'Casino' },
  { id: 14, title: 'Offer-response curve', detail: 'Compare historical points and theo with certificate level and future choices.', route: '/casino/relationship-intelligence', group: 'Casino' },
  { id: 15, title: 'Marginal certificate value', detail: 'Measure the additional usable cruise value gained at the next point threshold.', route: '/casino/live-certificate-advisor', group: 'Casino' },
  { id: 16, title: 'Casino-hours opportunity model', detail: 'Estimate available casino hours from each itinerary and port schedule.', route: '/casino/current-trip-comp-pace', group: 'Casino' },
  { id: 17, title: 'Personal play-pattern model', detail: 'Use cruise points and open hours to model your play pace without requiring sessions.', route: '/casino/personal-gambling-profile', group: 'Casino' },
  { id: 18, title: 'Machine performance journal', detail: 'Record ship, machine, location, condition, points, and outcome observations.', route: '/verified-machine-atlas', group: 'Casino' },
  { id: 19, title: 'Bankroll risk-of-ruin simulator', detail: 'Model bankroll durability using configurable volatility, pace, and stop limits.', route: '/casino/simulator', group: 'Casino' },
  { id: 20, title: 'Trip stop / continue panel', detail: 'Make an evidence-based continue, slow-down, or stop decision onboard.', route: '/casino/onboard-mode', group: 'Casino' },
  { id: 21, title: 'FreePlay conversion analysis', detail: 'Track issued FreePlay, converted cash, effective rate, and trip value.', route: '/casino/benefits-ledger', group: 'Casino' },
  { id: 22, title: 'Actual versus theoretical', detail: 'Compare recorded cash results to expected theoretical loss with source labels.', route: '/casino/value-scenarios', group: 'Casino' },
  { id: 23, title: 'Casino availability heatmap', detail: 'Show casino-open opportunities across sea days, port days, and consecutive trips.', route: '/casino/ship-performance', group: 'Casino' },
  { id: 24, title: 'Certificate production forecast', detail: 'Forecast likely certificate thresholds from confirmed pace and upcoming casino hours.', route: '/casino/live-certificate-advisor', group: 'Casino' },
  { id: 25, title: 'Host-ready player résumé', detail: 'Generate a concise, source-labeled relationship summary for a host conversation.', route: '/casino/export-report', group: 'Casino' },
  { id: 26, title: 'True offer value normalization', detail: 'Compare face, expected, and personally usable offer value without summing mutually exclusive sailings.', route: '/offer-details', group: 'Travel' },
  { id: 27, title: 'Best-use certificate optimizer', detail: 'Rank practical certificate uses with hard exclusions and explainable personal preferences.', route: '/certificate-portfolio', group: 'Travel' },
  { id: 28, title: 'Certificate substitution analysis', detail: 'Compare exact inventory between adjacent certificate point levels.', route: '/certificate-substitution', group: 'Travel' },
  { id: 29, title: 'Offer inventory change history', detail: 'Audit compact additions, removals, benefit changes, and provider run evidence.', route: '/sync-change-history', group: 'Travel' },
  { id: 30, title: 'What-disappeared sync report', detail: 'See added, changed, removed, rejected, and safely preserved rows after every complete sync.', route: '/sync-change-history', group: 'Travel' },
  { id: 31, title: 'Fare and upgrade history', detail: 'Reconstruct final booking cost from immutable financial events and invoice evidence.', route: '/travel-intelligence?item=31', group: 'Travel' },
  { id: 32, title: 'Cabin intelligence', detail: 'Score cabins from evidence, preferences, favorites, and avoid signals.', route: '/travel-intelligence?item=32', group: 'Travel' },
  { id: 33, title: 'Expanded back-to-back optimization', detail: 'Plan terminals, transfers, hotels, luggage, laundry, cost, and cabin continuity.', route: '/travel-intelligence?item=33', group: 'Travel' },
  { id: 34, title: 'Travel-cost-aware ranking', detail: 'Rank cruise value after the complete cost of taking the trip.', route: '/travel-intelligence?item=34', group: 'Travel' },
  { id: 35, title: 'Port-day personal planner', detail: 'Build safe, weather-aware port plans with ship-time return buffers.', route: '/travel-intelligence?item=35', group: 'Travel' },
  { id: 36, title: 'Dynamic voyage map', detail: 'See itinerary, route uncertainty, weather points, marine zones, and nearby buoys.', route: '/travel-intelligence?item=36', group: 'Travel' },
  { id: 37, title: 'Cruise disruption workspace', detail: 'Coordinate changes across plans affected by an itinerary update.', route: '/travel-intelligence?item=37', group: 'Travel' },
  { id: 38, title: 'Travel-document rules', detail: 'Track traveler-specific requirements with official links and freshness.', route: '/travel-intelligence?item=38', group: 'Travel' },
  { id: 39, title: 'Cruise memory and review', detail: 'Turn owner-scoped cruise memories into better future recommendations.', route: '/travel-intelligence?item=39', group: 'Travel' },
  { id: 40, title: 'Group-travel coordination', detail: 'Coordinate reservations and schedules without merging private profiles.', route: '/travel-intelligence?item=40', group: 'Travel' },
  { id: 41, title: 'Unified design system', detail: 'Shared tier colors, typography, spacing, controls, cards, and state patterns.', route: '/experience-settings', group: 'Experience' },
  { id: 42, title: 'Progressive disclosure', detail: 'Conclusions first, persisted details second, with deferred expensive content.', route: '/experience-settings', group: 'Experience' },
  { id: 43, title: 'Relationship visualizations', detail: 'Interactive evidence flows with uncertainty and accessible list alternatives.', route: '/experience-settings', group: 'Experience' },
  { id: 44, title: 'Premium voyage artwork', detail: 'Responsive, cached imagery with lightweight owned fallbacks and no navigation blocking.', route: '/experience-settings', group: 'Experience' },
  { id: 45, title: 'Purposeful micro-interactions', detail: 'Short, interruptible state feedback that respects reduced motion.', route: '/experience-settings', group: 'Experience' },
  { id: 46, title: 'Accessibility mode', detail: 'Large controls, dynamic text, non-color labels, safe palettes, and simplified density.', route: '/experience-settings', group: 'Experience' },
  { id: 47, title: 'Universal data provenance', detail: 'Show source, timestamp, owner, confidence, source record, and formula for important values.', route: '/data-trust-center', group: 'Trust' },
  { id: 48, title: 'Versioned local database', detail: 'Transactional SQLite migrations, owner indexes, checkpoints, and diagnostics with no backend.', route: '/data-trust-center', group: 'Trust' },
  { id: 49, title: 'Integrity & reconciliation center', detail: 'Detect duplicates, broken links, malformed dates, stale loyalty, inconsistent totals, and owner leakage.', route: '/data-trust-center', group: 'Trust' },
  { id: 50, title: 'Incremental encrypted backup', detail: 'Versioned encrypted snapshots with progress, restore preview, conflict protection, and recovery credentials.', route: '/data-trust-center', group: 'Trust' },
];

const money = (value: number) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function OperatingCenter() {
  const router = useRouter();
  const { casinoOffers, bookedCruises } = useCoreData();
  const { searchableCertificates } = useCertificates();
  const { cruiseEconomicsSummary } = useCasinoEconomicsData();
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try { setFavorites(JSON.parse(raw)?.favorites ?? []); } catch { /* keep safe defaults */ }
    }).catch(() => undefined);
  }, []);

  const toggleFavorite = (id: number) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ favorites: next }));
      return next;
    });
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CAPABILITIES
      .filter((item) => !needle || `${item.title} ${item.detail} ${item.group}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.id - b.id);
  }, [favorites, query]);

  const totals = cruiseEconomicsSummary.totals;
  const incomplete = bookedCruises.filter((cruise) => {
    const record = cruise as unknown as Record<string, unknown>;
    return String(cruise.status ?? '').toLowerCase() === 'completed'
      && !Number(record.casinoPointsEarned ?? record.pointsEarned ?? record.casinoPoints ?? 0);
  }).length;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back"><ArrowLeft color="#1C2F7A" /></TouchableOpacity>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>EASY SEAS</Text><Text style={styles.title}>Operating Center</Text></View>
      <TouchableOpacity onPress={() => router.push('/ask-my-data' as never)} accessibilityLabel="Open Agent SEA"><Bot color="#84e1cf" /></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.todayCard}>
        <View style={styles.row}><Text style={styles.sectionTitle}>Today</Text><Bell size={20} color="#f2bd4d" /></View>
        <Text style={styles.todayHeadline}>{incomplete ? `${incomplete} completed cruise result${incomplete === 1 ? '' : 's'} need review` : 'Your casino cruise ledger is current'}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{casinoOffers.length}</Text><Text style={styles.statLabel}>Offers</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{searchableCertificates.length}</Text><Text style={styles.statLabel}>Certificates</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{totals.totalPoints.toLocaleString()}</Text><Text style={styles.statLabel}>Annual points</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{money(totals.totalEconomicValue)}</Text><Text style={styles.statLabel}>Economic value</Text></View>
        </View>
      </View>

      <View style={styles.searchBox}><Search size={18} color="#52708b" /><TextInput value={query} onChangeText={setQuery} placeholder="Search Easy Seas tools" placeholderTextColor="#7890a5" style={styles.input} /></View>
      <Text style={styles.helper}>Starred tools stay first. Every casino result opens the existing source-labeled calculation or workflow.</Text>

      {visible.map((item) => <TouchableOpacity key={item.id} style={styles.card} onPress={() => router.push(item.route as never)} activeOpacity={0.8}>
        <View style={[styles.numberBadge, item.group === 'Casino' && styles.casinoBadge]}><Text style={styles.numberText}>{item.id}</Text></View>
        <View style={styles.cardCopy}><View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text>{item.group === 'Casino' ? <Text style={styles.casinoLabel}>CASINO</Text> : null}</View><Text style={styles.cardDetail}>{item.detail}</Text></View>
        <TouchableOpacity style={styles.starButton} onPress={(event) => { event.stopPropagation(); toggleFavorite(item.id); }} accessibilityLabel={`${favorites.includes(item.id) ? 'Remove' : 'Add'} favorite`}>
          {favorites.includes(item.id) ? <Star size={19} color="#d99c14" fill="#f4c85d" /> : <Bookmark size={19} color="#6d8294" />}
        </TouchableOpacity>
        <ChevronRight size={20} color="#7790a5" />
      </TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F3F2' }, header: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D5D5D0' }, headerCopy: { flex: 1, marginLeft: 14 }, eyebrow: { color: '#0E7FA7', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: '#1C2F7A', fontSize: 23, fontWeight: '900' }, content: { padding: 16, paddingBottom: 48 },
  todayCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D0', borderRadius: 18, padding: 17, marginBottom: 14 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: '#1C2F7A', fontSize: 19, fontWeight: '900' }, todayHeadline: { color: '#676A70', fontSize: 14, marginTop: 7 }, stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8 }, stat: { width: '48%', backgroundColor: '#F5F5F4', borderRadius: 12, padding: 10 }, statValue: { color: '#333334', fontWeight: '900', fontSize: 18 }, statLabel: { color: '#676A70', fontSize: 11, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#d5e1e8', paddingHorizontal: 13 }, input: { flex: 1, paddingVertical: 13, marginLeft: 9, color: '#12304b', fontSize: 15 }, helper: { color: '#557086', fontSize: 12, lineHeight: 17, marginVertical: 11 },
  card: { backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#dce7ed', padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center' }, numberBadge: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#dceef8', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, casinoBadge: { backgroundColor: '#d9f1eb' }, numberText: { color: '#0d355a', fontWeight: '900' }, cardCopy: { flex: 1 }, cardTitle: { color: '#102f4e', fontWeight: '900', fontSize: 14, flex: 1 }, cardDetail: { color: '#5b7184', fontSize: 12, lineHeight: 17, marginTop: 4 }, casinoLabel: { color: '#08776d', fontSize: 9, fontWeight: '900', marginLeft: 7 }, starButton: { padding: 7 },
});
