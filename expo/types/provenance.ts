export type ProvenanceSourceType =
  | 'provider_sync' | 'imported_csv' | 'receipt' | 'parsed_certificate' | 'manual_entry'
  | 'derived_calculation' | 'estimate' | 'official_weather' | 'local_database' | 'backup_restore';

export type ProvenanceConfidence = 'exact' | 'high' | 'medium' | 'low' | 'estimated' | 'missing';

export interface DataProvenance {
  id: string;
  sourceType: ProvenanceSourceType;
  observedAt: string;
  ownerId: string | null;
  confidence: ProvenanceConfidence;
  sourceRecord: string;
  formula?: string | null;
  sourceHash?: string | null;
  parentProvenanceIds?: string[];
  provider?: string | null;
  notes?: string | null;
  isDerived: boolean;
}

export interface ProvenanceLink extends DataProvenance {
  entityType: 'loyalty' | 'casino' | 'financial' | 'certificate' | 'weather' | 'offer' | 'cruise' | 'crew' | 'profile' | 'preference';
  entityId: string;
  field: string;
}

export interface ProvenancedValue<T> {
  value: T;
  provenance: DataProvenance;
}

export interface ProvenanceCitation {
  label: string;
  source: string;
  timestamp: string;
  confidence: ProvenanceConfidence;
  formula?: string | null;
}
