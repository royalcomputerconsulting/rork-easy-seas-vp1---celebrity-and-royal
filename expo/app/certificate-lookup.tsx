import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ExternalLink,
  Search,
  Ship as ShipIcon,
  Sparkles,
  X,
} from 'lucide-react-native';

import { CertificateDownloadLogPanel } from '@/components/certificates/CertificateDownloadLogPanel';
import { BORDER_RADIUS, CLEAN_THEME, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { formatDate, getDaysUntil } from '@/lib/date';
import { openCertificatePdf } from '@/lib/royalCaribbean/certificatePdf';
import { downloadCertificateCatalogBatched } from '@/lib/certificates/certificateBatchDownload';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCasinoBenefits } from '@/state/CasinoBenefitsProvider';

type MonthTarget = 'thisMonth' | 'nextMonth';

interface SailingMatchLevel {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  cabinLabel: string | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  benefitSummary: string[];
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface SailingMatch {
  shipName: string;
  sailDate: string;
  levels: SailingMatchLevel[];
  decisionGuide: string[];
}

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

function normalizeText(value?: string | null): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatCurrency(value: number | null): string {
  if (value == null) return 'Unavailable';
  return `$${value.toLocaleString()}`;
}

function describeCertificateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  if (/Unexpected end of input/i.test(raw)) {
    return 'The certificate download response ended before it finished. Please try again, or open Certificate Codes and use Download All.';
  }
  if (/Unexpected character:\s*N/i.test(raw)) {
    return 'The backend returned a non-JSON response, usually a temporary Royal/Render download issue. Please try again from Certificate Codes.';
  }
  return raw.replace(/^JSON Parse error:\s*/i, '') || 'Certificate search failed.';
}


export default function CertificateLookupScreen() {
  const router = useRouter();
  const { bookedCruises, cruises } = useCoreData();
  const { certificates: ownedCertificates } = useCertificates();
  const { recordCertificateSearch } = useCasinoBenefits();

  const [activeMonth, setActiveMonth] = useState<MonthTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [shipQuery, setShipQuery] = useState('');
  const [includeA, setIncludeA] = useState(true);
  const [includeC, setIncludeC] = useState(true);

  const [result, setResult] = useState<any>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState({ completed: 0, total: 0 });
  const hasSearched = result !== null || searchError !== null;

  const bookedLookup = useMemo(() => {
    const set = new Set<string>();
    [...bookedCruises, ...cruises].forEach((cruise) => {
      if (!cruise?.shipName || !cruise?.sailDate) return;
      const key = `${normalizeText(cruise.shipName)}__${normalizeText(cruise.sailDate).slice(0, 10)}`;
      set.add(key);
    });
    return set;
  }, [bookedCruises, cruises]);

  const isBooked = useCallback((shipName: string, sailDate: string) => {
    const normalizedShip = normalizeText(shipName);
    for (const key of bookedLookup) {
      const [ship] = key.split('__');
      if (ship === normalizedShip && key.includes(sailDate.slice(0, 10))) return true;
    }
    return bookedLookup.has(`${normalizedShip}__${sailDate}`);
  }, [bookedLookup]);

  const expiringOwnedCertificates = useMemo(() => {
    return ownedCertificates
      .filter((cert) => cert.status !== 'used' && cert.expiryDate)
      .map((cert) => ({ cert, daysLeft: getDaysUntil(cert.expiryDate as string) }))
      .filter((entry) => entry.daysLeft >= 0 && entry.daysLeft <= 45)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [ownedCertificates]);

  const runSearch = useCallback(async (target: MonthTarget | null, customShipQuery?: string) => {
    const monthCode = target ? getMonthCode(target) : getMonthCode('thisMonth');
    const effectiveShipQuery = (customShipQuery ?? shipQuery).trim() || 'Star, Legend, Icon, Wonder, Utopia, Symphony, Harmony, Allure, Oasis, Odyssey, Anthem, Ovation, Quantum, Spectrum, Navigator, Voyager, Mariner, Explorer, Adventure, Freedom, Liberty, Independence, Enchantment, Grandeur, Rhapsody, Vision, Radiance, Brilliance, Serenade, Jewel';

    setActiveMonth(target);

    try {
      setSearchBusy(true);
      setSearchError(null);
      setSearchProgress({ completed: 0, total: (includeA ? 13 : 0) + (includeC ? 13 : 0) });
      const nextResult = await downloadCertificateCatalogBatched({
        shipQuery: effectiveShipQuery,
        monthCode,
        includeA,
        includeC,
        onProgress: (completed, total) => setSearchProgress({ completed, total }),
        resetLog: true,
      });
      setResult(nextResult);
      if (nextResult.summary.failedCodes.length > 0 && nextResult.matches.length === 0) {
        setSearchError(`${nextResult.summary.failedCodes.length} certificate download(s) could not be completed.`);
      }
    } catch (error) {
      const message = describeCertificateError(error);
      setSearchError(message);
      Alert.alert('Certificate search failed', message);
    } finally {
      setSearchBusy(false);
    }
  }, [includeA, includeC, shipQuery]);

  const handleThisMonth = useCallback(() => { void runSearch('thisMonth'); }, [runSearch]);
  const handleNextMonth = useCallback(() => { void runSearch('nextMonth'); }, [runSearch]);
  const handleCustomSearch = useCallback(() => {
    if (shipQuery.trim().length < 2) {
      Alert.alert('Ship required', 'Enter a ship name to search certificates.');
      return;
    }
    void runSearch(null, shipQuery);
  }, [runSearch, shipQuery]);

  const filteredMatches: SailingMatch[] = useMemo(() => {
    const matches = (result?.matches ?? []) as SailingMatch[];
    if (!searchQuery.trim()) return matches;
    const normalizedQuery = normalizeText(searchQuery);
    return matches.filter((match) => normalizeText(match.shipName).includes(normalizedQuery));
  }, [result, searchQuery]);

  useEffect(() => {
    if (!result || !activeMonth) return;
    const allMatches = (result.matches ?? []) as SailingMatch[];
    const matchedBookedCount = allMatches.filter((match) => isBooked(match.shipName, match.sailDate)).length;
    recordCertificateSearch({
      date: new Date().toISOString(),
      month: activeMonth,
      monthLabel: getMonthLabel(activeMonth),
      certsFound: result.summary?.matchedCertificateCount ?? allMatches.length,
      matchedCount: matchedBookedCount,
      unmatchedCount: Math.max(0, allMatches.length - matchedBookedCount),
      expiringSoonCount: expiringOwnedCertificates.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, activeMonth]);

  const handleOpenPdf = useCallback((url: string) => {
    void openCertificatePdf(url);
  }, []);

  const renderMatch = useCallback(({ item }: { item: SailingMatch }) => {
    const booked = isBooked(item.shipName, item.sailDate);
    const daysUntilSail = getDaysUntil(item.sailDate);
    const sailingSoon = daysUntilSail >= 0 && daysUntilSail <= 45;

    return (
      <View style={styles.resultCard} testID={`certificate-lookup.result-${item.shipName}-${item.sailDate}`}>
        <View style={styles.resultHeader}>
          <View style={styles.resultHeaderText}>
            <View style={styles.resultShipRow}>
              <ShipIcon size={14} color={COLORS.navyDeep} />
              <Text style={styles.resultShip}>{item.shipName}</Text>
            </View>
            <Text style={styles.resultDate}>{formatDate(item.sailDate, 'medium')}</Text>
          </View>
          <View style={styles.badgeColumn}>
            {booked ? (
              <View style={styles.bookedBadge}>
                <Text style={styles.bookedBadgeText}>You're booked</Text>
              </View>
            ) : null}
            {sailingSoon ? (
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>{daysUntilSail}d out</Text>
              </View>
            ) : null}
          </View>
        </View>

        {item.decisionGuide.length > 0 ? (
          <View style={styles.insightCard}>
            {item.decisionGuide.map((step, index) => (
              <Text key={`${item.shipName}-${item.sailDate}-guide-${index}`} style={styles.insightText}>• {step}</Text>
            ))}
          </View>
        ) : null}

        {item.levels.map((level) => (
          <View key={`${level.certificateCode}-${level.pdfUrl}`} style={styles.levelRow}>
            <View style={styles.levelTopRow}>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText}>{level.certificateCode}</Text>
              </View>
              <Text style={styles.levelPoints}>{level.points != null ? `${level.points.toLocaleString()} pts` : 'points unknown'}</Text>
            </View>
            {level.itinerary ? <Text style={styles.levelDetail}>{level.itinerary}</Text> : null}
            {level.benefitSummary.length > 0 ? (
              <View style={styles.benefitRow}>
                {level.cabinLabel ? (
                  <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{level.cabinLabel}</Text></View>
                ) : null}
                {level.freePlay != null ? (
                  <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{formatCurrency(level.freePlay)} FP</Text></View>
                ) : null}
                {level.onBoardCredit != null ? (
                  <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{formatCurrency(level.onBoardCredit)} OBC</Text></View>
                ) : null}
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.pdfButton}
              onPress={() => handleOpenPdf(level.pdfUrl)}
              activeOpacity={0.8}
              testID={`certificate-lookup.open-pdf-${level.certificateCode}`}
            >
              <ExternalLink size={13} color="#FFFFFF" />
              <Text style={styles.pdfButtonText}>View official PDF</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }, [handleOpenPdf, isBooked]);

  const isSearching = searchBusy;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#10223A', '#183C63', '#0E7FA7']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-lookup.back-button">
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerIconWrap}>
            <Sparkles size={16} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.headerEyebrow}>Certificate intelligence</Text>
        <Text style={styles.headerTitle}>Certificate Lookup</Text>
        <Text style={styles.headerSubtitle}>
          Pull the official public certificate documents for this month or next month, search by ship, and see which sailings you already have booked.
        </Text>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, activeMonth === 'thisMonth' && styles.quickButtonActive]}
            onPress={handleThisMonth}
            disabled={isSearching}
            activeOpacity={0.85}
            testID="certificate-lookup.this-month"
          >
            <CalendarClock size={15} color={activeMonth === 'thisMonth' ? COLORS.navyDeep : '#FFFFFF'} />
            <Text style={[styles.quickButtonText, activeMonth === 'thisMonth' && styles.quickButtonTextActive]}>
              This Month{'\n'}{getMonthLabel('thisMonth')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, activeMonth === 'nextMonth' && styles.quickButtonActive]}
            onPress={handleNextMonth}
            disabled={isSearching}
            activeOpacity={0.85}
            testID="certificate-lookup.next-month"
          >
            <CalendarClock size={15} color={activeMonth === 'nextMonth' ? COLORS.navyDeep : '#FFFFFF'} />
            <Text style={[styles.quickButtonText, activeMonth === 'nextMonth' && styles.quickButtonTextActive]}>
              Next Month{'\n'}{getMonthLabel('nextMonth')}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => `${item.shipName}-${item.sailDate}`}
        renderItem={renderMatch}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {expiringOwnedCertificates.length > 0 ? (
              <View style={styles.expiringBanner} testID="certificate-lookup.expiring-banner">
                <View style={styles.expiringBannerHeader}>
                  <AlertTriangle size={16} color="#92400E" />
                  <Text style={styles.expiringBannerTitle}>
                    {expiringOwnedCertificates.length} of your certificate{expiringOwnedCertificates.length === 1 ? '' : 's'} expiring soon
                  </Text>
                </View>
                {expiringOwnedCertificates.slice(0, 4).map(({ cert, daysLeft }) => (
                  <Text key={cert.id} style={styles.expiringBannerLine}>
                    • {cert.description || cert.type} — {daysLeft === 0 ? 'expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.searchBar}>
              <Search size={16} color={CLEAN_THEME.text.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Filter results by ship name"
                placeholderTextColor={CLEAN_THEME.text.muted}
                style={styles.searchInput}
                testID="certificate-lookup.filter-input"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} testID="certificate-lookup.clear-filter">
                  <X size={15} color={CLEAN_THEME.text.muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setAdvancedOpen((v) => !v)}
              activeOpacity={0.8}
              testID="certificate-lookup.advanced-toggle"
            >
              <Text style={styles.advancedToggleText}>{advancedOpen ? 'Hide custom search' : 'Search a specific ship or month'}</Text>
            </TouchableOpacity>

            {advancedOpen ? (
              <View style={styles.advancedPanel}>
                <TextInput
                  value={shipQuery}
                  onChangeText={setShipQuery}
                  placeholder="e.g. Icon, Wonder, Utopia"
                  placeholderTextColor={CLEAN_THEME.text.muted}
                  style={styles.advancedInput}
                  autoCapitalize="words"
                  testID="certificate-lookup.ship-input"
                />
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleChip, includeA && styles.toggleChipActive]}
                    onPress={() => setIncludeA((v) => !v)}
                    testID="certificate-lookup.toggle-a"
                  >
                    <Text style={[styles.toggleChipText, includeA && styles.toggleChipTextActive]}>A Certificates</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleChip, includeC && styles.toggleChipActive]}
                    onPress={() => setIncludeC((v) => !v)}
                    testID="certificate-lookup.toggle-c"
                  >
                    <Text style={[styles.toggleChipText, includeC && styles.toggleChipTextActive]}>C Certificates</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.customSearchButton}
                  onPress={handleCustomSearch}
                  disabled={isSearching}
                  activeOpacity={0.85}
                  testID="certificate-lookup.custom-search-button"
                >
                  {isSearching ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Search size={15} color="#FFFFFF" />}
                  <Text style={styles.customSearchButtonText}>{isSearching ? 'Searching…' : 'Search this ship'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <CertificateDownloadLogPanel />

            {isSearching ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.navyDeep} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadingText}>Pulling official certificate documents…</Text>
                  <Text style={styles.loadingSubtext}>{searchProgress.completed}/{searchProgress.total || ((includeA ? 13 : 0) + (includeC ? 13 : 0))} certificate codes checked</Text>
                </View>
              </View>
            ) : null}

            {searchError && !isSearching ? (
              <View style={styles.partialWarning}>
                <Text style={styles.partialWarningTitle}>Some certificate downloads did not finish</Text>
                <Text style={styles.partialWarningText}>{searchError} Results that did download are shown below.</Text>
              </View>
            ) : null}

            {result ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipLabel}>Matched sailings</Text>
                  <Text style={styles.summaryChipValue}>{result.summary.matchedSailingCount}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipLabel}>Certificate levels</Text>
                  <Text style={styles.summaryChipValue}>{result.summary.matchedCertificateCount}</Text>
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          hasSearched && !isSearching ? (
            <View style={styles.emptyState} testID="certificate-lookup.empty-state">
              <Text style={styles.emptyStateTitle}>No matching certificate sailings found</Text>
              <Text style={styles.emptyStateText}>
                Try a different ship, clear the filter above, or switch to the other quick month button.
              </Text>
            </View>
          ) : !hasSearched ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Pick a month to get started</Text>
              <Text style={styles.emptyStateText}>
                Tap "This Month" or "Next Month" above to pull the official certificate documents directly from Royal Caribbean — no login required.
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CLEAN_THEME.background.secondary,
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
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 54,
  },
  quickButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FEF3C7',
  },
  quickButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    lineHeight: 15,
  },
  quickButtonTextActive: {
    color: COLORS.navyDeep,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
    gap: SPACING.md,
  },
  listHeader: {
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  expiringBanner: {
    backgroundColor: '#FFF9ED',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#F4D9A7',
    padding: SPACING.md,
    gap: 4,
  },
  expiringBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  expiringBannerTitle: {
    color: '#8A5A00',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  expiringBannerLine: {
    color: '#7A5C1F',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    paddingVertical: 4,
  },
  advancedToggle: {
    alignSelf: 'flex-start',
  },
  advancedToggleText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textDecorationLine: 'underline',
  },
  advancedPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  advancedInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleChip: {
    flex: 1,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.medium,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.primary,
  },
  toggleChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  toggleChipText: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  toggleChipTextActive: {
    color: '#FFFFFF',
  },
  customSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  customSearchButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  loadingSubtext: { fontSize: 11, color: CLEAN_THEME.text.muted, marginTop: 2 },
  partialWarning: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
  partialWarningTitle: { color: '#9A3412', fontWeight: '800', fontSize: 13 },
  partialWarningText: { color: '#7C2D12', fontSize: 12, lineHeight: 17, marginTop: 3 },
  loadingText: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: '#EAF1F9',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D6E3F2',
  },
  summaryChipLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginBottom: 2,
  },
  summaryChipValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.md,
    marginBottom: SPACING.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  resultShip: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  resultDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  bookedBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  bookedBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  soonBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  soonBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  insightCard: {
    backgroundColor: '#F6FAFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D8E7F6',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  insightText: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  levelRow: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E7EEF8',
    backgroundColor: '#F8FBFF',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 6,
  },
  levelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D9E5F3',
  },
  levelPillText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  levelPoints: {
    color: '#0E7FA7',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  levelDetail: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    lineHeight: 19,
  },
  benefitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  benefitChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D9E5F3',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  benefitChipText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: SPACING.xs,
    marginTop: 4,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  emptyStateTitle: {
    color: CLEAN_THEME.text.primary,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    color: CLEAN_THEME.text.secondary,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    textAlign: 'center',
  },
});
