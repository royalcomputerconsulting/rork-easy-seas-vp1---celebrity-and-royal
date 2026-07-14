/**
 * Confidence-label helpers for the canonical Casino Ledger (Stage 9.1).
 *
 * Uses the 7-value vocabulary requested by the Stage 9 checklist (Actual /
 * Imported / User-Entered / Estimated / Generated / Mixed / Missing), kept
 * separate from the existing, more granular `SourceConfidence` type used by
 * `CalculationDrillDownDrawer` so nothing already wired to that type breaks.
 */
import type { CasinoLedgerConfidence } from '@/types/casinoLedger';
import { SOURCE_CONFIDENCE_COLOR, type SourceConfidence } from '@/constants/casinoDashboardTheme';
import { DARK_ROYAL_COLORS } from '@/constants/darkRoyalTheme';

export const CASINO_LEDGER_CONFIDENCE_LABEL: Record<CasinoLedgerConfidence, string> = {
  actual: 'Actual',
  imported: 'Imported',
  'user-entered': 'User-Entered',
  estimated: 'Estimated',
  generated: 'Generated',
  mixed: 'Mixed',
  missing: 'Missing',
};

export const CASINO_LEDGER_CONFIDENCE_COLOR: Record<CasinoLedgerConfidence, string> = {
  actual: DARK_ROYAL_COLORS.green,
  imported: DARK_ROYAL_COLORS.royalBlue,
  'user-entered': DARK_ROYAL_COLORS.purple,
  estimated: DARK_ROYAL_COLORS.orange,
  generated: DARK_ROYAL_COLORS.teal,
  mixed: DARK_ROYAL_COLORS.gold,
  missing: DARK_ROYAL_COLORS.red,
};

/** Maps the old granular drill-down confidence values onto the new broad vocabulary. */
export function toLedgerConfidence(source: SourceConfidence): CasinoLedgerConfidence {
  switch (source) {
    case 'verified-invoice':
      return 'actual';
    case 'imported-csv':
      return 'imported';
    case 'user-entered':
      return 'user-entered';
    case 'calculated':
      return 'generated';
    case 'estimated-default':
      return 'estimated';
    case 'needs-review':
      return 'missing';
    default:
      return 'mixed';
  }
}

/** Maps the new broad vocabulary back onto the old granular type for reuse in existing drill-downs. */
export function toSourceConfidence(ledger: CasinoLedgerConfidence): SourceConfidence {
  switch (ledger) {
    case 'actual':
      return 'verified-invoice';
    case 'imported':
      return 'imported-csv';
    case 'user-entered':
      return 'user-entered';
    case 'generated':
      return 'calculated';
    case 'estimated':
      return 'estimated-default';
    case 'missing':
      return 'needs-review';
    case 'mixed':
    default:
      return 'needs-review';
  }
}

/** Combines multiple confidences into one roll-up value (e.g. for a cruise entry made of several fields). */
export function combineConfidence(values: CasinoLedgerConfidence[]): CasinoLedgerConfidence {
  const present = values.filter((v) => v !== undefined);
  if (present.length === 0) return 'missing';
  if (present.every((v) => v === 'missing')) return 'missing';
  const distinct = new Set(present.filter((v) => v !== 'missing'));
  if (distinct.size === 0) return 'missing';
  if (distinct.size === 1) return Array.from(distinct)[0];
  return 'mixed';
}

export function isEstimateLike(confidence: CasinoLedgerConfidence): boolean {
  return confidence === 'estimated' || confidence === 'generated' || confidence === 'mixed';
}

export { SOURCE_CONFIDENCE_COLOR };
