import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, Columns3, Link2, Search, Sparkles } from 'lucide-react-native';

import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import { buildCertificatePortfolioMatrix, type CertificatePortfolioSignal } from '@/lib/certificates/certificatePortfolioMatrix';
import { optimizeCertificateRedemption } from '@/lib/intelligence/certificateRedemptionOptimizer';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCoreData } from '@/state/CoreDataProvider';

type MatrixFilter = 'all' | CertificatePortfolioSignal;

const FILTERS: Array<{ key: MatrixFilter; label: string }> = [
  { key: 'all', label: 'All codes' },
  { key: 'overlap', label: 'Overlaps' },
  { key: 'unique', label: 'Unique access' },
  { key: 'certificate_only', label: 'Certificate-only' },
  { key: 'dominated', label: 'Poor-value review' },
  { key: 'expiring', label: 'Expiring' },
];

function compact(values: string[], empty = '—'): string {
  if (values.length === 0) return empty;
  if (values.length <= 3) return values.join('\n');
  return `${values.slice(0, 3).join('\n')}\n+${values.length - 3} more`;
}

function signalLabel(signal: CertificatePortfolioSignal): string {
  if (signal === 'certificate_only') return 'Certificate-only';
  if (signal === 'dominated') return 'Poor-value review';
  if (signal === 'unique') return 'Unique access';
  if (signal === 'expiring') return 'Expiring';
  return 'Overlap';
}

export default function CertificatePortfolioScreen() {
  const router = useRouter();
  const { casinoOffers } = useCoreData();
  const { certificates, searchableCertificates, refreshCertificateDocuments } = useCertificates();
  const [filter, setFilter] = useState<MatrixFilter>('all');
  const [optimizerCode, setOptimizerCode] = useState<string>('');

  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => void refreshCertificateDocuments());
    return () => interaction.cancel();
  }, [refreshCertificateDocuments]);

  const matches = useMemo(() => buildLocalCertificateSailingIndex(searchableCertificates), [searchableCertificates]);
  const report = useMemo(() => buildCertificatePortfolioMatrix(matches, casinoOffers, certificates), [casinoOffers, certificates, matches]);
  const visibleRows = useMemo(() => filter === 'all' ? report.rows : report.rows.filter((row) => row.signals.includes(filter)), [filter, report.rows]);
  const selectedOptimizerCode = optimizerCode || report.rows[0]?.certificateCode || '';
  const optimizerResults = useMemo(() => selectedOptimizerCode ? optimizeCertificateRedemption(matches, { certificateCode: selectedOptimizerCode, expiryDate: report.rows.find((row) => row.certificateCode === selectedOptimizerCode)?.expiresAt }) : [], [matches, report.rows, selectedOptimizerCode]);

  const openCode = useCallback((certificateCode: string) => {
    router.push({ pathname: '/certificate-lookup', params: { certificateCode, query: certificateCode } });
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#10223A', '#183C63', '#0E7FA7']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-portfolio.back">
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerIcon}><Columns3 size={17} color="#FFFFFF" /></View>
        </View>
        <Text style={styles.eyebrow}>Certificate intelligence</Text>
        <Text style={styles.title}>Portfolio Matrix</Text>
        <Text style={styles.subtitle}>Compare locally parsed certificate codes across ships, sailing months, cabins, and departure ports without adding these sailings to Available Cruises.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.ledgerButton} onPress={() => router.push('/certificate-stacking-ledger')} testID="certificate-portfolio.stacking-ledger">
          <Link2 size={17} color="#FFFFFF" />
          <View style={styles.ledgerButtonCopy}>
            <Text style={styles.ledgerButtonTitle}>Stacking Rules Ledger</Text>
            <Text style={styles.ledgerButtonText}>Record verified, host-confirmed, inferred, and unknown combination rules.</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.summaryGrid} testID="certificate-portfolio.summary">
          {[
            ['Codes', report.certificateCount],
            ['Sailings', report.sailingCount],
            ['Overlaps', report.overlapSailingCount],
            ['Unique', report.uniqueAccessCount],
            ['Cert-only', report.certificateOnlyCount],
            ['Review', report.dominatedUseCount],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{Number(value).toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((entry) => (
            <TouchableOpacity key={entry.key} style={[styles.filterChip, filter === entry.key && styles.filterChipActive]} onPress={() => setFilter(entry.key)} testID={`certificate-portfolio.filter-${entry.key}`}>
              <Text style={[styles.filterText, filter === entry.key && styles.filterTextActive]}>{entry.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.explainer}>
          <Sparkles size={16} color="#0F766E" />
          <Text style={styles.explainerText}>Poor-value review means another saved certificate requires no more points and has equal-or-better recorded cabin, FreePlay, and OBC for that same sailing. Certificate-only means no exact dated current offer record matched; always verify live availability and terms.</Text>
        </View>

        {report.rows.length > 0 ? <View style={styles.optimizerCard} testID="certificate-redemption-optimizer"><Text style={styles.optimizerTitle}>Redemption Optimizer</Text><Text style={styles.optimizerText}>Ranks only locally parsed eligible sailings. Add airfare, taxes, and upgrade costs before treating the result as high confidence.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{report.rows.map((row) => <TouchableOpacity key={row.certificateCode} style={[styles.filterChip,selectedOptimizerCode===row.certificateCode&&styles.filterChipActive]} onPress={()=>setOptimizerCode(row.certificateCode)}><Text style={[styles.filterText,selectedOptimizerCode===row.certificateCode&&styles.filterTextActive]}>{row.certificateCode}</Text></TouchableOpacity>)}</ScrollView>{optimizerResults.slice(0,3).map((result,index)=><TouchableOpacity key={result.sailingKey} style={styles.optimizerResult} onPress={()=>router.push({pathname:'/certificate-lookup',params:{certificateCode:selectedOptimizerCode,query:`${result.shipName} ${result.sailDate}`}})}><View style={styles.optimizerRank}><Text style={styles.optimizerRankText}>{index+1}</Text></View><View style={styles.optimizerCopy}><Text style={styles.optimizerShip}>{result.shipName} · {result.sailDate}</Text><Text style={styles.optimizerMeta}>{result.cabinLabel||'Cabin missing'} · score {result.opportunityScore}/100 · {result.confidence} confidence</Text><Text style={styles.optimizerMissing}>{result.missingData.length?`Still needed: ${result.missingData.join(', ')}`:'Core costs recorded'}</Text></View></TouchableOpacity>)}</View>:null}

        {report.rows.length === 0 ? (
          <View style={styles.emptyCard} testID="certificate-portfolio.empty">
            <AlertTriangle size={24} color="#92400E" />
            <Text style={styles.emptyTitle}>No parsed certificate matrix yet</Text>
            <Text style={styles.emptyText}>Open Certificate Codes, use Download All, and return here after the PDFs finish parsing.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/certificate-codes')}>
              <Text style={styles.primaryButtonText}>Open Certificate Codes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.matrixScroll}>
            <View testID="certificate-portfolio.matrix">
              <View style={[styles.matrixRow, styles.matrixHeader]}>
                <Text style={[styles.cell, styles.codeCell, styles.headerText]}>Certificate</Text>
                <Text style={[styles.cell, styles.countCell, styles.headerText]}>Sailings</Text>
                <Text style={[styles.cell, styles.wideCell, styles.headerText]}>Ships</Text>
                <Text style={[styles.cell, styles.monthCell, styles.headerText]}>Months</Text>
                <Text style={[styles.cell, styles.wideCell, styles.headerText]}>Cabins</Text>
                <Text style={[styles.cell, styles.wideCell, styles.headerText]}>Departure ports</Text>
                <Text style={[styles.cell, styles.signalCell, styles.headerText]}>Signals</Text>
              </View>
              {visibleRows.map((row) => (
                <TouchableOpacity key={row.certificateCode} style={styles.matrixRow} onPress={() => openCode(row.certificateCode)} testID={`certificate-portfolio.row-${row.certificateCode}`}>
                  <View style={[styles.cell, styles.codeCell]}>
                    <Text style={styles.codeText}>{row.certificateCode}</Text>
                    <Text style={styles.pointsText}>{row.points == null ? 'Points unknown' : `${row.points.toLocaleString()} pts`}</Text>
                  </View>
                  <Text style={[styles.cell, styles.countCell, styles.bodyText]}>{row.sailingCount.toLocaleString()}</Text>
                  <Text style={[styles.cell, styles.wideCell, styles.bodyText]}>{compact(row.ships)}</Text>
                  <Text style={[styles.cell, styles.monthCell, styles.bodyText]}>{compact(row.months)}</Text>
                  <Text style={[styles.cell, styles.wideCell, styles.bodyText]}>{compact(row.cabins)}</Text>
                  <Text style={[styles.cell, styles.wideCell, styles.bodyText]}>{compact(row.departurePorts)}</Text>
                  <View style={[styles.cell, styles.signalCell, styles.signalWrap]}>
                    {row.signals.length === 0 ? <Text style={styles.bodyText}>No flags</Text> : row.signals.map((signal) => (
                      <View key={signal} style={[styles.signalChip, signal === 'dominated' && styles.signalWarning]}>
                        <Text style={styles.signalText}>{signalLabel(signal)}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {visibleRows.length === 0 && report.rows.length > 0 ? (
          <View style={styles.noFilterCard}><Search size={18} color={COLORS.navyDeep} /><Text style={styles.emptyText}>No certificate codes match this matrix filter.</Text></View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF7FA' },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, paddingTop: SPACING.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#9FE7F5', fontSize: 11, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 31, fontWeight: '900', marginTop: 5 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 20, marginTop: SPACING.sm },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  ledgerButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#0F766E', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.sm },
  ledgerButtonCopy: { flex: 1 },
  ledgerButtonTitle: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '900' },
  ledgerButtonText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  summaryCard: { width: '31%', minWidth: 90, backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#CFE3EA', ...SHADOW.sm },
  summaryValue: { color: COLORS.navyDeep, fontSize: 21, fontWeight: '900' },
  summaryLabel: { color: '#5B6B7B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  filterRow: { gap: SPACING.xs, paddingVertical: SPACING.lg },
  filterChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 999, paddingHorizontal: SPACING.md, paddingVertical: 9 },
  filterChipActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep },
  filterText: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  explainer: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: '#E7F7F4', borderColor: '#99D9CE', borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg },
  explainerText: { flex: 1, color: '#24534C', fontSize: 12, lineHeight: 18 },
  matrixScroll: { paddingBottom: SPACING.sm },
  matrixRow: { width: 1090, minHeight: 80, flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D8E5EA' },
  matrixHeader: { minHeight: 46, backgroundColor: COLORS.navyDeep, borderTopLeftRadius: BORDER_RADIUS.lg, borderTopRightRadius: BORDER_RADIUS.lg },
  cell: { padding: SPACING.sm, borderRightWidth: 1, borderRightColor: '#D8E5EA' },
  codeCell: { width: 150, justifyContent: 'center' },
  countCell: { width: 80, textAlign: 'center' },
  monthCell: { width: 120 },
  wideCell: { width: 180 },
  signalCell: { width: 200 },
  headerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  bodyText: { color: '#304659', fontSize: 12, lineHeight: 17 },
  codeText: { color: COLORS.navyDeep, fontSize: 14, fontWeight: '900' },
  pointsText: { color: '#64748B', fontSize: 11, marginTop: 3 },
  signalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  signalChip: { backgroundColor: '#DDF5EF', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  signalWarning: { backgroundColor: '#FEF3C7' },
  signalText: { color: '#264E47', fontSize: 10, fontWeight: '800' },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFF8E8', borderColor: '#F3D28D', borderWidth: 1, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { color: '#78350F', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#5B6B7B', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 20, textAlign: 'center' },
  primaryButton: { marginTop: SPACING.sm, backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  noFilterCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  optimizerCard:{backgroundColor:'#FFFFFF',borderRadius:BORDER_RADIUS.xl,borderWidth:1,borderColor:'#B8D1DC',padding:SPACING.lg,marginBottom:SPACING.lg,...SHADOW.sm},
  optimizerTitle:{color:COLORS.navyDeep,fontSize:18,fontWeight:'900'},optimizerText:{color:'#526779',fontSize:11,lineHeight:17,marginTop:4},optimizerResult:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#EEF7FA',borderRadius:12,padding:11,marginTop:7},optimizerRank:{width:29,height:29,borderRadius:15,backgroundColor:'#0F766E',alignItems:'center',justifyContent:'center'},optimizerRankText:{color:'#FFFFFF',fontWeight:'900'},optimizerCopy:{flex:1},optimizerShip:{color:COLORS.navyDeep,fontSize:12,fontWeight:'900'},optimizerMeta:{color:'#3B5568',fontSize:10,marginTop:2,textTransform:'capitalize'},optimizerMissing:{color:'#92400E',fontSize:9,marginTop:3},
});
