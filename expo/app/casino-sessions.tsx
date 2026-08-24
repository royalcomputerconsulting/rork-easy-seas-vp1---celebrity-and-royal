import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { isGeneratedCasinoSession } from '@/lib/casino/casinoTruthEngine';

const money = (value: number | undefined) => typeof value === 'number' ? `$${value.toLocaleString()}` : '—';

export default function CasinoSessionsScreen() {
  const router = useRouter();
  const { sessions } = useCasinoSessions();
  const actual = useMemo(() => sessions.filter((session) => !isGeneratedCasinoSession(session)).sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)), [sessions]);
  const generated = sessions.length - actual.length;
  return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color="#f1c85b" /></TouchableOpacity><View><Text style={styles.title}>Casino Play History</Text><Text style={styles.subtitle}>{actual.length} actual · {generated} generated estimate(s) excluded</Text></View></View>
    <FlatList
      contentContainerStyle={styles.content}
      data={actual}
      keyExtractor={(session) => session.id}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={<><TouchableOpacity style={styles.primary} onPress={() => router.push('/casino/post-cruise-closeout')}><Plus color="#071b2d" size={19} /><Text style={styles.primaryText}>Add one cruise play summary</Text></TouchableOpacity><Text style={styles.help}>Use starting cash, ending cash, total hours, actual points, and the certificate earned. Session-by-session entry is optional.</Text></>}
      ListEmptyComponent={<View style={styles.card}><Text style={styles.cardTitle}>No actual sessions saved</Text><Text style={styles.detail}>Generated estimates remain available to Ask My Data as estimates but never count as actual play.</Text></View>}
      renderItem={({ item: session }) => <View style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>{session.machineName || session.gameCategory || session.machineType || 'Casino play'}</Text><Text style={styles.date}>{session.date}</Text></View>
        <Text style={styles.value}>{Math.round(session.durationMinutes / 6) / 10} hr · {session.pointsEarned?.toLocaleString() ?? '—'} points</Text>
        <Text style={styles.detail}>Cash in {money(session.cashIn ?? session.buyIn)} · cash out {money(session.cashOut)} · result {money(session.winLoss)}</Text>
        <Text style={styles.detail}>Coin-in {money(session.coinIn ?? (session.cashCoinIn != null || session.freeplayCoinIn != null ? (session.cashCoinIn ?? 0) + (session.freeplayCoinIn ?? 0) : undefined))} · source {session.pointsSource ?? session.recordKind ?? 'user entered'}</Text>
      </View>}
    />
  </SafeAreaView></View>;
}

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:'#071b2d'},safe:{flex:1},header:{flexDirection:'row',gap:11,alignItems:'center',padding:16},back:{width:40,height:40,borderRadius:20,backgroundColor:'#17334a',alignItems:'center',justifyContent:'center'},title:{color:'#fff',fontSize:20,fontWeight:'900'},subtitle:{color:'#a7becb',fontSize:11,marginTop:2},content:{padding:15,paddingBottom:80},primary:{backgroundColor:'#f1c85b',borderRadius:14,padding:15,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},primaryText:{color:'#071b2d',fontWeight:'900'},help:{color:'#a9c0cc',fontSize:12,lineHeight:18,marginVertical:12},card:{backgroundColor:'#102c41',borderColor:'#2f4c60',borderWidth:1,borderRadius:14,padding:14,marginBottom:10},row:{flexDirection:'row',justifyContent:'space-between',gap:8},cardTitle:{color:'#fff',fontWeight:'900',fontSize:15,flex:1},date:{color:'#9bb1bd',fontSize:11},value:{color:'#f1c85b',fontSize:18,fontWeight:'900',marginVertical:7},detail:{color:'#b8cad3',fontSize:11,lineHeight:16} });
