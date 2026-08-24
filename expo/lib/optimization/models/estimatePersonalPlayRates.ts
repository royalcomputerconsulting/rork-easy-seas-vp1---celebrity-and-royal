import type { CanonicalCasinoHistorySnapshot, CasinoSessionObservation, OptimizationCasinoProgram } from '../history/types';
import { confidenceBand, mean, median, quantile, robustValues, round, standardDeviation } from './statistics';

export interface PersonalRateDistribution {
  mean: number | null;
  median: number | null;
  trimmedMean: number | null;
  standardDeviation: number | null;
  percentile25: number | null;
  percentile75: number | null;
  percentile90: number | null;
  confidenceInterval95: { low: number; high: number } | null;
  sampleCount: number;
}

export interface PersonalPlayRateEstimate {
  selectedContext: 'same-machine' | 'same-ship' | 'similar-session' | 'recent-personal' | 'lifetime-personal' | 'generic-fallback';
  coinInPerPoint: PersonalRateDistribution;
  actualLossPerThousandPoints: PersonalRateDistribution;
  actualLossPerThousandCoinIn: PersonalRateDistribution;
  sourceObservationIds: string[];
  confidence: 'high' | 'medium' | 'low' | 'missing';
  warnings: string[];
}

function distribution(values: number[]): PersonalRateDistribution {
  const clean = values.filter(value => Number.isFinite(value) && value >= 0);
  const trimmed = robustValues(clean);
  const avg = mean(clean);
  const sd = standardDeviation(clean);
  const margin = avg === null || sd === null || clean.length === 0 ? null : 1.96 * sd / Math.sqrt(clean.length);
  return {
    mean: avg === null ? null : round(avg, 4),
    median: median(clean) === null ? null : round(median(clean) ?? 0, 4),
    trimmedMean: mean(trimmed) === null ? null : round(mean(trimmed) ?? 0, 4),
    standardDeviation: sd === null ? null : round(sd, 4),
    percentile25: quantile(clean, 0.25) === null ? null : round(quantile(clean, 0.25) ?? 0, 4),
    percentile75: quantile(clean, 0.75) === null ? null : round(quantile(clean, 0.75) ?? 0, 4),
    percentile90: quantile(clean, 0.9) === null ? null : round(quantile(clean, 0.9) ?? 0, 4),
    confidenceInterval95: margin === null ? null : { low: round(Math.max(0, avg! - margin), 4), high: round(avg! + margin, 4) },
    sampleCount: clean.length,
  };
}

function usable(session: CasinoSessionObservation): boolean {
  return session.reconciliationStatus === 'matched' && session.pointsEarned !== null && session.pointsEarned > 0;
}

export function estimatePersonalPlayRates(input: {
  history: CanonicalCasinoHistorySnapshot;
  program: OptimizationCasinoProgram;
  shipName?: string | null;
  machineId?: string | null;
  machineFamily?: string | null;
  dayType?: CasinoSessionObservation['dayType'] | null;
  asOf: string;
  genericDollarsPerPoint: number;
  genericLossRate: number;
}): PersonalPlayRateEstimate {
  const shipByCruise = new Map(input.history.outcomes.map(outcome => [outcome.cruiseId, outcome.shipName.toLowerCase()]));
  const all = input.history.sessionReconciliation.observations
    .filter(session => usable(session) && session.program === input.program)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const sameMachine = input.machineId ? all.filter(session => session.machineId === input.machineId) : [];
  const sameShip = input.shipName ? all.filter(session => session.cruiseId && shipByCruise.get(session.cruiseId) === input.shipName!.toLowerCase()) : [];
  const similar = all.filter(session => (!input.machineFamily || session.machineFamily === input.machineFamily) && (!input.dayType || session.dayType === input.dayType));
  const choices: Array<{ label: PersonalPlayRateEstimate['selectedContext']; rows: CasinoSessionObservation[]; minimum: number }> = [
    { label: 'same-machine', rows: sameMachine, minimum: 3 },
    { label: 'same-ship', rows: sameShip, minimum: 3 },
    { label: 'similar-session', rows: similar, minimum: 3 },
    { label: 'recent-personal', rows: all.slice(0, 10), minimum: 3 },
    { label: 'lifetime-personal', rows: all, minimum: 1 },
  ];
  const selected = choices.find(choice => choice.rows.length >= choice.minimum) ?? null;
  const rows = selected?.rows ?? [];
  const coinRates = rows.flatMap(session => session.coinIn !== null && session.pointsEarned ? [session.coinIn / session.pointsEarned] : []);
  const lossPerPoints = rows.flatMap(session => session.winLoss !== null && session.pointsEarned ? [Math.max(0, -session.winLoss) / session.pointsEarned * 1000] : []);
  const lossPerCoin = rows.flatMap(session => session.winLoss !== null && session.coinIn !== null && session.coinIn > 0 ? [Math.max(0, -session.winLoss) / session.coinIn * 1000] : []);
  const fallback = selected === null || coinRates.length === 0;
  const effectiveCoin = fallback ? [Math.max(0, input.genericDollarsPerPoint)] : coinRates;
  const effectiveLossPerCoin = lossPerCoin.length > 0 ? lossPerCoin : [Math.max(0, input.genericLossRate) * 1000];
  const effectiveLossPerPoints = lossPerPoints.length > 0 ? lossPerPoints : [effectiveCoin[0] * Math.max(0, input.genericLossRate) * 1000];
  const sampleCount = fallback ? 0 : Math.min(coinRates.length, rows.length);
  const quality = input.history.overallDataHealth.score / 100;
  const warnings: string[] = [];
  if (fallback) warnings.push('Personal coin-in-per-point evidence is insufficient; the configurable generic fallback is used.');
  if (lossPerCoin.length === 0) warnings.push('Personal actual-loss evidence is insufficient; the configured loss-rate prior is used.');
  if (rows.length < 3) warnings.push('Fewer than three comparable personal sessions are available.');
  return {
    selectedContext: fallback ? 'generic-fallback' : selected!.label,
    coinInPerPoint: distribution(effectiveCoin),
    actualLossPerThousandPoints: distribution(effectiveLossPerPoints),
    actualLossPerThousandCoinIn: distribution(effectiveLossPerCoin),
    sourceObservationIds: rows.map(row => row.id),
    confidence: confidenceBand(sampleCount, quality),
    warnings,
  };
}
