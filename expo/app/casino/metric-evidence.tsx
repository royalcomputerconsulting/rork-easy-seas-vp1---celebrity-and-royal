import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, FilePenLine } from 'lucide-react-native';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';

type Definition = { formula: string; fields: string[]; correction: string };

const DEFINITIONS: Array<[RegExp, Definition]> = [
  [/attributed.*points|points earned|points by/i, { formula: 'Σ cruise-level points within the displayed owner, program, and season.', fields: ['pointsEarned', 'earnedPoints', 'casinoPoints'], correction: 'Edit the completed cruise closeout.' }],
  [/unallocated/i, { formula: 'Provider/profile loyalty balance − attributed cruise points.', fields: ['clubRoyalePointsFromApi', 'clubRoyalePoints', 'pointsEarned'], correction: 'Reconcile the missing points to completed cruises without changing the provider balance.' }],
  [/casino availability/i, { formula: 'Casino-available hours are derived from itinerary/open-day records: sea days use a full casino window, port/embarkation days use an evening-weighted window, and debarkation is excluded.', fields: ['itinerary', 'casinoOpenDays', 'seaDays', 'portDays', 'nights'], correction: 'Edit the cruise itinerary/open-day record if availability is wrong.' }],
  [/actual.*hours|per actual hour/i, { formula: 'Σ actual session minutes ÷ 60, with explicit cruise closeout hours used when no timed sessions exist.', fields: ['durationMinutes', 'hoursPlayed'], correction: 'Enter actual hours in Post-cruise Closeout only if you want to replace the estimate.' }],
  [/estimated.*hours|modeled.*play hour/i, { formula: 'Cruise points ÷ configured historical PPH, capped by casino-available hours for that sailing.', fields: ['pointsEarned', 'itinerary', 'casinoOpenDays', 'seaDays', 'portDays'], correction: 'Edit cruise-level points or the PPH assumption; session entry is optional.' }],
  [/combined.*hours/i, { formula: 'Actual play hours + separately labeled estimated play hours.', fields: ['durationMinutes', 'hoursPlayed', 'pointsEarned'], correction: 'Enter actual hours only for cruises where you want the estimate replaced.' }],
  [/points per.*hour/i, { formula: 'Modeled PPH = final cruise points ÷ estimated play hours. Actual PPH is shown only when timed sessions or closeout hours exist.', fields: ['pointsEarned', 'durationMinutes', 'hoursPlayed'], correction: 'Edit cruise-level points or add actual hours if available.' }],
  [/coin-in/i, { formula: 'Σ explicit session/provider coin-in. Eligible confirmed Club Royale slot points may use points × $5 and remain ESTIMATED.', fields: ['coinIn', 'slotPointsConfirmed', 'coinInCalculationSource'], correction: 'Enter provider-reported coin-in or confirm eligible slot points.' }],
  [/theoretical|theo|adt/i, { formula: 'Recorded theo, otherwise valid coin-in × configured hold. ADT = theo ÷ explicit rated gaming days, falling back to itinerary-derived casino-available days.', fields: ['theoreticalLoss', 'coinIn', 'houseEdge', 'ratedGamingDays', 'itinerary', 'casinoOpenDays'], correction: 'Enter explicit theo/rated days when available, or correct the itinerary/open-day record.' }],
  [/gaming result|cash result|win|loss|variance/i, { formula: 'Cash-out + separately paid handpays − cash-in. Cruise fare is excluded.', fields: ['cashResult', 'netResult', 'startingCash', 'endingCash'], correction: 'Edit the cruise closeout or session.' }],
  [/value|retail|paid|coverage|roi/i, { formula: 'Calculated only from the same owner-scoped cruise economics rows shown below; coin-in is never counted as spending.', fields: ['retailValue', 'amountPaid', 'cruiseValueCaptured', 'totalEconomicValue'], correction: 'Upload or replace the cruise receipt.' }],
  [/certificate/i, { formula: 'Explicit cruise/certificate identity first; direct saved code second; issue-date overlap is PROBABLE and requires confirmation.', fields: ['instantCertificateOfferCode', 'cruiseId', 'earnedOnCruise', 'issueDate'], correction: 'Open Certificate Link Review to confirm, unlink, or reassign.' }],
];

const finite = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null;
const display = (value: unknown): string => typeof value === 'number' ? value.toLocaleString() : String(value ?? '—');

export default function CasinoMetricEvidenceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ label?: string; value?: string; evidence?: string; detail?: string }>();
  const { bookedCruises, allCruiseEconomicsSummary } = useCasinoEconomicsData();
  const label = String(params.label ?? 'Casino metric');
  const definition = DEFINITIONS.find(([pattern]) => pattern.test(label))?.[1] ?? { formula: String(params.detail || 'Derived from the owner-scoped canonical Casino ledger.'), fields: ['source record'], correction: 'Review the contributing cruise records.' };
  const economics = useMemo(() => new Map(allCruiseEconomicsSummary.rows.map((row) => [row.cruiseId, row])), [allCruiseEconomicsSummary.rows]);
  const records = useMemo(() => bookedCruises.map((cruise) => {
    const row = economics.get(cruise.id) as Record<string, unknown> | undefined;
    const values = definition.fields.map((field) => ({ field, value: (cruise as unknown as Record<string, unknown>)[field] ?? row?.[field] })).filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
    return { cruise, values };
  }).filter((entry) => entry.values.length > 0), [bookedCruises, definition.fields, economics]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back}><ChevronLeft size={21} color="#1C2F7A" /><Text style={styles.backText}>Casino</Text></TouchableOpacity><Text style={styles.headerTitle}>Calculation evidence</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.eyebrow}>{String(params.evidence ?? 'DERIVED')}</Text><Text style={styles.title}>{label}</Text><Text style={styles.value}>{String(params.value ?? '—')}</Text>{params.detail ? <Text style={styles.detail}>{String(params.detail)}</Text> : null}</View>
      <View style={styles.card}><Text style={styles.cardTitle}>Exact formula</Text><Text style={styles.copy}>{definition.formula}</Text><Text style={styles.cardTitle}>Correction path</Text><Text style={styles.copy}>{definition.correction}</Text></View>
      <Text style={styles.section}>Contributing owner-scoped records ({records.length})</Text>
      {records.map(({ cruise, values }) => <View key={cruise.id} style={styles.record}><Text style={styles.recordTitle}>{cruise.shipName || 'Unknown ship'} · {cruise.sailDate}</Text><Text style={styles.source}>Source: {cruise.sourceAuthority === 'provider' ? 'PROVIDER REPORTED' : cruise.invoiceImportedAt ? 'RECEIPT ACTUAL' : 'USER ENTERED'} · Updated {cruise.updatedAt || cruise.invoiceImportedAt || 'timestamp unavailable'}</Text>{values.map((item) => <View key={item.field} style={styles.row}><Text style={styles.field}>{item.field}</Text><Text style={styles.fieldValue}>{display(item.value)}</Text></View>)}</View>)}
      {!records.length ? <View style={styles.card}><Text style={styles.copy}>No contributing records exist for this owner and metric. Easy Seas did not substitute another profile’s data.</Text></View> : null}
      <TouchableOpacity style={styles.action} onPress={() => router.push('/casino/post-cruise-closeout')}><FilePenLine size={18} color="#fff" /><Text style={styles.actionText}>Correct cruise evidence</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#F3F3F2'},header:{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:'#D5D5D0',backgroundColor:'#FFFFFF'},back:{flexDirection:'row',alignItems:'center'},backText:{color:'#1C2F7A',fontWeight:'700'},headerTitle:{color:'#1C2F7A',fontWeight:'800',fontSize:17,marginLeft:18},content:{padding:16,paddingBottom:50,gap:14},hero:{backgroundColor:'#FFFFFF',borderRadius:18,padding:18,borderWidth:1,borderColor:'#D5D5D0'},eyebrow:{color:'#0E7FA7',fontSize:11,fontWeight:'900'},title:{color:'#1C2F7A',fontSize:24,fontWeight:'900',marginTop:5},value:{color:'#A46000',fontSize:30,fontWeight:'900',marginTop:8},detail:{color:'#676A70',lineHeight:20,marginTop:6},card:{backgroundColor:'#FFFFFF',borderRadius:15,padding:15,borderWidth:1,borderColor:'#D5D5D0'},cardTitle:{color:'#1C2F7A',fontWeight:'800',marginBottom:5,marginTop:3},copy:{color:'#676A70',lineHeight:20},section:{color:'#1C2F7A',fontWeight:'900',fontSize:17,marginTop:4},record:{backgroundColor:'#fff',borderRadius:14,padding:14},recordTitle:{color:'#0d355a',fontWeight:'900',fontSize:15},source:{color:'#597184',fontSize:11,lineHeight:16,marginVertical:6},row:{flexDirection:'row',justifyContent:'space-between',gap:12,borderTopWidth:1,borderTopColor:'#e3ebf0',paddingTop:7,marginTop:7},field:{color:'#5d7180',fontSize:12,flex:1},fieldValue:{color:'#102f49',fontWeight:'800',fontSize:12,flex:1,textAlign:'right'},action:{backgroundColor:'#0b766d',borderRadius:14,padding:14,flexDirection:'row',justifyContent:'center',gap:8},actionText:{color:'#fff',fontWeight:'900'} });
