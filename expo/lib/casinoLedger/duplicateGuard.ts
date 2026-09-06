/**
 * Duplicate-counting protection (Stage 9.1, checklist item 6).
 *
 * Pure, side-effect-free helpers that decide whether FreePlay, OBC,
 * certificate value, or comp/cruise value should be counted in a cruise's
 * total economic value — and explain why when they're excluded. These are
 * consumed by `useCasinoLedger` and can also be called directly from any
 * drill-down that needs to show its own "why this is/isn't included" note.
 */
import type { CasinoBenefitInclusion } from '@/types/casinoLedger';
import type { BookedCruise } from '@/types/models';

/**
 * FreePlay is only counted once. If the cruise's win/loss result already
 * reflects FreePlay having been played through (i.e. cashResult/winnings
 * already nets it in), we exclude it from being added again as a separate
 * benefit line.
 */
export function resolveFreePlayInclusion(cruise: BookedCruise): CasinoBenefitInclusion {
  const amount = cruise.freePlay ?? 0;
  if (amount <= 0) {
    return { amount: 0, includedInTotal: false, reason: 'No FreePlay recorded for this cruise.' };
  }
  const hasNettedWinLoss = typeof cruise.cashResult === 'number' || typeof cruise.netResult === 'number';
  if (hasNettedWinLoss) {
    return {
      amount,
      includedInTotal: false,
      reason: 'FreePlay already reflected inside the recorded cash/net result for this cruise, so it is excluded here to avoid double-counting.',
    };
  }
  return {
    amount,
    includedInTotal: true,
    reason: 'No separate win/loss result recorded, so FreePlay is counted as its own benefit.',
  };
}

/**
 * OBC is excluded from total value if it was already used to reduce the
 * cash paid (netEffectivePaid / amountPaid already reflects the discount).
 */
export function resolveObcInclusion(cruise: BookedCruise): CasinoBenefitInclusion {
  const amount = cruise.freeOBC ?? 0;
  if (amount <= 0) {
    return { amount: 0, includedInTotal: false, reason: 'No OBC recorded for this cruise.' };
  }
  const paidAlreadyNetsObc = typeof cruise.netEffectivePaid === 'number' && cruise.netEffectivePaid < (cruise.amountPaid ?? cruise.pricePaid ?? cruise.netEffectivePaid);
  if (paidAlreadyNetsObc) {
    return {
      amount,
      includedInTotal: false,
      reason: 'OBC already reduced the recorded cash paid for this cruise, so it is excluded from the benefits total to avoid double-counting.',
    };
  }
  return {
    amount,
    includedInTotal: true,
    reason: 'OBC has not already reduced cash paid on this cruise, so it is counted as its own benefit.',
  };
}

/**
 * A redeemed instant certificate's value is either counted as wallet value
 * (before it's used) or as part of the comp/cruise value of the cruise it
 * was redeemed on — never both.
 */
export function resolveCertificateValueInclusion(cruise: BookedCruise): CasinoBenefitInclusion {
  const amount = cruise.instantCertificateValue ?? cruise.nextCruiseCertificateValue ?? 0;
  if (amount <= 0) {
    return { amount: 0, includedInTotal: false, reason: 'No certificate value recorded for this cruise.' };
  }
  const usedOnThisCruise = Boolean(cruise.usedNextCruiseCertificate);
  if (usedOnThisCruise) {
    return {
      amount,
      includedInTotal: true,
      reason: 'Certificate was redeemed on this cruise, so its value is counted once here as part of this cruise\u2019s comp value (not counted again in the certificate wallet).',
    };
  }
  return {
    amount,
    includedInTotal: false,
    reason: 'Certificate has not been redeemed yet, so its value stays in the certificate wallet and is excluded from this cruise\u2019s total to avoid double-counting.',
  };
}

/** Convenience: sums only the `includedInTotal` amounts from a list of benefit inclusions. */
export function sumIncludedBenefits(...inclusions: CasinoBenefitInclusion[]): number {
  return inclusions.reduce((sum, b) => sum + (b.includedInTotal ? b.amount : 0), 0);
}
