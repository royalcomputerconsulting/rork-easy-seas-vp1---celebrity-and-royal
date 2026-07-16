import type {
  CanonicalCasinoHistorySnapshot,
  ConfidenceBand,
  OptimizationCasinoBrand,
  OptimizationCasinoProgram,
} from '../history/types';
import type {
  OptimizationModelSnapshot,
  PersonalTargetLabel,
} from '../models/types';
import type {
  CertificateFamily,
  CertificateThresholdDefinition,
  CertificateValueSnapshot,
} from '../value/types';

export type CertificateRecommendationAction =
  | 'DATA_UNAVAILABLE'
  | 'HARD_STOP'
  | 'STOP_NOW'
  | 'BANK_YOUR_WIN'
  | 'DO_NOT_CHASE'
  | 'PLAY_ONE_MORE_SESSION'
  | 'CONTINUE_UNTIL_TARGET'
  | 'PROFIT_PROTECTED_PUSH'
  | 'EXCELLENT_OPPORTUNITY';

export interface LiveOptimizationState {
  ownerProfileId: string;
  program: OptimizationCasinoProgram;
  brand: OptimizationCasinoBrand;
  certificateFamily: CertificateFamily;
  shipName?: string | null;
  cruiseNights?: number | null;
  currentPoints: number;
  currentResult: number;
  currentCoinIn?: number | null;
  remainingCasinoHours: number | null;
  remainingCasinoDays: number | null;
  remainingBankroll: number | null;
  dailyBankrollBudget: number;
  tripBankrollBudget: number | null;
  currentDailyLoss: number;
  currentTripLoss: number;
  hardDailyLossLimit: number;
  hardTripLossLimit: number | null;
  lockedProfitFloor: number | null;
  sessionDurationMinutes?: number | null;
  sameDayPlayMinutes?: number | null;
  fatigueRating?: number | null;
  currentPointsPerHour?: number | null;
  baselinePointsPerHour?: number | null;
  currentLossPerPoint?: number | null;
  baselineLossPerPoint?: number | null;
  sourceFreshness: string | null;
  asOf: string;
}

export interface FatiguePerformanceAssessment {
  penalty: number;
  triggeredSignals: string[];
  dismissed: boolean;
}

export interface CertificateCandidateEvaluation {
  thresholdDefinitionId: string;
  targetCertificateCode: string;
  targetPoints: number;
  targetLabel: PersonalTargetLabel;
  currentLockedThresholdPoints: number | null;
  pointsRequired: number;
  expectedAdditionalCoinIn: number;
  expectedAdditionalTimeHours: number | null;
  probabilityOfSuccess: number;
  expectedAdditionalLoss: number;
  downsideLow: number;
  downsideHigh: number;
  incrementalCertificateValue: number;
  rawIncrementalExpectedValue: number;
  riskAdjustedIncrementalExpectedValue: number;
  incrementalRoi: number | null;
  probabilityOfExceedingRemainingBankroll: number | null;
  projectedEndOfCruisePoints: number;
  availableRiskBudget: number | null;
  profitProtectedRiskBudget: number | null;
  fatiguePerformancePenalty: number;
  lossModePenalty: number;
  confidence: ConfidenceBand;
  reachable: boolean;
  bankrollFeasible: boolean;
  timeFeasible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface RecommendationHistoricalEvidence {
  comparableCruiseOutcomeIds: string[];
  comparableSampleCount: number;
  thresholdAttemptCount: number;
  thresholdSuccessCount: number;
  redemptionSourceCount: number;
}

export interface CertificateRecommendationSnapshot {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  action: CertificateRecommendationAction;
  actionLabel: string;
  recommendedTargetPoints: number | null;
  recommendedTargetCertificateCode: string | null;
  currentLockedThresholdPoints: number | null;
  currentLockedCertificateCode: string | null;
  currentPoints: number;
  currentResult: number;
  expectedEndOfCruisePoints: number;
  probabilityOfSuccess: number | null;
  expectedAdditionalCoinIn: number;
  expectedAdditionalLoss: number;
  downsideRange: { low: number; high: number } | null;
  incrementalCertificateValue: number;
  rawIncrementalExpectedValue: number;
  riskAdjustedIncrementalExpectedValue: number;
  bankrollImpact: {
    remainingBankroll: number | null;
    availableRiskBudget: number | null;
    lockedProfitFloor: number | null;
    profitProtectedRiskBudget: number | null;
    probabilityOfExceedingRemainingBankroll: number | null;
  };
  confidence: ConfidenceBand;
  topReasons: string[];
  warnings: string[];
  assumptions: string[];
  historicalEvidence: RecommendationHistoricalEvidence;
  sourceFreshness: string | null;
  engineVersion: string;
  modelVersion: string;
  candidateEvaluations: CertificateCandidateEvaluation[];
  drillDown: {
    selectedCandidateId: string | null;
    fatiguePerformanceAssessment: FatiguePerformanceAssessment;
    lossModeActive: boolean;
    profitProtectedModeActive: boolean;
    safetyOverrides: string[];
  };
}

export interface BuildOptimalStoppingRecommendationInput {
  state: LiveOptimizationState;
  history: CanonicalCasinoHistorySnapshot;
  model: OptimizationModelSnapshot;
  thresholds: CertificateThresholdDefinition[];
  valueSnapshots: CertificateValueSnapshot[];
  dismissFatigueSignal?: boolean;
}

export interface LegacyCertificateChaseRecommendationShape {
  currentPoints: number;
  currentLevel: { code: string; pointsRequired: number } | null;
  nextLevel: { code: string; pointsRequired: number } | null;
  pointsNeeded: number;
  estimatedSlotCoinInNeeded: number;
  estimatedRoyalVpCoinInNeeded: number;
  valueUpgradeSummary: string;
  recommendation: 'stop' | 'light-chase' | 'worth-chasing' | 'do-not-chase' | 'unknown';
  reasons: string[];
  warnings: string[];
}
