import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDollarSign, FileQuestion, Gauge, Sparkles, Users } from 'lucide-react-native';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { usePriceTracking } from '@/state/PriceTrackingProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { getOfferExpiryDate } from '@/lib/offerIntelligence';
import { getDaysUntil } from '@/lib/date';
import { rankNextBestActions, type RecommendationCandidate } from '@/lib/intelligence/nextBestAction';
import { buildTripCostLedger, calculateValueEfficiency, REQUIRED_TRIP_COST_CATEGORIES } from '@/lib/intelligence/tripCostLedger';
import { buildRecordEvidence, evidenceStatusLabel } from '@/lib/intelligence/dataConfidence';
import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import type { TripCostCategory, TripCostEntry } from '@/types/intelligence';

const C = { navy: '#061827', panel: '#0D2941', card: '#143955', gold: '#E2B440', teal: '#3BD1B7', white: '#FFFFFF', muted: '#B4C7D8', line: '#315673', red: '#FF746C', green: '#75E1A8' };
const categoryLabel = (category: TripCostCategory) => category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function IntelligenceCenterScreen() {
  const router = useRouter();
  const { authenticatedEmail } = useAuth();
  const { casinoOffers, bookedCruises } = useCoreData();
  const { searchableCertificates } = useCertificates();
  const { priceDrops } = usePriceTracking();
  const filters = useIntelligenceFilters();
  const { sessions } = useCasinoSessions();
  const [entries, setEntries] = useState<TripCostEntry[]>([]);
  const [editing, setEditing] = useState<TripCostCategory | null>(null);
  const [amountText, setAmountText] = useState('');
  const storageKey = useMemo(() => getUserScopedKey(ALL_STORAGE_KEYS.TRIP_COST_ENTRIES, authenticatedEmail), [authenticatedEmail]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => bookedCruises.filter((cruise) => cruise.returnDate >= today && cruise.status !== 'cancelled').sort((a, b) => a.sailDate.localeCompare(b.sailDate))[0], [bookedCruises, today]);
  const tripId = upcoming?.id ?? 'unassigned-trip';

  useEffect(() => { void quotaSafeGetJsonItem<TripCostEntry[]>(storageKey, [], Array.isArray).then(setEntries); }, [storageKey]);
  const ledger = useMemo(() => buildTripCostLedger(tripId, entries), [entries, tripId]);
  const vacationValue = Number(upcoming?.totalValue ?? upcoming?.compValue ?? upcoming?.retailValue ?? upcoming?.totalPrice ?? 0);
  const casinoHours = useMemo(() => sessions.filter((session) => session.cruiseId === tripId).reduce((sum, session) => sum + session.durationMinutes, 0) / 60, [sessions, tripId]);
  const efficiency = useMemo(() => calculateValueEfficiency({ totalVacationValue: vacationValue, ledger, vacationDays: upcoming?.nights ?? 1, casinoHours: casinoHours || null }), [casinoHours, ledger, upcoming?.nights, vacationValue]);

  const candidates = useMemo(() => {
    const values: RecommendationCandidate[] = [];
    casinoOffers.filter((offer) => offer.status === 'active' || !offer.status).forEach((offer) => {
      const expiry = getOfferExpiryDate(offer), days = expiry ? getDaysUntil(expiry) : null;
      if (days !== null && days >= 0 && days <= 45) { const evidence = buildRecordEvidence(offer, ['playerOfferId', 'offerExpiryDate', 'totalValue']); values.push({ id: `offer-${offer.id}`, type: 'book_expiring_offer', title: `Review expiring ${offer.offerCode || offer.title}`, explanation: `This saved offer expires in ${days} day${days === 1 ? '' : 's'}. Confirm the exact sailing, cabin, guest, and final cost before booking.`, route: '/(tabs)/(overview)', daysUntilDue: days, expectedBenefit: offer.totalValue ?? offer.offerValue ?? offer.value ?? 0, confidence: evidence.confidence, ownerProfileId: offer.ownerProfileId, brand: offer.brand, casinoProgram: offer.casinoProgram, evidence: evidence.evidence, missingData: evidence.missingData }); }
    });
    searchableCertificates.filter((certificate) => certificate.status === 'available').forEach((certificate) => { const days = certificate.expiryDate ? getDaysUntil(certificate.expiryDate) : null; if (days === null || days <= 60) values.push({ id: `cert-${certificate.id}`, type: 'redeem_certificate', title: `Review ${certificate.certificateCode || certificate.label}`, explanation: `${certificate.parsedSailings?.length ?? 0} saved eligible sailing rows are available for comparison.`, route: '/certificate-portfolio', daysUntilDue: days, expectedBenefit: certificate.value, confidence: certificate.parserStatus === 'parsed_successfully' ? 'high' : certificate.parsedSailings?.length ? 'medium' : 'low', missingData: [!certificate.expiryDate ? 'expiration date' : '', !certificate.parsedSailings?.length ? 'eligible sailings' : ''].filter(Boolean) }); });
    priceDrops.forEach((drop) => values.push({ id: `price-${drop.cruiseKey}`, type: 'review_price_drop', title: `Verify ${drop.shipName} price drop`, explanation: `A saved comparable is $${drop.priceDrop.toLocaleString()} lower. Confirm category, guest count, taxes, perks, and repricing rules.`, route: '/price-upgrade-monitor', daysUntilDue: 3, expectedBenefit: drop.priceDrop, confidence: 'medium', missingData: ['final-payment date', 'repricing eligibility'] }));
    if (ledger.missingCategories.length > 0) values.push({ id: `cost-${tripId}`, type: 'verify_missing_data', title: 'Finish the all-in trip cost', explanation: `${ledger.missingCategories.length} cost categories remain missing for ${upcoming?.shipName || 'the selected trip'}.`, route: '/intelligence-center', importance: 15, confidence: ledger.confidence, missingData: ledger.missingCategories.map(categoryLabel) });
    return values;
  }, [casinoOffers, ledger, priceDrops, searchableCertificates, tripId, upcoming?.shipName]);
  const actions = useMemo(() => rankNextBestActions(candidates), [candidates]);

  const saveAmount = async () => {
    if (!editing) return;
    const parsed = Number(amountText.replace(/[$,]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const now = new Date().toISOString(), id = `${tripId}:${editing}`;
    const next = [...entries.filter((entry) => entry.id !== id), { id, tripId, category: editing, label: categoryLabel(editing), amount: parsed, currency: 'USD', evidenceStatus: 'user_entered' as const, updatedAt: now }];
    setEntries(next); setEditing(null); setAmountText(''); await quotaSafeSetJsonItem(storageKey, next);
  };
  const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return <View style={s.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={s.safe} edges={['top']}>
    <View style={s.header}><TouchableOpacity style={s.round} onPress={() => router.back()}><ArrowLeft size={20} color={C.gold} /></TouchableOpacity><View style={s.flex}><Text style={s.title}>Next Best Action</Text><Text style={s.subtitle}>Explainable recommendations from saved local data</Text></View></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <IntelligenceFilterStrip contextLabel="Next Best Action" />
      <View style={s.scope}><Users size={18} color={C.teal} /><Text style={s.scopeText}>Scope stays attached: {filters.selectedProfileId === 'all' ? 'Household' : filters.selectedProfileId} · {filters.selectedBrand === 'all' ? 'All brands' : filters.selectedBrand} · {filters.selectedProgram === 'all' ? 'All programs' : filters.selectedProgram}</Text></View>
      <Text style={s.section}>TOP THREE ACTIONS RIGHT NOW</Text>
      {actions.length ? actions.map((action, index) => <View key={action.id} style={s.actionCard} testID={`next-best-action-${index + 1}`}><View style={s.actionTop}><View style={s.rank}><Text style={s.rankText}>{index + 1}</Text></View><View style={s.flex}><Text style={s.actionTitle}>{action.title}</Text><Text style={s.meta}>{action.urgency.toUpperCase()} · SCORE {action.score} · {action.confidence.toUpperCase()} CONFIDENCE</Text></View></View><Text style={s.copy}>{action.explanation}</Text>{action.missingData.length > 0 && <Text style={s.missing}>Could change this: {action.missingData.join(', ')}</Text>}<View style={s.actionButtons}><TouchableOpacity style={s.why} onPress={() => router.push({ pathname: '/ask-my-data', params: { prompt: `Explain why this is recommended: ${action.title}` } } as never)}><Text style={s.buttonText}>WHY?</Text></TouchableOpacity><TouchableOpacity style={s.why} onPress={() => router.push({ pathname: '/ask-my-data', params: { prompt: `What data is missing for this recommendation: ${action.title}? Current missing data: ${action.missingData.join(', ') || 'none shown'}` } } as never)}><Text style={s.buttonText}>MISSING?</Text></TouchableOpacity></View><View style={s.actionButtons}><TouchableOpacity style={s.why} onPress={() => router.push({ pathname: '/ask-my-data', params: { prompt: `Compare alternatives to this recommendation: ${action.title}` } } as never)}><Text style={s.buttonText}>COMPARE</Text></TouchableOpacity><TouchableOpacity style={s.do} onPress={() => router.push(action.route as never)}><Text style={s.doText}>DO THIS</Text><ArrowRight size={16} color={C.navy} /></TouchableOpacity></View></View>) : <View style={s.empty}><CheckCircle2 size={24} color={C.green} /><Text style={s.copy}>No urgent action has enough saved evidence. Add missing costs or refresh an existing offer/certificate source.</Text></View>}

      <Text style={s.section}>TRUE ALL-IN TRIP COST</Text><View style={s.panel}><Text style={s.panelTitle}>{upcoming ? `${upcoming.shipName} · ${upcoming.sailDate}` : 'Unassigned future trip'}</Text><View style={s.metricRow}><View><Text style={s.metricLabel}>EXPECTED COST</Text><Text style={s.metricValue}>{money(ledger.expectedTotal)}</Text></View><View><Text style={s.metricLabel}>ESTIMATED</Text><Text style={s.metricValue}>{money(ledger.estimatedTotal)}</Text></View><View><Text style={s.metricLabel}>CONFIDENCE</Text><Text style={s.metricValue}>{ledger.confidence.toUpperCase()}</Text></View></View>
      <View style={s.costGrid}>{REQUIRED_TRIP_COST_CATEGORIES.map((category) => { const entry = ledger.entries.find((row) => row.category === category); return <TouchableOpacity key={category} style={[s.cost, entry && s.costDone]} onPress={() => { setEditing(category); setAmountText(entry?.amount == null ? '' : String(entry.amount)); }}><Text style={s.costLabel}>{categoryLabel(category)}</Text><Text style={s.costValue}>{entry?.amount == null ? 'Add' : money(entry.amount)}</Text><Text style={s.evidence}>{entry ? evidenceStatusLabel(entry.evidenceStatus) : 'Missing Data'}</Text></TouchableOpacity>; })}</View>
      {editing && <View style={s.editor}><Text style={s.panelTitle}>{categoryLabel(editing)}</Text><TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.muted} style={s.input} autoFocus /><View style={s.actionButtons}><TouchableOpacity style={s.why} onPress={() => setEditing(null)}><Text style={s.buttonText}>CANCEL</Text></TouchableOpacity><TouchableOpacity style={s.do} onPress={() => void saveAmount()}><Text style={s.doText}>SAVE LOCALLY</Text></TouchableOpacity></View></View>}</View>

      <Text style={s.section}>VALUE EFFICIENCY</Text><View style={s.panel}><View style={s.metricRow}><View><Text style={s.metricLabel}>NET VALUE</Text><Text style={s.metricValue}>{money(efficiency.netVacationValue)}</Text></View><View><Text style={s.metricLabel}>PER VACATION DAY</Text><Text style={s.metricValue}>{money(efficiency.valuePerVacationDay)}</Text></View><View><Text style={s.metricLabel}>PER CASINO HOUR</Text><Text style={s.metricValue}>{efficiency.valuePerCasinoHour == null ? 'Need hours' : money(efficiency.valuePerCasinoHour)}</Text></View></View><Text style={s.copy}>These values include the saved cost ledger. Missing or estimated amounts remain visibly identified and reduce confidence.</Text></View>
      <View style={s.linkGrid}><TouchableOpacity style={s.link} onPress={() => router.push('/certificate-portfolio' as never)}><Sparkles size={19} color={C.gold} /><Text style={s.linkText}>Certificate optimizer</Text></TouchableOpacity><TouchableOpacity style={s.link} onPress={() => router.push('/price-upgrade-monitor' as never)}><Gauge size={19} color={C.gold} /><Text style={s.linkText}>Book now / price monitor</Text></TouchableOpacity><TouchableOpacity style={s.link} onPress={() => router.push('/casino/onboard-mode' as never)}><CircleDollarSign size={19} color={C.gold} /><Text style={s.linkText}>Onboard casino mode</Text></TouchableOpacity></View>
      <TouchableOpacity style={s.link} onPress={() => router.push('/offer-lineage' as never)}><Sparkles size={19} color={C.gold} /><Text style={s.linkText}>Offer lineage (exact IDs)</Text></TouchableOpacity>
      <Text style={s.notice}>Easy Seas never books, redeems, reprices, contacts a host, or spends money automatically. Every external action requires your confirmation.</Text>
    </ScrollView>
  </SafeAreaView></View>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.navy }, safe: { flex: 1 }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.line }, round: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, title: { color: C.white, fontSize: 23, fontWeight: '900' }, subtitle: { color: C.muted, fontSize: 11, marginTop: 2 }, content: { padding: 16, paddingBottom: 70 }, scope: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, marginTop: 9, backgroundColor: C.panel, borderRadius: 11 }, scopeText: { flex: 1, color: C.muted, fontSize: 11, fontWeight: '700' }, section: { color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 9 }, actionCard: { backgroundColor: C.card, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: C.line, marginBottom: 10 }, actionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, rank: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, rankText: { color: C.navy, fontWeight: '900', fontSize: 17 }, actionTitle: { color: C.white, fontWeight: '900', fontSize: 16 }, meta: { color: C.teal, fontWeight: '800', fontSize: 9, marginTop: 4 }, copy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 9 }, missing: { color: '#FFD39D', fontSize: 11, marginTop: 8 }, actionButtons: { flexDirection: 'row', gap: 8, marginTop: 12 }, why: { flex: 1, flexDirection: 'row', gap: 6, padding: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: C.line }, do: { flex: 1.4, flexDirection: 'row', gap: 6, padding: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: C.gold }, buttonText: { color: C.white, fontWeight: '900', fontSize: 11 }, doText: { color: C.navy, fontWeight: '900', fontSize: 11 }, empty: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: C.panel, borderRadius: 14 }, panel: { backgroundColor: C.panel, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: C.line }, panelTitle: { color: C.white, fontWeight: '900', fontSize: 15 }, metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 13 }, metricLabel: { color: C.muted, fontSize: 8, fontWeight: '900' }, metricValue: { color: C.white, fontSize: 14, fontWeight: '900', marginTop: 4 }, costGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 }, cost: { width: '48%', minHeight: 72, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.navy }, costDone: { borderColor: C.teal }, costLabel: { color: C.white, fontSize: 11, fontWeight: '800' }, costValue: { color: C.gold, fontSize: 14, fontWeight: '900', marginTop: 4 }, evidence: { color: C.muted, fontSize: 9, marginTop: 3 }, editor: { backgroundColor: C.card, borderRadius: 12, padding: 13, marginTop: 12 }, input: { color: C.white, backgroundColor: C.navy, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 18, fontWeight: '800', marginTop: 10 }, linkGrid: { gap: 8, marginTop: 18 }, link: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 14 }, linkText: { color: C.white, fontWeight: '800' }, notice: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 18 } });
