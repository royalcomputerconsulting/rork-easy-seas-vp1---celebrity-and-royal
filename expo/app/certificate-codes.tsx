import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, CalendarClock, ChevronLeft, Download, ExternalLink, Sparkles, Ticket, X } from 'lucide-react-native';

import { AgentXChat } from '@/components/AgentXChat';
import { CertificateDownloadLogPanel } from '@/components/certificates/CertificateDownloadLogPanel';
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
import { downloadCertificateCatalogBatched } from '@/lib/certificates/certificateBatchDownload';
import { CERTIFICATE_DOCUMENT_STORE_KEY } from '@/lib/certificates/certificateDocumentStore';
import { normalizeCertificateParseDiagnostics, type CertificateParseStatus } from '@/lib/certificates/certificateParsingStatus';
import { parseCertificateCode } from '@/lib/certificates/certificatePdfParserCore';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { useAgentX } from '@/state/AgentXProvider';
import { useAuth } from '@/state/AuthProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { usePersonalCertificateOptimizer } from '@/state/PersonalCertificateOptimizerProvider';
import { evaluateOffersWithPersonalValue } from '@/lib/optimization';

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
  if (status === 'parsed') return '#6EE7B7';
  if (status === 'downloading' || status === 'downloaded') return '#93C5FD';
  if (status === 'parse_failed' || status === 'unsupported_pdf') return '#FCD34D';
  if (status === 'network_error') return '#FCA5A5';
  return '#CBD5E1';
}

export default function CertificateCodesScreen() {
  const router = useRouter();
  const { authenticatedEmail } = useAuth();
  const { searchableCertificates, certificateDocuments, refreshCertificateDocuments } = useCertificates();
  const isScreenFocusedRef = useRef(false);
  const pendingDocumentRefreshRef = useRef(false);
  const certificateOperationRef = useRef(false);
  const personalOptimizer = usePersonalCertificateOptimizer();
  const optimizationBundle = personalOptimizer?.bundle ?? null;
  const params = useLocalSearchParams<{ chat?: string }>();
  const [monthTarget, setMonthTarget] = useState<MonthTarget>('thisMonth');
  const [certificateType, setCertificateType] = useState<CertificateType>('C');
  const [downloadedCatalog, setDownloadedCatalog] = useState<ExplorerCatalogEntry[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(params.chat === '1');
  const [backgroundCompletion, setBackgroundCompletion] = useState<{ title: string; message: string; status: 'success' | 'warning' | 'error' } | null>(null);

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

  useFocusEffect(useCallback(() => {
    isScreenFocusedRef.current = true;
    const force = pendingDocumentRefreshRef.current;
    pendingDocumentRefreshRef.current = false;
    const interaction = InteractionManager.runAfterInteractions(() => {
      if (force) void refreshCertificateDocuments({ force: true });
      else void refreshCertificateDocuments();
    });
    return () => {
      isScreenFocusedRef.current = false;
      interaction.cancel();
    };
  }, [refreshCertificateDocuments]));

  useEffect(() => {
    setAgentVisible(chatOpen);
    return () => setAgentVisible(false);
  }, [chatOpen, setAgentVisible]);

  const monthCode = useMemo(() => getMonthCodeForTarget(monthTarget), [monthTarget]);
  const monthLabel = useMemo(() => getMonthLabelForTarget(monthTarget), [monthTarget]);

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
    setMonthTarget(target);
    setSelectedCode(null);
    setDownloadProgress({ completed: 0, total: 0 });
    setBackgroundCompletion(null);
  }, []);

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
        verifyParserParity: false,
        resetLog: true,
        documentStorageKey: getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, authenticatedEmail),
        skipCertificateCodes: durablyCompletedCodes,
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
      const message = `${describeDownloadError(error)}\n\nThe certificate code list is still available. Try Download All again, or tap any code to open the official PDF.`;
      if (isScreenFocusedRef.current) Alert.alert('Download did not finish', message);
      else setBackgroundCompletion({ title: 'Download did not finish', message, status: 'error' });
    } finally {
      certificateOperationRef.current = false;
      setDownloadBusy(false);
    }
  }, [allLocalCatalog, authenticatedEmail, catalogByCode, durablyCompletedCodes, mergeCatalogFromResult, monthCode, monthLabel, monthTarget, refreshCertificateDocuments, router]);

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
        documentStorageKey: getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, authenticatedEmail),
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
  }, [authenticatedEmail, mergeCatalogFromResult, monthCode, monthTarget, refreshCertificateDocuments, router]);

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

  useEffect(() => {
    if (params.chat === '1') {
      setChatOpen(true);
    }
  }, [params.chat]);

  const renderCode = useCallback(({ item }: { item: ExplorerCatalogEntry }) => {
    const isBusy = selectedCode === item.certificateCode && downloadBusy;
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
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
        {isBusy ? <ActivityIndicator size="small" color="#A36A00" style={{ marginTop: 4 }} /> : null}
      </TouchableOpacity>
    );
  }, [downloadBusy, handleCodePress, handleOpenPdf, selectedCode]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#10223A', '#123E62', '#0E7FA7']} style={styles.hero}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.circleButton} testID="certificate-codes.back">
            <ChevronLeft size={21} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenAdvisor} style={styles.circleButton} testID="certificate-codes.ai">
            <Sparkles size={19} color="#FFFFFF" />
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
              style={[styles.monthButton, monthTarget === target && styles.monthButtonActive]}
              testID={`certificate-codes.month-${target}`}
            >
              <CalendarClock size={14} color={monthTarget === target ? COLORS.navyDeep : '#FFFFFF'} />
              <View style={styles.monthLabelGroup}>
                <Text style={[styles.monthText, monthTarget === target && styles.monthTextActive]}>{target === 'thisMonth' ? 'This Month' : 'Next Month'}</Text>
                <Text style={[styles.monthDateText, monthTarget === target && styles.monthTextActive]}>{getMonthLabelForTarget(target)}</Text>
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
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrap}
        ListHeaderComponent={
          <View style={styles.casinoCard}>
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
            <Text style={styles.helperText}>{durablyCompletedCodes.length.toLocaleString()} certificate{durablyCompletedCodes.length === 1 ? '' : 's'} for {monthLabel} already saved. Download All preserves those records and processes only newly published, missing, or previously failed codes. Tap a saved code to view and filter its eligible sailings; long-press to open its PDF.</Text>
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
              <X size={21} color="#FFFFFF" />
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
  container: { flex: 1, backgroundColor: '#EAF7F8' },
  hero: { paddingHorizontal: SPACING.lg, paddingTop: Platform.OS === 'android' ? SPACING.md : 0, paddingBottom: SPACING.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  circleButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  eyebrow: { color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 2.2, fontSize: 13, fontWeight: '900', marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 36, lineHeight: 40, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 18, lineHeight: 26, fontWeight: '500', marginBottom: SPACING.lg },
  monthRow: { flexDirection: 'row', gap: SPACING.sm },
  monthButton: { flex: 1, minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.sm },
  monthButtonActive: { backgroundColor: '#E7DDA7', borderColor: '#E7DDA7' },
  monthLabelGroup: { flexShrink: 1, alignItems: 'center', justifyContent: 'center' },
  monthText: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  monthDateText: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  monthTextActive: { color: COLORS.navyDeep },
  segmentWrap: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: '#10223A', zIndex: 2 },
  segmentRow: { flexDirection: 'row', gap: SPACING.sm },
  segmentButton: { flex: 1, borderRadius: 26, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', paddingVertical: SPACING.md, alignItems: 'center', ...SHADOW.sm },
  segmentButtonActive: { backgroundColor: '#F3D978', borderColor: '#F3D978' },
  segmentText: { color: '#111827', fontSize: 17, fontWeight: '900' },
  segmentTextActive: { color: COLORS.navyDeep },
  listContent: { padding: SPACING.lg, paddingBottom: 110 },
  columnWrap: { gap: SPACING.md },
  casinoCard: { backgroundColor: '#F5F0E6', borderRadius: 22, borderWidth: 1, borderColor: '#D8C78E', padding: SPACING.lg, marginBottom: SPACING.md, alignItems: 'center', ...SHADOW.sm },
  cardEyebrow: { color: '#A36A00', textTransform: 'uppercase', letterSpacing: 3, fontSize: 15, fontWeight: '900', marginBottom: 8 },
  cardTitle: { color: COLORS.navyDeep, fontSize: 24, fontWeight: '900', marginBottom: 4 },
  cardSubtitle: { color: CLEAN_THEME.text.secondary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.md },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%', marginBottom: SPACING.sm },
  primaryButton: { flex: 1.1, borderRadius: 18, backgroundColor: '#0E7FA7', paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  secondaryButton: { flex: 1, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8C78E', paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryButtonText: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 14 },
  helperText: { color: '#765B18', fontSize: 12, lineHeight: 17, textAlign: 'center', fontWeight: '600' },
  backgroundCompletion: { width: '100%', borderRadius: 12, borderWidth: 1, padding: SPACING.md, marginTop: SPACING.md },
  backgroundCompletionSuccess: { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  backgroundCompletionWarning: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  backgroundCompletionError: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  backgroundCompletionTitle: { color: COLORS.navyDeep, fontSize: 14, fontWeight: '800' },
  backgroundCompletionMessage: { color: '#334155', fontSize: 12, lineHeight: 18, marginTop: 4 },
  codeCard: { flex: 1, minHeight: 104, borderRadius: 12, backgroundColor: '#10223A', borderWidth: 2, borderColor: '#D4BD74', marginBottom: SPACING.md, alignItems: 'center', justifyContent: 'center', padding: SPACING.sm, ...SHADOW.sm },
  codeText: { color: '#FFD86B', fontSize: 24, fontWeight: '900', textDecorationLine: 'underline', textAlign: 'center' },
  pointsText: { color: '#FFF1B8', fontSize: 16, fontWeight: '800', marginTop: 4 },
  sailingsText: { color: '#A7F3D0', fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  statusText: { fontSize: 10, fontWeight: '900', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  chatContainer: { flex: 1, backgroundColor: '#071426' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: '#0F2439', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  chatTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  chatSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  chatClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
