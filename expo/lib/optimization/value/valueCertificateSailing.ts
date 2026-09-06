import type {
  CertificateValueComponentKind,
  CertificateSailingValueInput,
  ValuedCertificateSailing,
  ValueSourceEvidence,
} from './types';
import { roundMoney } from './statistics';

const ALL_COMPONENT_KINDS: CertificateValueComponentKind[] = [
  'cruise-fare',
  'covered-taxes-fees',
  'freeplay',
  'obc',
  'internet',
  'drinks',
  'dining',
  'spa',
  'suite-upgrade',
  'itinerary',
  'other',
];

function confidenceScore(value: ValueSourceEvidence['confidence']): number {
  if (value === 'high') return 1;
  if (value === 'medium') return 0.7;
  if (value === 'low') return 0.4;
  return 0;
}

function resolveConfidence(input: CertificateSailingValueInput, evidence: ValueSourceEvidence[]): ValuedCertificateSailing['confidence'] {
  if (input.sourceConfidence) return input.sourceConfidence;
  if (evidence.length === 0) return 'missing';
  const average = evidence.reduce((sum, item) => sum + confidenceScore(item.confidence), 0) / evidence.length;
  if (average >= 0.85) return 'high';
  if (average >= 0.6) return 'medium';
  return 'low';
}

export function valueCertificateSailing(input: CertificateSailingValueInput): ValuedCertificateSailing {
  const componentTotals = Object.fromEntries(ALL_COMPONENT_KINDS.map(kind => [kind, 0])) as Record<CertificateValueComponentKind, number>;
  const includedComponentIds: string[] = [];
  const suppressedDuplicateComponentIds: string[] = [];
  const warnings: string[] = [];
  const sourceEvidence: ValueSourceEvidence[] = [];
  const seenNonStackableBenefitKeys = new Set<string>();
  let userPaidCost = Math.max(0, Number(input.mandatoryUserPaidCost ?? 0) || 0);

  for (const component of input.components) {
    if (component.amount === null || !Number.isFinite(component.amount)) {
      warnings.push(`Component ${component.id} is missing a verified amount.`);
      continue;
    }
    const amount = Math.max(0, Number(component.amount));
    const dedupeKey = `${component.kind}:${component.benefitKey ?? component.id}`;
    if (component.stackable !== true && seenNonStackableBenefitKeys.has(dedupeKey)) {
      suppressedDuplicateComponentIds.push(component.id);
      warnings.push(`Duplicate non-stackable ${component.kind} component ${component.id} was suppressed.`);
      continue;
    }
    if (component.stackable !== true) seenNonStackableBenefitKeys.add(dedupeKey);
    componentTotals[component.kind] = roundMoney(componentTotals[component.kind] + amount);
    userPaidCost += Math.max(0, Number(component.userPaidCost ?? 0) || 0);
    includedComponentIds.push(component.id);
    sourceEvidence.push(...component.sourceEvidence);
  }

  if (!input.eligible) warnings.push('Sailing is not eligible for realized-value calculations.');
  if ((input.restrictions?.length ?? 0) > 0) warnings.push(...(input.restrictions ?? []).map(value => `Restriction: ${value}`));
  if (input.conflictsWithBookedCruise) warnings.push('Sailing conflicts with an existing booking.');
  if (componentTotals['cruise-fare'] <= 0) warnings.push('Cruise-fare replacement value is unavailable.');

  const grossReplacementValue = roundMoney(Object.values(componentTotals).reduce((sum, value) => sum + value, 0));
  const expectedUserPaidCost = roundMoney(userPaidCost);
  const netReplacementValue = roundMoney(Math.max(0, grossReplacementValue - expectedUserPaidCost));

  return {
    id: input.id,
    thresholdDefinitionId: input.thresholdDefinitionId,
    certificateCode: input.certificateCode,
    shipName: input.shipName,
    sailDate: input.sailDate,
    nights: input.nights ?? null,
    cabinCategory: input.cabinCategory ?? null,
    guestOccupancy: input.guestOccupancy ?? null,
    itinerary: input.itinerary ?? null,
    departurePort: input.departurePort ?? null,
    eligible: input.eligible,
    grossReplacementValue,
    expectedUserPaidCost,
    netReplacementValue,
    componentTotals,
    includedComponentIds,
    suppressedDuplicateComponentIds,
    sourceEvidence,
    confidence: resolveConfidence(input, sourceEvidence),
    warnings: [...new Set(warnings)],
  };
}
