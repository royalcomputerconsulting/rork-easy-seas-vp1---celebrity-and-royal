import type { SharedOwnershipFields } from '@/types/models';
import type { EvidenceDescriptor, EvidenceStatus, RecommendationConfidence } from '@/types/intelligence';

function statusFromRecord(record: SharedOwnershipFields): EvidenceStatus {
  if (record.sourceAuthority === 'provider' || record.sourceAuthority === 'public_document' || record.dataConfidence === 'verified') return 'verified';
  if (record.sourceAuthority === 'user_entered') return 'user_entered';
  if (record.sourceProvider || record.importStatus === 'assigned' || record.sourceAuthority === 'verified_local') return 'imported';
  if (record.sourceAuthority === 'derived' || record.sourceAuthority === 'enriched' || record.dataConfidence === 'enriched') return 'estimated';
  return 'missing';
}

export function buildRecordEvidence<T extends SharedOwnershipFields>(
  record: T,
  requiredFields: string[],
): { confidence: RecommendationConfidence; evidence: EvidenceDescriptor[]; missingData: string[] } {
  const baseStatus = statusFromRecord(record);
  const evidence = requiredFields.map((field): EvidenceDescriptor => {
    const value = (record as SharedOwnershipFields & Record<string, unknown>)[field];
    const missing = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    return {
      field,
      status: missing ? 'missing' : baseStatus,
      source: record.sourceProvider || record.sourceEndpoint,
      capturedAt: record.sourceRetrievedAt || record.sourceEvidence?.capturedAt,
      explanation: missing ? `${field} is missing.` : `${field} is ${baseStatus.replaceAll('_', ' ')}.`,
      couldChangeRecommendation: missing || baseStatus === 'estimated',
    };
  });
  const missingData = evidence.filter((item) => item.status === 'missing').map((item) => item.field);
  const confidence: RecommendationConfidence = missingData.length === 0
    ? baseStatus === 'verified' ? 'high' : baseStatus === 'estimated' ? 'low' : 'medium'
    : missingData.length <= 2 ? 'low' : 'insufficient';
  return { confidence, evidence, missingData };
}

export function evidenceStatusLabel(status: EvidenceStatus): string {
  return ({ verified: 'Verified', imported: 'Imported', user_entered: 'User Entered', estimated: 'Estimated', missing: 'Missing Data' })[status];
}
