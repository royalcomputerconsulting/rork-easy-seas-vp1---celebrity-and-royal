import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';
import { buildCruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';
import {
  buildClubRoyaleDiscrepancy,
  buildCurrentSeasonCasinoMetrics,
  CLUB_ROYALE_SIGNATURE_RETAIN_POINTS,
  CONFIRMED_CLUB_ROYALE_2025_POINTS,
  DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR,
  KNOWN_CURRENT_CLUB_ROYALE_CRUISES,
  type ClubRoyaleDiscrepancy,
  type CurrentSeasonCasinoMetrics,
} from '@/lib/casinoPointTruth';

export interface CasinoSessionLike {
  durationMinutes?: number;
  pointsEarned?: number;
  winLoss?: number;
}

export interface AskMyDataCasinoSessionOverview {
  totalSessions: number;
  totalPlayHours: number;
  totalPointsEarned: number;
  totalCoinIn: number;
  netWinLoss: number;
  pointsPerHour: number;
}

export interface AskMyDataOverview {
  generatedAt: string;
  dataFreshnessLabel: string;
  annual: ReturnType<typeof buildCruiseEconomicsSummary>;
  currentSeason: CurrentSeasonCasinoMetrics;
  sessions: AskMyDataCasinoSessionOverview;
  currentTier: string;
  currentPoints: number;
  pointBalanceSource: string;
  discrepancy: ClubRoyaleDiscrepancy;
  formulaGuard: string[];
  text: string;
}

interface BuildAskMyDataOverviewParams {
  bookedCruises: BookedCruise[];
  casinoSessions?: CasinoSessionLike[];
  currentTier?: string | null;
  currentPoints?: number | null;
  pointBalanceSource?: string | null;
  syncedClubRoyalePoints?: number | null;
  clubRoyaleSyncDiscrepancy?: ClubRoyaleDiscrepancy | null;
  useKnownAnnualReportFacts?: boolean;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function plainMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percent(value: number): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function buildKnownCurrentSeasonFallback(): CurrentSeasonCasinoMetrics {
  const points = KNOWN_CURRENT_CLUB_ROYALE_CRUISES.reduce((sum, cruise) => sum + cruise.pointsEarned, 0);
  const nights = KNOWN_CURRENT_CLUB_ROYALE_CRUISES.reduce((sum, cruise) => sum + cruise.nights, 0);
  const winningsBroughtHome = KNOWN_CURRENT_CLUB_ROYALE_CRUISES.reduce((sum, cruise) => sum + cruise.winningsBroughtHome, 0);
  const estimatedPlayHours = round2(points / DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR);

  return {
    seasonStart: '2026-04-01',
    seasonEnd: '2027-04-01',
    cruises: KNOWN_CURRENT_CLUB_ROYALE_CRUISES.length,
    nights,
    points,
    pointsNeededForSignature: Math.max(0, CLUB_ROYALE_SIGNATURE_RETAIN_POINTS - points),
    coinIn: points * DOLLARS_PER_POINT,
    winningsBroughtHome,
    averagePointsPerCruise: KNOWN_CURRENT_CLUB_ROYALE_CRUISES.length > 0 ? round2(points / KNOWN_CURRENT_CLUB_ROYALE_CRUISES.length) : 0,
    averagePointsPerNight: nights > 0 ? round2(points / nights) : 0,
    estimatedPlayHours,
    averageDailyPlayHours: nights > 0 ? round2(estimatedPlayHours / nights) : 0,
    estimatedPointsPerPlayHour: DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR,
  };
}

function resolveCurrentSeasonMetrics(bookedCruises: BookedCruise[], useKnownAnnualReportFacts: boolean): CurrentSeasonCasinoMetrics {
  const appMetrics = buildCurrentSeasonCasinoMetrics(bookedCruises);
  if (!useKnownAnnualReportFacts) {
    return appMetrics;
  }

  const fallback = buildKnownCurrentSeasonFallback();
  return appMetrics.points >= fallback.points ? appMetrics : fallback;
}

function buildSessionOverview(casinoSessions: CasinoSessionLike[] = []): AskMyDataCasinoSessionOverview {
  const totalPlayHours = round2(casinoSessions.reduce((sum, session) => sum + ((session.durationMinutes ?? 0) / 60), 0));
  const totalPointsEarned = Math.round(casinoSessions.reduce((sum, session) => sum + (session.pointsEarned ?? 0), 0));
  const netWinLoss = round2(casinoSessions.reduce((sum, session) => sum + (session.winLoss ?? 0), 0));
  const totalCoinIn = round2(totalPointsEarned * DOLLARS_PER_POINT);

  return {
    totalSessions: casinoSessions.length,
    totalPlayHours,
    totalPointsEarned,
    totalCoinIn,
    netWinLoss,
    pointsPerHour: totalPlayHours > 0 ? round2(totalPointsEarned / totalPlayHours) : 0,
  };
}

export function formatAskMyDataOverview(overview: Omit<AskMyDataOverview, 'text'>): string {
  const annualTotals = overview.annual.totals;
  const annualAverages = overview.annual.averages;
  const annualRoi = overview.annual.roiStyle;
  const current = overview.currentSeason;
  const sessions = overview.sessions;
  const discrepancyLine = overview.discrepancy.hasDiscrepancy
    ? `Club Royale discrepancy: app has ${overview.discrepancy.appPoints.toLocaleString()} points vs sync ${overview.discrepancy.syncedPoints?.toLocaleString() ?? 'unknown'} (${overview.discrepancy.difference > 0 ? '+' : ''}${overview.discrepancy.difference.toLocaleString()}); app-entered cruise points win.`
    : 'Club Royale discrepancy: none detected from available sync data; app-entered cruise points remain authoritative.';

  return [
    `${overview.dataFreshnessLabel}`,
    `Annual Royal Caribbean casino year: ${annualTotals.cruises.toLocaleString()} completed cruises, ${annualTotals.totalNights.toLocaleString()} nights, ${plainMoney(annualTotals.totalRetailValue)} retail, ${plainMoney(annualTotals.totalPaid)} paid, ${plainMoney(annualTotals.totalCruiseValueCaptured)} cruise value captured, ${plainMoney(annualTotals.totalWinningsHome)} winnings brought home, ${money(annualTotals.totalCashResult)} cash result, ${plainMoney(annualTotals.totalEconomicValue)} total economic value.`,
    `Annual points/casino activity: ${annualTotals.totalPoints.toLocaleString()} points, ${plainMoney(annualTotals.totalCoinIn)} coin-in, ${round2(annualAverages.pointsPerNight).toLocaleString()} points/night, cash ROI ${percent(annualRoi.netRoiOnPaid)}, retail-to-paid ${annualRoi.retailToPaidMultiple.toFixed(2)}x.`,
    `Current Club Royale season: ${current.points.toLocaleString()} points, ${current.pointsNeededForSignature.toLocaleString()} to keep Signature (${CLUB_ROYALE_SIGNATURE_RETAIN_POINTS.toLocaleString()} target), ${plainMoney(current.coinIn)} point-derived coin-in, ${plainMoney(current.winningsBroughtHome)} winnings, ${current.averagePointsPerNight.toLocaleString()} points/night, estimated ${current.estimatedPlayHours.toLocaleString()} play hours at ${current.estimatedPointsPerPlayHour.toLocaleString()} points/hour.`,
    `Tier context: ${overview.currentTier || 'Unknown'} tier, ${overview.currentPoints.toLocaleString()} current points (${overview.pointBalanceSource || 'app'} source). ${discrepancyLine}`,
    `Saved session context: ${sessions.totalSessions.toLocaleString()} sessions, ${sessions.totalPlayHours.toLocaleString()} hours, ${sessions.totalPointsEarned.toLocaleString()} points, ${plainMoney(sessions.totalCoinIn)} coin-in, ${money(sessions.netWinLoss)} session win/loss, ${sessions.pointsPerHour.toLocaleString()} points/hour.`,
    `Formula guard: Cash Result = Winnings Brought Home - Net Effective Paid. Cruise Value Captured = Retail Value - Net Effective Paid. Total Economic Value = Retail Value + Winnings Brought Home - Net Effective Paid. Coin-In is gaming volume only and is never added to profit or value capture.`,
  ].join('\n');
}

/** Builds the fresh Ask My Data overview used by deterministic search results and AI context. */
export function buildAskMyDataOverview(params: BuildAskMyDataOverviewParams): AskMyDataOverview {
  const useKnownAnnualReportFacts = params.useKnownAnnualReportFacts ?? false;
  const annual = buildCruiseEconomicsSummary(params.bookedCruises, new Date(), {
    useKnownAnnualReportFacts,
    minimumTotalPoints: useKnownAnnualReportFacts ? CONFIRMED_CLUB_ROYALE_2025_POINTS : undefined,
  });
  const currentSeason = resolveCurrentSeasonMetrics(params.bookedCruises, useKnownAnnualReportFacts);
  const sessions = buildSessionOverview(params.casinoSessions ?? []);
  const currentPoints = Math.round(params.currentPoints ?? currentSeason.points);
  const discrepancy = params.clubRoyaleSyncDiscrepancy ?? buildClubRoyaleDiscrepancy(currentSeason.points, params.syncedClubRoyalePoints);
  const overviewWithoutText: Omit<AskMyDataOverview, 'text'> = {
    generatedAt: new Date().toISOString(),
    dataFreshnessLabel: `Ask My Data loaded the latest saved cruise, casino, session, loyalty, and import/export context at ${new Date().toLocaleString()}.`,
    annual,
    currentSeason,
    sessions,
    currentTier: params.currentTier ?? 'Unknown',
    currentPoints,
    pointBalanceSource: params.pointBalanceSource ?? 'app',
    discrepancy,
    formulaGuard: [
      'Cash Result excludes coin-in.',
      'Cruise Value Captured excludes coin-in.',
      'Total Economic Value excludes coin-in.',
      'Coin-In is gaming activity volume only.',
    ],
  };

  return {
    ...overviewWithoutText,
    text: formatAskMyDataOverview(overviewWithoutText),
  };
}
