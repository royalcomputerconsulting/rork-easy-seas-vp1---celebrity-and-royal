import type { BuildOptimalStoppingRecommendationInput } from '../engine/types';
import type { ConfidenceBand } from '../history/types';
import { round } from '../models/statistics';

export interface TargetEcosystemValueEvidence {
  thresholdDefinitionId: string;
  futureOfferValue?: number | null;
  futureOfferProbability?: number | null;
  tierBenefitValue?: number | null;
  tierReachProbability?: number | null;
  ancillaryValue?: number | null;
  ancillaryUseProbability?: number | null;
  incrementalTravelCost?: number | null;
  incrementalCruiseCost?: number | null;
  cruiseSavings?: number | null;
  unredeemedReplacementValue?: number | null;
  unredeemedProbability?: number | null;
  sourceIds: string[];
  confidence: ConfidenceBand;
  warnings?: string[];
}

export interface EcosystemValueAdjustmentResult {
  adjustmentsByThresholdId: NonNullable<BuildOptimalStoppingRecommendationInput['valueAdjustmentsByThresholdId']>;
  evidenceByThresholdId: Record<string, { sourceIds: string[]; confidence: ConfidenceBand; warnings: string[]; formula: string }>;
}

const money = (value: number | null | undefined) => Math.max(0, Number.isFinite(value) ? Number(value) : 0);
const probability = (value: number | null | undefined, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : fallback;

/** Converts evidenced ecosystem values into the decomposed terms used by the shared engine. */
export function buildEcosystemValueAdjustments(rows: TargetEcosystemValueEvidence[]): EcosystemValueAdjustmentResult {
  const adjustmentsByThresholdId: EcosystemValueAdjustmentResult['adjustmentsByThresholdId'] = {};
  const evidenceByThresholdId: EcosystemValueAdjustmentResult['evidenceByThresholdId'] = {};
  rows.forEach(row => {
    const futureOffer = money(row.futureOfferValue) * probability(row.futureOfferProbability, row.futureOfferValue == null ? 0 : 0.5);
    const tier = money(row.tierBenefitValue) * probability(row.tierReachProbability, row.tierBenefitValue == null ? 0 : 0.5);
    const ancillary = money(row.ancillaryValue) * probability(row.ancillaryUseProbability, row.ancillaryValue == null ? 0 : 0.75);
    const unredeemed = money(row.unredeemedReplacementValue) * probability(row.unredeemedProbability, row.unredeemedReplacementValue == null ? 0 : 0.5);
    adjustmentsByThresholdId[row.thresholdDefinitionId] = {
      incrementalFutureOfferValue: round(futureOffer, 2),
      incrementalTierValue: round(tier, 2),
      incrementalAncillaryValue: round(ancillary + money(row.cruiseSavings), 2),
      incrementalTravelCost: round(money(row.incrementalTravelCost), 2),
      incrementalCruiseCost: round(money(row.incrementalCruiseCost), 2),
      expectedUnredeemedValueLoss: round(unredeemed, 2),
    };
    const warnings = [...(row.warnings ?? [])];
    if (row.sourceIds.length === 0) warnings.push('No source record IDs support these ecosystem value adjustments.');
    if (row.confidence === 'missing' || row.confidence === 'low') warnings.push('Ecosystem value terms are low confidence and may materially change the recommendation.');
    evidenceByThresholdId[row.thresholdDefinitionId] = {
      sourceIds: [...new Set(row.sourceIds)], confidence: row.confidence, warnings: [...new Set(warnings)],
      formula: 'expected term = evidenced value × evidenced probability; unknown values contribute zero',
    };
  });
  return { adjustmentsByThresholdId, evidenceByThresholdId };
}
