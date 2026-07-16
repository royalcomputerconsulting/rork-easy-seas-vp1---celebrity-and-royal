import type { CertificateRecommendationSnapshot, LiveOptimizationState } from '../engine/types';
import type { ConfidenceBand } from '../history/types';

export type LiveCasinoStateStatus = 'active' | 'paused' | 'closed' | 'stale';

export interface LiveCasinoSessionObservation {
  id: string;
  ownerProfileId: string;
  cruiseId: string;
  casinoDay: number;
  startedAt: string;
  endedAt: string | null;
  pointsStart: number;
  pointsEnd: number;
  coinIn: number | null;
  coinOut: number | null;
  actualResult: number | null;
  timePlayedMinutes: number | null;
  machineIds: string[];
  source: string;
  confidence: ConfidenceBand;
  warnings: string[];
}

export interface LiveCasinoStateRecord extends LiveOptimizationState {
  id: string;
  cruiseId: string;
  reservationId: string | null;
  casinoDay: number;
  currentCoinOut: number | null;
  currentSessionId: string | null;
  sessions: LiveCasinoSessionObservation[];
  fatigueSignalDismissed: boolean;
  status: LiveCasinoStateStatus;
  createdAt: string;
  updatedAt: string;
  staleAfterMinutes: number;
  warnings: string[];
}

export interface EndOfCruisePointProjection {
  generatedAt: string;
  currentPoints: number;
  conservativePoints: number;
  expectedPoints: number;
  optimisticPoints: number;
  expectedAdditionalPoints: number;
  remainingCasinoHours: number | null;
  pointsPerHourUsed: number | null;
  confidence: ConfidenceBand;
  assumptions: string[];
  warnings: string[];
}

export interface OneMoreSessionScenario {
  generatedAt: string;
  sessionMinutes: number;
  expectedAdditionalPoints: number;
  expectedAdditionalCoinIn: number;
  expectedAdditionalLoss: number;
  projectedPointsAfterSession: number;
  remainingBankrollAfterExpectedLoss: number | null;
  breachesDailyLimit: boolean;
  breachesTripLimit: boolean;
  breachesProfitFloor: boolean;
  permitted: boolean;
  reasons: string[];
  warnings: string[];
}

export interface LiveCasinoAdvisorSnapshot {
  id: string;
  ownerProfileId: string;
  cruiseId: string;
  generatedAt: string;
  liveStateId: string;
  liveStateUpdatedAt: string;
  stateFingerprint: string;
  recommendation: CertificateRecommendationSnapshot;
  endOfCruiseProjection: EndOfCruisePointProjection;
  oneMoreSessionScenario: OneMoreSessionScenario;
  stale: boolean;
  offline: boolean;
  refreshReasons: string[];
  modelVersion: string;
  engineVersion: string;
  warnings: string[];
}

export interface LiveCasinoAdvisorJournalEntry {
  id: string;
  ownerProfileId: string;
  cruiseId: string;
  generatedAt: string;
  stateFingerprint: string;
  recommendationId: string;
  action: CertificateRecommendationSnapshot['action'];
  recommendedTargetPoints: number | null;
  exactInputs: LiveCasinoStateRecord;
  formulas: string[];
  modelVersion: string;
  engineVersion: string;
  assumptions: string[];
  warnings: string[];
}
