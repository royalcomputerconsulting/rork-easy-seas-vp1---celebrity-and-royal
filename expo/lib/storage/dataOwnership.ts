export const DATA_OWNER_SCOPE_FIELD = 'dataOwnerScopeId' as const;
export const DATA_OWNER_EMAIL_FIELD = 'dataOwnerEmail' as const;
export const DATA_OWNER_SYNCED_AT_FIELD = 'dataOwnerSyncedAt' as const;

const KNOWN_PRIVATE_OWNER_RULES: { ownerEmails: string[]; signatures: string[] }[] = [
  {
    ownerEmails: ['scott.merlis1@gmail.com', 's@a.com'],
    signatures: ['scott merlis', 'justin pence'],
  },
];

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function valueContainsSignature(value: unknown, signatures: string[], depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    const normalizedValue = normalizeSearchText(value);
    return signatures.some((signature) => normalizedValue.includes(signature));
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => valueContainsSignature(entry, signatures, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => valueContainsSignature(entry, signatures, depth + 1));
  }

  return false;
}

export interface OwnedDataRecord {
  dataOwnerScopeId?: string;
  dataOwnerEmail?: string;
  dataOwnerSyncedAt?: string;
}

export function normalizeOwnerEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

export function isOwnerScopeForEmail(ownerScopeId: string | null | undefined, email: string | null | undefined): boolean {
  const normalizedEmail = normalizeOwnerEmail(email);
  const normalizedScope = ownerScopeId?.trim() ?? '';

  if (!normalizedEmail || !normalizedScope) {
    return false;
  }

  return normalizedScope === normalizedEmail || normalizedScope.startsWith(`${normalizedEmail}::`);
}

export function containsKnownForeignPersonalData(value: unknown, email: string | null | undefined): boolean {
  const normalizedEmail = normalizeOwnerEmail(email);

  return KNOWN_PRIVATE_OWNER_RULES.some((rule) => {
    if (normalizedEmail && rule.ownerEmails.includes(normalizedEmail)) {
      return false;
    }

    return valueContainsSignature(value, rule.signatures.map(normalizeSearchText));
  });
}

export function isRecordForOwner(record: unknown, ownerScopeId: string | null | undefined, email: string | null | undefined): boolean {
  if (!record || typeof record !== 'object') {
    return true;
  }

  if (containsKnownForeignPersonalData(record, email)) {
    return false;
  }

  const normalizedEmail = normalizeOwnerEmail(email);
  const normalizedScope = ownerScopeId?.trim() ?? '';
  const ownedRecord = record as OwnedDataRecord & { userId?: unknown; email?: unknown; ownerEmail?: unknown };
  const recordScope = ownedRecord.dataOwnerScopeId?.trim();
  const recordEmail = normalizeOwnerEmail(ownedRecord.dataOwnerEmail);
  const recordUserId = typeof ownedRecord.userId === 'string' ? normalizeOwnerEmail(ownedRecord.userId) : null;
  const recordOwnEmail = typeof ownedRecord.email === 'string' ? normalizeOwnerEmail(ownedRecord.email) : null;
  const recordOwnerEmail = typeof ownedRecord.ownerEmail === 'string' ? normalizeOwnerEmail(ownedRecord.ownerEmail) : null;

  if (recordScope) {
    return normalizedScope.length > 0 && recordScope === normalizedScope;
  }

  if (recordEmail) {
    return normalizedEmail !== null && recordEmail === normalizedEmail;
  }

  if (recordOwnerEmail) {
    return normalizedEmail !== null && recordOwnerEmail === normalizedEmail;
  }

  if (recordOwnEmail) {
    return normalizedEmail !== null && recordOwnEmail === normalizedEmail;
  }

  if (recordUserId && recordUserId !== 'local' && recordUserId !== 'guest') {
    return normalizedEmail !== null && recordUserId === normalizedEmail;
  }

  return true;
}

export function filterRecordsForOwner<T>(records: T[], ownerScopeId: string | null | undefined, email: string | null | undefined, label: string): T[] {
  const filteredRecords = records.filter((record) => isRecordForOwner(record, ownerScopeId, email));

  if (filteredRecords.length !== records.length) {
    console.warn('[DataOwnership] Removed records outside active user scope:', {
      label,
      original: records.length,
      filtered: filteredRecords.length,
      removed: records.length - filteredRecords.length,
      ownerScopeId,
      email: normalizeOwnerEmail(email),
    });
  }

  return filteredRecords;
}

export function stampRecordsForOwner<T extends object>(records: T[], ownerScopeId: string | null | undefined, email: string | null | undefined): T[] {
  const normalizedEmail = normalizeOwnerEmail(email);
  const normalizedScope = ownerScopeId?.trim() ?? '';
  const syncedAt = new Date().toISOString();

  if (!normalizedEmail || !normalizedScope) {
    return records;
  }

  return records.map((record) => ({
    ...record,
    dataOwnerScopeId: normalizedScope,
    dataOwnerEmail: normalizedEmail,
    dataOwnerSyncedAt: syncedAt,
  }));
}

export function isScopedDynamicKeyForOwner(key: string, basePrefix: string, email: string | null | undefined): boolean {
  const normalizedEmail = normalizeOwnerEmail(email);

  if (!normalizedEmail || !key.startsWith(basePrefix)) {
    return false;
  }

  return key.endsWith(`::${normalizedEmail}`);
}

export function toOwnerScopedDynamicKey(key: string, basePrefix: string, email: string | null | undefined): string | null {
  const normalizedEmail = normalizeOwnerEmail(email);

  if (!normalizedEmail || !key.startsWith(basePrefix)) {
    return null;
  }

  const unscopedKey = key.includes('::') ? key.slice(0, key.indexOf('::')) : key;
  return `${unscopedKey}::${normalizedEmail}`;
}
