import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign, CloudSun, FileText, Map, MessageCircle, Ship, Star, Target, Waves } from 'lucide-react-native';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';

type LifecycleMode = 'pre-cruise' | 'onboard' | 'casino' | 'post-cruise';
interface HomePreference { mode: LifecycleMode; pinned: string[] }
interface HomeAction { id: string; label: string; detail: string; route: string; icon: typeof Ship; modes: LifecycleMode[] }
const C = { navy: '#071A2D', panel: '#102B45', card: '#173A5B', gold: '#E2B440', white: '#FFFFFF', muted: '#B8CADB', line: '#315675', teal: '#39C6B1' };
const MODES: { id: LifecycleMode; label: string }[] = [{ id: 'pre-cruise', label: 'Pre-Cruise' }, { id: 'onboard', label: 'Onboard' }, { id: 'casino', label: 'Casino Session' }, { id: 'post-cruise', label: 'Post-Cruise' }];
const ACTIONS: HomeAction[] = [
  { id: 'next-best', label: 'Next Best Action', detail: 'Top recommendations, confidence, and all-in cost', route: '/intelligence-center', icon: Target, modes: ['pre-cruise', 'onboard', 'casino', 'post-cruise'] },
  { id: 'booked', label: 'My booked cruises', detail: 'Reservations and sailing details', route: '/(tabs)/booked', icon: Ship, modes: ['pre-cruise', 'onboard'] },
  { id: 'readiness', label: 'Travel Readiness Vault', detail: 'Documents and checklist', route: '/travel-readiness-vault', icon: CheckCircle2, modes: ['pre-cruise'] },
  { id: 'offline', label: 'Offline Voyage Pack', detail: 'Preload voyage essentials', route: '/offline-voyage-pack', icon: CloudSun, modes: ['pre-cruise', 'onboard'] },
  { id: 'today', label: 'Today on My Cruise', detail: 'Port, weather, agenda, and essentials', route: '/today-on-cruise', icon: Map, modes: ['onboard'] },
  { id: 'voyage-command', label: 'Voyage Command Center', detail: 'Ports, safety buffers, conflicts, cabin, and documents', route: '/voyage-command-center', icon: Map, modes: ['pre-cruise', 'onboard'] },
  { id: 'marine', label: 'Operational marine forecast', detail: 'Waves, swell, wind, and confidence', route: '/(tabs)/booked', icon: Waves, modes: ['pre-cruise', 'onboard'] },
  { id: 'session', label: 'Start casino session', detail: 'Open the existing session form', route: '/(tabs)/machines?startSession=1', icon: CircleDollarSign, modes: ['casino'] },
  { id: 'comp-pace', label: 'Current-trip comp pace', detail: 'Actual, reported, and estimated values', route: '/casino/current-trip-comp-pace', icon: Target, modes: ['casino', 'onboard'] },
  { id: 'advisor', label: 'Live certificate advisor', detail: 'Saved threshold economics', route: '/casino/live-certificate-advisor', icon: CalendarClock, modes: ['casino'] },
  { id: 'closeout', label: 'Post-cruise closeout', detail: 'Reconcile casino and voyage facts', route: '/casino/post-cruise-closeout', icon: FileText, modes: ['post-cruise'] },
  { id: 'host-brief', label: 'Casino Host Meeting Brief', detail: 'Create a redactable evidence brief', route: '/casino/host-meeting-brief', icon: FileText, modes: ['post-cruise', 'casino'] },
  { id: 'ask', label: 'Ask Easy Seas', detail: 'Question all saved local data', route: '/ask-my-data', icon: MessageCircle, modes: ['pre-cruise', 'onboard', 'casino', 'post-cruise'] },
];

export default function EasySeasHomeScreen() {
  const router = useRouter(), { authenticatedEmail } = useAuth(), { bookedCruises, casinoOffers, calendarEvents } = useCoreData(), { clubRoyalePoints, clubRoyaleTier } = useLoyalty(), { sessions } = useCasinoSessions();
  const key = useMemo(() => getUserScopedKey(ALL_STORAGE_KEYS.LIFECYCLE_HOME_PREFERENCES, authenticatedEmail), [authenticatedEmail]);
  const [preference, setPreference] = useState<HomePreference>({ mode: 'pre-cruise', pinned: ['booked', 'ask', 'offline'] });
  useEffect(() => { void quotaSafeGetJsonItem<HomePreference>(key, preference, (value): value is HomePreference => Boolean(value && typeof value === 'object' && 'mode' in value && 'pinned' in value)).then(setPreference); }, [key]);
  const save = (next: HomePreference) => { setPreference(next); void quotaSafeSetJsonItem(key, next); };
  const togglePin = (id: string) => { const pinned = preference.pinned.includes(id) ? preference.pinned.filter((value) => value !== id) : [...preference.pinned, id].slice(-3); save({ ...preference, pinned }); };
  const today = new Date().toISOString().slice(0, 10), nextCruise = bookedCruises.filter((row) => row.returnDate >= today && row.status !== 'cancelled').sort((a, b) => a.sailDate.localeCompare(b.sailDate))[0];
  const modeActions = ACTIONS.filter((action) => action.modes.includes(preference.mode));
  const pinnedActions = preference.pinned.map((id) => ACTIONS.find((action) => action.id === id)).filter((action): action is HomeAction => Boolean(action));
  const open = (route: string) => router.push(route as never);
  return <View style={s.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={s.safe} edges={['top']}><View style={s.header}><TouchableOpacity style={s.back} onPress={() => router.back()}><ArrowLeft size={20} color={C.gold} /></TouchableOpacity><View><Text style={s.title}>Easy Seas Home</Text><Text style={s.sub}>Compact actions for the current phase</Text></View></View><ScrollView contentContainerStyle={s.content}>
    <View style={s.modeRow} testID="lifecycle-home-mode-selector">{MODES.map((mode) => <TouchableOpacity key={mode.id} style={[s.mode, preference.mode === mode.id && s.modeActive]} onPress={() => save({ ...preference, mode: mode.id })}><Text style={[s.modeText, preference.mode === mode.id && s.modeTextActive]}>{mode.label}</Text></TouchableOpacity>)}</View>
    <View style={s.summary}><Text style={s.eyebrow}>COMPACT LOCAL SUMMARY</Text><Text style={s.summaryTitle}>{nextCruise ? `${nextCruise.shipName} · ${nextCruise.sailDate}` : 'No upcoming cruise saved'}</Text><Text style={s.summaryCopy}>{casinoOffers.filter((row) => row.status === 'active' || !row.status).length} active offers · {calendarEvents.filter((row) => row.startDate >= today).length} upcoming calendar items · {sessions.filter((row) => row.date === today).length} sessions today</Text><Text style={s.summaryCopy}>{clubRoyaleTier} · {clubRoyalePoints.toLocaleString()} points</Text></View>
    <Text style={s.section}>PINNED ACTIONS ({pinnedActions.length}/3)</Text><View style={s.pinnedGrid}>{pinnedActions.map((action) => <TouchableOpacity key={action.id} style={s.pinnedCard} onPress={() => open(action.route)} testID={`lifecycle-home-pinned-${action.id}`}><action.icon size={20} color={C.gold} /><Text style={s.pinnedTitle}>{action.label}</Text></TouchableOpacity>)}</View>
    <Text style={s.section}>{MODES.find((mode) => mode.id === preference.mode)?.label.toUpperCase()} ACTIONS</Text>{modeActions.map((action) => <View key={action.id} style={s.action}><TouchableOpacity style={s.actionOpen} onPress={() => open(action.route)}><action.icon size={19} color={C.teal} /><View style={s.flex}><Text style={s.actionTitle}>{action.label}</Text><Text style={s.actionDetail}>{action.detail}</Text></View><ChevronRight size={18} color={C.muted} /></TouchableOpacity><TouchableOpacity style={s.star} onPress={() => togglePin(action.id)} accessibilityLabel={`${preference.pinned.includes(action.id) ? 'Unpin' : 'Pin'} ${action.label}`}><Star size={18} color={preference.pinned.includes(action.id) ? C.gold : C.muted} fill={preference.pinned.includes(action.id) ? C.gold : 'transparent'} /></TouchableOpacity></View>)}
    <Text style={s.notice}>This layer loads compact personal summaries only. The full cruise catalog remains on disk and is queried only when you open a cruise-search surface.</Text>
  </ScrollView></SafeAreaView></View>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.navy }, safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.line }, back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, title: { color: C.white, fontSize: 23, fontWeight: '900' }, sub: { color: C.muted, fontSize: 12, marginTop: 2 }, content: { padding: 16, paddingBottom: 60 }, modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }, mode: { borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.panel }, modeActive: { backgroundColor: C.gold, borderColor: C.gold }, modeText: { color: C.muted, fontSize: 11, fontWeight: '800' }, modeTextActive: { color: C.navy }, summary: { borderRadius: 15, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 16 }, eyebrow: { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, summaryTitle: { color: C.white, fontSize: 18, fontWeight: '900', marginTop: 7 }, summaryCopy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, section: { color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: .7, marginTop: 20, marginBottom: 9 }, pinnedGrid: { flexDirection: 'row', gap: 8 }, pinnedCard: { flex: 1, minHeight: 96, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 12 }, pinnedTitle: { color: C.white, fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 9 }, action: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 13, borderWidth: 1, borderColor: C.line, marginBottom: 9 }, actionOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }, flex: { flex: 1 }, actionTitle: { color: C.white, fontSize: 14, fontWeight: '800' }, actionDetail: { color: C.muted, fontSize: 11, marginTop: 3 }, star: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: C.line }, notice: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 12 }, });
