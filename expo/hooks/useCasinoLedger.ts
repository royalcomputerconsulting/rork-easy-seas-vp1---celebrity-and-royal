import { useMemo } from 'react';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { buildCasinoCruiseTruth, isGeneratedCasinoSession, type CasinoEvidenceKind } from '@/lib/casino/casinoTruthEngine';
import {
  resolveFreePlayInclusion,
  resolveObcInclusion,
  resolveCertificateValueInclusion,
  sumIncludedBenefits,
} from '@/lib/casinoLedger/duplicateGuard';
import { combineConfidence } from '@/lib/casinoLedger/confidence';
import { buildCasinoCruiseIdentity } from '@/lib/casino/casinoCruiseIdentity';
import type {
  CasinoLedger,
  CasinoLedgerConfidence,
  CasinoLedgerDataQuality,
  CasinoLedgerCruiseEntry,
  CasinoLedgerValue,
} from '@/types/casinoLedger';
import type { CruiseEconomicsRow } from '@/lib/casinoCruiseEconomics';

/** Maps the existing per-row 'actual'|'estimated'|'mixed' confidence onto the ledger vocabulary. */
function rowConfidence(row: CruiseEconomicsRow): CasinoLedgerConfidence {
  if (row.calculationConfidence === 'actual') return 'actual';
  if (row.calculationConfidence === 'mixed') return 'mixed';
  return 'estimated';
}

function dataQuality(confidence: CasinoLedgerConfidence): CasinoLedgerDataQuality {
  if (confidence === 'actual' || confidence === 'user-entered') return 'Actual';
  if (confidence === 'imported') return 'Imported';
  if (confidence === 'synced') return 'Synced';
  if (confidence === 'derived' || confidence === 'generated') return 'Derived';
  if (confidence === 'estimated' || confidence === 'mixed') return 'Estimated';
  if (confidence === 'incomplete' || confidence === 'missing') return 'Incomplete';
  return 'Unavailable';
}

function ledgerValue(value: number | null, confidence: CasinoLedgerConfidence, source: string, formula?: string): CasinoLedgerValue {
  if (value === null) {
    return { value: 0, confidence: 'unavailable', dataQuality: 'Unavailable', source, formula };
  }
  return { value, confidence, dataQuality: dataQuality(confidence), source, formula };
}

function evidenceConfidence(kind: CasinoEvidenceKind): CasinoLedgerConfidence {
  if (kind === 'actual') return 'actual';
  if (kind === 'provider_reported') return 'synced';
  if (kind === 'user_entered') return 'user-entered';
  if (kind === 'estimated') return 'estimated';
  return 'unavailable';
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
  const { bookedCruises, allCruiseEconomicsSummary } = useCasinoEconomicsData();
  const { sessions } = useCasinoSessions();
  const { searchableCertificates } = useCertificates();

  return useMemo(() => {
    const rowByCruiseId = new Map(allCruiseEconomicsSummary.rows.map((row) => [row.cruiseId, row]));

    const entries: CasinoLedgerCruiseEntry[] = bookedCruises.map((cruise) => {
      const row = rowByCruiseId.get(cruise.id);
      const confidence = row ? rowConfidence(row) : 'missing';
      const truth = buildCasinoCruiseTruth({ cruise, sessions, certificates: searchableCertificates });
      const actualSessions = sessions.filter((session) => session.cruiseId === cruise.id && !isGeneratedCasinoSession(session));
      const sessionCount = actualSessions.length;
      const hasSessionData = sessionCount > 0;

      const identity = buildCasinoCruiseIdentity(cruise);
      const points = ledgerValue(truth.points.value, evidenceConfidence(truth.points.kind), truth.points.source, truth.points.formula);
      const coinIn = ledgerValue(truth.coinIn.value, evidenceConfidence(truth.coinIn.kind), truth.coinIn.source, truth.coinIn.formula);
      const winLoss = ledgerValue(truth.netGamingResult.value, evidenceConfidence(truth.netGamingResult.kind), `${truth.netGamingResult.source}; cruise fare excluded`, truth.netGamingResult.formula);
      const retailValue = ledgerValue(row?.retailValue ?? null, confidence, 'Retail cruise value source');
      const cashPaid = ledgerValue(row?.amountPaid ?? null, confidence, 'Recorded amount paid');
      const cruiseValueCaptured = ledgerValue(row?.cruiseValueCaptured ?? null, confidence, 'Retail value - cash paid');
      const totalEconomicValue = ledgerValue(row?.totalEconomicValue ?? null, confidence, 'Cruise value captured + net gaming result + distinct benefits');

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
        cruiseId: cruise.id,
        ownerProfileId: identity.ownerProfileId,
        sourceEmail: identity.sourceEmail,
        reservationNumber: identity.reservationNumber,
        bookingId: identity.bookingId,
        matchKey: identity.matchKey,
        matchSource: identity.matchSource,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
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
  }, [allCruiseEconomicsSummary, bookedCruises, searchableCertificates, sessions]);
}
