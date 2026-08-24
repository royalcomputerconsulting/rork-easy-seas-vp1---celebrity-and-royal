import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';
import { ANNUAL_CASINO_REPORT_FACTS } from '@/lib/casinoAnnualReportFacts';
import { KNOWN_CURRENT_CLUB_ROYALE_CRUISES, getCasinoCruiseKey } from '@/lib/casinoPointTruth';

export const SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID = 'scott-confirmed-casino-history-v1';
export const CONFIRMED_ANNUAL_POINTS_TOTAL = 58_680;

const annualFactsByKey = new Map(
  ANNUAL_CASINO_REPORT_FACTS.map((fact) => [getCasinoCruiseKey(fact.ship, fact.sailDate), fact]),
);
const currentFactsByKey = new Map(
  KNOWN_CURRENT_CLUB_ROYALE_CRUISES.map((fact) => [getCasinoCruiseKey(fact.shipName, fact.sailDate), fact]),
);

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasOwnerEvidence(cruise: BookedCruise): boolean {
  return (cruise.guestNames ?? []).some((name) => name.trim().toLowerCase() === 'scott merlis');
}

function missingCasinoPoints(cruise: BookedCruise): boolean {
  return !finite(cruise.pointsEarned) && !finite(cruise.earnedPoints) && !finite(cruise.casinoPoints);
}

function missingWinnings(cruise: BookedCruise): boolean {
  return !finite(cruise.winningsBroughtHome) && !finite(cruise.winnings) && !finite(cruise.totalWinnings) && !finite(cruise.cashResult);
}

function appendImportNote(existing: string | undefined, note: string): string {
  if (existing?.includes(note)) return existing;
  return [existing, note].filter(Boolean).join(' ');
}

/**
 * Enriches only an already-saved, owner-evidenced cruise with the supplied
 * historical facts. It never creates cruises and never replaces a manual,
 * receipt, session, or provider value already stored on the cruise.
 */
export function applyOwnerScopedCasinoHistory(cruise: BookedCruise): BookedCruise {
  if (!hasOwnerEvidence(cruise)) return cruise;

  const key = getCasinoCruiseKey(cruise.shipName, cruise.sailDate);
  const annual = annualFactsByKey.get(key);
  const current = currentFactsByKey.get(key);
  if (!annual && !current) return cruise;

  const points = annual?.pointsEarned ?? current?.pointsEarned ?? 0;
  const winnings = annual?.winningsBroughtHome ?? current?.winningsBroughtHome ?? 0;
  const shouldFillPoints = missingCasinoPoints(cruise);
  const shouldFillWinnings = missingWinnings(cruise);
  const shouldFillRetail = annual && !finite(cruise.retailValue) && !finite(cruise.totalRetailCost) && !finite(cruise.originalPrice);
  const shouldFillPaid = annual && !finite(cruise.amountPaid) && !finite(cruise.pricePaid) && !finite(cruise.netEffectivePaid);
  const note = 'Owner-scoped casino history imported from the user-confirmed cruise ledger; saved cruise/manual values take precedence.';

  return {
    ...cruise,
    casinoHistoryImportId: SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID,
    casinoProgram: cruise.casinoProgram ?? 'clubRoyale',
    ...(shouldFillPoints ? {
      pointsEarned: points,
      earnedPoints: points,
      casinoPoints: points,
      coinIn: finite(cruise.coinIn) ? cruise.coinIn : points * DOLLARS_PER_POINT,
    } : {}),
    ...(shouldFillWinnings ? {
      winningsBroughtHome: winnings,
      winnings,
      totalWinnings: winnings,
    } : {}),
    ...(shouldFillRetail && annual ? {
      retailValue: annual.retailValue,
      totalRetailCost: annual.retailValue,
      originalPrice: annual.retailValue,
    } : {}),
    ...(shouldFillPaid && annual ? {
      amountPaid: annual.amountPaid,
      pricePaid: annual.amountPaid,
      netEffectivePaid: annual.amountPaid,
    } : {}),
    calculationConfidence: cruise.calculationConfidence ?? annual?.calculationConfidence ?? current?.calculationConfidence,
    notes: appendImportNote(cruise.notes, note),
  };
}

export function applyOwnerScopedCasinoHistoryToCruises(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(applyOwnerScopedCasinoHistory);
}

export function hasCompleteOwnerScopedAnnualCasinoHistory(cruises: BookedCruise[]): boolean {
  const keys = new Set(
    cruises
      .filter((cruise) => cruise.casinoHistoryImportId === SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID && hasOwnerEvidence(cruise))
      .map((cruise) => getCasinoCruiseKey(cruise.shipName, cruise.sailDate)),
  );
  return ANNUAL_CASINO_REPORT_FACTS.every((fact) => keys.has(getCasinoCruiseKey(fact.ship, fact.sailDate)));
}

export function hasOwnerScopedCasinoHistory(cruises: BookedCruise[]): boolean {
  return cruises.some((cruise) => cruise.casinoHistoryImportId === SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID && hasOwnerEvidence(cruise));
}

export function getAnnualCasinoPointsReconciliation(cruises: BookedCruise[]): {
  isComplete: boolean;
  cruiseAllocatedPoints: number;
  confirmedAnnualPoints: number;
  unallocatedPoints: number;
} {
  const isComplete = hasCompleteOwnerScopedAnnualCasinoHistory(cruises);
  const cruiseAllocatedPoints = ANNUAL_CASINO_REPORT_FACTS.reduce((sum, fact) => sum + fact.pointsEarned, 0);
  return {
    isComplete,
    cruiseAllocatedPoints,
    confirmedAnnualPoints: CONFIRMED_ANNUAL_POINTS_TOTAL,
    unallocatedPoints: Math.max(0, CONFIRMED_ANNUAL_POINTS_TOTAL - cruiseAllocatedPoints),
  };
}
