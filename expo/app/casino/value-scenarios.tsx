import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Calculator } from 'lucide-react-native';
import { calculateTheoreticalLoss } from '@/lib/casino/theoreticalLoss';
import { calculateAdtScenario } from '@/lib/casino/adtScenario';
import { useCasinoLedger } from '@/hooks/useCasinoLedger';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';

const C = { navy: '#F3F3F2', panel: '#F5F5F4', card: '#FFFFFF', white: '#333334', muted: '#676A70', gold: '#0E7FA7', line: '#D5D5D0' };
const n = (value: string) => { const parsed = Number(value.replace(/[$,%]/g, '')); return Number.isFinite(parsed) ? parsed : 0; };
const inputNumber = (value: number) => String(Math.round((value + Number.EPSILON) * 100) / 100);

export default function CasinoValueScenarios() {
  const router = useRouter();
  const ledger = useCasinoLedger();
  const { bookedCruises, cruiseEconomicsSummary } = useCasinoEconomicsData();
  const [coin, setCoin] = useState('10000');
  const [hold, setHold] = useState('10');
  const [days, setDays] = useState('2');
  const [actual, setActual] = useState('-700');
  const [comps, setComps] = useState('300');
  const [sourceLabel, setSourceLabel] = useState('Manual scenario');

  const cruiseById = useMemo(() => new Map(bookedCruises.map((cruise) => [cruise.id, cruise])), [bookedCruises]);
  const usableEntries = useMemo(() => ledger.entries.filter((entry) => entry.points.value > 0 || entry.coinIn.value > 0).sort((a, b) => b.sailDate.localeCompare(a.sailDate)), [ledger.entries]);
  const theo = useMemo(() => calculateTheoreticalLoss({ coinIn: n(coin), assumedHoldPercent: n(hold), actualNetResult: n(actual), earnedCompValue: n(comps) }), [actual, coin, comps, hold]);
  const adt = useMemo(() => calculateAdtScenario({ totalCoinIn: n(coin), daysPlayed: n(days), assumedHoldPercent: n(hold) }), [coin, days, hold]);

  const loadEntry = (entry: (typeof ledger.entries)[number]) => {
    const cruise = cruiseById.get(entry.cruiseId);
    setCoin(inputNumber(entry.coinIn.value));
    setActual(inputNumber(entry.winLoss.value));
    setComps(inputNumber(entry.cruiseValueCaptured.value + (entry.freePlay.includedInTotal ? entry.freePlay.amount : 0) + (entry.obc.includedInTotal ? entry.obc.amount : 0)));
    setDays(String(Math.max(1, cruise?.nights ?? 1)));
    setSourceLabel(`${entry.shipName} · ${entry.sailDate} · ${entry.points.value.toLocaleString()} points`);
  };

  const loadAnnual = () => {
    const totals = cruiseEconomicsSummary.totals;
    setCoin(inputNumber(totals.totalCoinIn));
    setActual(inputNumber(totals.totalCashResult));
    setComps(inputNumber(totals.totalCruiseValueCaptured));
    setDays(String(Math.max(1, totals.totalNights)));
    setSourceLabel(`2025 Club Royale annual ledger · ${totals.totalPoints.toLocaleString()} points`);
  };

  const field = (label: string, value: string, set: (next: string) => void) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType="decimal-pad" style={styles.input} /></View>;
  return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><ArrowLeft color={C.gold} /></TouchableOpacity><View><Text style={styles.title}>Casino Value Scenarios</Text><Text style={styles.sub}>Load a saved cruise or model a transparent scenario</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.source}>{sourceLabel}</Text>
      <TouchableOpacity style={styles.annualButton} onPress={loadAnnual}><Text style={styles.annualButtonText}>Load verified 2025 annual totals</Text></TouchableOpacity>
      <Text style={styles.sectionLabel}>LOAD A CRUISE WITH POINTS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>{usableEntries.map((entry) => <TouchableOpacity key={entry.cruiseId} style={styles.chip} onPress={() => loadEntry(entry)}><Text style={styles.chipTitle}>{entry.shipName}</Text><Text style={styles.chipSub}>{entry.sailDate} · {entry.points.value.toLocaleString()} pts</Text></TouchableOpacity>)}</ScrollView>
      {usableEntries.length === 0 ? <Text style={styles.warning}>No cruise-level casino points were found. Add points through the cruise casino closeout or restore them in the classic dashboard.</Text> : null}
      <View style={styles.grid}>{field('Coin-in', coin, setCoin)}{field('Assumed hold %', hold, setHold)}{field('Gaming cash result', actual, setActual)}{field('Earned comp/cruise value', comps, setComps)}{field('Casino days / trip days', days, setDays)}</View>
      <View style={styles.card}><Calculator color={C.gold} /><Text style={styles.cardTitle}>Theoretical loss</Text><Text style={styles.big}>{theo.theoreticalLoss.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Text><Text style={styles.copy}>Actual gaming loss {theo.actualLoss.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · comps/theo {theo.compsPerTheoDollar == null ? '—' : theo.compsPerTheoDollar.toFixed(2)}</Text><Text style={styles.warning}>{theo.evidenceWarning}</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>ADT / trip-value scenario</Text><Text style={styles.big}>{adt.coinInPerDay.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} coin-in/day</Text><Text style={styles.copy}>{adt.estimatedTheoPerDay.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} estimated theo/day over {adt.daysPlayed} days.</Text>{adt.warnings.map((warning) => <Text key={warning} style={styles.warning}>• {warning}</Text>)}</View>
      <Text style={styles.notice}>Coin-in is gaming volume only. It is never added to cash result, cruise value captured, or total economic value.</Text>
    </ScrollView>
  </SafeAreaView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy }, header: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.line }, title: { color: C.white, fontSize: 21, fontWeight: '900' }, sub: { color: C.muted, fontSize: 11 }, content: { padding: 16, paddingBottom: 70 }, source: { color: C.gold, fontWeight: '900', marginBottom: 10 }, annualButton: { backgroundColor: C.gold, borderRadius: 11, padding: 12, alignItems: 'center' }, annualButtonText: { color: C.navy, fontWeight: '900' }, sectionLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 16 }, chips: { marginTop: 8, marginBottom: 14 }, chip: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 11, padding: 10, marginRight: 8, minWidth: 160 }, chipTitle: { color: C.white, fontWeight: '900', fontSize: 12 }, chipSub: { color: C.muted, fontSize: 10, marginTop: 3 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, field: { width: '48%', flexGrow: 1 }, label: { color: C.muted, fontSize: 10, fontWeight: '800', marginBottom: 4 }, input: { backgroundColor: C.panel, color: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 16, fontWeight: '800' }, card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 14 }, cardTitle: { color: C.white, fontWeight: '900', fontSize: 16, marginTop: 6 }, big: { color: C.gold, fontSize: 27, fontWeight: '900', marginTop: 8 }, copy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }, warning: { color: '#FFD19C', fontSize: 10, lineHeight: 16, marginTop: 7 }, notice: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 14 },
});
