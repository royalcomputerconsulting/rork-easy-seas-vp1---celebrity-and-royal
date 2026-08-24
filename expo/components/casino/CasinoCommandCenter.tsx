import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { CLUB_ROYALE_TIERS, TIER_ORDER } from '@/constants/clubRoyaleTiers';
import { buildCasinoRecoveryStatusSummary, OPERATOR_SOURCE_REQUIRED } from '@/lib/casino/casinoRecoveryRequirements';

type CasinoTab = 'intelligence' | 'charts' | 'session' | 'calcs';

const TABS: Array<{ id: CasinoTab; label: string }> = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'charts', label: 'Charts' },
  { id: 'session', label: 'Session' },
  { id: 'calcs', label: 'Calcs' },
];

const money = (value: number | null) => value == null ? '—' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const exactMoney = (value: number | null) => value == null ? '—' : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value: number | null) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const sourceLabel = (kind: string) => {
  if (kind === 'actual' || kind === 'user_entered') return 'ACTUAL';
  if (kind === 'provider_reported') return 'SYNCED';
  if (kind === 'estimated') return 'ESTIMATED';
  if (kind === 'missing') return 'UNAVAILABLE';
  return kind.replace('_', ' ').toUpperCase();
};
const percent = (value: number | null, digits = 0) => value == null ? '—' : `${value.toFixed(digits)}%`;
const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const CASINO_TRUTH_BATCH_SIZE = 125;

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

function Metric({ label, value, evidence, detail }: { label: string; value: string; evidence: string; detail?: string }) {
  return <View style={styles.metric}>
    <View style={styles.metricHeader}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.evidence, evidence === 'MISSING' && styles.missing]}>{evidence}</Text></View>
    <Text style={styles.metricValue}>{value}</Text>
    {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
  </View>;
}

function EvidenceLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={styles.lineValue}>{value}</Text></View>;
}

function CasinoBarChart({ title, rows, valueLabel }: { title: string; rows: Array<{ label: string; value: number; color?: string }>; valueLabel: (value: number) => string }) {
  const visible = rows.filter((row) => Number.isFinite(row.value)).slice(0, 8);
  const max = Math.max(1, ...visible.map((row) => Math.abs(row.value)));
  return <View style={styles.chart} accessibilityLabel={title}>
    <Text style={styles.chartTitle}>{title}</Text>
    {visible.map((row) => <View key={`${row.label}-${row.value}`} style={styles.chartRow}>
      <Text style={styles.chartLabel} numberOfLines={1}>{row.label}</Text>
      <View style={styles.chartTrack}><View style={[styles.chartBar, { width: `${Math.max(2, Math.abs(row.value) / max * 100)}%`, backgroundColor: row.color ?? '#0b766d' }]} /></View>
      <Text style={styles.chartValue}>{valueLabel(row.value)}</Text>
    </View>)}
  </View>;
}

function ProgressMeter({ label, value, caption, color = '#0b766d', targetLabel }: { label: string; value: number; caption: string; color?: string; targetLabel?: string }) {
  const safeValue = clampPercent(value);
  return <View style={styles.progressCard} accessibilityLabel={`${label} ${safeValue.toFixed(0)} percent`}>
    <View style={styles.rowBetween}><Text style={styles.progressLabel}>{label}</Text><Text style={[styles.progressPercent, { color }]}>{safeValue.toFixed(0)}%</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${safeValue}%`, backgroundColor: color }]} /></View>
    <View style={styles.rowBetween}><Text style={styles.progressCaption}>{caption}</Text>{targetLabel ? <Text style={styles.progressTarget}>{targetLabel}</Text> : null}</View>
  </View>;
}

function ColorMetric({ icon: Icon, label, value, detail, color, confidence }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; detail: string; color: string; confidence?: string }) {
  return <View style={[styles.colorMetric, { borderTopColor: color }]}>
    <View style={[styles.colorMetricIcon, { backgroundColor: `${color}1f` }]}><Icon size={19} color={color} /></View>
    <View style={styles.colorMetricContent}>
      <View style={styles.rowBetween}><Text style={styles.colorMetricLabel}>{label}</Text>{confidence ? <Text style={[styles.confidencePill, { color, backgroundColor: `${color}18` }]}>{confidence.toUpperCase()}</Text> : null}</View>
      <Text style={[styles.colorMetricValue, { color }]}>{value}</Text>
      <Text style={styles.colorMetricDetail}>{detail}</Text>
    </View>
  </View>;
}

function DistributionBar({ title, segments, footer }: { title: string; segments: Array<{ label: string; value: number; color: string }>; footer?: string }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  return <View style={styles.distributionCard}>
    <Text style={styles.chartTitle}>{title}</Text>
    <View style={styles.distributionTrack}>{segments.map((segment) => {
      const width = total > 0 ? (Math.max(0, segment.value) / total) * 100 : 0;
      return width > 0 ? <View key={segment.label} style={{ width: `${width}%`, backgroundColor: segment.color }} /> : null;
    })}</View>
    <View style={styles.distributionLegend}>{segments.map((segment) => <View key={segment.label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: segment.color }]} /><Text style={styles.legendText}>{segment.label} {segment.value.toLocaleString()}</Text></View>)}</View>
    {footer ? <Text style={styles.chartFootnote}>{footer}</Text> : null}
  </View>;
}

export default function CasinoCommandCenter() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { bookedCruises, cruiseEconomicsSummary, allCruiseEconomicsSummary } = useCasinoEconomicsData();
  const { clubRoyalePoints, clubRoyaleTier, clubRoyalePointsSource, clubRoyaleNextResetDate, clubRoyaleSyncDiscrepancy, blueChip } = useLoyalty();
  const casinoSessionState = useCasinoSessions();
  const sessions = Array.isArray(casinoSessionState?.sessions) ? casinoSessionState.sessions : [];
  const getSessionAnalytics = casinoSessionState.getSessionAnalytics;
  const certificateState = useCertificates();
  const searchableCertificates = Array.isArray(certificateState?.searchableCertificates) ? certificateState.searchableCertificates : [];
  const { settings, selectedProgram: program, setSelectedProgram } = useCasinoSettings();
  const [activeTab, setActiveTab] = useState<CasinoTab>('intelligence');
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(false);
    const task = InteractionManager.runAfterInteractions(() => setChartsReady(true));
    return () => task.cancel();
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
  const rawSyncedPoints = program === 'blue_chip' ? blueChip?.points : clubRoyalePoints;
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
  const sessionAnalytics = useMemo(() => getSessionAnalytics({ program, includeUnprogrammedSessionIds: inferredProgramSessionIds }), [getSessionAnalytics, inferredProgramSessionIds, program, sessions]);
  const tier = program === 'blue_chip' ? (blueChip?.tier ?? 'Pearl') : (clubRoyaleTier ?? 'Choice');
  const currentSeason = useMemo(() => getCasinoProgramSeason(program), [program]);
  const currentSeasonTrips = useMemo(() => programTrips.filter((trip) => isDateInCasinoSeason(trip.sailDate, currentSeason)), [currentSeason, programTrips]);
  const resetDate = program === 'blue_chip'
    ? blueChip?.nextResetDate
    : clubRoyaleNextResetDate instanceof Date ? clubRoyaleNextResetDate.toISOString().slice(0, 10) : String(clubRoyaleNextResetDate ?? '');
  const pointSource = program === 'blue_chip' ? 'SYNC/PROFILE' : String(clubRoyalePointsSource ?? 'app').toUpperCase();

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
  const economicsByCruise = useMemo(() => new Map(allCruiseEconomicsSummary.rows.map((row) => [row.cruiseId, row])), [allCruiseEconomicsSummary.rows]);
  const cruiseById = useMemo(() => new Map(bookedCruises.map((cruise) => [cruise.id, cruise])), [bookedCruises]);
  const dashboard = useMemo(() => buildCasinoDashboardMetrics({ truths: currentSeasonTrips, sessions: programSessions, sessionAnalytics }), [currentSeasonTrips, programSessions, sessionAnalytics]);
  const recoveryStatus = useMemo(() => buildCasinoRecoveryStatusSummary(), []);
  const netTheoretical = dashboard.totalTheo == null ? null : (dashboard.totalPoints * settings.pointDollarValue) - dashboard.totalTheo;
  const tierProgress = program === 'blue_chip'
    ? clampPercent(Number(blueChip?.trackerPercentage ?? 0))
    : (() => {
      const normalizedTierIndex = Math.max(0, TIER_ORDER.findIndex((item) => item === tier));
      const nextTier = TIER_ORDER[normalizedTierIndex + 1];
      if (!nextTier) return 100;
      const currentThreshold = CLUB_ROYALE_TIERS[TIER_ORDER[normalizedTierIndex]]?.threshold ?? 0;
      const nextThreshold = CLUB_ROYALE_TIERS[nextTier]?.threshold ?? currentThreshold + 1;
      return clampPercent(((syncedPoints - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100);
    })();
  const nextTier = program === 'blue_chip'
    ? (blueChip?.nextTier ?? null)
    : TIER_ORDER[Math.max(0, TIER_ORDER.findIndex((item) => item === tier)) + 1] ?? null;
  const nextTierThreshold = program === 'blue_chip'
    ? syncedPoints + Number(blueChip?.remainingPoints ?? 0)
    : nextTier ? CLUB_ROYALE_TIERS[nextTier]?.threshold ?? syncedPoints : syncedPoints;
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
      return sum + Math.max(1, Number(cruise?.nights ?? trip.seaDays + trip.portDays ?? 1));
    }, 0);
    const pointsPerNight = seasonNights > 0
      ? seasonTripsWithPoints.reduce((sum, trip) => sum + (trip.points.value ?? 0), 0) / seasonNights
      : 0;
    const futureGamingNights = bookedCruises
      .filter((cruise) => inferCasinoProgram(cruise as unknown as Record<string, unknown>) === program)
      .filter((cruise) => String(cruise.sailDate ?? '') >= new Date().toISOString().slice(0, 10))
      .reduce((sum, cruise) => sum + Math.max(0, Number(cruise.casinoOpenDays ?? cruise.seaDays ?? cruise.nights ?? 0)), 0);
    const monthlyPace = pointsPerNight > 0 && futureGamingNights > 0
      ? (pointsPerNight * futureGamingNights) / 24
      : Math.max(0, reconciliation.attributedCruisePoints / 12);
    return Array.from({ length: 24 }, (_, index) => {
      const month = index + 1;
      const projected = Math.min(target || currentPoints, currentPoints + monthlyPace * month);
      return { label: `M${month}`, value: projected, color: projected >= target && target > 0 ? '#15956a' : '#3267c8' };
    });
  }, [bookedCruises, cruiseById, currentSeasonTrips, nextTierThreshold, program, reconciliation.attributedCruisePoints, syncedPoints]);
  const shipComparisonChart = useMemo(() => {
    const byShip = new Map<string, { points: number; nights: number; net: number; confidence: number; count: number }>();
    for (const trip of programTrips) {
      const cruise = cruiseById.get(trip.cruiseId);
      const nights = Math.max(1, Number(cruise?.nights ?? trip.seaDays + trip.portDays ?? 1));
      const actualFields = [trip.points, trip.netGamingResult, trip.coinIn, trip.hours, trip.theoreticalLoss]
        .filter((item) => item.kind === 'actual' || item.kind === 'user_entered' || item.kind === 'provider_reported').length;
      const current = byShip.get(trip.shipName) ?? { points: 0, nights: 0, net: 0, confidence: 0, count: 0 };
      current.points += trip.points.value ?? 0;
      current.nights += nights;
      current.net += trip.netGamingResult.value ?? 0;
      current.confidence += actualFields * 20;
      current.count += 1;
      byShip.set(trip.shipName, current);
    }
    return Array.from(byShip.entries())
      .map(([shipName, row], index) => ({
        label: shipName.replace(/ of the seas/i, ''),
        value: row.nights > 0 ? row.points / row.nights : 0,
        color: ['#0b766d', '#3267c8', '#8b5cf6', '#d8aa32'][index % 4],
        net: row.net,
        confidence: row.count ? row.confidence / row.count : 0,
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
  const economicHealthFactors = useMemo(() => [
    { label: 'ROI', value: clampPercent(cruiseEconomicsSummary.roiStyle.netRoiOnPaid / 4), color: '#15956a' },
    { label: 'Diversity', value: clampPercent(new Set(programTrips.map((trip) => trip.shipName)).size * 12), color: '#3267c8' },
    { label: 'Trips', value: clampPercent(programTrips.length * 8), color: '#8b5cf6' },
    { label: 'Points', value: clampPercent((dashboard.totalPoints / Math.max(1, nextTierThreshold || 25000)) * 100), color: '#d8aa32' },
    { label: 'Retail', value: clampPercent(cruiseEconomicsSummary.roiStyle.compCoverage), color: '#0b766d' },
    { label: 'Coverage', value: clampPercent(dashboard.dataCoverage), color: '#2474cc' },
    { label: 'Risk', value: dashboard.theoVariancePercent == null ? 0 : clampPercent(100 - Math.abs(dashboard.theoVariancePercent)), color: '#d94b4b' },
  ], [cruiseEconomicsSummary.roiStyle.compCoverage, cruiseEconomicsSummary.roiStyle.netRoiOnPaid, dashboard.dataCoverage, dashboard.theoVariancePercent, dashboard.totalPoints, nextTierThreshold, programTrips]);

  const renderTrip = (trip: CasinoCruiseTruth) => {
    const economics = economicsByCruise.get(trip.cruiseId);
    const cruise = cruiseById.get(trip.cruiseId);
    return <View key={trip.cruiseId} style={styles.tripCard} testID={`casino-trip-${trip.cruiseId}`}>
    <View style={styles.rowBetween}>
      <View style={styles.tripTitleWrap}><Text style={styles.tripShip}>{trip.shipName}</Text><Text style={styles.tripDate}>{trip.sailDate} · {trip.seasonLabel}</Text></View>
      <Text style={styles.pointsPill}>{number(trip.points.value)} pts</Text>
    </View>
    <EvidenceLine label="Gaming result" value={`${money(trip.netGamingResult.value)} · ${sourceLabel(trip.netGamingResult.kind)}`} />
    <EvidenceLine label="Theoretical" value={`${money(trip.theoreticalLoss.value)} · ${sourceLabel(trip.theoreticalLoss.kind)}`} />
    <EvidenceLine label="Coin-in" value={`${money(trip.coinIn.value)} · ${sourceLabel(trip.coinIn.kind)}`} />
    <EvidenceLine label="Play hours" value={`${number(trip.hours.value)} · ${sourceLabel(trip.hours.kind)}`} />
    <EvidenceLine label="Casino opportunity" value={`${trip.seaDays} sea / ${trip.portDays} port days`} />
    <EvidenceLine label="Certificates earned" value={trip.certificateCodes.join(', ') || 'Not linked'} />
    {economics ? <><EvidenceLine label="Retail / paid" value={`${money(economics.retailValue)} / ${money(economics.netEffectivePaid)}`} /><EvidenceLine label="Cruise value captured" value={money(economics.cruiseValueCaptured)} /><EvidenceLine label="Cash / total economic value" value={`${money(economics.cashResult)} / ${money(economics.totalEconomicValue)}`} /></> : null}
    <View style={cruise?.invoiceImportedAt ? styles.invoiceVerified : styles.invoiceMissing}><Text style={styles.invoiceStatus}>{cruise?.invoiceImportedAt ? `RECEIPT VERIFIED · ${cruise.invoiceFileName ?? 'Royal receipt'}` : 'RECEIPT NOT LOADED · Upload to verify offer/certificate and actual value'}</Text></View>
    <TouchableOpacity style={styles.invoiceButton} onPress={() => router.push({ pathname: '/casino/invoice-import' as never, params: { cruiseId: trip.cruiseId } } as never)} testID={`casino-trip-upload-invoice-${trip.cruiseId}`}><FileUp size={15} color="#0b766d" /><Text style={styles.invoiceButtonText}>{cruise?.invoiceImportedAt ? 'Replace or review receipt' : 'Upload Royal receipt PDF'}</Text></TouchableOpacity>
    {trip.hours.formula ? <Text style={styles.formula}>Hour estimate: {trip.hours.formula}</Text> : null}
    {trip.warnings.map((warning) => <Text key={warning} style={styles.warning}>⚠ {warning}</Text>)}
  </View>;
  };

  return <SafeAreaView style={styles.safe} edges={['top']} testID="casino-relationship-intelligence">
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>CASINO COMMAND CENTER</Text><Text style={styles.title}>Know your play. Know your value.</Text></View>
      <TouchableOpacity style={styles.askButton} onPress={() => router.push('/ask-my-data')}><Database size={18} color="#fff" /><Text style={styles.askText}>Ask</Text></TouchableOpacity>
    </View>

    <View style={styles.programRow}>
      <TouchableOpacity style={[styles.programButton, program === 'club_royale' && styles.programActive]} onPress={() => void setSelectedProgram('club_royale')}><Text style={[styles.programText, program === 'club_royale' && styles.programTextActive]}>Club Royale</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.programButton, program === 'blue_chip' && styles.programActive]} onPress={() => void setSelectedProgram('blue_chip')}><Text style={[styles.programText, program === 'blue_chip' && styles.programTextActive]}>Blue Chip</Text></TouchableOpacity>
    </View>

    <View style={styles.tabs}>{TABS.map((tab) => <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)} testID={`casino-${tab.id}-tab`}><Text numberOfLines={1} style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text></TouchableOpacity>)}</View>

    {truthsLoading || skippedTruthRows > 0 ? <View style={styles.processingBanner}>
      <Text style={styles.processingText}>{truthsLoading ? 'Preparing casino cruise calculations in the background…' : 'Casino calculations ready.'}{skippedTruthRows > 0 ? ` ${skippedTruthRows} malformed record(s) were safely skipped.` : ''}</Text>
    </View> : null}

    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {activeTab === 'intelligence' ? <>
        <View style={styles.statusCard}>
          <View><Text style={styles.statusTier}>{tier}</Text><Text style={styles.statusSub}>{reconciliation.seasonLabel}</Text></View>
          <View style={styles.statusPoints}><Text style={styles.statusPointsValue}>{syncedPoints.toLocaleString()}</Text><Text style={styles.statusPointsLabel}>synced points</Text></View>
        </View>
        <Text style={styles.resetNote}>{program === 'blue_chip' ? 'Blue Chip Club resets every August 1.' : 'Club Royale resets every April 1.'} Next reset: {resetDate || '—'} · Source: {pointSource}</Text>
        <ProgressMeter label={nextTier ? `Progress to ${nextTier}` : `${tier} top tier`} value={tierProgress} caption={`${syncedPoints.toLocaleString()} current points`} targetLabel={nextTier ? `${nextTierThreshold.toLocaleString()} target` : 'Top tier reached'} color={program === 'blue_chip' ? '#3267c8' : '#d8aa32'} />
        <Text style={styles.sectionTitle}>Current season intelligence</Text>
        <Text style={styles.sectionSub}>Owner-scoped cruise closeouts win over provider totals. Estimates are labeled and never replace actual records.</Text>
        <View style={styles.colorGrid}>
          <ColorMetric icon={Trophy} label="Cruise points" value={dashboard.totalPoints.toLocaleString()} detail={`${dashboard.tripsWithPoints} of ${dashboard.tripCount} cruises have points`} color="#d18b16" confidence={dashboard.tripsWithPoints ? 'reconciled' : 'missing'} />
          <ColorMetric icon={Timer} label="Play hours" value={dashboard.totalHours == null ? '—' : `${number(dashboard.totalHours)}h`} detail={dashboard.hoursConfidence === 'estimated' ? 'Estimated from points and itinerary' : 'Saved session/closeout duration'} color="#6d55d9" confidence={dashboard.hoursConfidence} />
          <ColorMetric icon={Dices} label="Casino cash result" value={money(dashboard.totalNet)} detail="Gaming cash only; cruise fare excluded" color={(dashboard.totalNet ?? 0) >= 0 ? '#15956a' : '#d94b4b'} confidence={dashboard.netConfidence} />
          <ColorMetric icon={Target} label="Theoretical loss" value={money(dashboard.totalTheo)} detail="Recorded theo, or labeled coin-in × hold estimate" color="#8b4aac" confidence={dashboard.theoConfidence} />
          <ColorMetric icon={Zap} label="Points per hour" value={dashboard.pointsPerHour == null ? '—' : `${number(dashboard.pointsPerHour)} PPH`} detail="Points divided by actual/mixed hours" color="#2474cc" confidence={dashboard.hoursConfidence} />
          <ColorMetric icon={Gauge} label="Data coverage" value={percent(dashboard.dataCoverage)} detail={`${dashboard.actualEvidenceCount} actual · ${dashboard.estimatedEvidenceCount} estimated · ${dashboard.missingEvidenceCount} missing`} color={dashboard.dataCoverage >= 75 ? '#15956a' : dashboard.dataCoverage >= 45 ? '#d18b16' : '#d94b4b'} confidence="checked" />
        </View>
        {program === 'club_royale' ? <>
          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Historical annual value</Text><Text style={styles.sectionSub}>{cruiseEconomicsSummary.totals.cruises} completed Royal cruises. Receipt imports replace estimates cruise by cruise.</Text>
          <View style={styles.grid}>
            <Metric label="Retail cruise value" value={exactMoney(cruiseEconomicsSummary.totals.totalRetailValue)} evidence="RECONCILED" detail="Fare value before casino discounts" />
            <Metric label="Amount paid" value={exactMoney(cruiseEconomicsSummary.totals.totalPaid)} evidence="RECONCILED" detail="Cash paid; separate from gaming volume" />
            <Metric label="Cruise value captured" value={exactMoney(cruiseEconomicsSummary.totals.totalCruiseValueCaptured)} evidence="CALCULATED" detail="Retail minus effective paid" />
            <Metric label="Winnings home" value={exactMoney(cruiseEconomicsSummary.totals.totalWinningsHome)} evidence="RECONCILED" />
            <Metric label="Cash result" value={exactMoney(cruiseEconomicsSummary.totals.totalCashResult)} evidence="CALCULATED" detail="Winnings home minus paid" />
            <Metric label="Total economic value" value={exactMoney(cruiseEconomicsSummary.totals.totalEconomicValue)} evidence="CALCULATED" detail="Retail + winnings − paid" />
          </View>
          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Gaming activity</Text><Text style={styles.sectionSub}>Wagering activity is deliberately separate from cash and cruise value.</Text>
          <View style={styles.grid}>
            <Metric label="Points earned" value={cruiseEconomicsSummary.totals.totalPoints.toLocaleString()} evidence="RECONCILED" />
            <Metric label="Coin-in volume" value={money(cruiseEconomicsSummary.totals.totalCoinIn)} evidence="DERIVED" detail="Gaming volume only; never counted as spending, loss, or economic value" />
            <Metric label="Points per night" value={number(cruiseEconomicsSummary.averages.pointsPerNight)} evidence="CALCULATED" />
            <Metric label="Comp coverage" value={`${cruiseEconomicsSummary.roiStyle.compCoverage.toFixed(2)}%`} evidence="CALCULATED" />
          </View>
        </> : null}
        {program === 'club_royale' && clubRoyaleSyncDiscrepancy.hasDiscrepancy ? <View style={styles.discrepancyCard}><Text style={styles.discrepancyTitle}>POINTS SYNC DISCREPANCY</Text><Text style={styles.discrepancyText}>{clubRoyaleSyncDiscrepancy.appPoints.toLocaleString()} app points vs {clubRoyaleSyncDiscrepancy.syncedPoints?.toLocaleString() ?? '—'} provider points · difference {Math.abs(clubRoyaleSyncDiscrepancy.difference).toLocaleString()}. Saved app/manual cruise points remain authoritative.{likelyUnpostedCruises.length ? ` Likely unposted cruise rows: ${likelyUnpostedCruises.join(', ')}.` : ''}</Text></View> : null}
        {chartsReady ? <DistributionBar title="Points reconciliation" segments={evidenceChart.map((row) => ({ label: row.label, value: row.value, color: row.color }))} footer="Synced is the provider balance; attributed points remain the sum of saved cruise truth records." /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Reconciliation visualization loads after navigation settles.</Text></View>}
        <View style={styles.grid}>
          <Metric label="Attributed to trips" value={reconciliation.attributedCruisePoints.toLocaleString()} evidence="RECONCILED" detail={`${reconciliation.cruiseCount} trips in this earning year`} />
          <Metric label="Unallocated points" value={number(reconciliation.unallocatedPoints)} evidence={reconciliation.unallocatedPoints === 0 ? 'RECONCILED' : 'NEEDS REVIEW'} detail="Synced total minus cruise-attributed points" />
          <Metric label="Net gaming result" value={tripsWithNet ? money(totalNet) : '—'} evidence={tripsWithNet ? 'MIXED' : 'MISSING'} detail="Current earning year; cruise fare excluded" />
          <Metric label="Theoretical loss" value={tripsWithTheo ? money(totalTheo) : '—'} evidence={tripsWithTheo ? 'MIXED' : 'MISSING'} detail="Current earning year; recorded or labeled estimate" />
          <Metric label="Unlinked certificates" value={String(reconciliation.unlinkedCertificateCount)} evidence={reconciliation.unlinkedCertificateCount ? 'NEEDS REVIEW' : 'RECONCILED'} detail="Never merged by offer code alone" />
          <Metric label="Data health" value={reconciliation.overAttributedPoints ? 'Review' : 'Good'} evidence={reconciliation.overAttributedPoints ? 'NEEDS REVIEW' : 'CHECKED'} detail={reconciliation.overAttributedPoints ? `${reconciliation.overAttributedPoints} points exceed synced total` : 'No over-attribution detected'} />
        </View>
        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/casino/post-cruise-closeout')}><Plus color="#fff" size={20} /><Text style={styles.primaryActionText}>Add or reconcile a cruise result</Text></TouchableOpacity>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Cruise portfolio</Text><Text style={styles.sectionSub}>Every result shows its evidence source. Tap receipt upload to replace estimates with actual booking economics.</Text></View>
        {programTrips.length ? programTrips.slice(0, 12).map(renderTrip) : <View style={styles.empty}><Text style={styles.emptyTitle}>No {program === 'blue_chip' ? 'Blue Chip' : 'Club Royale'} casino cruises</Text><Text style={styles.emptyText}>Add a cruise closeout or import owner-scoped cruise data.</Text></View>}
        {programTrips.length > 12 ? <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/casino/completed-sailings')}><Ship color="#0d355a" size={20} /><Text style={styles.secondaryActionText}>View all {programTrips.length} casino cruises</Text></TouchableOpacity> : null}
      </> : null}

      {activeTab === 'charts' ? <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Casino charts</Text><Text style={styles.sectionSub}>Colorful comparisons use saved owner data only. Missing evidence remains blank instead of being invented.</Text></View>
        <ProgressMeter label={nextTier ? `${nextTier} tier progression` : `${tier} retained`} value={tierProgress} caption={`${syncedPoints.toLocaleString()} points`} targetLabel={nextTier ? `${Math.max(0, nextTierThreshold - syncedPoints).toLocaleString()} remaining` : 'Complete'} color="#d8aa32" />
        <ProgressMeter label="Casino data health" value={dashboard.dataCoverage} caption={`${dashboard.actualEvidenceCount} verified evidence fields`} targetLabel={`${dashboard.missingEvidenceCount} missing`} color={dashboard.dataCoverage >= 75 ? '#15956a' : '#d18b16'} />
        <DistributionBar title="Economic Health Analysis" segments={economicHealthFactors} footer="Score formula: ROI + portfolio diversity + cruise count + points pace + retail captured value + data coverage − volatility risk. Tap the calculation tools for the exact source-labeled inputs." />
        {chartsReady && tierProgressionForecastChart.length ? <CasinoBarChart title="Tier progression forecast · 24-month view" rows={tierProgressionForecastChart} valueLabel={(value) => `${Math.round(value).toLocaleString()} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>24-month tier projection loads after navigation settles.</Text></View>}
        {chartsReady && pointsByTripChart.length ? <CasinoBarChart title="Points by cruise" rows={pointsByTripChart} valueLabel={(value) => `${value.toLocaleString()} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Add cruise points to create the progression chart.</Text></View>}
        {chartsReady && netByTripChart.length ? <CasinoBarChart title="Cash result by cruise" rows={netByTripChart} valueLabel={(value) => `${value >= 0 ? '+' : ''}${money(value)}`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Add cruise cash results to compare performance.</Text></View>}
        {chartsReady && shipComparisonChart.length ? <CasinoBarChart title="Ship comparison · points per night" rows={shipComparisonChart} valueLabel={(value) => `${number(value)} pts/night`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Ship comparison loads after navigation settles and needs cruise points.</Text></View>}
        {chartsReady && shipComparisonChart.length ? <CasinoBarChart title="Ship data confidence" rows={shipComparisonChart.map((row) => ({ label: row.label, value: row.confidence, color: row.confidence >= 70 ? '#15956a' : '#d18b16' }))} valueLabel={(value) => percent(value)} /> : null}
        {chartsReady && seasonTrendChart.length ? <CasinoBarChart title={`${program === 'blue_chip' ? 'Blue Chip Aug-Jul' : 'Club Royale Apr-Mar'} season trend · posted vs expected points`} rows={seasonTrendChart} valueLabel={(value) => `${Math.round(value).toLocaleString()} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>Season and rolling trend charts load only on this page so tab changes stay immediate.</Text></View>}
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

      {activeTab === 'session' ? <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Session tracking</Text><Text style={styles.sectionSub}>Enter cash in, cash out, duration, and points. Generated historical sessions never count as actual play.</Text></View>
        <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Simple onboard session entry</Text><Text style={styles.formulaCopy}>Save starting cash-in, ending cash-out, separately paid jackpots, start/end time or duration, points earned, ship/cruise, game type, and notes. Draft sessions are crash-safe and reconcile back to the cruise once—not twice.</Text></View>
        <ProgressMeter label="Points-per-hour target" value={sessionAnalytics.pointsPerHour > 0 ? (sessionAnalytics.pointsPerHour / Math.max(1, settings.defaultPointsPerHour)) * 100 : 0} caption={sessionAnalytics.totalPlayTimeMinutes > 0 ? `${number(sessionAnalytics.pointsPerHour)} actual PPH` : 'No actual timed sessions yet'} targetLabel={`${settings.defaultPointsPerHour} PPH target`} color="#6d55d9" />
        {chartsReady && sessionPointChart.length ? <CasinoBarChart title="Session performance · Points by recent session" rows={sessionPointChart} valueLabel={(value) => `${number(value)} pts`} /> : <View style={styles.chartPlaceholder}><Text style={styles.chartPlaceholderText}>{chartsReady ? 'Add program-attributed session points to build this chart.' : 'Session chart loads after navigation settles.'}</Text></View>}
        <View style={styles.colorGrid}>
          <ColorMetric icon={Dices} label="Actual sessions" value={String(sessionAnalytics.actualSessionCount)} detail={`${sessionAnalytics.generatedSessionCount} generated excluded`} color="#3267c8" confidence="actual only" />
          <ColorMetric icon={Timer} label="Tracked time" value={`${number(sessionAnalytics.totalPlayTimeMinutes / 60)}h`} detail={`${number(sessionAnalytics.avgSessionLength)} average minutes`} color="#6d55d9" confidence={sessionAnalytics.actualSessionCount ? 'actual' : 'missing'} />
          <ColorMetric icon={WalletCards} label="Session cash result" value={sessionAnalytics.actualSessionCount ? money(sessionAnalytics.netWinLoss) : '—'} detail="Cash-out + separate handpay − cash-in" color={sessionAnalytics.netWinLoss >= 0 ? '#15956a' : '#d94b4b'} confidence={sessionAnalytics.actualSessionCount ? 'actual' : 'missing'} />
          <ColorMetric icon={Target} label="Session ADT" value={money(sessionAnalytics.adt)} detail={`${sessionAnalytics.ratedGamingDays} rated gaming day(s)`} color="#8b4aac" confidence={sessionAnalytics.adt == null ? 'missing' : sessionAnalytics.coinInSource} />
          <ColorMetric icon={Trophy} label="Win rate" value={percent(sessionAnalytics.actualSessionCount ? sessionAnalytics.winRate : null, 1)} detail={`${percent(sessionAnalytics.lossRate, 1)} loss · ${percent(sessionAnalytics.breakEvenRate, 1)} even`} color="#d18b16" confidence={sessionAnalytics.actualSessionCount ? 'actual' : 'missing'} />
          <ColorMetric icon={Activity} label="Variance" value={sessionAnalytics.actualSessionCount > 1 ? money(sessionAnalytics.varianceStats.standardDeviation) : '—'} detail={`Median ${money(sessionAnalytics.varianceStats.medianWinLoss)}`} color="#d46b37" confidence={sessionAnalytics.actualSessionCount > 1 ? 'calculated' : 'missing'} />
        </View>
        <View style={styles.streakCard}><View><Text style={styles.streakTitle}>Session streaks</Text><Text style={styles.streakDetail}>Best sequences from actual sessions</Text></View><View style={styles.streakValues}><Text style={styles.winStreak}>▲ {sessionAnalytics.streakData.longestWinStreak} wins</Text><Text style={styles.lossStreak}>▼ {sessionAnalytics.streakData.longestLossStreak} losses</Text></View></View>
        <View style={styles.formulaCard}><Text style={styles.formulaTitle}>PPH goals, history, comparison, leaderboard</Text><Text style={styles.formulaCopy}>Today / Week / Month / All-Time filters use actual timed sessions first, then clearly labeled estimates. Leaderboards, best-vs-average, and streak achievements stay owner-scoped and show a minimum-data guard when there are zero sessions or estimated-only rows.</Text></View>
        <ProgressMeter label="Weekly goal and XP" value={sessionAnalytics.pointsPerHour > 0 ? Math.min(100, (sessionAnalytics.pointsPerHour / Math.max(1, settings.defaultPointsPerHour)) * 100) : 0} caption="Daily/weekly streaks and player level are optional and profile-scoped" targetLabel="No ranking from empty data" color="#d8aa32" />
        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/casino/onboard-mode')}><Activity color="#fff" size={20} /><Text style={styles.primaryActionText}>Start onboard casino mode</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/casino-sessions')}><Plus color="#0d355a" size={20} /><Text style={styles.secondaryActionText}>View or add sessions</Text></TouchableOpacity>
      </> : null}

      {activeTab === 'calcs' ? <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Casino calculations</Text><Text style={styles.sectionSub}>Every result states what it means and whether its inputs are actual, mixed, estimated, or missing.</Text></View>
        <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Formula guardrails</Text><Text style={styles.formulaCopy}>Cash result = cash-out + separately paid jackpots − cash-in. Coin-in uses actual coin-in when supplied; Club Royale slots may derive coin-in as qualifying points × $5, while Blue Chip, table, poker, and unknown play require explicit coin-in. Theo = explicit theo, else valid coin-in × configured house edge. ADT = theo ÷ rated gaming days.</Text></View>
        <View style={styles.colorGrid}>
          <ColorMetric icon={Coins} label="Coin-in volume" value={money(dashboard.totalCoinIn)} detail={program === 'club_royale' ? 'Actual coin-in, or eligible slot points × $5 estimate' : 'Requires explicit Blue Chip coin-in'} color="#2474cc" confidence={dashboard.coinInConfidence} />
          <ColorMetric icon={Target} label="Theoretical loss" value={money(dashboard.totalTheo)} detail="Recorded theo, else coin-in × configured house edge" color="#8b4aac" confidence={dashboard.theoConfidence} />
          <ColorMetric icon={Calculator} label="Net theoretical" value={money(netTheoretical)} detail="Point value earned minus theoretical loss" color={(netTheoretical ?? 0) >= 0 ? '#15956a' : '#d94b4b'} confidence={netTheoretical == null ? 'missing' : dashboard.theoConfidence} />
          <ColorMetric icon={Gauge} label="Average daily theo" value={money(dashboard.adt)} detail={dashboard.ratedGamingDays ? `${dashboard.ratedGamingDays} explicitly rated gaming day(s)` : 'Requires explicit rated gaming days; cruise nights are not substituted'} color="#d18b16" confidence={dashboard.adt == null ? 'missing' : dashboard.theoConfidence} />
          <ColorMetric icon={Zap} label="Points per hour" value={dashboard.pointsPerHour == null ? '—' : number(dashboard.pointsPerHour)} detail={`${dashboard.totalPoints.toLocaleString()} points ÷ ${number(dashboard.totalHours)} hours`} color="#6d55d9" confidence={dashboard.hoursConfidence} />
          <ColorMetric icon={TrendingUp} label="Value per hour" value={dashboard.totalHours && dashboard.totalHours > 0 ? money(cruiseEconomicsSummary.totals.totalEconomicValue / dashboard.totalHours) : '—'} detail="Total economic value ÷ play hours; coin-in excluded" color="#15956a" confidence={dashboard.totalHours ? 'calculated' : 'missing'} />
          <ColorMetric icon={WalletCards} label="Value per session" value={sessionAnalytics.actualSessionCount > 0 ? money(cruiseEconomicsSummary.totals.totalEconomicValue / sessionAnalytics.actualSessionCount) : '—'} detail="Economic value ÷ actual sessions" color="#0b766d" confidence={sessionAnalytics.actualSessionCount ? 'calculated' : 'missing'} />
          <ColorMetric icon={Activity} label="Risk per hour" value={dashboard.totalHours && dashboard.totalTheo != null ? money(dashboard.totalTheo / dashboard.totalHours) : '—'} detail="Theoretical loss ÷ play hours—not a stop-loss guess" color="#d94b4b" confidence={dashboard.totalHours && dashboard.totalTheo != null ? dashboard.theoConfidence : 'missing'} />
          <ColorMetric icon={LineChart} label="Theo variance" value={money(dashboard.theoVariance)} detail={dashboard.theoVariancePercent == null ? 'Needs theo and cash result' : `${percent(dashboard.theoVariancePercent, 1)} ahead/behind expected loss`} color={(dashboard.theoVariance ?? 0) >= 0 ? '#15956a' : '#d94b4b'} confidence={dashboard.theoVariance == null ? 'missing' : 'calculated'} />
          <ColorMetric icon={ShieldCheck} label="Offer safety index" value={dashboard.offerSafetyIndex == null ? '—' : percent(dashboard.offerSafetyIndex)} detail="Coverage, sample size, pace, and result volatility" color="#3267c8" confidence={dashboard.offerSafetyIndex == null ? 'missing' : 'derived'} />
          <ColorMetric icon={BarChart3} label="Sustainability" value={dashboard.sustainabilityScore == null ? '—' : percent(dashboard.sustainabilityScore)} detail="Evidence coverage and consistency; not an offer guarantee" color="#15956a" confidence={dashboard.sustainabilityScore == null ? 'missing' : 'derived'} />
          <ColorMetric icon={Calculator} label="Press efficiency" value="—" detail="Requires recorded press exposure and attributable press results" color="#d18b16" confidence="missing" />
          <ColorMetric icon={Brain} label="Median cash result" value={money(dashboard.medianResult)} detail={`Best ${money(dashboard.bestResult)} · worst ${money(dashboard.worstResult)}`} color="#6d55d9" confidence={dashboard.medianResult == null ? 'missing' : 'calculated'} />
        </View>
        <View style={styles.formulaCard}><Text style={styles.formulaTitle}>Risk, press, and offer safety rules</Text><Text style={styles.formulaCopy}>Risk per hour is theoretical loss ÷ play hours, not a bankroll or stop-loss placeholder. Press efficiency is unavailable until press exposure and attributable press results exist. Offer Safety Index combines consistency, sample size, points pace, variance, and confidence so spike-risk is labeled instead of hidden.</Text></View>
        <ProgressMeter label="Sustainability score" value={dashboard.sustainabilityScore ?? 0} caption="Consistency and evidence coverage" targetLabel={dashboard.sustainabilityScore == null ? 'More cruise data needed' : dashboard.sustainabilityScore >= 70 ? 'Stable evidence pattern' : 'Improve data coverage'} color="#15956a" />
        <View style={styles.formulaCard} testID="casino-recovery-governance-status"><Text style={styles.formulaTitle}>Recovery, backup, and marketing-governance status</Text><Text style={styles.formulaCopy}>{recoveryStatus.total} remaining recovery requirements are registered: {recoveryStatus.counts.active} active, {recoveryStatus.counts.guarded} guarded, {recoveryStatus.counts.test_required} regression-gated, and {recoveryStatus.counts.operator_source_required} operator-only. Operator-only fields display “{OPERATOR_SOURCE_REQUIRED}” and are never fabricated from personal app data.</Text></View>
        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Strategy & tools</Text><Text style={styles.sectionSub}>Planning tools never present estimates as actual casino results.</Text>
        {[
          { icon: Gauge, title: 'Relationship intelligence', detail: 'Tier pace, player worth, ROI, offer response, and trip intelligence.', route: '/casino/relationship-intelligence' },
          { icon: Activity, title: 'Current-trip comp pace', detail: 'Compare actual, reported, and estimated value during a cruise.', route: '/casino/current-trip-comp-pace' },
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
  safe: { flex: 1, backgroundColor: '#eef7f7' },
  header: { backgroundColor: '#071b2d', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#7fe2cd', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 },
  askButton: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#0b766d', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 },
  askText: { color: '#fff', fontWeight: '800' },
  programRow: { backgroundColor: '#071b2d', flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  programButton: { flex: 1, borderColor: '#486278', borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  programActive: { backgroundColor: '#d8aa32', borderColor: '#d8aa32' },
  programText: { color: '#bcd0df', fontWeight: '800' },
  programTextActive: { color: '#071b2d' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#c8d8df' },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0b766d' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#66778a' },
  tabTextActive: { color: '#073a4c', fontWeight: '900' },
  processingBanner: { backgroundColor: '#e5f3f1', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#a9d4cd', paddingHorizontal: 14, paddingVertical: 7 },
  processingText: { color: '#315f63', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  scroll: { flex: 1 }, content: { padding: 14, paddingBottom: 110 },
  statusCard: { backgroundColor: '#0c4056', borderRadius: 18, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTier: { color: '#fff', fontSize: 27, fontWeight: '900' }, statusSub: { color: '#b8e3df', marginTop: 3, fontSize: 12 },
  statusPoints: { alignItems: 'flex-end' }, statusPointsValue: { color: '#f4ce62', fontSize: 28, fontWeight: '900' }, statusPointsLabel: { color: '#dcebed', fontSize: 11 },
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
  progressLabel: { color: '#17354a', fontSize: 14, fontWeight: '900' },
  progressPercent: { fontSize: 17, fontWeight: '900' },
  progressTrack: { height: 12, borderRadius: 7, backgroundColor: '#e6eef1', overflow: 'hidden', marginVertical: 9 },
  progressFill: { height: 12, borderRadius: 7 },
  progressCaption: { color: '#667987', fontSize: 10, fontWeight: '700', flex: 1 },
  progressTarget: { color: '#17354a', fontSize: 10, fontWeight: '900', textAlign: 'right' },
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
  formulaCard: { backgroundColor: '#fffaf0', borderRadius: 15, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#efd28c' },
  formulaTitle: { color: '#6d4b00', fontSize: 14, fontWeight: '900' },
  formulaCopy: { color: '#55421a', fontSize: 11, lineHeight: 16, marginTop: 6, fontWeight: '700' },
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
  metricValue: { color: '#081f38', fontSize: 24, fontWeight: '900', marginTop: 9 }, metricDetail: { color: '#667987', fontSize: 10, lineHeight: 14, marginTop: 5 },
  primaryAction: { backgroundColor: '#0b766d', borderRadius: 13, padding: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryActionText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryAction: { backgroundColor: '#fff', borderColor: '#b8cbd3', borderWidth: 1, borderRadius: 13, padding: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryActionText: { color: '#0d355a', fontWeight: '900', fontSize: 15 },
  sectionHeader: { marginBottom: 10 }, sectionTitle: { color: '#092b43', fontSize: 21, fontWeight: '900' }, sectionSub: { color: '#5f7481', fontSize: 13, lineHeight: 18, marginTop: 3, marginBottom: 10 },
  tripCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 11, borderWidth: 1, borderColor: '#d6e3e7' }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, tripTitleWrap: { flex: 1 }, tripShip: { color: '#092b43', fontSize: 17, fontWeight: '900' }, tripDate: { color: '#6a7e8b', fontSize: 11, marginTop: 3 }, pointsPill: { backgroundColor: '#f5d87c', color: '#3b2c03', fontWeight: '900', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden', alignSelf: 'flex-start' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dfe8eb', gap: 10 }, lineLabel: { color: '#586c78', fontSize: 12 }, lineValue: { color: '#17354a', fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 }, formula: { color: '#5b6f7b', fontSize: 10, lineHeight: 15, marginTop: 8 }, warning: { color: '#9a5019', fontSize: 10, lineHeight: 14, marginTop: 5 },
  invoiceMissing: { backgroundColor: '#fff3d6', borderRadius: 9, padding: 9, marginTop: 9 }, invoiceVerified: { backgroundColor: '#dff3ef', borderRadius: 9, padding: 9, marginTop: 9 }, invoiceStatus: { color: '#17354a', fontSize: 9, fontWeight: '900' }, invoiceButton: { borderWidth: 1, borderColor: '#92cfc5', borderRadius: 10, padding: 10, marginTop: 8, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, invoiceButtonText: { color: '#0b766d', fontWeight: '900', fontSize: 11 },
  empty: { backgroundColor: '#fff', padding: 24, borderRadius: 15, alignItems: 'center' }, emptyTitle: { color: '#15384d', fontWeight: '900', fontSize: 16 }, emptyText: { color: '#687d89', textAlign: 'center', marginTop: 6 },
  tool: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7e4e7', borderRadius: 14, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 11 }, toolIcon: { backgroundColor: '#dcf2ee', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, toolText: { flex: 1 }, toolTitle: { color: '#0b2d44', fontWeight: '900', fontSize: 15 }, toolDetail: { color: '#677b87', fontSize: 11, lineHeight: 15, marginTop: 2 }, chevron: { fontSize: 27, color: '#7c919d' },
});
