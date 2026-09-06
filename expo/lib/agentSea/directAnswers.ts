import type { BookedCruise } from '@/types/models';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import {
  buildCasinoCruiseTruth,
  type CasinoCertificateRecord,
  type CasinoCruiseTruth,
} from '@/lib/casino/casinoTruthEngine';
import {
  getCasinoProgramSeason,
  isDateInCasinoSeason,
  type CasinoProgramId,
} from '@/lib/casino/casinoProgramSeasons';
import { formatCount } from '@/lib/format';
import type { AskMyDataOverview } from '@/lib/askMyDataOverview';

export interface AgentSeaDirectAnswer {
  intent: 'adt' | 'booked_cruise_count' | 'completed_cruise_count' | 'last_cruise_points' | 'casino_overview' | 'casino_roi' | 'loyalty_status';
  text: string;
  evidence: string;
  cruiseIds: string[];
  route: string;
}

export interface AgentSeaLoyaltySnapshot {
  clubRoyalePoints: number;
  clubRoyaleTier: string;
  clubRoyalePointsSource: string;
  crownAnchorPoints: number;
  crownAnchorLevel: string;
  blueChipPoints: number;
  blueChipTier: string;
}

function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function requestedProgram(question: string, selectedProgram?: string): CasinoProgramId {
  const normalizedQuestion = question.toLowerCase();
  if (/blue\s*chip|celebrity/.test(normalizedQuestion) || selectedProgram === 'blueChip') return 'blue_chip';
  if (/carnival|players\s*club/.test(normalizedQuestion) || selectedProgram === 'playersClub') return 'carnival_players_club';
  return 'club_royale';
}

function isAdtQuestion(question: string): boolean {
  return /\badt\b|average\s+daily\s+(?:theo|theoretical)/i.test(question);
}

function normalized(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isCompletedCruise(cruise: BookedCruise, today: string): boolean {
  const status = normalized(`${cruise.status ?? ''} ${cruise.completionState ?? ''}`);
  if (/cancelled|canceled/.test(status)) return false;
  const endDate = String(cruise.returnDate || cruise.sailDate || '').slice(0, 10);
  return /completed/.test(status) || Boolean(endDate && endDate < today);
}

function shipMatchesQuestion(question: string, shipName: string): boolean {
  const query = normalized(question);
  const significant = normalized(shipName).split(' ').filter((token) => token.length >= 4 && !['cruise', 'seas', 'royal'].includes(token));
  return significant.some((token) => new RegExp(`\\b${token}\\b`).test(query));
}

function buildLastCruisePointsAnswer(input: {
  question: string;
  bookedCruises: BookedCruise[];
  sessions: CasinoSession[];
  certificates: CasinoCertificateRecord[];
  now: Date;
}): AgentSeaDirectAnswer | null {
  const query = normalized(input.question);
  if (!/(?:last|latest|previous|most recent)/.test(query) || !/points?/.test(query) || !/(?:cruise|sailing|voyage)/.test(query)) return null;
  const today = input.now.toISOString().slice(0, 10);
  const completed = input.bookedCruises.filter((cruise) => isCompletedCruise(cruise, today));
  const namedMatches = completed.filter((cruise) => shipMatchesQuestion(query, cruise.shipName));
  const candidates = (namedMatches.length > 0 ? namedMatches : completed)
    .slice()
    .sort((left, right) => String(right.returnDate || right.sailDate).localeCompare(String(left.returnDate || left.sailDate)));
  const cruise = candidates[0];
  if (!cruise) {
    return {
      intent: 'last_cruise_points',
      text: 'I could not find a completed cruise matching that ship in the active profile, so I cannot give you a trustworthy points total.',
      evidence: `${input.bookedCruises.length.toLocaleString()} owner-scoped cruise records checked; no matching completed voyage.`,
      cruiseIds: [],
      route: '/(tabs)/booked',
    };
  }
  const truth = buildCasinoCruiseTruth({ cruise, sessions: input.sessions, certificates: input.certificates });
  const sailing = `${cruise.shipName} sailing ${String(cruise.sailDate).slice(0, 10)}`;
  const pointEvidenceDescription = `${truth.points.source} ${truth.points.formula ?? ''}`;
  const isCertificatePointFloor = truth.points.kind === 'estimated' && /certificate|threshold|floor/i.test(pointEvidenceDescription);
  const text = truth.points.value == null
    ? `Your latest matching cruise was ${sailing}, but it does not have a recorded or defensibly derived casino-points total. I will not treat a missing value as zero.`
    : isCertificatePointFloor
      ? `The available certificate evidence establishes at least ${truth.points.value.toLocaleString()} casino points for your latest matching cruise, ${sailing}. The exact earned total is still pending a provider result or saved cruise closeout.`
      : truth.points.kind === 'estimated'
        ? `The best available estimate is ${truth.points.value.toLocaleString()} casino points for your latest matching cruise, ${sailing}. That figure is not a provider-recorded total.`
        : `You earned ${truth.points.value.toLocaleString()} casino points on your latest matching cruise, ${sailing}. That is the saved cruise-level points value.`;
  return {
    intent: 'last_cruise_points',
    text,
    evidence: `${sailing}; points source: ${truth.points.source}; evidence kind: ${truth.points.kind}${truth.points.formula ? `; formula: ${truth.points.formula}` : ''}.`,
    cruiseIds: [cruise.id],
    route: `/cruise-details?id=${encodeURIComponent(cruise.id)}`,
  };
}

function buildOverviewAnswer(question: string, overview?: AskMyDataOverview): AgentSeaDirectAnswer | null {
  if (!overview) return null;
  const query = normalized(question);
  const asksCasinoOverview = /casino/.test(query) && /overview|summary|performance|how am i doing/.test(query);
  const asksRoi = /\broi\b|return on investment|casino return|cruise value/.test(query);
  if (!asksCasinoOverview && !asksRoi) return null;
  const totals = overview.annual.totals;
  if (asksRoi) {
    return {
      intent: 'casino_roi',
      text: `Your annual cash ROI is ${overview.annual.roiStyle.netRoiOnPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}%. You paid ${money(totals.totalPaid)}, brought home ${money(totals.totalWinningsHome)} in winnings, and captured ${money(totals.totalCruiseValueCaptured)} in cruise value across ${totals.cruises.toLocaleString()} completed cruises. Coin-in is excluded from profit and value capture.`,
      evidence: `Annual owner-scoped cruise economics; cash ROI = cash result ÷ paid cost; retail and coin-in are not treated as cash profit.`,
      cruiseIds: [],
      route: '/casino?tab=charts',
    };
  }
  return {
    intent: 'casino_overview',
    text: `Your current Club Royale season has ${overview.currentSeason.points.toLocaleString()} points across ${overview.currentSeason.cruises.toLocaleString()} cruise${overview.currentSeason.cruises === 1 ? '' : 's'}, with ${overview.currentSeason.pointsNeededForSignature.toLocaleString()} points remaining to keep Signature. Your annual completed-cruise record shows ${totals.totalPoints.toLocaleString()} points, ${money(totals.totalCoinIn)} coin-in volume, ${money(totals.totalWinningsHome)} brought home, and ${money(totals.totalCashResult)} cash result. Coin-in is gaming volume, not profit.`,
    evidence: `${overview.dataFreshnessLabel} Current points source: ${overview.pointBalanceSource}.`,
    cruiseIds: [],
    route: '/casino?tab=overview',
  };
}

function buildLoyaltyAnswer(question: string, loyalty?: AgentSeaLoyaltySnapshot): AgentSeaDirectAnswer | null {
  const query = normalized(question);
  const asksLoyalty = /loyalty|loyalty status|club royale|crown and anchor|crown anchor|blue chip|captain s club/.test(query)
    || (/\btier\b/.test(query) && /my|current|royale|anchor|chip|captain/.test(query));
  if (!loyalty || !asksLoyalty) return null;
  return {
    intent: 'loyalty_status',
    text: `Your saved loyalty status is Club Royale ${loyalty.clubRoyaleTier} with ${loyalty.clubRoyalePoints.toLocaleString()} current points, Crown & Anchor ${loyalty.crownAnchorLevel} with ${loyalty.crownAnchorPoints.toLocaleString()} points, and Blue Chip Club ${loyalty.blueChipTier} with ${loyalty.blueChipPoints.toLocaleString()} points.`,
    evidence: `Club Royale points source: ${loyalty.clubRoyalePointsSource}; values are owner-scoped current provider/manual app state.`,
    cruiseIds: [],
    route: '/casino?tab=overview',
  };
}

function requestedCruiseCount(question: string): 'booked' | 'completed' | null {
  const normalized = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const requestsCount = /\bhow many\b|\bcount\b|\btotal\b|\bnumber of\b/.test(normalized);
  if (!requestsCount || !/\bcruis(?:e|es)\b/.test(normalized)) return null;
  if (/\bcompleted\b|\bpast\b|\bfinished\b/.test(normalized)) return 'completed';
  if (/\bbooked\b|\bupcoming\b|\bfuture\b|\bnext\b/.test(normalized)) return 'booked';
  return null;
}

function buildCruiseCountAnswer(input: {
  question: string;
  bookedCruises: BookedCruise[];
  now: Date;
}): AgentSeaDirectAnswer | null {
  const requested = requestedCruiseCount(input.question);
  if (!requested) return null;
  const today = input.now.toISOString().slice(0, 10);
  const rows = input.bookedCruises.filter((cruise) => {
    const status = String(cruise.status ?? '').trim().toLowerCase();
    if (status === 'cancelled' || status === 'canceled') return false;
    const endDate = String(cruise.returnDate || cruise.sailDate || '').slice(0, 10);
    const completed = status === 'completed' || Boolean(endDate && endDate < today);
    return requested === 'completed' ? completed : !completed;
  }).sort((left, right) => String(left.sailDate ?? '').localeCompare(String(right.sailDate ?? '')));
  const noun = requested === 'completed' ? 'completed cruise' : 'upcoming booked cruise';
  const countText = `${rows.length.toLocaleString()} ${noun}${rows.length === 1 ? '' : 's'}`;
  const nextRows = rows.slice(0, 3).map((cruise) => `${cruise.shipName || 'Unnamed ship'} on ${String(cruise.sailDate || 'date not recorded').slice(0, 10)}`);
  return {
    intent: requested === 'completed' ? 'completed_cruise_count' : 'booked_cruise_count',
    text: `You have ${countText} in the active Agent SEA profile scope.${nextRows.length > 0 ? `\n\n${requested === 'completed' ? 'Most relevant records' : 'Next on your calendar'}: ${nextRows.join('; ')}.` : ''}`,
    evidence: `${input.bookedCruises.length.toLocaleString()} owner-scoped booked/completed record${input.bookedCruises.length === 1 ? '' : 's'} checked as of ${today}; cancelled records excluded.`,
    cruiseIds: rows.map((row) => row.id),
    route: '/(tabs)/booked',
  };
}

function buildTruthRows(input: {
  bookedCruises: BookedCruise[];
  sessions: CasinoSession[];
  certificates: CasinoCertificateRecord[];
  program: CasinoProgramId;
  now: Date;
}): { rows: CasinoCruiseTruth[]; seasonLabel: string } {
  const season = getCasinoProgramSeason(input.program, input.now);
  const rows = input.bookedCruises
    .map((cruise) => buildCasinoCruiseTruth({
      cruise,
      sessions: input.sessions,
      certificates: input.certificates,
    }))
    .filter((truth) => truth.program === input.program && isDateInCasinoSeason(truth.sailDate, season));
  return { rows, seasonLabel: season.label };
}

/**
 * Handles calculation questions that must never degrade into broad text search.
 * The AI may explain this result conversationally, but it cannot replace the
 * owner-scoped calculation or its evidence.
 */
export function buildAgentSeaDirectAnswer(input: {
  question: string;
  bookedCruises: BookedCruise[];
  sessions?: CasinoSession[];
  certificates?: CasinoCertificateRecord[];
  selectedProgram?: string;
  overview?: AskMyDataOverview;
  loyalty?: AgentSeaLoyaltySnapshot;
  now?: Date;
}): AgentSeaDirectAnswer | null {
  const now = input.now ?? new Date();
  const cruiseCountAnswer = buildCruiseCountAnswer({
    question: input.question,
    bookedCruises: input.bookedCruises,
    now,
  });
  if (cruiseCountAnswer) return cruiseCountAnswer;
  const lastCruisePoints = buildLastCruisePointsAnswer({
    question: input.question,
    bookedCruises: input.bookedCruises,
    sessions: input.sessions ?? [],
    certificates: input.certificates ?? [],
    now,
  });
  if (lastCruisePoints) return lastCruisePoints;
  const overviewAnswer = buildOverviewAnswer(input.question, input.overview);
  if (overviewAnswer) return overviewAnswer;
  const loyaltyAnswer = buildLoyaltyAnswer(input.question, input.loyalty);
  if (loyaltyAnswer) return loyaltyAnswer;
  if (!isAdtQuestion(input.question)) return null;

  const program = requestedProgram(input.question, input.selectedProgram);
  const { rows, seasonLabel } = buildTruthRows({
    bookedCruises: input.bookedCruises,
    sessions: input.sessions ?? [],
    certificates: input.certificates ?? [],
    program,
    now,
  });
  const rowsWithTheo = rows.filter((row) => row.theoreticalLoss.value != null);
  const totalTheo = rowsWithTheo.reduce((sum, row) => sum + (row.theoreticalLoss.value ?? 0), 0);
  const ratedDays = rowsWithTheo.reduce((sum, row) => sum + Math.max(0, row.ratedGamingDays || 0), 0);
  const estimatedDays = rowsWithTheo.reduce((sum, row) => sum + (row.ratedGamingDaysSource === 'casino_availability_estimate' ? Math.max(0, row.ratedGamingDays || 0) : 0), 0);
  const estimatedTheoRows = rowsWithTheo.filter((row) => row.theoreticalLoss.kind === 'estimated').length;

  if (rowsWithTheo.length === 0 || ratedDays === 0) {
    const missing = rowsWithTheo.length === 0
      ? 'no cruise in that earning year has recorded or calculable theoretical loss'
      : 'the cruises with theoretical loss do not have rated or itinerary-derived casino days';
    const text = `I can’t calculate a defensible ${seasonLabel} ADT yet because ${missing}. ADT is theoretical loss divided by rated gaming days; I will not substitute zero for missing casino evidence.`;
    return {
      intent: 'adt',
      text,
      evidence: `${seasonLabel}; ${formatCount(rows.length, 'owner-scoped cruise')} checked; ${rowsWithTheo.length.toLocaleString()} with theoretical evidence; ${formatCount(ratedDays, 'rated gaming day')}.`,
      cruiseIds: rows.map((row) => row.cruiseId),
      route: '/casino?tab=charts',
    };
  }

  const adt = totalTheo / ratedDays;
  const confidence = estimatedDays > 0 || estimatedTheoRows > 0
    ? estimatedDays === ratedDays && estimatedTheoRows === rowsWithTheo.length ? 'estimated' : 'mixed actual/estimated'
    : 'recorded/calculated';
  const programLabel = program === 'blue_chip' ? 'Blue Chip Club' : program === 'club_royale' ? 'Club Royale' : 'Carnival Players Club';
  const text = [
    `Your current ${programLabel} ADT is ${money(adt)} per rated gaming day.`,
    `That is ${money(totalTheo)} of theoretical loss divided by ${ratedDays.toLocaleString()} rated casino day${ratedDays === 1 ? '' : 's'} across ${rowsWithTheo.length.toLocaleString()} cruise${rowsWithTheo.length === 1 ? '' : 's'} in the ${seasonLabel}.`,
    `Evidence quality: ${confidence}. ${estimatedDays > 0 ? `${estimatedDays.toLocaleString()} day${estimatedDays === 1 ? '' : 's'} came from itinerary-derived casino availability; ` : ''}${estimatedTheoRows > 0 ? `${estimatedTheoRows.toLocaleString()} cruise theoretical value${estimatedTheoRows === 1 ? ' was' : 's were'} modeled from valid coin-in/hold evidence.` : 'Theoretical values were recorded rather than modeled.'}`,
  ].join('\n\n');
  const evidence = rowsWithTheo
    .slice()
    .sort((left, right) => right.sailDate.localeCompare(left.sailDate))
    .slice(0, 8)
    .map((row) => `[${row.shipName} ${row.sailDate}] theo ${money(row.theoreticalLoss.value ?? 0)} (${row.theoreticalLoss.kind}); ${formatCount(row.ratedGamingDays, 'rated day')} (${row.ratedGamingDaysSource})`)
    .join('\n');

  return {
    intent: 'adt',
    text,
    evidence,
    cruiseIds: rowsWithTheo.map((row) => row.cruiseId),
    route: '/casino?tab=charts',
  };
}
