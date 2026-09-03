export interface ProfileSyncReadbackReport {
  verified: boolean;
  targetFound: boolean;
  checkedFields: string[];
  mismatchedFields: string[];
}

function samePersistedValue(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (typeof expected === 'number') return typeof actual === 'number' && Number.isFinite(actual) && actual === expected;
  if (typeof expected === 'string') return typeof actual === 'string' && actual === expected;
  if (typeof expected === 'boolean' || expected === null) return actual === expected;
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/** Verifies the owner-scoped profile fields that a provider sync attempted to persist. */
export function verifyProfileSyncReadback(
  storedUsers: unknown,
  targetProfileId: string,
  expectedUpdates: Record<string, unknown>,
): ProfileSyncReadbackReport {
  const checkedFields = Object.keys(expectedUpdates).filter((field) => expectedUpdates[field] !== undefined);
  const users = Array.isArray(storedUsers) ? storedUsers : [];
  const target = users.find((candidate) => candidate && typeof candidate === 'object' && String((candidate as Record<string, unknown>).id ?? '') === targetProfileId) as Record<string, unknown> | undefined;
  if (!target) {
    return { verified: false, targetFound: false, checkedFields, mismatchedFields: checkedFields };
  }
  const mismatchedFields = checkedFields.filter((field) => !samePersistedValue(target[field], expectedUpdates[field]));
  return { verified: mismatchedFields.length === 0, targetFound: true, checkedFields, mismatchedFields };
}
