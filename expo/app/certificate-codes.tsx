import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, ChevronLeft, ChevronRight, CloudDownload, Lock, Sparkles } from 'lucide-react-native';

import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCertificateOffers } from '@/state/CertificateOffersProvider';

type CertType = 'C' | 'A';
type MonthTarget = 'thisMonth' | 'nextMonth';

interface CertificateLevel {
  suffix: string;
  points: number;
}

// Mirrors the standard Club Royale certificate level ladder shown on
// royalcaribbean.com's own offer-code index pages (VIP2 down to 10),
// used to render buttons immediately without waiting on a PDF scan.
const CERTIFICATE_LEVELS: CertificateLevel[] = [
  { suffix: 'VIP2', points: 40000 },
  { suffix: '01', points: 25000 },
  { suffix: '02', points: 15000 },
  { suffix: '02A', points: 9000 },
  { suffix: '03', points: 6500 },
  { suffix: '03A', points: 4000 },
  { suffix: '04', points: 3000 },
  { suffix: '05', points: 2000 },
  { suffix: '06', points: 1500 },
  { suffix: '07', points: 1200 },
  { suffix: '08', points: 800 },
  { suffix: '09', points: 600 },
  { suffix: '10', points: 400 },
];

function getMonthCode(target: MonthTarget): string {
  const now = new Date();
  const base = target === 'nextMonth' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  const year = String(base.getFullYear()).slice(-2);
  const month = String(base.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function getMonthLabel(target: MonthTarget): string {
  const now = new Date();
  const base = target === 'nextMonth' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  return base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function daysRemainingInMonth(date: Date): number {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return lastDay - date.getDate();
}

export default function CertificateCodesScreen() {
  const router = useRouter();
  const [certType, setCertType] = useState<CertType>('C');
  const { getOffer, countOffersForMonth, downloadAll, isDownloadingAll } = useCertificateOffers();
  const [downloadingTarget, setDownloadingTarget] = useState<MonthTarget | null>(null);

  const nextMonthUnlocked = useMemo(() => daysRemainingInMonth(new Date()) <= 6, []);
  const daysLeft = useMemo(() => daysRemainingInMonth(new Date()), []);

  const handleOpenCode = useCallback((suffix: string, target: MonthTarget) => {
    const monthCode = getMonthCode(target);
    const code = `${monthCode}${certType}${suffix}`.toUpperCase();
    router.push({ pathname: '/certificate-code-detail', params: { code, type: certType } } as any);
  }, [certType, router]);

  const handleDownloadAll = useCallback(async (target: MonthTarget) => {
    const monthCode = getMonthCode(target);
    const monthLabel = getMonthLabel(target);
    setDownloadingTarget(target);
    console.log('[CertificateCodes] Download all requested:', { monthCode, certType, target });

    try {
      const result = await downloadAll(monthCode, certType);
      Alert.alert(
        'Download complete',
        `Pulled all ${result.ok + result.errors} offer codes for ${monthLabel} (${certType} certificates). Found ${result.totalSailings.toLocaleString()} sailings across ${result.ok} code${result.ok === 1 ? '' : 's'}${result.errors > 0 ? `, ${result.errors} code${result.errors === 1 ? '' : 's'} not published yet` : ''}. Saved on-device so the app can evaluate every offer instantly.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CertificateCodes] Download all failed:', message);
      Alert.alert('Download failed', `Could not finish downloading all codes: ${message}. Tap Download All to try again.`);
    } finally {
      setDownloadingTarget(null);
    }
  }, [certType, downloadAll]);

  const renderDownloadAllButton = useCallback((target: MonthTarget) => {
    const monthCode = getMonthCode(target);
    const downloadedCount = countOffersForMonth(monthCode, certType);
    const isThisSectionDownloading = isDownloadingAll && downloadingTarget === target;
    const allDownloaded = downloadedCount >= CERTIFICATE_LEVELS.length;

    return (
      <TouchableOpacity
        style={[styles.downloadAllButton, allDownloaded && styles.downloadAllButtonDone]}
        onPress={() => void handleDownloadAll(target)}
        activeOpacity={0.85}
        disabled={isDownloadingAll}
        testID={`certificate-codes.download-all-${target}`}
      >
        {isThisSectionDownloading ? (
          <ActivityIndicator size="small" color={allDownloaded ? '#0F6B3F' : '#FFFFFF'} />
        ) : allDownloaded ? (
          <CheckCircle2 size={16} color="#0F6B3F" />
        ) : (
          <CloudDownload size={16} color="#FFFFFF" />
        )}
        <Text style={[styles.downloadAllButtonText, allDownloaded && styles.downloadAllButtonTextDone]}>
          {isThisSectionDownloading
            ? `Downloading all ${CERTIFICATE_LEVELS.length} codes\u2026`
            : allDownloaded
              ? `All ${downloadedCount} codes downloaded`
              : downloadedCount > 0
                ? `Download All (${downloadedCount}/${CERTIFICATE_LEVELS.length} saved)`
                : 'Download All Offer Codes'}
        </Text>
      </TouchableOpacity>
    );
  }, [certType, countOffersForMonth, downloadingTarget, handleDownloadAll, isDownloadingAll]);

  const renderGrid = useCallback((target: MonthTarget) => (
    <View style={styles.grid}>
      {CERTIFICATE_LEVELS.map((level) => {
        const monthCode = getMonthCode(target);
        const code = `${monthCode}${certType}${level.suffix}`.toUpperCase();
        const cached = getOffer(code);
        return (
          <TouchableOpacity
            key={code}
            style={styles.codeButton}
            onPress={() => handleOpenCode(level.suffix, target)}
            activeOpacity={0.8}
            testID={`certificate-codes.button-${code}`}
          >
            {cached ? (
              <View style={styles.cachedBadge} testID={`certificate-codes.cached-${code}`}>
                <CheckCircle2 size={10} color="#0F6B3F" />
              </View>
            ) : null}
            <Text style={styles.codeButtonCode}>{code}</Text>
            <Text style={styles.codeButtonPoints}>{level.points.toLocaleString()} Points</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  ), [certType, getOffer, handleOpenCode]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#10223A', '#183C63', '#0E7FA7']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-codes.back-button">
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerIconWrap}>
            <Sparkles size={16} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.headerEyebrow}>Casino Royale offer codes</Text>
        <Text style={styles.headerTitle}>Certificate Codes</Text>
        <Text style={styles.headerSubtitle}>
          Browse every offer code the way royalcaribbean.com lists them, then tap a code to see all eligible sailings scraped from that offer.
        </Text>

        <View style={styles.typeToggleRow}>
          <TouchableOpacity
            style={[styles.typeToggle, certType === 'C' && styles.typeToggleActive]}
            onPress={() => setCertType('C')}
            activeOpacity={0.85}
            testID="certificate-codes.toggle-c"
          >
            <Text style={[styles.typeToggleText, certType === 'C' && styles.typeToggleTextActive]}>C Certificates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeToggle, certType === 'A' && styles.typeToggleActive]}
            onPress={() => setCertType('A')}
            activeOpacity={0.85}
            testID="certificate-codes.toggle-a"
          >
            <Text style={[styles.typeToggleText, certType === 'A' && styles.typeToggleTextActive]}>A Certificates</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.crownMark}>CASINO ROYALE</Text>
          </View>
          <Text style={styles.sectionTitle}>This Month — {getMonthLabel('thisMonth')}</Text>
          <Text style={styles.sectionHint}>Tap any offer code to view every scraped sailing it's eligible for, or pull them all at once below.</Text>
          {renderDownloadAllButton('thisMonth')}
          {renderGrid('thisMonth')}
        </View>

        {nextMonthUnlocked ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.crownMark}>CASINO ROYALE</Text>
            </View>
            <Text style={styles.sectionTitle}>Next Month — {getMonthLabel('nextMonth')}</Text>
            <Text style={styles.sectionHint}>Codes just unlocked for the final stretch of this month — Royal Caribbean typically publishes these in the last week.</Text>
            {renderDownloadAllButton('nextMonth')}
            {renderGrid('nextMonth')}
          </View>
        ) : (
          <View style={styles.lockedCard} testID="certificate-codes.next-month-locked">
            <Lock size={18} color="#8A5D00" />
            <View style={styles.lockedTextColumn}>
              <Text style={styles.lockedTitle}>Next month unlocks soon</Text>
              <Text style={styles.lockedText}>
                {getMonthLabel('nextMonth')} offer codes usually publish in the final week of {getMonthLabel('thisMonth')} — check back in {daysLeft} day{daysLeft === 1 ? '' : 's'}.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Codes and point levels mirror Royal Caribbean's published Casino Royale ladder (VIP2 down to 10). Tap a code to pull its live sailing list.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4ECDD',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? SPACING.md : 0,
    paddingBottom: SPACING.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  typeToggle: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: SPACING.sm,
  },
  typeToggleActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FEF3C7',
  },
  typeToggleText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  typeToggleTextActive: {
    color: COLORS.navyDeep,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
    gap: SPACING.lg,
  },
  sectionCard: {
    backgroundColor: '#FBF3E7',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: '#EAD9B4',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  crownMark: {
    color: '#B8860B',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    letterSpacing: 2,
  },
  sectionTitle: {
    color: '#5C3A00',
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionHint: {
    color: '#7A5C1F',
    fontSize: TYPOGRAPHY.fontSizeXS,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'space-between',
  },
  downloadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0E7FA7',
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  downloadAllButtonDone: {
    backgroundColor: '#E5F5EC',
    borderWidth: 1,
    borderColor: '#B8E3C8',
  },
  downloadAllButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  downloadAllButtonTextDone: {
    color: '#0F6B3F',
  },
  codeButton: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#E3C88A',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  cachedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5F5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonCode: {
    color: '#5C3A00',
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    marginBottom: 4,
  },
  codeButtonPoints: {
    color: '#8A5D00',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textDecorationLine: 'underline',
  },
  lockedCard: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: '#FFF9ED',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#F4D9A7',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  lockedTextColumn: {
    flex: 1,
  },
  lockedTitle: {
    color: '#8A5A00',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginBottom: 2,
  },
  lockedText: {
    color: '#7A5C1F',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
  },
  footerNote: {
    paddingHorizontal: SPACING.sm,
  },
  footerNoteText: {
    color: '#8C7A5C',
    fontSize: TYPOGRAPHY.fontSizeXS,
    textAlign: 'center',
    lineHeight: 16,
  },
});
