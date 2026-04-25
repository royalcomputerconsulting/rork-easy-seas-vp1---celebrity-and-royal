import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import { createDateFromString } from '@/lib/date';
import { calculateCruiseValue, type ValueBreakdown } from '@/lib/valueCalculator';
import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';

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

const ANNUAL_SCOPE_START = '2025-04-01' as const;
const ANNUAL_SCOPE_END = '2026-04-01' as const;
const DEFAULT_HOUSE_EDGE = 0.08;
const DEFAULT_POINT_DOLLAR_VALUE = 0.01;
const DEFAULT_PORT_FEE_PER_PERSON_FOR_7_NIGHTS = 162;
const TWO_PERSON_PORT_FEE_THRESHOLD = 200;

interface TaxesFeesEstimateInfo {
  value: number;
  rawValue: number | null;
  isEstimated: boolean;
  wasNormalized: boolean;
  note: string | null;
}

interface AnnualCruiseOverride {
  ship: string;
  sailDate: string;
  amountPaid?: number;
  netEffectivePaid?: number;
  winningsBroughtHome?: number;
  nextCruiseOffsetApplied?: boolean;
}

const ANNUAL_CRUISE_OVERRIDES: AnnualCruiseOverride[] = [
  {
    ship: 'Harmony of the Seas',
    sailDate: '2025-04-20',
    amountPaid: 142,
    netEffectivePaid: -60,
    winningsBroughtHome: 8000,
    nextCruiseOffsetApplied: true,
  },
];

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
  if (cruise.brand && cruise.brand.trim().length > 0) {
    return cruise.brand;
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
    && status === 'completed'
    && sailDate >= ANNUAL_SCOPE_START
    && sailDate <= ANNUAL_SCOPE_END;
}

function applyRetailOverrides(ship: string, nights: number, retailValue: number | null): number | null {
  if (ship === 'Star of the Seas') {
    return 6500;
  }

  if (ship === 'Harmony of the Seas') {
    return 4650;
  }

  if (ship === 'Liberty of the Seas' && nights === 9) {
    return 3500;
  }

  return retailValue;
}

function applyAnnualCruiseOverrides(cruise: BookedCruise): BookedCruise {
  const matchedOverride = ANNUAL_CRUISE_OVERRIDES.find((override) => (
    override.ship === (cruise.shipName ?? '') && override.sailDate === (cruise.sailDate ?? '')
  ));

  if (!matchedOverride) {
    return cruise;
  }

  return {
    ...cruise,
    amountPaid: matchedOverride.amountPaid ?? cruise.amountPaid,
    netEffectivePaid: matchedOverride.netEffectivePaid ?? cruise.netEffectivePaid,
    winningsBroughtHome: matchedOverride.winningsBroughtHome ?? cruise.winningsBroughtHome,
    nextCruiseOffsetApplied: matchedOverride.nextCruiseOffsetApplied ?? cruise.nextCruiseOffsetApplied,
  };
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
    return Math.max(1, Math.round(cruise.guests));
  }

  return cruise.singleOccupancy ? 1 : 2;
}

function estimatePerPersonTaxesFees(nights: number): number {
  const normalizedNights = nights > 0 ? nights : 7;
  return round2((DEFAULT_PORT_FEE_PER_PERSON_FOR_7_NIGHTS / 7) * normalizedNights);
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
    const guestCount = getEconomicsGuestCount(cruise);
    if (guestCount > 1 && rawTaxesFeesEstimate > TWO_PERSON_PORT_FEE_THRESHOLD) {
      const normalizedPerPersonTaxesFees = round2(rawTaxesFeesEstimate / guestCount);
      return {
        value: normalizedPerPersonTaxesFees,
        rawValue: round2(rawTaxesFeesEstimate),
        isEstimated: false,
        wasNormalized: true,
        note: `Taxes/fees looked like a ${guestCount}-guest total, so the economics model normalized ${round2(rawTaxesFeesEstimate).toFixed(2)} to ${normalizedPerPersonTaxesFees.toFixed(2)} per person.`,
      };
    }

    return {
      value: round2(rawTaxesFeesEstimate),
      rawValue: round2(rawTaxesFeesEstimate),
      isEstimated: false,
      wasNormalized: false,
      note: null,
    };
  }

  const estimatedTaxesFees = estimatePerPersonTaxesFees(cruise.nights || 0);
  return {
    value: estimatedTaxesFees,
    rawValue: null,
    isEstimated: true,
    wasNormalized: false,
    note: `Taxes/fees estimated at ${estimatedTaxesFees.toFixed(2)} using the ${DEFAULT_PORT_FEE_PER_PERSON_FOR_7_NIGHTS.toFixed(0)} per-person port-fee baseline.`,
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
    note: taxesFeesEstimate > 0 ? 'Net paid estimated from taxes/fees with 90% Next Cruise offset.' : 'No paid amount available; defaulted to $0.',
  };
}

function getEstimatedWinnings(cruise: BookedCruise): { value: number; isActual: boolean; note: string | null } {
  const actualWinnings = getFirstNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.netResult);
  if (isNumber(actualWinnings)) {
    return {
      value: round2(actualWinnings),
      isActual: true,
      note: null,
    };
  }

  const estimatedWinnings = (cruise.nights || 0) <= 3 ? 300 : 700;

  return {
    value: estimatedWinnings,
    isActual: false,
    note: estimatedWinnings === 300
      ? 'Winnings estimated at the 3-night/weak-row baseline of $300.'
      : 'Winnings estimated at the default baseline of $700.',
  };
}

function getEstimatedPoints(cruise: BookedCruise): { value: number; isActual: boolean; note: string | null } {
  const actualPoints = getFirstNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints);
  if (isNumber(actualPoints)) {
    return {
      value: Math.round(actualPoints),
      isActual: true,
      note: null,
    };
  }

  const estimatedPoints = Math.round((cruise.nights || 0) * 300);

  return {
    value: estimatedPoints,
    isActual: false,
    note: 'Points estimated at 300 points per night.',
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
  const cruiseForEconomics = applyAnnualCruiseOverrides(cruise);
  const breakdown = calculateCruiseValue(cruiseForEconomics);
  const ship = cruiseForEconomics.shipName || 'Unknown Ship';
  const sailDate = cruiseForEconomics.sailDate || '';
  const returnDate = cruiseForEconomics.returnDate || sailDate;
  const nights = cruiseForEconomics.nights || 0;
  const brand = getCruiseBrand(cruiseForEconomics);
  const status = cruiseForEconomics.status === 'completed' || cruiseForEconomics.completionState === 'completed' ? 'completed' : cruiseForEconomics.status === 'booked' ? 'booked' : 'other';

  const rawRetailValue = getFirstNumber(
    cruiseForEconomics.retailValue,
    cruiseForEconomics.totalRetailCost,
    cruiseForEconomics.originalPrice,
    breakdown.totalRetailValue,
    breakdown.cabinValueForTwo,
  );
  const retailValue = applyRetailOverrides(ship, nights, rawRetailValue);
  const retailIsActual = isNumber(rawRetailValue) || ship === 'Star of the Seas' || ship === 'Harmony of the Seas' || (ship === 'Liberty of the Seas' && nights === 9);

  const taxesFeesInfo = getTaxesFeesEstimate(cruiseForEconomics, breakdown);
  const taxesFeesEstimate = taxesFeesInfo.value;
  const paidInfo = getNetEffectivePaid(cruiseForEconomics, taxesFeesEstimate);
  const winningsInfo = getEstimatedWinnings(cruiseForEconomics);
  const pointsInfo = getEstimatedPoints(cruiseForEconomics);

  const pointDollarValue = round2(getFirstNumber(cruiseForEconomics.pointDollarValue, DEFAULT_POINT_DOLLAR_VALUE) ?? DEFAULT_POINT_DOLLAR_VALUE);
  const pointValueEarned = calcPointValue(pointsInfo.value, pointDollarValue);

  const explicitCoinIn = getFirstNumber(cruiseForEconomics.coinIn);
  const coinIn = isNumber(explicitCoinIn)
    ? round2(explicitCoinIn)
    : round2(pointsInfo.value * DOLLARS_PER_POINT);
  const coinInWasEstimated = !isNumber(explicitCoinIn);

  const houseEdge = round2(getFirstNumber(cruiseForEconomics.houseEdge, DEFAULT_HOUSE_EDGE) ?? DEFAULT_HOUSE_EDGE);
  const hoursPlayed = getFirstNumber(cruiseForEconomics.hoursPlayed);
  const theoreticalLoss = calcTheoreticalLoss(coinIn, houseEdge);
  const netTheoretical = calcNetTheoretical(pointValueEarned, theoreticalLoss);

  const retailForCalc = round2(retailValue ?? 0);
  const netEffectivePaid = paidInfo.value;
  const winningsBroughtHome = winningsInfo.value;
  const cruiseValueCaptured = calcCruiseValueCaptured(retailForCalc, netEffectivePaid);
  const cashResult = calcCashResult(winningsBroughtHome, netEffectivePaid);
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
  ];
  const estimatedCount = estimationFlags.filter(Boolean).length;
  const calculationConfidence: CruiseEconomicsStatus = estimatedCount === 0
    ? 'actual'
    : estimatedCount === estimationFlags.length
      ? 'estimated'
      : 'mixed';

  const notes = [
    taxesFeesInfo.note,
    paidInfo.note,
    winningsInfo.note,
    pointsInfo.note,
    coinInWasEstimated ? 'Coin-in derived from points at $5 coin-in per point.' : null,
    !isNumber(hoursPlayed) ? 'Hours played not available for this row.' : null,
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
): CruiseEconomicsSummary {
  const scopedRows = cruises
    .filter((cruise) => inAnnualScope(cruise, today))
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
    ? ['Annual totals include estimated values where paid amount, winnings, points, coin-in, or hours were missing.']
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
