import { toCalendarDateOnly } from './date';

export type DataAuthority =
  | 'provider'
  | 'public_document'
  | 'verified_local'
  | 'enriched'
  | 'user_entered'
  | 'derived'
  | 'unknown';

const AUTHORITY_RANK: Record<DataAuthority, number> = {
  provider: 70,
  public_document: 60,
  verified_local: 50,
  enriched: 40,
  user_entered: 30,
  derived: 20,
  unknown: 0,
};

export function getDataAuthority(value: unknown): DataAuthority {
  switch (value) {
    case 'provider':
    case 'public_document':
    case 'verified_local':
    case 'enriched':
    case 'user_entered':
    case 'derived':
    case 'unknown':
      return value;
    default:
      return 'unknown';
  }
}

export function isAtLeastAsAuthoritative(candidate: unknown, existing: unknown): boolean {
  return AUTHORITY_RANK[getDataAuthority(candidate)] >= AUTHORITY_RANK[getDataAuthority(existing)];
}

export function isOperationallyAuthoritative(value: unknown): boolean {
  const authority = getDataAuthority(value);
  return authority === 'provider' || authority === 'public_document' || authority === 'verified_local';
}

export function isInferredAuthority(value: unknown): boolean {
  const authority = getDataAuthority(value);
  return authority === 'enriched' || authority === 'derived' || authority === 'unknown';
}

type EvidenceRecord = Record<string, unknown>;

const CALENDAR_DATE_FIELDS = ['sailDate', 'returnDate', 'sailingDate', 'startDate', 'endDate', 'date', 'expiryDate', 'offerExpirationDate'];

export function getRecordAuthority(record: EvidenceRecord): DataAuthority {
  if (record.validationStatus === 'quarantined' || record.validationStatus === 'rejected') return 'unknown';
  if (record.isFallback === true) return 'enriched';
  const evidence = typeof record.sourceEvidence === 'object' && record.sourceEvidence
    ? record.sourceEvidence as EvidenceRecord
    : undefined;
  const explicitAuthority = getDataAuthority(record.sourceAuthority ?? evidence?.authority);
  if (explicitAuthority !== 'unknown') return explicitAuthority;
  if (record.dataConfidence === 'verified' && (record.sourceProvider || record.sourceEndpoint || record.sourceRecordId)) return 'provider';
  if (record.dataConfidence === 'verified') return 'verified_local';
  if (record.dataConfidence === 'enriched') return 'enriched';
  return getDataAuthority(record.source);
}

export function isRecordIncomplete(record: EvidenceRecord): boolean {
  return record.validationStatus === 'partial'
    || record.validationStatus === 'quarantined'
    || record.validationStatus === 'rejected'
    || record.dataConfidence === 'partial'
    || record.dataConfidence === 'unknown';
}

/**
 * Canonicalizes calendar-only fields and evidence once at the persistence
 * boundary. Invalid written dates become quarantined instead of being parsed
 * later in a device time zone.
 */
export function canonicalizeDataRecord<T extends EvidenceRecord>(record: T): T {
  let normalized: EvidenceRecord = record;
  const setField = (field: string, value: unknown) => {
    if (normalized[field] === value) return;
    if (normalized === record) normalized = { ...record };
    normalized[field] = value;
  };
  let invalidCalendarDate = false;

  CALENDAR_DATE_FIELDS.forEach((field) => {
    const raw = normalized[field];
    if (typeof raw !== 'string' || raw.trim().length === 0) return;
    const dateOnly = toCalendarDateOnly(raw);
    if (!dateOnly) {
      invalidCalendarDate = true;
      return;
    }
    setField(field, dateOnly);
  });

  if (invalidCalendarDate) {
    setField('validationStatus', 'quarantined');
    setField('dataConfidence', 'partial');
    setField('sourceAuthority', 'unknown');
    const existingEvidence = typeof normalized.sourceEvidence === 'object' && normalized.sourceEvidence
      ? normalized.sourceEvidence as EvidenceRecord
      : {};
    if (existingEvidence.authority !== 'unknown' || existingEvidence.reason !== 'Invalid calendar date evidence.') {
      setField('sourceEvidence', {
        ...existingEvidence,
        authority: 'unknown',
        reason: 'Invalid calendar date evidence.',
      });
    }
    return normalized as T;
  }

  const authority = getRecordAuthority(normalized);
  setField('sourceAuthority', authority);
  if (!normalized.dataConfidence) {
    setField('dataConfidence', authority === 'provider' || authority === 'public_document' || authority === 'verified_local'
      ? 'verified'
      : authority === 'enriched'
        ? 'enriched'
        : 'partial');
  }
  if (!normalized.validationStatus) {
    setField('validationStatus', authority === 'unknown' || authority === 'derived' ? 'partial' : 'valid');
  }
  if (typeof normalized.sourceEvidence === 'object' && normalized.sourceEvidence) {
    const evidence = normalized.sourceEvidence as EvidenceRecord;
    if (evidence.authority !== authority) {
      setField('sourceEvidence', { ...evidence, authority });
    }
  }
  return normalized as T;
}

export function canonicalizeDataRecords<T extends EvidenceRecord>(records: T[]): T[] {
  let canonicalRecords: T[] | null = null;
  records.forEach((record, index) => {
    const canonical = canonicalizeDataRecord(record);
    if (canonical === record) return;
    if (!canonicalRecords) canonicalRecords = records.slice();
    canonicalRecords[index] = canonical;
  });
  return canonicalRecords ?? records;
}

export function retainHigherAuthority<T extends { source?: unknown }>(existing: T, candidate: T): T {
  return isAtLeastAsAuthoritative(candidate.source, existing.source) ? candidate : existing;
}
