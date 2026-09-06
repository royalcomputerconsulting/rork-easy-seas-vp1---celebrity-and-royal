import { clamp, round } from '../models/statistics';

export interface BankrollSurvivalEstimate {
  survivalProbability: number | null;
  riskOfRuinProbability: number | null;
  requiredBankrollP50: number;
  requiredBankrollP75: number;
  requiredBankrollP90: number;
  recommendedBuffer: number;
  confidence: 'high' | 'medium' | 'low' | 'missing';
  assumptions: string[];
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function calculateBankrollSurvival(input: {
  expectedLoss: number;
  downsideLow: number;
  downsideHigh: number;
  remainingBankroll: number | null;
  sampleCount?: number;
}): BankrollSurvivalEstimate {
  const expected = Math.max(0, Number.isFinite(input.expectedLoss) ? input.expectedLoss : 0);
  const low = Math.max(0, Number.isFinite(input.downsideLow) ? input.downsideLow : expected);
  const high = Math.max(expected, Number.isFinite(input.downsideHigh) ? input.downsideHigh : expected);
  // Existing loss models expose a conservative low/high range. Treat it as an
  // approximate 10th/90th percentile interval rather than inventing sessions.
  const sigma = Math.max(1, (high - low) / 2.563);
  const p50 = expected;
  const p75 = expected + 0.674 * sigma;
  const p90 = expected + 1.282 * sigma;
  const bankroll = input.remainingBankroll;
  const survival = bankroll === null ? null : clamp(normalCdf((Math.max(0, bankroll) - expected) / sigma));
  const sampleCount = Math.max(0, input.sampleCount ?? 0);
  const confidence = sampleCount >= 10 ? 'high' : sampleCount >= 3 ? 'medium' : sampleCount > 0 ? 'low' : 'missing';
  return {
    survivalProbability: survival === null ? null : round(survival, 4),
    riskOfRuinProbability: survival === null ? null : round(1 - survival, 4),
    requiredBankrollP50: round(p50, 2),
    requiredBankrollP75: round(p75, 2),
    requiredBankrollP90: round(p90, 2),
    recommendedBuffer: round(Math.max(0, p90 - p50), 2),
    confidence,
    assumptions: ['Bankroll percentiles use the personal expected-loss range; they are estimates, not guarantees.', 'Hard bankroll limits always override modeled expected value.'],
  };
}
