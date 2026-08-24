import type { CasinoIntelligenceDecision } from '../CasinoIntelligenceEngine';
import type { ConfidenceBand } from '../history/types';

export interface CasinoPortfolioDecisionCandidate { cruiseId: string; shipName: string; sailDate: string; travelCost: number; cruiseCost: number; decision: CasinoIntelligenceDecision }
export interface CasinoPortfolioPlan {
  selected: CasinoPortfolioDecisionCandidate[];
  deferred: Array<CasinoPortfolioDecisionCandidate & { reason: string }>;
  totalExpectedNetVacationValue: number;
  totalExpectedCost: number;
  confidence: ConfidenceBand;
  constraints: { maximumTrips: number; maximumCashCost: number | null };
  warnings: string[];
}

/** Deterministic, explainable portfolio selection. It never invents trips or costs. */
export function buildCasinoPortfolioPlan(input: { candidates: CasinoPortfolioDecisionCandidate[]; maximumTrips: number; maximumCashCost?: number | null }): CasinoPortfolioPlan {
  const maximumTrips = Math.max(0, Math.floor(input.maximumTrips));
  const maximumCashCost = input.maximumCashCost == null ? null : Math.max(0, input.maximumCashCost);
  const selected: CasinoPortfolioDecisionCandidate[] = [];
  const deferred: CasinoPortfolioPlan['deferred'] = [];
  let totalExpectedCost = 0;
  const ranked = [...input.candidates].sort((a, b) => {
    const aEv = a.decision.nextBestAction.expectedNetVacationValue, bEv = b.decision.nextBestAction.expectedNetVacationValue;
    const aCost = Math.max(1, a.travelCost + a.cruiseCost + a.decision.nextBestAction.expectedAdditionalLoss);
    const bCost = Math.max(1, b.travelCost + b.cruiseCost + b.decision.nextBestAction.expectedAdditionalLoss);
    return bEv / bCost - aEv / aCost || bEv - aEv || a.sailDate.localeCompare(b.sailDate);
  });
  ranked.forEach(candidate => {
    const ev = candidate.decision.nextBestAction.expectedNetVacationValue;
    const cost = Math.max(0, candidate.travelCost) + Math.max(0, candidate.cruiseCost) + Math.max(0, candidate.decision.nextBestAction.expectedAdditionalLoss);
    if (ev <= 0) return void deferred.push({ ...candidate, reason: 'Expected net vacation value is not positive.' });
    if (selected.length >= maximumTrips) return void deferred.push({ ...candidate, reason: 'Maximum trip count reached.' });
    if (maximumCashCost !== null && totalExpectedCost + cost > maximumCashCost) return void deferred.push({ ...candidate, reason: 'Adding this cruise would exceed the cash-cost constraint.' });
    selected.push(candidate); totalExpectedCost += cost;
  });
  const confidences = selected.map(row => row.decision.nextBestAction.confidence);
  const confidence: ConfidenceBand = confidences.length === 0 ? 'missing' : confidences.includes('missing') ? 'missing' : confidences.includes('low') ? 'low' : confidences.includes('medium') ? 'medium' : 'high';
  return {
    selected, deferred,
    totalExpectedNetVacationValue: selected.reduce((sum, row) => sum + row.decision.nextBestAction.expectedNetVacationValue, 0),
    totalExpectedCost, confidence, constraints: { maximumTrips, maximumCashCost },
    warnings: confidence === 'high' ? [] : ['Portfolio results inherit missing or estimated cruise, redemption, and casino evidence.'],
  };
}
