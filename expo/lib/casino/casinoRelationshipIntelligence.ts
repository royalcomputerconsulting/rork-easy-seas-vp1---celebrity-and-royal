import type { CasinoSession } from '@/state/CasinoSessionProvider';
import type { BookedCruise, CasinoOffer } from '@/types/models';

export type EvidenceSource = 'actual' | 'provider_reported' | 'user_entered' | 'estimated' | 'missing';

export interface EvidenceMetric {
  value: number | null;
  source: EvidenceSource;
  formula: string;
  explanation: string;
}

export interface CasinoTripReport {
  cruiseId: string;
  ship: string;
  sailDate: string;
  nights: number;
  sessionCount: number;
  hours: EvidenceMetric;
  cashResult: EvidenceMetric;
  hourlyWinLoss: EvidenceMetric;
  points: EvidenceMetric;
  pointsPerHour: EvidenceMetric;
  coinIn: EvidenceMetric;
  theoreticalLoss: EvidenceMetric;
  actualVsTheoretical: EvidenceMetric;
  recordedComps: EvidenceMetric;
  compReinvestmentPercent: EvidenceMetric;
  freePlayUsed: EvidenceMetric;
  freePlayOutcomeProxy: EvidenceMetric;
  trueCruiseCasinoRoi: EvidenceMetric;
  casinoCostPerNight: EvidenceMetric;
  warnings: string[];
}

export interface PointsPaceSnapshot {
  currentPoints: EvidenceMetric;
  historicalPointsPerCruise: EvidenceMetric;
  historicalPointsPerNight: EvidenceMetric;
  futureCruises: number;
  futureNights: number;
  projectedSeasonPoints: EvidenceMetric;
  nextTier: string | null;
  nextTierThreshold: number | null;
  pointsToNextTier: number;
  requiredPointsPerFutureCruise: EvidenceMetric;
  requiredPointsPerFutureNight: EvidenceMetric;
}

export interface TierSimulationRow {
  label: string;
  additionalCruises: number;
  projectedPoints: number;
  projectedTier: string;
  source: EvidenceSource;
}

export interface OfferResponseBand {
  key: string;
  label: string;
  completedCruises: number;
  averagePoints: number | null;
  subsequentOfferInstances: number;
  averageSubsequentOfferValue: number | null;
  source: EvidenceSource;
  explanation: string;
}

export interface PlayerWorthSnapshot {
  trackedTrips: number;
  trackedHours: EvidenceMetric;
  recordedCoinIn: EvidenceMetric;
  estimatedTheoreticalLoss: EvidenceMetric;
  recordedCashResult: EvidenceMetric;
  capturedCruiseValue: EvidenceMetric;
  offeredValue: EvidenceMetric;
  relationshipValueProxy: EvidenceMetric;
  warning: string;
}

export interface CasinoRelationshipSnapshot {
  trips: CasinoTripReport[];
  portfolioHourlyWinLoss: EvidenceMetric;
  pointsPace: PointsPaceSnapshot;
  tierSimulation: TierSimulationRow[];
  offerResponse: OfferResponseBand[];
  playerWorth: PlayerWorthSnapshot;
}

const TIERS = [
  { name: 'Choice', threshold: 0 },
  { name: 'Prime', threshold: 2501 },
  { name: 'Signature', threshold: 25001 },
  { name: 'Masters', threshold: 100001 },
] as const;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegative = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const signed = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const sum = (values: Array<number | null>) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
const metric = (value: number | null, source: EvidenceSource, formula: string, explanation: string): EvidenceMetric => ({
  value: value == null ? null : round2(value), source: value == null ? 'missing' : source, formula, explanation,
});

function cruiseSource(cruise: BookedCruise): EvidenceSource {
  if (cruise.sourceAuthority === 'provider' || cruise.sourceAuthority === 'public_document') return 'provider_reported';
  if (cruise.sourceAuthority === 'user_entered') return 'user_entered';
  if (cruise.calculationConfidence === 'actual') return 'actual';
  if (cruise.calculationConfidence === 'estimated' || cruise.calculationConfidence === 'mixed') return 'estimated';
  return 'user_entered';
}

function offerValue(offer: CasinoOffer): number {
  const cabin = nonNegative(offer.retailCabinValue) ?? nonNegative(offer.totalValue) ?? nonNegative(offer.offerValue) ?? nonNegative(offer.value) ?? 0;
  return cabin + (nonNegative(offer.freePlay ?? offer.freeplayAmount) ?? 0) + (nonNegative(offer.OBC ?? offer.obcAmount) ?? 0);
}

function capturedValue(cruise: BookedCruise): number | null {
  return nonNegative(cruise.cruiseValueCaptured)
    ?? nonNegative(cruise.totalCasinoDiscount)
    ?? nonNegative(cruise.compValue)
    ?? nonNegative(cruise.offerValue);
}

function tierFor(points: number): string {
  return [...TIERS].reverse().find((tier) => points >= tier.threshold)?.name ?? 'Choice';
}

function nextTierFor(points: number): { name: string; threshold: number } | null {
  return TIERS.find((tier) => tier.threshold > points) ?? null;
}

function isCompleted(cruise: BookedCruise, nowDate: string): boolean {
  return cruise.completionState === 'completed' || cruise.status === 'completed' || Boolean(cruise.returnDate && cruise.returnDate < nowDate);
}

function sessionResult(session: CasinoSession): number | null {
  const direct = signed(session.winLoss);
  if (direct != null) return direct;
  const buyIn = nonNegative(session.buyIn);
  const cashOut = nonNegative(session.cashOut);
  const separateHandpay = session.handpayIncludedInCashOut ? 0 : (nonNegative(session.handpayAmount ?? session.jackpotAmount) ?? 0);
  return buyIn != null && cashOut != null ? cashOut + separateHandpay - buyIn : null;
}

function isGeneratedSession(session: CasinoSession): boolean {
  return session.recordKind === 'generated' || /auto-calculated|generated|estimated historical/i.test(session.notes ?? '');
}

export function buildCasinoTripReport(cruise: BookedCruise, sessions: CasinoSession[]): CasinoTripReport {
  const relevant = sessions.filter((session) => session.cruiseId === cruise.id && !isGeneratedSession(session));
  const recordedSessionHours = sum(relevant.map((session) => nonNegative(session.durationMinutes) == null ? null : nonNegative(session.durationMinutes)! / 60));
  const cruiseHours = nonNegative(cruise.hoursPlayed);
  const hoursValue = recordedSessionHours > 0 ? recordedSessionHours : cruiseHours;
  const hours = metric(hoursValue, recordedSessionHours > 0 ? 'actual' : cruiseSource(cruise), recordedSessionHours > 0 ? 'sum(session duration) / 60' : 'cruise.hoursPlayed', recordedSessionHours > 0 ? 'Total from locally saved casino sessions.' : 'Saved cruise closeout hours.');

  const recordedResults = relevant.map(sessionResult).filter((value): value is number => value != null);
  const sessionCash = recordedResults.length > 0 ? sum(recordedResults) : null;
  const cruiseCash = signed(cruise.cashResult ?? cruise.netResult);
  const cashValue = sessionCash ?? cruiseCash;
  const cashResult = metric(cashValue, sessionCash != null ? 'actual' : cruiseSource(cruise), sessionCash != null ? 'sum(session win/loss)' : 'cruise cash result', 'Positive is a win; negative is a loss.');
  const hourlyWinLoss = metric(cashValue != null && hoursValue != null && hoursValue > 0 ? cashValue / hoursValue : null, sessionCash != null && recordedSessionHours > 0 ? 'actual' : cashValue == null || hoursValue == null ? 'missing' : cruiseSource(cruise), 'cash result / tracked hours', 'This is observed cash variance per hour, not expected future performance.');

  const sessionPoints = sum(relevant.map((session) => nonNegative(session.pointsEarned)));
  const cruisePoints = nonNegative(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints);
  const pointsValue = sessionPoints > 0 ? sessionPoints : cruisePoints;
  const points = metric(pointsValue, sessionPoints > 0 ? 'actual' : cruiseSource(cruise), sessionPoints > 0 ? 'sum(session points)' : 'cruise points', 'Points are never converted across casino programs without a documented program rule.');
  const pointsPerHour = metric(pointsValue != null && hoursValue != null && hoursValue > 0 ? pointsValue / hoursValue : null, sessionPoints > 0 && recordedSessionHours > 0 ? 'actual' : pointsValue == null || hoursValue == null ? 'missing' : cruiseSource(cruise), 'points / tracked hours', 'Observed earning pace for this trip.');

  const sessionCoinIn = sum(relevant.map((session) => nonNegative((session as CasinoSession & { coinIn?: number }).coinIn)));
  const cruiseCoinIn = nonNegative(cruise.coinIn);
  const coinInValue = sessionCoinIn > 0 ? sessionCoinIn : cruiseCoinIn;
  const coinIn = metric(coinInValue, sessionCoinIn > 0 ? 'actual' : cruiseSource(cruise), sessionCoinIn > 0 ? 'sum(session coin-in)' : 'cruise.coinIn', 'Coin-in is wagering volume, not money lost.');
  const recordedTheo = nonNegative(cruise.theoreticalLoss);
  const hold = nonNegative(cruise.houseEdge) ?? 0.08;
  const theoValue = recordedTheo ?? (coinInValue != null ? coinInValue * hold : null);
  const theoreticalLoss = metric(theoValue, recordedTheo != null ? cruiseSource(cruise) : coinInValue == null ? 'missing' : 'estimated', recordedTheo != null ? 'recorded theoretical loss' : `coin-in × ${round2(hold * 100)}% hold`, recordedTheo != null ? 'Saved/provider theoretical loss.' : 'Estimate using the saved house edge or an 8% assumption.');
  const actualLoss = cashValue != null ? Math.max(0, -cashValue) : null;
  const actualVsTheoretical = metric(actualLoss != null && theoValue != null && theoValue > 0 ? (actualLoss / theoValue) * 100 : null, recordedTheo != null && cashValue != null ? 'actual' : actualLoss == null || theoValue == null ? 'missing' : 'estimated', 'actual cash loss / theoretical loss × 100', 'Below 100% ran better than theoretical; above 100% ran worse. Short-term variance can be large.');

  const freePlayValue = sum(relevant.map((session) => nonNegative(session.freePlayUsed)));
  const compValue = sum(relevant.map((session) => nonNegative(session.compsReceived))) + (nonNegative(cruise.hostCompsReceived) ?? 0);
  const freePlayUsed = metric(freePlayValue > 0 ? freePlayValue : null, freePlayValue > 0 ? 'actual' : 'missing', 'sum(session free play used)', 'Only explicitly recorded FreePlay is included.');
  const recordedComps = metric(compValue > 0 ? compValue : null, compValue > 0 ? 'actual' : 'missing', 'session comps + host comps', 'Only explicitly saved comps are included.');
  const compReinvestmentPercent = metric(theoValue != null && theoValue > 0 && (compValue + freePlayValue) > 0 ? ((compValue + freePlayValue) / theoValue) * 100 : null, recordedTheo != null ? 'actual' : theoValue == null ? 'missing' : 'estimated', '(recorded comps + FreePlay) / theoretical loss × 100', 'Observed reinvestment proxy; it is not a promise of future benefits.');
  const freePlayOutcomeProxy = metric(freePlayValue > 0 && cashValue != null ? (cashValue / freePlayValue) * 100 : null, freePlayValue > 0 && cashValue != null ? 'estimated' : 'missing', 'whole-trip cash result / FreePlay used × 100', 'A limited proxy only: saved sessions do not isolate wins produced by FreePlay from cash play.');

  const paid = nonNegative(cruise.netEffectivePaid ?? cruise.amountPaid ?? cruise.pricePaid);
  const captured = capturedValue(cruise);
  const relationshipReturn = (captured ?? 0) + compValue + freePlayValue + (cashValue ?? 0);
  const trueCruiseCasinoRoi = metric(paid != null && paid > 0 ? ((relationshipReturn - paid) / paid) * 100 : null, cashValue != null && captured != null ? 'actual' : paid == null ? 'missing' : 'estimated', '(captured cruise value + comps + FreePlay + cash result − paid) / paid × 100', 'Value ROI includes non-cash cruise value; it is not a gambling-profit claim.');
  const totalCost = paid == null && cashValue == null ? null : (paid ?? 0) - (cashValue ?? 0);
  const nights = Math.max(1, nonNegative(cruise.nights) ?? 1);
  const casinoCostPerNight = metric(totalCost != null ? totalCost / nights : null, cashValue != null && paid != null ? 'actual' : totalCost == null ? 'missing' : 'estimated', '(amount paid − cash result) / cruise nights', 'Positive is net out-of-pocket cost per cruise night before valuing comps.');

  return {
    cruiseId: cruise.id, ship: cruise.shipName || 'Unknown ship', sailDate: cruise.sailDate, nights, sessionCount: relevant.length,
    hours, cashResult, hourlyWinLoss, points, pointsPerHour, coinIn, theoreticalLoss, actualVsTheoretical,
    recordedComps, compReinvestmentPercent, freePlayUsed, freePlayOutcomeProxy, trueCruiseCasinoRoi, casinoCostPerNight,
    warnings: ['Observed win/loss is historical variance, not a forecast.', 'Estimated metrics remain visibly labeled and are excluded when required inputs are missing.'],
  };
}

export function buildPointsPace(cruises: BookedCruise[], currentPoints: number, now = new Date(), currentPointsSource: EvidenceSource = 'provider_reported'): PointsPaceSnapshot {
  const today = now.toISOString().slice(0, 10);
  const completed = cruises.filter((cruise) => isCompleted(cruise, today));
  const future = cruises.filter((cruise) => cruise.status !== 'cancelled' && cruise.sailDate >= today);
  const completedPoints = completed.map((cruise) => nonNegative(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints)).filter((value): value is number => value != null);
  const pointsTotal = sum(completedPoints);
  const nightsWithPoints = completed.reduce((total, cruise) => total + ((nonNegative(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints) ?? 0) > 0 ? Math.max(1, nonNegative(cruise.nights) ?? 1) : 0), 0);
  const avgCruise = completedPoints.length > 0 ? pointsTotal / completedPoints.length : null;
  const avgNight = nightsWithPoints > 0 ? pointsTotal / nightsWithPoints : null;
  const futureNights = future.reduce((total, cruise) => total + Math.max(1, nonNegative(cruise.nights) ?? 1), 0);
  const projection = avgNight != null ? currentPoints + (avgNight * futureNights) : avgCruise != null ? currentPoints + (avgCruise * future.length) : null;
  const next = nextTierFor(currentPoints);
  const gap = next ? Math.max(0, next.threshold - currentPoints) : 0;
  return {
    currentPoints: metric(Math.max(0, currentPoints), currentPointsSource, 'current saved Club Royale balance', 'Uses the active loyalty profile balance.'),
    historicalPointsPerCruise: metric(avgCruise, completedPoints.length > 0 ? 'actual' : 'missing', 'completed cruise points / cruises with points', 'Only completed cruises with recorded points are included.'),
    historicalPointsPerNight: metric(avgNight, nightsWithPoints > 0 ? 'actual' : 'missing', 'completed cruise points / corresponding nights', 'Observed historical pace, not a play recommendation.'),
    futureCruises: future.length, futureNights,
    projectedSeasonPoints: metric(projection, projection == null ? 'missing' : 'estimated', 'current points + historical pace × booked future cruises', 'Scenario only; it assumes past recorded pace continues.'),
    nextTier: next?.name ?? null, nextTierThreshold: next?.threshold ?? null, pointsToNextTier: gap,
    requiredPointsPerFutureCruise: metric(next && future.length > 0 ? gap / future.length : null, next && future.length > 0 ? 'estimated' : 'missing', 'points gap / booked future cruises', 'Planning math only; no tier is worth exceeding a personal loss limit.'),
    requiredPointsPerFutureNight: metric(next && futureNights > 0 ? gap / futureNights : null, next && futureNights > 0 ? 'estimated' : 'missing', 'points gap / booked future nights', 'Planning math only; it is not a direction to gamble.'),
  };
}

export function buildTierSimulation(currentPoints: number, historicalPointsPerCruise: number | null): TierSimulationRow[] {
  return [0, 1, 2, 3, 5].map((additionalCruises) => {
    const projectedPoints = Math.round(currentPoints + ((historicalPointsPerCruise ?? 0) * additionalCruises));
    return { label: additionalCruises === 0 ? 'Current balance' : `After ${additionalCruises} similar cruise${additionalCruises === 1 ? '' : 's'}`, additionalCruises, projectedPoints, projectedTier: tierFor(projectedPoints), source: additionalCruises === 0 ? 'provider_reported' : historicalPointsPerCruise == null ? 'missing' : 'estimated' };
  });
}

export function buildOfferResponseAnalysis(cruises: BookedCruise[], offers: CasinoOffer[], now = new Date()): OfferResponseBand[] {
  const today = now.toISOString().slice(0, 10);
  const completed = cruises.filter((cruise) => isCompleted(cruise, today)).sort((a, b) => a.returnDate.localeCompare(b.returnDate));
  const datedOffers = offers.map((offer) => ({ offer, receivedAt: String(offer.received || offer.createdAt || '').slice(0, 10), value: offerValue(offer) })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.receivedAt));
  const definitions = [
    { key: 'under-2500', label: 'Under 2,500 points', min: 0, max: 2499 },
    { key: '2500-9999', label: '2,500–9,999 points', min: 2500, max: 9999 },
    { key: '10000-24999', label: '10,000–24,999 points', min: 10000, max: 24999 },
    { key: '25000-plus', label: '25,000+ points', min: 25000, max: Number.POSITIVE_INFINITY },
  ];
  return definitions.map((definition) => {
    const trips = completed.filter((cruise) => {
      const points = nonNegative(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints);
      return points != null && points >= definition.min && points <= definition.max;
    });
    const followingValues: number[] = [];
    trips.forEach((cruise) => {
      const nextTrip = completed.find((candidate) => candidate.sailDate > cruise.returnDate);
      datedOffers.filter((row) => row.receivedAt > cruise.returnDate && (!nextTrip || row.receivedAt < nextTrip.sailDate)).forEach((row) => followingValues.push(row.value));
    });
    const points = trips.map((cruise) => nonNegative(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints)).filter((value): value is number => value != null);
    return {
      key: definition.key, label: definition.label, completedCruises: trips.length,
      averagePoints: points.length > 0 ? round2(sum(points) / points.length) : null,
      subsequentOfferInstances: followingValues.length,
      averageSubsequentOfferValue: followingValues.length > 0 ? round2(sum(followingValues) / followingValues.length) : null,
      source: trips.length > 0 && followingValues.length > 0 ? 'estimated' : 'missing',
      explanation: 'Temporal correlation only: offers received after a cruise and before the next recorded cruise. It does not claim the cruise caused the offer.',
    };
  });
}

export function buildCasinoRelationshipSnapshot(input: { cruises: BookedCruise[]; sessions: CasinoSession[]; offers: CasinoOffer[]; currentPoints: number; currentPointsSource?: EvidenceSource; now?: Date }): CasinoRelationshipSnapshot {
  const now = input.now ?? new Date();
  const trips = input.cruises.map((cruise) => buildCasinoTripReport(cruise, input.sessions));
  const tripsWithCash = trips.filter((trip) => trip.cashResult.value != null && trip.hours.value != null && trip.hours.value > 0);
  const trackedHours = sum(tripsWithCash.map((trip) => trip.hours.value));
  const trackedCash = sum(tripsWithCash.map((trip) => trip.cashResult.value));
  const pointsPace = buildPointsPace(input.cruises, input.currentPoints, now, input.currentPointsSource);
  const totalCoinIn = sum(trips.map((trip) => trip.coinIn.value));
  const totalTheo = sum(trips.map((trip) => trip.theoreticalLoss.value));
  const totalCaptured = sum(input.cruises.map(capturedValue));
  const totalOffered = sum(input.offers.map((offer) => offerValue(offer)));
  return {
    trips,
    portfolioHourlyWinLoss: metric(tripsWithCash.length > 0 && trackedHours > 0 ? trackedCash / trackedHours : null, tripsWithCash.length > 0 ? 'actual' : 'missing', 'sum tracked cash result / sum tracked hours', 'Portfolio observed cash variance per tracked hour.'),
    pointsPace,
    tierSimulation: buildTierSimulation(input.currentPoints, pointsPace.historicalPointsPerCruise.value),
    offerResponse: buildOfferResponseAnalysis(input.cruises, input.offers, now),
    playerWorth: {
      trackedTrips: trips.length,
      trackedHours: metric(trackedHours > 0 ? trackedHours : null, trackedHours > 0 ? 'actual' : 'missing', 'sum tracked trip hours', 'Hours with saved cruise/session evidence.'),
      recordedCoinIn: metric(totalCoinIn > 0 ? totalCoinIn : null, trips.some((trip) => trip.coinIn.value != null) ? 'actual' : 'missing', 'sum recorded trip coin-in', 'Wagering volume, not loss.'),
      estimatedTheoreticalLoss: metric(totalTheo > 0 ? totalTheo : null, trips.some((trip) => trip.theoreticalLoss.source === 'estimated') ? 'estimated' : totalTheo > 0 ? 'actual' : 'missing', 'sum trip theoretical loss', 'Includes only displayed recorded/estimated trip theo.'),
      recordedCashResult: metric(trips.some((trip) => trip.cashResult.value != null) ? trackedCash : null, trips.some((trip) => trip.cashResult.value != null) ? 'actual' : 'missing', 'sum recorded trip cash results', 'Historical result; not predictive.'),
      capturedCruiseValue: metric(totalCaptured > 0 ? totalCaptured : null, totalCaptured > 0 ? 'provider_reported' : 'missing', 'sum saved captured cruise value', 'Value attached to booked/redeemed cruises.'),
      offeredValue: metric(totalOffered > 0 ? totalOffered : null, totalOffered > 0 ? 'provider_reported' : 'missing', 'sum unique saved offer-instance value', 'Marketing codes are not deduplicated; each saved provider offer instance remains separate.'),
      relationshipValueProxy: metric((totalTheo + totalCaptured + totalOffered) > 0 ? totalTheo + totalCaptured + totalOffered : null, 'estimated', 'theoretical loss + captured value + offered value', 'Relationship dashboard proxy only. It is not the cruise line’s proprietary player valuation or an entitlement.'),
      warning: 'EasySeas cannot know a cruise line’s internal player-worth formula. This dashboard shows transparent saved evidence and labeled estimates only.',
    },
  };
}
