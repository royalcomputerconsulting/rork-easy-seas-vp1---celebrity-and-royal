import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, ChevronLeft, Copy, FileDown, FileText, ListPlus, Search, Ship, SlidersHorizontal, X } from 'lucide-react-native';

import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import {
  filterCertificateSummaryOptions,
  flattenCertificateSummaryOptions,
  sortCertificateSummaryOptions,
  type CertificateSummaryFilter,
  type CertificateSummaryOption,
  type CertificateSummarySort,
} from '@/lib/certificates/certificateSummary';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import { readCertificateResultsUiState, writeCertificateResultsUiState, type CertificateSummaryViewMode } from '@/lib/certificates/certificateSummaryUiState';
import { useCertificates } from '@/state/CertificatesProvider';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { formatCount } from '@/lib/format';
import { CruiseCard } from '@/components/CruiseCard';
import type { Cruise } from '@/types/models';

const PAGE_SIZE = 20;
const AGENT_ACTION_ACCESSIBILITY_LABEL = 'Ask Agent SEA';

const SORTS: Array<{ key: CertificateSummarySort; label: string }> = [
  { key: 'soonest', label: 'Soonest' }, { key: 'latest', label: 'Latest' },
  { key: 'points_low', label: 'Lowest points' }, { key: 'points_high', label: 'Highest points' },
  { key: 'nights_short', label: 'Shortest' }, { key: 'nights_long', label: 'Longest' },
  { key: 'ship', label: 'Ship' }, { key: 'class', label: 'Class' },
  { key: 'cabin', label: 'Cabin' }, { key: 'port', label: 'Port' },
  { key: 'guest_low', label: '1 guest first' }, { key: 'guest_high', label: '2 guests first' },
  { key: 'freeplay_high', label: 'FreePlay' }, { key: 'obc_high', label: 'OBC' },
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseFilter(value: string): CertificateSummaryFilter {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CertificateSummaryFilter : {};
  } catch {
    return {};
  }
}

function benefitLine(option: CertificateSummaryOption): string {
  return [
    option.freePlay == null ? '' : `$${option.freePlay.toLocaleString()} FreePlay`,
    option.onBoardCredit == null ? '' : `$${option.onBoardCredit.toLocaleString()} OBC`,
    option.tradeInValue == null ? '' : `$${option.tradeInValue.toLocaleString()} trade-in`,
  ].filter(Boolean).join(' · ');
}

function activeFilterSummary(filter: CertificateSummaryFilter): Array<{ key: keyof CertificateSummaryFilter; label: string }> {
  const labels: Array<{ key: keyof CertificateSummaryFilter; label: string }> = [];
  const add = (key: keyof CertificateSummaryFilter, label: string) => labels.push({ key, label });
  if (filter.certificateCodes?.length) add('certificateCodes', filter.certificateCodes.join(', '));
  if (filter.certificateTypes?.length) add('certificateTypes', `${filter.certificateTypes.join('/')} certificates`);
  if (filter.guestCounts?.length) add('guestCounts', `${filter.guestCounts.join('/')} guest`);
  if (filter.shipNames?.length) add('shipNames', filter.shipNames.join(', '));
  if (filter.shipClasses?.length) add('shipClasses', filter.shipClasses.join(', '));
  if (filter.cabinLabels?.length) add('cabinLabels', filter.cabinLabels.join(', '));
  if (filter.departurePorts?.length) add('departurePorts', filter.departurePorts.join(', '));
  if (filter.regions?.length) add('regions', filter.regions.join(', '));
  if (filter.minimumPoints != null || filter.maximumPoints != null) add('minimumPoints', `${filter.minimumPoints ?? 0}–${filter.maximumPoints ?? '∞'} points`);
  if (filter.minimumNights != null || filter.maximumNights != null) add('minimumNights', `${filter.minimumNights ?? 1}–${filter.maximumNights ?? '∞'} nights`);
  if (filter.weekendDepartureOnly) add('weekendDepartureOnly', 'Weekend');
  if (filter.floridaDepartureOnly) add('floridaDepartureOnly', 'Florida');
  if (filter.gty != null) add('gty', filter.gty ? 'GTY' : 'Non-GTY');
  if (filter.qualityIssues?.length) add('qualityIssues', 'Data-quality review');
  return labels;
}

export default function CertificateSummaryResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filters?: string; title?: string; sort?: string; view?: string }>();
  const filter = useMemo(() => parseFilter(first(params.filters)), [params.filters]);
  const [activeFilter, setActiveFilter] = useState<CertificateSummaryFilter>(filter);
  const title = first(params.title) || 'Certificate Sailings';
  const initialSort = first(params.sort) as CertificateSummarySort;
  const view = (['options', 'certificate_codes', 'physical_sailings'].includes(first(params.view)) ? first(params.view) : 'options') as CertificateSummaryViewMode;
  const stateKey = useMemo(() => `${view}:${first(params.filters)}:${title}`, [params.filters, title, view]);
  const restored = useMemo(() => readCertificateResultsUiState(stateKey), [stateKey]);
  const [sort, setSort] = useState<CertificateSummarySort>(restored?.sort ?? (SORTS.some((item) => item.key === initialSort) ? initialSort : 'soonest'));
  const [query, setQuery] = useState(restored?.query ?? '');
  const [page, setPage] = useState(restored?.page ?? 0);
  const listRef = useRef<FlatList<CertificateSummaryOption>>(null);
  const scrollOffset = useRef(restored?.scrollOffset ?? 0);
  const { searchableCertificates, refreshCertificateDocuments } = useCertificates();

  useEffect(() => {
    const interaction = runAfterUiSettles(() => void refreshCertificateDocuments());
    return () => interaction.cancel();
  }, [refreshCertificateDocuments]);

  useEffect(() => { writeCertificateResultsUiState(stateKey, { query, sort, page, visibleCount: PAGE_SIZE, scrollOffset: scrollOffset.current }); }, [page, query, sort, stateKey]);
  useEffect(() => { if (restored?.scrollOffset) requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: restored.scrollOffset, animated: false })); }, [restored]);

  const allOptions = useMemo(() => flattenCertificateSummaryOptions(buildLocalCertificateSailingIndex(searchableCertificates)), [searchableCertificates]);
  const matchingOptions = useMemo(() => sortCertificateSummaryOptions(filterCertificateSummaryOptions(allOptions, { ...activeFilter, searchQuery: query || activeFilter.searchQuery }), sort), [activeFilter, allOptions, query, sort]);
  const matching = useMemo(() => { if (view === 'options') return matchingOptions; const byKey = new Map<string, CertificateSummaryOption>(); matchingOptions.forEach((option) => { const key = view === 'certificate_codes' ? option.certificateCode : `${option.shipName.toLowerCase()}__${option.sailDate}`; if (!byKey.has(key)) byKey.set(key, option); }); return Array.from(byKey.values()); }, [matchingOptions, view]);
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return matching.slice(start, start + PAGE_SIZE);
  }, [matching, safePage]);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const chips = useMemo(() => activeFilterSummary(activeFilter), [activeFilter]);
  const removeFilter = useCallback((key: keyof CertificateSummaryFilter) => setActiveFilter((current) => { const next = { ...current }; delete next[key]; if (key === 'minimumPoints') delete next.maximumPoints; if (key === 'minimumNights') delete next.maximumNights; return next; }), []);
  const describe = useCallback((item: CertificateSummaryOption) => `${item.certificateCode} · ${item.points?.toLocaleString() ?? '?'} points\n${item.shipName} · ${item.sailDate} · ${item.nights == null ? 'Nights not stated' : formatCount(item.nights, 'night')}\n${item.departurePort ?? 'Port not stated'} · ${item.itinerary ?? 'Itinerary not stated'}\n${item.cabinLabel ?? 'Cabin not stated'} · ${item.guestCount == null ? 'Guest count not stated' : formatCount(item.guestCount, 'guest')}`, []);
  const shareItem = useCallback(async (item: CertificateSummaryOption, titleText: string) => { await Share.share({ title: titleText, message: describe(item) }); }, [describe]);
  const addToShortlist = useCallback(async (item: CertificateSummaryOption) => { const key = '@easyseas_certificate_planning_shortlist_v1'; const rows = await quotaSafeGetJsonItem<CertificateSummaryOption[]>(key, [], Array.isArray); await quotaSafeSetJsonItem(key, [item, ...rows.filter((row) => row.optionId !== item.optionId)].slice(0, 500)); Alert.alert('Added to planning shortlist', `${item.shipName} on ${item.sailDate}`); }, []);

  const changePage = useCallback((nextPage: number) => {
    setPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
    scrollOffset.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [pageCount]);

  useEffect(() => {
    setPage(0);
    scrollOffset.current = 0;
  }, [activeFilter, query, sort, view]);

  const renderItem = useCallback(({ item }: { item: CertificateSummaryOption }) => {
    const benefits = benefitLine(item);
    const certificateCruise = {
      id: item.optionId,
      sourceRecordId: item.optionId,
      offerOptionId: item.optionId,
      shipName: item.shipName,
      shipClass: item.shipClass || undefined,
      sailDate: item.sailDate,
      returnDate: '',
      nights: item.nights ?? 0,
      destination: item.itinerary || item.region || 'Destination not stated',
      itineraryName: item.itinerary || undefined,
      departurePort: item.departurePort || undefined,
      cabinType: item.cabinLabel || undefined,
      guests: item.guestCount ?? undefined,
      certificateCode: item.certificateCode,
      offerCode: item.certificateCode,
      pointRequirement: item.points ?? undefined,
      freePlay: item.freePlay ?? undefined,
      freeOBC: item.onBoardCredit ?? undefined,
      tradeInValue: item.tradeInValue ?? undefined,
      gty: item.isGty,
      nextCruiseBonus: item.nextCruiseBonusLabel || undefined,
      status: 'available',
      sourceProvider: `Local certificate PDF${item.sourcePage == null ? '' : ` · page ${item.sourcePage}`}`,
    } as Cruise;
    const openCruise = () => router.push({
      pathname: '/cruise-details',
      params: buildCruiseDetailsParams(certificateCruise, { source: 'certificate' }),
    } as never);
    return (
      <View style={styles.card} testID={`certificate-summary-results.row-${item.optionId}`}>
        <CruiseCard cruise={certificateCruise} variant="available" mini showRetailValue onPress={openCruise} />
        {item.startDay || item.endDay ? <Text style={styles.meta}>{item.startDay || 'Start day not stated'} → {item.endDay || 'End day not stated'}</Text> : null}
        {benefits ? <Text style={styles.benefits}>{benefits}</Text> : null}
        <Text style={styles.nextCruiseBonus}>NextCruise bonus: {item.nextCruiseBonusLabel || 'None stated on this row'}</Text>
        <Text style={styles.provenance}>Local PDF evidence{item.sourcePage == null ? '' : ` · page ${item.sourcePage}`}{item.validationStatus ? ` · ${item.validationStatus}` : ''}</Text>
        <View style={[styles.actions, { flexWrap: 'wrap' }]}>
          <TouchableOpacity style={styles.miniAction} onPress={() => void Linking.openURL(item.pdfUrl)}><FileDown size={14} color={COLORS.navyDeep} /><Text style={styles.miniActionText}>PDF</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push({ pathname: '/certificate-lookup', params: { certificateCode: item.certificateCode, certificateType: item.certificateType, query: `${item.shipName} ${item.sailDate}` } })}><FileText size={15} color={COLORS.navyDeep} /><Text style={styles.secondaryActionText}>Certificate</Text></TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            testID={`certificate-summary-results.open-cruise-${item.optionId}`}
            onPress={openCruise}
          ><Ship size={15} color={COLORS.navyDeep} /><Text style={styles.secondaryActionText}>Cruise</Text></TouchableOpacity>
          <TouchableOpacity style={styles.miniAction} onPress={() => void addToShortlist(item)}><ListPlus size={14} color={COLORS.navyDeep} /><Text style={styles.miniActionText}>Plan</Text></TouchableOpacity>
          <TouchableOpacity style={styles.miniAction} onPress={() => void shareItem(item, 'Copy certificate option')}><Copy size={14} color={COLORS.navyDeep} /><Text style={styles.miniActionText}>Copy</Text></TouchableOpacity>
          <TouchableOpacity style={styles.miniAction} onPress={() => void shareItem(item, 'Export certificate option')}><FileDown size={14} color={COLORS.navyDeep} /><Text style={styles.miniActionText}>Export</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primaryAction} onPress={() => router.push({ pathname: '/ask-my-data', params: { prompt: `Compare certificate ${item.certificateCode} for ${item.shipName} sailing ${item.sailDate}. Use only downloaded certificate sailing evidence unless I ask for other sources.` } } as never)}><Bot size={15} color="#FFFFFF" /><Text style={styles.primaryActionText}>Compare / Ask</Text></TouchableOpacity>
        </View>
      </View>
    );
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#F3F3F2', '#FFFFFF', '#E8F7FB']} style={styles.header}>
        <View style={styles.headerRow}><TouchableOpacity style={styles.back} onPress={() => router.back()}><ChevronLeft size={22} color="#1C2F7A" /></TouchableOpacity><View style={styles.flex}><Text style={styles.eyebrow}>Certificate drill-down</Text><Text style={styles.title}>{title}</Text></View></View>
        <Text style={styles.count}>{matching.length.toLocaleString()} matching eligible option{matching.length === 1 ? '' : 's'} · {new Set(matching.map((item) => `${item.shipName.toLowerCase()}__${item.sailDate}`)).size.toLocaleString()} physical sailing{matching.length === 1 ? '' : 's'}</Text>
      </LinearGradient>
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(item) => item.optionId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
        onMomentumScrollEnd={() => writeCertificateResultsUiState(stateKey, { query, sort, page: safePage, visibleCount: PAGE_SIZE, scrollOffset: scrollOffset.current })}
        scrollEventThrottle={100}
        ListHeaderComponent={<View>
          <View style={styles.searchWrap}><Search size={18} color="#557083" /><TextInput value={query} onChangeText={setQuery} placeholder="Search ship, port, itinerary, cabin, code…" placeholderTextColor="#8293A2" style={styles.searchInput} testID="certificate-summary-results.search" />{query ? <TouchableOpacity onPress={() => setQuery('')}><Text style={styles.clearSearch}>Clear</Text></TouchableOpacity> : null}</View>
          {chips.length ? <FlatList horizontal data={chips} keyExtractor={(item) => item.key} renderItem={({ item }) => <TouchableOpacity style={styles.filterChip} onPress={() => removeFilter(item.key)} accessibilityLabel={`Remove ${item.label}`}><SlidersHorizontal size={11} color="#0F766E" /><Text style={styles.filterChipText}>{item.label}</Text><X size={11} color="#0F766E" /></TouchableOpacity>} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} /> : null}
          <FlatList horizontal data={SORTS} keyExtractor={(item) => item.key} renderItem={({ item }) => <TouchableOpacity style={[styles.sortChip, sort === item.key && styles.sortChipActive]} onPress={() => setSort(item.key)}><Text style={[styles.sortText, sort === item.key && styles.sortTextActive]}>{item.label}</Text></TouchableOpacity>} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow} />
        </View>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No certificate options match these filters</Text><Text style={styles.emptyText}>Return to Cert Summary and clear or change the selected filters. Downloaded certificate data has not been removed.</Text></View>}
        ListFooterComponent={matching.length ? <View style={styles.pagination} testID="certificate-summary-results.pagination">
          <TouchableOpacity style={[styles.pageButton, safePage === 0 && styles.pageButtonDisabled]} disabled={safePage === 0} onPress={() => changePage(safePage - 1)} accessibilityLabel="Previous certificate results page"><Text style={[styles.pageButtonText, safePage === 0 && styles.pageButtonTextDisabled]}>Previous</Text></TouchableOpacity>
          <View style={styles.pageStatus}><Text style={styles.pageStatusTitle}>Page {safePage + 1} of {pageCount}</Text><Text style={styles.pageStatusText}>{(safePage * PAGE_SIZE + 1).toLocaleString()}–{Math.min((safePage + 1) * PAGE_SIZE, matching.length).toLocaleString()} of {matching.length.toLocaleString()}</Text></View>
          <TouchableOpacity style={[styles.pageButton, safePage >= pageCount - 1 && styles.pageButtonDisabled]} disabled={safePage >= pageCount - 1} onPress={() => changePage(safePage + 1)} accessibilityLabel="Next certificate results page"><Text style={[styles.pageButtonText, safePage >= pageCount - 1 && styles.pageButtonTextDisabled]}>Next</Text></TouchableOpacity>
        </View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F3F2' }, header: { padding: SPACING.lg, paddingBottom: SPACING.xl }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 }, eyebrow: { color: '#0E7FA7', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' }, title: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 24, fontWeight: '900', marginTop: 3 }, count: { color: '#66737F', fontSize: 12, lineHeight: 18, marginTop: SPACING.md }, listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl }, searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: '#C7DDE5', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }, searchInput: { flex: 1, minHeight: 48, color: COLORS.navyDeep, fontSize: 13, paddingHorizontal: SPACING.sm }, clearSearch: { color: '#0E7FA7', fontSize: 11, fontWeight: '900' }, chipRow: { gap: 6, paddingVertical: 5 }, filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DDF5EF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, filterChipText: { color: '#27665C', fontSize: 10, fontWeight: '800' }, sortRow: { gap: 7, paddingVertical: SPACING.sm, marginBottom: SPACING.sm }, sortChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, sortChipActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep }, sortText: { color: COLORS.navyDeep, fontSize: 10, fontWeight: '800' }, sortTextActive: { color: '#FFFFFF' }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3EA', borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, codePill: { backgroundColor: COLORS.navyDeep, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }, codeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, points: { color: '#7A5B0D', fontSize: 12, fontWeight: '900' }, shipRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: SPACING.md }, shipIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E1F4F8', alignItems: 'center', justifyContent: 'center' }, shipName: { color: COLORS.navyDeep, fontSize: 16, fontWeight: '900' }, date: { color: '#526B7E', fontSize: 11, marginTop: 2 }, itinerary: { color: '#263F55', fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: SPACING.sm }, meta: { color: '#607486', fontSize: 11, lineHeight: 16, marginTop: 3 }, entitlementRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm }, entitlement: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF4F7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, entitlementText: { color: '#24415B', fontSize: 10, fontWeight: '800' }, classText: { color: '#0F766E', fontSize: 10, fontWeight: '800', marginTop: 7 }, warningText: { color: '#92400E', fontSize: 10, fontWeight: '800', marginTop: 7 }, benefits: { color: '#7A5B0D', fontSize: 11, fontWeight: '800', marginTop: 7 }, nextCruiseBonus: { color: '#526B7E', fontSize: 10, fontWeight: '700', marginTop: 6 }, provenance: { color: '#7A8996', fontSize: 9, marginTop: 8 }, actions: { flexDirection: 'row', gap: 8, marginTop: SPACING.md }, secondaryAction: { flex: 0.75, borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 13, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, secondaryActionText: { color: COLORS.navyDeep, fontSize: 11, fontWeight: '900' }, primaryAction: { flex: 1.25, backgroundColor: '#0F766E', borderRadius: 13, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, primaryActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, empty: { backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F3D28D', borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, alignItems: 'center' }, emptyTitle: { color: '#78350F', fontSize: 17, fontWeight: '900', textAlign: 'center' }, emptyText: { color: '#6B5A43', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: SPACING.sm, paddingBottom: SPACING.lg }, pageButton: { minWidth: 88, minHeight: 44, borderRadius: 13, backgroundColor: COLORS.navyDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, pageButtonDisabled: { backgroundColor: '#E4E7EA' }, pageButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, pageButtonTextDisabled: { color: '#8A9299' }, pageStatus: { flex: 1, alignItems: 'center' }, pageStatusTitle: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '900' }, pageStatusText: { color: '#66737F', fontSize: 10, fontWeight: '700', marginTop: 2 },
  miniAction: { borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 11, paddingHorizontal: 7, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniActionText: { color: COLORS.navyDeep, fontSize: 8, fontWeight: '900' },
});
