import type { CanonicalCasinoHistorySnapshot } from '../history/types';
import type { OptimizationModelSnapshot } from '../models/types';
import type { CertificateThresholdDefinition, CertificateValueSnapshot } from '../value/types';
import { buildOptimalStoppingRecommendation } from '../engine/buildOptimalStoppingRecommendation';
import { stableModelFingerprint } from '../models/statistics';
import { evaluateOneMoreSession } from './evaluateOneMoreSession';
import { isLiveCasinoStateStale } from './normalizeLiveCasinoState';
import { projectEndOfCruisePoints } from './projectEndOfCruisePoints';
import type { LiveCasinoAdvisorJournalEntry, LiveCasinoAdvisorSnapshot, LiveCasinoStateRecord } from './types';

export interface BuildLiveCasinoAdvisorInput {
  state: LiveCasinoStateRecord;
  history: CanonicalCasinoHistorySnapshot;
  model: OptimizationModelSnapshot;
  thresholds: CertificateThresholdDefinition[];
  valueSnapshots: CertificateValueSnapshot[];
  now?: string;
  offline?: boolean;
}

export const LIVE_CASINO_ADVISOR_VERSION = 'opt5.0.0';

export function buildLiveCasinoAdvisorSnapshot(input: BuildLiveCasinoAdvisorInput): LiveCasinoAdvisorSnapshot {
  if (input.state.ownerProfileId !== input.history.ownerProfileId || input.state.ownerProfileId !== input.model.ownerProfileId) {
    throw new Error('Profile mismatch across live advisor inputs.');
  }
  const now = new Date(input.now ?? input.state.asOf).toISOString();
  const stale = isLiveCasinoStateStale(input.state, now);
  const recommendation = buildOptimalStoppingRecommendation({
    state: input.state,
    history: input.history,
    model: input.model,
    thresholds: input.thresholds,
    valueSnapshots: input.valueSnapshots,
    dismissFatigueSignal: input.state.fatigueSignalDismissed,
  });
  const projection = projectEndOfCruisePoints(input.state, input.model);
  const oneMoreSessionScenario = evaluateOneMoreSession(input.state, input.model);
  const refreshReasons: string[] = [];
  if (stale) refreshReasons.push('Live casino state is stale and should be refreshed before relying on this recommendation.');
  if (input.offline) refreshReasons.push('Device is offline; recommendation uses the last saved model and certificate values.');
  if (input.state.sourceFreshness === null) refreshReasons.push('Source freshness is unknown.');
  const stateFingerprint = stableModelFingerprint([
    input.state.ownerProfileId, input.state.cruiseId, input.state.updatedAt, input.state.currentPoints,
    input.state.currentResult, input.state.currentCoinIn, input.state.currentCoinOut,
    input.state.remainingCasinoHours, input.state.remainingBankroll, input.state.fatigueRating,
  ]);
  const id = `live-advisor:${stableModelFingerprint([stateFingerprint, recommendation.id, LIVE_CASINO_ADVISOR_VERSION])}`;
  return {
    id,
    ownerProfileId: input.state.ownerProfileId,
    cruiseId: input.state.cruiseId,
    generatedAt: now,
    liveStateId: input.state.id,
    liveStateUpdatedAt: input.state.updatedAt,
    stateFingerprint,
    recommendation,
    endOfCruiseProjection: projection,
    oneMoreSessionScenario,
    stale,
    offline: Boolean(input.offline),
    refreshReasons,
    modelVersion: input.model.modelVersion,
    engineVersion: recommendation.engineVersion,
    warnings: [...new Set([...input.state.warnings, ...recommendation.warnings, ...projection.warnings, ...refreshReasons])],
  };
}

export function buildLiveCasinoAdvisorJournalEntry(
  snapshot: LiveCasinoAdvisorSnapshot,
  state: LiveCasinoStateRecord,
): LiveCasinoAdvisorJournalEntry {
  return {
    id: `live-advisor-journal:${snapshot.id}`,
    ownerProfileId: snapshot.ownerProfileId,
    cruiseId: snapshot.cruiseId,
    generatedAt: snapshot.generatedAt,
    stateFingerprint: snapshot.stateFingerprint,
    recommendationId: snapshot.recommendation.id,
    action: snapshot.recommendation.action,
    recommendedTargetPoints: snapshot.recommendation.recommendedTargetPoints,
    exactInputs: JSON.parse(JSON.stringify(state)) as LiveCasinoStateRecord,
    formulas: [
      'incremental EV = probability of success × incremental certificate value − expected additional loss',
      'risk-adjusted EV = incremental EV − bankroll, fatigue, loss-mode, uncertainty, and time penalties',
      'projected points = current points + personal points-per-hour × remaining casino hours',
    ],
    modelVersion: snapshot.modelVersion,
    engineVersion: snapshot.engineVersion,
    assumptions: [...snapshot.recommendation.assumptions],
    warnings: [...snapshot.warnings],
  };
}
