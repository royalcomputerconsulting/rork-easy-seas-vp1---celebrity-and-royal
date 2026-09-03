import type { OptimizationModelSnapshot } from '../models/types';
import { stableModelFingerprint } from '../models/statistics';
import type { PersonalThresholdDashboardRow, ThresholdDrillDownSnapshot } from './types';

export function buildThresholdDrillDown(
  ownerProfileId: string,
  row: PersonalThresholdDashboardRow,
  model: OptimizationModelSnapshot,
  generatedAt = model.generatedAt,
): ThresholdDrillDownSnapshot {
  if (ownerProfileId !== model.ownerProfileId) throw new Error('Profile mismatch for threshold drill-down.');
  const thresholdModel = model.profile.thresholdModels.find(m => m.threshold.id === row.thresholdDefinitionId);
  if (!thresholdModel) throw new Error('Threshold model not found.');
  return {
    id: `threshold-drilldown:${stableModelFingerprint([model.id, row.thresholdDefinitionId, generatedAt])}`,
    ownerProfileId, generatedAt, threshold: row,
    formulas: [
      { label: 'Expected net value', formula: 'expected certificate value − expected gambling loss', value: `$${row.expectedNetValue.toFixed(0)}` },
      { label: 'Risk-adjusted net value', formula: 'expected net value − uncertainty and downside penalties', value: `$${row.riskAdjustedExpectedNetValue.toFixed(0)}` },
      { label: 'Success probability', formula: 'personal history + pace + bankroll + deterministic simulation', value: `${(row.successProbability * 100).toFixed(1)}%` },
      { label: 'Certificate ROI', formula: 'expected certificate value ÷ expected gambling loss', value: row.expectedLoss > 0 ? (row.expectedCertificateValue / row.expectedLoss).toFixed(2) : 'N/A' },
    ],
    comparableCruiseIds: thresholdModel.successProbability.includedCruiseOutcomeIds,
    assumptions: [...thresholdModel.expectedLoss.assumptions],
    sourceEvidence: row.sourceEvidence,
    warnings: row.warnings,
  };
}
