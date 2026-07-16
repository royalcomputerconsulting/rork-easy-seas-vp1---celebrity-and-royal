import type { CertificateRecommendationAction, CertificateRecommendationSnapshot } from '../engine/types';
import type { ConfidenceBand } from '../history/types';
import type { PersonalTargetLabel } from '../models/types';

export interface RecommendationOutcomeInput {
  recommendation: CertificateRecommendationSnapshot;
  cruiseOutcomeId: string;
  cruiseSailDate: string;
  actualFinalPoints: number;
  actualCasinoResult: number;
  actualAdditionalCoinIn: number | null;
  actualAdditionalLoss: number | null;
  actualCertificateCode: string | null;
  actualCertificateValueRealized: number | null;
  recommendationFollowed: boolean | null;
  playContinuedAfterRecommendation: boolean | null;
  finalizedAt: string;
}

export interface RecommendationOutcomeRecord {
  id: string;
  ownerProfileId: string;
  recommendationId: string;
  cruiseOutcomeId: string;
  cruiseSailDate: string;
  action: CertificateRecommendationAction;
  recommendedTargetPoints: number | null;
  predictedSuccessProbability: number | null;
  predictedExpectedAdditionalLoss: number;
  predictedRiskAdjustedIncrementalEv: number;
  actualFinalPoints: number;
  targetReached: boolean | null;
  actualCasinoResult: number;
  actualAdditionalCoinIn: number | null;
  actualAdditionalLoss: number | null;
  actualCertificateCode: string | null;
  actualCertificateValueRealized: number | null;
  actualIncrementalNetValue: number | null;
  recommendationFollowed: boolean | null;
  playContinuedAfterRecommendation: boolean | null;
  stopContinueCorrect: boolean | null;
  targetPredictionCorrect: boolean | null;
  confidence: ConfidenceBand;
  modelVersion: string;
  engineVersion: string;
  finalizedAt: string;
  warnings: string[];
}

export interface CalibrationBin {
  lowerBound: number;
  upperBound: number;
  predictionCount: number;
  averagePredictedProbability: number | null;
  observedSuccessRate: number | null;
  calibrationError: number | null;
}

export interface ConfidenceReliability {
  confidence: ConfidenceBand;
  count: number;
  targetAccuracy: number | null;
  stopContinueAccuracy: number | null;
  meanAbsoluteEvError: number | null;
}

export interface RecommendationAccuracySnapshot {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  outcomeCount: number;
  followedCount: number;
  targetAccuracy: number | null;
  stopContinueAccuracy: number | null;
  meanAbsoluteEvError: number | null;
  meanAbsoluteLossError: number | null;
  brierScore: number | null;
  calibration: CalibrationBin[];
  confidenceReliability: ConfidenceReliability[];
  modelVersions: Record<string, number>;
  warnings: string[];
}

export interface BacktestPrediction {
  id: string;
  ownerProfileId: string;
  modelVersion: string;
  trainOutcomeIds: string[];
  trainEndDate: string | null;
  testOutcomeId: string;
  testSailDate: string;
  predictedTargetPoints: number | null;
  predictedSuccessProbability: number | null;
  predictedIncrementalEv: number;
  predictedAction: CertificateRecommendationAction;
  actualFinalPoints: number;
  actualIncrementalNetValue: number | null;
  targetReached: boolean | null;
  safetyViolation: boolean;
}

export interface ModelBacktestReport {
  id: string;
  ownerProfileId: string;
  modelVersion: string;
  generatedAt: string;
  predictionCount: number;
  targetAccuracy: number | null;
  brierScore: number | null;
  meanAbsoluteEvError: number | null;
  safetyViolationRate: number;
  leakageViolationCount: number;
  predictions: BacktestPrediction[];
  warnings: string[];
}

export interface ModelPromotionDecision {
  candidateModelVersion: string;
  baselineModelVersion: string;
  eligible: boolean;
  promoted: boolean;
  reasons: string[];
  warnings: string[];
  comparedPredictionCount: number;
}

export interface PersonalTargetLabelObservation {
  cruiseOutcomeId: string;
  sailDate: string;
  thresholdPoints: number;
  proposedLabel: PersonalTargetLabel;
  evidenceSamples: number;
  successProbability: number;
  riskAdjustedExpectedNetValue: number;
}

export interface StableTargetLabelDecision {
  thresholdPoints: number;
  currentLabel: PersonalTargetLabel;
  proposedLabel: PersonalTargetLabel;
  acceptedLabel: PersonalTargetLabel;
  accepted: boolean;
  supportingObservationIds: string[];
  reasons: string[];
  warnings: string[];
}

export interface LearningControlState {
  ownerProfileId: string;
  excludedCruiseOutcomeIds: string[];
  excludedRecommendationOutcomeIds: string[];
  resetRequestedAt: string | null;
  rebuildRequestedAt: string | null;
  rebuildReason: string | null;
  generation: number;
  updatedAt: string;
}
