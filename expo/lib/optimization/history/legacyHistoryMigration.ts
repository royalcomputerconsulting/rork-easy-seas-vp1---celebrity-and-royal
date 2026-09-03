import type {
  CasinoCruiseRecordLike,
  LegacyCasinoHistoryMigrationDraft,
} from './types';
import { stableFingerprint } from './normalization';

export function createLegacyCasinoHistoryMigrationDraft(input: {
  ownerProfileId: string;
  records: CasinoCruiseRecordLike[];
  createdAt: string;
}): LegacyCasinoHistoryMigrationDraft {
  return {
    id: `legacy-casino-migration:${stableFingerprint([input.ownerProfileId, input.createdAt, input.records.length])}`,
    ownerProfileId: input.ownerProfileId,
    createdAt: input.createdAt,
    candidates: input.records.map(record => ({
      id: `legacy-casino-candidate:${stableFingerprint([input.ownerProfileId, record.id, record.shipName, record.sailDate])}`,
      ownerProfileId: input.ownerProfileId,
      sourceLabel: 'migrated_legacy_known_fact',
      record: {
        ...record,
        ownerProfileId: input.ownerProfileId,
      },
      accepted: false,
      reviewedAt: null,
      reviewerId: null,
      warnings: ['Legacy personal fact requires explicit user review before optimizer ingestion.'],
    })),
    status: 'review-required',
  };
}

export function reviewLegacyCasinoHistoryMigration(input: {
  draft: LegacyCasinoHistoryMigrationDraft;
  acceptedCandidateIds: string[];
  rejectedCandidateIds?: string[];
  reviewerId: string;
  reviewedAt: string;
}): LegacyCasinoHistoryMigrationDraft {
  const accepted = new Set(input.acceptedCandidateIds);
  const rejected = new Set(input.rejectedCandidateIds ?? []);
  const candidates = input.draft.candidates.map(candidate => {
    if (!accepted.has(candidate.id) && !rejected.has(candidate.id)) return candidate;
    return {
      ...candidate,
      accepted: accepted.has(candidate.id),
      reviewedAt: input.reviewedAt,
      reviewerId: input.reviewerId,
      warnings: accepted.has(candidate.id) ? [] : ['User rejected this legacy fact for optimizer ingestion.'],
    };
  });
  const acceptedCount = candidates.filter(candidate => candidate.accepted).length;
  const reviewedCount = candidates.filter(candidate => candidate.reviewedAt !== null).length;
  const status = reviewedCount === 0
    ? 'review-required'
    : acceptedCount === 0 && reviewedCount === candidates.length
      ? 'rejected'
      : acceptedCount === candidates.length
        ? 'accepted'
        : 'partially-accepted';
  return { ...input.draft, candidates, status };
}

export function getAcceptedLegacyCasinoHistoryRecords(
  draft: LegacyCasinoHistoryMigrationDraft,
): CasinoCruiseRecordLike[] {
  return draft.candidates
    .filter(candidate => candidate.accepted && candidate.reviewedAt && candidate.reviewerId)
    .map(candidate => ({
      ...candidate.record,
      migrationSource: candidate.sourceLabel,
      migrationReviewedAt: candidate.reviewedAt,
      migrationReviewerId: candidate.reviewerId,
    }));
}
