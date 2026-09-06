import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  Columns3,
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
import { buildCertificateCatalog, buildCertificatePdfUrl, getMonthCodeForTarget, getMonthLabelForTarget } from '@/lib/certificates/certificateCatalog';
import { useCertificateMonthAvailability } from '@/hooks/useCertificateMonthAvailability';
import { PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY } from '@/lib/certificates/certificateDocumentStore';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
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
  guestCount: number | null;
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
  return getMonthCodeForTarget(target);
}

function getMonthLabel(target: MonthTarget): string {
  return getMonthLabelForTarget(target);
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
    return 'Royal returned an unexpected download response. Please try again from Certificate Codes.';
  }
  return raw.replace(/^JSON Parse error:\s*/i, '') || 'Certificate search failed.';
}


export default function CertificateLookupScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ query?: string; monthTarget?: string; certificateType?: string; certificateCode?: string }>();
  const initialQuery = String(routeParams.query ?? '').trim();
  const routedCertificateCode = String(routeParams.certificateCode ?? '').trim().toUpperCase();
  const routedMonthCode = routedCertificateCode.slice(0, 4);
  const monthAvailability = useCertificateMonthAvailability(10);
  const initialMonth: MonthTarget | null = routeParams.monthTarget === 'nextMonth' && monthAvailability.nextMonthAvailable
    ? 'nextMonth'
    : routeParams.monthTarget === 'thisMonth'
      ? 'thisMonth'
      : routedMonthCode === getMonthCode('nextMonth')
        ? 'nextMonth'
        : routedMonthCode === getMonthCode('thisMonth')
          ? 'thisMonth'
          : null;
  const initialFamily = String(routeParams.certificateType ?? 'ALL').toUpperCase();
  const { bookedCruises } = useCoreData();
  const { certificates: ownedCertificates, searchableCertificates, refreshCertificateDocuments } = useCertificates();

  useEffect(() => {
    const interaction = runAfterUiSettles(() => {
      void refreshCertificateDocuments();
    });
    return () => interaction.cancel();
  }, [refreshCertificateDocuments]);
  const casinoBenefits = useCasinoBenefits();
  const recordCertificateSearch = casinoBenefits?.recordCertificateSearch ?? (() => undefined);

  // View Certificates opens on the current certificate month immediately.
  // Downloading is still explicit; opening the screen never starts network work.
  const [activeMonth, setActiveMonth] = useState<MonthTarget | null>(initialMonth ?? 'thisMonth');
  const priorCurrentMonthRef = useRef(monthAvailability.currentMonthCode);
  useEffect(() => {
    if (priorCurrentMonthRef.current === monthAvailability.currentMonthCode) return;
    priorCurrentMonthRef.current = monthAvailability.currentMonthCode;
    setActiveMonth('thisMonth');
  }, [monthAvailability.currentMonthCode]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [shipQuery, setShipQuery] = useState(initialQuery);
  const [includeA, setIncludeA] = useState(initialFamily !== 'C');
  const [includeC, setIncludeC] = useState(initialFamily !== 'A');
  const [certificateCodeFilter, setCertificateCodeFilter] = useState(routedCertificateCode);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const includeD = false; // D-style codes are marketing offers, never certificate families.

  const [result, setResult] = useState<any>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchOperationRef = useRef(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState({ completed: 0, total: 0 });
  const localMatches = useMemo(() => buildLocalCertificateSailingIndex(searchableCertificates), [searchableCertificates]);
  const hasSearched = result !== null || searchError !== null || localMatches.length > 0 || activeMonth !== null;
  const locallyParsedSailingCount = useMemo(() => searchableCertificates.reduce((total, certificate) => total + (certificate.parsedSailings?.length ?? 0), 0), [searchableCertificates]);
  const displayedCertificateCatalog = useMemo(() => {
    const monthCode = getMonthCode(activeMonth ?? 'thisMonth');
    const byCode = new Map<string, any>();

    for (const certificate of searchableCertificates) {
      const code = String(certificate.certificateCode ?? '').toUpperCase();
      if (!code.startsWith(monthCode)) continue;
      const fallback = [...buildCertificateCatalog(monthCode, certificate.certificateFamily === 'C' ? 'C' : 'A')]
        .find((entry) => entry.certificateCode === code);
      byCode.set(code, {
        ...fallback,
        pdfUrl: certificate.sourceDocumentArchiveUri || certificate.sourcePdfUrl || fallback?.pdfUrl,
        documentArchiveUri: certificate.sourceDocumentArchiveUri,
        localStatus: String(certificate.parserStatus ?? '').startsWith('parsed')
          ? `${(certificate.parsedSailings?.length ?? 0).toLocaleString()} saved sailings`
          : 'Saved locally',
      });
    }

    for (const entry of Array.isArray(result?.catalog) ? result.catalog : []) {
      const code = String(entry?.certificateCode ?? '').toUpperCase();
      if (!code.startsWith(monthCode)) continue;
      byCode.set(code, {
        ...byCode.get(code),
        ...entry,
        localStatus: entry.status === 'parsed'
          ? `${Number(entry.parsedSailingReferences ?? entry.sailingsFound ?? 0).toLocaleString()} saved sailings`
          : String(entry.status ?? 'Downloaded').replace(/_/g, ' '),
      });
    }

    // Before the first download, show the known A/C ladder as a discovery aid.
    // Once any real document/catalog result exists, show only codes Royal
    // actually published or Easy Seas actually retained; otherwise nonexistent
    // fallback URLs misleadingly appear as "PDF unavailable."
    if (byCode.size === 0) {
      [...buildCertificateCatalog(monthCode, 'A'), ...buildCertificateCatalog(monthCode, 'C')]
        .forEach((entry) => byCode.set(entry.certificateCode, { ...entry, localStatus: 'Not downloaded' }));
    }

    return Array.from(byCode.values()).sort((left, right) => {
      if (left.certificateType !== right.certificateType) return String(left.certificateType).localeCompare(String(right.certificateType));
      return String(left.certificateCode).localeCompare(String(right.certificateCode));
    });
  }, [activeMonth, result, searchableCertificates]);

  useEffect(() => {
    if (!initialQuery) return;
    setSearchQuery(initialQuery);
    setShipQuery(initialQuery);
  }, [initialQuery]);

  const bookedLookup = useMemo(() => {
    const set = new Set<string>();
    bookedCruises.forEach((cruise) => {
      if (!cruise?.shipName || !cruise?.sailDate) return;
      const key = `${normalizeText(cruise.shipName)}__${normalizeText(cruise.sailDate).slice(0, 10)}`;
      set.add(key);
    });
    return set;
  }, [bookedCruises]);

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
    if (searchOperationRef.current) return;
    searchOperationRef.current = true;
    const monthCode = target ? getMonthCode(target) : getMonthCode('thisMonth');
    const effectiveShipQuery = (customShipQuery ?? shipQuery).trim() || 'Star, Legend, Icon, Wonder, Utopia, Symphony, Harmony, Allure, Oasis, Odyssey, Anthem, Ovation, Quantum, Spectrum, Navigator, Voyager, Mariner, Explorer, Adventure, Freedom, Liberty, Independence, Enchantment, Grandeur, Rhapsody, Vision, Radiance, Brilliance, Serenade, Jewel';

    setActiveMonth(target);

    try {
      setSearchBusy(true);
      setSearchError(null);
      setSearchProgress({ completed: 0, total: (includeA ? 13 : 0) + (includeC ? 13 : 0) });
      const completedCodes = searchableCertificates
        .filter((certificate) => {
          const code = String(certificate.certificateCode ?? '').trim().toUpperCase();
          const family = code.slice(4, 5);
          return code.startsWith(monthCode)
            && ((family === 'A' && includeA) || (family === 'C' && includeC))
            && String(certificate.parserStatus ?? '').startsWith('parsed')
            && (certificate.parsedSailings?.length ?? 0) > 0;
        })
        .map((certificate) => String(certificate.certificateCode).trim().toUpperCase());
      const nextResult = await downloadCertificateCatalogBatched({
        shipQuery: effectiveShipQuery,
        monthCode,
        includeA,
        includeC,
        includeD: false,
        onProgress: (completed, total) => setSearchProgress({ completed, total }),
        resetLog: true,
        documentStorageKey: PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY,
        skipCertificateCodes: completedCodes,
      });
      await refreshCertificateDocuments({ force: true });
      setResult(nextResult);
      const failedCodes = Array.isArray(nextResult?.summary?.failedCodes) ? nextResult.summary.failedCodes : [];
      const matches = Array.isArray(nextResult?.matches) ? nextResult.matches : [];
      if (failedCodes.length > 0 && matches.length === 0) {
        setSearchError(`${failedCodes.length} certificate download(s) could not be completed.`);
      }
    } catch (error) {
      const message = describeCertificateError(error);
      setSearchError(message);
      Alert.alert('Certificate search failed', message);
    } finally {
      searchOperationRef.current = false;
      setSearchBusy(false);
    }
  }, [includeA, includeC, refreshCertificateDocuments, searchableCertificates, shipQuery]);

  const handleThisMonth = useCallback(() => { void runSearch('thisMonth'); }, [runSearch]);
  const handleNextMonth = useCallback(() => {
    if (!monthAvailability.nextMonthAvailable) {
      Alert.alert('Next month is not published yet', `${monthAvailability.nextMonthLabel} A/C certificates become available ${monthAvailability.nextMonthOpensOnLabel}.`);
      return;
    }
    void runSearch('nextMonth');
  }, [monthAvailability, runSearch]);
  const handleCustomSearch = useCallback(() => {
    if (shipQuery.trim().length < 2) {
      Alert.alert('Ship required', 'Enter a ship name to search certificates.');
      return;
    }
    void runSearch(null, shipQuery);
  }, [runSearch, shipQuery]);

  const filteredMatches: SailingMatch[] = useMemo(() => {
    const matches = ((result?.matches?.length ? result.matches : localMatches) ?? []) as SailingMatch[];
    const normalizedQuery = normalizeText(searchQuery);
    const normalizedCode = certificateCodeFilter.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const monthCode = activeMonth ? getMonthCode(activeMonth) : '';
    return matches.flatMap((match) => {
      if (startDateFilter.trim() && match.sailDate.slice(0, 10) < startDateFilter.trim()) return [];
      if (endDateFilter.trim() && match.sailDate.slice(0, 10) > endDateFilter.trim()) return [];
      const levels = match.levels.filter((level) => {
        if (level.certificateType === 'A' && !includeA) return false;
        if (level.certificateType === 'C' && !includeC) return false;
        if (monthCode && !level.certificateCode.startsWith(monthCode)) return false;
        if (normalizedCode && !level.certificateCode.includes(normalizedCode)) return false;
        return true;
      });
      if (levels.length === 0) return [];
      if (normalizedQuery) {
        const searchable = normalizeText([
          match.shipName,
          match.sailDate,
          ...levels.flatMap((level) => [level.certificateCode, level.itinerary, level.cabinLabel, level.offerTypeLabel]),
        ].join(' '));
        if (!searchable.includes(normalizedQuery)) return [];
      }
      return [{ ...match, levels }];
    });
  }, [activeMonth, certificateCodeFilter, endDateFilter, includeA, includeC, localMatches, result, searchQuery, startDateFilter]);

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

  const handleOpenPdf = useCallback((url: string, fallbackUrl?: string) => {
    void openCertificatePdf(url, fallbackUrl);
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
                <Text style={styles.bookedBadgeText}>You’re booked</Text>
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
          <View key={`${level.certificateCode}-${level.pdfUrl}-${level.cabinLabel ?? 'cabin'}-${level.guestCount ?? 'guests'}`} style={styles.levelRow}>
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
                <View style={styles.benefitChip}>
                  <Text style={styles.benefitChipText}>{level.guestCount ? `${level.guestCount} Guest${level.guestCount === 1 ? '' : 's'}` : 'Guests not stated'}</Text>
                </View>
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
      <LinearGradient colors={['#E8F3F7', '#FBF8F2', '#F2EEE6']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="certificate-lookup.back-button">
            <ChevronLeft size={20} color="#1C2F7A" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.portfolioButton} onPress={() => router.push('/certificate-portfolio')} testID="certificate-lookup.portfolio-matrix">
              <Columns3 size={14} color="#1C2F7A" />
              <Text style={styles.portfolioButtonText}>Portfolio Matrix</Text>
            </TouchableOpacity>
            <View style={styles.headerIconWrap}>
              <Sparkles size={16} color="#0E7FA7" />
            </View>
          </View>
        </View>
        <Text style={styles.headerEyebrow}>Certificate intelligence</Text>
        <Text style={styles.headerTitle}>Certificate Lookup</Text>
        <Text style={styles.headerSubtitle}>
          Browse locally saved certificate sailings by ship, date, and certificate code. Download buttons refresh the inventory directly from Royal.
        </Text>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, activeMonth === 'thisMonth' && styles.quickButtonActive]}
            onPress={handleThisMonth}
            disabled={isSearching}
            activeOpacity={0.85}
            testID="certificate-lookup.this-month"
          >
            <CalendarClock size={15} color={COLORS.navyDeep} />
            <Text style={[styles.quickButtonText, activeMonth === 'thisMonth' && styles.quickButtonTextActive]}>
              Download All{'\n'}{getMonthLabel('thisMonth')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, activeMonth === 'nextMonth' && styles.quickButtonActive, !monthAvailability.nextMonthAvailable && { opacity: 0.48 }]}
            onPress={handleNextMonth}
            disabled={isSearching || !monthAvailability.nextMonthAvailable}
            accessibilityState={{ disabled: isSearching || !monthAvailability.nextMonthAvailable }}
            activeOpacity={0.85}
            testID="certificate-lookup.next-month"
          >
            <CalendarClock size={15} color={COLORS.navyDeep} />
            <Text style={[styles.quickButtonText, activeMonth === 'nextMonth' && styles.quickButtonTextActive]}>
              {monthAvailability.nextMonthAvailable ? 'Next month' : `Available ${monthAvailability.nextMonthOpensOnLabel}`}{'\n'}{monthAvailability.nextMonthLabel}
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
                placeholder="Filter by ship, sailing date, code, cabin…"
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

            {locallyParsedSailingCount > 0 ? (
              <View style={styles.localInventoryBanner} testID="certificate-lookup.local-inventory">
                <Text style={styles.localInventoryTitle}>Saved certificate sailing inventory</Text>
                <Text style={styles.localInventoryText}>
                  {locallyParsedSailingCount.toLocaleString()} parsed sailing reference{locallyParsedSailingCount === 1 ? '' : 's'} are available locally. These remain separate from Available Cruises.
                </Text>
              </View>
            ) : null}

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
                <TextInput
                  value={certificateCodeFilter}
                  onChangeText={(value) => setCertificateCodeFilter(value.toUpperCase())}
                  placeholder="Certificate code (optional)"
                  placeholderTextColor={CLEAN_THEME.text.muted}
                  style={styles.advancedInput}
                  autoCapitalize="characters"
                  testID="certificate-lookup.code-filter"
                />
                <View style={styles.dateFilterRow}>
                  <TextInput
                    value={startDateFilter}
                    onChangeText={setStartDateFilter}
                    placeholder="From YYYY-MM-DD"
                    placeholderTextColor={CLEAN_THEME.text.muted}
                    style={[styles.advancedInput, styles.dateFilterInput]}
                    keyboardType="numbers-and-punctuation"
                    testID="certificate-lookup.start-date-filter"
                  />
                  <TextInput
                    value={endDateFilter}
                    onChangeText={setEndDateFilter}
                    placeholder="To YYYY-MM-DD"
                    placeholderTextColor={CLEAN_THEME.text.muted}
                    style={[styles.advancedInput, styles.dateFilterInput]}
                    keyboardType="numbers-and-punctuation"
                    testID="certificate-lookup.end-date-filter"
                  />
                </View>
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

            {(result || localMatches.length > 0 || displayedCertificateCatalog.length > 0) ? (
              <>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryChip}>
                    <Text style={styles.summaryChipLabel}>Matched sailings</Text>
                    <Text style={styles.summaryChipValue}>{filteredMatches.length.toLocaleString()}</Text>
                  </View>
                  <View style={styles.summaryChip}>
                    <Text style={styles.summaryChipLabel}>Local references</Text>
                    <Text style={styles.summaryChipValue}>{locallyParsedSailingCount.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={styles.downloadedCertificates} testID="certificate-lookup.downloaded-certificates">
                  <Text style={styles.downloadedCertificatesTitle}>{getMonthLabel(activeMonth ?? 'thisMonth')} certificate PDFs</Text>
                  <Text style={styles.downloadedCertificatesHelp}>This is the full A/C certificate catalog for the selected month. Download All archives every discovered PDF and every parsed sailing locally; tap a code to open its official PDF.</Text>
                  <View style={styles.certificateCodeGrid}>
                    {displayedCertificateCatalog.map((entry: any) => (
                      <TouchableOpacity
                        key={entry.certificateCode}
                        style={styles.certificateCodeButton}
                        onPress={() => handleOpenPdf(
                          entry.documentArchiveUri || entry.pdfUrl || buildCertificatePdfUrl(entry.certificateCode),
                          buildCertificatePdfUrl(entry.certificateCode),
                        )}
                        testID={`certificate-lookup.open-catalog-${entry.certificateCode}`}
                      >
                        <ExternalLink size={12} color={COLORS.navyDeep} />
                        <View style={styles.certificateCodeButtonLabels}>
                          <Text style={styles.certificateCodeButtonText}>{entry.certificateCode}</Text>
                          <Text style={styles.certificateCodeStatusText}>{entry.localStatus}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
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
                Tap “This Month” or “Next Month” above to pull the official certificate documents directly from Royal Caribbean — no login required.
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
    backgroundColor: '#F3F3F2',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  portfolioButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    paddingHorizontal: SPACING.sm,
  },
  portfolioButtonText: {
    color: '#1C2F7A',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#E8F7FB',
    borderWidth: 1,
    borderColor: '#B8DDE8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: '#0E7FA7',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#1C2F7A',
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    color: '#66737F',
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
    backgroundColor: '#FFFCF7',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#B9C9C8',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 54,
  },
  quickButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FEF3C7',
  },
  quickButtonText: {
    color: COLORS.navyDeep,
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
  downloadedCertificates: {
    backgroundColor: '#FFFCF7',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  downloadedCertificatesTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  downloadedCertificatesHelp: {
    color: CLEAN_THEME.text.muted,
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
  },
  certificateCodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  certificateCodeButton: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F5F5F4',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  certificateCodeButtonLabels: {
    flex: 1,
    minWidth: 0,
  },
  certificateCodeButtonText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  certificateCodeStatusText: {
    color: CLEAN_THEME.text.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textTransform: 'capitalize',
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
  localInventoryBanner: {
    backgroundColor: '#ECFDF3',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#A6F4C5',
    padding: SPACING.md,
  },
  localInventoryTitle: { color: '#05603A', fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold },
  localInventoryText: { color: '#067647', fontSize: TYPOGRAPHY.fontSizeXS, lineHeight: 17, marginTop: 3 },
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
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
  },
  dateFilterRow: { flexDirection: 'row', gap: SPACING.sm },
  dateFilterInput: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleChip: {
    flex: 1,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#333334',
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  toggleChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  toggleChipText: {
    color: '#333334',
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
    color: '#16755F',
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
