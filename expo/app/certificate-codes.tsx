import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, CalendarClock, ChevronLeft, Columns3, Download, ExternalLink, Ship, Sparkles, StopCircle, Ticket, Users, X } from 'lucide-react-native';

import { AgentXChat } from '@/components/AgentXChat';
import { CertificateDownloadLogPanel } from '@/components/certificates/CertificateDownloadLogPanel';
import { PremiumVoyageArtwork } from '@/components/ui/PremiumVoyageArtwork';
import { certificateDownloadLogger } from '@/lib/certificates/certificateDownloadLogger';
import { BORDER_RADIUS, CLEAN_THEME, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  buildCertificateCatalog,
  buildStoredCertificateCatalogEntries,
  CERTIFICATE_CATALOG_VERSION,
  type CertificateCatalogEntry,
  type CertificateType,
  formatCertificatePoints,
  getMonthCodeForTarget,
  getMonthLabelForTarget,
  ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
} from '@/lib/certificates/certificateCatalog';
import { openCertificatePdf } from '@/lib/royalCaribbean/certificatePdf';
import { CERTIFICATE_BATCH_CANCELLED, downloadCertificateCatalogBatched } from '@/lib/certificates/certificateBatchDownload';
import { PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY } from '@/lib/certificates/certificateDocumentStore';
import { normalizeCertificateParseDiagnostics, type CertificateParseStatus } from '@/lib/certificates/certificateParsingStatus';
import { parseCertificateCode } from '@/lib/certificates/certificatePdfParserCore';
import { useCertificateMonthAvailability } from '@/hooks/useCertificateMonthAvailability';
import { useAgentX } from '@/state/AgentXProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { usePersonalCertificateOptimizer } from '@/state/PersonalCertificateOptimizerProvider';
import { evaluateOffersWithPersonalValue } from '@/lib/optimization';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import { buildCertificateSummaryReport, type CertificateSummaryFilter } from '@/lib/certificates/certificateSummary';

type MonthTarget = 'thisMonth' | 'nextMonth';

type ExplorerCatalogEntry = CertificateCatalogEntry & {
  status?: string;
  sailingsFound?: number;
};

function describeDownloadError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const cleaned = raw
    .replace(/JSON Parse error:\s*/i, '')
    .replace(/Unexpected end of input/i, 'The certificate download response was cut off before it finished.')
    .replace(/Unexpected character:\s*N/i, 'A legacy backend returned a non-JSON response. EasySeas will use the direct Royal PDF path instead.')
    .trim();
  return cleaned || 'Certificate download failed. Please try again.';
}

function getCatalogSummaryText(catalog: ExplorerCatalogEntry[], monthLabel: string): string {
  const byType = catalog.reduce<Record<string, number>>((acc, item) => {
    acc[item.certificateType] = (acc[item.certificateType] ?? 0) + 1;
    return acc;
  }, {});
  const sailingCount = catalog.reduce((sum, item) => sum + (item.parsedSailingReferences ?? item.sailingsFound ?? 0), 0);
  const parsedCodes = catalog.filter((item) => item.status === 'parsed').length;
  const failedCodes = catalog.filter((item) => ['parse_failed', 'network_error', 'unsupported_pdf'].includes(String(item.status))).length;
  return `${monthLabel}: ${byType.C ?? 0} C certificates, ${byType.A ?? 0} A certificates, ${parsedCodes} parsed code${parsedCodes === 1 ? '' : 's'}, ${failedCodes} issue${failedCodes === 1 ? '' : 's'}, and ${sailingCount.toLocaleString()} parsed sailing references.`;
}

function getStatusLabel(status: CertificateParseStatus | string | undefined): string {
  const labels: Record<string, string> = {
    not_scanned: 'Not scanned',
    downloading: 'Downloading',
    downloaded: 'Downloaded',
    parsed: 'Parsed',
    parse_failed: 'Parse failed',
    network_error: 'Network error',
    unsupported_pdf: 'Unsupported PDF',
  };
  return labels[String(status ?? 'not_scanned')] ?? 'Not scanned';
}

function getStatusColor(status: CertificateParseStatus | string | undefined): string {
  if (status === 'parsed') return '#16755F';
  if (status === 'downloading' || status === 'downloaded') return '#273D9A';
  if (status === 'parse_failed' || status === 'unsupported_pdf') return '#8A5A00';
  if (status === 'network_error') return '#A52B34';
  return '#66737F';
}

export default function CertificateCodesScreen() {
  const router = useRouter();
  const { searchableCertificates, certificateDocuments, refreshCertificateDocuments, certificateDocumentLoadState } = useCertificates();
  const isScreenFocusedRef = useRef(false);
  const pendingDocumentRefreshRef = useRef(false);
  const certificateOperationRef = useRef(false);
  const cancelCertificateOperationRef = useRef(false);
  const personalOptimizer = usePersonalCertificateOptimizer();
  const optimizationBundle = personalOptimizer?.bundle ?? null;
  const params = useLocalSearchParams<{ chat?: string }>();
  const [monthTarget, setMonthTarget] = useState<MonthTarget>('thisMonth');
  const [certificateType, setCertificateType] = useState<CertificateType>('C');
  const [downloadedCatalog, setDownloadedCatalog] = useState<ExplorerCatalogEntry[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(params.chat === '1');
  const [backgroundCompletion, setBackgroundCompletion] = useState<{ title: string; message: string; status: 'success' | 'warning' | 'error' } | null>(null);
  const monthAvailability = useCertificateMonthAvailability(10);
  const priorCurrentMonthRef = useRef(monthAvailability.currentMonthCode);

  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ completed: 0, total: 0 });
  const [missingArchiveCodes, setMissingArchiveCodes] = useState<Set<string>>(new Set());
  const {
    messages,
    isLoading,
    sendMessage,
    isExpanded,
    toggleExpanded,
    mode,
    setMode,
    setVisible: setAgentVisible,
  } = useAgentX();
  const hasCachedCertificateRows = searchableCertificates.some((certificate) => (certificate.parsedSailings?.length ?? 0) > 0);

  useFocusEffect(useCallback(() => {
    isScreenFocusedRef.current = true;
    const force = pendingDocumentRefreshRef.current;
    pendingDocumentRefreshRef.current = false;
    // Paint the shell first, then start the retained-library read on a bounded
    // timer. InteractionManager can remain pending for the lifetime of a busy
    // list gesture and made saved certificates appear a minute later.
    const timer = setTimeout(() => {
      if (force) void refreshCertificateDocuments({ force: true });
      else if (!hasCachedCertificateRows) void refreshCertificateDocuments();
    }, 32);
    return () => {
      isScreenFocusedRef.current = false;
      clearTimeout(timer);
    };
  }, [hasCachedCertificateRows, refreshCertificateDocuments]));

  useEffect(() => {
    setAgentVisible(chatOpen);
    return () => setAgentVisible(false);
  }, [chatOpen, setAgentVisible]);

  useEffect(() => {
    if (priorCurrentMonthRef.current === monthAvailability.currentMonthCode) return;
    priorCurrentMonthRef.current = monthAvailability.currentMonthCode;
    setMonthTarget('thisMonth');
    setSelectedCode(null);
    setDownloadProgress({ completed: 0, total: 0 });
    setBackgroundCompletion(null);
  }, [monthAvailability.currentMonthCode]);

  const monthCode = monthTarget === 'nextMonth' ? monthAvailability.nextMonthCode : monthAvailability.currentMonthCode;
  const monthLabel = monthTarget === 'nextMonth' ? monthAvailability.nextMonthLabel : monthAvailability.currentMonthLabel;
  const selectedMonthKey = `20${monthCode.slice(0, 2)}-${monthCode.slice(2, 4)}`;

  const summaryCertificates = useMemo(() => searchableCertificates.filter((certificate) => {
    if (String(certificate.certificateCode ?? '').toUpperCase().startsWith(monthCode)) return true;
    return (certificate.parsedSailings ?? []).some((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      const code = String(candidate.certificateCode ?? certificate.certificateCode ?? '').toUpperCase();
      return code.startsWith(monthCode);
    });
  }), [monthCode, searchableCertificates]);
  const certificateSummary = useMemo(() => buildCertificateSummaryReport(
    buildLocalCertificateSailingIndex(summaryCertificates),
    { certificateMonths: [selectedMonthKey] },
  ), [selectedMonthKey, summaryCertificates]);
  const certificateSummaryByCode = useMemo(
    () => new Map(certificateSummary.rows.map((row) => [row.certificateCode, row])),
    [certificateSummary.rows],
  );
  const certificateClassSummary = useMemo(() => {
    const groups = new Map<string, { total: number; oneGuest: number; twoGuests: number }>();
    certificateSummary.options.forEach((option) => {
      const label = option.shipClass || 'Class not stated';
      const current = groups.get(label) ?? { total: 0, oneGuest: 0, twoGuests: 0 };
      current.total += 1;
      if (option.guestCount === 1) current.oneGuest += 1;
      if (option.guestCount === 2) current.twoGuests += 1;
      groups.set(label, current);
    });
    return Array.from(groups.entries())
      .map(([shipClass, counts]) => ({ shipClass, ...counts }))
      .sort((left, right) => right.total - left.total || left.shipClass.localeCompare(right.shipClass));
  }, [certificateSummary.options]);

  const localCatalog = useMemo(() => buildCertificateCatalog(monthCode, certificateType), [certificateType, monthCode]);
  const allLocalCatalog = useMemo(() => [
    ...buildCertificateCatalog(monthCode, 'C'),
    ...buildCertificateCatalog(monthCode, 'A'),
  ], [monthCode]);

  const storedCatalog = useMemo(() => buildStoredCertificateCatalogEntries({
    certificates: searchableCertificates,
    documents: certificateDocuments,
  }), [certificateDocuments, searchableCertificates]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    void Promise.all(storedCatalog.map(async (entry) => {
      if (!entry.documentArchiveUri?.startsWith('file://')) return entry.certificateCode;
      const info = await FileSystem.getInfoAsync(entry.documentArchiveUri).catch(() => ({ exists: false }));
      return info.exists ? null : entry.certificateCode;
    })).then((codes) => {
      if (!cancelled) setMissingArchiveCodes(new Set(codes.filter((code): code is string => Boolean(code))));
    });
    return () => { cancelled = true; };
  }, [storedCatalog]);

  const catalogByCode = useMemo(() => {
    const map = new Map<string, ExplorerCatalogEntry>();
    allLocalCatalog.forEach((entry) => map.set(entry.certificateCode, entry));
    storedCatalog.forEach((entry) => map.set(entry.certificateCode, { ...map.get(entry.certificateCode), ...entry }));
    downloadedCatalog.forEach((entry) => map.set(entry.certificateCode, { ...map.get(entry.certificateCode), ...entry }));
    return map;
  }, [allLocalCatalog, downloadedCatalog, storedCatalog]);

  const visibleCatalog = useMemo(() => {
    return Array.from(catalogByCode.values())
      .filter((entry) => {
        const parts = parseCertificateCode(entry.certificateCode);
        return parts.monthCode === monthCode && parts.family === certificateType;
      })
      .sort((left, right) => {
        const pointDelta = (right.points ?? -1) - (left.points ?? -1);
        return pointDelta || left.certificateCode.localeCompare(right.certificateCode);
      });
  }, [catalogByCode, certificateType, monthCode]);

  const durablyCompletedCodes = useMemo(() => storedCatalog
    .filter((entry) => {
      const parts = parseCertificateCode(entry.certificateCode);
      const savedSailingCount = entry.parsedSailingReferences ?? entry.sailingsFound ?? 0;
      return parts.monthCode === monthCode
        && (parts.family === 'A' || parts.family === 'C')
        && entry.status === 'parsed'
        && savedSailingCount > 0
        && !missingArchiveCodes.has(entry.certificateCode);
    })
    .map((entry) => entry.certificateCode), [missingArchiveCodes, monthCode, storedCatalog]);

  const handleMonthTargetChange = useCallback((target: MonthTarget) => {
    if (certificateOperationRef.current) {
      Alert.alert('Certificate download in progress', 'Wait for the current certificate download and local save to finish before changing months.');
      return;
    }
    if (target === 'nextMonth' && !monthAvailability.nextMonthAvailable) {
      Alert.alert(
        'Next month is not published yet',
        `${monthAvailability.nextMonthLabel} A/C certificates become available during the final 10 days of this month, beginning ${monthAvailability.nextMonthOpensOnLabel}. Saved certificate files are preserved.`,
      );
      return;
    }
    setMonthTarget(target);
    setSelectedCode(null);
    setDownloadProgress({ completed: 0, total: 0 });
    setBackgroundCompletion(null);
  }, [monthAvailability]);

  const handleOpenPdf = useCallback((entry: CertificateCatalogEntry) => {
    void openCertificatePdf(entry.documentArchiveUri || entry.pdfUrl, entry.pdfUrl);
  }, []);

  const mergeCatalogFromResult = useCallback((result: any) => {
    const resultCatalog = Array.isArray(result?.catalog) ? result.catalog as ExplorerCatalogEntry[] : [];
    if (resultCatalog.length > 0) {
      setDownloadedCatalog((prev) => {
        const byCode = new Map(prev.map((item) => [item.certificateCode, item]));
        resultCatalog.forEach((item) => byCode.set(item.certificateCode, { ...byCode.get(item.certificateCode), ...item }));
        return Array.from(byCode.values()).sort((a, b) => a.certificateCode.localeCompare(b.certificateCode));
      });
    }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (certificateOperationRef.current) return;
    certificateOperationRef.current = true;
    cancelCertificateOperationRef.current = false;
    try {
      setBackgroundCompletion(null);
      setDownloadBusy(true);
      setDownloadProgress({ completed: 0, total: allLocalCatalog.length });
      const result = await downloadCertificateCatalogBatched({
        monthCode,
        shipQuery: ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
        includeA: true,
        includeC: true,
        includeD: false,
        onProgress: (completed, total) => setDownloadProgress({ completed, total }),
        onEntry: (entry, completed, total) => {
          setDownloadProgress({ completed, total });
          if (!entry?.certificateCode) return;
          setDownloadedCatalog((previous) => {
            const byCode = new Map(previous.map((item) => [item.certificateCode, item]));
            byCode.set(entry.certificateCode, { ...byCode.get(entry.certificateCode), ...entry });
            return Array.from(byCode.values()).sort((left, right) => left.certificateCode.localeCompare(right.certificateCode));
          });
        },
        verifyParserParity: false,
        resetLog: true,
        documentStorageKey: PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY,
        skipCertificateCodes: durablyCompletedCodes,
        shouldCancel: () => cancelCertificateOperationRef.current,
      });
      mergeCatalogFromResult(result);
      if (isScreenFocusedRef.current) {
        await refreshCertificateDocuments({ force: true });
      } else {
        pendingDocumentRefreshRef.current = true;
      }
      const catalog = Array.isArray((result as any)?.catalog) ? (result as any).catalog as ExplorerCatalogEntry[] : allLocalCatalog;
      const summary = (result as any)?.summary;
      const groups = Number(summary?.parsedSailingGroupCount ?? summary?.matchedSailingCount ?? 0);
      const failedCodes = Array.isArray(summary?.failedCodes) ? summary.failedCodes : [];
      const skippedCompletedCodes = Array.isArray(summary?.skippedCompletedCodes) ? summary.skippedCompletedCodes : [];
      const completionCatalogByCode = new Map(catalogByCode);
      catalog.forEach((entry) => completionCatalogByCode.set(entry.certificateCode, { ...completionCatalogByCode.get(entry.certificateCode), ...entry }));
      const monthCatalog = Array.from(completionCatalogByCode.values()).filter((entry) => parseCertificateCode(entry.certificateCode).monthCode === monthCode);
      const completionTitle = failedCodes.length > 0 ? 'Certificate retry finished with issues' : 'Certificate library is up to date';
      const completionMessage = `${getCatalogSummaryText(monthCatalog.length > 0 ? monthCatalog : catalog, monthLabel)} ${groups.toLocaleString()} newly parsed sailing group${groups === 1 ? '' : 's'} found.${skippedCompletedCodes.length > 0 ? `

Preserved without reprocessing: ${skippedCompletedCodes.length} already saved certificate${skippedCompletedCodes.length === 1 ? '' : 's'}.` : ''}${failedCodes.length > 0 ? `

Needs review: ${failedCodes.join(', ')}. Open the Certificate Log for exact diagnostics.` : ''}`;
      if (isScreenFocusedRef.current) {
        Alert.alert(completionTitle, completionMessage, [
          { text: 'View Sailings', onPress: () => router.push({ pathname: '/certificate-lookup', params: { monthTarget, certificateType: 'ALL' } }) },
          { text: 'OK' },
        ]);
      } else {
        setBackgroundCompletion({
          title: completionTitle,
          message: completionMessage,
          status: failedCodes.length > 0 ? 'warning' : 'success',
        });
      }
    } catch (error) {
      if ((error instanceof Error ? error.message : String(error)).includes(CERTIFICATE_BATCH_CANCELLED)) {
        const snapshot = certificateDownloadLogger.getSnapshot();
        const message = `${snapshot.completed.toLocaleString()} of ${snapshot.total.toLocaleString()} certificates were processed before stopping. Every completed PDF and parsed sailing row remains saved. Press Download Missing / Retry Failed whenever you are ready to continue.`;
        if (isScreenFocusedRef.current) Alert.alert('Certificate download stopped', message);
        else setBackgroundCompletion({ title: 'Certificate download stopped', message, status: 'warning' });
        return;
      }
      const message = `${describeDownloadError(error)}\n\nThe certificate code list is still available. Try Download All again, or tap any code to open the official PDF.`;
      if (isScreenFocusedRef.current) Alert.alert('Download did not finish', message);
      else setBackgroundCompletion({ title: 'Download did not finish', message, status: 'error' });
    } finally {
      certificateOperationRef.current = false;
      cancelCertificateOperationRef.current = false;
      setDownloadBusy(false);
    }
  }, [allLocalCatalog, catalogByCode, durablyCompletedCodes, mergeCatalogFromResult, monthCode, monthLabel, monthTarget, refreshCertificateDocuments, router]);

  const handleCodePress = useCallback(async (entry: ExplorerCatalogEntry) => {
    const savedSailingCount = entry.parsedSailingReferences ?? entry.sailingsFound ?? 0;
    if (entry.status === 'parsed' && savedSailingCount > 0) {
      router.push({
        pathname: '/certificate-lookup',
        params: { monthTarget, certificateType: entry.certificateType, certificateCode: entry.certificateCode },
      });
      return;
    }
    if (certificateOperationRef.current) return;
    certificateOperationRef.current = true;
    setSelectedCode(entry.certificateCode);
    try {
      setBackgroundCompletion(null);
      setDownloadBusy(true);
      const result = await downloadCertificateCatalogBatched({
        monthCode,
        shipQuery: ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
        includeA: entry.certificateType === 'A',
        includeC: entry.certificateType === 'C',
        includeD: false,
        certificateFamilies: [entry.certificateType],
        certificateCodes: [entry.certificateCode],
        verifyParserParity: false,
        resetLog: true,
        documentStorageKey: PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY,
      });
      mergeCatalogFromResult(result);
      if (isScreenFocusedRef.current) {
        await refreshCertificateDocuments({ force: true });
      } else {
        pendingDocumentRefreshRef.current = true;
      }
      const catalogEntry = Array.isArray((result as any)?.catalog)
        ? (result as any).catalog.find((item: ExplorerCatalogEntry) => item.certificateCode === entry.certificateCode)
        : null;
      const diagnostic = normalizeCertificateParseDiagnostics(catalogEntry ?? { certificateCode: entry.certificateCode }, (result as any)?.matches ?? []);
      const completionTitle = diagnostic.status === 'parsed' ? `${entry.certificateCode} parsed` : `${entry.certificateCode} needs review`;
      const completionMessage = diagnostic.status === 'parsed'
        ? `${diagnostic.message} The eligible sailings are saved locally and ready to filter.`
        : diagnostic.message;
      if (isScreenFocusedRef.current) {
        Alert.alert(completionTitle, completionMessage, diagnostic.status === 'parsed' ? [
          { text: 'View Sailings', onPress: () => router.push({ pathname: '/certificate-lookup', params: { monthTarget, certificateType: entry.certificateType, certificateCode: entry.certificateCode } }) },
          { text: 'OK' },
        ] : undefined);
      } else {
        setBackgroundCompletion({
          title: completionTitle,
          message: completionMessage,
          status: diagnostic.status === 'parsed' ? 'success' : 'warning',
        });
      }
    } catch (error) {
      const title = `${entry.certificateCode} download did not finish`;
      const message = `${describeDownloadError(error)}\n\nOpening the official PDF is still available.`;
      if (isScreenFocusedRef.current) Alert.alert(title, message);
      else setBackgroundCompletion({ title, message, status: 'error' });
    } finally {
      certificateOperationRef.current = false;
      setSelectedCode(null);
      setDownloadBusy(false);
    }
  }, [mergeCatalogFromResult, monthCode, monthTarget, refreshCertificateDocuments, router]);

  const handleOpenAdvisor = useCallback(() => {
    setMode('certificateAdvisor');
    setChatOpen(true);
    const mergedCatalog = Array.from(catalogByCode.values()).filter((item) => item.certificateCode.startsWith(monthCode));
    const promptCatalog = mergedCatalog.map((item) => ({
      code: item.certificateCode,
      type: item.certificateType,
      points: item.points,
      status: item.status ?? 'not downloaded yet',
      sailingsFound: item.sailingsFound ?? 0,
      pdfUrl: item.pdfUrl,
    }));
    const personalEvaluations = optimizationBundle ? evaluateOffersWithPersonalValue(
      promptCatalog.map((item) => ({
        id: item.code,
        offerCode: item.code,
        certificateCode: item.code,
        thresholdPoints: item.points,
      })),
      optimizationBundle,
    ) : [];
    void sendMessage([
      `Act as my Casino Royale certificate advisor for ${monthLabel}.`,
      'Discuss all A and C certificate offers loaded or displayed on this screen.',
      'Use expected realized certificate value and future-booking fit, not raw retail value alone.',
      'Never override bankroll, hard-loss, profit-floor, fatigue, or data-quality safety gates.',
      'Use this certificate catalog context:',
      JSON.stringify(promptCatalog).slice(0, 6000),
      'Use these personal value evaluations when available:',
      JSON.stringify(personalEvaluations).slice(0, 4000),
      optimizationBundle?.currentRecommendation ? `Current saved recommendation: ${optimizationBundle.currentRecommendation.actionLabel}.` : 'No saved personal recommendation is available.',
    ].join('\n'));
  }, [catalogByCode, monthCode, monthLabel, optimizationBundle, sendMessage, setMode]);

  const handleExamineOffers = useCallback(() => {
    router.push({
      pathname: '/certificate-lookup',
      params: { monthTarget, certificateType },
    });
  }, [certificateType, monthTarget, router]);

  const openSummaryResults = useCallback((title: string, extra: CertificateSummaryFilter = {}, view: 'options' | 'certificate_codes' | 'physical_sailings' = 'options') => {
    router.push({
      pathname: '/certificate-summary-results',
      params: {
        title,
        view,
        filters: JSON.stringify({ certificateMonths: [selectedMonthKey], ...extra }),
      },
    });
  }, [router, selectedMonthKey]);

  useEffect(() => {
    if (params.chat === '1') {
      setChatOpen(true);
    }
  }, [params.chat]);

  const renderCode = useCallback(({ item }: { item: ExplorerCatalogEntry }) => {
    const isBusy = selectedCode === item.certificateCode && downloadBusy;
    const summary = certificateSummaryByCode.get(item.certificateCode);
    return (
      <TouchableOpacity
        style={styles.codeCard}
        onPress={() => void handleCodePress(item)}
        onLongPress={() => handleOpenPdf(item)}
        disabled={downloadBusy}
        activeOpacity={0.82}
        testID={`certificate-codes.code-${item.certificateCode}`}
      >
        <Text style={styles.codeText}>{item.certificateCode}</Text>
        <Text style={styles.pointsText}>{formatCertificatePoints(item.points)}</Text>
        {item.parsedSailingReferences != null || item.sailingsFound != null ? (
          <Text style={styles.sailingsText}>{(item.parsedSailingReferences ?? item.sailingsFound ?? 0).toLocaleString()} sailing references · {(item.sailingGroups ?? 0).toLocaleString()} groups</Text>
        ) : null}
        {summary ? (
          <View style={styles.codeSummaryGrid} testID={`certificate-codes.summary-${item.certificateCode}`}>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · all rows`, { certificateCodes: [item.certificateCode] })}><Text style={styles.codeSummaryValue}>{summary.totalOptions.toLocaleString()}</Text><Text style={styles.codeSummaryLabel}>Total rows</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · one guest`, { certificateCodes: [item.certificateCode], guestCounts: [1] })}><Text style={styles.codeSummaryValue}>{summary.oneGuestOptions.toLocaleString()}</Text><Text style={styles.codeSummaryLabel}>1 guest</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · two guests`, { certificateCodes: [item.certificateCode], guestCounts: [2] })}><Text style={styles.codeSummaryValue}>{summary.twoGuestOptions.toLocaleString()}</Text><Text style={styles.codeSummaryLabel}>2 guests</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · weekend departures`, { certificateCodes: [item.certificateCode], weekendDepartureOnly: true })}><Text style={styles.codeSummaryValue}>{summary.weekendDepartures.toLocaleString()}</Text><Text style={styles.codeSummaryLabel}>Weekend</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · Florida departures`, { certificateCodes: [item.certificateCode], floridaDepartureOnly: true })}><Text style={styles.codeSummaryValue}>{summary.floridaDepartures.toLocaleString()}</Text><Text style={styles.codeSummaryLabel}>Florida</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · shortest cruises`, { metric: 'shortest', metricCertificateCode: item.certificateCode })}><Text style={styles.codeSummaryValue}>{summary.shortestNights ?? '—'}</Text><Text style={styles.codeSummaryLabel}>Shortest</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · longest cruises`, { metric: 'longest', metricCertificateCode: item.certificateCode })}><Text style={styles.codeSummaryValue}>{summary.longestNights ?? '—'}</Text><Text style={styles.codeSummaryLabel}>Longest</Text></TouchableOpacity>
            <TouchableOpacity style={styles.codeSummaryMetric} onPress={() => openSummaryResults(`${item.certificateCode} · physical sailings`, { certificateCodes: [item.certificateCode] }, 'physical_sailings')}><Text style={styles.codeSummaryValue}>{summary.physicalSailings.toLocaleString()}</Text><Text style={styles.codeSummaryLabel}>Sailings</Text></TouchableOpacity>
          </View>
        ) : <Text style={styles.codeSummaryMissing}>Download to populate exact sailing rows</Text>}
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
        {isBusy ? <ActivityIndicator size="small" color="#A36A00" style={{ marginTop: 4 }} /> : null}
      </TouchableOpacity>
    );
  }, [certificateSummaryByCode, downloadBusy, handleCodePress, handleOpenPdf, openSummaryResults, selectedCode]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#E8F3F7', '#FBF8F2', '#F2EEE6']} style={styles.hero}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.circleButton} testID="certificate-codes.back">
            <ChevronLeft size={21} color="#1C2F7A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenAdvisor} style={styles.circleButton} testID="certificate-codes.ai">
            <Sparkles size={19} color="#0E7FA7" />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>Casino Royale Offer Codes</Text>
        <Text style={styles.title}>Certificate Codes</Text>
        <Text style={styles.subtitle}>Browse every offer code the way royalcaribbean.com lists them, then tap a code to download and inspect eligible sailings scraped from that certificate.</Text>
        <View style={styles.monthRow}>
          {(['thisMonth', 'nextMonth'] as MonthTarget[]).map((target) => (
            <TouchableOpacity
              key={target}
              onPress={() => handleMonthTargetChange(target)}
              disabled={target === 'nextMonth' && !monthAvailability.nextMonthAvailable}
              accessibilityState={{ disabled: target === 'nextMonth' && !monthAvailability.nextMonthAvailable, selected: monthTarget === target }}
              accessibilityLabel={target === 'nextMonth' && !monthAvailability.nextMonthAvailable ? `${monthAvailability.nextMonthLabel} certificates, available ${monthAvailability.nextMonthOpensOnLabel}` : `${target === 'thisMonth' ? monthAvailability.currentMonthLabel : monthAvailability.nextMonthLabel} certificates`}
              style={[styles.monthButton, monthTarget === target && styles.monthButtonActive, target === 'nextMonth' && !monthAvailability.nextMonthAvailable && { opacity: 0.48 }]}
              testID={`certificate-codes.month-${target}`}
            >
              <CalendarClock size={14} color={monthTarget === target ? '#0E7FA7' : COLORS.navyDeep} />
              <View style={styles.monthLabelGroup}>
                <Text style={[styles.monthText, monthTarget === target && styles.monthTextActive]}>{target === 'thisMonth' ? 'Current month' : monthAvailability.nextMonthAvailable ? 'Next month' : `Available ${monthAvailability.nextMonthOpensOnLabel}`}</Text>
                <Text style={[styles.monthDateText, monthTarget === target && styles.monthTextActive]}>{target === 'thisMonth' ? monthAvailability.currentMonthLabel : monthAvailability.nextMonthLabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.segmentWrap}>
        <View style={styles.segmentRow}>
          {(['C', 'A'] as CertificateType[]).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setCertificateType(type)}
              style={[styles.segmentButton, certificateType === type && styles.segmentButtonActive]}
              testID={`certificate-codes.toggle-${type}`}
            >
              <Text style={[styles.segmentText, certificateType === type && styles.segmentTextActive]}>{type} Certificates</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={visibleCatalog}
        keyExtractor={(item) => item.certificateCode}
        renderItem={renderCode}
        numColumns={1}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.casinoCard}>
            <PremiumVoyageArtwork kind="casino" ship={`${certificateType} Certificate Bank`} destination={`${monthLabel} · saved Royal Caribbean offer inventory`} height={116} showCaption={false} testID="certificate-codes-artwork" />
            <Text style={styles.cardEyebrow}>Casino Royale</Text>
            <Text style={styles.cardTitle}>{certificateType} Certificate Bank</Text>
            <Text style={styles.cardSubtitle}>{monthLabel} · {visibleCatalog.length} certificate code{visibleCatalog.length === 1 ? '' : 's'}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleDownloadAll}
                disabled={downloadBusy}
                style={styles.primaryButton}
                activeOpacity={0.85}
                testID="certificate-codes.download-all"
              >
                {downloadBusy && !selectedCode ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Download size={16} color="#FFFFFF" />}
                <Text style={styles.primaryButtonText}>{downloadBusy && !selectedCode
                  ? downloadProgress.total > 0 && downloadProgress.completed >= downloadProgress.total
                    ? `Saving ${downloadProgress.total} certificate${downloadProgress.total === 1 ? '' : 's'} locally…`
                    : `Downloading ${downloadProgress.completed}/${downloadProgress.total || '…'}`
                  : durablyCompletedCodes.length > 0 ? 'Download Missing / Retry Failed' : 'Download All A/C'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExamineOffers}
                style={styles.secondaryButton}
                activeOpacity={0.85}
                testID="certificate-codes.examine-offers"
              >
                <Bot size={16} color={COLORS.navyDeep} />
                <Text style={styles.secondaryButtonText}>Examine Offers</Text>
              </TouchableOpacity>
            </View>
            {downloadBusy && !selectedCode ? <TouchableOpacity style={styles.cancelDownloadButton} onPress={() => { cancelCertificateOperationRef.current = true; }} testID="certificate-codes.cancel-download"><StopCircle size={16} color="#991B1B" /><Text style={styles.cancelDownloadText}>Stop after current certificate pair</Text></TouchableOpacity> : null}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/certificate-summary', params: { monthTarget } })}
              style={styles.certSummaryButton}
              activeOpacity={0.85}
              testID="certificate-codes.cert-summary"
            >
              <Columns3 size={18} color="#FFFFFF" />
              <View style={styles.certSummaryCopy}>
                <Text style={styles.certSummaryTitle}>Cert Summary</Text>
                <Text style={styles.certSummaryText}>Compare points, guest eligibility, ships, classes, ports, and cruise lengths.</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.downloadedSummary} testID="certificate-codes.downloaded-summary">
              <View style={styles.downloadedSummaryHeader}>
                <View style={styles.downloadedSummaryTitleRow}><Columns3 size={17} color="#0E7FA7" /><Text style={styles.downloadedSummaryTitle}>Downloaded certificate results</Text></View>
                <Text style={styles.downloadedSummaryCaption}>Every number opens the exact locally saved rows behind it.</Text>
              </View>
              {certificateDocumentLoadState === 'loading' ? <View style={styles.libraryLoadRow} testID="certificate-codes.library-loading"><ActivityIndicator size="small" color="#0E7FA7" /><Text style={styles.libraryLoadText}>Restoring saved certificate results…</Text></View> : null}
              {certificateDocumentLoadState === 'error' ? <TouchableOpacity style={styles.libraryLoadError} onPress={() => void refreshCertificateDocuments({ force: true })} testID="certificate-codes.library-retry"><Text style={styles.libraryLoadErrorText}>Saved certificate results could not be restored. Tap to retry.</Text></TouchableOpacity> : null}
              <View style={styles.downloadedMetricGrid}>
                <TouchableOpacity style={styles.downloadedMetric} onPress={() => openSummaryResults('All downloaded certificate rows')} testID="certificate-codes.metric-total"><Text style={styles.downloadedMetricValue}>{certificateSummary.totalOptions.toLocaleString()}</Text><Text style={styles.downloadedMetricLabel}>Eligible rows</Text></TouchableOpacity>
                <TouchableOpacity style={styles.downloadedMetric} onPress={() => openSummaryResults('One-guest certificate rows', { guestCounts: [1] })} testID="certificate-codes.metric-one-guest"><Text style={styles.downloadedMetricValue}>{certificateSummary.oneGuestOptions.toLocaleString()}</Text><Text style={styles.downloadedMetricLabel}>1 guest</Text></TouchableOpacity>
                <TouchableOpacity style={styles.downloadedMetric} onPress={() => openSummaryResults('Two-guest certificate rows', { guestCounts: [2] })} testID="certificate-codes.metric-two-guests"><Text style={styles.downloadedMetricValue}>{certificateSummary.twoGuestOptions.toLocaleString()}</Text><Text style={styles.downloadedMetricLabel}>2 guests</Text></TouchableOpacity>
                <TouchableOpacity style={styles.downloadedMetric} onPress={() => openSummaryResults('Physical certificate sailings', {}, 'physical_sailings')} testID="certificate-codes.metric-physical"><Text style={styles.downloadedMetricValue}>{certificateSummary.physicalSailingCount.toLocaleString()}</Text><Text style={styles.downloadedMetricLabel}>Physical sailings</Text></TouchableOpacity>
              </View>
              <View style={styles.classSummaryHeader}><Ship size={15} color={COLORS.navyDeep} /><Text style={styles.classSummaryTitle}>By ship class</Text></View>
              {certificateClassSummary.length > 0 ? (
                <View style={styles.classSummaryGrid}>
                  {certificateClassSummary.map((entry) => (
                    <TouchableOpacity key={entry.shipClass} style={styles.classSummaryChip} onPress={() => openSummaryResults(`${entry.shipClass} certificate rows`, entry.shipClass === 'Class not stated' ? { qualityIssues: ['missing_ship_class'] } : { shipClasses: [entry.shipClass] })} testID={`certificate-codes.class-${entry.shipClass}`}>
                      <Text style={styles.classSummaryValue}>{entry.total.toLocaleString()}</Text>
                      <Text style={styles.classSummaryLabel}>{entry.shipClass}</Text>
                      <View style={styles.classGuestRow}><Users size={10} color="#66737F" /><Text style={styles.classGuestText}>{entry.oneGuest.toLocaleString()} 1-guest · {entry.twoGuests.toLocaleString()} 2-guest</Text></View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : <Text style={styles.classSummaryEmpty}>Downloaded rows will be grouped by ship class here.</Text>}
            </View>
            <Text style={styles.helperText}>{durablyCompletedCodes.length.toLocaleString()} certificate{durablyCompletedCodes.length === 1 ? '' : 's'} for {monthLabel} already saved. Download All preserves those records and processes only newly published, missing, or previously failed codes. Tap a saved code to view and filter its eligible sailings; long-press to open its PDF.</Text>
            <TouchableOpacity
              onPress={() => router.push('/casino/certificate-link-review')}
              style={styles.ledgerReviewButton}
              activeOpacity={0.85}
              testID="certificate-codes.earned-ledger"
            >
              <Ticket size={16} color={COLORS.navyDeep} />
              <Text style={styles.ledgerReviewText}>View Earned Certificate Ledger</Text>
            </TouchableOpacity>
            {backgroundCompletion ? (
              <View style={[
                styles.backgroundCompletion,
                backgroundCompletion.status === 'success' && styles.backgroundCompletionSuccess,
                backgroundCompletion.status === 'warning' && styles.backgroundCompletionWarning,
                backgroundCompletion.status === 'error' && styles.backgroundCompletionError,
              ]} testID="certificate-codes.background-completion">
                <Text style={styles.backgroundCompletionTitle}>{backgroundCompletion.title}</Text>
                <Text style={styles.backgroundCompletionMessage}>{backgroundCompletion.message}</Text>
              </View>
            ) : null}
            <CertificateDownloadLogPanel />
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <SafeAreaView style={styles.chatContainer} edges={['top', 'bottom']}>
          <View style={styles.chatHeader}>
            <View>
              <Text style={styles.chatTitle}>Examine Certificate Offers</Text>
              <Text style={styles.chatSubtitle}>{monthLabel} A/C certificate advisor</Text>
            </View>
            <Pressable onPress={() => setChatOpen(false)} style={styles.chatClose}>
              <X size={21} color="#1C2F7A" />
            </Pressable>
          </View>
          <AgentXChat
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpanded}
            showHeader={false}
            placeholder="Ask about these A/C certificates, best values, levels to chase..."
            mode={mode}
            onModeChange={setMode}
            contextLabel="Certificate Advisor"
            title="Certificate Advisor"
            subtitle="A/C/D Offer Intelligence"
            welcomeTitle="Ask about this month’s certificate offers"
            welcomeSubtitle="Discuss A and C certificate levels, guest coverage, value, best ships, and what is worth chasing."
            disclaimerText="Certificate advice is based on loaded app data and official certificate PDF parsing when available. Always verify final terms with Royal Caribbean."
            useSafeAreaPadding={false}
            showDevAssistant={false}
            showFilterStrip={false}
            defaultTtsEnabled={false}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F3F2' },
  hero: { paddingHorizontal: SPACING.lg, paddingTop: Platform.OS === 'android' ? SPACING.md : 0, paddingBottom: SPACING.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  circleButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D0' },
  eyebrow: { color: '#0E7FA7', textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 11, fontWeight: '900', marginBottom: 6 },
  title: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 32, lineHeight: 38, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#66737F', fontSize: 14, lineHeight: 21, fontWeight: '500', marginBottom: SPACING.lg },
  monthRow: { flexDirection: 'row', gap: SPACING.sm },
  monthButton: { flex: 1, minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: '#D5D5D0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.sm },
  monthButtonActive: { backgroundColor: '#DFF2EF', borderColor: '#0E7FA7' },
  monthLabelGroup: { flexShrink: 1, alignItems: 'center', justifyContent: 'center' },
  monthText: { color: '#1C2F7A', fontSize: 13, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  monthDateText: { color: '#66737F', fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  monthTextActive: { color: COLORS.navyDeep },
  segmentWrap: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: '#F6F2EA', zIndex: 2 },
  segmentRow: { flexDirection: 'row', gap: SPACING.sm },
  segmentButton: { flex: 1, borderRadius: 26, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', paddingVertical: SPACING.md, alignItems: 'center', ...SHADOW.sm },
  segmentButtonActive: { backgroundColor: '#DFF2EF', borderColor: '#0E7FA7' },
  segmentText: { color: '#333334', fontSize: 17, fontWeight: '900' },
  segmentTextActive: { color: COLORS.navyDeep },
  listContent: { padding: SPACING.lg, paddingBottom: 110 },
  columnWrap: { gap: SPACING.md },
  casinoCard: { backgroundColor: '#FFFDF9', borderRadius: 22, borderWidth: 1, borderColor: '#D5D5D0', padding: SPACING.lg, marginBottom: SPACING.md, alignItems: 'stretch', gap: 8, ...SHADOW.sm },
  cardEyebrow: { color: '#A36A00', textTransform: 'uppercase', letterSpacing: 2.2, fontSize: 12, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  cardTitle: { color: COLORS.navyDeep, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  cardSubtitle: { color: CLEAN_THEME.text.secondary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.md },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%', marginBottom: SPACING.sm },
  primaryButton: { flex: 1.1, borderRadius: 18, backgroundColor: '#0E7FA7', paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  secondaryButton: { flex: 1, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D0', paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryButtonText: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 14 },
  cancelDownloadButton: { width: '100%', borderRadius: 14, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: SPACING.sm, marginBottom: SPACING.sm, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  cancelDownloadText: { color: '#991B1B', fontSize: 12, fontWeight: '900' },
  certSummaryButton: { width: '100%', borderRadius: 18, backgroundColor: COLORS.navyDeep, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, alignItems: 'center', flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  certSummaryCopy: { flex: 1 },
  certSummaryTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  certSummaryText: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 16, marginTop: 2 },
  downloadedSummary: { width: '100%', backgroundColor: '#F8FAFB', borderWidth: 1, borderColor: '#D9E1E6', borderRadius: 18, padding: SPACING.md, marginBottom: SPACING.md },
  downloadedSummaryHeader: { marginBottom: SPACING.sm },
  downloadedSummaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  downloadedSummaryTitle: { color: COLORS.navyDeep, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18, fontWeight: '800' },
  downloadedSummaryCaption: { color: '#66737F', fontSize: 11, lineHeight: 16, marginTop: 3 },
  libraryLoadRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, backgroundColor: '#E8F7FB', paddingHorizontal: 12, marginBottom: 9 },
  libraryLoadText: { color: '#123D73', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  libraryLoadError: { minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: '#FCE8E8', paddingHorizontal: 12, marginBottom: 9 },
  libraryLoadErrorText: { color: '#8B2323', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  downloadedMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  downloadedMetric: { width: '48%', minHeight: 66, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E1E6', borderRadius: 13, padding: 9 },
  downloadedMetricValue: { color: COLORS.navyDeep, fontSize: 20, fontWeight: '900' },
  downloadedMetricLabel: { color: '#66737F', fontSize: 10, fontWeight: '700', marginTop: 2 },
  classSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md, marginBottom: SPACING.sm },
  classSummaryTitle: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '900' },
  classSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  classSummaryChip: { width: '48%', minHeight: 72, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3EA', borderRadius: 13, padding: 9 },
  classSummaryValue: { color: '#0F766E', fontSize: 17, fontWeight: '900' },
  classSummaryLabel: { color: COLORS.navyDeep, fontSize: 10, lineHeight: 14, fontWeight: '800', marginTop: 1 },
  classGuestRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  classGuestText: { color: '#66737F', fontSize: 9, fontWeight: '700' },
  classSummaryEmpty: { color: '#66737F', fontSize: 11, lineHeight: 16 },
  helperText: { color: '#765B18', fontSize: 12, lineHeight: 17, textAlign: 'center', fontWeight: '600' },
  ledgerReviewButton: { marginTop: SPACING.sm, borderRadius: 14, backgroundColor: '#FFF7D6', borderWidth: 1, borderColor: '#D4BD74', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  ledgerReviewText: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '900' },
  backgroundCompletion: { width: '100%', borderRadius: 12, borderWidth: 1, padding: SPACING.md, marginTop: SPACING.md },
  backgroundCompletionSuccess: { backgroundColor: '#ECFDF5', borderColor: '#4EC0A5' },
  backgroundCompletionWarning: { backgroundColor: '#FFFBEB', borderColor: '#E6B63D' },
  backgroundCompletionError: { backgroundColor: '#FEF2F2', borderColor: '#A52B34' },
  backgroundCompletionTitle: { color: COLORS.navyDeep, fontSize: 14, fontWeight: '800' },
  backgroundCompletionMessage: { color: '#334155', fontSize: 12, lineHeight: 18, marginTop: 4 },
  codeCard: { width: '100%', minHeight: 224, borderRadius: 18, backgroundColor: '#FFFDF9', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D5D5D0', marginBottom: SPACING.md, alignItems: 'center', justifyContent: 'center', padding: SPACING.md, ...SHADOW.sm },
  codeText: { color: '#1C2F7A', fontSize: 22, fontWeight: '900', textDecorationLine: 'underline', textAlign: 'center' },
  pointsText: { color: '#7A5B0D', fontSize: 16, fontWeight: '800', marginTop: 4 },
  sailingsText: { color: '#0E7FA7', fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  codeSummaryGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  codeSummaryMetric: { width: '23.5%', minHeight: 48, borderRadius: 9, backgroundColor: '#F3F6F8', borderWidth: 1, borderColor: '#E1E7EA', paddingHorizontal: 4, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  codeSummaryValue: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '900' },
  codeSummaryLabel: { color: '#66737F', fontSize: 8.5, fontWeight: '800', textAlign: 'center', marginTop: 1 },
  codeSummaryMissing: { color: '#66737F', fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 8 },
  statusText: { fontSize: 10, fontWeight: '900', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  chatContainer: { flex: 1, backgroundColor: '#F6F2EA' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D5D5D0' },
  chatTitle: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18, fontWeight: '700' },
  chatSubtitle: { color: '#66737F', fontSize: 12, fontWeight: '700', marginTop: 2 },
  chatClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#D5D5D0', alignItems: 'center', justifyContent: 'center' },
});
