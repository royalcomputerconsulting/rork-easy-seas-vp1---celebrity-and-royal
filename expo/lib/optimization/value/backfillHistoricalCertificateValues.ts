import type {
  CertificateThresholdDefinition,
  CertificateValueSnapshot,
  HistoricalCertificateValueBackfill,
  HistoricalCertificateValueRecord,
} from './types';
import { roundMoney, stableValueId } from './statistics';

function dateInRange(date: string, definition: CertificateThresholdDefinition): boolean {
  return date >= definition.effectiveStart && (!definition.effectiveEnd || date <= definition.effectiveEnd);
}

export function backfillHistoricalCertificateValues(input: {
  records: HistoricalCertificateValueRecord[];
  definitions: CertificateThresholdDefinition[];
  snapshots: CertificateValueSnapshot[];
}): HistoricalCertificateValueBackfill[] {
  return input.records.map(record => {
    const exactDefinition = input.definitions.find(definition => (
      definition.certificateCode === record.certificateCode && dateInRange(record.earnedAt, definition)
    ));
    const fallbackDefinition = exactDefinition ?? input.definitions
      .filter(definition => definition.certificateCode === record.certificateCode)
      .sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart))[0] ?? null;
    const matchingSnapshot = fallbackDefinition
      ? input.snapshots.find(snapshot => snapshot.thresholdDefinitionId === fallbackDefinition.id) ?? null
      : null;
    const usedLaterPeriodEvidence = Boolean(
      fallbackDefinition && !exactDefinition && fallbackDefinition.effectiveStart > record.earnedAt,
    );
    const warnings: string[] = [];
    if (!fallbackDefinition) warnings.push('No certificate definition could be linked to this historical record.');
    if (usedLaterPeriodEvidence) warnings.push('Historical estimate uses a later certificate period because same-period evidence is unavailable.');
    if (record.actualRealizedValue !== null && record.actualRealizedValue !== undefined) {
      warnings.push('Actual realized value is preserved separately and is not overwritten by the estimate.');
    }
    const actualRealizedValue = record.actualRealizedValue === null || record.actualRealizedValue === undefined
      ? null
      : roundMoney(record.actualRealizedValue);
    const estimatedRealizedValue = matchingSnapshot ? matchingSnapshot.expectedRealizedValue : null;
    const actualUserPaidCost = record.actualUserPaidCost === null || record.actualUserPaidCost === undefined
      ? null
      : roundMoney(record.actualUserPaidCost);
    const estimatedUserPaidCost = matchingSnapshot ? matchingSnapshot.expectedUserPaidCost : null;
    const confidence: HistoricalCertificateValueBackfill['confidence'] = actualRealizedValue !== null
      ? 'high'
      : matchingSnapshot?.confidence ?? 'missing';
    return {
      id: `historical-certificate-value:${stableValueId([record.id, fallbackDefinition?.id, matchingSnapshot?.id])}`,
      historicalRecordId: record.id,
      cruiseOutcomeId: record.cruiseOutcomeId,
      certificateCode: record.certificateCode,
      thresholdPoints: record.thresholdPoints,
      earnedAt: record.earnedAt,
      actualRealizedValue,
      estimatedRealizedValue,
      actualUserPaidCost,
      estimatedUserPaidCost,
      sourceSnapshotId: matchingSnapshot?.id ?? null,
      sourceDefinitionId: fallbackDefinition?.id ?? null,
      sourceVersionId: record.sourceVersionId ?? null,
      usedLaterPeriodEvidence,
      confidence,
      warnings,
    };
  });
}
