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
  /** Buy-in recorded for this cruise's casino play. */
  buyIn: CasinoLedgerValue;
  /** Cash-out recorded for this cruise's casino play. */
  cashOut: CasinoLedgerValue;
  /** FreePlay actually used at the machines (distinct from the `freePlay` benefit-inclusion field, which tracks double-counting). */
  freePlayUsed: CasinoLedgerValue;
  /** FreePlay won/awarded on this cruise. */
  freePlayWon: CasinoLedgerValue;
  /** Taxable W2G jackpot amount recorded for this cruise. */
  w2gJackpotAmount: CasinoLedgerValue;
  /** VOOM/internet package value recorded for this cruise. */
  voomValue: CasinoLedgerValue;
  /** Specialty dining value recorded for this cruise. */
  diningValue: CasinoLedgerValue;
  /** Spa value recorded for this cruise. */
  spaValue: CasinoLedgerValue;
  /** Beverage package value recorded for this cruise. */
  beverageValue: CasinoLedgerValue;
  /** IDs of every logged casino session tied to this cruise. */
  sessionIds: string[];
  /** IDs of every distinct machine played across this cruise's logged sessions. */
  machineIds: string[];
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
  /** Sum of every cruise's recorded buy-in. */
  totalBuyIn: number;
  /** Sum of every cruise's recorded cash-out. */
  totalCashOut: number;
  /** Sum of every cruise's recorded FreePlay used. */
  totalFreePlayUsed: number;
  /** Sum of every cruise's recorded FreePlay won. */
  totalFreePlayWon: number;
  /** Sum of every cruise's recorded taxable W2G jackpot amount. */
  totalW2GJackpotAmount: number;
  /** Sum of every cruise's recorded VOOM/internet value. */
  totalVoomValue: number;
  /** Sum of every cruise's recorded specialty dining value. */
  totalDiningValue: number;
  /** Sum of every cruise's recorded spa value. */
  totalSpaValue: number;
  /** Sum of every cruise's recorded beverage package value. */
  totalBeverageValue: number;
  /** Total number of logged casino sessions across every cruise in the ledger. */
  totalSessionsLogged: number;
  /** Count of distinct machine IDs played across every logged session. */
  uniqueMachinesPlayed: number;
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
