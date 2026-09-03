import type { CanonicalCasinoHistorySnapshot } from '../history/types';
import type { OptimizationModelSnapshot } from '../models/types';
import type { OptimizationChartSeries } from './types';
import { round } from '../models/statistics';

export function buildOptimizationCharts(
  history: CanonicalCasinoHistorySnapshot,
  model: OptimizationModelSnapshot,
): OptimizationChartSeries[] {
  const sortedOutcomes = [...history.outcomes].sort((a, b) => a.sailDate.localeCompare(b.sailDate));
  const sortedModels = [...model.profile.thresholdModels].sort((a, b) => a.threshold.thresholdPoints - b.threshold.thresholdPoints);
  const certificateHistory: OptimizationChartSeries = {
    id: 'certificate-history', title: 'Certificate History', unit: 'points',
    points: sortedOutcomes.map(o => ({ x: o.sailDate, xNumeric: new Date(o.sailDate).getTime(), y: o.thresholdReached ?? o.totalPoints.value ?? 0, label: o.certificateEarnedCode ?? `${o.totalPoints.value ?? 0} points`, sourceId: o.id, confidence: o.totalPoints.confidence })),
    description: 'Highest certificate threshold reached on each completed cruise.', warnings: [],
  };
  const resultHistory: OptimizationChartSeries = {
    id: 'gambling-result', title: 'Gambling Result Over Time', unit: 'currency',
    points: sortedOutcomes.filter(o => o.actualResult.value !== null).map(o => ({ x: o.sailDate, xNumeric: new Date(o.sailDate).getTime(), y: o.actualResult.value ?? 0, label: o.shipName ?? o.sailDate, sourceId: o.id, confidence: o.actualResult.confidence })),
    description: 'Actual casino result for each completed cruise.', warnings: [],
  };
  const probability: OptimizationChartSeries = {
    id: 'success-probability', title: 'Certificate Success Probability', unit: 'percent',
    points: sortedModels.map(m => ({ x: String(m.threshold.thresholdPoints), xNumeric: m.threshold.thresholdPoints, y: round(m.successProbability.probability * 100, 1), label: m.threshold.certificateCode, sourceId: m.threshold.id, confidence: m.successProbability.confidence })),
    description: 'Personal estimated probability of reaching each certificate threshold.', warnings: [],
  };
  const ev: OptimizationChartSeries = {
    id: 'expected-net-value', title: 'Expected Net Value', unit: 'currency',
    points: sortedModels.map(m => ({ x: String(m.threshold.thresholdPoints), xNumeric: m.threshold.thresholdPoints, y: round(m.classification.expectedNetValue, 2), secondaryY: round(m.classification.riskAdjustedExpectedNetValue, 2), label: m.threshold.certificateCode, sourceId: m.threshold.id, confidence: m.statistics.confidence })),
    description: 'Expected certificate value minus expected gambling loss; secondary value is risk-adjusted.', warnings: [],
  };
  const loss: OptimizationChartSeries = {
    id: 'expected-loss', title: 'Expected Gambling Loss', unit: 'currency',
    points: sortedModels.map(m => ({ x: String(m.threshold.thresholdPoints), xNumeric: m.threshold.thresholdPoints, y: round(m.expectedLoss.expectedAdditionalLoss, 2), secondaryY: round(m.expectedLoss.downsideHigh, 2), label: m.threshold.certificateCode, sourceId: m.threshold.id, confidence: m.expectedLoss.confidence })),
    description: 'Expected gambling loss and high downside estimate for each target.', warnings: [],
  };
  const roi: OptimizationChartSeries = {
    id: 'certificate-roi', title: 'Certificate ROI', unit: 'ratio',
    points: sortedModels.map(m => ({ x: String(m.threshold.thresholdPoints), xNumeric: m.threshold.thresholdPoints, y: m.classification.expectedTotalLoss > 0 ? round(m.classification.expectedCertificateValue / m.classification.expectedTotalLoss, 2) : 0, label: m.threshold.certificateCode, sourceId: m.threshold.id, confidence: m.statistics.confidence })),
    description: 'Expected certificate value divided by expected gambling loss.', warnings: [],
  };
  const marginal: OptimizationChartSeries = {
    id: 'marginal-value', title: 'Marginal Certificate Value', unit: 'currency', points: [],
    description: 'Additional expected certificate value compared with the next lower threshold.', warnings: [],
  };
  sortedModels.forEach((m, index) => {
    const prior = index > 0 ? sortedModels[index - 1].classification.expectedCertificateValue : 0;
    marginal.points.push({ x: String(m.threshold.thresholdPoints), xNumeric: m.threshold.thresholdPoints, y: round(m.classification.expectedCertificateValue - prior, 2), label: m.threshold.certificateCode, sourceId: m.threshold.id, confidence: m.statistics.confidence });
  });
  const efficiency: OptimizationChartSeries = {
    id: 'bankroll-efficiency', title: 'Bankroll Efficiency', unit: 'ratio',
    points: sortedModels.map(m => ({ x: String(m.threshold.thresholdPoints), xNumeric: m.threshold.thresholdPoints, y: m.classification.normalBankrollRequired > 0 ? round(m.threshold.thresholdPoints / m.classification.normalBankrollRequired, 2) : 0, label: m.threshold.certificateCode, sourceId: m.threshold.id, confidence: m.statistics.confidence })),
    description: 'Certificate points reached per expected bankroll dollar required.', warnings: [],
  };
  return [certificateHistory, resultHistory, probability, ev, loss, roi, marginal, efficiency];
}
