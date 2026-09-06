import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, Columns3, Link2, Search, Sparkles } from 'lucide-react-native';

import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import { buildCertificatePortfolioMatrix, type CertificatePortfolioSignal } from '@/lib/certificates/certificatePortfolioMatrix';
import { evaluateCertificateRedemptions } from '@/lib/intelligence/certificateRedemptionOptimizer';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { EntityProvenanceDisclosure } from '@/components/ui/EntityProvenanceDisclosure';
import { ProgressiveDisclosure } from '@/components/ui/ProgressiveDisclosure';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';

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
  const [requiredGuests, setRequiredGuests] = useState<1 | 2>(2);
  const [maxTravelCost, setMaxTravelCost] = useState<string>('');
  const [excludedShips, setExcludedShips] = useState<string[]>([]);
  const [travelCostBySailing, setTravelCostBySailing] = useState<Record<string, number>>({});
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    const interaction = runAfterUiSettles(() => void refreshCertificateDocuments());
    return () => interaction.cancel();
  }, [refreshCertificateDocuments]);

  const matches = useMemo(() => buildLocalCertificateSailingIndex(searchableCertificates), [searchableCertificates]);
  const report = useMemo(() => buildCertificatePortfolioMatrix(matches, casinoOffers, certificates), [casinoOffers, certificates, matches]);
  const visibleRows = useMemo(() => filter === 'all' ? report.rows : report.rows.filter((row) => row.signals.includes(filter)), [filter, report.rows]);
  const selectedOptimizerCode = optimizerCode || report.rows[0]?.certificateCode || '';
  const selectedCertificate = searchableCertificates.find((row) => String((row as any).certificateCode ?? (row as any).label ?? '').toUpperCase() === selectedOptimizerCode.toUpperCase());
  const optimizerEvaluation = useMemo(() => {
    if (!selectedOptimizerCode) return { recommendations: [], excluded: [] };
    const recordedKeys = Object.keys(travelCostBySailing);
    return evaluateCertificateRedemptions(matches, {
      certificateCode: selectedOptimizerCode,
      expiryDate: report.rows.find((row) => row.certificateCode === selectedOptimizerCode)?.expiresAt,
      requiredGuestCount: requiredGuests,
      excludedShips,
      maxTravelCost: maxTravelCost.trim() ? Number(maxTravelCost) : undefined,
      airfareBySailing: travelCostBySailing,
      taxesBySailing: Object.fromEntries(recordedKeys.map((key) => [key, 0])),
      upgradeBySailing: Object.fromEntries(recordedKeys.map((key) => [key, 0])),
    });
  }, [excludedShips, matches, maxTravelCost, report.rows, requiredGuests, selectedOptimizerCode, travelCostBySailing]);
  const optimizerResults = optimizerEvaluation.recommendations;

  const openCode = useCallback((certificateCode: string) => {
    router.push({ pathname: '/certificate-lookup', params: { certificateCode, query: certificateCode } });
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#E8F3F7', '#FBF8F2', '#F2EEE6']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-portfolio.back">
            <ChevronLeft size={20} color="#1C2F7A" />
          </TouchableOpacity>
          <View style={styles.headerIcon}><Columns3 size={17} color="#0E7FA7" /></View>
        </View>
        <Text style={styles.eyebrow}>Certificate intelligence</Text>
        <Text style={styles.title}>Portfolio Matrix</Text>
        <Text style={styles.subtitle}>Compare locally parsed certificate codes across ships, sailing months, cabins, and departure ports without adding these sailings to Available Cruises.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TabIdentityBand tab="offers" compact detail={`${report.certificateCount.toLocaleString()} parsed code${report.certificateCount === 1 ? '' : 's'} · ${report.sailingCount.toLocaleString()} eligible rows`} testID="certificate-portfolio-story-card" />
        <TouchableOpacity style={styles.ledgerButton} onPress={() => router.push('/certificate-stacking-ledger')} testID="certificate-portfolio.stacking-ledger">
          <Link2 size={17} color="#FFFFFF" />
          <View style={styles.ledgerButtonCopy}>
            <Text style={styles.ledgerButtonTitle}>Stacking Rules Ledger</Text>
            <Text style={styles.ledgerButtonText}>Record verified, host-confirmed, inferred, and unknown combination rules.</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ledgerButton} onPress={() => router.push('/certificate-substitution')} testID="certificate-portfolio.substitution-analysis"><Columns3 size={17} color="#FFFFFF"/><View style={styles.ledgerButtonCopy}><Text style={styles.ledgerButtonTitle}>Certificate Substitution Analysis</Text><Text style={styles.ledgerButtonText}>Compare adjacent levels, unique access, overlap, cabin, guests, and exact contributing rows.</Text></View></TouchableOpacity>
        <ProgressiveDisclosure ownerId="shared-certificates" screenId="certificate-portfolio" sectionId="portfolio-evidence" title="Portfolio conclusions" conclusions={[{ id: 'codes', label: 'Parsed codes', value: report.certificateCount.toLocaleString(), status: report.certificateCount ? 'success' : 'missing' }, { id: 'sailings', label: 'Eligible rows', value: report.sailingCount.toLocaleString(), status: report.sailingCount ? 'info' : 'missing' }, { id: 'review', label: 'Needs value review', value: report.dominatedUseCount.toLocaleString(), status: report.dominatedUseCount ? 'warning' : 'success' }]}><Text style={styles.explainerText}>Counts come from the locally parsed certificate-to-sailing index. Expand this section for evidence definitions; use the matrix and optimizer below for the contributing rows and scoring factors.</Text></ProgressiveDisclosure>
        <ThemedSectionHeader tab="offers" emoji="📊" title="Certificate summary" subtitle="Counts, overlap, scarcity, and value-review signals from parsed rows." tone="info" compact />
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

        {report.rows.length > 0 ? <View style={styles.optimizerCard} testID="certificate-redemption-optimizer">
          <ThemedSectionHeader tab="offers" emoji="🧭" title="Best-use certificate optimizer" subtitle="Rank eligible sailings using cabin, guests, itinerary, cost, schedule, expiration, and scarcity." tone="success" compact />
          <Text style={styles.optimizerText}>Ranks locally parsed certificate/sailing combinations using cabin, guests, itinerary, travel cost, schedule, expiration, scarcity, and saved ship preferences. Hard exclusions are honored before scoring.</Text>
          <EntityProvenanceDisclosure ownerId={null} entityType="certificate" entityId={String((selectedCertificate as any)?.id ?? selectedOptimizerCode)} field="certificateCode" label="Certificate PDF evidence" fallback={{ sourceType: 'parsed_certificate', observedAt: String((selectedCertificate as any)?.parsedAt ?? (selectedCertificate as any)?.updatedAt ?? new Date().toISOString()), ownerId: null, confidence: (selectedCertificate as any)?.parserStatus === 'success' ? 'high' : 'medium', sourceRecord: String((selectedCertificate as any)?.sourcePdfUrl ?? (selectedCertificate as any)?.sourceDocumentArchiveUri ?? selectedOptimizerCode), formula: null, provider: 'Club Royale certificate PDF', sourceHash: String((selectedCertificate as any)?.sourceDocumentHash ?? '') || null, notes: null }} />
          <View style={styles.optimizerControls} testID="certificate-optimizer-controls">
            <Text style={styles.optimizerControlLabel}>Required occupancy</Text>
            <View style={styles.optimizerControlRow}>{([1, 2] as const).map((guests) => <TouchableOpacity key={guests} style={[styles.optimizerControlChip, requiredGuests === guests && styles.optimizerControlChipActive]} onPress={() => setRequiredGuests(guests)}><Text style={[styles.optimizerControlText, requiredGuests === guests && styles.optimizerControlTextActive]}>{guests} guest{guests === 1 ? '' : 's'}</Text></TouchableOpacity>)}</View>
            <Text style={styles.optimizerControlLabel}>Maximum total trip cost (optional)</Text>
            <TextInput style={styles.optimizerInput} value={maxTravelCost} onChangeText={(value) => setMaxTravelCost(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="No maximum" accessibilityLabel="Maximum total trip cost" />
            {excludedShips.length ? <View><Text style={styles.optimizerControlLabel}>Excluded ships</Text><View style={styles.optimizerControlRow}>{excludedShips.map((ship) => <TouchableOpacity key={ship} style={styles.excludedChip} onPress={() => setExcludedShips((current) => current.filter((value) => value !== ship))}><Text style={styles.excludedText}>{ship} · restore</Text></TouchableOpacity>)}</View></View> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{report.rows.map((row) => <TouchableOpacity key={row.certificateCode} style={[styles.filterChip,selectedOptimizerCode===row.certificateCode&&styles.filterChipActive]} onPress={()=>setOptimizerCode(row.certificateCode)}><Text style={[styles.filterText,selectedOptimizerCode===row.certificateCode&&styles.filterTextActive]}>{row.certificateCode}</Text></TouchableOpacity>)}</ScrollView>
          {optimizerResults.slice(0,3).map((result,index)=><View key={result.sailingKey} style={styles.optimizerResult}><TouchableOpacity style={styles.optimizerResultMain} onPress={()=>router.push({pathname:'/certificate-lookup',params:{certificateCode:selectedOptimizerCode,query:`${result.shipName} ${result.sailDate}`}})}><View style={styles.optimizerRank}><Text style={styles.optimizerRankText}>{index+1}</Text></View><View style={styles.optimizerCopy}><Text style={styles.optimizerShip}>{result.shipName} · {result.sailDate}</Text><Text style={styles.optimizerMeta}>{result.cabinLabel||'Cabin missing'} · {result.guestCount == null ? 'guest count missing' : `${result.guestCount} guest(s)`} · score {result.opportunityScore}/100</Text><Text style={styles.optimizerFactor}>• {result.departurePort || 'Departure port missing'} · {result.itinerary || 'Itinerary missing'}</Text>{result.rankingFactors.slice(0,4).map((factor)=><Text key={factor.id} style={styles.optimizerFactor}>• {factor.label}: {factor.explanation}</Text>)}<Text style={styles.optimizerMissing}>{result.missingData.length?`Still needed: ${result.missingData.join(', ')}`:result.alternativeReason}</Text></View></TouchableOpacity><View style={styles.optimizerResultActions}><TextInput style={styles.optimizerCostInput} value={travelCostBySailing[result.sailingKey] == null ? '' : String(travelCostBySailing[result.sailingKey])} onChangeText={(value) => setTravelCostBySailing((current) => { const parsed = Number(value.replace(/[^0-9.]/g, '')); const next = { ...current }; if (!value.trim() || !Number.isFinite(parsed)) delete next[result.sailingKey]; else next[result.sailingKey] = parsed; return next; })} keyboardType="decimal-pad" placeholder="Total trip cost" accessibilityLabel={`Total trip cost for ${result.shipName} ${result.sailDate}`} /><TouchableOpacity style={styles.excludeButton} onPress={() => setExcludedShips((current) => current.includes(result.shipName) ? current : [...current, result.shipName])}><Text style={styles.excludeText}>Exclude ship</Text></TouchableOpacity></View></View>)}
          {optimizerResults.length === 0 ? <View style={styles.optimizerEmpty}><AlertTriangle size={18} color="#92400E"/><Text style={styles.optimizerMissing}>No sailing meets the selected certificate, occupancy, expiration, ship, schedule, and travel-cost rules. Restore an excluded ship or loosen a constraint; no ineligible row was silently selected.</Text></View> : null}
          {optimizerEvaluation.excluded.length > 0 ? <View style={styles.excludedReview} testID="certificate-optimizer-excluded-review"><TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showExcluded }} style={styles.excludedReviewButton} onPress={() => setShowExcluded((value) => !value)}><AlertTriangle size={16} color="#92400E"/><Text style={styles.excludedReviewTitle}>{showExcluded ? 'Hide' : 'Review'} {optimizerEvaluation.excluded.length.toLocaleString()} excluded sailing{optimizerEvaluation.excluded.length === 1 ? '' : 's'}</Text></TouchableOpacity>{showExcluded ? optimizerEvaluation.excluded.slice(0, 20).map((result) => <View key={`excluded-${result.sailingKey}`} style={styles.excludedResult}><Text style={styles.optimizerShip}>{result.shipName} · {result.sailDate}</Text><Text style={styles.optimizerMeta}>{result.cabinLabel || 'Cabin missing'} · {result.guestCount == null ? 'guest count missing' : `${result.guestCount} guest(s)`} · {result.departurePort || 'port missing'}</Text>{result.hardExclusionReasons.map((reason) => <Text key={reason} style={styles.optimizerMissing}>• {reason}</Text>)}</View>) : null}{showExcluded && optimizerEvaluation.excluded.length > 20 ? <Text style={styles.optimizerMissing}>Showing 20 of {optimizerEvaluation.excluded.length.toLocaleString()} exclusions. Narrow the certificate or constraints to review a smaller set.</Text> : null}</View> : null}
          <TouchableOpacity style={styles.optimizerAgentButton} onPress={()=>router.push({pathname:'/ask-my-data',params:{prompt:`Compare the ranked sailing choices for certificate ${selectedOptimizerCode}. Explain cabin, guests, itinerary, travel cost, schedule, expiration, scarcity, missing inputs, and practical alternatives.`}} as never)} testID="certificate-optimizer-agent-sea"><Sparkles size={16} color="#FFFFFF"/><Text style={styles.optimizerAgentText}>Ask Agent SEA about these ranked results</Text></TouchableOpacity>
        </View>:null}

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
              <ThemedSectionHeader tab="offers" emoji="🧾" title="Certificate-by-sailing matrix" subtitle="Every parsed code and the exact rows that support its counts." compact />
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
  container: { flex: 1, backgroundColor: '#F3F3F2' },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, paddingTop: SPACING.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#D5D5D0', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F7FB', borderWidth: 1, borderColor: '#B8DDE8', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#0E7FA7', fontSize: 11, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 31, fontWeight: '700', marginTop: 5 },
  subtitle: { color: '#66737F', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 20, marginTop: SPACING.sm },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  ledgerButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#0F766E', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.sm },
  ledgerButtonCopy: { flex: 1 },
  ledgerButtonTitle: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '900' },
  ledgerButtonText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  summaryCard: { width: '31%', minWidth: 90, backgroundColor: '#FFFDF9', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#CFE3EA', ...SHADOW.sm },
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
  optimizerTitle:{color:COLORS.navyDeep,fontSize:18,fontWeight:'900'},optimizerText:{color:'#526779',fontSize:11,lineHeight:17,marginTop:4},
  optimizerControls:{backgroundColor:'#F4F8FA',borderRadius:12,padding:10,marginTop:10},optimizerControlLabel:{color:'#3B5568',fontSize:10,fontWeight:'800',marginTop:5,marginBottom:5},optimizerControlRow:{flexDirection:'row',flexWrap:'wrap',gap:6},optimizerControlChip:{minHeight:38,borderRadius:19,borderWidth:1,borderColor:'#B8D1DC',backgroundColor:'#FFFFFF',paddingHorizontal:13,alignItems:'center',justifyContent:'center'},optimizerControlChipActive:{backgroundColor:COLORS.navyDeep,borderColor:COLORS.navyDeep},optimizerControlText:{color:COLORS.navyDeep,fontSize:11,fontWeight:'800'},optimizerControlTextActive:{color:'#FFFFFF'},optimizerInput:{minHeight:44,borderRadius:10,borderWidth:1,borderColor:'#B8D1DC',backgroundColor:'#FFFFFF',paddingHorizontal:12,color:COLORS.navyDeep},excludedChip:{borderRadius:999,backgroundColor:'#FDE8E8',paddingHorizontal:9,paddingVertical:7},excludedText:{color:'#9B1C1C',fontSize:10,fontWeight:'800'},
  optimizerResult:{backgroundColor:'#EEF7FA',borderRadius:12,padding:11,marginTop:7},optimizerResultMain:{flexDirection:'row',alignItems:'flex-start',gap:10},optimizerRank:{width:29,height:29,borderRadius:15,backgroundColor:'#0F766E',alignItems:'center',justifyContent:'center'},optimizerRankText:{color:'#FFFFFF',fontWeight:'900'},optimizerCopy:{flex:1},optimizerShip:{color:COLORS.navyDeep,fontSize:12,fontWeight:'900'},optimizerMeta:{color:'#3B5568',fontSize:10,marginTop:2,textTransform:'capitalize'},optimizerFactor:{color:'#496578',fontSize:9,lineHeight:13,marginTop:2},optimizerMissing:{color:'#92400E',fontSize:9,marginTop:3},optimizerResultActions:{flexDirection:'row',gap:7,marginTop:9},optimizerCostInput:{flex:1,minHeight:40,borderRadius:9,borderWidth:1,borderColor:'#B8D1DC',backgroundColor:'#FFFFFF',paddingHorizontal:10,color:COLORS.navyDeep,fontSize:11},excludeButton:{minHeight:40,borderRadius:9,borderWidth:1,borderColor:'#E7A5A5',backgroundColor:'#FFF6F6',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},excludeText:{color:'#9B1C1C',fontSize:10,fontWeight:'800'},optimizerEmpty:{flexDirection:'row',gap:8,alignItems:'flex-start',backgroundColor:'#FFF8E8',borderRadius:10,padding:10,marginTop:8},
  optimizerAgentButton:{marginTop:SPACING.md,backgroundColor:'#0F766E',borderRadius:BORDER_RADIUS.md,padding:SPACING.md,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:SPACING.sm},optimizerAgentText:{color:'#FFFFFF',fontSize:12,fontWeight:'900'},
  excludedReview:{marginTop:10,borderRadius:12,borderWidth:1,borderColor:'#F3D28D',backgroundColor:'#FFF8E8',padding:10},excludedReviewButton:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8},excludedReviewTitle:{color:'#78350F',fontWeight:'900',fontSize:12},excludedResult:{borderTopWidth:1,borderTopColor:'#F3D28D',paddingVertical:9},
});
