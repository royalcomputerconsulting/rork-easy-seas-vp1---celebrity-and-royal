export function calculateTrueMakeout(input: { retailValue?: number; compValue?: number; cashPaid?: number; taxesFees?: number; onboardSpend?: number; casinoNetResult?: number; fccApplied?: number; obcValue?: number; freeplayValue?: number }) {
  const n = (v: unknown) => Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0;
  const grossValue = n(input.retailValue) + n(input.compValue) + n(input.obcValue) + n(input.freeplayValue);
  const actualCashCost = n(input.cashPaid) + n(input.taxesFees) + n(input.onboardSpend) - n(input.fccApplied) - Math.max(0, n(input.casinoNetResult));
  const casinoLossImpact = Math.max(0, -n(input.casinoNetResult));
  const trueMakeout = grossValue - actualCashCost - casinoLossImpact;
  return { grossValue, actualCashCost, casinoLossImpact, trueMakeout, warnings: ['Casino net wins increase make-out; casino net losses reduce make-out.', 'Coin-in is wagering volume, not cost.', 'FCC is payment credit, not casino comp value.'] };
}
