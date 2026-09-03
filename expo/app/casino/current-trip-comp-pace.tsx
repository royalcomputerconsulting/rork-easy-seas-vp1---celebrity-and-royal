import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { DARK_ROYAL_COLORS as C } from '@/constants/darkRoyalTheme';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { buildCurrentTripCompPace, type SourcedMetric } from '@/lib/casino/currentTripCompPace';

const money = (metric: SourcedMetric) => metric.value == null ? 'Not recorded' : `$${Math.round(metric.value).toLocaleString()}`;
const source = (value: string) => value.replaceAll('_', ' ');

export default function CurrentTripCompPaceScreen() {
  const router = useRouter();
  const { bookedCruises } = useCasinoEconomicsData();
  const { sessions } = useCasinoSessions();
  const cruise = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return bookedCruises.find((row) => row.sailDate <= today && row.returnDate >= today)
      ?? bookedCruises.filter((row) => row.sailDate >= today).sort((a, b) => a.sailDate.localeCompare(b.sailDate))[0]
      ?? null;
  }, [bookedCruises]);
  const report = useMemo(() => cruise ? buildCurrentTripCompPace(cruise, sessions) : null, [cruise, sessions]);
  const rows = report ? [
    ['Points', report.points.value == null ? 'Not recorded' : Math.round(report.points.value).toLocaleString(), report.points],
    ['Coin-in', money(report.coinIn), report.coinIn], ['Theoretical loss', money(report.theoreticalLoss), report.theoreticalLoss],
    ['Average daily theo', money(report.averageDailyTheoretical), report.averageDailyTheoretical], ['Recorded comps', money(report.recordedComps), report.recordedComps],
  ] as const : [];
  return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={styles.safe} edges={['top']}><View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={20} color={C.gold} /></TouchableOpacity><View><Text style={styles.title}>Current-Trip Casino Pace</Text><Text style={styles.sub}>Sourced ADT, theoretical loss, and comp tracking</Text></View></View><ScrollView contentContainerStyle={styles.content}>
    {!report ? <View style={styles.card}><Text style={styles.empty}>No current or upcoming cruise is available.</Text></View> : <><View style={styles.hero}><Text style={styles.ship}>{report.ship}</Text><Text style={styles.program}>{source(report.program)} · {report.playDays} casino day{report.playDays === 1 ? '' : 's'}</Text></View>
      {rows.map(([label, value, metric]) => <View key={label} style={styles.card} testID={`comp-pace-${label.toLowerCase().replaceAll(' ', '-')}`}><View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.badge}>{source(metric.source)}</Text></View><Text style={styles.value}>{value}</Text><Text style={styles.explain}>{metric.explanation}</Text></View>)}
      <View style={styles.card}><Text style={styles.label}>Expected comp planning range</Text><Text style={styles.value}>{report.expectedCompLow.value == null ? 'Not enough data' : `${money(report.expectedCompLow)} – ${money(report.expectedCompHigh)}`}</Text><Text style={styles.explain}>Estimated only. Observed recorded-comp/theo pace: {report.observedCompPacePercent.value == null ? 'not available' : `${report.observedCompPacePercent.value.toFixed(1)}%`}.</Text></View>
      <View style={styles.warning}>{report.warnings.map((warning) => <Text key={warning} style={styles.warningText}>• {warning}</Text>)}</View></>}
  </ScrollView></SafeAreaView></View>;
}

const styles = StyleSheet.create({root:{flex:1,backgroundColor:C.background},safe:{flex:1},header:{flexDirection:'row',alignItems:'center',gap:10,padding:16},back:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,255,255,.08)',alignItems:'center',justifyContent:'center'},title:{color:C.textPrimary,fontSize:18,fontWeight:'900'},sub:{color:C.mutedText,fontSize:11,marginTop:2},content:{padding:16,paddingBottom:60},hero:{backgroundColor:C.cardAlt,borderRadius:16,borderWidth:1,borderColor:C.borderStrong,padding:16,marginBottom:12},ship:{color:C.textPrimary,fontSize:21,fontWeight:'900'},program:{color:C.gold,fontSize:12,textTransform:'uppercase',marginTop:4},card:{backgroundColor:C.card,borderRadius:14,borderWidth:1,borderColor:C.border,padding:14,marginBottom:10},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},label:{color:C.textSecondary,fontSize:11,fontWeight:'800',textTransform:'uppercase'},badge:{color:C.deepNavy,backgroundColor:C.gold,borderRadius:999,paddingHorizontal:8,paddingVertical:3,fontSize:9,fontWeight:'900',textTransform:'uppercase'},value:{color:C.textPrimary,fontSize:24,fontWeight:'900',marginTop:6},explain:{color:C.mutedText,fontSize:11,lineHeight:16,marginTop:5},warning:{backgroundColor:'rgba(245,158,11,.1)',borderRadius:12,borderWidth:1,borderColor:'rgba(245,158,11,.3)',padding:12},warningText:{color:'#FDE68A',fontSize:11,lineHeight:17},empty:{color:C.mutedText,fontSize:13}});
