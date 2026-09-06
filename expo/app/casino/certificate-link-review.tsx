import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, ChevronLeft, Link2, Link2Off, ListFilter, X } from 'lucide-react-native';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { linkCertificateToEarningCruise } from '@/lib/casino/certificateEarningChain';

export default function CertificateLinkReviewScreen() {
  const router = useRouter();
  const { searchableCertificates, updateCertificate } = useCertificates();
  const { bookedCruises } = useCasinoEconomicsData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const completed = useMemo(() => bookedCruises.filter((cruise) => String(cruise.status ?? '').toLowerCase().includes('complete') || String(cruise.returnDate ?? '') < new Date().toISOString().slice(0, 10)).sort((a,b)=>String(b.sailDate).localeCompare(String(a.sailDate))), [bookedCruises]);
  const earnedCertificateRows = useMemo(() => [...searchableCertificates].sort((a, b) => {
    const aDate = String(a.sailingDate ?? a.issueDate ?? a.issuedDate ?? a.expiryDate ?? '');
    const bDate = String(b.sailingDate ?? b.issueDate ?? b.issuedDate ?? b.expiryDate ?? '');
    return bDate.localeCompare(aDate) || String(a.certificateCode ?? a.label).localeCompare(String(b.certificateCode ?? b.label));
  }), [searchableCertificates]);
  const inferredEarningLinks = useMemo(() => new Map(earnedCertificateRows.map((certificate) => [
    certificate.id,
    linkCertificateToEarningCruise({
      certificate: certificate as unknown as Record<string, unknown>,
      completedCruises: completed as unknown as Record<string, unknown>[],
    }),
  ])), [completed, earnedCertificateRows]);
  const selected = searchableCertificates.find((certificate) => certificate.id === selectedId);
  const assign = (cruiseId: string) => {
    const cruise = bookedCruises.find((item) => item.id === cruiseId);
    if (!selected || !cruise) return;
    updateCertificate(selected.id, { cruiseId: cruise.id, earnedOnCruise: cruise.id, earningLinkState: 'confirmed', earningMatchConfidence: 'high', earningMatchReason: `User confirmed ${cruise.shipName} ${cruise.sailDate}`, earningLinkUpdatedAt: new Date().toISOString() });
    setSelectedId(null);
  };
  const unlink = (id: string) => updateCertificate(id, { cruiseId: undefined, earnedOnCruise: undefined, earningLinkState: 'unlinked', earningMatchConfidence: 'low', earningMatchReason: 'User explicitly unlinked this certificate', earningLinkUpdatedAt: new Date().toISOString() });

  const formatMoney = (value: number | undefined): string => typeof value === 'number' && Number.isFinite(value)
    ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '—';
  const savedCruisePoints = (cruise: Record<string, unknown> | undefined): number | null => {
    if (!cruise) return null;
    for (const key of ['casinoPoints', 'pointsEarned', 'casinoPointsEarned', 'actualCasinoPoints']) {
      const candidate = cruise[key];
      if (candidate === null || candidate === undefined || candidate === '') continue;
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <Stack.Screen options={{ headerShown:false }} />
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>router.back()}><ChevronLeft size={21} color="#1C2F7A"/><Text style={styles.backText}>Wallet</Text></TouchableOpacity><Text style={styles.headerTitle}>Certificate Link Review</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Confirm, unlink, or reassign the cruise where each certificate was earned. Issue-date matches remain probable until you confirm them.</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>Earned certificate ledger</Text>
        <Text style={styles.summaryTitle}>{earnedCertificateRows.length.toLocaleString()} certificate{earnedCertificateRows.length === 1 ? '' : 's'} available for review</Text>
        <Text style={styles.summaryText}>Each row should show the certificate code, inferred point value, award/trade value, earning ship, sailing date, expiration date, and link status. If a certificate image/PDF did not expose one of those face fields, Easy Seas marks that exact field as missing instead of guessing.</Text>
      </View>
      {earnedCertificateRows.map((certificate) => {
        const certificateRecord = certificate as unknown as Record<string, unknown>;
        const explicitlyLinked = bookedCruises.find((cruise) => cruise.id === certificate.cruiseId || cruise.id === certificate.earnedOnCruise);
        const inference = inferredEarningLinks.get(certificate.id);
        const suggested = certificate.earningLinkState !== 'unlinked' && !explicitlyLinked
          ? bookedCruises.find((cruise) => cruise.id === String(inference?.likelyEarningCruise?.id ?? ''))
          : undefined;
        const linked = explicitlyLinked || suggested;
        const state = certificate.earningLinkState === 'unlinked' ? 'unlinked' : certificate.earningLinkState === 'confirmed' ? 'confirmed' : 'inferred';
        const pointValue = certificate.pointsEarnedEstimate
          ?? certificate.pointsRequired
          ?? certificate.pointRequirement
          ?? (Number.isFinite(Number(certificateRecord.thresholdPoints)) ? Number(certificateRecord.thresholdPoints) : undefined)
          ?? (Number.isFinite(Number(certificateRecord.points)) ? Number(certificateRecord.points) : undefined);
        const awardValue = certificate.tradeInValue ?? certificate.value;
        const issueDate = certificate.issueDate || certificate.issuedDate || 'Missing';
        const earningShip = linked?.shipName || certificate.shipName || 'Missing';
        const earningSailDate = linked?.sailDate || certificate.sailingDate || 'Missing';
        const actualPoints = savedCruisePoints(linked as unknown as Record<string, unknown> | undefined);
        const confidenceText = state === 'confirmed'
          ? 'Exact · user-confirmed cruise identifier'
          : linked
            ? `${inference?.confidence ?? 'low'} · ${inference?.matchReason ?? 'suggested link requires confirmation'}`
            : state === 'unlinked'
              ? 'Exact · user explicitly unlinked'
              : 'Unresolved · no earning-cruise evidence';
        const parsedRows = certificate.parsedSailings?.length ?? 0;
        return <View key={certificate.id} style={styles.card} testID={`certificate-link-${certificate.id}`}>
          <View style={styles.row}><View style={{flex:1}}><Text style={styles.code}>{certificate.certificateCode || certificate.label}</Text><Text style={styles.meta}>{linked ? `${state === 'confirmed' ? 'Confirmed' : 'Suggested'}: ${linked.shipName} · ${linked.sailDate}` : state === 'unlinked' ? 'Explicitly unlinked' : 'No confident earning-cruise match'}</Text></View><Text style={[styles.badge,state==='confirmed'?styles.confirmed:state==='unlinked'?styles.unlinked:styles.review]}>{state==='confirmed'?'CONFIRMED':state==='unlinked'?'UNLINKED':linked?'SUGGESTED':'NEEDS REVIEW'}</Text></View>
          <View style={styles.evidenceGrid}>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>Certificate threshold</Text><Text style={styles.evidenceValue}>{pointValue ? `${pointValue.toLocaleString()} pts` : 'Missing'}</Text></View>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>Saved cruise points</Text><Text style={styles.evidenceValue}>{actualPoints == null ? 'Missing' : `${actualPoints.toLocaleString()} pts`}</Text></View>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>Certificate issued</Text><Text style={styles.evidenceValue}>{issueDate}</Text></View>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>Earning cruise</Text><Text style={styles.evidenceValue}>{earningShip} · {earningSailDate}</Text></View>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>Award / trade</Text><Text style={styles.evidenceValue}>{certificate.awardType || formatMoney(awardValue)}</Text></View>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>Expires</Text><Text style={styles.evidenceValue}>{certificate.expiryDate || 'Missing'}</Text></View>
            <View style={styles.evidenceCell}><Text style={styles.evidenceLabel}>PDF sailings</Text><Text style={styles.evidenceValue}>{parsedRows.toLocaleString()}</Text></View>
            <View style={[styles.evidenceCell, { width: '100%' }]}><Text style={styles.evidenceLabel}>Relationship confidence</Text><Text style={styles.evidenceValue}>{confidenceText}</Text></View>
          </View>
          {(certificate.earningMatchReason || inference?.matchReason || inference?.warnings?.[0]) ? <Text style={styles.reasonText}>{certificate.earningMatchReason || inference?.matchReason || inference?.warnings?.[0]}</Text> : null}
          <View style={styles.actions}><TouchableOpacity style={styles.primary} onPress={()=>setSelectedId(certificate.id)}><Link2 size={16} color="#fff"/><Text style={styles.primaryText}>{linked?'Reassign':'Assign cruise'}</Text></TouchableOpacity>{linked && state!=='confirmed'?<TouchableOpacity style={styles.secondary} onPress={()=>assign(linked.id)} testID={`certificate-link-confirm-${certificate.id}`}><CheckCircle2 size={16} color="#0b766d"/><Text style={styles.secondaryText}>Confirm suggestion</Text></TouchableOpacity>:null}<TouchableOpacity style={styles.secondary} onPress={()=>unlink(certificate.id)}><Link2Off size={16} color="#a53a3a"/><Text style={[styles.secondaryText,{color:'#a53a3a'}]}>Unlink</Text></TouchableOpacity>{parsedRows > 0 && certificate.certificateCode ? <TouchableOpacity style={styles.secondary} onPress={() => router.push({ pathname: '/certificate-lookup', params: { certificateCode: certificate.certificateCode, certificateType: certificate.certificateFamily || 'ALL' } })} testID={`certificate-link-sailings-${certificate.id}`}><ListFilter size={16} color="#0b766d"/><Text style={styles.secondaryText}>View {parsedRows.toLocaleString()} eligible rows</Text></TouchableOpacity> : null}</View>
        </View>;
      })}
      {!earnedCertificateRows.length?<View style={styles.card}><Text style={styles.meta}>No downloaded or manually entered certificates are available for this profile.</Text></View>:null}
    </ScrollView>
    <Modal visible={Boolean(selectedId)} transparent animationType="fade" onRequestClose={()=>setSelectedId(null)}><View style={styles.overlay}><View style={styles.sheet}><View style={styles.row}><Text style={styles.sheetTitle}>Select earning cruise</Text><TouchableOpacity onPress={()=>setSelectedId(null)}><X size={20} color="#17354d"/></TouchableOpacity></View><ScrollView style={{maxHeight:460}}>{completed.map((cruise)=><TouchableOpacity key={cruise.id} style={styles.cruise} onPress={()=>assign(cruise.id)}><Text style={styles.cruiseTitle}>{cruise.shipName}</Text><Text style={styles.meta}>{cruise.sailDate}–{cruise.returnDate || 'return unknown'} · {cruise.reservationNumber || cruise.bookingId || 'no reservation number'}</Text></TouchableOpacity>)}</ScrollView></View></View></Modal>
  </SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F3F3F2'},header:{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:'#D5D5D0',backgroundColor:'#FFFFFF'},back:{flexDirection:'row',alignItems:'center'},backText:{color:'#1C2F7A',fontWeight:'700'},headerTitle:{color:'#1C2F7A',fontWeight:'900',fontSize:17,marginLeft:18},content:{padding:16,paddingBottom:50,gap:12},intro:{color:'#676A70',lineHeight:20,marginBottom:4},summaryCard:{backgroundColor:'#FFFFFF',borderRadius:16,padding:15,borderWidth:1,borderColor:'#D5D5D0',gap:5},summaryEyebrow:{color:'#0E7FA7',fontSize:11,fontWeight:'900',letterSpacing:1.2,textTransform:'uppercase'},summaryTitle:{color:'#1C2F7A',fontSize:18,fontWeight:'900'},summaryText:{color:'#676A70',fontSize:12,lineHeight:18,fontWeight:'600'},card:{backgroundColor:'#fff',borderRadius:15,padding:14,gap:12},row:{flexDirection:'row',alignItems:'center',gap:10},code:{fontSize:15,fontWeight:'900',color:'#123754'},meta:{fontSize:12,color:'#637988',lineHeight:17,marginTop:3},badge:{fontSize:9,fontWeight:'900',paddingHorizontal:8,paddingVertical:5,borderRadius:9,overflow:'hidden'},confirmed:{color:'#08735e',backgroundColor:'#d9f5ec'},unlinked:{color:'#9a3434',backgroundColor:'#fee3e3'},review:{color:'#986312',backgroundColor:'#fff0c8'},evidenceGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},evidenceCell:{width:'48%',backgroundColor:'#eff6ff',borderRadius:10,padding:9,borderWidth:1,borderColor:'#d7e8f7'},evidenceLabel:{fontSize:9,color:'#607384',fontWeight:'900',textTransform:'uppercase',letterSpacing:.5},evidenceValue:{fontSize:12,color:'#123754',fontWeight:'800',marginTop:3},reasonText:{fontSize:11,color:'#4b6474',lineHeight:16,fontWeight:'600'},actions:{flexDirection:'row',flexWrap:'wrap',gap:8},primary:{backgroundColor:'#0b766d',borderRadius:10,paddingHorizontal:11,paddingVertical:9,flexDirection:'row',gap:6,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'800',fontSize:12},secondary:{borderWidth:1,borderColor:'#c9d8e2',borderRadius:10,paddingHorizontal:11,paddingVertical:9,flexDirection:'row',gap:6,alignItems:'center'},secondaryText:{color:'#0b766d',fontWeight:'800',fontSize:12},overlay:{flex:1,backgroundColor:'rgba(0,0,0,.65)',justifyContent:'center',padding:22},sheet:{backgroundColor:'#fff',borderRadius:17,padding:16,maxHeight:560},sheetTitle:{fontSize:17,fontWeight:'900',color:'#17354d'},cruise:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#e5edf2'},cruiseTitle:{fontWeight:'800',color:'#17354d'}});
