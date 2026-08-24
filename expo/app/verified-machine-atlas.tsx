import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, MapPin, Search, ShieldCheck } from 'lucide-react-native';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useDeckPlan } from '@/state/DeckPlanProvider';
import { useMachineConditionLogs } from '@/state/MachineConditionLogProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { buildVerifiedMachineAtlas, MACHINE_ATLAS_EVIDENCE_NOTICE, type MachineAtlasConfidence, type VerifiedMachineAtlasEntry } from '@/lib/verifiedMachineAtlas';

const COLORS = { navy: '#071A2D', panel: '#102B45', card: '#173A5B', gold: '#E2B440', white: '#FFFFFF', muted: '#B8CADB', line: '#315675', green: '#39D98A', amber: '#FFC857', red: '#FF7A7A' };
const confidenceColors: Record<MachineAtlasConfidence, string> = { verified: COLORS.green, observed: COLORS.amber, stale: COLORS.red, unmapped: COLORS.muted };
const money = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;

function AtlasEntryCard({ entry, onPress }: { entry: VerifiedMachineAtlasEntry; onPress: () => void }) {
  return <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82} testID={`verified-atlas-entry-${entry.key}`}>
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.machine}>{entry.machineName}</Text>
        <Text style={styles.manufacturer}>{entry.manufacturer}</Text>
      </View>
      <View style={[styles.badge, { borderColor: confidenceColors[entry.confidence] }]}>
        <Text style={[styles.badgeText, { color: confidenceColors[entry.confidence] }]}>{entry.confidence.toUpperCase()}</Text>
      </View>
      <ChevronRight size={18} color={COLORS.muted} />
    </View>
    <View style={styles.location}><MapPin size={16} color={COLORS.gold} /><Text style={styles.locationText}>{entry.shipName} · {entry.deck} · {entry.zone}</Text></View>
    <Text style={styles.detail}>Bank/seat: {entry.bankPosition} · Denomination: {entry.denomination}</Text>
    <Text style={styles.reason}>{entry.confidenceReason}</Text>
    <View style={styles.sessionRow}>
      <Text style={styles.session}>Personal history: {entry.sessionCount} session{entry.sessionCount === 1 ? '' : 's'} · {entry.sessionMinutes} min · {money(entry.sessionNet)}</Text>
      <Text style={styles.lastSeen}>Last seen: {entry.lastSeen ? entry.lastSeen.slice(0, 10) : 'not recorded'}</Text>
    </View>
    {entry.conditionNotes.slice(0, 3).map((note) => <Text key={note} style={styles.note}>• {note}</Text>)}
  </TouchableOpacity>;
}

export default function VerifiedMachineAtlasScreen() {
  const router = useRouter();
  const { myAtlasMachines } = useSlotMachineLibrary();
  const { mappings } = useDeckPlan();
  const { logs } = useMachineConditionLogs();
  const { sessions } = useCasinoSessions();
  const [query, setQuery] = useState('');
  const [ship, setShip] = useState('All ships');
  const [confidence, setConfidence] = useState<MachineAtlasConfidence | 'all'>('all');
  const entries = useMemo(() => buildVerifiedMachineAtlas({ machines: myAtlasMachines, mappings, conditions: logs, sessions }), [logs, mappings, myAtlasMachines, sessions]);
  const ships = useMemo(() => ['All ships', ...Array.from(new Set(entries.map((entry) => entry.shipName))).sort()], [entries]);
  const visible = useMemo(() => entries.filter((entry) => {
    const search = query.trim().toLowerCase();
    return (ship === 'All ships' || entry.shipName === ship)
      && (confidence === 'all' || entry.confidence === confidence)
      && (!search || [entry.machineName, entry.manufacturer, entry.shipName, entry.deck, entry.zone, entry.bankPosition].some((value) => value.toLowerCase().includes(search)));
  }), [confidence, entries, query, ship]);

  const header = <>
    <View style={styles.summary} testID="verified-machine-atlas-summary">
      <ShieldCheck size={22} color={COLORS.gold} />
      <View style={styles.flex}><Text style={styles.summaryTitle}>{entries.filter((entry) => entry.confidence === 'verified').length} verified locations</Text><Text style={styles.summaryCopy}>{entries.length} saved machine/location records joined with observations and session history.</Text></View>
    </View>
    <View style={styles.search}><Search size={18} color={COLORS.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Machine, ship, deck, zone, or bank" placeholderTextColor={COLORS.muted} style={styles.searchInput} testID="verified-machine-atlas-search" /></View>
    <FlatList horizontal data={ships} keyExtractor={(value) => value} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} renderItem={({ item }) => <TouchableOpacity style={[styles.chip, ship === item && styles.chipActive]} onPress={() => setShip(item)}><Text style={[styles.chipText, ship === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>} />
    <View style={styles.confidenceRow}>{(['all', 'verified', 'observed', 'stale', 'unmapped'] as const).map((value) => <TouchableOpacity key={value} style={[styles.confidenceChip, confidence === value && styles.confidenceActive]} onPress={() => setConfidence(value)}><Text style={[styles.confidenceText, confidence === value && styles.confidenceTextActive]}>{value}</Text></TouchableOpacity>)}</View>
    <Text style={styles.notice}>{MACHINE_ATLAS_EVIDENCE_NOTICE}</Text>
    <Text style={styles.count}>{visible.length} matching record{visible.length === 1 ? '' : 's'}</Text>
  </>;

  return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()}><ArrowLeft size={20} color={COLORS.gold} /></TouchableOpacity><View><Text style={styles.title}>Verified Machine Atlas</Text><Text style={styles.subtitle}>Evidence-based onboard map</Text></View></View>
    <FlatList data={visible} keyExtractor={(entry) => entry.key} ListHeaderComponent={header} contentContainerStyle={styles.content} renderItem={({ item }) => <AtlasEntryCard entry={item} onPress={() => router.push(`/machine-detail/${item.machineId}` as never)} />} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No matching location records</Text><Text style={styles.reason}>Add or verify a deck mapping from the machine detail tools, then return here.</Text></View>} />
  </SafeAreaView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy }, safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.line }, back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' }, title: { color: COLORS.white, fontSize: 22, fontWeight: '800' }, subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 }, content: { padding: 16, paddingBottom: 60 }, summary: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, marginBottom: 12 }, summaryTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' }, summaryCopy: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }, search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: COLORS.panel, borderRadius: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.line }, searchInput: { flex: 1, color: COLORS.white, paddingVertical: 12, fontSize: 15 }, chips: { gap: 8, paddingVertical: 12 }, chip: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold }, chipText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: COLORS.navy }, confidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }, confidenceChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.panel }, confidenceActive: { backgroundColor: '#315675' }, confidenceText: { color: COLORS.muted, textTransform: 'capitalize', fontSize: 12, fontWeight: '700' }, confidenceTextActive: { color: COLORS.white }, notice: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 }, count: { color: COLORS.gold, fontWeight: '800', fontSize: 13, marginBottom: 8 }, card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: COLORS.line }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, machine: { color: COLORS.white, fontSize: 17, fontWeight: '800' }, manufacturer: { color: COLORS.muted, fontSize: 12, marginTop: 2 }, badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }, badgeText: { fontSize: 10, fontWeight: '900' }, location: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }, locationText: { color: COLORS.white, flex: 1, fontWeight: '700' }, detail: { color: COLORS.muted, fontSize: 13, marginTop: 7 }, reason: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 7 }, sessionRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line }, session: { color: COLORS.white, fontSize: 12, fontWeight: '700' }, lastSeen: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, note: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, empty: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 20, marginTop: 8 }, emptyTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
});
