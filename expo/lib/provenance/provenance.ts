import type { DataProvenance, ProvenanceCitation, ProvenanceConfidence, ProvenanceLink, ProvenanceSourceType, ProvenancedValue } from '@/types/provenance';

const SOURCE_PRECEDENCE: Record<ProvenanceSourceType, number> = {
  provider_sync: 100, manual_entry: 90, receipt: 85, parsed_certificate: 80, official_weather: 80,
  imported_csv: 70, backup_restore: 65, local_database: 60, derived_calculation: 45, estimate: 20,
};
const CONFIDENCE_PRECEDENCE: Record<ProvenanceConfidence, number> = { exact: 6, high: 5, medium: 4, low: 3, estimated: 2, missing: 0 };

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createProvenance(input: Omit<DataProvenance, 'id' | 'isDerived'> & { id?: string; isDerived?: boolean }): DataProvenance {
  const isDerived = input.isDerived ?? (input.sourceType === 'derived_calculation' || input.sourceType === 'estimate');
  const fingerprint = [input.sourceType, input.ownerId ?? 'shared', input.sourceRecord, input.observedAt, input.formula ?? ''].join('|');
  return { ...input, id: input.id ?? `prov-${stableHash(fingerprint)}`, isDerived };
}

export function createProvenanceLink(input: Omit<ProvenanceLink, 'id' | 'isDerived'> & { id?: string; isDerived?: boolean }): ProvenanceLink {
  return { ...createProvenance(input), entityType: input.entityType, entityId: input.entityId, field: input.field };
}

export function withProvenance<T>(value: T, provenance: DataProvenance): ProvenancedValue<T> { return { value, provenance }; }

export function selectAuthoritativeValue<T>(values: ProvenancedValue<T>[]): ProvenancedValue<T> | null {
  return [...values].sort((left, right) => {
    const source = SOURCE_PRECEDENCE[right.provenance.sourceType] - SOURCE_PRECEDENCE[left.provenance.sourceType];
    if (source) return source;
    const confidence = CONFIDENCE_PRECEDENCE[right.provenance.confidence] - CONFIDENCE_PRECEDENCE[left.provenance.confidence];
    if (confidence) return confidence;
    return Date.parse(right.provenance.observedAt) - Date.parse(left.provenance.observedAt);
  })[0] ?? null;
}

export function provenanceCitation(provenance: DataProvenance, label = 'Source'): ProvenanceCitation {
  return { label, source: provenance.sourceRecord, timestamp: provenance.observedAt, confidence: provenance.confidence, formula: provenance.formula };
}

export function formatProvenanceCitation(citation: ProvenanceCitation): string {
  const formula = citation.formula ? ` Formula: ${citation.formula}.` : '';
  return `${citation.label}: ${citation.source} · ${citation.confidence} confidence · ${citation.timestamp}.${formula}`;
}

export function derivedValueCannotMasquerade(provenance: DataProvenance): boolean {
  if (!provenance.isDerived) return true;
  return provenance.sourceType === 'derived_calculation' || provenance.sourceType === 'estimate';
}

export function normalizeLegacyProvenance(record: Record<string, unknown>, ownerId: string | null, sourceRecord: string): DataProvenance {
  const source = String(record.source ?? record.parserSource ?? record.provider ?? '').toLowerCase();
  const sourceType: ProvenanceSourceType = source.includes('manual') ? 'manual_entry' : source.includes('csv') ? 'imported_csv' : source.includes('certificate') || source.includes('pdf') ? 'parsed_certificate' : source.includes('weather') || source.includes('noaa') ? 'official_weather' : 'provider_sync';
  const observedAt = String(record.updatedAt ?? record.syncedAt ?? record.parsedAt ?? record.createdAt ?? new Date(0).toISOString());
  return createProvenance({ sourceType, observedAt, ownerId, confidence: sourceType === 'provider_sync' ? 'high' : 'medium', sourceRecord, provider: String(record.provider ?? '') || null, sourceHash: null, formula: null, notes: 'Normalized from a pre-provenance record.' });
}
