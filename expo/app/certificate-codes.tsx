import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, CalendarClock, ChevronLeft, Download, ExternalLink, Sparkles, Ticket, X } from 'lucide-react-native';

import { AgentXChat } from '@/components/AgentXChat';
import { CertificateDownloadLogPanel } from '@/components/certificates/CertificateDownloadLogPanel';
import { BORDER_RADIUS, CLEAN_THEME, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  buildCertificateCatalog,
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
import { useAgentX } from '@/state/AgentXProvider';
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
    .replace(/Unexpected character:\s*N/i, 'The backend returned a non-JSON response, usually a temporary Render/Royal download issue.')
    .trim();
  return cleaned || 'Certificate download failed. Please try again.';
}

function getCatalogSummaryText(catalog: ExplorerCatalogEntry[], monthLabel: string): string {
  const byType = catalog.reduce<Record<string, number>>((acc, item) => {
    acc[item.certificateType] = (acc[item.certificateType] ?? 0) + 1;
    return acc;
  }, {});
  const sailingCount = catalog.reduce((sum, item) => sum + (item.sailingsFound ?? 0), 0);
  return `${monthLabel}: ${byType.C ?? 0} C certificates, ${byType.A ?? 0} A certificates, ${sailingCount.toLocaleString()} parsed sailing references.`;
}

export default function CertificateCodesScreen() {
  const router = useRouter();
  const { bundle: optimizationBundle } = usePersonalCertificateOptimizer();
  const params = useLocalSearchParams<{ chat?: string }>();
  const [monthTarget, setMonthTarget] = useState<MonthTarget>('thisMonth');
  const [certificateType, setCertificateType] = useState<CertificateType>('C');
  const [downloadedCatalog, setDownloadedCatalog] = useState<ExplorerCatalogEntry[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(params.chat === '1');

  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ completed: 0, total: 0 });
  const {
    messages,
    isLoading,
    sendMessage,
    isExpanded,
    toggleExpanded,
    mode,
    setMode,
  } = useAgentX();

  const monthCode = useMemo(() => getMonthCodeForTarget(monthTarget), [monthTarget]);
  const monthLabel = useMemo(() => getMonthLabelForTarget(monthTarget), [monthTarget]);

  const localCatalog = useMemo(() => buildCertificateCatalog(monthCode, certificateType), [certificateType, monthCode]);
  const allLocalCatalog = useMemo(() => [
    ...buildCertificateCatalog(monthCode, 'C'),
    ...buildCertificateCatalog(monthCode, 'A'),
  ], [monthCode]);

  const catalogByCode = useMemo(() => {
    const map = new Map<string, ExplorerCatalogEntry>();
    allLocalCatalog.forEach((entry) => map.set(entry.certificateCode, entry));
    downloadedCatalog.forEach((entry) => map.set(entry.certificateCode, { ...map.get(entry.certificateCode), ...entry }));
    return map;
  }, [allLocalCatalog, downloadedCatalog]);

  const visibleCatalog = useMemo(() => localCatalog.map((entry) => catalogByCode.get(entry.certificateCode) ?? entry), [catalogByCode, localCatalog]);

  const handleOpenPdf = useCallback((entry: CertificateCatalogEntry) => {
    void openCertificatePdf(entry.pdfUrl);
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
    try {
      setDownloadBusy(true);
      setDownloadProgress({ completed: 0, total: allLocalCatalog.length });
      const result = await downloadCertificateCatalogBatched({
        monthCode,
        shipQuery: ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
        includeA: true,
        includeC: true,
        onProgress: (completed, total) => setDownloadProgress({ completed, total }),
        resetLog: true,
      });
      mergeCatalogFromResult(result);
      const catalog = Array.isArray((result as any)?.catalog) ? (result as any).catalog as ExplorerCatalogEntry[] : allLocalCatalog;
      const matches = Array.isArray((result as any)?.matches) ? (result as any).matches.length : 0;
      Alert.alert(
        'Download complete',
        `${getCatalogSummaryText(catalog, monthLabel)} ${matches.toLocaleString()} eligible sailing group${matches === 1 ? '' : 's'} found.`
      );
    } catch (error) {
      Alert.alert(
        'Download did not finish',
        `${describeDownloadError(error)}\n\nThe A/C certificate code list is still available. Try Download All again, or tap any code to open the official PDF.`
      );
    } finally {
      setDownloadBusy(false);
    }
  }, [allLocalCatalog, mergeCatalogFromResult, monthCode, monthLabel]);

  const handleCodePress = useCallback(async (entry: CertificateCatalogEntry) => {
    setSelectedCode(entry.certificateCode);
    try {
      setDownloadBusy(true);
      const result = await downloadCertificateCatalogBatched({
        monthCode,
        shipQuery: ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
        includeA: entry.certificateType === 'A',
        includeC: entry.certificateType === 'C',
        certificateCodes: [entry.certificateCode],
        resetLog: false,
      });
      mergeCatalogFromResult(result);
      const matches = Array.isArray((result as any)?.matches) ? (result as any).matches.length : 0;
      Alert.alert(
        entry.certificateCode,
        matches > 0
          ? `Downloaded ${matches.toLocaleString()} eligible sailing group${matches === 1 ? '' : 's'} for this certificate. Use Examine Offers to discuss them with AI.`
          : 'This certificate was downloaded, but no eligible sailings were parsed. You can still open the official PDF to inspect it.'
      );
    } catch (error) {
      Alert.alert(
        `${entry.certificateCode} download did not finish`,
        `${describeDownloadError(error)}\n\nOpening the official PDF is still available.`
      );
    } finally {
      setSelectedCode(null);
      setDownloadBusy(false);
    }
  }, [mergeCatalogFromResult, monthCode]);

  const handleExamineOffers = useCallback(() => {
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
        activeOpacity={0.82}
        testID={`certificate-codes.code-${item.certificateCode}`}
      >
        <Text style={styles.codeText}>{item.certificateCode}</Text>
        <Text style={styles.pointsText}>{formatCertificatePoints(item.points)}</Text>
        {item.sailingsFound != null ? (
          <Text style={styles.sailingsText}>{item.sailingsFound.toLocaleString()} sailing rows</Text>
        ) : null}
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
          <TouchableOpacity onPress={handleExamineOffers} style={styles.circleButton} testID="certificate-codes.ai">
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
              onPress={() => setMonthTarget(target)}
              style={[styles.monthButton, monthTarget === target && styles.monthButtonActive]}
            >
              <CalendarClock size={14} color={monthTarget === target ? COLORS.navyDeep : '#FFFFFF'} />
              <Text style={[styles.monthText, monthTarget === target && styles.monthTextActive]}>{target === 'thisMonth' ? 'This Month' : 'Next Month'}\n{getMonthLabelForTarget(target)}</Text>
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
                <Text style={styles.primaryButtonText}>{downloadBusy && !selectedCode ? `Downloading ${downloadProgress.completed}/${downloadProgress.total || allLocalCatalog.length}` : 'Download All A/C'}</Text>
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
            <Text style={styles.helperText}>Tap a code to download that certificate’s eligible sailings. Long-press a code to open the official Royal PDF.</Text>
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
            subtitle="A/C Offer Intelligence"
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
  monthText: { color: '#FFFFFF', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' },
  monthTextActive: { color: COLORS.navyDeep },
  segmentWrap: { paddingHorizontal: SPACING.lg, marginTop: -SPACING.md, zIndex: 2 },
  segmentRow: { flexDirection: 'row', gap: SPACING.sm },
  segmentButton: { flex: 1, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: SPACING.md, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: '#E7DDA7', borderColor: '#E7DDA7' },
  segmentText: { color: 'rgba(255,255,255,0.82)', fontSize: 17, fontWeight: '900' },
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
  codeCard: { flex: 1, minHeight: 94, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D4BD74', marginBottom: SPACING.md, alignItems: 'center', justifyContent: 'center', padding: SPACING.sm, ...SHADOW.sm },
  codeText: { color: '#C88A00', fontSize: 24, fontWeight: '900', textDecorationLine: 'underline', textAlign: 'center' },
  pointsText: { color: '#9A6A00', fontSize: 16, fontWeight: '800', textDecorationLine: 'underline', marginTop: 4 },
  sailingsText: { color: '#0F766E', fontSize: 11, fontWeight: '800', marginTop: 4 },
  chatContainer: { flex: 1, backgroundColor: '#071426' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: '#0F2439', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  chatTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  chatSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  chatClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
