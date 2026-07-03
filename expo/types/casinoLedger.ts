/**
 * Canonical Casino Ledger types (Stage 9.1 foundation).
 *
 * This is the shared vocabulary every Casino screen should eventually read
 * from instead of computing its own local totals. It sits ALONGSIDE the
 * existing `casinoCruiseEconomics.ts` / `casinoPointTruth.ts` calculators
 * (it does not replace them yet) so nothing currently on screen changes
 * until each screen is migrated in later Stage 9 sub-stages.
 */

/**
 * Broad, user-facing confidence vocabulary requested by the Stage 9
 * checklist. This is distinct from the more granular `SourceConfidence`
 * type already used inside `CalculationDrillDownDrawer` (verified-invoice /
 * imported-csv / user-entered / calculated / estimated-default /
 * needs-review) — that type keeps working as-is. Use
 * `toLedgerConfidence()` in `lib/casinoLedger/confidence.ts` to map between
 * the two so existing drill-downs don't need to change.
 */
export type CasinoLedgerConfidence =
  | 'actual'
  | 'imported'
  | 'user-entered'
  | 'estimated'
  | 'generated'
  | 'mixed'
  | 'missing';

/** A single normalized dollar/points figure with where it came from. */
export interface CasinoLedgerValue {
  value: number;
  confidence: CasinoLedgerConfidence;
  /** Short human-readable source, e.g. "Cruise Portfolio edit", "Session rollup". */
  source: string;
  lastUpdated?: string;
}

/**
 * Whether a benefit (FreePlay, OBC, certificate value, etc.) is counted in
 * the current total, and why — used to prevent double-counting the same
 * dollar amount in two different places (item 6 of the checklist).
 */
export interface CasinoBenefitInclusion {
  amount: number;
  includedInTotal: boolean;
  reason: string;
}

/** Normalized casino record for a single cruise, drawn from BookedCruise + sessions. */
export interface CasinoLedgerCruiseEntry {
  cruiseId: string;
  shipName: string;
  sailDate: string;
  points: CasinoLedgerValue;
  coinIn: CasinoLedgerValue;
  winLoss: CasinoLedgerValue;
  freePlay: CasinoBenefitInclusion;
  obc: CasinoBenefitInclusion;
  certificateValue: CasinoBenefitInclusion;
  retailValue: CasinoLedgerValue;
  cashPaid: CasinoLedgerValue;
  cruiseValueCaptured: CasinoLedgerValue;
  totalEconomicValue: CasinoLedgerValue;
  sessionCount: number;
  hasSessionData: boolean;
  /** Roll-up of the entry's own confidences: 'mixed' if fields disagree. */
  overallConfidence: CasinoLedgerConfidence;
}

/** Ledger-wide totals used by Portfolio/Value/Action Center summary tiles. */
export interface CasinoLedgerTotals {
  totalPoints: number;
  totalCoinIn: number;
  totalWinLoss: number;
  totalFreePlayCounted: number;
  totalObcCounted: number;
  totalCertificateValueCounted: number;
  totalRetailValue: number;
  totalCashPaid: number;
  totalCruiseValueCaptured: number;
  totalEconomicValue: number;
  cruiseCount: number;
  cruisesWithMissingWinLoss: number;
  cruisesWithMissingPoints: number;
  overallConfidence: CasinoLedgerConfidence;
}

export interface CasinoLedger {
  entries: CasinoLedgerCruiseEntry[];
  totals: CasinoLedgerTotals;
  lastUpdated: string;
}
