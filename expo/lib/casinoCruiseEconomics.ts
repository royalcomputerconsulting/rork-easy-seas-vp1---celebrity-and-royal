import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import { createDateFromString } from '@/lib/date';
import { calculateCruiseValue, type ValueBreakdown } from '@/lib/valueCalculator';
import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';
import {
  CONFIRMED_CLUB_ROYALE_2025_COIN_IN,
  CONFIRMED_CLUB_ROYALE_2025_NET_CASH_RESULT,
  CONFIRMED_CLUB_ROYALE_2025_POINTS,
  CONFIRMED_CLUB_ROYALE_2025_WINNINGS_HOME,
  DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR,
  isClubRoyaleCasinoCruise,
  normalizeCruiseCasinoPerformance,
} from '@/lib/casinoPointTruth';
import { ANNUAL_CASINO_REPORT_FACTS, type AnnualCasinoHistoricalFact } from '@/lib/casinoAnnualReportFacts';
import { applyOwnerScopedCasinoHistoryToCruises, SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID } from '@/lib/casino/ownerScopedCasinoHistory';
import { buildCanonicalBookedVoyages } from '@/lib/bookedVoyageRelationships';

export { ANNUAL_CASINO_REPORT_FACTS } from '@/lib/casinoAnnualReportFacts';

export type CruiseEconomicsStatus = 'actual' | 'estimated' | 'mixed';

export interface CruiseEconomicsRow {
  cruiseId: string;
  ship: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  brand: string;
  status: 'completed' | 'booked' | 'other';
  retailValue: number | null;
  amountPaid: number | null;
  taxesFeesEstimate: number | null;
  nextCruiseOffsetApplied: boolean | null;
  netEffectivePaid: number | null;
  winningsBroughtHome: number | null;
  casinoChargesRoomBilled: number | null;
  coinIn: number | null;
  houseEdge: number | null;
  pointsEarned: number | null;
  pointDollarValue: number | null;
  pointValueEarned: number | null;
  hoursPlayed: number | null;
  cashResult: number | null;
  cruiseValueCaptured: number | null;
  totalEconomicValue: number | null;
  theoreticalLoss: number | null;
  netTheoretical: number | null;
  coinInPerHour: number | null;
  pointsPerHour: number | null;
  valuePerHour: number | null;
  calculationConfidence: CruiseEconomicsStatus;
  notes: string | null;
  retail: number;
  paid: number;
  discount: number;
  points: number;
  winningsHome: number;
  netCash: number;
  totalEconomic: number;
  pointValue: number;
  pointsPerNight: number;
}

export interface CruiseEconomicsTotals {
  cruises: number;
  totalNights: number;
  totalRetail: number;
  totalPaid: number;
  totalDiscount: number;
  totalPoints: number;
  totalWinningsHome: number;
  totalNetCash: number;
  totalRetailValue: number;
  totalCruiseValueCaptured: number;
  totalCashResult: number;
  totalEconomicValue: number;
  totalCoinIn: number;
  totalHours: number;
  totalTheoreticalLoss: number;
  totalPointValueEarned: number;
  totalNetTheoretical: number;
  totalRowsWithEstimatedValues: number;
  hasEstimates: boolean;
}

export interface CruiseEconomicsAverages {
  nightsPerCruise: number;
  retailPerCruise: number;
  paidPerCruise: number;
  winningsPerCruise: number;
  pointsPerCruise: number;
  netCashPerCruise: number;
  totalEconomicValuePerCruise: number;
  pointsPerNight: number;
}

export interface CruiseEconomicsROIStyleSummary {
  paidAsPercentOfRetail: number;
  compCoverage: number;
  retailToPaidMultiple: number;
  winningsMultipleVsPaid: number;
  netRoiOnPaid: number;
  cashROI: number;
  cruiseValueMultiple: number;
  compCoverageRate: number;
  winningsMultiple: number;
  valuePerHour: number;
}

export interface CruiseEconomicsSnapshots {
  bestCashCruise: CruiseEconomicsRow | null;
  biggestCompValueCruise: CruiseEconomicsRow | null;
  bestPointsCruise: CruiseEconomicsRow | null;
  bestPointsPerNightCruise: CruiseEconomicsRow | null;
  weakestPointsCruise: CruiseEconomicsRow | null;
  bestEconomicValueCruise: CruiseEconomicsRow | null;
}

export interface CruiseEconomicsSummary {
  rows: CruiseEconomicsRow[];
  totals: CruiseEconomicsTotals;
  averages: CruiseEconomicsAverages;
  roiStyle: CruiseEconomicsROIStyleSummary;
  snapshots: CruiseEconomicsSnapshots;
  footnotes: string[];
}

interface CruiseEconomicsSummaryOptions {
  minimumTotalPoints?: number;
  pointsAdjustmentNote?: string;
  useKnownAnnualReportFacts?: boolean;
  scope?: 'annualCompletedRoyal' | 'completedOnly' | 'allCruises';
}

const ANNUAL_SCOPE_START = '2025-04-01' as const;
const ANNUAL_SCOPE_END = '2026-04-01' as const;
const DEFAULT_HOUSE_EDGE = 0.08;
const DEFAULT_POINT_DOLLAR_VALUE = 0.01;
const CONFIRMED_CLUB_ROYALE_2025_RETAIL_VALUE_FLOOR = 47774;
const CONFIRMED_CLUB_ROYALE_2025_PAID = 4238.41;
const DEFAULT_PORT_FEE_PER_PERSON_FOR_7_NIGHTS = 162;

interface TaxesFeesEstimateInfo {
  value: number;
  rawValue: number | null;
  isEstimated: boolean;
  wasNormalized: boolean;
  note: string | null;
}

function getAnnualFactKey(ship: string | undefined, sailDate: string | undefined): string {
  return `${(ship ?? '').trim().toLowerCase()}|${(sailDate ?? '').trim()}`;
}

const ANNUAL_CASINO_REPORT_FACTS_BY_KEY = new Map(
  ANNUAL_CASINO_REPORT_FACTS.map((fact) => [getAnnualFactKey(fact.ship, fact.sailDate), fact]),
);

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getFirstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (isNumber(value)) {
      return value;
    }
  }

  return null;
}

function getCruiseBrand(cruise: BookedCruise): string {
  const normalizedBrand = (cruise.brand ?? '').trim().toLowerCase();
  if (normalizedBrand === 'royal' || normalizedBrand.includes('royal caribbean')) {
    return 'Royal Caribbean';
  }

  if (normalizedBrand.includes('celebrity')) {
    return 'Celebrity';
  }

  if (normalizedBrand.includes('carnival')) {
    return 'Carnival';
  }

  if (cruise.cruiseSource === 'royal' || isRoyalCaribbeanShip(cruise.shipName || '')) {
    return 'Royal Caribbean';
  }

  if (cruise.cruiseSource === 'celebrity') {
    return 'Celebrity';
  }

  if (cruise.cruiseSource === 'carnival') {
    return 'Carnival';
  }

  if (cruise.brand && cruise.brand.trim().length > 0) {
    return cruise.brand;
  }

  return 'Other';
}

function getCruiseStatus(cruise: BookedCruise, today: Date): 'completed' | 'booked' | 'other' {
  if (cruise.status === 'cancelled') {
    return 'other';
  }

  if (cruise.completionState === 'completed' || cruise.status === 'completed') {
    return 'completed';
  }

  if (cruise.returnDate) {
    const returnDate = createDateFromString(cruise.returnDate);
    if (returnDate.getTime() < today.getTime()) {
      return 'completed';
    }
  }

  if (cruise.status === 'booked' || cruise.completionState === 'upcoming' || cruise.bookingStatus === 'booked') {
    return 'booked';
  }

  return 'other';
}

function inAnnualScope(cruise: BookedCruise, today: Date): boolean {
  const brand = getCruiseBrand(cruise);
  const status = getCruiseStatus(cruise, today);
  const sailDate = cruise.sailDate || '';

  return brand === 'Royal Caribbean'
    && isClubRoyaleCasinoCruise(cruise)
    && status === 'completed'
    && sailDate >= ANNUAL_SCOPE_START
    && sailDate <= ANNUAL_SCOPE_END;
}

function getAnnualCasinoFact(cruise: BookedCruise): AnnualCasinoHistoricalFact | undefined {
  return ANNUAL_CASINO_REPORT_FACTS_BY_KEY.get(getAnnualFactKey(cruise.shipName, cruise.sailDate));
}

function buildCruiseFromAnnualFact(fact: AnnualCasinoHistoricalFact): BookedCruise {
  return applyAnnualCruiseOverrides({
    id: `annual-casino-${fact.sailDate}-${fact.ship.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    shipName: fact.ship,
    sailDate: fact.sailDate,
    returnDate: fact.returnDate,
    nights: fact.nights,
    itineraryName: `${fact.nights} Night ${fact.ship}`,
    destination: 'Annual Royal Caribbean Casino Report',
    departurePort: '',
    status: 'completed',
    completionState: 'completed',
    brand: 'Royal Caribbean',
    cruiseSource: 'royal',
    guestNames: ['Scott Merlis'],
    guests: 1,
  });
}

function applyAnnualCruiseOverrides(cruise: BookedCruise): BookedCruise {
  const matchedFact = getAnnualCasinoFact(cruise);

  if (!matchedFact || cruise.casinoHistoryImportId !== SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID) {
    return cruise;
  }

  const netEffectivePaid = round2(getFirstNumber(cruise.netEffectivePaid, cruise.amountPaid, cruise.pricePaid, matchedFact.amountPaid) ?? matchedFact.amountPaid);
  const winningsBroughtHome = round2(getFirstNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, matchedFact.winningsBroughtHome) ?? matchedFact.winningsBroughtHome);
  const retailValue = round2(getFirstNumber(cruise.retailValue, cruise.totalRetailCost, cruise.originalPrice, matchedFact.retailValue) ?? matchedFact.retailValue);
  const cruiseValueCaptured = calcCruiseValueCaptured(retailValue, netEffectivePaid);
  const cashResult = calcCashResult(winningsBroughtHome, netEffectivePaid);
  const totalEconomicValue = calcTotalEconomicValue(retailValue, winningsBroughtHome, netEffectivePaid);
  const pointsEarned = Math.round(getFirstNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints, matchedFact.pointsEarned) ?? matchedFact.pointsEarned);
  const coinIn = round2(getFirstNumber(cruise.coinIn, pointsEarned * DOLLARS_PER_POINT) ?? pointsEarned * DOLLARS_PER_POINT);
  const houseEdge = getFirstNumber(cruise.houseEdge, DEFAULT_HOUSE_EDGE) ?? DEFAULT_HOUSE_EDGE;
  const pointDollarValue = getFirstNumber(cruise.pointDollarValue, DEFAULT_POINT_DOLLAR_VALUE) ?? DEFAULT_POINT_DOLLAR_VALUE;
  const theoreticalLoss = calcTheoreticalLoss(coinIn, houseEdge);
  const pointValueEarned = calcPointValue(pointsEarned, pointDollarValue);

  return {
    ...cruise,
    shipName: matchedFact.ship,
    sailDate: matchedFact.sailDate,
    returnDate: matchedFact.returnDate,
    nights: matchedFact.nights,
    brand: 'Royal Caribbean',
    cruiseSource: 'royal',
    status: 'completed',
    completionState: 'completed',
    retailValue,
    totalRetailCost: retailValue,
    originalPrice: retailValue,
    amountPaid: netEffectivePaid,
    pricePaid: netEffectivePaid,
    taxesFeesEstimate: netEffectivePaid,
    netEffectivePaid,
    nextCruiseOffsetApplied: cruise.nextCruiseOffsetApplied ?? false,
    winningsBroughtHome,
    winnings: winningsBroughtHome,
    totalWinnings: winningsBroughtHome,
    netResult: winningsBroughtHome,
    pointsEarned,
    earnedPoints: pointsEarned,
    casinoPoints: pointsEarned,
    coinIn,
    houseEdge,
    pointDollarValue,
    cashResult,
    cruiseValueCaptured,
    totalEconomicValue,
    theoreticalLoss,
    netTheoretical: calcNetTheoretical(pointValueEarned, theoreticalLoss),
    calculationConfidence: matchedFact.calculationConfidence,
    notes: [cruise.notes, matchedFact.notes, 'Annual casino report formulas: Cash Result = winnings brought home - amount paid; Coin-In stays in gaming analytics only.']
      .filter((note): note is string => Boolean(note))
      .join(' '),
  };
}

export function normalizeCruisesWithCasinoEconomics(
  cruises: BookedCruise[],
  options?: { includeKnownAnnualFacts?: boolean },
): BookedCruise[] {
  return applyOwnerScopedCasinoHistoryToCruises(cruises).map((cruise) => {
    const normalized = normalizeCruiseCasinoPerformance(cruise);
    // Never fill a user's booking from another person's historical report.
    // Verified receipt/import data remains intact; annual overrides require an
    // explicit, owner-scoped request from the caller.
    return options?.includeKnownAnnualFacts ? applyAnnualCruiseOverrides(normalized) : normalized;
  });
}

export function calcCruiseValueCaptured(retailValue: number, netEffectivePaid: number): number {
  return round2(retailValue - netEffectivePaid);
}

export function calcCashResult(winningsBroughtHome: number, netEffectivePaid: number): number {
  return round2(winningsBroughtHome - netEffectivePaid);
}

export function calcTotalEconomicValue(retailValue: number, winningsBroughtHome: number, netEffectivePaid: number): number {
  return round2(retailValue + winningsBroughtHome - netEffectivePaid);
}

export function calcTheoreticalLoss(coinIn: number, houseEdge: number): number {
  return round2(coinIn * houseEdge);
}

export function calcPointValue(pointsEarned: number, pointDollarValue: number): number {
  return round2(pointsEarned * pointDollarValue);
}

export function calcNetTheoretical(pointValueEarned: number, theoreticalLoss: number): number {
  return round2(pointValueEarned - theoreticalLoss);
}

export function calcCoinInPerHour(coinIn: number, hoursPlayed: number): number {
  if (!hoursPlayed) {
    return 0;
  }

  return round2(coinIn / hoursPlayed);
}

export function calcPointsPerHour(pointsEarned: number, hoursPlayed: number): number {
  if (!hoursPlayed) {
    return 0;
  }

  return round2(pointsEarned / hoursPlayed);
}

export function calcValuePerHour(totalEconomicValue: number, hoursPlayed: number): number {
  if (!hoursPlayed) {
    return 0;
  }

  return round2(totalEconomicValue / hoursPlayed);
}

function getEconomicsGuestCount(cruise: BookedCruise): number {
  if (isNumber(cruise.guests) && cruise.guests > 0) {
    return Math.round(cruise.guests);
  }

  return 0;
}

function estimateBookingTaxesFees(nights: number, guests: number): number | null {
  if (nights <= 0 || guests <= 0) return null;
  return round2((DEFAULT_PORT_FEE_PER_PERSON_FOR_7_NIGHTS / 7) * nights * guests);
}

function getTaxesFeesEstimate(
  cruise: BookedCruise,
  breakdown: ValueBreakdown,
): TaxesFeesEstimateInfo {
  const rawTaxesFeesEstimate = getFirstNumber(
    cruise.taxesFeesEstimate,
    cruise.taxes,
    breakdown.amountPaid,
    breakdown.taxesFees,
  );

  if (isNumber(rawTaxesFeesEstimate) && rawTaxesFeesEstimate > 0) {
    return {
      value: round2(rawTaxesFeesEstimate),
      rawValue: round2(rawTaxesFeesEstimate),
      isEstimated: false,
      wasNormalized: false,
      note: null,
    };
  }

  const estimatedTaxesFees = estimateBookingTaxesFees(cruise.nights || 0, getEconomicsGuestCount(cruise));
  if (estimatedTaxesFees === null) {
    return {
      value: 0,
      rawValue: null,
      isEstimated: false,
      wasNormalized: false,
      note: 'Taxes/fees are unavailable because the cruise duration or guest count is not evidenced.',
    };
  }
  return {
    value: estimatedTaxesFees,
    rawValue: null,
    isEstimated: true,
    wasNormalized: false,
    note: `Taxes/fees estimated at ${estimatedTaxesFees.toFixed(2)} using the ${DEFAULT_PORT_FEE_PER_PERSON_FOR_7_NIGHTS.toFixed(0)} per-person double-occupancy port-fee baseline.`,
  };
}

function getNetEffectivePaid(cruise: BookedCruise, taxesFeesEstimate: number): { value: number; isActual: boolean; nextCruiseOffsetApplied: boolean | null; note: string | null } {
  const explicitNetEffectivePaid = getFirstNumber(cruise.netEffectivePaid);
  if (isNumber(explicitNetEffectivePaid)) {
    const actualAmountPaid = getFirstNumber(cruise.amountPaid, cruise.pricePaid, cruise.totalPrice, cruise.price);
    const prepaidOffset = isNumber(actualAmountPaid)
      ? round2(actualAmountPaid - explicitNetEffectivePaid)
      : null;

    return {
      value: round2(explicitNetEffectivePaid),
      isActual: true,
      nextCruiseOffsetApplied: cruise.nextCruiseOffsetApplied ?? cruise.usedNextCruiseCertificate ?? (isNumber(prepaidOffset) && prepaidOffset > 0 ? true : null),
      note: isNumber(prepaidOffset) && prepaidOffset > 0
        ? `Net paid uses stored effective paid amount after ${prepaidOffset.toFixed(2)} in prepaid credits/offsets.`
        : 'Net paid uses stored effective paid amount.',
    };
  }

  const actualAmountPaid = getFirstNumber(cruise.amountPaid, cruise.pricePaid, cruise.totalPrice, cruise.price);
  if (isNumber(actualAmountPaid)) {
    return {
      value: round2(actualAmountPaid),
      isActual: true,
      nextCruiseOffsetApplied: cruise.nextCruiseOffsetApplied ?? cruise.usedNextCruiseCertificate ?? null,
      note: null,
    };
  }

  const estimatedOffset = taxesFeesEstimate * 0.9;
  const netPaid = Math.max(0, taxesFeesEstimate - estimatedOffset);

  return {
    value: round2(netPaid),
    isActual: false,
    nextCruiseOffsetApplied: cruise.nextCruiseOffsetApplied ?? cruise.usedNextCruiseCertificate ?? (taxesFeesEstimate > 0 ? true : null),
    note: taxesFeesEstimate > 0 ? 'Net paid estimated from taxes/fees with 90% Next Cruise offset.' : 'No paid amount is available; no cash value was inferred.',
  };
}

function getEstimatedWinnings(cruise: BookedCruise, isClubRoyaleEligible: boolean): { value: number; isActual: boolean; note: string | null } {
  if (!isClubRoyaleEligible) {
    return {
      value: 0,
      isActual: true,
      note: 'Excluded from Club Royale casino win/loss because this sailing is Celebrity, Virgin, VACAYA/charter, or another non-Royal Caribbean casino program.',
    };
  }

  const actualWinnings = getFirstNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.netResult);
  if (isNumber(actualWinnings)) {
    return {
      value: round2(actualWinnings),
      isActual: true,
      note: null,
    };
  }

  const isFutureBookedCruise = cruise.status === 'booked' || cruise.completionState === 'upcoming' || cruise.bookingStatus === 'booked';
  if (isFutureBookedCruise) {
    return {
      value: 0,
      isActual: false,
      note: 'No winnings entered yet for this booked cruise; casino value is not pre-estimated.',
    };
  }

  return {
    value: 0,
    isActual: false,
    note: 'No casino win/loss was recorded for this completed cruise; Easy Seas does not fabricate winnings for totals.',
  };
}

function getEstimatedPoints(cruise: BookedCruise, isClubRoyaleEligible: boolean): { value: number; isActual: boolean; note: string | null } {
  if (!isClubRoyaleEligible) {
    return {
      value: 0,
      isActual: true,
      note: 'Excluded from Club Royale points because imported points for this sailing are loyalty points, not casino points.',
    };
  }

  const actualPoints = getFirstNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints);
  if (isNumber(actualPoints)) {
    return {
      value: Math.round(actualPoints),
      isActual: true,
      note: null,
    };
  }

  const isFutureBookedCruise = cruise.status === 'booked' || cruise.completionState === 'upcoming' || cruise.bookingStatus === 'booked';
  if (isFutureBookedCruise) {
    return {
      value: 0,
      isActual: false,
      note: 'No Club Royale points entered yet for this booked cruise; future casino points are not pre-estimated.',
    };
  }

  return {
    value: 0,
    isActual: false,
    note: 'No Club Royale points were recorded for this completed cruise; Easy Seas does not fabricate points for totals.',
  };
}

function getHighestBy(rows: CruiseEconomicsRow[], selector: (row: CruiseEconomicsRow) => number): CruiseEconomicsRow | null {
  if (rows.length === 0) {
    return null;
  }

  return rows.reduce<CruiseEconomicsRow | null>((best, row) => {
    if (!best) {
      return row;
    }

    return selector(row) > selector(best) ? row : best;
  }, null);
}

function getLowestBy(rows: CruiseEconomicsRow[], selector: (row: CruiseEconomicsRow) => number): CruiseEconomicsRow | null {
  if (rows.length === 0) {
    return null;
  }

  return rows.reduce<CruiseEconomicsRow | null>((best, row) => {
    if (!best) {
      return row;
    }

    return selector(row) < selector(best) ? row : best;
  }, null);
}

function buildCruiseEconomicsRow(cruise: BookedCruise): CruiseEconomicsRow {
  // Any approved owner-scoped enrichment is applied to the source collection
  // before this function. Never match another profile's figures by ship/date.
  const cruiseForEconomics = cruise;
  const breakdown = calculateCruiseValue(cruiseForEconomics);
  const ship = cruiseForEconomics.shipName || 'Unknown Ship';
  const sailDate = cruiseForEconomics.sailDate || '';
  const returnDate = cruiseForEconomics.returnDate || sailDate;
  const nights = cruiseForEconomics.nights || 0;
  const brand = getCruiseBrand(cruiseForEconomics);
  const status = cruiseForEconomics.status === 'completed' || cruiseForEconomics.completionState === 'completed' ? 'completed' : cruiseForEconomics.status === 'booked' ? 'booked' : 'other';

  const matchedAnnualFact = cruiseForEconomics.casinoHistoryImportId === SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID
    ? getAnnualCasinoFact(cruiseForEconomics)
    : undefined;
  const isClubRoyaleEligible = Boolean(matchedAnnualFact) || isClubRoyaleCasinoCruise(cruiseForEconomics);
  // Prefer the explicit imported/receipt total exactly. ValueCalculator's
  // fallback may include taxes and must not inflate an already supplied
  // Retail Value column.
  const rawRetailValue = getFirstNumber(
    cruiseForEconomics.retailValue,
    cruiseForEconomics.totalRetailCost,
    cruiseForEconomics.originalPrice,
    breakdown.totalRetailValue,
    breakdown.cabinValueForTwo,
  );
  const retailValue = rawRetailValue;
  const retailIsActual = isNumber(rawRetailValue) || Boolean(matchedAnnualFact);

  const taxesFeesInfo = getTaxesFeesEstimate(cruiseForEconomics, breakdown);
  const taxesFeesEstimate = taxesFeesInfo.value;
  const paidInfo = getNetEffectivePaid(cruiseForEconomics, taxesFeesEstimate);
  const winningsInfo = getEstimatedWinnings(cruiseForEconomics, isClubRoyaleEligible);
  const pointsInfo = getEstimatedPoints(cruiseForEconomics, isClubRoyaleEligible);

  const pointDollarValue = round2(getFirstNumber(cruiseForEconomics.pointDollarValue, DEFAULT_POINT_DOLLAR_VALUE) ?? DEFAULT_POINT_DOLLAR_VALUE);
  const pointValueEarned = calcPointValue(pointsInfo.value, pointDollarValue);

  const explicitCoinIn = isClubRoyaleEligible ? getFirstNumber(cruiseForEconomics.coinIn) : null;
  const coinIn = isClubRoyaleEligible
    ? (isNumber(explicitCoinIn) ? round2(explicitCoinIn) : round2(pointsInfo.value * DOLLARS_PER_POINT))
    : 0;
  const coinInWasEstimated = isClubRoyaleEligible && !isNumber(explicitCoinIn);

  const houseEdge = round2(getFirstNumber(cruiseForEconomics.houseEdge, DEFAULT_HOUSE_EDGE) ?? DEFAULT_HOUSE_EDGE);
  const explicitHoursPlayed = isClubRoyaleEligible ? getFirstNumber(cruiseForEconomics.hoursPlayed) : null;
  const hoursPlayed = isClubRoyaleEligible
    ? (isNumber(explicitHoursPlayed)
      ? round2(explicitHoursPlayed)
      : (pointsInfo.value > 0 ? round2(pointsInfo.value / DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR) : null))
    : null;
  const hoursWereEstimated = isClubRoyaleEligible && !isNumber(explicitHoursPlayed) && isNumber(hoursPlayed);
  const theoreticalLoss = calcTheoreticalLoss(coinIn, houseEdge);
  const netTheoretical = calcNetTheoretical(pointValueEarned, theoreticalLoss);

  const retailForCalc = round2(retailValue ?? 0);
  const netEffectivePaid = paidInfo.value;
  const winningsBroughtHome = winningsInfo.value;
  const cruiseValueCaptured = calcCruiseValueCaptured(retailForCalc, netEffectivePaid);
  // A saved closeout is already the gaming-only result. Subtracting cruise
  // fare from it again made Ship Intelligence disagree with Trips and Host
  // Report. The historical winnings-minus-paid formula is only a fallback.
  const explicitGamingResult = getFirstNumber(cruiseForEconomics.cashResult, cruiseForEconomics.netResult);
  const cashResult = isNumber(explicitGamingResult)
    ? round2(explicitGamingResult)
    : calcCashResult(winningsBroughtHome, netEffectivePaid);
  const totalEconomicValue = calcTotalEconomicValue(retailForCalc, winningsBroughtHome, netEffectivePaid);
  const coinInPerHour = isNumber(hoursPlayed) ? calcCoinInPerHour(coinIn, hoursPlayed) : null;
  const pointsPerHour = isNumber(hoursPlayed) ? calcPointsPerHour(pointsInfo.value, hoursPlayed) : null;
  const valuePerHour = isNumber(hoursPlayed) ? calcValuePerHour(totalEconomicValue, hoursPlayed) : null;

  const estimationFlags = [
    !retailIsActual,
    !paidInfo.isActual,
    !winningsInfo.isActual,
    !pointsInfo.isActual,
    coinInWasEstimated,
    hoursWereEstimated,
  ];
  const estimatedCount = estimationFlags.filter(Boolean).length;
  const calculationConfidence: CruiseEconomicsStatus = matchedAnnualFact?.calculationConfidence === 'actual' && hoursWereEstimated
    ? 'mixed'
    : matchedAnnualFact?.calculationConfidence ?? (estimatedCount === 0
      ? 'actual'
      : estimatedCount === estimationFlags.length
        ? 'estimated'
        : 'mixed');

  const notes = [
    taxesFeesInfo.note,
    paidInfo.note,
    winningsInfo.note,
    pointsInfo.note,
    coinInWasEstimated ? 'Coin-in derived from points at $5 coin-in per point.' : null,
    hoursWereEstimated ? `Hours played estimated from points at ${DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR} points/hour.` : null,
    isNumber(explicitGamingResult) ? 'Gaming cash result uses the saved cruise closeout and never subtracts cruise fare a second time.' : null,
    !isNumber(hoursPlayed) ? 'Hours played not available for this row.' : null,
    matchedAnnualFact?.notes ?? null,
  ].filter((note): note is string => Boolean(note));

  console.log('[CasinoCruiseEconomics] Row built', {
    cruiseId: cruise.id,
    ship,
    sailDate,
    retailValue: retailForCalc,
    taxesFeesEstimate,
    taxesFeesRawValue: taxesFeesInfo.rawValue,
    taxesFeesWasEstimated: taxesFeesInfo.isEstimated,
    taxesFeesWereNormalized: taxesFeesInfo.wasNormalized,
    netEffectivePaid,
    winningsBroughtHome,
    cashResult,
    cruiseValueCaptured,
    totalEconomicValue,
    coinIn,
    houseEdge,
    theoreticalLoss,
    calculationConfidence,
  });

  return {
    cruiseId: cruise.id,
    ship,
    sailDate,
    returnDate,
    nights,
    brand,
    status,
    retailValue: retailForCalc,
    amountPaid: getFirstNumber(cruiseForEconomics.amountPaid, cruiseForEconomics.pricePaid, cruiseForEconomics.totalPrice, cruiseForEconomics.price),
    taxesFeesEstimate,
    nextCruiseOffsetApplied: paidInfo.nextCruiseOffsetApplied,
    netEffectivePaid,
    winningsBroughtHome,
    casinoChargesRoomBilled: getFirstNumber(cruiseForEconomics.casinoChargesRoomBilled, cruiseForEconomics.actualSpend),
    coinIn,
    houseEdge,
    pointsEarned: pointsInfo.value,
    pointDollarValue,
    pointValueEarned,
    hoursPlayed,
    cashResult,
    cruiseValueCaptured,
    totalEconomicValue,
    theoreticalLoss,
    netTheoretical,
    coinInPerHour,
    pointsPerHour,
    valuePerHour,
    calculationConfidence,
    notes: notes.length > 0 ? notes.join(' ') : null,
    retail: retailForCalc,
    paid: netEffectivePaid,
    discount: cruiseValueCaptured,
    points: pointsInfo.value,
    winningsHome: winningsBroughtHome,
    netCash: cashResult,
    totalEconomic: totalEconomicValue,
    pointValue: pointValueEarned,
    pointsPerNight: nights > 0 ? round2(pointsInfo.value / nights) : 0,
  };
}

export function buildCruiseEconomicsSummary(
  cruises: BookedCruise[],
  today: Date = new Date(),
  options?: CruiseEconomicsSummaryOptions,
): CruiseEconomicsSummary {
  const normalizedCruises = normalizeCruisesWithCasinoEconomics(cruises, {
    includeKnownAnnualFacts: options?.useKnownAnnualReportFacts ?? false,
  });
  // A physical sailing can have multiple reservation records (for example a
  // second cabin). Keep those reservations independently actionable in Booked,
  // but never multiply the sailing's points, casino result, nights, or ADT.
  const sourceCruises = buildCanonicalBookedVoyages(normalizedCruises);

  const scope = options?.scope ?? 'annualCompletedRoyal';
  const scopedCruises = scope === 'allCruises'
    ? sourceCruises
    : scope === 'completedOnly'
      ? sourceCruises.filter((cruise) => getCruiseStatus(cruise, today) === 'completed')
      : sourceCruises
      .filter((cruise) => inAnnualScope(cruise, today))
      .filter((cruise) => !options?.useKnownAnnualReportFacts || Boolean(getAnnualCasinoFact(cruise)));

  const scopedRows = scopedCruises
    .map(buildCruiseEconomicsRow)
    .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());

  const totals = scopedRows.reduce<CruiseEconomicsTotals>((acc, row) => {
    acc.cruises += 1;
    acc.totalNights += row.nights;
    acc.totalRetail += row.retail;
    acc.totalPaid += row.paid;
    acc.totalDiscount += row.discount;
    acc.totalPoints += row.points;
    acc.totalWinningsHome += row.winningsHome;
    acc.totalNetCash += row.netCash;
    acc.totalRetailValue += row.retail;
    acc.totalCruiseValueCaptured += row.cruiseValueCaptured ?? 0;
    acc.totalCashResult += row.cashResult ?? 0;
    acc.totalEconomicValue += row.totalEconomicValue ?? 0;
    acc.totalCoinIn += row.coinIn ?? 0;
    acc.totalHours += row.hoursPlayed ?? 0;
    acc.totalTheoreticalLoss += row.theoreticalLoss ?? 0;
    acc.totalPointValueEarned += row.pointValueEarned ?? 0;
    acc.totalNetTheoretical += row.netTheoretical ?? 0;
    if (row.calculationConfidence !== 'actual') {
      acc.totalRowsWithEstimatedValues += 1;
    }
    return acc;
  }, {
    cruises: 0,
    totalNights: 0,
    totalRetail: 0,
    totalPaid: 0,
    totalDiscount: 0,
    totalPoints: 0,
    totalWinningsHome: 0,
    totalNetCash: 0,
    totalRetailValue: 0,
    totalCruiseValueCaptured: 0,
    totalCashResult: 0,
    totalEconomicValue: 0,
    totalCoinIn: 0,
    totalHours: 0,
    totalTheoreticalLoss: 0,
    totalPointValueEarned: 0,
    totalNetTheoretical: 0,
    totalRowsWithEstimatedValues: 0,
    hasEstimates: false,
  });

  totals.totalRetail = round2(totals.totalRetail);
  totals.totalPaid = round2(totals.totalPaid);
  totals.totalDiscount = round2(totals.totalDiscount);
  totals.totalWinningsHome = round2(totals.totalWinningsHome);
  totals.totalNetCash = round2(totals.totalNetCash);
  totals.totalRetailValue = round2(totals.totalRetailValue);
  totals.totalCruiseValueCaptured = round2(totals.totalCruiseValueCaptured);
  totals.totalCashResult = round2(totals.totalCashResult);
  totals.totalEconomicValue = round2(totals.totalEconomicValue);
  totals.totalCoinIn = round2(totals.totalCoinIn);
  totals.totalHours = round2(totals.totalHours);
  totals.totalTheoreticalLoss = round2(totals.totalTheoreticalLoss);
  totals.totalPointValueEarned = round2(totals.totalPointValueEarned);
  totals.totalNetTheoretical = round2(totals.totalNetTheoretical);
  totals.hasEstimates = totals.totalRowsWithEstimatedValues > 0;

  const minimumTotalPoints = options?.minimumTotalPoints ?? 0;
  if (minimumTotalPoints > totals.totalPoints) {
    const adjustmentPoints = Math.round(minimumTotalPoints - totals.totalPoints);
    const adjustmentCoinIn = round2(adjustmentPoints * DOLLARS_PER_POINT);
    const adjustmentHours = round2(adjustmentPoints / DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR);
    const adjustmentPointValue = calcPointValue(adjustmentPoints, DEFAULT_POINT_DOLLAR_VALUE);
    const adjustmentTheoreticalLoss = calcTheoreticalLoss(adjustmentCoinIn, DEFAULT_HOUSE_EDGE);
    totals.totalPoints += adjustmentPoints;
    totals.totalCoinIn = round2(totals.totalCoinIn + adjustmentCoinIn);
    totals.totalHours = round2(totals.totalHours + adjustmentHours);
    totals.totalPointValueEarned = round2(totals.totalPointValueEarned + adjustmentPointValue);
    totals.totalTheoreticalLoss = round2(totals.totalTheoreticalLoss + adjustmentTheoreticalLoss);
    totals.totalNetTheoretical = round2(totals.totalNetTheoretical + calcNetTheoretical(adjustmentPointValue, adjustmentTheoreticalLoss));
    totals.totalRowsWithEstimatedValues += 1;
    totals.hasEstimates = true;
    console.log('[CasinoCruiseEconomics] Applied confirmed historical points floor', {
      originalTotalPoints: totals.totalPoints - adjustmentPoints,
      adjustmentPoints,
      adjustmentHours,
      finalTotalPoints: totals.totalPoints,
    });
  }

  if (options?.useKnownAnnualReportFacts && totals.cruises > 0) {
    const reconciledRetailValue = Math.max(totals.totalRetailValue, CONFIRMED_CLUB_ROYALE_2025_RETAIL_VALUE_FLOOR);
    totals.totalRetail = reconciledRetailValue;
    totals.totalRetailValue = reconciledRetailValue;
    totals.totalPaid = CONFIRMED_CLUB_ROYALE_2025_PAID;
    totals.totalWinningsHome = CONFIRMED_CLUB_ROYALE_2025_WINNINGS_HOME;
    totals.totalNetCash = CONFIRMED_CLUB_ROYALE_2025_NET_CASH_RESULT;
    totals.totalCashResult = CONFIRMED_CLUB_ROYALE_2025_NET_CASH_RESULT;
    totals.totalDiscount = calcCruiseValueCaptured(totals.totalRetailValue, totals.totalPaid);
    totals.totalCruiseValueCaptured = totals.totalDiscount;
    totals.totalEconomicValue = calcTotalEconomicValue(totals.totalRetailValue, totals.totalWinningsHome, totals.totalPaid);
    totals.totalPoints = CONFIRMED_CLUB_ROYALE_2025_POINTS;
    totals.totalCoinIn = CONFIRMED_CLUB_ROYALE_2025_COIN_IN;
    totals.totalHours = round2(CONFIRMED_CLUB_ROYALE_2025_POINTS / DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR);
    totals.totalPointValueEarned = calcPointValue(totals.totalPoints, DEFAULT_POINT_DOLLAR_VALUE);
    totals.totalTheoreticalLoss = calcTheoreticalLoss(totals.totalCoinIn, DEFAULT_HOUSE_EDGE);
    totals.totalNetTheoretical = calcNetTheoretical(totals.totalPointValueEarned, totals.totalTheoreticalLoss);
    totals.totalRowsWithEstimatedValues = Math.max(totals.totalRowsWithEstimatedValues, 1);
    totals.hasEstimates = true;
    console.log('[CasinoCruiseEconomics] Reconciled known annual casino totals', {
      totalRetailValue: totals.totalRetailValue,
      totalPaid: totals.totalPaid,
      totalWinningsHome: totals.totalWinningsHome,
      totalCashResult: totals.totalCashResult,
      totalPoints: totals.totalPoints,
      totalCoinIn: totals.totalCoinIn,
      totalHours: totals.totalHours,
    });
  }

  const cruiseCount = totals.cruises || 1;
  const averages: CruiseEconomicsAverages = {
    nightsPerCruise: totals.cruises > 0 ? round2(totals.totalNights / cruiseCount) : 0,
    retailPerCruise: totals.cruises > 0 ? round2(totals.totalRetailValue / cruiseCount) : 0,
    paidPerCruise: totals.cruises > 0 ? round2(totals.totalPaid / cruiseCount) : 0,
    winningsPerCruise: totals.cruises > 0 ? round2(totals.totalWinningsHome / cruiseCount) : 0,
    pointsPerCruise: totals.cruises > 0 ? round2(totals.totalPoints / cruiseCount) : 0,
    netCashPerCruise: totals.cruises > 0 ? round2(totals.totalCashResult / cruiseCount) : 0,
    totalEconomicValuePerCruise: totals.cruises > 0 ? round2(totals.totalEconomicValue / cruiseCount) : 0,
    pointsPerNight: totals.totalNights > 0 ? round2(totals.totalPoints / totals.totalNights) : 0,
  };

  const roiStyle: CruiseEconomicsROIStyleSummary = {
    paidAsPercentOfRetail: totals.totalRetailValue > 0 ? round2((totals.totalPaid / totals.totalRetailValue) * 100) : 0,
    compCoverage: totals.totalRetailValue > 0 ? round2((totals.totalCruiseValueCaptured / totals.totalRetailValue) * 100) : 0,
    retailToPaidMultiple: totals.totalPaid > 0 ? round2(totals.totalRetailValue / totals.totalPaid) : 0,
    winningsMultipleVsPaid: totals.totalPaid > 0 ? round2(totals.totalWinningsHome / totals.totalPaid) : 0,
    netRoiOnPaid: totals.totalPaid > 0 ? round2((totals.totalCashResult / totals.totalPaid) * 100) : 0,
    cashROI: totals.totalPaid > 0 ? round2(totals.totalCashResult / totals.totalPaid) : 0,
    cruiseValueMultiple: totals.totalPaid > 0 ? round2(totals.totalRetailValue / totals.totalPaid) : 0,
    compCoverageRate: totals.totalRetailValue > 0 ? round2(totals.totalCruiseValueCaptured / totals.totalRetailValue) : 0,
    winningsMultiple: totals.totalPaid > 0 ? round2(totals.totalWinningsHome / totals.totalPaid) : 0,
    valuePerHour: totals.totalHours > 0 ? round2(totals.totalEconomicValue / totals.totalHours) : 0,
  };

  const rowsWithPoints = scopedRows.filter((row) => row.points > 0);
  const snapshots: CruiseEconomicsSnapshots = {
    bestCashCruise: getHighestBy(scopedRows, (row) => row.cashResult ?? 0),
    biggestCompValueCruise: getHighestBy(scopedRows, (row) => row.cruiseValueCaptured ?? 0),
    bestPointsCruise: getHighestBy(rowsWithPoints, (row) => row.points),
    bestPointsPerNightCruise: getHighestBy(rowsWithPoints, (row) => row.pointsPerNight),
    weakestPointsCruise: getLowestBy(rowsWithPoints, (row) => row.points),
    bestEconomicValueCruise: getHighestBy(scopedRows, (row) => row.totalEconomicValue ?? 0),
  };

  const footnotes = totals.hasEstimates
    ? [
        options?.pointsAdjustmentNote,
        options?.useKnownAnnualReportFacts ? 'Known annual casino totals are reconciled to the final user-approved 2025 Royal Caribbean ledger: $47,774 retail, $4,238.41 paid, $19,457 winnings home, +$15,218.59 net cash, 58,680 account points, and $293,400 modeled coin-in. Cruise rows display the raw pasted per-cruise points; unassigned annual/account points remain separate reconciliation evidence. Coin-In remains gaming volume only.' : null,
        'Annual totals include estimated values where paid amount, winnings, points, coin-in, or hours were missing. Coin-In is gaming volume only and is excluded from Cash Result and Total Economic Value.',
      ].filter((note): note is string => Boolean(note))
    : [];

  console.log('[CasinoCruiseEconomics] Summary built', {
    cruiseCount: totals.cruises,
    totalRetailValue: totals.totalRetailValue,
    totalPaid: totals.totalPaid,
    totalCruiseValueCaptured: totals.totalCruiseValueCaptured,
    totalWinningsHome: totals.totalWinningsHome,
    totalCashResult: totals.totalCashResult,
    totalEconomicValue: totals.totalEconomicValue,
    totalCoinIn: totals.totalCoinIn,
    totalHours: totals.totalHours,
    totalRowsWithEstimatedValues: totals.totalRowsWithEstimatedValues,
  });

  return {
    rows: scopedRows,
    totals,
    averages,
    roiStyle,
    snapshots,
    footnotes,
  };
}
