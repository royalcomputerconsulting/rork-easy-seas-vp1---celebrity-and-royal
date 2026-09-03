import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, BarChart3, Bell, Brain, Calculator, CheckSquare, Coins, ContactRound, Database, Dices, FileCheck2, FileText, FileUp, Gauge, LineChart, PieChart, Plus, Settings, ShieldCheck, Ship, Target, Ticket, Timer, TrendingUp, Trophy, WalletCards, Zap } from 'lucide-react-native';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { buildCasinoCruiseTruth, isGeneratedCasinoSession, reconcileCasinoSeason, type CasinoCruiseTruth } from '@/lib/casino/casinoTruthEngine';
import { getCasinoProgramSeason, inferCasinoProgram, isDateInCasinoSeason } from '@/lib/casino/casinoProgramSeasons';
import { useCasinoSettings } from '@/state/CasinoSettingsProvider';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { buildCasinoDashboardMetrics } from '@/lib/casino/casinoDashboardMetrics';
import { CLUB_ROYALE_TIERS, getTierByPoints, getTierProgress } from '@/constants/clubRoyaleTiers';
import { buildCasinoRecoveryStatusSummary, OPERATOR_SOURCE_REQUIRED } from '@/lib/casino/casinoRecoveryRequirements';
import { useUser } from '@/state/UserProvider';
import { filterRecordsForProfile } from '@/lib/profileIsolation';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { getCelebrityBlueChipProgress, getCelebrityBlueChipStatus } from '@/constants/celebrityBlueChipClub';
import { AccessibleProgress } from '@/components/ui/PurposefulMotion';
import { useExperience } from '@/state/ExperienceProvider';
import { ProgressiveDisclosure } from '@/components/ui/ProgressiveDisclosure';
import { PremiumVoyageArtwork } from '@/components/ui/PremiumVoyageArtwork';
import { EntityProvenanceDisclosure } from '@/components/ui/EntityProvenanceDisclosure';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { TYPOGRAPHY } from '@/constants/theme';
import { CruiseCard } from '@/components/CruiseCard';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { getPhysicalBookedVoyageKey } from '@/lib/bookedVoyageRelationships';
import { formatCount } from '@/lib/format';

type CasinoTab = 'intelligence' | 'charts' | 'session' | 'calcs';
type SessionPeriod = 'today' | 'week' | 'month' | 'all';

const TABS: Array<{ id: CasinoTab; label: string }> = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'charts', label: 'Charts' },
  { id: 'session', label: 'Play' },
  { id: 'calcs', label: 'Calcs' },
];

const finiteDisplay = (value: unknown): number | null => Number.isFinite(Number(value)) ? Number(value) : null;
const money = (value: number | null | undefined) => { const safe = finiteDisplay(value); return safe == null ? '—' : `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`; };
const exactMoney = (value: number | null | undefined) => { const safe = finiteDisplay(value); return safe == null ? '—' : `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
const number = (value: number | null | undefined) => { const safe = finiteDisplay(value); return safe == null ? '—' : safe.toLocaleString(undefined, { maximumFractionDigits: 1 }); };
const sourceLabel = (kind: string) => {
  if (kind === 'session_actual') return 'SESSION ACTUAL';
  if (kind === 'receipt_actual') return 'RECEIPT ACTUAL';
  if (kind === 'user_entered') return 'USER ENTERED';
  if (kind === 'provider_reported') return 'PROVIDER REPORTED';
  if (kind === 'derived') return 'DERIVED';
  if (kind === 'estimated') return 'ESTIMATED';
  if (kind === 'missing') return 'UNAVAILABLE';
  return kind.replace('_', ' ').toUpperCase();
};
const percent = (value: number | null, digits = 0) => value == null ? '—' : `${value.toFixed(digits)}%`;
const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const casinoTierAccent = (program: 'club_royale' | 'blue_chip', tier: string): string => {
  const normalized = String(tier || '').toLowerCase();
  if (program === 'blue_chip') {
    if (normalized.includes('ruby')) return '#D83A4A';
    if (normalized.includes('sapphire plus')) return '#5067D8';
    if (normalized.includes('sapphire')) return '#2F8EEB';
    if (normalized.includes('amethyst')) return '#8C3FC8';
    if (normalized.includes('onyx')) return '#4A4A4A';
    return '#E7E7E4';
  }
  if (normalized.includes('masters')) return '#22201E';
  if (normalized.includes('signature')) return '#2C1D9A';
  if (normalized.includes('prime')) return '#8A1FD1';
  return '#D87924';
};

const CASINO_TRUTH_BATCH_SIZE = 125;

type CertificateOptionSummary = {
  optionCount: number;
  valueRange: { minimum: number; maximum: number; median: number } | null;
  topCabins: string[];
  codes: string[];
};

const finiteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();

function estimateCertificateSailingValue(level: Record<string, unknown>): number {
  const explicit = finiteNumber(level.totalValue ?? level.estimatedValue ?? level.value ?? level.cabinValue ?? level.retailCabinPrice);
  const freePlay = finiteNumber(level.freePlay ?? level.freeplay ?? level.freePlayAmount) ?? 0;
  const onBoardCredit = finiteNumber(level.onBoardCredit ?? level.obc ?? level.onboardCredit) ?? 0;
  return Math.max(0, explicit ?? 0) + Math.max(0, freePlay) + Math.max(0, onBoardCredit);
}

function summarizeCertificateOptionsForTrip(trip: CasinoCruiseTruth, certificates: unknown[]): CertificateOptionSummary {
  const wantedCodes = new Set(trip.certificateCodes.map(normalizeCode).filter(Boolean));
  if (wantedCodes.size === 0) {
    return { optionCount: 0, valueRange: null, topCabins: [], codes: [] };
  }

  const optionKeys = new Set<string>();
  const cabinCounts = new Map<string, number>();
  const optionValues: number[] = [];
  const matchedCodes = new Set<string>();

  for (const rawCertificate of certificates) {
    if (!rawCertificate || typeof rawCertificate !== 'object') continue;
    const certificate = rawCertificate as Record<string, unknown>;
    const certificateCode = normalizeCode(certificate.certificateCode ?? certificate.label);
    if (!certificateCode || !wantedCodes.has(certificateCode)) continue;
    matchedCodes.add(certificateCode);

    const parsedSailings = Array.isArray(certificate.parsedSailings) ? certificate.parsedSailings : [];
    for (const rawSailing of parsedSailings) {
      if (!rawSailing || typeof rawSailing !== 'object') continue;
      const sailing = rawSailing as Record<string, unknown>;
      const levels = Array.isArray(sailing.levels) && sailing.levels.length > 0 ? sailing.levels : [sailing];
      for (const rawLevel of levels) {
        if (!rawLevel || typeof rawLevel !== 'object') continue;
        const level = rawLevel as Record<string, unknown>;
        const shipName = String(sailing.shipName ?? level.shipName ?? '').trim();
        const sailDate = String(sailing.sailDate ?? sailing.sailingDate ?? level.sailDate ?? level.sailingDate ?? '').trim();
        const cabinLabel = String(level.cabinLabel ?? level.roomType ?? level.category ?? level.stateroomCategory ?? '').trim();
        const optionKey = [certificateCode, shipName, sailDate, cabinLabel || 'cabin'].join('|').toLowerCase();
        if (optionKeys.has(optionKey)) continue;
        optionKeys.add(optionKey);
        if (cabinLabel) cabinCounts.set(cabinLabel, (cabinCounts.get(cabinLabel) ?? 0) + 1);
        const value = estimateCertificateSailingValue(level);
        if (value > 0) {
          optionValues.push(value);
        }
      }
    }
  }

  return {
    optionCount: optionKeys.size,
    valueRange: optionValues.length > 0 ? (() => {
      const sorted = [...optionValues].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return {
        minimum: sorted[0],
        maximum: sorted[sorted.length - 1],
        median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
      };
    })() : null,
    topCabins: Array.from(cabinCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => `${label} ×${count}`),
    codes: Array.from(matchedCodes),
  };
}

function useDeferredCasinoTruths(input: {
  bookedCruises: ReturnType<typeof useCasinoEconomicsData>['bookedCruises'];
  sessions: ReturnType<typeof useCasinoSessions>['sessions'];
  certificates: ReturnType<typeof useCertificates>['searchableCertificates'];
  pointsPerHourFallback: number;
  houseEdgeFallback: number;
}): { truths: CasinoCruiseTruth[]; loading: boolean; skipped: number } {
  const [truths, setTruths] = useState<CasinoCruiseTruth[]>([]);
  const [loading, setLoading] = useState(false);
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const validCruises = input.bookedCruises.filter((cruise) =>
      Boolean(cruise && typeof cruise.id === 'string' && cruise.id.trim() && typeof cruise.sailDate === 'string' && cruise.sailDate.trim()),
    );
    const sessionsByCruise = new Map<string, typeof input.sessions>();
    for (const session of input.sessions) {
      if (!session?.cruiseId) continue;
      const rows = sessionsByCruise.get(session.cruiseId);
      if (rows) rows.push(session);
      else sessionsByCruise.set(session.cruiseId, [session]);
    }

    setTruths([]);
    setSkipped(input.bookedCruises.length - validCruises.length);
    setLoading(validCruises.length > 0);
    let cursor = 0;
    const collected: CasinoCruiseTruth[] = [];

    const processBatch = () => {
      if (cancelled) return;
      const end = Math.min(cursor + CASINO_TRUTH_BATCH_SIZE, validCruises.length);
      for (; cursor < end; cursor += 1) {
        const cruise = validCruises[cursor];
        try {
          collected.push(buildCasinoCruiseTruth({
            cruise,
            sessions: sessionsByCruise.get(cruise.id) ?? [],
            certificates: input.certificates,
            pointsPerHourFallback: input.pointsPerHourFallback,
            houseEdgeFallback: input.houseEdgeFallback,
          }));
        } catch (error) {
          console.warn('[CasinoCommandCenter] Skipped malformed cruise row:', cruise.id, error);
          setSkipped((value) => value + 1);
        }
      }
      if (cancelled) return;
      if (cursor < validCruises.length) {
        // Yield between batches so the tab bar and back navigation remain live.
        timer = setTimeout(processBatch, 0);
        return;
      }
      collected.sort((a, b) => String(b.sailDate).localeCompare(String(a.sailDate)));
      setTruths(collected);
      setLoading(false);
    };

    timer = setTimeout(processBatch, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [input.bookedCruises, input.certificates, input.houseEdgeFallback, input.pointsPerHourFallback, input.sessions]);

  return { truths, loading, skipped };
}

function standardEvidenceLabel(value: string): string {
  const normalized = String(value || 'missing').trim().toLowerCase().replace(/[ _-]+/g, ' ');
  if (normalized.includes('provider') || normalized === 'api') return 'PROVIDER REPORTED';
  if (normalized.includes('receipt')) return 'RECEIPT ACTUAL';
  if (normalized.includes('user') || normalized.includes('manual')) return 'USER ENTERED';
  if (normalized.includes('receipt')) return 'RECEIPT ACTUAL';
  if (normalized.includes('session') && normalized.includes('actual')) return 'SESSION ACTUAL';
  if (normalized.includes('provider') || normalized.includes('sync')) return 'PROVIDER REPORTED';
  if (normalized.includes('user')) return 'USER ENTERED';
  if (normalized.includes('reconciled') || normalized === 'checked') return 'RECONCILED';
  if (normalized.includes('estimate')) return 'ESTIMATED';
  if (normalized.includes('missing')) return 'MISSING';
  if (normalized.includes('review')) return 'NEEDS REVIEW';
  if (normalized.includes('mixed')) return 'MIXED EVIDENCE';
  return 'DERIVED';
}

function plainLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[·/])\s*\w/g, (match) => match.toUpperCase())
    .replace(/Club royale/g, 'Club Royale')
    .replace(/Blue chip/g, 'Blue Chip')
    .replace(/Roi/g, 'ROI')
    .replace(/Adt/g, 'ADT');
}

function Metric({ label, value, evidence, detail, onPress }: { label: string; value: string; evidence: string; detail?: string; onPress?: () => void }) {
  const router = useRouter();
  const normalizedEvidence = standardEvidenceLabel(evidence);
  const displayedEvidence = plainLabel(normalizedEvidence);
  const drill = onPress ?? (() => router.push({ pathname: '/casino/metric-evidence' as never, params: { label, value, evidence: normalizedEvidence, detail: detail ?? '' } } as never));
  const content = <>
    <View style={styles.metricHeader}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.evidence, normalizedEvidence === 'MISSING' && styles.missing]}>{displayedEvidence}</Text></View>
    <Text style={styles.metricValue}>{value}</Text>
    {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    <Text style={styles.metricDrill}>View contributing records ›</Text>
  </>;
  return <TouchableOpacity style={styles.metric} onPress={drill} accessibilityRole="button" accessibilityLabel={`${label}. ${value}. View contributing records`}>{content}</TouchableOpacity>;
}

function EvidenceLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={styles.lineValue}>{value}</Text></View>;
}

function CasinoBarChart({ title, rows, valueLabel }: { title: string; rows: Array<{ label: string; value: number; color?: string }>; valueLabel: (value: number) => string }) {
  const { chartPalette } = useExperience();
  const visible = rows.filter((row) => Number.isFinite(row.value)).slice(0, 8);
  const max = Math.max(1, ...visible.map((row) => Math.abs(row.value)));
  return <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`${title}. ${visible.map((row) => `${row.label} ${valueLabel(row.value)}`).join(', ')}`}>
    <Text style={styles.chartTitle}>{title}</Text>
    {visible.map((row, index) => <View key={`${row.label}-${row.value}`} style={styles.chartRow}>
      <Text style={styles.chartLabel} numberOfLines={1}>{row.label}</Text>
      <View style={styles.chartTrack}><View style={[styles.chartBar, { width: `${Math.max(2, Math.abs(row.value) / max * 100)}%`, backgroundColor: row.color ?? chartPalette[index % chartPalette.length] }]} /></View>
      <Text style={styles.chartValue}>{valueLabel(row.value)}</Text>
    </View>)}
  </View>;
}

function ProgressMeter({ label, value, caption, color = '#0b766d', targetLabel }: { label: string; value: number; caption: string; color?: string; targetLabel?: string }) {
  const safeValue = clampPercent(value);
  return <View style={styles.progressCard} accessibilityLabel={`${label} ${safeValue.toFixed(0)} percent`}>
    <View style={styles.rowBetween}><Text style={styles.progressLabel} numberOfLines={2}>{label}</Text><Text style={[styles.progressPercent, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{safeValue.toFixed(0)}%</Text></View>
    <AccessibleProgress progress={safeValue / 100} label={caption} color={color} />
    {targetLabel ? <Text style={styles.progressTarget} numberOfLines={2}>{targetLabel}</Text> : null}
  </View>;
}

function ColorMetric({ icon: Icon, label, value, detail, color, confidence }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; detail: string; color: string; confidence?: string }) {
  const router = useRouter();
  const evidence = standardEvidenceLabel(confidence ?? 'derived');
  const displayValue = String(confidence ?? '').trim().toLowerCase() === 'missing' ? '—' : value;
  return <TouchableOpacity style={[styles.colorMetric, { borderTopColor: color }]} onPress={() => router.push({ pathname: '/casino/metric-evidence' as never, params: { label, value: displayValue, evidence, detail } } as never)} accessibilityRole="button" accessibilityLabel={`${label}. ${displayValue === '—' ? 'Data not available' : displayValue}. View contributing records`}>
    <View style={[styles.colorMetricIcon, { backgroundColor: `${color}1f` }]}><Icon size={19} color={color} /></View>
    <View style={styles.colorMetricContent}>
      <View style={styles.rowBetween}><Text style={styles.colorMetricLabel}>{label}</Text>{confidence ? <Text style={[styles.confidencePill, { color, backgroundColor: `${color}18` }]}>{standardEvidenceLabel(confidence)}</Text> : null}</View>
      <Text style={[styles.colorMetricValue, { color }]}>{displayValue}</Text>
      <Text style={styles.colorMetricDetail}>{detail}</Text>
      <Text style={styles.metricDrill}>View contributing records ›</Text>
    </View>
  </TouchableOpacity>;
}

function DistributionBar({ title, segments, footer }: { title: string; segments: Array<{ label: string; value: number; color: string }>; footer?: string }) {
  const { chartPalette } = useExperience();
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  return <View style={styles.distributionCard} accessibilityRole="image" accessibilityLabel={`${title}. ${segments.map((segment) => `${segment.label} ${number(segment.value)}`).join(', ')}`}>
    <Text style={styles.chartTitle}>{title}</Text>
    <View style={styles.distributionTrack}>{segments.map((segment, index) => {
      const width = total > 0 ? (Math.max(0, segment.value) / total) * 100 : 0;
      return width > 0 ? <View key={segment.label} style={{ width: `${width}%`, backgroundColor: chartPalette[index % chartPalette.length] ?? segment.color }} /> : null;
    })}</View>
    <View style={styles.distributionLegend}>{segments.map((segment, index) => <View key={segment.label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: chartPalette[index % chartPalette.length] ?? segment.color }]} /><Text style={styles.legendText}>{segment.label} {number(segment.value)}</Text></View>)}</View>
    {footer ? <Text style={styles.chartFootnote}>{footer}</Text> : null}
  </View>;
}

export default function CasinoCommandCenter() {
  const router = useRouter();
  const { colors, preferences } = useExperience();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { bookedCruises, cruiseEconomicsSummary, allCruiseEconomicsSummary, isHydrating: casinoDataHydrating } = useCasinoEconomicsData();
  const { currentUser, users } = useUser();
  const { selectedProfileId } = useIntelligenceFilters();
  const casinoProfile = useMemo(() => selectedProfileId !== 'all' && selectedProfileId !== 'unassigned'
    ? users.find((profile) => profile.id === selectedProfileId) ?? currentUser
    : currentUser, [currentUser, selectedProfileId, users]);
  const { clubRoyalePoints, clubRoyaleTier, clubRoyalePointsSource, clubRoyaleNextResetDate, clubRoyaleSyncDiscrepancy, blueChip } = useLoyalty();
  const casinoSessionState = useCasinoSessions();
  const allSessions = Array.isArray(casinoSessionState?.sessions) ? casinoSessionState.sessions : [];
  const sessions = useMemo(() => filterRecordsForProfile(allSessions, casinoProfile, users), [allSessions, casinoProfile, users]);
  const getSessionAnalytics = casinoSessionState.getSessionAnalytics;
  const certificateState = useCertificates();
  const allSearchableCertificates = Array.isArray(certificateState?.searchableCertificates) ? certificateState.searchableCertificates : [];
  const searchableCertificates = useMemo(() => filterRecordsForProfile(allSearchableCertificates, casinoProfile, users), [allSearchableCertificates, casinoProfile, users]);
  const { settings, selectedProgram: program, setSelectedProgram } = useCasinoSettings();
  const [activeTab, setActiveTab] = useState<CasinoTab>('intelligence');
  const [chartsReady, setChartsReady] = useState(false);
  const [sessionPeriod, setSessionPeriod] = useState<SessionPeriod>('all');
  const casinoDataReady = !casinoDataHydrating || bookedCruises.length > 0;

  useEffect(() => {
    setChartsReady(false);
    // The Casino route must never depend on InteractionManager. It is absent
    // in some supported React Native runtimes and previously left this tab in
    // a permanent loading/retry loop. A cancellable next-turn yield keeps
    // navigation responsive without relying on that native scheduler.
    const timer = setTimeout(() => setChartsReady(true), 0);
    return () => clearTimeout(timer);
  }, [activeTab, program]);

  useEffect(() => {
    const requested = String(params.tab ?? '').toLowerCase();
    const mapped: Record<string, CasinoTab> = {
      overview: 'intelligence', intelligence: 'intelligence', portfolio: 'intelligence', trips: 'intelligence', value: 'intelligence', history: 'intelligence',
      charts: 'charts', chart: 'charts',
      sessions: 'session', session: 'session',
      tools: 'calcs', action: 'calcs', simulator: 'calcs', ship: 'calcs', calcs: 'calcs', calculations: 'calcs',
    };
    if (mapped[requested]) setActiveTab(mapped[requested]);
  }, [params.tab]);

  const { truths, loading: truthsLoading, skipped: skippedTruthRows } = useDeferredCasinoTruths({
    bookedCruises,
    sessions,
    certificates: searchableCertificates,
    pointsPerHourFallback: settings.defaultPointsPerHour,
    houseEdgeFallback: settings.defaultHouseEdge,
  });
  const programTrips = useMemo(() => truths.filter((trip) => trip.program === program), [program, truths]);
  const profileBlueChipStatus = useMemo(() => getCelebrityBlueChipStatus(Math.max(0, Number(casinoProfile?.celebrityBlueChipPoints ?? 0)), casinoProfile?.celebrityBlueChipTier), [casinoProfile?.celebrityBlueChipPoints, casinoProfile?.celebrityBlueChipTier]);
  const profileBlueChipProgress = useMemo(() => getCelebrityBlueChipProgress(Math.max(0, Number(casinoProfile?.celebrityBlueChipPoints ?? 0)), profileBlueChipStatus.earnedTier), [casinoProfile?.celebrityBlueChipPoints, profileBlueChipStatus.earnedTier]);
  const isCurrentCasinoProfile = !casinoProfile?.id || casinoProfile.id === currentUser?.id;
  const rawSyncedPoints = program === 'blue_chip'
    ? isCurrentCasinoProfile ? blueChip?.points : casinoProfile?.celebrityBlueChipPoints
    : isCurrentCasinoProfile ? clubRoyalePoints : casinoProfile?.clubRoyalePoints;
  const syncedPoints = Number.isFinite(Number(rawSyncedPoints)) ? Math.max(0, Number(rawSyncedPoints)) : 0;
  const reconciliation = useMemo(() => reconcileCasinoSeason({
    program,
    syncedPoints,
    cruises: truths,
    certificates: searchableCertificates,
  }), [program, searchableCertificates, syncedPoints, truths]);
  const inferredProgramSessionIds = useMemo(() => {
    const cruiseProgramById = new Map(bookedCruises.map((cruise) => [cruise.id, inferCasinoProgram(cruise as unknown as Record<string, unknown>)]));
    return sessions.filter((session) => !session.program && session.cruiseId && cruiseProgramById.get(session.cruiseId) === program).map((session) => session.id);
  }, [bookedCruises, program, sessions]);
  const programSessions = useMemo(() => {
    const inferredIds = new Set(inferredProgramSessionIds);
    return sessions.filter((session) => session?.program === program || inferredIds.has(session?.id));
  }, [inferredProgramSessionIds, program, sessions]);
  const sessionDateRange = useMemo(() => {
    if (sessionPeriod === 'all') return {};
    const today = new Date();
    const dateTo = today.toISOString().slice(0, 10);
    const from = new Date(today);
    if (sessionPeriod === 'week') from.setDate(from.getDate() - 6);
    if (sessionPeriod === 'month') from.setDate(1);
    return { dateFrom: sessionPeriod === 'today' ? dateTo : from.toISOString().slice(0, 10), dateTo };
  }, [sessionPeriod]);
  const allSessionAnalytics = useMemo(() => getSessionAnalytics({ program, includeUnprogrammedSessionIds: inferredProgramSessionIds }), [getSessionAnalytics, inferredProgramSessionIds, program, sessions]);
  const sessionAnalytics = useMemo(() => getSessionAnalytics({ program, includeUnprogrammedSessionIds: inferredProgramSessionIds, ...sessionDateRange }), [getSessionAnalytics, inferredProgramSessionIds, program, sessionDateRange, sessions]);
  const tier = program === 'blue_chip'
    ? (isCurrentCasinoProfile ? blueChip?.tier : profileBlueChipStatus.effectiveTier) ?? 'Pearl'
    : (isCurrentCasinoProfile ? clubRoyaleTier : casinoProfile?.clubRoyaleTier) ?? 'Choice';
  const earnedClubRoyaleTier = useMemo(() => getTierByPoints(syncedPoints), [syncedPoints]);
  const earnedClubRoyaleProgress = useMemo(() => getTierProgress(syncedPoints, earnedClubRoyaleTier), [earnedClubRoyaleTier, syncedPoints]);
  const currentSeason = useMemo(() => getCasinoProgramSeason(program), [program]);
  const currentSeasonTrips = useMemo(() => programTrips.filter((trip) => isDateInCasinoSeason(trip.sailDate, currentSeason)), [currentSeason, programTrips]);
  const resetDate = program === 'blue_chip'
    ? blueChip?.nextResetDate
    : clubRoyaleNextResetDate instanceof Date ? clubRoyaleNextResetDate.toISOString().slice(0, 10) : String(clubRoyaleNextResetDate ?? '');
  const pointSource = !isCurrentCasinoProfile
    ? (program === 'blue_chip' ? casinoProfile?.celebrityLastSyncAt : casinoProfile?.clubRoyaleLastSyncAt)
      ? `${program === 'blue_chip' ? 'BLUE CHIP' : 'CLUB ROYALE'} PROVIDER SYNC · SELECTED PROFILE`
      : 'SELECTED PROFILE SAVED VALUE'
    : program === 'blue_chip'
    ? 'SELECTED PROFILE / BLUE CHIP SYNC'
    : clubRoyalePointsSource === 'api'
      ? 'CLUB ROYALE PROVIDER SYNC'
      : clubRoyalePointsSource === 'manual'
        ? 'SELECTED PROFILE MANUAL ENTRY'
        : clubRoyalePointsSource === 'historical'
          ? 'OWNER-SCOPED ANNUAL HISTORY'
          : 'CRUISE CLOSEOUT LEDGER';
  const pointSourceTimestamp = program === 'blue_chip' ? casinoProfile?.celebrityLastSyncAt : casinoProfile?.clubRoyaleLastSyncAt;
  const pointSourceEndpoint = program === 'blue_chip' ? casinoProfile?.celebrityLoyaltySourceEndpoint : casinoProfile?.clubRoyaleLoyaltySourceEndpoint;

  const totalTheo = currentSeasonTrips.reduce((sum, trip) => sum + (trip.theoreticalLoss.value ?? 0), 0);
  const tripsWithTheo = currentSeasonTrips.filter((trip) => trip.theoreticalLoss.value != null).length;
  const totalNet = currentSeasonTrips.reduce((sum, trip) => sum + (trip.netGamingResult.value ?? 0), 0);
  const tripsWithNet = currentSeasonTrips.filter((trip) => trip.netGamingResult.value != null).length;
  const evidenceChart = useMemo(() => [
    { label: 'Synced', value: syncedPoints, color: '#d8aa32' },
    { label: 'Trip attributed', value: reconciliation.attributedCruisePoints, color: '#0b766d' },
    { label: 'Unallocated', value: reconciliation.unallocatedPoints ?? 0, color: '#d46b37' },
  ], [reconciliation.attributedCruisePoints, reconciliation.unallocatedPoints, syncedPoints]);
  const sessionPointChart = useMemo(() => sessions
    .filter((session) => !isGeneratedCasinoSession(session) && (session.program === program || inferredProgramSessionIds.includes(session.id)) && (session.pointsEarned ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((session) => ({ label: `${session.date.slice(5)} ${session.machineName ?? 'Casino'}`, value: session.pointsEarned ?? 0 })), [inferredProgramSessionIds, program, sessions]);
  const cruisePlayHoursChart = useMemo(() => currentSeasonTrips
    .filter((trip) => trip.hours.value != null)
    .sort((a, b) => b.sailDate.localeCompare(a.sailDate))
    .slice(0, 10)
    .map((trip, index) => ({
      label: `${trip.shipName.replace(/ of the seas/i, '')} ${trip.sailDate.slice(5)}`,
      value: trip.hours.value ?? 0,
      color: trip.hours.kind === 'estimated' ? '#d18b16' : ['#0b766d', '#3267c8', '#8b5cf6'][index % 3],
    })), [currentSeasonTrips]);
  const cruiseAvailabilityChart = useMemo(() => currentSeasonTrips
    .filter((trip) => (trip.casinoAvailabilityHours ?? 0) > 0)
    .sort((a, b) => b.sailDate.localeCompare(a.sailDate))
    .slice(0, 10)
    .map((trip, index) => ({
      label: `${trip.shipName.replace(/ of the seas/i, '')} ${trip.sailDate.slice(5)}`,
      value: trip.casinoAvailabilityHours ?? 0,
      color: ['#0b766d', '#3267c8', '#8b5cf6', '#d8aa32'][index % 4],
    })), [currentSeasonTrips]);
  const economicsByCruise = useMemo(() => new Map(allCruiseEconomicsSummary.rows.map((row) => [row.cruiseId, row])), [allCruiseEconomicsSummary.rows]);
  const cruiseById = useMemo(() => new Map(bookedCruises.map((cruise) => [cruise.id, cruise])), [bookedCruises]);
  const reservationCountByVoyage = useMemo(() => {
    const counts = new Map<string, number>();
    bookedCruises.forEach((cruise) => {
      const key = getPhysicalBookedVoyageKey(cruise);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [bookedCruises]);
  const dashboard = useMemo(() => buildCasinoDashboardMetrics({ truths: currentSeasonTrips, sessions: programSessions, sessionAnalytics: allSessionAnalytics }), [allSessionAnalytics, currentSeasonTrips, programSessions]);
  const recoveryStatus = useMemo(() => buildCasinoRecoveryStatusSummary(), []);
  const netTheoretical = dashboard.totalTheo == null ? null : (dashboard.totalPoints * settings.pointDollarValue) - dashboard.totalTheo;
  const currentSeasonEconomicValue = useMemo(() => currentSeasonTrips.reduce((sum, trip) => sum + (economicsByCruise.get(trip.cruiseId)?.totalEconomicValue ?? 0), 0), [currentSeasonTrips, economicsByCruise]);
  const isSignatureRetention = program === 'club_royale'
    && String(tier).toLowerCase() === 'signature'
    && syncedPoints < 25_000;
  const tierProgress = program === 'blue_chip'
    ? clampPercent(Number(isCurrentCasinoProfile ? blueChip?.trackerPercentage ?? 0 : profileBlueChipProgress.percentComplete))
    : isSignatureRetention
      ? clampPercent((syncedPoints / 25_000) * 100)
      : clampPercent(earnedClubRoyaleProgress.percentComplete);
  const nextTier = program === 'blue_chip'
    ? (isCurrentCasinoProfile ? blueChip?.nextTier : profileBlueChipProgress.nextTier) ?? null
    : isSignatureRetention ? 'Signature retention' : earnedClubRoyaleProgress.nextTier;
  const nextTierThreshold = program === 'blue_chip'
    ? syncedPoints + Number(isCurrentCasinoProfile ? blueChip?.remainingPoints ?? 0 : profileBlueChipProgress.pointsToNext)
    : isSignatureRetention ? 25_000 : nextTier && nextTier in CLUB_ROYALE_TIERS ? CLUB_ROYALE_TIERS[nextTier].threshold : syncedPoints;
  const pointsByTripChart = useMemo(() => programTrips
    .filter((trip) => trip.points.value != null)
    .sort((a, b) => b.sailDate.localeCompare(a.sailDate))
    .slice(0, 12)
    .map((trip, index) => ({ label: `${trip.shipName.replace(/ of the seas/i, '')} ${trip.sailDate.slice(5)}`, value: trip.points.value ?? 0, color: ['#0b766d', '#3267c8', '#8b5cf6', '#d8aa32'][index % 4] })), [programTrips]);
  const netByTripChart = useMemo(() => programTrips
    .filter((trip) => trip.netGamingResult.value != null)
    .sort((a, b) => b.sailDate.localeCompare(a.sailDate))
    .slice(0, 12)
    .map((trip) => ({ label: `${trip.shipName.replace(/ of the seas/i, '')} ${trip.sailDate.slice(5)}`, value: trip.netGamingResult.value ?? 0, color: (trip.netGamingResult.value ?? 0) >= 0 ? '#16a06f' : '#dc4c4c' })), [programTrips]);
  const likelyUnpostedCruises = useMemo(() => currentSeasonTrips
    .filter((trip) => trip.points.value != null && trip.points.kind !== 'provider_reported')
    .sort((a, b) => b.sailDate.localeCompare(a.sailDate))
    .slice(0, 4)
    .map((trip) => `${trip.shipName.replace(/ of the seas/i, '')} ${trip.sailDate.slice(5)}`), [currentSeasonTrips]);
  const tierProgressionForecastChart = useMemo(() => {
    const currentPoints = Math.max(0, syncedPoints);
    const target = Math.max(currentPoints, Number(nextTierThreshold) || currentPoints);
    const seasonTripsWithPoints = currentSeasonTrips.filter((trip) => (trip.points.value ?? 0) > 0);
    const seasonNights = seasonTripsWithPoints.reduce((sum, trip) => {
      const cruise = cruiseById.get(trip.cruiseId);
      const inferredNights = Number(trip.seaDays ?? 0) + Number(trip.portDays ?? 0);
      return sum + Math.max(1, Number((cruise?.nights ?? inferredNights) || 1));
    }, 0);
    const pointsPerNight = seasonNights > 0
      ? seasonTripsWithPoints.reduce((sum, trip) => sum + (trip.points.value ?? 0), 0) / seasonNights
      : 0;
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const normalizedResetDate = String(resetDate ?? '');
    const resetKey = /^\d{4}-\d{2}-\d{2}$/.test(normalizedResetDate) ? normalizedResetDate : '';
    if (!resetKey || resetKey <= todayKey) return [];
    const seasonStart = new Date(`${currentSeason.startDate}T12:00:00`);
    const elapsedDays = Math.max(1, Math.floor((today.getTime() - seasonStart.getTime()) / 86400000) + 1);
    const elapsedDailyPace = currentPoints / elapsedDays;
    const futurePointsByMonth = new Map<string, number>();
    bookedCruises
      .filter((cruise) => inferCasinoProgram(cruise as unknown as Record<string, unknown>) === program)
      .filter((cruise) => String(cruise.sailDate ?? '') >= todayKey && String(cruise.sailDate ?? '') < resetKey)
      .forEach((cruise) => {
        const monthKey = String(cruise.sailDate).slice(0, 7);
        const gamingNights = Math.max(0, Number(cruise.casinoOpenDays ?? cruise.seaDays ?? cruise.nights ?? 0));
        futurePointsByMonth.set(monthKey, (futurePointsByMonth.get(monthKey) ?? 0) + (pointsPerNight * gamingNights));
      });
    const rows: Array<{ label: string; value: number; color: string }> = [];
    const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    const reset = new Date(`${resetKey}T12:00:00`);
    let projected = currentPoints;
    while (cursor < reset && rows.length < 14) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const daysInProjectionMonth = Math.max(1, Math.round((Math.min(nextMonth.getTime(), reset.getTime()) - Math.max(cursor.getTime(), today.getTime())) / 86400000));
      const elapsedPaceProjection = elapsedDailyPace * Math.max(0, daysInProjectionMonth);
      const bookedCruiseProjection = futurePointsByMonth.get(key) ?? 0;
      projected += Math.max(elapsedPaceProjection, bookedCruiseProjection);
      rows.push({
        label: cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        value: projected,
        color: projected >= target && target > currentPoints ? '#15956a' : '#3267c8',
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return rows;
  }, [bookedCruises, cruiseById, currentSeason, currentSeasonTrips, nextTierThreshold, program, resetDate, syncedPoints]);
  const shipComparisonChart = useMemo(() => {
    const byShip = new Map<string, { points: number; nights: number; net: number; verifiedFields: number; count: number; latestSailDate: string }>();
    for (const trip of programTrips) {
      const cruise = cruiseById.get(trip.cruiseId);
      const inferredNights = Number(trip.seaDays ?? 0) + Number(trip.portDays ?? 0);
      const nights = Math.max(1, Number((cruise?.nights ?? inferredNights) || 1));
      const actualFields = [trip.points, trip.netGamingResult, trip.coinIn, trip.hours, trip.theoreticalLoss]
        .filter((item) => item.kind === 'session_actual' || item.kind === 'receipt_actual' || item.kind === 'user_entered' || item.kind === 'provider_reported' || item.kind === 'derived').length;
      const current = byShip.get(trip.shipName) ?? { points: 0, nights: 0, net: 0, verifiedFields: 0, count: 0, latestSailDate: '' };
      current.points += trip.points.value ?? 0;
      current.nights += nights;
      current.net += trip.netGamingResult.value ?? 0;
      current.verifiedFields += actualFields;
      current.count += 1;
      current.latestSailDate = current.latestSailDate > trip.sailDate ? current.latestSailDate : trip.sailDate;
      byShip.set(trip.shipName, current);
    }
    return Array.from(byShip.entries())
      .map(([shipName, row], index) => ({
        label: shipName.replace(/ of the seas/i, ''),
        value: row.nights > 0 ? row.points / row.nights : 0,
        color: ['#0b766d', '#3267c8', '#8b5cf6', '#d8aa32'][index % 4],
        net: row.net,
        confidence: row.count ? clampPercent(
          ((row.verifiedFields / (row.count * 5)) * 60)
          + (Math.min(1, row.count / 3) * 20)
          + ((Date.now() - new Date(`${row.latestSailDate}T12:00:00`).getTime()) <= 365 * 86400000 ? 20 : 0),
        ) : 0,
      }))
      .filter((row) => row.value > 0 || row.net !== 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [cruiseById, programTrips]);
  const seasonTrendChart = useMemo(() => {
    const byMonth = new Map<string, { points: number; expected: number; count: number }>();
    for (const trip of currentSeasonTrips) {
      const month = String(trip.sailDate ?? '').slice(0, 7) || 'Unknown';
      const current = byMonth.get(month) ?? { points: 0, expected: 0, count: 0 };
      current.points += trip.points.value ?? 0;
      current.expected += trip.points.kind === 'provider_reported' ? 0 : (trip.points.value ?? 0);
      current.count += 1;
      byMonth.set(month, current);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, row]) => ({ label: month.slice(5), value: row.points, color: row.expected > 0 ? '#d18b16' : '#15956a' }));
  }, [currentSeasonTrips]);
  const evidenceComposition = useMemo(() => [
    { label: 'Verified', value: dashboard.actualEvidenceCount, color: '#15956a' },
    { label: 'Estimated', value: dashboard.estimatedEvidenceCount, color: '#d18b16' },
    { label: 'Missing', value: dashboard.missingEvidenceCount, color: '#d94b4b' },
  ], [dashboard.actualEvidenceCount, dashboard.estimatedEvidenceCount, dashboard.missingEvidenceCount]);
  const annualHostSummaryReady = program === 'club_royale' && cruiseEconomicsSummary.totals.cruises > 0 && cruiseEconomicsSummary.totals.totalPoints > 0;
  const certificateOptionsByTrip = useMemo(() => {
    const map = new Map<string, CertificateOptionSummary>();
    for (const trip of programTrips) {
      if (trip.certificateCodes.length > 0) {
        map.set(trip.cruiseId, summarizeCertificateOptionsForTrip(trip, searchableCertificates));
      }
    }
    return map;
  }, [programTrips, searchableCertificates]);

  const renderTrip = (trip: CasinoCruiseTruth) => {
    const economics = economicsByCruise.get(trip.cruiseId);
    const cruise = cruiseById.get(trip.cruiseId);
    const certificateOptions = certificateOptionsByTrip.get(trip.cruiseId);
    const pointsPerHour = trip.hours.kind !== 'estimated' && trip.points.value != null && trip.hours.value && trip.hours.value > 0 ? trip.points.value / trip.hours.value : null;
    const cruiseSavings = economics?.cruiseValueCaptured ?? null;
    return <View key={trip.cruiseId} style={styles.tripCard} testID={`casino-trip-${trip.cruiseId}`}>
    {cruise ? <CruiseCard
      cruise={{
        ...cruise,
        pointsEarned: cruise.pointsEarned ?? trip.points.value ?? undefined,
        sourceProvider: cruise.sourceProvider || 'Owner-scoped casino cruise history',
      }}
      variant="booked"
      mini
      relatedReservationCount={reservationCountByVoyage.get(getPhysicalBookedVoyageKey(cruise)) ?? 1}
      onPress={() => router.push({
        pathname: '/cruise-details' as never,
        params: buildCruiseDetailsParams(cruise, { source: 'casino' }),
      } as never)}
    /> : <View style={styles.rowBetween}>
      <View style={styles.tripTitleWrap}><Text style={styles.tripShip}>{trip.shipName}</Text><Text style={styles.tripDate}>{trip.sailDate} · {trip.seasonLabel}</Text></View>
      <Text style={styles.pointsPill}>{number(trip.points.value)} pts</Text>
    </View>}
    <EvidenceLine label="Gaming result" value={`${money(trip.netGamingResult.value)} · ${sourceLabel(trip.netGamingResult.kind)}`} />
    <EvidenceLine label="Theoretical" value={`${money(trip.theoreticalLoss.value)} · ${sourceLabel(trip.theoreticalLoss.kind)}`} />
    <EvidenceLine label="Coin-in" value={`${money(trip.coinIn.value)} · ${sourceLabel(trip.coinIn.kind)}`} />
    <EvidenceLine label={trip.hours.kind === 'estimated' ? 'Estimated play hours' : 'Play hours'} value={`${number(trip.hours.value)} · ${sourceLabel(trip.hours.kind)}${pointsPerHour == null ? trip.hours.kind === 'estimated' ? ` · modeled from ${settings.defaultPointsPerHour} PPH` : '' : ` · ${number(pointsPerHour)} PPH`}`} />
    <EvidenceLine label="Casino availability" value={`${number(trip.casinoAvailabilityHours)} available hours · ${formatCount(trip.casinoAvailableDays, 'available day')} · ${trip.seaDays} sea / ${trip.portDays} port itinerary days`} />
    <EvidenceLine label="ADT days" value={`${formatCount(trip.ratedGamingDays, 'day')} · ${trip.ratedGamingDaysSource === 'explicit' ? 'explicit rated days' : trip.ratedGamingDaysSource === 'casino_availability_estimate' ? 'estimated from casino availability' : 'missing'}`} />
    <EvidenceLine label="Certificates earned" value={trip.certificateLinks.length ? trip.certificateLinks.map((link) => `${link.code} · ${link.confidence.toUpperCase()}`).join(', ') : 'Not linked'} />
    <EvidenceLine label="Certificate-created value" value={`${money(trip.certificateCreatedValue.value)} · ${sourceLabel(trip.certificateCreatedValue.kind)}`} />
    {trip.certificateLinks.some((link) => link.confidence === 'probable') ? <EvidenceLine label="Certificate review" value="Issue-date linkage is probable, not exact; review overlapping cruises before treating it as confirmed." /> : null}
    {certificateOptions ? <EvidenceLine label="Future certificate inventory" value={certificateOptions.optionCount > 0 ? `${certificateOptions.optionCount.toLocaleString()} unique option(s)${certificateOptions.topCabins.length ? ` · ${certificateOptions.topCabins.join(', ')}` : ''}` : 'Certificate linked, eligible sailing PDF rows not loaded'} /> : null}
    {certificateOptions?.valueRange != null ? <EvidenceLine label="Future certificate option values" value={`${money(certificateOptions.valueRange.minimum)}–${money(certificateOptions.valueRange.maximum)} · median ${money(certificateOptions.valueRange.median)}; mutually exclusive sailings are not added together`} /> : null}
    {economics ? <><EvidenceLine label="Retail / paid" value={`${money(economics.retailValue)} / ${money(economics.netEffectivePaid)}`} /><EvidenceLine label="Cruise value captured" value={money(economics.cruiseValueCaptured)} /><EvidenceLine label="Cash / total economic value" value={`${money(economics.cashResult)} / ${money(economics.totalEconomicValue)}`} /></> : null}
    {economics ? <EvidenceLine label="Comp coverage / cash ROI" value={`${economics.retailValue && economics.retailValue > 0 && economics.cruiseValueCaptured != null ? `${((economics.cruiseValueCaptured / economics.retailValue) * 100).toFixed(1)}%` : '—'} / ${economics.netEffectivePaid && economics.netEffectivePaid > 0 && economics.cashResult != null ? `${((economics.cashResult / economics.netEffectivePaid) * 100).toFixed(1)}%` : '—'} · DERIVED`} /> : null}
    {economics ? <EvidenceLine label="Host ledger correlation" value={`${number(trip.points.value)} pts → ${money(trip.coinIn.value)} coin-in → ${money(trip.theoreticalLoss.value)} theo; saved ${money(cruiseSavings)} on cruise fare`} /> : null}
    <View style={cruise?.invoiceImportedAt ? styles.invoiceVerified : styles.invoiceMissing}><Text style={styles.invoiceStatus}>{cruise?.invoiceImportedAt ? `Receipt verified · ${cruise.invoiceFileName ?? 'Royal receipt'}` : 'Receipt not loaded · Upload it to verify the offer, certificate, and actual value'}</Text></View>
    <TouchableOpacity style={styles.invoiceButton} onPress={() => router.push({ pathname: '/casino/invoice-import' as never, params: { cruiseId: trip.cruiseId } } as never)} testID={`casino-trip-upload-invoice-${trip.cruiseId}`}><FileUp size={15} color="#0b766d" /><Text style={styles.invoiceButtonText}>{cruise?.invoiceImportedAt ? 'Replace or review receipt' : 'Upload Royal receipt PDF'}</Text></TouchableOpacity>
    {trip.hours.formula ? <Text style={styles.formula}>Hour estimate: {trip.hours.formula}</Text> : null}
    {trip.warnings.map((warning) => <Text key={warning} style={styles.warning}>⚠ {warning}</Text>)}
  </View>;
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']} testID="casino-relationship-intelligence">
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.identityShell, { backgroundColor: colors.background }]}>
        <TabIdentityBand tab="casino" compact detail={`${tier} · ${number(syncedPoints)} current points`} />
      </View>
      <View style={[styles.header, styles.actionHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.askButton, { backgroundColor: colors.accent }]} onPress={() => router.push('/ask-my-data')} accessibilityLabel="Ask Agent SEA"><Database size={17} color={colors.inverseText} /><Text style={[styles.askText, { color: colors.inverseText }]} numberOfLines={1}>Agent SEA</Text></TouchableOpacity>
      </View>

      <View style={[styles.programRow, { backgroundColor: colors.surface }]}>
        <TouchableOpacity style={[styles.programButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, program === 'club_royale' && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => void setSelectedProgram('club_royale')}><Text style={[styles.programText, { color: colors.muted }, program === 'club_royale' && styles.programTextActive]}>Club Royale</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.programButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, program === 'blue_chip' && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => void setSelectedProgram('blue_chip')}><Text style={[styles.programText, { color: colors.muted }, program === 'blue_chip' && styles.programTextActive]}>Blue Chip</Text></TouchableOpacity>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>{TABS.map((tab) => <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)} accessibilityRole="tab" accessibilityLabel={`${tab.label} casino page`} accessibilityState={{ selected: activeTab === tab.id }} testID={`casino-${tab.id}-tab`}><Text numberOfLines={1} style={[styles.tabText, { color: colors.muted }, activeTab === tab.id && { color: colors.accent }]}>{tab.label}</Text></TouchableOpacity>)}</View>

      {casinoDataHydrating || truthsLoading || skippedTruthRows > 0 ? <View style={styles.processingBanner} testID="casino-data-hydration-status">
        <Text style={styles.processingText}>{casinoDataHydrating && bookedCruises.length === 0 ? 'Loading saved casino and completed-cruise history…' : truthsLoading ? 'Preparing casino cruise calculations in the background…' : 'Casino calculations ready.'}{skippedTruthRows > 0 ? ` ${skippedTruthRows} malformed ${skippedTruthRows === 1 ? 'record was' : 'records were'} safely skipped.` : ''}</Text>
      </View> : null}

      <PremiumVoyageArtwork kind="casino" ship={program === 'club_royale' ? 'Club Royale' : 'Blue Chip Club'} destination={`${tier} · ${number(syncedPoints)} points`} height={preferences.density === 'simplified' ? 104 : 132} />
      <ProgressiveDisclosure
        ownerId={casinoProfile?.id || currentUser?.id || 'local-default'}
        screenId="casino-command-center"
        sectionId={`${program}-${activeTab}-evidence`}
        title="Casino truth at a glance"
        conclusions={[
          { id: 'points', label: 'Current points', value: number(syncedPoints), status: pointSource.includes('PROVIDER') ? 'success' : 'info' },
          { id: 'trips', label: 'Attributed cruises', value: casinoDataReady ? String(currentSeasonTrips.length) : 'Loading…', status: casinoDataReady ? currentSeasonTrips.length ? 'success' : 'missing' : 'info' },
          { id: 'coverage', label: 'Evidence coverage', value: casinoDataReady ? percent(dashboard.dataCoverage) : 'Loading…', status: casinoDataReady ? dashboard.dataCoverage >= 75 ? 'success' : 'estimated' : 'info' },
        ]}
      >
        <Text style={styles.formulaCopy}>Source: {plainLabel(pointSource)}{pointSourceTimestamp ? ` · captured ${new Date(pointSourceTimestamp).toLocaleString()}` : ''}. Points, coin-in, theoretical loss, ADT, cruise value, and certificates retain separate evidence labels; estimates never replace provider or user-entered facts.</Text>
        <Text style={styles.formulaCopy}>Core formula: eligible Club Royale slot coin-in = qualifying points × $5. Theo = actual theo when supplied, otherwise valid coin-in × configured house edge. ADT = theo ÷ rated or itinerary-derived casino days.</Text>
        <EntityProvenanceDisclosure ownerId={casinoProfile?.id ?? currentUser?.id ?? null} entityType="loyalty" entityId={program === 'blue_chip' ? 'blue-chip' : 'club-royale'} field={program === 'blue_chip' ? 'blueChipPoints' : 'points'} label="Current point balance source" fallback={{ sourceType: pointSource.includes('PROVIDER') || pointSource.includes('SYNC') ? 'provider_sync' : pointSource.includes('MANUAL') ? 'manual_entry' : 'local_database', observedAt: pointSourceTimestamp || new Date().toISOString(), ownerId: casinoProfile?.id ?? currentUser?.id ?? null, confidence: pointSource.includes('PROVIDER') || pointSource.includes('SYNC') ? 'high' : 'medium', sourceRecord: `${pointSource}${pointSourceEndpoint ? ` · ${pointSourceEndpoint}` : ''}`, formula: null, provider: program === 'blue_chip' ? 'Blue Chip Club' : 'Club Royale', sourceHash: null, notes: null }} />
        {activeTab === 'intelligence' ? <EntityProvenanceDisclosure ownerId={casinoProfile?.id ?? currentUser?.id ?? null} entityType="financial" entityId="financial-summary" field="paid" label="Cruise economics source" fallback={{ sourceType: 'derived_calculation', observedAt: new Date().toISOString(), ownerId: casinoProfile?.id ?? currentUser?.id ?? null, confidence: 'medium', sourceRecord: 'Owner-scoped booked cruises, completed-cruise imports, and receipt records', formula: 'Cruise value captured = retail value − effective paid; cash result = winnings home − effective paid.', provider: 'Easy Seas calculation engine', sourceHash: null, notes: 'Coin-in remains gaming volume and is never counted as cash spending or profit.', isDerived: true }} /> : null}
      </ProgressiveDisclosure>
      {!casinoDataReady ? <View style={styles.hydrationCard} testID="casino-data-hydrating-card">
        <Activity size={24} color="#0E7FA7" />
        <View style={styles.hydrationCopy}>
          <Text style={styles.hydrationTitle}>Restoring your casino history</Text>
          <Text style={styles.hydrationText}>Completed cruises, closeouts, receipts, sessions, and certificate links are loading from the owner-scoped repository. Totals will appear only after that read completes.</Text>
        </View>
      </View> : null}
      {casinoDataReady && activeTab === 'intelligence' ? <>
        <View style={[styles.statusCard, { borderLeftColor: casinoTierAccent(program, tier) }]}>
          <View style={styles.statusCopy}><Text style={styles.statusTier} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>{tier}</Text><Text style={styles.statusSub} numberOfLines={2}>{program === 'club_royale' && tier !== earnedClubRoyaleTier ? `${earnedClubRoyaleTier} by current points · retained ${tier}` : reconciliation.seasonLabel}</Text></View>
          <View style={styles.statusPoints}><Text style={[styles.statusPointsValue, { color: casinoTierAccent(program, tier) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{number(syncedPoints)}</Text><Text style={styles.statusPointsLabel} numberOfLines={2}>{pointSource.includes('SYNC') || pointSource.includes('PROVIDER') ? 'provider points' : 'saved profile points'}</Text></View>
        </View>
        <Text style={styles.resetNote}>{program === 'blue_chip' ? 'Blue Chip Club resets every August 1.' : 'Club Royale resets every April 1.'} Profile: {casinoProfile?.displayName || casinoProfile?.name || 'Current player'} · Next reset: {resetDate || '—'} · Source: {plainLabel(pointSource)}{pointSourceEndpoint ? ` · Endpoint ${pointSourceEndpoint}` : ''}{pointSourceTimestamp ? ` · Captured ${new Date(pointSourceTimestamp).toLocaleString()}` : ''}{program === 'club_royale' && casinoProfile?.clubRoyaleTierValidThrough ? ` · Retained status valid through ${casinoProfile.clubRoyaleTierValidThrough}` : ''}</Text>
        <ProgressMeter label={nextTier ? `Progress from ${tier} to ${nextTier}` : `${tier} top tier`} value={tierProgress} caption={`${number(syncedPoints)} current points · ${plainLabel(pointSource)}`} targetLabel={nextTier ? `${number(nextTierThreshold)} points required` : 'Top tier reached'} color={casinoTierAccent(program, nextTier ?? tier)} />
        <ThemedSectionHeader
          tab="casino"
          emoji="👑"
          title="Current-season cruise activity"
          subtitle={`${currentSeason.startDate} through ${currentSeason.endDateExclusive} · ${currentSeasonTrips.length} attributed cruise ${currentSeasonTrips.length === 1 ? 'record' : 'records'}`}
          tone="casino"
          compact
          testID="casino-current-season-section"
        />
        <Text style={styles.sectionSub}>The provider/profile balance is the current total; closeouts explain its allocation without replacing it. Profile: {casinoProfile?.displayName || casinoProfile?.name || 'Current player'}.</Text>
        <View style={styles.colorGrid}>
          <ColorMetric icon={Trophy} label="Attributed cruise points" value={number(dashboard.totalPoints)} detail={`${dashboard.tripsWithPoints} of ${dashboard.tripCount} cruises have points; separate from the provider balance`} color="#d18b16" confidence={dashboard.tripsWithPoints ? 'reconciled' : 'missing'} />
          <ColorMetric icon={Timer} label="Casino availability" value={dashboard.totalCasinoAvailabilityHours == null ? '—' : `${number(dashboard.totalCasinoAvailabilityHours)}h`} detail={`${formatCount(dashboard.casinoAvailableDays, 'casino-available day')} inferred from itinerary/open-day records`} color="#0b766d" confidence={dashboard.availabilityConfidence} />
          <ColorMetric icon={Timer} label="Estimated play hours" value={dashboard.estimatedHours == null ? '—' : `${number(dashboard.estimatedHours)}h`} detail={`Final cruise points ÷ ${settings.defaultPointsPerHour} PPH, capped by casino availability`} color="#d18b16" confidence={dashboard.estimatedHours == null ? 'missing' : 'estimated'} />
          <ColorMetric icon={Gauge} label="Modeled ADT" value={money(dashboard.adt)} detail={`${formatCount(dashboard.ratedGamingDays, 'rated/available casino day')}; ${dashboard.estimatedRatedGamingDays} estimated from itinerary`} color="#8b4aac" confidence={dashboard.adtConfidence} />
          <ColorMetric icon={Dices} label="Casino cash result" value={money(dashboard.totalNet)} detail="Gaming cash only; cruise fare excluded" color={(dashboard.totalNet ?? 0) >= 0 ? '#15956a' : '#d94b4b'} confidence={dashboard.netConfidence} />
          <ColorMetric icon={Ticket} label="Certificate-created value" value={money(dashboard.totalCertificateCreatedValue)} detail="Saved earned-certificate award value only; alternate sailing choices are never summed" color="#D87924" confidence={dashboard.certificateCreatedValueConfidence} />
          <ColorMetric icon={Target} label="Theoretical loss" value={money(dashboard.totalTheo)} detail="Recorded theo, or labeled coin-in × hold estimate" color="#8b4aac" confidence={dashboard.theoConfidence} />
          <ColorMetric icon={Zap} label="Modeled points / play hour" value={dashboard.modeledPointsPerEstimatedHour == null ? '—' : `${number(dashboard.modeledPointsPerEstimatedHour)} PPH`} detail="Cruise points divided by estimated play hours; actual session entry is optional" color="#2474cc" confidence={dashboard.modeledPointsPerEstimatedHour == null ? 'missing' : 'estimated'} />
          <ColorMetric icon={Gauge} label="Data coverage" value={percent(dashboard.dataCoverage)} detail={`${dashboard.actualEvidenceCount} actual · ${dashboard.estimatedEvidenceCount} estimated · ${dashboard.missingEvidenceCount} missing`} color={dashboard.dataCoverage >= 75 ? '#15956a' : dashboard.dataCoverage >= 45 ? '#d18b16' : '#d94b4b'} confidence="checked" />
        </View>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/casino/post-cruise-closeout')} testID="casino-enter-cruise-result"><Timer color="#0d355a" size={20} /><Text style={styles.secondaryActionText}>Add or edit cruise-level points and win/loss</Text></TouchableOpacity>
        {program === 'club_royale' ? <>
          <ThemedSectionHeader tab="casino" emoji="💎" title="Historical annual economics" subtitle={`2025-04-01 through 2026-04-01 · ${cruiseEconomicsSummary.totals.cruises} completed Royal cruise ${cruiseEconomicsSummary.totals.cruises === 1 ? 'record' : 'records'}`} tone="success" compact />
          <Text style={styles.sectionSub}>Profile: {casinoProfile?.displayName || casinoProfile?.name || 'Current player'}. Receipt imports replace estimates cruise by cruise; these totals never enter current-season loyalty.</Text>
          <View style={styles.grid}>
            <Metric label="Retail cruise value" value={exactMoney(cruiseEconomicsSummary.totals.totalRetailValue)} evidence="RECONCILED" detail="Fare value before casino discounts" />
            <Metric label="Amount paid" value={exactMoney(cruiseEconomicsSummary.totals.totalPaid)} evidence="RECONCILED" detail="Cash paid; separate from gaming volume" />
            <Metric label="Cruise value captured" value={exactMoney(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)} evidence="CALCULATED" detail="Retail minus effective paid" />
            <Metric label="Winnings home" value={exactMoney(cruiseEconomicsSummary.totals.totalWinningsHome)} evidence="RECONCILED" />
            <Metric label="Cash result" value={exactMoney(cruiseEconomicsSummary.totals.totalCashResult)} evidence="CALCULATED" detail="Winnings home minus paid" />
            <Metric label="Total economic value" value={exactMoney(cruiseEconomicsSummary.totals.totalEconomicValue)} evidence="CALCULATED" detail="Retail + winnings − paid" />
          </View>
          <ThemedSectionHeader tab="casino" emoji="🎰" title="Gaming activity" subtitle="Wagering activity is deliberately separate from cash and cruise value." tone="casino" compact />
          <View style={styles.grid}>
            <Metric label="Points earned" value={number(cruiseEconomicsSummary.totals.totalPoints)} evidence="RECONCILED" />
            <Metric label="Coin-in volume" value={money(cruiseEconomicsSummary.totals.totalCoinIn)} evidence="DERIVED" detail="Gaming volume only; never counted as spending, loss, or economic value" />
            <Metric label="Points per night" value={number(cruiseEconomicsSummary.averages.pointsPerNight)} evidence="CALCULATED" />
            <Metric label="Comp coverage" value={`${cruiseEconomicsSummary.roiStyle.compCoverage.toFixed(2)}%`} evidence="CALCULATED" />
          </View>
          {annualHostSummaryReady ? <ProgressiveDisclosure
            ownerId={casinoProfile?.id || currentUser?.id || 'local-default'}
            screenId="casino-command-center"
            sectionId="club-royale-annual-host-summary"
            title="Host-ready annual evidence"
            conclusions={[
              { id: 'cruises', label: 'Cruises', value: number(cruiseEconomicsSummary.totals.cruises), status: 'success' },
              { id: 'points', label: 'Points', value: number(cruiseEconomicsSummary.totals.totalPoints), status: 'success' },
              { id: 'value', label: 'Value captured', value: exactMoney(cruiseEconomicsSummary.totals.totalCruiseValueCaptured), status: cruiseEconomicsSummary.totals.hasEstimates ? 'estimated' : 'success' },
            ]}
            testID="casino-annual-host-evidence-disclosure"
          ><View style={styles.annualSummaryCard} testID="casino-final-annual-host-summary">
            <Text style={styles.annualEyebrow}>Final annual casino summary</Text>
            <Text style={styles.annualTitle}>2025 Club Royale season · host-ready</Text>
            <Text style={styles.annualCopy}>Displayed from the active user’s imported/completed Royal casino cruise records. Totals remain blank for users without this history.</Text>
            <Text style={styles.annualGroupTitle}>Final annual totals</Text>
            <View style={styles.grid}>
              <Metric label="Cruises" value={number(cruiseEconomicsSummary.totals.cruises)} evidence="USER DATA" />
              <Metric label="Total nights" value={number(cruiseEconomicsSummary.totals.totalNights)} evidence="USER DATA" />
              <Metric label="Total retail" value={exactMoney(cruiseEconomicsSummary.totals.totalRetailValue)} evidence="RECONCILED" />
              <Metric label="Total paid" value={exactMoney(cruiseEconomicsSummary.totals.totalPaid)} evidence="RECONCILED" />
              <Metric label="Discount / comp value" value={exactMoney(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)} evidence="CALCULATED" />
              <Metric label="Total points" value={number(cruiseEconomicsSummary.totals.totalPoints)} evidence="RECONCILED" />
              <Metric label="Winnings home" value={exactMoney(cruiseEconomicsSummary.totals.totalWinningsHome)} evidence="RECONCILED" />
              <Metric label="Net cash result" value={exactMoney(cruiseEconomicsSummary.totals.totalCashResult)} evidence="CALCULATED" />
            </View>
            <Text style={styles.annualGroupTitle}>Final annual averages</Text>
            <View style={styles.grid}>
              <Metric label="Avg nights / cruise" value={number(cruiseEconomicsSummary.averages.nightsPerCruise)} evidence="CALCULATED" />
              <Metric label="Avg retail / cruise" value={exactMoney(cruiseEconomicsSummary.averages.retailPerCruise)} evidence="CALCULATED" />
              <Metric label="Avg paid / cruise" value={exactMoney(cruiseEconomicsSummary.averages.paidPerCruise)} evidence="CALCULATED" />
              <Metric label="Avg winnings / cruise" value={exactMoney(cruiseEconomicsSummary.averages.winningsPerCruise)} evidence="CALCULATED" />
              <Metric label="Avg points / cruise" value={number(cruiseEconomicsSummary.averages.pointsPerCruise)} evidence="CALCULATED" />
              <Metric label="Avg net cash / cruise" value={exactMoney(cruiseEconomicsSummary.averages.netCashPerCruise)} evidence="CALCULATED" />
              <Metric label="Avg points / night" value={number(cruiseEconomicsSummary.averages.pointsPerNight)} evidence="CALCULATED" />
              <Metric label="Est. play hours" value={`${number(cruiseEconomicsSummary.totals.totalHours)}h`} evidence={cruiseEconomicsSummary.totals.hasEstimates ? 'ESTIMATED' : 'ACTUAL'} detail="Points ÷ configured historical PPH when actual hours are unavailable" />
            </View>
            <Text style={styles.annualGroupTitle}>ROI-style summary</Text>
            <View style={styles.grid}>
              <Metric label="Paid % of retail" value={`${cruiseEconomicsSummary.roiStyle.paidAsPercentOfRetail.toFixed(2)}%`} evidence="CALCULATED" />
              <Metric label="Comp coverage" value={`${cruiseEconomicsSummary.roiStyle.compCoverage.toFixed(2)}%`} evidence="CALCULATED" />
              <Metric label="Retail-to-paid multiple" value={`${cruiseEconomicsSummary.roiStyle.retailToPaidMultiple.toFixed(2)}x`} evidence="CALCULATED" />
              <Metric label="Winnings multiple vs paid" value={`${cruiseEconomicsSummary.roiStyle.winningsMultipleVsPaid.toFixed(2)}x`} evidence="CALCULATED" />
              <Metric label="Net ROI on paid" value={`${cruiseEconomicsSummary.roiStyle.netRoiOnPaid.toFixed(2)}%`} evidence="CALCULATED" />
              <Metric label="Theo / net theoretical" value={`${money(cruiseEconomicsSummary.totals.totalTheoreticalLoss)} / ${money(cruiseEconomicsSummary.totals.totalNetTheoretical)}`} evidence={cruiseEconomicsSummary.totals.hasEstimates ? 'ESTIMATED' : 'CALCULATED'} />
            </View>
          </View></ProgressiveDisclosure> : <View style={styles.formulaCard} testID="casino-final-annual-host-summary-empty"><Text style={styles.formulaTitle}>Final annual casino summary</Text><Text style={styles.formulaCopy}>Import completed cruises casino history for this profile to display annual totals, averages, and ROI. Easy Seas will not show another user’s static casino totals on an empty profile.</Text></View>}
        </> : null}
        <ProgressiveDisclosure
          ownerId={casinoProfile?.id || currentUser?.id || 'local-default'}
          screenId="casino-command-center"
          sectionId={`${program}-points-reconciliation`}
          title="Points reconciliation"
          conclusions={[
            { id: 'provider', label: 'Provider/profile', value: number(syncedPoints), status: rawSyncedPoints == null ? 'missing' : 'info' },
            { id: 'attributed', label: 'Attributed', value: number(reconciliation.attributedCruisePoints), status: 'info' },
            { id: 'unallocated', label: 'Unallocated', value: number(reconciliation.unallocatedPoints), status: reconciliation.unallocatedPoints ? 'warning' : 'success' },
          ]}
          testID="casino-points-reconciliation-disclosure"
        >
          {program === 'club_royale' && isCurrentCasinoProfile && clubRoyaleSyncDiscrepancy.hasDiscrepancy ? <View style={styles.discrepancyCard}><Text style={styles.discrepancyTitle}>Points reconciliation needed</Text><Text style={styles.discrepancyText}>{number(clubRoyaleSyncDiscrepancy.appPoints)} cruise-ledger points vs {number(clubRoyaleSyncDiscrepancy.syncedPoints)} provider/profile points · difference {number(Math.abs(clubRoyaleSyncDiscrepancy.difference))}. The provider/profile balance remains the current total; closeouts identify posted, unposted, or incorrectly attributed cruises.{likelyUnpostedCruises.length ? ` Review cruise rows: ${likelyUnpostedCruises.join(', ')}.` : ''}</Text></View> : null}
          {chartsReady ? <DistributionBar title="Points reconciliation" segments={evidenceChart.map((row) => ({ label: row.label, value: row.value, color: row.color }))} footer="Synced is the provider balance; attributed points remain the sum of saved cruise truth records." /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Reconciliation visualization loads after navigation settles.</Text></View>}
          <View style={styles.grid}>
            <Metric label="Attributed to trips" value={number(reconciliation.attributedCruisePoints)} evidence="RECONCILED" detail={`${reconciliation.cruiseCount} trips in this earning year`} onPress={() => router.push('/casino/completed-sailings')} />
            <Metric label="Unallocated points" value={number(reconciliation.unallocatedPoints)} evidence={reconciliation.unallocatedPoints === 0 ? 'RECONCILED' : 'NEEDS REVIEW'} detail="Synced total minus cruise-attributed points" onPress={() => router.push('/data-health')} />
            <Metric label="Net gaming result" value={tripsWithNet ? money(totalNet) : '—'} evidence={tripsWithNet ? 'MIXED' : 'MISSING'} detail="Current earning year; cruise fare excluded" />
            <Metric label="Theoretical loss" value={tripsWithTheo ? money(totalTheo) : '—'} evidence={tripsWithTheo ? 'MIXED' : 'MISSING'} detail="Current earning year; recorded or labeled estimate" />
            <Metric label="Unlinked certificates" value={String(reconciliation.unlinkedCertificateCount)} evidence={reconciliation.unlinkedCertificateCount ? 'NEEDS REVIEW' : 'RECONCILED'} detail="Never merged by offer code alone" onPress={() => router.push('/casino/certificate-wallet')} />
            <Metric label="Data health" value={rawSyncedPoints == null || !Number.isFinite(Number(rawSyncedPoints)) ? 'Missing provider balance' : reconciliation.overAttributedPoints ? 'Over-attributed' : (reconciliation.unallocatedPoints ?? 0) > 0 ? 'Unallocated points' : 'Reconciled'} evidence={rawSyncedPoints == null || reconciliation.overAttributedPoints || (reconciliation.unallocatedPoints ?? 0) > 0 ? 'NEEDS REVIEW' : 'CHECKED'} detail={rawSyncedPoints == null ? 'Sync or enter the current program balance' : reconciliation.overAttributedPoints ? `${reconciliation.overAttributedPoints} cruise points exceed provider/profile total` : (reconciliation.unallocatedPoints ?? 0) > 0 ? `${reconciliation.unallocatedPoints} provider/profile points are not attached to cruises` : 'Provider/profile balance and attributed cruise points agree'} onPress={() => router.push('/data-health')} />
          </View>
        </ProgressiveDisclosure>
        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/casino/post-cruise-closeout')}><Plus color="#fff" size={20} /><Text style={styles.primaryActionText}>Add or reconcile a cruise result</Text></TouchableOpacity>
        <ThemedSectionHeader tab="casino" emoji="🚢" title="Cruise portfolio" subtitle="Every result shows its evidence source. Receipt uploads replace estimates with actual booking economics." compact testID="casino-cruise-portfolio-section" />
        {programTrips.length ? programTrips.slice(0, 12).map(renderTrip) : <View style={styles.empty}><Text style={styles.emptyTitle}>No {program === 'blue_chip' ? 'Blue Chip' : 'Club Royale'} casino cruises</Text><Text style={styles.emptyText}>Add a cruise closeout or import owner-scoped cruise data.</Text></View>}
        {programTrips.length > 12 ? <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/casino/completed-sailings')}><Ship color="#0d355a" size={20} /><Text style={styles.secondaryActionText}>View all {programTrips.length} casino cruises</Text></TouchableOpacity> : null}
      </> : null}

      {casinoDataReady && activeTab === 'charts' ? <>
        <ThemedSectionHeader tab="casino" emoji="📊" title="Casino charts" subtitle="Colorful comparisons use saved owner data only. Missing evidence remains blank." tone="info" compact testID="casino-charts-section" />
        <ProgressMeter label={nextTier ? `${tier} → ${nextTier} tier progression` : `${tier} retained`} value={tierProgress} caption={`${number(syncedPoints)} current points`} targetLabel={nextTier ? `${number(Math.max(0, (finiteDisplay(nextTierThreshold) ?? 0) - (finiteDisplay(syncedPoints) ?? 0)))} points remaining` : 'Complete'} color={casinoTierAccent(program, nextTier ?? tier)} />
        <ProgressMeter label="Casino data health" value={dashboard.dataCoverage} caption={`${dashboard.actualEvidenceCount} verified evidence fields`} targetLabel={`${dashboard.missingEvidenceCount} missing`} color={dashboard.dataCoverage >= 75 ? '#15956a' : '#d18b16'} />
        <DistributionBar title="Casino evidence composition" segments={evidenceComposition} footer="Counts of verified, estimated, and missing source fields. This is not an invented economic-health score." />
        {chartsReady && tierProgressionForecastChart.length ? <CasinoBarChart title={`Tier projection through ${resetDate || 'program reset'}`} rows={tierProgressionForecastChart} valueLabel={(value) => `${Math.round(value).toLocaleString()} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Tier projection needs a future reset date and booked cruises before that reset.</Text></View>}
        {chartsReady && pointsByTripChart.length ? <CasinoBarChart title="Points by cruise" rows={pointsByTripChart} valueLabel={(value) => `${value.toLocaleString()} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Add cruise points to create the progression chart.</Text></View>}
        {chartsReady && netByTripChart.length ? <CasinoBarChart title="Cash result by cruise" rows={netByTripChart} valueLabel={(value) => `${value >= 0 ? '+' : ''}${money(value)}`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Add cruise cash results to compare performance.</Text></View>}
        {chartsReady && shipComparisonChart.length ? <CasinoBarChart title="Ship comparison · points per night" rows={shipComparisonChart} valueLabel={(value) => `${number(value)} pts/night`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Ship comparison loads after navigation settles and needs cruise points.</Text></View>}
        {chartsReady && shipComparisonChart.length ? <CasinoBarChart title="Ship evidence confidence" rows={shipComparisonChart.map((row) => ({ label: row.label, value: row.confidence, color: row.confidence >= 70 ? '#15956a' : '#d18b16' }))} valueLabel={(value) => percent(value)} /> : null}
        {chartsReady && shipComparisonChart.length ? <Text style={styles.sectionSub}>Ship evidence confidence = 60% verified-field completeness + 20% sample size (three cruises) + 20% recency (within 12 months).</Text> : null}
        {chartsReady && seasonTrendChart.length ? <CasinoBarChart title={`${program === 'blue_chip' ? 'Blue Chip Aug-Jul' : 'Club Royale Apr-Mar'} attributed points by month`} rows={seasonTrendChart} valueLabel={(value) => `${Math.round(value).toLocaleString()} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Season trend loads only when cruise-attributed points exist.</Text></View>}
        <DistributionBar title="Annual value capture" segments={[
          { label: 'Paid', value: Math.max(0, cruiseEconomicsSummary.totals.totalPaid), color: '#3267c8' },
          { label: 'Comp captured', value: Math.max(0, cruiseEconomicsSummary.totals.totalCruiseValueCaptured), color: '#15956a' },
          { label: 'Winnings home', value: Math.max(0, cruiseEconomicsSummary.totals.totalWinningsHome), color: '#d8aa32' },
        ]} footer="Coin-in is wagering volume and is intentionally excluded from economic value." />
        <DistributionBar title="Evidence quality" segments={[
          { label: 'Actual', value: dashboard.actualEvidenceCount, color: '#15956a' },
          { label: 'Estimated', value: dashboard.estimatedEvidenceCount, color: '#d18b16' },
          { label: 'Missing', value: dashboard.missingEvidenceCount, color: '#d94b4b' },
        ]} footer="Import receipts and cruise closeouts to turn estimates into verified values." />
        <View style={styles.colorGrid}>
          <ColorMetric icon={PieChart} label="Comp coverage" value={`${cruiseEconomicsSummary.roiStyle.compCoverage.toFixed(1)}%`} detail="Retail value not paid out of pocket" color="#15956a" confidence="calculated" />
          <ColorMetric icon={TrendingUp} label="Economic value" value={money(cruiseEconomicsSummary.totals.totalEconomicValue)} detail="Retail + winnings − paid" color="#2474cc" confidence="calculated" />
          <ColorMetric icon={Gauge} label="Economic health" value={dashboard.offerSafetyIndex == null ? '—' : percent(dashboard.offerSafetyIndex)} detail="Coverage, sample size, points pace, and volatility" color="#8b5cf6" confidence={dashboard.offerSafetyIndex == null ? 'missing' : 'derived'} />
          <ColorMetric icon={LineChart} label="Points / night" value={dashboard.averagePointsPerNight == null ? '—' : number(dashboard.averagePointsPerNight)} detail="Cruise points divided by itinerary days" color="#d18b16" confidence={dashboard.tripsWithPoints ? 'calculated' : 'missing'} />
        </View>
      </> : null}

      {casinoDataReady && activeTab === 'session' ? <>
        <ThemedSectionHeader tab="casino" emoji="⏱️" title="Cruise-derived play" subtitle="Final points, win/loss, itinerary days, and availability produce each sailing estimate." tone="casino" compact testID="casino-play-section" />
        <ProgressiveDisclosure
          ownerId={casinoProfile?.id || currentUser?.id || 'local-default'}
          screenId="casino-command-center"
          sectionId={`${program}-play-assumptions`}
          title="Cruise-play assumptions"
          conclusions={[
            { id: 'available', label: 'Casino available', value: dashboard.totalCasinoAvailabilityHours == null ? 'Missing' : `${number(dashboard.totalCasinoAvailabilityHours)}h`, status: dashboard.availabilityConfidence === 'missing' ? 'missing' : 'info' },
            { id: 'hours', label: 'Play estimate', value: dashboard.estimatedHours == null ? 'Missing' : `${number(dashboard.estimatedHours)}h`, status: dashboard.estimatedHours == null ? 'missing' : 'estimated' },
            { id: 'pph', label: 'Modeled PPH', value: dashboard.modeledPointsPerEstimatedHour == null ? 'Missing' : number(dashboard.modeledPointsPerEstimatedHour), status: dashboard.modeledPointsPerEstimatedHour == null ? 'missing' : 'estimated' },
          ]}
          testID="casino-play-assumptions-disclosure"
        >
          <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Cruise-level calculation</Text><Text style={styles.formulaCopy}>For each cruise: casino availability comes from itinerary/open-day records, estimated play hours = final points ÷ configured historical PPH, modeled coin-in = Club Royale points × $5 when slot points are confirmed, theoretical = coin-in × hold, and ADT = theoretical ÷ casino-available/rated days.</Text></View>
          <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Optional actual session logs</Text><Text style={styles.formulaCopy}>If you ever enter timed sessions, Easy Seas shows them separately below. Cruise-level points and win/loss remain the normal source for your casino history.</Text></View>
        </ProgressiveDisclosure>
        <ProgressMeter label="Modeled PPH target" value={dashboard.modeledPointsPerEstimatedHour != null ? (dashboard.modeledPointsPerEstimatedHour / Math.max(1, settings.defaultPointsPerHour)) * 100 : 0} caption={dashboard.modeledPointsPerEstimatedHour != null ? `${number(dashboard.modeledPointsPerEstimatedHour)} modeled PPH` : 'Add cruise points to model play hours'} targetLabel={`${settings.defaultPointsPerHour} PPH assumption`} color="#6d55d9" />
        {chartsReady && cruisePlayHoursChart.length ? <CasinoBarChart title="Cruise-derived play hours" rows={cruisePlayHoursChart} valueLabel={(value) => `${number(value)}h`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>{chartsReady ? 'Add final cruise points to build the play-hours chart.' : 'Play chart loads after navigation settles.'}</Text></View>}
        {chartsReady && cruiseAvailabilityChart.length ? <CasinoBarChart title="Casino availability hours by cruise" rows={cruiseAvailabilityChart} valueLabel={(value) => `${number(value)}h`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>{chartsReady ? 'Save itinerary or casino-open days to display availability by cruise.' : 'Availability chart loads after navigation settles.'}</Text></View>}
        <View style={styles.colorGrid}>
          <ColorMetric icon={Timer} label="Casino availability" value={dashboard.totalCasinoAvailabilityHours == null ? '—' : `${number(dashboard.totalCasinoAvailabilityHours)}h`} detail={`${formatCount(dashboard.casinoAvailableDays, 'casino-available day')} from current-season cruises`} color="#0b766d" confidence={dashboard.availabilityConfidence} />
          <ColorMetric icon={Timer} label="Estimated play hours" value={dashboard.estimatedHours == null ? '—' : `${number(dashboard.estimatedHours)}h`} detail="Final cruise points divided by the saved PPH assumption" color="#d18b16" confidence={dashboard.estimatedHours == null ? 'missing' : 'estimated'} />
          <ColorMetric icon={Coins} label="Modeled coin-in / play hour" value={money(dashboard.coinInPerEstimatedHour)} detail="Club Royale modeled coin-in divided by estimated play hours" color="#2474cc" confidence={dashboard.coinInPerEstimatedHour == null ? 'missing' : 'estimated'} />
          <ColorMetric icon={Target} label="Modeled theo / play hour" value={money(dashboard.theoPerEstimatedHour)} detail="Estimated theoretical loss divided by estimated play hours" color="#8b4aac" confidence={dashboard.theoPerEstimatedHour == null ? 'missing' : 'estimated'} />
          <ColorMetric icon={Gauge} label="Modeled ADT" value={money(dashboard.adt)} detail={`${formatCount(dashboard.ratedGamingDays, 'rated/available day')}; explicit days take precedence when entered`} color="#d18b16" confidence={dashboard.adtConfidence} />
          <ColorMetric icon={Activity} label="Actual sessions saved" value={String(sessionAnalytics.actualSessionCount)} detail="Optional session logs; not required for the casino calculations" color="#3267c8" confidence={sessionAnalytics.actualSessionCount ? 'actual' : 'missing'} />
        </View>
        <View style={styles.periodRow}>{(['today', 'week', 'month', 'all'] as SessionPeriod[]).map((period) => <TouchableOpacity key={period} style={[styles.periodButton, sessionPeriod === period && styles.periodButtonActive]} onPress={() => setSessionPeriod(period)}><Text style={[styles.periodText, sessionPeriod === period && styles.periodTextActive]}>{period === 'all' ? 'All time' : period[0].toUpperCase() + period.slice(1)}</Text></TouchableOpacity>)}</View>
        {chartsReady && sessionPointChart.length ? <CasinoBarChart title="Optional actual sessions · Points by recent session" rows={sessionPointChart} valueLabel={(value) => `${number(value)} pts`} /> : null}
        <View style={styles.streakCard}><View><Text style={styles.streakTitle}>Optional session streaks</Text><Text style={styles.streakDetail}>Only actual timed sessions, when saved</Text></View><View style={styles.streakValues}><Text style={styles.winStreak}>▲ {sessionAnalytics.streakData.longestWinStreak} wins</Text><Text style={styles.lossStreak}>▼ {sessionAnalytics.streakData.longestLossStreak} losses</Text></View></View>
        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/casino/onboard-mode')}><Activity color="#fff" size={20} /><Text style={styles.primaryActionText}>Start onboard casino mode</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/casino/post-cruise-closeout')}><Plus color="#0d355a" size={20} /><Text style={styles.secondaryActionText}>Add cruise-level result</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/casino-sessions')} testID="casino-review-session-history"><Timer color="#0d355a" size={20} /><Text style={styles.secondaryActionText}>Review actual session history</Text></TouchableOpacity>
      </> : null}

      {casinoDataReady && activeTab === 'calcs' ? <>
        <ThemedSectionHeader tab="casino" emoji="🧮" title="Casino calculations" subtitle="Every result states whether its inputs are actual, mixed, estimated, or missing." tone="info" compact testID="casino-calculations-section" />
        <ProgressiveDisclosure
          ownerId={casinoProfile?.id || currentUser?.id || 'local-default'}
          screenId="casino-command-center"
          sectionId={`${program}-calculation-guardrails`}
          title="Calculation guardrails"
          conclusions={[
            { id: 'coin-in', label: 'Coin-in volume', value: money(dashboard.totalCoinIn), status: dashboard.coinInConfidence === 'missing' ? 'missing' : 'info' },
            { id: 'theo', label: 'Theoretical', value: money(dashboard.totalTheo), status: dashboard.theoConfidence === 'missing' ? 'missing' : 'estimated' },
            { id: 'adt', label: 'Modeled ADT', value: money(dashboard.adt), status: dashboard.adtConfidence === 'missing' ? 'missing' : 'estimated' },
          ]}
          testID="casino-calculation-guardrails-disclosure"
        >
          <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Formula guardrails</Text><Text style={styles.formulaCopy}>Cash result = cash-out + separately paid jackpots − cash-in. Coin-in uses actual coin-in when supplied; Club Royale slots may derive coin-in as qualifying points × $5, while Blue Chip, table, poker, and unknown play require explicit coin-in. Theo = explicit theo, else valid coin-in × configured house edge. ADT = theo ÷ rated/available gaming days. Comp coverage = cruise value captured ÷ retail value. Cash ROI = gaming cash result ÷ effective amount paid. Certificate-created value uses the saved earned award value once; certificate point thresholds and mutually exclusive future sailings remain estimates and are never summed.</Text></View>
          <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Risk and historical stability rules</Text><Text style={styles.formulaCopy}>Risk per modeled play hour is theoretical loss ÷ estimated play hours, not a bankroll or stop-loss placeholder. Historical stability summarizes past evidence quality and variance; it does not predict a cruise-line offer.</Text></View>
          <View style={styles.formulaCard} testID="casino-recovery-governance-status"><Text style={styles.formulaTitle}>Recovery, backup, and marketing-governance status</Text><Text style={styles.formulaCopy}>{recoveryStatus.total} remaining recovery requirements are registered: {recoveryStatus.counts.active} active, {recoveryStatus.counts.guarded} guarded, {recoveryStatus.counts.test_required} regression-gated, and {recoveryStatus.counts.operator_source_required} operator-only. Operator-only fields display “{OPERATOR_SOURCE_REQUIRED}” and are never fabricated from personal app data.</Text></View>
        </ProgressiveDisclosure>
        <View style={styles.colorGrid}>
          <ColorMetric icon={Coins} label="Coin-in volume" value={money(dashboard.totalCoinIn)} detail={program === 'club_royale' ? 'Actual coin-in, or eligible slot points × $5 estimate' : 'Requires explicit Blue Chip coin-in'} color="#2474cc" confidence={dashboard.coinInConfidence} />
          <ColorMetric icon={Target} label="Theoretical loss" value={money(dashboard.totalTheo)} detail="Recorded theo, else coin-in × configured house edge" color="#8b4aac" confidence={dashboard.theoConfidence} />
          <ColorMetric icon={Calculator} label="Modeled point value after theo" value={money(netTheoretical)} detail="Configured point value earned minus modeled/recorded theoretical loss; not casino cash result" color={(netTheoretical ?? 0) >= 0 ? '#15956a' : '#d94b4b'} confidence={netTheoretical == null ? 'missing' : dashboard.theoConfidence} />
          <ColorMetric icon={Ticket} label="Certificate-created value" value={money(dashboard.totalCertificateCreatedValue)} detail="Earned certificate value linked to these cruise identities; counted once" color="#D87924" confidence={dashboard.certificateCreatedValueConfidence} />
          <ColorMetric icon={Gauge} label="Average daily theo" value={money(dashboard.adt)} detail={dashboard.ratedGamingDays ? `${formatCount(dashboard.ratedGamingDays, 'rated/available gaming day')}; ${dashboard.explicitRatedGamingDays} explicit, ${dashboard.estimatedRatedGamingDays} estimated` : 'Requires explicit or itinerary-derived casino-available days'} color="#d18b16" confidence={dashboard.adtConfidence} />
          <ColorMetric icon={Zap} label="Modeled points per play hour" value={dashboard.modeledPointsPerEstimatedHour == null ? '—' : number(dashboard.modeledPointsPerEstimatedHour)} detail={`${number(dashboard.totalPoints)} points ÷ ${number(dashboard.estimatedHours)} estimated hours`} color="#6d55d9" confidence={dashboard.modeledPointsPerEstimatedHour == null ? 'missing' : 'estimated'} />
          <ColorMetric icon={TrendingUp} label="Value per modeled play hour" value={dashboard.estimatedHours && dashboard.estimatedHours > 0 ? money(currentSeasonEconomicValue / dashboard.estimatedHours) : '—'} detail="Current-season economic value ÷ estimated play hours; coin-in excluded" color="#15956a" confidence={dashboard.estimatedHours ? 'estimated' : 'missing'} />
          <ColorMetric icon={WalletCards} label="Value per casino cruise" value={currentSeasonTrips.length > 0 ? money(currentSeasonEconomicValue / currentSeasonTrips.length) : '—'} detail="Current-season economic value ÷ current-season casino cruises" color="#0b766d" confidence={currentSeasonTrips.length ? 'calculated' : 'missing'} />
          <ColorMetric icon={Activity} label="Theo risk per modeled play hour" value={dashboard.theoPerEstimatedHour != null ? money(dashboard.theoPerEstimatedHour) : '—'} detail="Current-season theoretical loss ÷ estimated play hours; not a stop-loss guess" color="#d94b4b" confidence={dashboard.theoPerEstimatedHour != null ? dashboard.theoConfidence : 'missing'} />
          <ColorMetric icon={LineChart} label="Result versus expected loss" value={money(dashboard.theoVariance)} detail={dashboard.theoVariancePercent == null ? 'Needs theoretical loss and gaming cash result' : `${percent(Math.abs(dashboard.theoVariancePercent), 1)} ${(dashboard.theoVariance ?? 0) >= 0 ? 'ahead of' : 'behind'} the modeled expected-loss outcome`} color={(dashboard.theoVariance ?? 0) >= 0 ? '#15956a' : '#d94b4b'} confidence={dashboard.theoVariance == null ? 'missing' : 'calculated'} />
          <ColorMetric icon={ShieldCheck} label="Historical play-data stability" value={dashboard.offerSafetyIndex == null ? '—' : percent(dashboard.offerSafetyIndex)} detail="Historical coverage, sample size, pace, and result volatility; not an offer prediction" color="#3267c8" confidence={dashboard.offerSafetyIndex == null ? 'missing' : 'derived'} />
          <ColorMetric icon={BarChart3} label="Sustainability" value={dashboard.sustainabilityScore == null ? '—' : percent(dashboard.sustainabilityScore)} detail="Evidence coverage and consistency; not an offer guarantee" color="#15956a" confidence={dashboard.sustainabilityScore == null ? 'missing' : 'derived'} />
          <ColorMetric icon={Brain} label="Median cash result" value={money(dashboard.medianResult)} detail={`Best ${money(dashboard.bestResult)} · worst ${money(dashboard.worstResult)}`} color="#6d55d9" confidence={dashboard.medianResult == null ? 'missing' : 'calculated'} />
        </View>
        <ProgressMeter label="Sustainability score" value={dashboard.sustainabilityScore ?? 0} caption="Consistency and evidence coverage" targetLabel={dashboard.sustainabilityScore == null ? 'More cruise data needed' : dashboard.sustainabilityScore >= 70 ? 'Stable evidence pattern' : 'Improve data coverage'} color="#15956a" />
        <ThemedSectionHeader tab="casino" emoji="🧠" title="Strategy & tools" subtitle="Planning tools never present estimates as actual casino results." tone="success" compact testID="casino-strategy-tools-section" />
        {[
          { icon: Brain, title: 'Easy Seas operating center', detail: 'Open all 25 personalized and casino intelligence capabilities from one searchable workspace.', route: '/operating-center', testID: 'casino-operating-center' },
          { icon: Gauge, title: 'Relationship intelligence', detail: 'Tier pace, player worth, ROI, offer response, and trip intelligence.', route: '/casino/relationship-intelligence' },
          { icon: Activity, title: 'Current-trip comp pace', detail: 'Compare actual, reported, and estimated value during a cruise.', route: '/casino/current-trip-comp-pace' },
          { icon: Timer, title: 'Casino sessions', detail: 'Review optional timed sessions and their actual points, coin-in, and cash results.', route: '/casino-sessions', testID: 'casino-session-history-tool' },
          { icon: Calculator, title: 'Value scenarios', detail: 'Model theo, ADT, comps, and cruise value.', route: '/casino/value-scenarios' },
          { icon: ShieldCheck, title: 'Post-cruise closeout', detail: 'Record points, win/loss, certificate, hours, and source.', route: '/casino/post-cruise-closeout' },
          { icon: Ship, title: 'Ship intelligence', detail: 'Review ship casino observations and performance.', route: '/casino/ship-performance', testID: 'casino-ship-intelligence-tab' },
          { icon: Ticket, title: 'Ship observations', detail: 'Review locally saved machines, locations, conditions, and notes.', route: '/casino/ship-observations' },
          { icon: WalletCards, title: 'Certificate wallet', detail: 'Review earned, used, unused, and expired casino certificates.', route: '/casino/certificate-wallet' },
          { icon: WalletCards, title: 'Benefits ledger', detail: 'Review FreePlay, OBC, annual cruise, and other captured benefits.', route: '/casino/benefits-ledger' },
          { icon: WalletCards, title: 'Future value wallet', detail: 'Review FCC, NextCruise, annual-cruise, milestone, and expiring value.', route: '/casino/future-value-wallet' },
          { icon: CheckSquare, title: 'Completed sailings', detail: 'Filter, inspect, and export completed casino cruise results.', route: '/casino/completed-sailings' },
          { icon: FileText, title: 'Host report', detail: 'Export a source-labeled casino relationship brief.', route: '/casino/export-report' },
          { icon: FileCheck2, title: 'Host meeting brief', detail: 'Prepare a concise, redactable evidence brief for a host meeting.', route: '/casino/host-meeting-brief' },
          { icon: FileUp, title: 'Royal receipt importer', detail: 'Attach a Cruise Vacation Receipt to a specific booking and verify its offer code and actual value.', route: '/casino/invoice-import' },
          { icon: ContactRound, title: 'Host CRM', detail: 'Track host contacts, promises, outcomes, and follow-ups.', route: '/casino/host-crm' },
          { icon: Bell, title: 'Optimization alerts', detail: 'Review profile-scoped certificate and value alerts.', route: '/casino/personal-optimization-alerts' },
          { icon: TrendingUp, title: 'Optimizer accuracy', detail: 'Review target accuracy, calibration, Brier score, and EV error.', route: '/casino/optimization-accuracy' },
          { icon: Gauge, title: 'Loyalty data', detail: 'Inspect tier balances, progress, source integrity, and sync status.', route: '/casino/loyalty-data' },
          { icon: FileText, title: 'Formula reference', detail: 'Review the formulas, assumptions, and duplicate-counting rules.', route: '/casino/formula-reference' },
          { icon: CheckSquare, title: 'Casino checklist', detail: 'Resolve missing results and upcoming casino tasks.', route: '/casino/checklist' },
          { icon: Settings, title: 'Casino settings', detail: 'Control evidence views and calculation assumptions.', route: '/casino/settings' },
          { icon: TrendingUp, title: 'Data health', detail: 'Find missing, estimated, duplicated, and unallocated records.', route: '/data-health' },
        ].map((tool) => <TouchableOpacity key={tool.title} testID={tool.testID} style={styles.tool} onPress={() => router.push(tool.route as never)}><View style={styles.toolIcon}><tool.icon size={21} color="#0b766d" /></View><View style={styles.toolText}><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolDetail}>{tool.detail}</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>)}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F3F2' },
  identityShell: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingTop: 10 },
  header: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D5D0' },
  actionHeader: { justifyContent: 'flex-end', paddingTop: 0, paddingBottom: 10 },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  eyebrow: { color: '#0E7FA7', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#0F2247', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 22, fontWeight: '600', marginTop: 3, flexShrink: 1 },
  askButton: { minHeight: 44, maxWidth: 118, flexShrink: 0, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#123D73', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14 },
  askText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  programRow: { backgroundColor: '#FFFFFF', flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  programButton: { flex: 1, minHeight: 44, borderColor: '#D5D5D0', backgroundColor: '#F5F5F4', borderWidth: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  programActive: { backgroundColor: '#0F2247', borderColor: '#0F2247' },
  programText: { color: '#58585B', fontWeight: '800' },
  programTextActive: { color: '#FFFFFF' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D5D0' },
  tab: { flex: 1, minHeight: 44, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0E7FA7' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#8E8A89' },
  tabTextActive: { color: '#0F2247', fontWeight: '900' },
  periodRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  periodButton: { flex: 1, minHeight: 44, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#D5D5D0', alignItems: 'center', justifyContent: 'center' },
  periodButtonActive: { backgroundColor: '#0E7FA7', borderColor: '#0E7FA7' },
  periodText: { color: '#58585B', fontSize: 12, fontWeight: '800' },
  periodTextActive: { color: '#fff' },
  processingBanner: { backgroundColor: '#F3F3F2', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D5D5D0', paddingHorizontal: 14, paddingVertical: 7 },
  processingText: { color: '#58585B', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  hydrationCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#D5D5D0', flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: '#0F2247', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  hydrationCopy: { flex: 1, minWidth: 0 },
  hydrationTitle: { color: '#0F2247', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18, fontWeight: '600' },
  hydrationText: { color: '#58585B', fontSize: 11, lineHeight: 16, marginTop: 4 },
  scroll: { flex: 1 }, content: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 14, paddingBottom: 110 },
  statusCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#D5D5D0', borderLeftWidth: 5, shadowColor: '#0F2247', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTier: { color: '#0F2247', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 28, fontWeight: '600', flexShrink: 1 }, statusSub: { color: '#58585B', marginTop: 3, fontSize: 12, flexShrink: 1 },
  statusPoints: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '46%', minWidth: 96 }, statusPointsValue: { fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 28, fontWeight: '600' }, statusPointsLabel: { color: '#8E8A89', fontSize: 11, textAlign: 'right' },
  resetNote: { color: '#445b68', marginVertical: 10, fontSize: 12, lineHeight: 17 },
  discrepancyCard: { backgroundColor: '#fff3d6', borderColor: '#d8aa32', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  discrepancyTitle: { color: '#6d4b00', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  discrepancyText: { color: '#553e13', fontSize: 11, lineHeight: 16, marginTop: 4, fontWeight: '700' },
  chart: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#d6e3e7' },
  chartTitle: { color: '#092b43', fontSize: 14, fontWeight: '900', marginBottom: 10 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  chartLabel: { width: 88, color: '#536a78', fontSize: 10, fontWeight: '700' },
  chartTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#e7eff1', overflow: 'hidden' },
  chartBar: { height: 10, borderRadius: 5 },
  chartValue: { width: 76, color: '#17354a', fontSize: 10, fontWeight: '900', textAlign: 'right' },
  chartPlaceholder: { backgroundColor: '#e7eff1', borderRadius: 14, minHeight: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 12, padding: 12 },
  chartPlaceholderText: { color: '#667987', fontSize: 10, fontWeight: '700' },
  progressCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#d6e3e7' },
  progressLabel: { color: '#17354a', fontSize: 14, fontWeight: '900', flex: 1, minWidth: 0, paddingRight: 8 },
  progressPercent: { fontSize: 17, fontWeight: '900', flexShrink: 0, textAlign: 'right' },
  progressTrack: { height: 12, borderRadius: 7, backgroundColor: '#e6eef1', overflow: 'hidden', marginVertical: 9 },
  progressFill: { height: 12, borderRadius: 7 },
  progressCaption: { color: '#667987', fontSize: 10, fontWeight: '700', flex: 1, minWidth: 0, paddingRight: 8 },
  progressTarget: { color: '#17354a', fontSize: 10, fontWeight: '900', textAlign: 'right', flexShrink: 1, maxWidth: '44%' },
  colorGrid: { gap: 10, marginBottom: 12 },
  colorMetric: { backgroundColor: '#fff', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#d8e4e8', borderTopWidth: 4, flexDirection: 'row', gap: 11 },
  colorMetricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  colorMetricContent: { flex: 1 },
  colorMetricLabel: { color: '#4a5e6d', fontSize: 12, fontWeight: '900', flex: 1 },
  colorMetricValue: { fontSize: 25, fontWeight: '900', marginTop: 5 },
  colorMetricDetail: { color: '#667987', fontSize: 10, lineHeight: 14, marginTop: 4 },
  confidencePill: { fontSize: 8, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, overflow: 'hidden' },
  distributionCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#d6e3e7' },
  distributionTrack: { flexDirection: 'row', height: 16, borderRadius: 8, backgroundColor: '#e7eff1', overflow: 'hidden', marginBottom: 10 },
  distributionLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#536a78', fontSize: 9, fontWeight: '800' },
  chartFootnote: { color: '#667987', fontSize: 9, lineHeight: 13, marginTop: 8 },
  annualSummaryCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginTop: 16, marginBottom: 12, borderWidth: 1, borderColor: '#D5D5D0', borderTopWidth: 4, borderTopColor: '#E6B63D' },
  annualEyebrow: { color: '#0E7FA7', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  annualTitle: { color: '#0F2247', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 20, fontWeight: '600', marginTop: 4 },
  annualCopy: { color: '#58585B', fontSize: 11, lineHeight: 16, marginTop: 6, marginBottom: 8 },
  annualGroupTitle: { color: '#123D73', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  formulaCard: { backgroundColor: '#F5F5F4', borderRadius: 15, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#D5D5D0' },
  formulaTitle: { color: '#123D73', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 16, fontWeight: '600' },
  formulaCopy: { color: '#58585B', fontSize: 11, lineHeight: 16, marginTop: 6, fontWeight: '700' },
  sectionSpacing: { marginTop: 18 },
  streakCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, borderWidth: 1, borderColor: '#d6e3e7', marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  streakTitle: { color: '#17354a', fontSize: 15, fontWeight: '900' },
  streakDetail: { color: '#667987', fontSize: 10, marginTop: 3 },
  streakValues: { alignItems: 'flex-end', gap: 4 },
  winStreak: { color: '#15956a', fontWeight: '900', fontSize: 11 },
  lossStreak: { color: '#d94b4b', fontWeight: '900', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { backgroundColor: '#fff', borderRadius: 14, padding: 13, width: '48%', minHeight: 116, borderWidth: 1, borderColor: '#d8e4e8' },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 }, metricLabel: { color: '#4a5e6d', fontSize: 12, fontWeight: '800', flex: 1 },
  evidence: { color: '#08786c', fontSize: 8, fontWeight: '900', backgroundColor: '#daf2ed', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 3, overflow: 'hidden' }, missing: { color: '#9b4a34', backgroundColor: '#ffe2d8' },
  metricValue: { color: '#081f38', fontSize: 24, fontWeight: '900', marginTop: 9 }, metricDetail: { color: '#667987', fontSize: 10, lineHeight: 14, marginTop: 5 }, metricDrill: { color: '#0b766d', fontSize: 10, fontWeight: '900', marginTop: 7 },
  primaryAction: { backgroundColor: '#0b766d', borderRadius: 13, padding: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryActionText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryAction: { backgroundColor: '#fff', borderColor: '#b8cbd3', borderWidth: 1, borderRadius: 13, padding: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryActionText: { color: '#0d355a', fontWeight: '900', fontSize: 15 },
  sectionHeader: { marginBottom: 10 }, sectionTitle: { color: '#0F2247', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 23, fontWeight: '600' }, sectionSub: { color: '#58585B', fontSize: 13, lineHeight: 18, marginTop: 3, marginBottom: 10 },
  tripCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 11, borderWidth: 1, borderColor: '#D5D5D0' }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, minWidth: 0 }, tripTitleWrap: { flex: 1 }, tripShip: { color: '#0F2247', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 19, fontWeight: '600' }, tripDate: { color: '#8E8A89', fontSize: 11, marginTop: 3 }, pointsPill: { backgroundColor: '#F3F3F2', color: '#2C1D9A', fontWeight: '900', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden', alignSelf: 'flex-start' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dfe8eb', gap: 10 }, lineLabel: { color: '#586c78', fontSize: 12 }, lineValue: { color: '#17354a', fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 }, formula: { color: '#5b6f7b', fontSize: 10, lineHeight: 15, marginTop: 8 }, warning: { color: '#9a5019', fontSize: 10, lineHeight: 14, marginTop: 5 },
  invoiceMissing: { backgroundColor: '#fff3d6', borderRadius: 9, padding: 9, marginTop: 9 }, invoiceVerified: { backgroundColor: '#dff3ef', borderRadius: 9, padding: 9, marginTop: 9 }, invoiceStatus: { color: '#17354a', fontSize: 9, fontWeight: '900' }, invoiceButton: { borderWidth: 1, borderColor: '#92cfc5', borderRadius: 10, padding: 10, marginTop: 8, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, invoiceButtonText: { color: '#0b766d', fontWeight: '900', fontSize: 11 },
  empty: { backgroundColor: '#fff', padding: 24, borderRadius: 15, alignItems: 'center' }, emptyTitle: { color: '#15384d', fontWeight: '900', fontSize: 16 }, emptyText: { color: '#687d89', textAlign: 'center', marginTop: 6 },
  tool: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7e4e7', borderRadius: 14, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 11 }, toolIcon: { backgroundColor: '#dcf2ee', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, toolText: { flex: 1 }, toolTitle: { color: '#0b2d44', fontWeight: '900', fontSize: 15 }, toolDetail: { color: '#677b87', fontSize: 11, lineHeight: 15, marginTop: 2 }, chevron: { fontSize: 27, color: '#7c919d' },
});
