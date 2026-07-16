import type {
  CasinoCruiseOutcome,
  CanonicalCasinoHistorySnapshot,
  ConfidenceBand,
  OptimizationCasinoBrand,
  OptimizationCasinoProgram,
} from '../history/types';
import type { CertificateThresholdDefinition, CertificateValueSnapshot } from '../value/types';

export type PersonalTargetLabel =
  | 'Comfortable'
  | 'Primary Target'
  | 'Stretch Goal'
  | 'Exceptional Goal'
  | 'Normally Avoid'
  | 'Unrealistic';

export interface PersonalOptimizerPriors {
  ownerProfileId: string;
  dailyBankrollBudget: number;
  tripBankrollBudget: number | null;
  volatilityTolerance: 'conservative' | 'moderate' | 'aggressive';
  dollarsPerPoint: number;
  theoreticalLossRate: number;
  minimumPromotionSamples: number;
  minimumStableSuccessProbability: number;
  defaultThresholdLabels: Record<number, PersonalTargetLabel>;
  source: string;
  updatedAt: string;
}

export interface ThresholdMetricDistribution {
  mean: number | null;
  median: number | null;
  low: number | null;
  high: number | null;
  standardDeviation: number | null;
  sampleCount: number;
}

export interface ThresholdStatistics {
  thresholdDefinitionId: string;
  thresholdPoints: number;
  certificateCode: string;
  opportunities: number;
  attempts: number;
  successes: number;
  failures: number;
  rawSuccessRate: number | null;
  smoothedSuccessRate: number;
  successRateConfidenceInterval: { low: number; high: number };
  coinIn: ThresholdMetricDistribution;
  actualResult: ThresholdMetricDistribution;
  bankrollConsumed: ThresholdMetricDistribution;
  tripLength: ThresholdMetricDistribution;
  pointsPerDay: ThresholdMetricDistribution;
  pointsPerSession: ThresholdMetricDistribution;
  pointsPerHour: ThresholdMetricDistribution;
  lossRate: ThresholdMetricDistribution;
  averageLossOnLosingCruises: number | null;
  averageWinOnWinningCruises: number | null;
  resultVariance: number | null;
  resultStandardDeviation: number | null;
  recencyWeightedTrend: number;
  dataQuality: number;
  confidence: ConfidenceBand;
  includedCruiseOutcomeIds: string[];
  excludedCruiseOutcomeIds: string[];
  warnings: string[];
}

export interface LiveTargetContext {
  ownerProfileId: string;
  program: OptimizationCasinoProgram;
  brand: OptimizationCasinoBrand;
  shipName?: string | null;
  cruiseNights?: number | null;
  currentPoints: number;
  targetPoints: number;
  remainingCasinoHours: number | null;
  remainingCasinoDays: number | null;
  currentResult: number;
  remainingBankroll: number | null;
  machineFamilies?: string[];
  asOf: string;
}

export interface ComparableHistoryDecision {
  cruiseOutcomeId: string;
  included: boolean;
  similarityScore: number;
  reasons: string[];
  exclusions: string[];
}

export interface ComparableHistorySelection {
  targetPoints: number;
  includedOutcomes: CasinoCruiseOutcome[];
  excludedOutcomes: CasinoCruiseOutcome[];
  decisions: ComparableHistoryDecision[];
  minimumSimilarity: number;
  warnings: string[];
}

export interface ExpectedLossEstimate {
  thresholdDefinitionId: string;
  targetPoints: number;
  pointsRemaining: number;
  expectedAdditionalCoinIn: number;
  empiricalLossRate: number | null;
  theoreticalLossRate: number;
  blendedLossRate: number;
  empiricalWeight: number;
  expectedAdditionalLoss: number;
  downsideLow: number;
  downsideHigh: number;
  costPerPoint: number;
  sampleCount: number;
  confidence: ConfidenceBand;
  assumptions: string[];
  warnings: string[];
}

export interface SuccessProbabilityEstimate {
  thresholdDefinitionId: string;
  targetPoints: number;
  pointsRemaining: number;
  historicalProbability: number;
  paceFeasibility: number;
  bankrollFeasibility: number;
  simulationProbability: number;
  probability: number;
  confidence: ConfidenceBand;
  comparableSampleCount: number;
  simulationCount: number;
  seed: string;
  includedCruiseOutcomeIds: string[];
  warnings: string[];
}

export interface PersonalTargetClassification {
  thresholdDefinitionId: string;
  thresholdPoints: number;
  label: PersonalTargetLabel;
  priorLabel: PersonalTargetLabel;
  expectedCertificateValue: number;
  expectedTotalLoss: number;
  expectedNetValue: number;
  riskAdjustedExpectedNetValue: number;
  successProbability: number;
  normalBankrollRequired: number;
  evidenceSamples: number;
  promotionEligible: boolean;
  changedFromPrior: boolean;
  reasons: string[];
  warnings: string[];
}

export interface OptimizationThresholdModel {
  threshold: CertificateThresholdDefinition;
  valueSnapshot: CertificateValueSnapshot | null;
  statistics: ThresholdStatistics;
  expectedLoss: ExpectedLossEstimate;
  successProbability: SuccessProbabilityEstimate;
  classification: PersonalTargetClassification;
}

export interface PersonalGamblingProfile {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  priors: PersonalOptimizerPriors;
  averageBankrollConsumed: number | null;
  averageActualLoss: number | null;
  averageActualWin: number | null;
  averagePointsPerDay: number | null;
  averagePointsPerSession: number | null;
  modelMaturity: 'insufficient' | 'developing' | 'established';
  thresholdModels: OptimizationThresholdModel[];
  currentPrimaryTarget: number | null;
  highestExpectedValueTarget: number | null;
  warnings: string[];
  version: string;
}

export interface OptimizationModelSnapshot {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  canonicalHistorySnapshotId: string;
  certificateValueSnapshotIds: string[];
  profile: PersonalGamblingProfile;
  modelVersion: string;
  priorSnapshotId: string | null;
  deterministicFingerprint: string;
}

export interface BuildPersonalGamblingProfileInput {
  ownerProfileId: string;
  history: CanonicalCasinoHistorySnapshot;
  thresholds: CertificateThresholdDefinition[];
  valueSnapshots: CertificateValueSnapshot[];
  priors: PersonalOptimizerPriors;
  generatedAt?: string;
  priorSnapshotId?: string | null;
}
