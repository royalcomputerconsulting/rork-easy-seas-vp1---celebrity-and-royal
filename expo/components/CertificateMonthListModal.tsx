import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, CalendarDays, RefreshCcw, Search, Ship, Sparkles, X } from 'lucide-react-native';

import { BORDER_RADIUS, CLEAN_THEME, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { loadCertificateMonthListLocally, type LocalCertificateMonthlyListResult } from '@/lib/royalCaribbean/localCertificateMonthList';
import { trpc } from '@/lib/trpc';
import type { BookedCruise } from '@/types/models';

interface CertificateMonthListModalProps {
  visible: boolean;
  monthOffset: 0 | 1;
  bookedCruises?: BookedCruise[];
  onClose: () => void;
  onLog?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface MonthlySailing {
  certificateCode: string;
  certificateType: 'A' | 'C' | 'D';
  level: string;
  points: number | null;
  shipName: string;
  sailDate: string;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
  cabinLabel: string | null;
  cabinRank: number | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  benefitSummary: string[];
}


interface UniqueMonthlySailing extends MonthlySailing {
  rowCount: number;
  certificateCodes: string[];
  bestCertificateCode: string;
  certificateCodeLabel: string;
  allSearchText: string;
}

function getMonthCodeForOffset(offset: 0 | 1): string {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function getMonthNameForCode(monthCode: string): string {
  const year = 2000 + parseInt(monthCode.slice(0, 2), 10);
  const monthIndex = parseInt(monthCode.slice(2, 4), 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return monthCode;
  }
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function normalizeDate(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const direct = raw.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (direct) {
    return `${direct[1]}-${String(direct[2]).padStart(2, '0')}-${String(direct[3]).padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function normalizeShip(value?: string | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/®/g, '')
    .replace(/\b(of the seas|the seas)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}


function normalizeSearchText(value?: string | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/®/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDateSearchVariants(value?: string | null): string[] {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const normalized = normalizeDate(raw);
  const variants = new Set<string>([raw, normalized]);
  const parsed = new Date(`${normalized}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    const monthLong = parsed.toLocaleDateString('en-US', { month: 'long' });
    const monthShort = parsed.toLocaleDateString('en-US', { month: 'short' });
    const day = String(parsed.getDate());
    const year = String(parsed.getFullYear());
    variants.add(`${monthLong} ${day}`);
    variants.add(`${monthShort} ${day}`);
    variants.add(`${monthLong} ${day}, ${year}`);
    variants.add(`${monthShort} ${day}, ${year}`);
    variants.add(`${parsed.getMonth() + 1}/${parsed.getDate()}/${year}`);
    variants.add(`${parsed.getMonth() + 1}/${parsed.getDate()}`);
  }
  return Array.from(variants).filter(Boolean);
}

function formatCurrency(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString()}`;
}

function formatBenefitText(row: MonthlySailing): string {
  const parts = [...(row.benefitSummary ?? [])];
  const freePlay = formatCurrency(row.freePlay);
  const obc = formatCurrency(row.onBoardCredit);
  if (freePlay && !parts.some(part => part.toLowerCase().includes('free'))) parts.push(`${freePlay} FP`);
  if (obc && !parts.some(part => part.toLowerCase().includes('obc') || part.toLowerCase().includes('credit'))) parts.push(`${obc} OBC`);
  return parts.length > 0 ? parts.join(' + ') : 'Benefits parsing from PDF';
}

function formatPoints(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'points TBD';
  return `${value.toLocaleString()} pts`;
}


const CERTIFICATE_PROGRESS_SUFFIXES = ['VIP2', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'] as const;

function buildExpectedCertificateProgressCodes(monthCode: string): string[] {
  return [
    ...CERTIFICATE_PROGRESS_SUFFIXES.map(suffix => `${monthCode}A${suffix}`),
    ...CERTIFICATE_PROGRESS_SUFFIXES.map(suffix => `${monthCode}C${suffix}`),
  ];
}

export function CertificateMonthListModal({ visible, monthOffset, bookedCruises = [], onClose, onLog }: CertificateMonthListModalProps) {
  const [searchText, setSearchText] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'booked' | 'a' | 'c' | 'suite' | 'balcony'>('all');
  const monthCode = useMemo(() => getMonthCodeForOffset(monthOffset), [monthOffset]);
  const monthLabel = useMemo(() => getMonthNameForCode(monthCode), [monthCode]);
  const [localResult, setLocalResult] = useState<LocalCertificateMonthlyListResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [scrapeStatusText, setScrapeStatusText] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<'public-url-scrape' | 'public-backend-scrape' | null>(null);
  const monthlyListMutation = trpc.certificateExplorer.monthlyList.useMutation();
  const loadRunRef = useRef(0);
  const logCertificateEvent = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const formatted = `[Certificate Scrape] ${message}`;
    console.log(formatted);
    onLog?.(formatted, type);
  }, [onLog]);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const cancelScrapeAndClose = useCallback(() => {
    loadRunRef.current += 1;
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    setLocalLoading(false);
    setScrapeStatusText(null);
    setLocalError(null);
    logCertificateEvent(`Certificate scrape cancelled by user for ${monthCode}. Pending device fetches were aborted and future results will be ignored.`, 'warning');
    onClose();
  }, [logCertificateEvent, monthCode, onClose]);

  const logCertificateScanResult = useCallback((result: LocalCertificateMonthlyListResult | null, source: string) => {
    if (!result) return;
    const summary = result.summary;
    logCertificateEvent(`Summary ${result.monthCode}: source=${source}; detailPdfs=${summary.searchedCertificateCount}; rows=${summary.extractedSailingRows}; uniqueSailings=${summary.uniqueSailingCount}; ok=${summary.okCount}; noSailings=${summary.noSailingsCount}; empty=${summary.emptyCount}; errors=${summary.errorCount}`, summary.extractedSailingRows > 0 ? 'success' : 'warning');

    result.pdfScanLog.forEach((entry, index) => {
      const status = String(entry.status ?? 'unknown');
      const sample = entry.sampleText ? `; sample="${String(entry.sampleText).slice(0, 180)}"` : '';
      const parser = entry.parser ? `; parser=${entry.parser}` : '';
      const message = `${result.monthCode} PDF ${index + 1}/${result.pdfScanLog.length}: ${entry.certificateCode} status=${status}; textLength=${entry.textLength ?? 0}; sailingsFound=${entry.sailingsFound ?? 0}${parser}${entry.errorMessage ? `; error=${entry.errorMessage}` : ''}${sample}`;
      logCertificateEvent(message, status === 'ok' ? 'info' : status === 'error' ? 'error' : 'warning');
    });
  }, [logCertificateEvent]);


  const loadMonth = useCallback(async () => {
    console.log('[CertificateMonthListModal] Loading certificate month list by direct Royal URL formula:', {
      monthCode,
      monthOffset,
      baseUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/',
    });
    logCertificateEvent(`Starting ${monthLabel} (${monthCode}) public certificate scrape: A and C certificate banks, direct Royal PDF formula`, 'info');
    const runId = Date.now();
    loadRunRef.current = runId;
    activeAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;
    setLocalError(null);
    setLocalResult(null);
    setLocalLoading(true);
    setScrapeStatusText(`Finding ${monthCode}A and ${monthCode}C certificate banks…`);
    setLoadSource(null);
    let backendProgressTimer: ReturnType<typeof setInterval> | null = null;

    try {
      let directResult: LocalCertificateMonthlyListResult | null = null;
      let source: 'public-url-scrape' | 'public-backend-scrape' = 'public-url-scrape';
      let localMessage: string | null = null;

      // v1015: Use the device/Hermes-safe parser directly. The backend PDF.js route was
      // returning a non-JSON payload in production ("Unexpected character: N") and is
      // not cancellable from the modal X button. The device parser now successfully parses
      // the Royal PDFs, supports AbortController cancellation, and exports full log details.


      if (!directResult || (directResult.summary.extractedSailingRows ?? 0) === 0) {
        try {
          directResult = await loadCertificateMonthListLocally({
            monthCode,
            includeA: true,
            includeC: true,
            abortSignal: abortController.signal,
            shouldCancel: () => abortController.signal.aborted || loadRunRef.current !== runId,
            onProgress: (progress) => {
              if (loadRunRef.current !== runId || abortController.signal.aborted) return;
              if (progress.phase === 'discovering-indexes') {
                setScrapeStatusText(`Finding ${monthCode}A and ${monthCode}C certificate banks…`);
                logCertificateEvent(`Device fallback discovering ${monthCode}A and ${monthCode}C certificate banks`, 'info');
                return;
              }
              if (progress.certificateCode) {
                const countText = progress.currentIndex && progress.totalCount ? ` (${progress.currentIndex}/${progress.totalCount})` : '';
                setScrapeStatusText(`I am scraping ${progress.certificateCode}${countText}…`);
                logCertificateEvent(`Device fallback scraping ${progress.certificateCode}${countText}${progress.pdfUrl ? ` ${progress.pdfUrl}` : ''}`, 'info');
              }
            },
          });
          source = 'public-url-scrape';
          logCertificateScanResult(directResult, 'device-fallback');
        } catch (deviceError) {
          const deviceMessage = deviceError instanceof Error ? deviceError.message : String(deviceError);
          if (!directResult) {
            throw new Error(`${localMessage ? `Backend parser: ${localMessage}. ` : ''}Device parser: ${deviceMessage}`);
          }
        }
      }

      if (loadRunRef.current !== runId || !directResult) return;
      setLocalResult(directResult);
      setLoadSource(source);
      if ((directResult.summary.extractedSailingRows ?? 0) === 0) {
        if (loadRunRef.current !== runId) return;
        setLocalError(`Easy Seas downloaded the public ${monthCode}A and ${monthCode}C certificate banks and all detail PDFs, but no ship/date sailing rows were parsed. Reload will re-download and re-scrape every certificate PDF. Open the PDF scan log to see which exact certificate codes returned unreadable row text.`);
        logCertificateEvent(`FAILED ${monthCode}: downloaded PDFs but parsed 0 ship/date sailing rows. Export Log now includes every certificate PDF status above.`, 'error');
      }
    } catch (directError) {
      const directMessage = directError instanceof Error ? directError.message : String(directError);
      if (loadRunRef.current !== runId) return;
      setLocalError(`Certificate list could not download/scrape from the public Royal Caribbean PDF URL formula. ${directMessage}`);
      logCertificateEvent(`FAILED ${monthCode}: ${directMessage}`, 'error');
    } finally {
      if (backendProgressTimer) {
        clearInterval(backendProgressTimer);
        backendProgressTimer = null;
      }
      if (loadRunRef.current === runId) {
        setLocalLoading(false);
        setScrapeStatusText(null);
        activeAbortControllerRef.current = null;
      }
    }
  }, [logCertificateEvent, logCertificateScanResult, monthCode, monthLabel, monthOffset, monthlyListMutation]);

  useEffect(() => {
    if (visible) {
      setSearchText('');
      setQuickFilter('all');
      void loadMonth();
    }
    return () => {
      if (!visible) return;
      loadRunRef.current += 1;
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, monthCode]);

  const bookedMatchMap = useMemo(() => {
    const map = new Map<string, BookedCruise>();
    bookedCruises.forEach((cruise) => {
      const ship = normalizeShip(cruise.shipName);
      const date = normalizeDate(cruise.sailDate);
      if (ship && date) {
        map.set(`${ship}__${date}`, cruise);
      }
    });
    return map;
  }, [bookedCruises]);

  const result = localResult ?? undefined;
  const allSailings = result?.sailings ?? [];

  const uniqueSailings = useMemo<UniqueMonthlySailing[]>(() => {
    const grouped = new Map<string, UniqueMonthlySailing>();
    allSailings.forEach((row) => {
      const key = `${normalizeShip(row.shipName)}__${normalizeDate(row.sailDate)}__${String(row.departurePort ?? '').toLowerCase()}__${String(row.itinerary ?? '').toLowerCase()}`;
      const existing = grouped.get(key);
      const benefitText = formatBenefitText(row);
      const rowSearch = [
        row.shipName,
        row.sailDate,
        ...buildDateSearchVariants(row.sailDate),
        row.departurePort,
        row.itinerary,
        row.offerTypeLabel,
        row.nextCruiseBonusLabel,
        row.cabinLabel,
        row.certificateCode,
        row.certificateType,
        row.level,
        benefitText,
        ...(row.benefitSummary ?? []),
      ].join(' ');
      if (!existing) {
        grouped.set(key, {
          ...row,
          rowCount: 1,
          certificateCodes: [row.certificateCode],
          bestCertificateCode: row.certificateCode,
          certificateCodeLabel: row.certificateCode,
          allSearchText: rowSearch,
        });
        return;
      }
      existing.rowCount += 1;
      if (!existing.certificateCodes.includes(row.certificateCode)) {
        existing.certificateCodes.push(row.certificateCode);
      }
      existing.allSearchText = `${existing.allSearchText} ${rowSearch}`;
      const currentRank = (existing.cabinRank ?? 0) * 100000 + (existing.freePlay ?? 0) + (existing.onBoardCredit ?? 0);
      const candidateRank = (row.cabinRank ?? 0) * 100000 + (row.freePlay ?? 0) + (row.onBoardCredit ?? 0);
      if (candidateRank > currentRank) {
        existing.certificateCode = row.certificateCode;
        existing.certificateType = row.certificateType;
        existing.level = row.level;
        existing.points = row.points;
        existing.offerTypeLabel = row.offerTypeLabel;
        existing.nextCruiseBonusLabel = row.nextCruiseBonusLabel;
        existing.cabinLabel = row.cabinLabel;
        existing.cabinRank = row.cabinRank;
        existing.freePlay = row.freePlay;
        existing.onBoardCredit = row.onBoardCredit;
        existing.benefitSummary = row.benefitSummary;
        existing.bestCertificateCode = row.certificateCode;
      }
      existing.certificateCodeLabel = existing.certificateCodes.length > 1 ? `${existing.certificateCodes.length} levels` : existing.certificateCodes[0] ?? existing.bestCertificateCode;
    });
    return Array.from(grouped.values());
  }, [allSailings]);

  const filteredSailings = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const rows = uniqueSailings.filter((row) => {
      const bookedKey = `${normalizeShip(row.shipName)}__${normalizeDate(row.sailDate)}`;
      const benefitText = formatBenefitText(row).toLowerCase();
      if (quickFilter === 'booked' && !bookedMatchMap.has(bookedKey)) return false;
      if (quickFilter === 'a' && !row.certificateCodes.some(code => code.includes('A'))) return false;
      if (quickFilter === 'c' && !row.certificateCodes.some(code => code.includes('C'))) return false;
      if (quickFilter === 'suite' && !row.allSearchText.toLowerCase().includes('suite')) return false;
      if (quickFilter === 'balcony' && !row.allSearchText.toLowerCase().includes('balcony')) return false;
      if (!query) return true;
      const haystack = normalizeSearchText([row.allSearchText, row.certificateCodeLabel, benefitText, row.certificateCodes.join(' ')].join(' '));
      const normalizedQuery = normalizeSearchText(query);
      return normalizedQuery.split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
    });

    return rows.sort((left, right) => {
      const leftBooked = bookedMatchMap.has(`${normalizeShip(left.shipName)}__${normalizeDate(left.sailDate)}`) ? 1 : 0;
      const rightBooked = bookedMatchMap.has(`${normalizeShip(right.shipName)}__${normalizeDate(right.sailDate)}`) ? 1 : 0;
      if (leftBooked !== rightBooked) return rightBooked - leftBooked;
      const dateCompare = left.sailDate.localeCompare(right.sailDate);
      if (dateCompare !== 0) return dateCompare;
      const shipCompare = left.shipName.localeCompare(right.shipName);
      if (shipCompare !== 0) return shipCompare;
      return left.bestCertificateCode.localeCompare(right.bestCertificateCode);
    });
  }, [uniqueSailings, bookedMatchMap, quickFilter, searchText]);

  const bookedMatches = useMemo(() => uniqueSailings.filter((row) => {
    const key = `${normalizeShip(row.shipName)}__${normalizeDate(row.sailDate)}`;
    return bookedMatchMap.has(key);
  }), [uniqueSailings, bookedMatchMap]);


  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cancelScrapeAndClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={monthOffset === 0 ? ['#10223A', '#1D4E89', '#0E7FA7'] : ['#1F1B3D', '#4C1D95', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroIconWrap}>
                <Award size={18} color="#FFFFFF" />
              </View>
              <TouchableOpacity onPress={cancelScrapeAndClose} style={styles.closeButton} testID="certificate-month-list.close-button">
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroEyebrow}>Club Royale certificate bank</Text>
            <Text style={styles.heroTitle}>{monthOffset === 0 ? 'This Month Certificate List' : 'Next Month Certificate List'}</Text>
            <Text style={styles.heroSubtitle}>
              {monthLabel} · {monthCode} · scanning A and C certificate PDFs across the known level set.
            </Text>
          </LinearGradient>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.actionCard}>
              <View style={styles.searchRow}>
                <Search size={16} color={CLEAN_THEME.text.muted} />
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Filter by ship, date, code, port, or benefit"
                  placeholderTextColor={CLEAN_THEME.text.muted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  testID="certificate-month-list.search-input"
                />
              </View>

              <TouchableOpacity
                style={styles.reloadButton}
                onPress={() => { void loadMonth(); }}
                disabled={localLoading}
                activeOpacity={0.85}
                testID="certificate-month-list.reload-button"
              >
                {localLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <RefreshCcw size={16} color="#FFFFFF" />
                )}
                <Text style={styles.reloadButtonText}>{localLoading ? (scrapeStatusText ?? 'Scraping certificate PDFs…') : 'Reload and rescrape all certificates'}</Text>
              </TouchableOpacity>
              {localLoading && scrapeStatusText ? (
                <Text style={styles.scrapeStatusText}>{scrapeStatusText}</Text>
              ) : null}
            </View>

            {localError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Certificate list notice</Text>
                <Text style={styles.errorText}>{localError}</Text>
                <Text style={styles.errorHint}>No Royal login is required. Easy Seas uses the public base URL, downloads the A, C, and D monthly banks when available, downloads every certificate detail PDF it discovers, then scrapes every ship/date row from those PDFs.</Text>
              </View>
            ) : null}

            {loadSource ? (
              <View style={styles.sourcePill}>
                <Text style={styles.sourcePillText}>{loadSource === 'public-backend-scrape' ? 'Downloaded and evaluated by Easy Seas public backend PDF parser' : 'Downloaded and evaluated by direct public Royal Caribbean PDF URL formula'}</Text>
              </View>
            ) : null}

            {result ? (
              <>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{uniqueSailings.length}</Text>
                    <Text style={styles.summaryLabel}>unique sailings</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{result.summary.extractedSailingRows}</Text>
                    <Text style={styles.summaryLabel}>certificate rows</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{result.summary.searchedCertificateCount}</Text>
                    <Text style={styles.summaryLabel}>cert PDFs scraped</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{bookedMatches.length}</Text>
                    <Text style={styles.summaryLabel}>your booked matches</Text>
                  </View>
                </View>

                {bookedMatches.length > 0 ? (
                  <View style={styles.tailoredCard}>
                    <View style={styles.tailoredHeader}>
                      <Sparkles size={15} color="#FACC15" />
                      <Text style={styles.tailoredTitle}>Matched to your booked cruises</Text>
                    </View>
                    <Text style={styles.tailoredText}>
                      Easy Seas found certificate rows that match ship/date records already in your Booked tab. Those rows are pinned first below.
                    </Text>
                  </View>
                ) : null}

                {result.highlights.length > 0 ? (
                  <View style={styles.highlightsCard}>
                    <Text style={styles.sectionTitle}>Best visible certificate opportunities</Text>
                    {result.highlights.slice(0, 5).map((highlight, index) => (
                      <View
                        key={`${highlight.title}-${highlight.certificateCode}-${index}`}
                        style={styles.highlightRow}
                      >
                        <View style={styles.highlightBullet} />
                        <View style={styles.highlightTextWrap}>
                          <Text style={styles.highlightTitle}>{highlight.title}</Text>
                          <Text style={styles.highlightDetail}>{highlight.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.levelSummaryCard}>
                  <Text style={styles.sectionTitle}>Downloaded certificate PDFs</Text>
                  <Text style={styles.resultsSubtitle}>
                    Easy Seas downloaded the public {monthCode}A, {monthCode}C, and available {monthCode}D certificate banks, then scraped every discovered detail PDF row-by-row. No Royal login is required.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.certChipScroll}>
                    {result.certificateSummaries.map((summary) => (
                      <View
                        key={summary.certificateCode}
                        style={styles.certSummaryChip}
                      >
                        <Text style={styles.certSummaryCode}>{summary.certificateCode}</Text>
                        <Text style={styles.certSummaryMeta}>{formatPoints(summary.points)} · {summary.sailingCount} rows scraped</Text>
                        {summary.bestCabinLabel ? <Text style={styles.certSummaryBenefit}>{summary.bestCabinLabel}</Text> : null}
                      </View>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.sailingFilterCard}>
                  <Text style={styles.sectionTitle}>Search & filter unique sailings</Text>
                  <Text style={styles.resultsSubtitle}>
                    Search across {uniqueSailings.length.toLocaleString()} unique ship/date sailings and {allSailings.length.toLocaleString()} certificate rows.
                  </Text>
                  <View style={styles.deepSearchRow}>
                    <Search size={16} color={CLEAN_THEME.text.muted} />
                    <TextInput
                      value={searchText}
                      onChangeText={setSearchText}
                      placeholder="Search ship, sail date, port, itinerary, code, or benefit"
                      placeholderTextColor={CLEAN_THEME.text.muted}
                      style={styles.deepSearchInput}
                      autoCapitalize="none"
                      testID="certificate-month-list.deep-search-input"
                    />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilterScroll}>
                    {[
                      ['all', 'All unique sailings'],
                      ['booked', 'Booked matches'],
                      ['a', 'A certificates'],
                      ['c', 'C certificates'],
                      ['d', 'D certificates'],
                      ['suite', 'Suites'],
                      ['balcony', 'Balconies'],
                    ].map(([key, label]) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.quickFilterChip, quickFilter === key && styles.quickFilterChipActive]}
                        onPress={() => setQuickFilter(key as typeof quickFilter)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.quickFilterText, quickFilter === key && styles.quickFilterTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.resultsHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Scraped sailing rows</Text>
                    <Text style={styles.resultsSubtitle}>{filteredSailings.length} of {uniqueSailings.length} unique sailings shown</Text>
                  </View>
                </View>

                {monthOffset === 1 && uniqueSailings.length === 0 && !localLoading ? (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>IT LOOKS LIKE THE NEXT MONTH'S CERTIFICATES ARE NOT AVAILABLE YET.</Text>
                    <Text style={styles.errorHint}>Easy Seas preserved this-month data and did not wipe cached certificate results.</Text>
                  </View>
                ) : null}

                {filteredSailings.slice(0, 250).map((row, index) => {
                  const bookedKey = `${normalizeShip(row.shipName)}__${normalizeDate(row.sailDate)}`;
                  const matchedBooking = bookedMatchMap.get(bookedKey);
                  return (
                    <View key={`${row.certificateCode}-${row.shipName}-${row.sailDate}-${index}`} style={[styles.sailingCard, matchedBooking && styles.sailingCardMatched]}>
                      <View style={styles.sailingTopRow}>
                        <View style={styles.shipTitleWrap}>
                          <Ship size={15} color={matchedBooking ? '#FACC15' : '#60C8F5'} />
                          <Text style={styles.sailingShip}>{row.shipName}</Text>
                        </View>
                        <View style={[styles.codePill, row.certificateType === 'A' ? styles.codePillA : row.certificateType === 'D' ? styles.codePillD : styles.codePillC]}>
                          <Text style={styles.codePillText}>{row.certificateCodeLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.dateRow}>
                        <CalendarDays size={13} color="#94A3B8" />
                        <Text style={styles.sailingDate}>{formatDate(row.sailDate, 'medium')}</Text>
                        <Text style={styles.pointsText}>· {formatPoints(row.points)}</Text>
                      </View>
                      {matchedBooking ? (
                        <Text style={styles.matchBadgeText}>★ Matches your booked cruise{matchedBooking.reservationNumber ? ` · ${matchedBooking.reservationNumber}` : ''}</Text>
                      ) : null}
                      {row.rowCount > 1 ? <Text style={styles.sailingMeta}>{row.rowCount.toLocaleString()} certificate row(s) across {row.certificateCodes.length} certificate level(s); best visible code {row.bestCertificateCode}</Text> : null}
                      {row.itinerary ? <Text style={styles.sailingItinerary}>{row.itinerary}</Text> : null}
                      {row.departurePort ? <Text style={styles.sailingMeta}>From {row.departurePort}</Text> : null}
                      {row.offerTypeLabel ? <Text style={styles.sailingMeta}>{row.offerTypeLabel}</Text> : null}
                      <Text style={styles.benefitText}>{formatBenefitText(row)}</Text>
                    </View>
                  );
                })}

                {filteredSailings.length > 250 ? (
                  <View style={styles.limitCard}>
                    <Text style={styles.limitText}>Showing first 250 unique sailings. Use the filter box to narrow by ship, date, port, certificate code, cabin, or benefit.</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 11, 20, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '94%',
    backgroundColor: '#000000',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
  },
  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeTitle,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  scrollView: {
    backgroundColor: '#000000',
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  actionCard: {
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#111827',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 44,
  },
  reloadButtonText: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontSize: TYPOGRAPHY.fontSizeSM,
    flexShrink: 1,
    textAlign: 'center',
  },
  scrapeStatusText: {
    color: '#CFFAFE',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textAlign: 'center',
    lineHeight: 17,
  },
  errorCard: {
    backgroundColor: '#111827',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginBottom: 4,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  sourcePill: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  sourcePillText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#E5E7EB',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  errorHint: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 8,
    lineHeight: 17,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  summaryLabel: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeXS,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  tailoredCard: {
    backgroundColor: '#111827',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FACC1544',
  },
  tailoredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tailoredTitle: {
    color: '#FACC15',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  tailoredText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
  },
  highlightsCard: {
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: 7,
  },
  highlightBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  highlightTextWrap: {
    flex: 1,
  },
  highlightTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  highlightDetail: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
    marginTop: 2,
  },
  levelSummaryCard: {
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    gap: SPACING.sm,
  },
  certChipScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  certSummaryChip: {
    minWidth: 138,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#64748B',
  },
  certSummaryCode: {
    color: '#0F172A',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  certSummaryMeta: {
    color: '#0F172A',
    fontSize: 11,
    marginTop: 3,
  },
  certSummaryBenefit: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginTop: 3,
  },
  sailingFilterCard: {
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    gap: SPACING.sm,
  },
  deepSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#111827',
  },
  deepSearchInput: {
    flex: 1,
    minHeight: 44,
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  quickFilterScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  quickFilterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  quickFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickFilterText: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  resultsSubtitle: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  indexButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  indexButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#0F3B57',
  },
  indexButtonText: {
    color: '#60C8F5',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sailingCard: {
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    gap: 6,
  },
  sailingCardMatched: {
    borderColor: '#FACC15',
    backgroundColor: '#713F1222',
  },
  sailingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  shipTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sailingShip: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  codePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  codePillA: {
    backgroundColor: '#1D4ED8',
  },
  codePillC: {
    backgroundColor: '#047857',
  },
  codePillD: {
    backgroundColor: '#7C3AED',
  },
  codePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sailingDate: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  pointsText: {
    color: CLEAN_THEME.text.muted,
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  matchBadgeText: {
    color: '#FACC15',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sailingItinerary: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
  },
  sailingMeta: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  benefitText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    lineHeight: 18,
  },
  pdfButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.md,
    marginTop: 2,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  limitCard: {
    backgroundColor: '#0B0F17',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  limitText: {
    color: '#E5E7EB',
    fontSize: TYPOGRAPHY.fontSizeSM,
    textAlign: 'center',
  },
});
