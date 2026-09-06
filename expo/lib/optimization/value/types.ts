import type {
  ConfidenceBand,
  DataAuthority,
  OptimizationCasinoProgram,
} from '../history/types';

export type CertificateFamily = 'A' | 'C' | 'B' | 'D' | 'VIP' | 'AVIP' | 'CVIP' | 'SPECIAL' | 'UNKNOWN';

export type CertificateValueComponentKind =
  | 'cruise-fare'
  | 'covered-taxes-fees'
  | 'freeplay'
  | 'obc'
  | 'internet'
  | 'drinks'
  | 'dining'
  | 'spa'
  | 'suite-upgrade'
  | 'itinerary'
  | 'other';

export interface ValueSourceEvidence {
  source: string;
  authority: DataAuthority;
  confidence: ConfidenceBand;
  documentId?: string;
  versionId?: string;
  pageNumber?: number;
  capturedAt?: string;
  notes?: string[];
}

export interface CertificateThresholdDefinition {
  id: string;
  ownerProfileId: string | null;
  program: OptimizationCasinoProgram;
  family: CertificateFamily;
  certificateCode: string;
  levelCode: string | null;
  thresholdPoints: number;
  effectiveStart: string;
  effectiveEnd: string | null;
  minimumNights: number | null;
  maximumNights: number | null;
  replacesLowerCertificate: boolean | null;
  sourceEvidence: ValueSourceEvidence[];
  isFallback: boolean;
  version: string;
  warnings: string[];
}

export interface CertificateValueComponentInput {
  id: string;
  kind: CertificateValueComponentKind;
  amount: number | null;
  benefitKey?: string;
  stackable?: boolean;
  userPaidCost?: number | null;
  sourceEvidence: ValueSourceEvidence[];
  notes?: string[];
}

export interface CertificateSailingValueInput {
  id: string;
  thresholdDefinitionId: string;
  certificateCode: string;
  documentId?: string;
  versionId?: string;
  pageNumber?: number;
  shipName: string;
  sailDate: string;
  returnDate?: string | null;
  nights?: number | null;
  cabinCategory?: string | null;
  guestOccupancy?: string | null;
  itinerary?: string | null;
  departurePort?: string | null;
  eligible: boolean;
  components: CertificateValueComponentInput[];
  mandatoryUserPaidCost?: number | null;
  restrictions?: string[];
  conflictsWithBookedCruise?: boolean;
  sourceConfidence?: ConfidenceBand;
}

export interface ValuedCertificateSailing {
  id: string;
  thresholdDefinitionId: string;
  certificateCode: string;
  shipName: string;
  sailDate: string;
  nights: number | null;
  cabinCategory: string | null;
  guestOccupancy: string | null;
  itinerary: string | null;
  departurePort: string | null;
  eligible: boolean;
  grossReplacementValue: number;
  expectedUserPaidCost: number;
  netReplacementValue: number;
  componentTotals: Record<CertificateValueComponentKind, number>;
  includedComponentIds: string[];
  suppressedDuplicateComponentIds: string[];
  sourceEvidence: ValueSourceEvidence[];
  confidence: ConfidenceBand;
  warnings: string[];
}

export interface CertificateRedemptionHistory {
  thresholdDefinitionId?: string;
  family?: CertificateFamily;
  thresholdPoints?: number;
  earnedCount: number;
  redeemedCount: number;
  tradedCount?: number;
  expiredCount?: number;
  unusedCount?: number;
  bookedCount?: number;
}

export interface PersonalRedeemabilityInput {
  ownerProfileId: string;
  threshold: CertificateThresholdDefinition;
  history?: CertificateRedemptionHistory[];
  eligibleSailings: ValuedCertificateSailing[];
  manualUseWeight?: number | null;
  hasFutureBookingConflict?: boolean;
  daysUntilExpiration?: number | null;
  severeRestrictionCount?: number;
  alternativeTradeInValue?: number | null;
}

export interface PersonalRedeemabilityResult {
  probability: number;
  rawHistoricalRate: number | null;
  smoothedHistoricalRate: number;
  manualUseWeight: number | null;
  conflictPenalty: number;
  expirationPenalty: number;
  restrictionPenalty: number;
  availabilityFactor: number;
  alternativeTradeInValue: number;
  confidence: ConfidenceBand;
  evidenceCount: number;
  warnings: string[];
}

export interface CertificateValueDistribution {
  low: number;
  median: number;
  mean: number;
  high: number;
  bestRealistic: number;
  maximumRaw: number;
  sampleCount: number;
}

export interface CertificateValueSnapshot {
  id: string;
  ownerProfileId: string;
  thresholdDefinitionId: string;
  certificateCode: string;
  family: CertificateFamily;
  thresholdPoints: number;
  effectiveStart: string;
  effectiveEnd: string | null;
  generatedAt: string;
  grossReplacementValue: CertificateValueDistribution;
  netReplacementValue: CertificateValueDistribution;
  redemptionProbability: number;
  expectedRealizedValue: number;
  expectedAlternativeValue: number;
  expectedUserPaidCost: number;
  tradeInAlternativeValue: number;
  eligibleSailingCount: number;
  sourceCount: number;
  completeness: number;
  confidence: ConfidenceBand;
  assumptions: string[];
  warnings: string[];
  valuedSailings: ValuedCertificateSailing[];
  version: string;
}

export interface HistoricalCertificateValueRecord {
  id: string;
  cruiseOutcomeId: string;
  certificateCode: string;
  thresholdPoints: number | null;
  earnedAt: string;
  redeemed: boolean | null;
  actualRealizedValue?: number | null;
  actualUserPaidCost?: number | null;
  sourceDefinitionId?: string | null;
  sourceVersionId?: string | null;
}

export interface HistoricalCertificateValueBackfill {
  id: string;
  historicalRecordId: string;
  cruiseOutcomeId: string;
  certificateCode: string;
  thresholdPoints: number | null;
  earnedAt: string;
  actualRealizedValue: number | null;
  estimatedRealizedValue: number | null;
  actualUserPaidCost: number | null;
  estimatedUserPaidCost: number | null;
  sourceSnapshotId: string | null;
  sourceDefinitionId: string | null;
  sourceVersionId: string | null;
  usedLaterPeriodEvidence: boolean;
  confidence: ConfidenceBand;
  warnings: string[];
}

export interface BuildCertificateValueSnapshotInput {
  ownerProfileId: string;
  threshold: CertificateThresholdDefinition;
  sailings: CertificateSailingValueInput[];
  redemption: Omit<PersonalRedeemabilityInput, 'ownerProfileId' | 'threshold' | 'eligibleSailings'>;
  generatedAt?: string;
}
