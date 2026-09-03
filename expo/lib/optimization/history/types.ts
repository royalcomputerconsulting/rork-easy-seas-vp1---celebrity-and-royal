export type OptimizationCasinoBrand = 'royal' | 'celebrity' | 'carnival' | 'silversea' | 'unknown';

export type OptimizationCasinoProgram =
  | 'club-royale'
  | 'blue-chip'
  | 'players-club'
  | 'venetian-society'
  | 'unknown';

export type DataAuthority =
  | 'closeout-verified'
  | 'closeout-user-entered'
  | 'imported'
  | 'session-rollup'
  | 'calculated'
  | 'estimated'
  | 'generated'
  | 'missing';

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'missing';

export interface FieldAuthority<T> {
  value: T | null;
  source: string;
  authority: DataAuthority;
  confidence: ConfidenceBand;
  confidenceScore: number;
  freshness: string | null;
  warnings: string[];
}

export interface CasinoCruiseRecordLike {
  id: string;
  ownerProfileId?: string;
  sourceEmail?: string;
  reservationNumber?: string;
  bookingId?: string;
  bwoNumber?: string;
  shipName?: string;
  sailDate?: string;
  returnDate?: string;
  nights?: number;
  status?: string;
  completionState?: string;
  bookingStatus?: string;
  brand?: string;
  cruiseSource?: string;
  casinoProgram?: string;
  programCharter?: string;
  casinoOpenDays?: number;
  seaDays?: number;
  portDays?: number;
  pointsEarned?: number;
  earnedPoints?: number;
  casinoPoints?: number;
  coinIn?: number;
  netResult?: number;
  cashResult?: number;
  winningsBroughtHome?: number;
  winnings?: number;
  totalWinnings?: number;
  actualLoss?: number;
  theoreticalLoss?: number;
  buyIn?: number;
  cashOut?: number;
  freePlayUsed?: number;
  freePlay?: number;
  hoursPlayed?: number;
  sessionsPlayed?: number;
  instantCertificateWon?: boolean;
  instantCertificateOfferCode?: string;
  instantCertificateValue?: number;
  offerCode?: string;
  offerName?: string;
  updatedAt?: string;
  createdAt?: string;
  calculationConfidence?: string;
  sourcePayload?: unknown;
  [key: string]: unknown;
}

export interface CasinoSessionRecordLike {
  id: string;
  ownerProfileId?: string;
  sourceEmail?: string;
  date?: string;
  sessionDate?: string;
  sailingDate?: string;
  cruiseId?: string;
  brand?: string;
  program?: string;
  casinoProgram?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  machineId?: string;
  machineName?: string;
  machineType?: string;
  gameCategory?: string;
  pointsEarned?: number;
  pointsSource?: string;
  buyIn?: number;
  cashOut?: number;
  winLoss?: number;
  cashCoinIn?: number;
  freeplayCoinIn?: number;
  coinIn?: number;
  coinOut?: number;
  jackpots?: number;
  handPays?: number;
  taxesWithheld?: number;
  freePlayUsed?: number;
  freeplayIn?: number;
  rtp?: number;
  volatility?: string;
  estimatedTheo?: number;
  estimatedExpectedLoss?: number;
  casinoDay?: number;
  notes?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface PointEarningRateEvidence {
  program: OptimizationCasinoProgram;
  dollarsPerPoint: number;
  source: string;
  authority: Exclude<DataAuthority, 'missing'>;
  verifiedAt?: string;
}

export interface CertificateEvidenceLink {
  certificateCode: string;
  thresholdPoints: number | null;
  program: OptimizationCasinoProgram;
  ownerProfileId?: string;
  documentId?: string;
  versionId?: string;
  pageNumber?: number;
  effectiveStart?: string;
  effectiveEnd?: string;
  source: string;
  confidence: ConfidenceBand;
}

export interface CasinoSessionObservation {
  id: string;
  sourceSessionId: string;
  ownerProfileId: string;
  brand: OptimizationCasinoBrand;
  program: OptimizationCasinoProgram;
  cruiseId: string | null;
  reconciliationStatus: 'matched' | 'orphan' | 'ambiguous' | 'duplicate' | 'profile-mismatch';
  reconciliationWarnings: string[];
  sessionSequence: number | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  pointsEarned: number | null;
  pointsAtSessionStart: number | null;
  pointsAtSessionEnd: number | null;
  cumulativeCruisePointsAfterSession: number | null;
  winLoss: number | null;
  cumulativeTripResultAfterSession: number | null;
  buyIn: number | null;
  cashOut: number | null;
  coinIn: number | null;
  coinOut: number | null;
  freePlayUsed: number | null;
  estimatedTheo: number | null;
  estimatedExpectedLoss: number | null;
  casinoDay: number | null;
  dayType: 'sea' | 'port' | 'private-island' | 'embarkation' | 'debarkation' | 'unknown';
  machineId: string | null;
  machineName: string | null;
  machineFamily: string | null;
  rtp: number | null;
  rtpAuthority: DataAuthority;
  volatility: string | null;
  remainingDailyBankrollBefore: number | null;
  remainingDailyBankrollAfter: number | null;
  remainingCasinoHoursEstimate: number | null;
  fatigueRating: number | null;
  stopReason: string | null;
  recommendationId: string | null;
  source: string;
  authority: DataAuthority;
  confidence: ConfidenceBand;
  fingerprint: string;
}

export interface SessionReconciliationResult {
  observations: CasinoSessionObservation[];
  matchedByCruiseId: Record<string, CasinoSessionObservation[]>;
  duplicateSessionIds: string[];
  overlappingSessionIds: string[];
  orphanSessionIds: string[];
  ambiguousSessionIds: string[];
  profileMismatchSessionIds: string[];
  warnings: string[];
}

export interface CertificateThresholdAttempt {
  id: string;
  cruiseOutcomeId: string;
  thresholdPoints: number;
  pointsAtOpportunityStart: number | null;
  pointsRemainingAtStop: number;
  attempted: boolean | null;
  achieved: boolean;
  pointsAtStop: number;
  incrementalCoinIn: number | null;
  incrementalResult: number | null;
  sessionsUsed: number | null;
  timeUsedMinutes: number | null;
  bankrollConsumed: number | null;
  resultWhenAttemptBegan: number | null;
  remainingCruiseOpportunity: number | null;
  recommendationIdAtStart: string | null;
  stopReason: string | null;
  status: 'complete' | 'incomplete' | 'ambiguous';
  warnings: string[];
}

export interface CasinoDataHealthComponents {
  pointsCompleteness: number;
  coinInCompleteness: number;
  resultCompleteness: number;
  sessionCompleteness: number;
  certificateLinkageCompleteness: number;
  valueCompleteness: number;
  machineRtpCompleteness: number;
  timingCompleteness: number;
}

export interface CasinoDataHealthScore {
  score: number;
  grade: 'high' | 'medium' | 'low';
  eligibleForHighConfidenceModel: boolean;
  components: CasinoDataHealthComponents;
  criticalWarnings: string[];
  warnings: string[];
}

export interface CasinoCruiseOutcome {
  id: string;
  sourceCruiseId: string;
  ownerProfileId: string;
  brand: OptimizationCasinoBrand;
  program: OptimizationCasinoProgram;
  cruiseId: string;
  reservationId: string | null;
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number | null;
  casinoOpenDays: number | null;
  casinoOpenHours: number | null;
  seaDayCount: number | null;
  portDayCount: number | null;
  privateIslandDayCount: number | null;
  totalPoints: FieldAuthority<number>;
  totalCoinIn: FieldAuthority<number>;
  actualResult: FieldAuthority<number>;
  theoreticalLoss: FieldAuthority<number>;
  buyIn: FieldAuthority<number>;
  cashOut: FieldAuthority<number>;
  freePlayUsed: FieldAuthority<number>;
  timePlayedMinutes: FieldAuthority<number>;
  sessionCount: number;
  machineMix: Record<string, number>;
  averagePointsPerDay: number | null;
  averagePointsPerSession: number | null;
  averagePointsPerHour: number | null;
  certificateEarnedCode: string | null;
  thresholdReached: number | null;
  certificateEvidence: CertificateEvidenceLink | null;
  certificateValueSnapshotId: string | null;
  fieldAuthority: Record<string, FieldAuthority<unknown>>;
  dataHealth: CasinoDataHealthScore;
  thresholdAttempts: CertificateThresholdAttempt[];
  eligibleForModeling: boolean;
  exclusionReasons: string[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalCasinoHistorySnapshot {
  id: string;
  ownerProfileId: string;
  generatedAt: string;
  outcomes: CasinoCruiseOutcome[];
  descriptiveOutcomes: CasinoCruiseOutcome[];
  excludedOutcomes: CasinoCruiseOutcome[];
  sessionReconciliation: SessionReconciliationResult;
  duplicateCruiseIds: string[];
  overallDataHealth: CasinoDataHealthScore;
  warnings: string[];
  version: string;
}

export interface CanonicalHistoryBuildInput {
  ownerProfileId: string;
  cruises: CasinoCruiseRecordLike[];
  sessions: CasinoSessionRecordLike[];
  asOf?: string;
  pointEarningRates?: PointEarningRateEvidence[];
  certificateEvidence?: CertificateEvidenceLink[];
  certificateThresholds?: number[];
  tombstonedCruiseIds?: string[];
  tombstonedCruiseKeys?: string[];
}

export interface LegacyCasinoHistoryMigrationCandidate {
  id: string;
  ownerProfileId: string;
  sourceLabel: 'migrated_legacy_known_fact';
  record: CasinoCruiseRecordLike;
  accepted: boolean;
  reviewedAt: string | null;
  reviewerId: string | null;
  warnings: string[];
}

export interface LegacyCasinoHistoryMigrationDraft {
  id: string;
  ownerProfileId: string;
  createdAt: string;
  candidates: LegacyCasinoHistoryMigrationCandidate[];
  status: 'review-required' | 'partially-accepted' | 'accepted' | 'rejected';
}
