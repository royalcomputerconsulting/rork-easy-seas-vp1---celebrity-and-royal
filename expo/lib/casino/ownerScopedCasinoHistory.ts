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
const OWNER_CELEBRITY_EQUINOX_FACT = {
  shipName: 'Celebrity Equinox',
  sailDate: '2026-08-06',
  returnDate: '2026-08-15',
  nights: 9,
  pointsEarned: 667,
  winningsBroughtHome: 581,
  calculationConfidence: 'actual' as const,
};

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
  const celebrity = key === getCasinoCruiseKey(OWNER_CELEBRITY_EQUINOX_FACT.shipName, OWNER_CELEBRITY_EQUINOX_FACT.sailDate)
    ? OWNER_CELEBRITY_EQUINOX_FACT
    : undefined;
  if (!annual && !current && !celebrity) return cruise;

  const points = annual?.pointsEarned ?? current?.pointsEarned ?? celebrity?.pointsEarned ?? 0;
  const winnings = annual?.winningsBroughtHome ?? current?.winningsBroughtHome ?? celebrity?.winningsBroughtHome;
  const shouldFillPoints = missingCasinoPoints(cruise);
  const shouldFillWinnings = missingWinnings(cruise) && finite(winnings);
  const shouldFillRetail = annual && !finite(cruise.retailValue) && !finite(cruise.totalRetailCost) && !finite(cruise.originalPrice);
  const shouldFillPaid = annual && !finite(cruise.amountPaid) && !finite(cruise.pricePaid) && !finite(cruise.netEffectivePaid);
  const note = 'Owner-scoped casino history imported from the user-confirmed cruise ledger; saved cruise/manual values take precedence.';

  return {
    ...cruise,
    casinoHistoryImportId: SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID,
    casinoProgram: celebrity ? 'blueChip' : (cruise.casinoProgram ?? 'clubRoyale'),
    ...(shouldFillPoints ? {
      pointsEarned: points,
      earnedPoints: points,
      casinoPoints: points,
      ...(!celebrity ? {
        coinIn: finite(cruise.coinIn) ? cruise.coinIn : points * DOLLARS_PER_POINT,
        coinInCalculationSource: finite(cruise.coinIn) ? cruise.coinInCalculationSource : 'club_royale_slot_points_estimate' as const,
        slotPointsConfirmed: finite(cruise.coinIn) ? cruise.slotPointsConfirmed : true,
      } : {}),
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
    calculationConfidence: cruise.calculationConfidence ?? annual?.calculationConfidence ?? current?.calculationConfidence ?? celebrity?.calculationConfidence,
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
