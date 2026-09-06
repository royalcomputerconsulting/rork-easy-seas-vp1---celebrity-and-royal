import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Bot, ChevronDown, ChevronUp, History, ShieldCheck } from 'lucide-react-native';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { cruiseInventoryRepository, type CruiseInventoryChange, type CruiseInventoryChangeKind, type CruiseSyncReport } from '@/lib/cruiseInventory/CruiseInventoryRepository';

const kinds: CruiseInventoryChangeKind[] = ['added', 'changed', 'removed', 'rejected'];
export default function SyncChangeHistoryScreen() {
  const router = useRouter();
  const { ownerScopeId } = useCruiseInventory();
  const [reports, setReports] = useState<CruiseSyncReport[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [changes, setChanges] = useState<CruiseInventoryChange[]>([]);
  const [filter, setFilter] = useState<CruiseInventoryChangeKind | undefined>();
  const load = useCallback(async () => {
    if (!ownerScopeId) return;
    setReports(await cruiseInventoryRepository.getSyncReports(ownerScopeId));
  }, [ownerScopeId]);
  useEffect(() => { void load(); }, [load]);
  const open = async (generationId: string, nextFilter?: CruiseInventoryChangeKind) => {
    const same = selected === generationId && filter === nextFilter;
    if (same) { setSelected(null); setChanges([]); return; }
    setSelected(generationId); setFilter(nextFilter); setChanges(await cruiseInventoryRepository.getSyncChanges(generationId, nextFilter));
  };
  return <SafeAreaView style={s.safe}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back"><ArrowLeft color="#fff" /></TouchableOpacity><View style={s.headerCopy}><Text style={s.eyebrow}>SYNC AUDIT</Text><Text style={s.title}>What Changed?</Text></View><TouchableOpacity onPress={() => router.push({ pathname: '/ask-my-data', params: { prompt: 'Explain my latest sync reconciliation report, including added, changed, removed, rejected, and preserved offer-sailing rows.' } } as never)} accessibilityLabel="Ask Agent SEA"><Bot color="#84e1cf" /></TouchableOpacity></View>
    <ScrollView contentContainerStyle={s.content}><View style={s.notice}><ShieldCheck color="#16755f" /><Text style={s.noticeText}>A replacement is promoted only after row accounting and database readback pass. Incomplete captures preserve the prior active catalog.</Text></View>
      {!reports.length ? <View style={s.empty}><History color="#59758b" /><Text style={s.emptyTitle}>No completed sync history yet</Text><Text style={s.muted}>Run a new Royal, Celebrity, or Carnival sync. Its compact changes will appear here.</Text></View> : reports.map((report) => <View key={report.generationId} style={s.card}>
        <TouchableOpacity onPress={() => void open(report.generationId)} style={s.cardHead} testID={`sync-report-${report.generationId}`}><View><Text style={s.provider}>{report.provider.toUpperCase()}</Text><Text style={s.date}>{report.completedAt ? new Date(report.completedAt).toLocaleString() : report.startedAt}</Text></View>{selected === report.generationId && !filter ? <ChevronUp color="#173b5d" /> : <ChevronDown color="#173b5d" />}</TouchableOpacity>
        <Text style={s.countLine}>{report.previousOfferSailings.toLocaleString()} → {report.nextOfferSailings.toLocaleString()} offer-sailing rows</Text>
        <View style={s.chips}>{kinds.map((kind) => <TouchableOpacity key={kind} style={[s.chip, filter === kind && selected === report.generationId && s.chipOn]} onPress={() => void open(report.generationId, kind)}><Text style={s.chipValue}>{report[kind].toLocaleString()}</Text><Text style={s.chipLabel}>{kind}</Text></TouchableOpacity>)}<View style={s.chip}><Text style={s.chipValue}>{report.preserved.toLocaleString()}</Text><Text style={s.chipLabel}>preserved</Text></View></View>
        {selected === report.generationId ? <View style={s.details}>{changes.length ? changes.map((change) => <View key={`${change.kind}-${change.recordKey}`} style={s.change}><Text style={s.changeKind}>{change.kind.toUpperCase()}</Text><Text style={s.changeKey} numberOfLines={2}>{change.recordKey}</Text><Text style={s.reason}>{change.reason}</Text></View>) : <Text style={s.muted}>No individual {filter ?? 'changed'} rows in this run.</Text>}</View> : null}
      </View>)}
    </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({safe:{flex:1,backgroundColor:'#eff5f7'},header:{backgroundColor:'#FFFFFF',padding:16,flexDirection:'row',alignItems:'center'},headerCopy:{flex:1,marginLeft:14},eyebrow:{color:'#0E7FA7',fontSize:10,fontWeight:'900',letterSpacing:1.3},title:{color:'#1C2F7A',fontSize:23,fontWeight:'900'},content:{padding:16,paddingBottom:50},notice:{backgroundColor:'#e1f4ed',borderColor:'#aadccc',borderWidth:1,borderRadius:15,padding:14,flexDirection:'row',gap:10,marginBottom:12},noticeText:{flex:1,color:'#1a574a',lineHeight:19,fontWeight:'600'},empty:{backgroundColor:'#fff',borderRadius:16,padding:26,alignItems:'center',gap:8},emptyTitle:{color:'#173b5d',fontWeight:'900',fontSize:17},muted:{color:'#617a8d',lineHeight:18},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#d6e2e8',borderRadius:16,padding:14,marginBottom:10},cardHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},provider:{color:'#123b63',fontWeight:'900',fontSize:16},date:{color:'#637b8d',fontSize:12,marginTop:2},countLine:{color:'#173b5d',fontWeight:'800',marginTop:10},chips:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10},chip:{backgroundColor:'#edf3f6',borderRadius:10,padding:8,minWidth:58,alignItems:'center'},chipOn:{backgroundColor:'#bde8dd'},chipValue:{color:'#173b5d',fontWeight:'900'},chipLabel:{color:'#61798a',fontSize:10,textTransform:'capitalize'},details:{borderTopWidth:1,borderTopColor:'#dfe8ed',marginTop:12,paddingTop:10},change:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#edf2f4'},changeKind:{fontSize:10,fontWeight:'900',color:'#08776d'},changeKey:{fontWeight:'800',color:'#173b5d',marginTop:2},reason:{color:'#687f90',fontSize:12,marginTop:2}});
