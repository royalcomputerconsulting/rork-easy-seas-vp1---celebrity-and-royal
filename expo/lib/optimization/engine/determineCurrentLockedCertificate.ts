import type { CertificateThresholdDefinition, CertificateValueSnapshot } from '../value/types';

export interface LockedCertificateResult {
  definition: CertificateThresholdDefinition | null;
  valueSnapshot: CertificateValueSnapshot | null;
  warnings: string[];
}

function effectiveOn(definition: CertificateThresholdDefinition, asOf: string): boolean {
  const date = asOf.slice(0, 10);
  return definition.effectiveStart <= date && (!definition.effectiveEnd || definition.effectiveEnd >= date);
}

export function selectApplicableThresholds(input: {
  thresholds: CertificateThresholdDefinition[];
  program: CertificateThresholdDefinition['program'];
  family: CertificateThresholdDefinition['family'];
  cruiseNights?: number | null;
  asOf: string;
}): CertificateThresholdDefinition[] {
  return input.thresholds.filter(definition => {
    if (definition.program !== input.program || definition.family !== input.family) return false;
    if (!effectiveOn(definition, input.asOf)) return false;
    if (input.cruiseNights !== null && input.cruiseNights !== undefined) {
      if (definition.minimumNights !== null && input.cruiseNights < definition.minimumNights) return false;
      if (definition.maximumNights !== null && input.cruiseNights > definition.maximumNights) return false;
    }
    return true;
  }).sort((a, b) => a.thresholdPoints - b.thresholdPoints);
}

export function determineCurrentLockedCertificate(input: {
  currentPoints: number;
  applicableThresholds: CertificateThresholdDefinition[];
  valueSnapshots: CertificateValueSnapshot[];
}): LockedCertificateResult {
  const definition = [...input.applicableThresholds].reverse().find(item => input.currentPoints >= item.thresholdPoints) ?? null;
  const valueSnapshot = definition
    ? input.valueSnapshots.find(snapshot => snapshot.thresholdDefinitionId === definition.id) ?? null
    : null;
  const warnings: string[] = [];
  if (!definition) warnings.push('No certificate threshold has been locked at the current point total.');
  if (definition && !valueSnapshot) warnings.push('The locked certificate is missing a personal value snapshot.');
  if (definition?.replacesLowerCertificate === null) warnings.push('Certificate replacement/stacking behavior is incomplete; marginal value uses the conservative replacement assumption.');
  return { definition, valueSnapshot, warnings };
}
