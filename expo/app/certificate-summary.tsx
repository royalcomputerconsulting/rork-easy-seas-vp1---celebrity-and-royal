import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, ChevronLeft, Columns3, Database, Filter, Grid3X3, List, ShieldCheck, Ship } from 'lucide-react-native';

import { CertificateSummaryFilterModal } from '@/components/certificates/CertificateSummaryFilterModal';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { getMonthCodeForTarget, getMonthLabelForTarget } from '@/lib/certificates/certificateCatalog';
import { useCertificateMonthAvailability } from '@/hooks/useCertificateMonthAvailability';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import {
  buildCertificateSummaryReport,
  filterCertificateSummaryOptions,
  flattenCertificateSummaryOptions,
  getCertificateSummaryQualityCounts,
  type CertificateSummaryFilter,
  type CertificateSummaryMetric,
  type CertificateSummaryOption,
  type CertificateSummaryQualityIssue,
} from '@/lib/certificates/certificateSummary';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { readCertificateSummaryUiState, writeCertificateSummaryUiState, type CertificateSummaryViewMode } from '@/lib/certificates/certificateSummaryUiState';
import { useCertificates } from '@/state/CertificatesProvider';

type MonthTarget = 'thisMonth' | 'nextMonth';
type SummaryTab = 'summary' | 'matrix' | 'sailings' | 'quality';
type MatrixDimension = 'class' | 'ship' | 'cabin' | 'port' | 'region' | 'month' | 'duration' | 'departure_day';

const TABS: Array<{ key: SummaryTab; label: string; icon: typeof Columns3 }> = [
  { key: 'summary', label: 'Summary', icon: Columns3 },
  { key: 'matrix', label: 'Ships & Classes', icon: Grid3X3 },
  { key: 'sailings', label: 'Sailings', icon: List },
  { key: 'quality', label: 'Data Quality', icon: ShieldCheck },
];

const DIMENSIONS: Array<{ key: MatrixDimension; label: string }> = [
  { key: 'class', label: 'Ship Class' }, { key: 'ship', label: 'Ship' },
  { key: 'cabin', label: 'Cabin' }, { key: 'port', label: 'Departure Port' },
  { key: 'region', label: 'Region' }, { key: 'month', label: 'Sailing Month' },
  { key: 'duration', label: 'Duration' }, { key: 'departure_day', label: 'Departure Day' },
];

const QUALITY: Array<{ key: CertificateSummaryQualityIssue; label: string; detail: string }> = [
  { key: 'missing_guest_count', label: 'Guest eligibility missing', detail: 'These rows cannot be counted as one- or two-guest options until the PDF evidence is repaired.' },
  { key: 'missing_nights', label: 'Cruise length missing', detail: 'Shortest/longest calculations exclude these rows.' },
  { key: 'missing_ship_class', label: 'Ship class missing', detail: 'The ship remains available but is excluded from class-specific matrix cells.' },
  { key: 'missing_departure_port', label: 'Departure port missing', detail: 'Florida and departure-port summaries cannot classify these rows.' },
  { key: 'missing_cabin', label: 'Cabin entitlement missing', detail: 'The sailing remains retained without inventing a cabin level.' },
  { key: 'not_accepted', label: 'Parser review required', detail: 'Rows with a recorded validation state other than accepted remain visible for review.' },
];

function firstParam(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function monthKey(target: MonthTarget): string { const code = getMonthCodeForTarget(target); return `20${code.slice(0, 2)}-${code.slice(2, 4)}`; }
function valueLabel(value: number | null): string { return value == null ? '—' : value.toLocaleString(); }
function countActiveFilters(filter: CertificateSummaryFilter): number {
  return Object.entries(filter).reduce((count, [key, value]) => {
    if (key === 'certificateMonths' || key === 'metric' || key === 'metricCertificateCode') return count;
    if (Array.isArray(value)) return count + value.length;
    return value === undefined || value === null || value === '' || value === false ? count : count + 1;
  }, 0);
}
function dimensionValue(option: CertificateSummaryOption, dimension: MatrixDimension): string {
  if (dimension === 'class') return option.shipClass || 'Class missing';
  if (dimension === 'ship') return option.shipName;
  if (dimension === 'cabin') return option.cabinLabel || 'Cabin missing';
  if (dimension === 'region') return option.region || 'Region missing';
  if (dimension === 'month') return option.sailDate.slice(0, 7) || 'Month missing';
  if (dimension === 'duration') return option.nights == null ? 'Duration missing' : `${option.nights} nights`;
  if (dimension === 'departure_day') return option.startDay || 'Day missing';
  return option.departurePort || 'Port missing';
}
function dimensionFilter(dimension: MatrixDimension, value: string): CertificateSummaryFilter {
  if (dimension === 'class' && value === 'Class missing') return { qualityIssues: ['missing_ship_class'] };
  if (dimension === 'cabin' && value === 'Cabin missing') return { qualityIssues: ['missing_cabin'] };
  if (dimension === 'port' && value === 'Port missing') return { qualityIssues: ['missing_departure_port'] };
  if (dimension === 'class') return { shipClasses: [value] };
  if (dimension === 'ship') return { shipNames: [value] };
  if (dimension === 'cabin') return { cabinLabels: [value] };
  if (dimension === 'region') return { regions: [value] };
  if (dimension === 'month') return { startDate: `${value}-01`, endDate: `${value}-31` };
  if (dimension === 'duration') { const nights = Number(value.match(/\d+/)?.[0]); return Number.isFinite(nights) ? { minimumNights: nights, maximumNights: nights } : { qualityIssues: ['missing_nights'] }; }
  if (dimension === 'departure_day') return { startDays: [value] };
  return { departurePorts: [value] };
}

export default function CertificateSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ monthTarget?: string }>();
  const monthAvailability = useCertificateMonthAvailability(10);
  const initialTarget = firstParam(params.monthTarget) === 'nextMonth' && monthAvailability.nextMonthAvailable ? 'nextMonth' : 'thisMonth';
  const restored = useMemo(() => readCertificateSummaryUiState(), []);
  const restoredTarget: MonthTarget = restored?.target === 'nextMonth' && !monthAvailability.nextMonthAvailable
    ? 'thisMonth'
    : restored?.target ?? initialTarget;
  const restoredFilter = restored?.filter
    ? { ...restored.filter, certificateMonths: [monthKey(restoredTarget)], metric: undefined, metricCertificateCode: undefined }
    : { certificateMonths: [monthKey(initialTarget)] };
  const [target, setTarget] = useState<MonthTarget>(restoredTarget);
  const [tab, setTab] = useState<SummaryTab>(restored?.tab ?? 'summary');
  const [matrixDimension, setMatrixDimension] = useState<MatrixDimension>(restored?.matrixDimension ?? 'class');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState<CertificateSummaryFilter>(restoredFilter);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(restored?.scrollOffset ?? 0);
  const priorCurrentMonthRef = useRef(monthAvailability.currentMonthCode);
  const { searchableCertificates, refreshCertificateDocuments } = useCertificates();
  useEffect(() => { const interaction = runAfterUiSettles(() => void refreshCertificateDocuments()); return () => interaction.cancel(); }, [refreshCertificateDocuments]);
  const matches = useMemo(() => buildLocalCertificateSailingIndex(searchableCertificates), [searchableCertificates]);
  const allOptions = useMemo(() => flattenCertificateSummaryOptions(matches), [matches]);
  const monthOptions = useMemo(() => filterCertificateSummaryOptions(allOptions, { certificateMonths: [monthKey(target)] }), [allOptions, target]);
  const report = useMemo(() => buildCertificateSummaryReport(matches, filter), [filter, matches]);
  const quality = useMemo(() => getCertificateSummaryQualityCounts(report.options), [report.options]);
  const activeFilters = countActiveFilters(filter);
  const changeMonth = (next: MonthTarget) => {
    if (next === 'nextMonth' && !monthAvailability.nextMonthAvailable) return;
    setTarget(next);
    setFilter((current) => ({ ...current, certificateMonths: [monthKey(next)], metric: undefined, metricCertificateCode: undefined }));
  };
  useEffect(() => {
    if (priorCurrentMonthRef.current === monthAvailability.currentMonthCode) return;
    priorCurrentMonthRef.current = monthAvailability.currentMonthCode;
    setTarget('thisMonth');
    setFilter((current) => ({ ...current, certificateMonths: [monthKey('thisMonth')], metric: undefined, metricCertificateCode: undefined }));
  }, [monthAvailability.currentMonthCode]);
  useEffect(() => { writeCertificateSummaryUiState({ target, tab, matrixDimension, filter, scrollOffset: scrollOffset.current }); }, [filter, matrixDimension, tab, target]);
  useEffect(() => { if (restored?.scrollOffset) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: restored.scrollOffset, animated: false })); }, [restored]);
  const openResults = (title: string, extra: CertificateSummaryFilter = {}, requestedView: CertificateSummaryViewMode = 'options') => {
    const view = title === 'All certificate options' ? 'certificate_codes' : title === 'Options grouped into physical sailings' ? 'physical_sailings' : requestedView;
    router.push({ pathname: '/certificate-summary-results', params: { title, view, filters: JSON.stringify({ ...filter, ...extra }) } });
  };
  const selectMetric = (code: string, metric: CertificateSummaryMetric, label: string) => openResults(`${code} · ${label}`, { metric, metricCertificateCode: code });
  const groupedDimensions = useMemo(() => report.rows.map((row) => { const counts = new Map<string, number>(); report.options.filter((option) => option.certificateCode === row.certificateCode).forEach((option) => { const value = dimensionValue(option, matrixDimension); counts.set(value, (counts.get(value) ?? 0) + 1); }); return { row, values: Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])) }; }), [matrixDimension, report.options, report.rows]);
  const topSailings = useMemo(() => report.options.slice().sort((left, right) => left.sailDate.localeCompare(right.sailDate)).slice(0, 8), [report.options]);

  return <SafeAreaView style={styles.container} edges={['top']}>
    <Stack.Screen options={{ headerShown: false }} />
    <LinearGradient colors={['#F3F3F2', '#FFFFFF', '#E8F7FB']} style={styles.header}><View style={styles.headerTop}><TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-summary.back"><ChevronLeft size={22} color="#1C2F7A" /></TouchableOpacity><View style={styles.headerIcon}><Columns3 size={18} color="#0E7FA7" /></View></View><Text style={styles.eyebrow}>Certificate intelligence</Text><Text style={styles.title}>Cert Summary</Text><Text style={styles.subtitle}>Every figure and matrix cell opens the exact locally parsed certificate rows behind it. Certificate options remain separate from Available Cruises.</Text></LinearGradient>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} onMomentumScrollEnd={() => writeCertificateSummaryUiState({ target, tab, matrixDimension, filter, scrollOffset: scrollOffset.current })} scrollEventThrottle={100}>
      <View style={styles.monthRow}>{(['thisMonth', 'nextMonth'] as MonthTarget[]).map((entry) => { const unavailable = entry === 'nextMonth' && !monthAvailability.nextMonthAvailable; return <TouchableOpacity key={entry} disabled={unavailable} accessibilityState={{ disabled: unavailable, selected: target === entry }} style={[styles.monthButton, target === entry && styles.monthButtonActive, unavailable && { opacity: 0.48 }]} onPress={() => changeMonth(entry)} testID={`certificate-summary.month-${entry}`}><Text style={[styles.monthButtonText, target === entry && styles.monthButtonTextActive]}>{entry === 'nextMonth' && unavailable ? `${monthAvailability.nextMonthLabel} · available ${monthAvailability.nextMonthOpensOnLabel}` : getMonthLabelForTarget(entry)}</Text></TouchableOpacity>; })}</View>
      <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersOpen(true)} testID="certificate-summary.open-filters"><Filter size={17} color="#FFFFFF" /><Text style={styles.filterButtonText}>{activeFilters ? `Filters (${activeFilters})` : 'Filter by ship, class, cabin, guests, date, points, and benefits'}</Text></TouchableOpacity>{activeFilters ? <TouchableOpacity style={styles.clearAllInline} onPress={() => setFilter({ certificateMonths: [monthKey(target)] })}><Text style={styles.clearAllInlineText}>Clear all filters</Text></TouchableOpacity> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>{TABS.map((entry) => { const Icon = entry.icon; return <TouchableOpacity key={entry.key} style={[styles.tab, tab === entry.key && styles.tabActive]} onPress={() => setTab(entry.key)} testID={`certificate-summary.tab-${entry.key}`}><Icon size={14} color={tab === entry.key ? '#FFFFFF' : COLORS.navyDeep} /><Text style={[styles.tabText, tab === entry.key && styles.tabTextActive]}>{entry.label}</Text></TouchableOpacity>; })}</ScrollView>

      {tab === 'summary' ? <><View style={styles.overviewGrid} testID="certificate-summary.overview"><TouchableOpacity style={styles.overviewCard} onPress={() => openResults('All certificate options')}><Text style={styles.overviewValue}>{report.certificateCount.toLocaleString()}</Text><Text style={styles.overviewLabel}>Codes</Text></TouchableOpacity><TouchableOpacity style={styles.overviewCard} onPress={() => openResults('All eligible certificate options')}><Text style={styles.overviewValue}>{report.totalOptions.toLocaleString()}</Text><Text style={styles.overviewLabel}>Eligible options</Text></TouchableOpacity><TouchableOpacity style={styles.overviewCard} onPress={() => openResults('Options grouped into physical sailings')}><Text style={styles.overviewValue}>{report.physicalSailingCount.toLocaleString()}</Text><Text style={styles.overviewLabel}>Physical sailings</Text></TouchableOpacity></View><View style={styles.definitionCard}><Filter size={17} color="#0F766E" /><Text style={styles.definitionText}>Option totals preserve certificate, cabin, guest, GTY, and benefit variants. Weekend means Friday, Saturday, or Sunday departure. Physical sailings are unique ship/date combinations.</Text></View>{report.rows.map((row) => <View key={row.certificateCode} style={styles.codeCard} testID={`certificate-summary.row-${row.certificateCode}`}><TouchableOpacity style={styles.codeHeader} onPress={() => selectMetric(row.certificateCode, 'all', 'All eligible options')}><View><Text style={styles.code}>{row.certificateCode}</Text><Text style={styles.points}>{row.points == null ? 'Points unknown' : `${row.points.toLocaleString()} points`}</Text></View><View style={styles.totalPill}><Text style={styles.totalPillValue}>{row.totalOptions.toLocaleString()}</Text><Text style={styles.totalPillLabel}>options</Text></View></TouchableOpacity><View style={styles.metricGrid}>{([['one_guest', row.oneGuestOptions, '1 guest'], ['two_guests', row.twoGuestOptions, '2 guests'], ['weekend_departure', row.weekendDepartures, 'Weekend'], ['florida_departure', row.floridaDepartures, 'Florida'], ['shortest', row.shortestNights, 'Shortest'], ['longest', row.longestNights, 'Longest']] as Array<[CertificateSummaryMetric, number | null, string]>).map(([metric, value, label]) => <TouchableOpacity key={metric} style={styles.metric} onPress={() => selectMetric(row.certificateCode, metric, label)}><Text style={styles.metricValue}>{valueLabel(value)}</Text><Text style={styles.metricLabel}>{label}</Text></TouchableOpacity>)}</View>{row.unknownGuestOptions > 0 ? <TouchableOpacity style={styles.warningRow} onPress={() => selectMetric(row.certificateCode, 'unknown_guests', 'Guest-count review')}><Text style={styles.warningText}>{row.unknownGuestOptions.toLocaleString()} option{row.unknownGuestOptions === 1 ? '' : 's'} need guest-count review</Text></TouchableOpacity> : null}</View>)}</> : null}

      {tab === 'matrix' ? <><Text style={styles.sectionTitle}>Compare certificate levels by dimension</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dimensionRow}>{DIMENSIONS.map((entry) => <TouchableOpacity key={entry.key} style={[styles.dimensionChip, matrixDimension === entry.key && styles.dimensionChipActive]} onPress={() => setMatrixDimension(entry.key)}><Text style={[styles.dimensionText, matrixDimension === entry.key && styles.dimensionTextActive]}>{entry.label}</Text></TouchableOpacity>)}</ScrollView>{groupedDimensions.map(({ row, values }) => <View key={row.certificateCode} style={styles.matrixCard}><View style={styles.matrixHeader}><View><Text style={styles.code}>{row.certificateCode}</Text><Text style={styles.points}>{row.points == null ? 'Points unknown' : `${row.points.toLocaleString()} points`}</Text></View><Text style={styles.matrixTotal}>{row.totalOptions.toLocaleString()} total</Text></View><View style={styles.matrixValues}>{values.slice(0, 18).map(([value, count]) => <TouchableOpacity key={value} style={styles.matrixCell} onPress={() => openResults(`${row.certificateCode} · ${value}`, { certificateCodes: [row.certificateCode], ...dimensionFilter(matrixDimension, value) })}><Text style={styles.matrixValue}>{count.toLocaleString()}</Text><Text style={styles.matrixLabel}>{value}</Text></TouchableOpacity>)}</View>{values.length > 18 ? <Text style={styles.moreText}>+{values.length - 18} more values available through Filters</Text> : null}</View>)}</> : null}

      {tab === 'sailings' ? <><TouchableOpacity style={styles.allSailingsCard} onPress={() => openResults(`${getMonthLabelForTarget(target)} certificate sailings`)} testID="certificate-summary.all-sailings"><View style={styles.allSailingsIcon}><Database size={22} color="#FFFFFF" /></View><View style={styles.flex}><Text style={styles.allSailingsTitle}>Open all {report.totalOptions.toLocaleString()} matching options</Text><Text style={styles.allSailingsText}>Virtualized paging, search, fourteen sort modes, evidence, benefits, PDF lookup, and Agent SEA actions.</Text></View></TouchableOpacity><Text style={styles.sectionTitle}>Soonest matching options</Text>{topSailings.map((option) => <TouchableOpacity key={option.optionId} style={styles.previewRow} onPress={() => openResults(`${option.certificateCode} · ${option.shipName}`, { certificateCodes: [option.certificateCode], shipNames: [option.shipName], startDate: option.sailDate, endDate: option.sailDate })}><View style={styles.previewIcon}><Ship size={16} color="#0E7FA7" /></View><View style={styles.flex}><Text style={styles.previewTitle}>{option.shipName} · {option.sailDate}</Text><Text style={styles.previewMeta}>{option.certificateCode} · {option.cabinLabel || 'Cabin missing'} · {option.guestCount == null ? 'Guests missing' : `${option.guestCount} guest${option.guestCount === 1 ? '' : 's'}`}</Text></View></TouchableOpacity>)}</> : null}

      {tab === 'quality' ? <><View style={styles.qualityIntro}><ShieldCheck size={19} color="#0F766E" /><Text style={styles.qualityIntroText}>Quality warnings never delete a sailing. Tap a figure to inspect the exact retained rows that need review.</Text></View>{QUALITY.map((item) => <TouchableOpacity key={item.key} style={[styles.qualityCard, quality[item.key] > 0 && styles.qualityCardWarning]} onPress={() => openResults(item.label, { qualityIssues: [item.key] })}><View style={styles.qualityCount}><Text style={styles.qualityCountText}>{quality[item.key].toLocaleString()}</Text></View><View style={styles.flex}><Text style={styles.qualityTitle}>{item.label}</Text><Text style={styles.qualityText}>{item.detail}</Text></View></TouchableOpacity>)}</> : null}

      {report.rows.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No rows match the current Cert Summary filters</Text><Text style={styles.emptyText}>Clear filters or return to Certificate Codes and use Download All. Previously valid rows remain preserved if a retry fails.</Text></View> : null}<TouchableOpacity style={styles.agentButton} onPress={() => router.push({ pathname: '/ask-my-data', params: { prompt: `Analyze my downloaded ${getMonthLabelForTarget(target)} certificate inventory. Use certificate sailing evidence only unless I request a comparison. Current filtered scope contains ${report.totalOptions} eligible options across ${report.certificateCount} certificate codes.` } } as never)}><Bot size={18} color="#FFFFFF" /><Text style={styles.agentButtonText}>Ask Agent SEA about this certificate scope</Text></TouchableOpacity>
    </ScrollView>
    <CertificateSummaryFilterModal visible={filtersOpen} options={monthOptions} value={filter} lockedMonths={[monthKey(target)]} onClose={() => setFiltersOpen(false)} onApply={(next) => { setFilter({ ...next, certificateMonths: [monthKey(target)], metric: undefined, metricCertificateCode: undefined }); setFiltersOpen(false); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F3F2' }, header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, paddingTop: SPACING.sm }, headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }, backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, headerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F7FB', alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: '#0E7FA7', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }, title: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 31, fontWeight: '900', marginTop: 5 }, subtitle: { color: '#66737F', fontSize: 13, lineHeight: 20, marginTop: SPACING.sm }, content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl }, monthRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm }, monthButton: { flex: 1, borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 999, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center' }, monthButtonActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep }, monthButtonText: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '800' }, monthButtonTextActive: { color: '#FFFFFF' }, filterButton: { backgroundColor: '#0F766E', borderRadius: 15, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, filterButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center' }, clearAllInline: { alignSelf: 'center', padding: 8 }, clearAllInlineText: { color: '#0E7FA7', fontSize: 10, fontWeight: '900' }, tabRow: { gap: 7, paddingVertical: SPACING.md }, tab: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 }, tabActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep }, tabText: { color: COLORS.navyDeep, fontSize: 10, fontWeight: '900' }, tabTextActive: { color: '#FFFFFF' }, overviewGrid: { flexDirection: 'row', gap: SPACING.sm }, overviewCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: '#CFE3EA', padding: SPACING.md, ...SHADOW.sm }, overviewValue: { color: COLORS.navyDeep, fontSize: 21, fontWeight: '900' }, overviewLabel: { color: '#5B6B7B', fontSize: 10, fontWeight: '700', marginTop: 2 }, definitionCard: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: '#E7F7F4', borderColor: '#99D9CE', borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginVertical: SPACING.md }, definitionText: { flex: 1, color: '#24534C', fontSize: 11, lineHeight: 17 }, codeCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3EA', borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm }, codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: SPACING.sm }, code: { color: COLORS.navyDeep, fontSize: 18, fontWeight: '900' }, points: { color: '#64748B', fontSize: 11, marginTop: 2 }, totalPill: { backgroundColor: '#DDF5EF', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, alignItems: 'center' }, totalPillValue: { color: '#0F766E', fontSize: 16, fontWeight: '900' }, totalPillLabel: { color: '#376A62', fontSize: 9, fontWeight: '700' }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, metric: { width: '31%', minWidth: 82, backgroundColor: '#F1F7FA', borderRadius: 12, padding: 9, borderWidth: 1, borderColor: '#D5E5EB' }, metricValue: { color: COLORS.navyDeep, fontSize: 16, fontWeight: '900' }, metricLabel: { color: '#617384', fontSize: 9, fontWeight: '700', marginTop: 2 }, warningRow: { marginTop: SPACING.sm, backgroundColor: '#FFF4D6', borderRadius: 10, padding: 9 }, warningText: { color: '#854D0E', fontSize: 10, fontWeight: '800' }, sectionTitle: { color: COLORS.navyDeep, fontSize: 18, fontWeight: '900', marginVertical: SPACING.md }, dimensionRow: { gap: 7, paddingBottom: SPACING.md }, dimensionChip: { borderWidth: 1, borderColor: '#B8D1DC', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, dimensionChipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' }, dimensionText: { color: COLORS.navyDeep, fontSize: 10, fontWeight: '900' }, dimensionTextActive: { color: '#FFFFFF' }, matrixCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3EA', borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm }, matrixHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }, matrixTotal: { color: '#0F766E', fontSize: 11, fontWeight: '900' }, matrixValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, matrixCell: { width: '47%', minWidth: 130, backgroundColor: '#F1F7FA', borderRadius: 11, borderWidth: 1, borderColor: '#D5E5EB', padding: 9 }, matrixValue: { color: COLORS.navyDeep, fontSize: 15, fontWeight: '900' }, matrixLabel: { color: '#5C7081', fontSize: 9, fontWeight: '700', marginTop: 2 }, moreText: { color: '#6B7F8E', fontSize: 9, marginTop: 8 }, allSailingsCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOW.sm }, allSailingsIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, allSailingsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, allSailingsText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, lineHeight: 15, marginTop: 3 }, flex: { flex: 1 }, previewRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DCE8ED', padding: 11 }, previewIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E1F4F8', alignItems: 'center', justifyContent: 'center' }, previewTitle: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '900' }, previewMeta: { color: '#607486', fontSize: 10, marginTop: 2 }, qualityIntro: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: '#E7F7F4', borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: '#99D9CE', padding: SPACING.md, marginBottom: SPACING.md }, qualityIntroText: { flex: 1, color: '#24534C', fontSize: 11, lineHeight: 17 }, qualityCard: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3EA', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm }, qualityCardWarning: { borderColor: '#F0C36C', backgroundColor: '#FFF9EA' }, qualityCount: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.navyDeep, alignItems: 'center', justifyContent: 'center' }, qualityCountText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, qualityTitle: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '900' }, qualityText: { color: '#617384', fontSize: 10, lineHeight: 15, marginTop: 2 }, emptyCard: { backgroundColor: '#FFF8E8', borderColor: '#F3D28D', borderWidth: 1, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, alignItems: 'center', marginTop: SPACING.md }, emptyTitle: { color: '#78350F', fontSize: 17, fontWeight: '900', textAlign: 'center' }, emptyText: { color: '#6B5A43', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 }, agentButton: { backgroundColor: '#0F766E', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: SPACING.md, marginTop: SPACING.lg }, agentButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
