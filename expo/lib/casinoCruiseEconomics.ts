import { createDateFromString } from '@/lib/date';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import type { BookedCruise } from '@/types/models';

export type CruiseEconomicsStatus = 'known' | 'est. winnings' | 'pending';

export interface CruiseEconomicsRow {
  cruiseId: string;
  sailDate: string;
  ship: string;
  nights: number;
  retail: number;
  paid: number;
  discount: number;
  points: number;
  winningsHome: number;
  netCash: number;
  status: CruiseEconomicsStatus;
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
}

export interface CruiseEconomicsAverages {
  nightsPerCruise: number;
  retailPerCruise: number;
  paidPerCruise: number;
  winningsPerCruise: number;
  pointsPerCruise: number;
  netCashPerCruise: number;
  pointsPerNight: number;
}

export interface CruiseEconomicsROIStyleSummary {
  paidAsPercentOfRetail: number;
  compCoverage: number;
  retailToPaidMultiple: number;
  winningsMultipleVsPaid: number;
  netRoiOnPaid: number;
}

export interface CruiseEconomicsSnapshots {
  bestCashCruise: CruiseEconomicsRow | null;
  biggestCompValueCruise: CruiseEconomicsRow | null;
  bestPointsCruise: CruiseEconomicsRow | null;
  bestPointsPerNightCruise: CruiseEconomicsRow | null;
  weakestPointsCruise: CruiseEconomicsRow | null;
}

export interface CruiseEconomicsSummary {
  rows: CruiseEconomicsRow[];
  totals: CruiseEconomicsTotals;
  averages: CruiseEconomicsAverages;
  roiStyle: CruiseEconomicsROIStyleSummary;
  snapshots: CruiseEconomicsSnapshots;
}

function isFiniteNumber(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getFirstNumber(...values: Array<number | undefined | null>): number | undefined {
  return values.find((value) => isFiniteNumber(value));
}

function isCompletedCruise(cruise: BookedCruise, today: Date): boolean {
  if (cruise.completionState === 'completed' || cruise.status === 'completed') {
    return true;
  }

  if (cruise.returnDate) {
    return createDateFromString(cruise.returnDate).getTime() < today.getTime();
  }

  return false;
}

function buildCruiseEconomicsRow(cruise: BookedCruise): CruiseEconomicsRow {
  const breakdown = calculateCruiseValue(cruise);
  const retail = getFirstNumber(
    cruise.totalRetailCost,
    cruise.retailValue,
    cruise.originalPrice,
    breakdown.cabinValueForTwo,
  ) ?? 0;
  const paid = getFirstNumber(
    cruise.pricePaid,
    cruise.totalPrice,
    cruise.price,
    cruise.taxes,
    breakdown.amountPaid,
  ) ?? 0;
  const discount = getFirstNumber(
    cruise.totalCasinoDiscount,
    cruise.compValue,
    retail > 0 ? Math.max(0, retail - paid) : undefined,
  ) ?? 0;
  const points = getFirstNumber(cruise.earnedPoints, cruise.casinoPoints) ?? 0;
  const winningsHome = getFirstNumber(cruise.winnings, cruise.totalWinnings, cruise.netResult) ?? 0;
  const netCash = winningsHome - paid;
  const status: CruiseEconomicsStatus = isFiniteNumber(cruise.winnings) || isFiniteNumber(cruise.totalWinnings) || isFiniteNumber(cruise.netResult)
    ? 'known'
    : points > 0
      ? 'est. winnings'
      : 'pending';
  const nights = cruise.nights || 0;

  console.log('[CasinoCruiseEconomics] Row built', {
    cruiseId: cruise.id,
    ship: cruise.shipName,
    sailDate: cruise.sailDate,
    retail,
    paid,
    discount,
    points,
    winningsHome,
    netCash,
    status,
  });

  return {
    cruiseId: cruise.id,
    sailDate: cruise.sailDate,
    ship: cruise.shipName || 'Unknown Ship',
    nights,
    retail,
    paid,
    discount,
    points,
    winningsHome,
    netCash,
    status,
    pointsPerNight: nights > 0 ? points / nights : 0,
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

export function buildCruiseEconomicsSummary(
  cruises: BookedCruise[],
  today: Date = new Date(),
): CruiseEconomicsSummary {
  const completedRows = cruises
    .filter((cruise) => isCompletedCruise(cruise, today))
    .map(buildCruiseEconomicsRow)
    .filter((row) => row.points > 0 || row.retail > 0 || row.paid > 0 || row.winningsHome !== 0)
    .sort((a, b) => createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime());

  const totals = completedRows.reduce<CruiseEconomicsTotals>((acc, row) => {
    acc.cruises += 1;
    acc.totalNights += row.nights;
    acc.totalRetail += row.retail;
    acc.totalPaid += row.paid;
    acc.totalDiscount += row.discount;
    acc.totalPoints += row.points;
    acc.totalWinningsHome += row.winningsHome;
    acc.totalNetCash += row.netCash;
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
  });

  const cruiseCount = totals.cruises || 1;
  const averages: CruiseEconomicsAverages = {
    nightsPerCruise: totals.cruises > 0 ? totals.totalNights / cruiseCount : 0,
    retailPerCruise: totals.cruises > 0 ? totals.totalRetail / cruiseCount : 0,
    paidPerCruise: totals.cruises > 0 ? totals.totalPaid / cruiseCount : 0,
    winningsPerCruise: totals.cruises > 0 ? totals.totalWinningsHome / cruiseCount : 0,
    pointsPerCruise: totals.cruises > 0 ? totals.totalPoints / cruiseCount : 0,
    netCashPerCruise: totals.cruises > 0 ? totals.totalNetCash / cruiseCount : 0,
    pointsPerNight: totals.totalNights > 0 ? totals.totalPoints / totals.totalNights : 0,
  };

  const roiStyle: CruiseEconomicsROIStyleSummary = {
    paidAsPercentOfRetail: totals.totalRetail > 0 ? (totals.totalPaid / totals.totalRetail) * 100 : 0,
    compCoverage: totals.totalRetail > 0 ? (totals.totalDiscount / totals.totalRetail) * 100 : 0,
    retailToPaidMultiple: totals.totalPaid > 0 ? totals.totalRetail / totals.totalPaid : 0,
    winningsMultipleVsPaid: totals.totalPaid > 0 ? totals.totalWinningsHome / totals.totalPaid : 0,
    netRoiOnPaid: totals.totalPaid > 0 ? (totals.totalNetCash / totals.totalPaid) * 100 : 0,
  };

  const rowsWithPoints = completedRows.filter((row) => row.points > 0);
  const snapshots: CruiseEconomicsSnapshots = {
    bestCashCruise: getHighestBy(completedRows, (row) => row.netCash),
    biggestCompValueCruise: getHighestBy(completedRows, (row) => row.discount),
    bestPointsCruise: getHighestBy(rowsWithPoints, (row) => row.points),
    bestPointsPerNightCruise: getHighestBy(rowsWithPoints, (row) => row.pointsPerNight),
    weakestPointsCruise: getLowestBy(rowsWithPoints, (row) => row.points),
  };

  console.log('[CasinoCruiseEconomics] Summary built', {
    cruiseCount: totals.cruises,
    totalNights: totals.totalNights,
    totalRetail: totals.totalRetail,
    totalPaid: totals.totalPaid,
    totalDiscount: totals.totalDiscount,
    totalPoints: totals.totalPoints,
    totalWinningsHome: totals.totalWinningsHome,
    totalNetCash: totals.totalNetCash,
    roiStyle,
  });

  return {
    rows: completedRows,
    totals,
    averages,
    roiStyle,
    snapshots,
  };
}
