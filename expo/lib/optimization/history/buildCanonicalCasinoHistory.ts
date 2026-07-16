import type {
  CanonicalCasinoHistorySnapshot,
  CanonicalHistoryBuildInput,
  CasinoCruiseRecordLike,
} from './types';
import { canonicalizeCasinoCruiseOutcome } from './canonicalizeCasinoCruiseOutcome';
import { scoreOverallCasinoHistory } from './dataHealth';
import { cruiseStrongKey, normalizeDate, stableFingerprint } from './normalization';
import { reconcileCasinoSessions } from './reconcileCasinoSessions';

export const CANONICAL_CASINO_HISTORY_VERSION = 'opt1.0.0';

function resolveAsOf(value?: string): string {
  const normalized = normalizeDate(value);
  return normalized ?? new Date().toISOString().slice(0, 10);
}

function findDuplicateCruiseIds(cruises: CasinoCruiseRecordLike[]): string[] {
  const ownerByKey = new Map<string, string>();
  const duplicateIds: string[] = [];
  for (const cruise of cruises) {
    const key = cruiseStrongKey(cruise);
    const owner = ownerByKey.get(key);
    if (owner) duplicateIds.push(cruise.id);
    else ownerByKey.set(key, cruise.id);
  }
  return duplicateIds;
}

export function buildCanonicalCasinoHistory(
  input: CanonicalHistoryBuildInput,
): CanonicalCasinoHistorySnapshot {
  if (!input.ownerProfileId.trim()) throw new Error('ownerProfileId is required.');
  const asOf = resolveAsOf(input.asOf);
  const duplicateCruiseIds = findDuplicateCruiseIds(input.cruises);
  const sessionReconciliation = reconcileCasinoSessions(input.cruises, input.sessions, {
    ownerProfileId: input.ownerProfileId,
  });
  const context = {
    ownerProfileId: input.ownerProfileId,
    asOf,
    pointEarningRates: input.pointEarningRates ?? [],
    certificateEvidence: input.certificateEvidence ?? [],
    certificateThresholds: input.certificateThresholds,
    tombstonedCruiseIds: new Set(input.tombstonedCruiseIds ?? []),
    tombstonedCruiseKeys: new Set(input.tombstonedCruiseKeys ?? []),
    duplicateCruiseIds: new Set(duplicateCruiseIds),
  };

  const allOutcomes = input.cruises.map(cruise => canonicalizeCasinoCruiseOutcome(
    cruise,
    sessionReconciliation.matchedByCruiseId[cruise.id] ?? [],
    context,
  ));
  const descriptiveOutcomes = allOutcomes.filter(outcome => outcome.exclusionReasons.length === 0);
  const outcomes = descriptiveOutcomes.filter(outcome => outcome.eligibleForModeling);
  const excludedOutcomes = allOutcomes.filter(outcome => outcome.exclusionReasons.length > 0);
  const overallDataHealth = scoreOverallCasinoHistory(descriptiveOutcomes);
  const warnings = [
    ...sessionReconciliation.warnings,
    ...overallDataHealth.warnings,
  ];
  if (duplicateCruiseIds.length > 0) warnings.push(`${duplicateCruiseIds.length} duplicate cruise records were excluded.`);
  if (excludedOutcomes.length > 0) warnings.push(`${excludedOutcomes.length} cruise records were excluded from canonical history.`);
  if (!overallDataHealth.eligibleForHighConfidenceModel) warnings.push('Canonical history is not yet sufficient for high-confidence personalized recommendations.');

  return {
    id: `canonical-casino-history:${stableFingerprint([input.ownerProfileId, asOf, CANONICAL_CASINO_HISTORY_VERSION, allOutcomes.length])}`,
    ownerProfileId: input.ownerProfileId,
    generatedAt: asOf,
    outcomes,
    descriptiveOutcomes,
    excludedOutcomes,
    sessionReconciliation,
    duplicateCruiseIds,
    overallDataHealth,
    warnings: [...new Set(warnings)],
    version: CANONICAL_CASINO_HISTORY_VERSION,
  };
}
