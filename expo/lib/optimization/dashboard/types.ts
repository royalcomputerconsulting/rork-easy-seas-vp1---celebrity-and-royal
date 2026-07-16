import type { CertificateRecommendationSnapshot } from '../engine/types';
import type { CanonicalCasinoHistorySnapshot, ConfidenceBand } from '../history/types';
import type { OptimizationModelSnapshot, PersonalTargetLabel } from '../models/types';
import type { ValueSourceEvidence } from '../value/types';

export interface OptimizationChartPoint {
  x: string;
  xNumeric: number | null;
  y: number;
  secondaryY?: number | null;
  label: string;
  sourceId?: string;
  confidence?: ConfidenceBand;
}

export interface OptimizationChartSeries {
  id: string;
  title: string;
  unit: 'points' | 'currency' | 'percent' | 'ratio' | 'count';
  points: OptimizationChartPoint[];
  description: string;
  warnings: string[];
}

export interface PersonalThresholdDashboardRow {
  thresholdDefinitionId: string;
  certificateCode: string;
  thresholdPoints: number;
  label: PersonalTargetLabel;
  successProbability: number;
  expectedCertificateValue: number;
  expectedLoss: number;
  expectedNetValue: number;
  riskAdjustedExpectedNetValue: number;
  normalBankrollRequired: number;
  attempts: number;
  successes: number;
  confidence: ConfidenceBand;
  sourceEvidence: ValueSourceEvidence[];
  reasons: string[];
  warnings: string[];
}

export interface PersonalTripSummary {
  cruiseOutcomeId: string;
  shipName: string | null;
  sailDate: string;
  points: number | null;
  result: number | null;
  bankrollConsumed: number | null;
  certificateCode: string | null;
}

export interface PersonalGamblingDashboardSnapshot {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  modelVersion: string;
  historySnapshotId: string;
  averageCertificatePoints: number | null;
  favoriteCertificateCode: string | null;
  mostProfitableCertificateCode: string | null;
  highestExpectedValueCertificateCode: string | null;
  averageBankroll: number | null;
  averageGamblingLoss: number | null;
  averageGamblingWin: number | null;
  bestTrip: PersonalTripSummary | null;
  worstTrip: PersonalTripSummary | null;
  currentRecommendedTarget: number | null;
  recommendationAccuracy: number | null;
  modelMaturity: OptimizationModelSnapshot['profile']['modelMaturity'];
  thresholds: PersonalThresholdDashboardRow[];
  charts: OptimizationChartSeries[];
  latestRecommendation: CertificateRecommendationSnapshot | null;
  warnings: string[];
}

export interface BuildPersonalDashboardInput {
  history: CanonicalCasinoHistorySnapshot;
  model: OptimizationModelSnapshot;
  latestRecommendation?: CertificateRecommendationSnapshot | null;
  recommendationAccuracy?: number | null;
  generatedAt?: string;
}

export interface ThresholdDrillDownSnapshot {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  threshold: PersonalThresholdDashboardRow;
  formulas: Array<{ label: string; formula: string; value: string }>;
  comparableCruiseIds: string[];
  assumptions: string[];
  sourceEvidence: ValueSourceEvidence[];
  warnings: string[];
}
