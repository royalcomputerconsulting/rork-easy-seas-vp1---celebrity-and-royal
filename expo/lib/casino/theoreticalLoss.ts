export interface TheoreticalLossResult {
  coinIn: number;
  assumedHoldPercent: number;
  theoreticalLoss: number;
  actualLoss: number;
  earnedCompValue: number;
  compsPerTheoDollar: number | null;
  compsPerActualLossDollar: number | null;
  evidenceWarning: string;
}

export function calculateTheoreticalLoss(input: { coinIn: number; assumedHoldPercent: number; actualNetResult: number; earnedCompValue: number }): TheoreticalLossResult {
  const coinIn = Math.max(0, Number.isFinite(input.coinIn) ? input.coinIn : 0);
  const hold = Math.max(0, Math.min(100, Number.isFinite(input.assumedHoldPercent) ? input.assumedHoldPercent : 0));
  const theoreticalLoss = coinIn * hold / 100;
  const actualLoss = Math.max(0, -input.actualNetResult);
  const earnedCompValue = Math.max(0, input.earnedCompValue || 0);
  return {
    coinIn,
    assumedHoldPercent: hold,
    theoreticalLoss,
    actualLoss,
    earnedCompValue,
    compsPerTheoDollar: theoreticalLoss > 0 ? earnedCompValue / theoreticalLoss : null,
    compsPerActualLossDollar: actualLoss > 0 ? earnedCompValue / actualLoss : null,
    evidenceWarning: 'Hold and cruise-line rating formulas are assumptions unless the casino supplied them; this is planning math, not a promise of offers or comps.',
  };
}
