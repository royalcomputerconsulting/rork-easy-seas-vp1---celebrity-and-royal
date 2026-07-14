import { useMemo } from 'react';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import {
  resolveFreePlayInclusion,
  resolveObcInclusion,
  resolveCertificateValueInclusion,
  sumIncludedBenefits,
} from '@/lib/casinoLedger/duplicateGuard';
import { combineConfidence } from '@/lib/casinoLedger/confidence';
import type {
  CasinoLedger,
  CasinoLedgerConfidence,
  CasinoLedgerCruiseEntry,
  CasinoLedgerValue,
} from '@/types/casinoLedger';
import type { CruiseEconomicsRow } from '@/lib/casinoCruiseEconomics';
import type { BookedCruise } from '@/types/models';

/** Maps the existing per-row 'actual'|'estimated'|'mixed' confidence onto the ledger vocabulary. */
function rowConfidence(row: CruiseEconomicsRow): CasinoLedgerConfidence {
  if (row.calculationConfidence === 'actual') return 'actual';
  if (row.calculationConfidence === 'mixed') return 'mixed';
  return 'estimated';
}

function ledgerValue(value: number | null, confidence: CasinoLedgerConfidence, source: string): CasinoLedgerValue {
  if (value === null) {
    return { value: 0, confidence: 'missing', source };
  }
  return { value, confidence, source };
}

/**
 * Canonical Casino Ledger hook (Stage 9.1 foundation, checklist item 3).
 *
 * Builds one normalized per-cruise record from the same real data already
 * powering the Casino Portfolio/Value/Action Center/History screens
 * (`useCasinoEconomicsData` for points/coin-in/win-loss/value, booked-cruise
 * fields for FreePlay/OBC/certificates, and `CasinoSessionProvider` for
 * logged sessions), tagging every figure with a source-confidence label and
 * running it through the duplicate-counting guards.
 *
 * This is purely additive right now — no existing screen has been switched
 * over to read from it yet, so nothing currently on screen changes. Screens
 * migrate to this one field at a time in Stage 9.2-9.5.
 */
export function useCasinoLedger(): CasinoLedger {
  const { bookedCruises, cruiseEconomicsSummary } = useCasinoEconomicsData();
  const { hasSessionsForCruise, getTotalPointsForCruise, sessions } = useCasinoSessions();

  return useMemo(() => {
    const cruiseById = new Map<string, BookedCruise>(bookedCruises.map((c) => [c.id, c]));

    const entries: CasinoLedgerCruiseEntry[] = cruiseEconomicsSummary.rows.map((row) => {
      const cruise = cruiseById.get(row.cruiseId);
      const confidence = rowConfidence(row);
      const sessionCount = sessions.filter((s) => s.cruiseId === row.cruiseId).length;
      const hasSessionData = hasSessionsForCruise(row.cruiseId);

      const points = hasSessionData
        ? ledgerValue(getTotalPointsForCruise(row.cruiseId), 'actual', 'Logged casino sessions for this cruise')
        : ledgerValue(row.pointsEarned, confidence, 'Cruise Portfolio economics calculator');

      const coinIn = ledgerValue(row.coinIn, confidence, 'Points \u00d7 $5 slot coin-in rule');
      const winLoss = ledgerValue(row.cashResult, row.cashResult === null ? 'missing' : confidence, 'Recorded cruise cash result');
      const retailValue = ledgerValue(row.retailValue, confidence, 'Retail cruise value source');
      const cashPaid = ledgerValue(row.amountPaid, confidence, 'Recorded amount paid');
      const cruiseValueCaptured = ledgerValue(row.cruiseValueCaptured, confidence, 'Retail value - cash paid');
      const totalEconomicValue = ledgerValue(row.totalEconomicValue, confidence, 'Cruise value captured + cash result + benefits');

      const freePlay = cruise
        ? resolveFreePlayInclusion(cruise)
        : { amount: 0, includedInTotal: false, reason: 'Cruise record not found for FreePlay lookup.' };
      const obc = cruise
        ? resolveObcInclusion(cruise)
        : { amount: 0, includedInTotal: false, reason: 'Cruise record not found for OBC lookup.' };
      const certificateValue = cruise
        ? resolveCertificateValueInclusion(cruise)
        : { amount: 0, includedInTotal: false, reason: 'Cruise record not found for certificate lookup.' };

      const overallConfidence = combineConfidence([
        points.confidence,
        coinIn.confidence,
        winLoss.confidence,
        retailValue.confidence,
        cashPaid.confidence,
      ]);

      return {
        cruiseId: row.cruiseId,
        shipName: row.ship,
        sailDate: row.sailDate,
        points,
        coinIn,
        winLoss,
        freePlay,
        obc,
        certificateValue,
        retailValue,
        cashPaid,
        cruiseValueCaptured,
        totalEconomicValue,
        sessionCount,
        hasSessionData,
        overallConfidence,
      };
    });

    const totals = entries.reduce(
      (acc, entry) => {
        acc.totalPoints += entry.points.value;
        acc.totalCoinIn += entry.coinIn.value;
        acc.totalWinLoss += entry.winLoss.value;
        acc.totalFreePlayCounted += entry.freePlay.includedInTotal ? entry.freePlay.amount : 0;
        acc.totalObcCounted += entry.obc.includedInTotal ? entry.obc.amount : 0;
        acc.totalCertificateValueCounted += sumIncludedBenefits(entry.certificateValue);
        acc.totalRetailValue += entry.retailValue.value;
        acc.totalCashPaid += entry.cashPaid.value;
        acc.totalCruiseValueCaptured += entry.cruiseValueCaptured.value;
        acc.totalEconomicValue += entry.totalEconomicValue.value;
        if (entry.winLoss.confidence === 'missing') acc.cruisesWithMissingWinLoss += 1;
        if (entry.points.confidence === 'missing') acc.cruisesWithMissingPoints += 1;
        return acc;
      },
      {
        totalPoints: 0,
        totalCoinIn: 0,
        totalWinLoss: 0,
        totalFreePlayCounted: 0,
        totalObcCounted: 0,
        totalCertificateValueCounted: 0,
        totalRetailValue: 0,
        totalCashPaid: 0,
        totalCruiseValueCaptured: 0,
        totalEconomicValue: 0,
        cruisesWithMissingWinLoss: 0,
        cruisesWithMissingPoints: 0,
      },
    );

    return {
      entries,
      totals: {
        ...totals,
        cruiseCount: entries.length,
        overallConfidence: combineConfidence(entries.map((e) => e.overallConfidence)),
      },
      lastUpdated: new Date().toISOString(),
    };
  }, [bookedCruises, cruiseEconomicsSummary, hasSessionsForCruise, getTotalPointsForCruise, sessions]);
}
