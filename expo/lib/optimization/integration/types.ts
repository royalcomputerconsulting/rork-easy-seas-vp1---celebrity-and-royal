import type { CertificateRecommendationSnapshot } from '../engine/types';
import type { LiveCasinoAdvisorSnapshot, LiveCasinoStateRecord } from '../live/types';
import type { PersonalGamblingDashboardSnapshot } from '../dashboard/types';
import type { ValueSourceEvidence } from '../value/types';

export interface OptimizationSnapshotBundle {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  liveState: LiveCasinoStateRecord | null;
  liveAdvisor: LiveCasinoAdvisorSnapshot | null;
  dashboard: PersonalGamblingDashboardSnapshot | null;
  currentRecommendation: CertificateRecommendationSnapshot | null;
  sourceFreshness: string | null;
  brand: string | null;
  program: string | null;
  warnings: string[];
}

export interface OptimizationContextItem {
  label: string;
  value: string;
  source: string;
  confidence: 'high' | 'medium' | 'low' | 'missing';
}

export interface StructuredOptimizationContext {
  ownerProfileId: string;
  generatedAt: string;
  recommendationId: string | null;
  facts: OptimizationContextItem[];
  estimates: OptimizationContextItem[];
  assumptions: string[];
  missingData: string[];
  warnings: string[];
  sourceFreshness: string | null;
}

export type OptimizationQuestionIntent = 'current-target' | 'expected-cost' | 'success-probability' | 'why' | 'history' | 'profile' | 'safety-override' | 'general';

export interface OptimizationQuestionAnswer {
  intent: OptimizationQuestionIntent;
  headline: string;
  answer: string;
  facts: OptimizationContextItem[];
  estimates: OptimizationContextItem[];
  assumptions: string[];
  missingData: string[];
  warnings: string[];
  safetyGateOverrideDenied: boolean;
  recommendationId: string | null;
}

export interface OptimizableOfferInput {
  id: string;
  offerCode: string;
  certificateCode?: string | null;
  thresholdPoints?: number | null;
  expectedRetailValue?: number | null;
  tradeInValue?: number | null;
  userPaidCost?: number | null;
  expiresAt?: string | null;
  conflictsWithBookedCruise?: boolean;
  matchesFutureCruisePlan?: boolean;
  sourceEvidence?: ValueSourceEvidence[];
}

export interface OptimizedOfferEvaluation {
  offerId: string;
  offerCode: string;
  matchedThresholdPoints: number | null;
  expectedRealizedCertificateValue: number;
  futureBookingFit: number;
  conflictPenalty: number;
  expirationPenalty: number;
  netExpectedVacationValue: number;
  score: number;
  reasons: string[];
  warnings: string[];
  sourceEvidence: ValueSourceEvidence[];
}
