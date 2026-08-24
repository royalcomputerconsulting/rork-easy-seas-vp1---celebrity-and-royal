export type SyncProvider = 'royal' | 'celebrity' | 'carnival';

export interface SyncOwnershipSnapshot {
  provider: SyncProvider;
  profileId: string;
  authenticatedEmail: string;
  providerAccountFingerprint?: string;
  startedAt: string;
}

export interface SyncHandoffCounters {
  discoveredRows: number;
  normalizedRows: number;
  emittedRows: number;
  acknowledgedRows: number;
  receivedRows: number;
  rejectedRows: number;
  deduplicatedRows: number;
  insertedRows: number;
  updatedRows: number;
  unchangedRows: number;
  databaseReadbackRows: number;
  unaccountedRows: number;
}

export interface SyncReadbackReport {
  expectedRows: number;
  storedRows: number;
  matchedRows: number;
  missingRows: number;
  unexpectedRows: number;
  complete: boolean;
}

const emptyCounters: SyncHandoffCounters = {
  discoveredRows: 0,
  normalizedRows: 0,
  emittedRows: 0,
  acknowledgedRows: 0,
  receivedRows: 0,
  rejectedRows: 0,
  deduplicatedRows: 0,
  insertedRows: 0,
  updatedRows: 0,
  unchangedRows: 0,
  databaseReadbackRows: 0,
  unaccountedRows: 0,
};

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function positiveInteger(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

/**
 * A sync begins with an explicit authenticated owner.  Calls that attempt to
 * write after that owner changes must stop instead of sharing a payload across
 * accounts.
 */
export function createSyncOwnershipSnapshot(
  provider: SyncProvider,
  profileId: string | null | undefined,
  authenticatedEmail: string | null | undefined,
  providerAccountFingerprint?: string,
): SyncOwnershipSnapshot {
  return {
    provider,
    profileId: String(profileId ?? '').trim(),
    authenticatedEmail: normalized(authenticatedEmail),
    ...(providerAccountFingerprint ? { providerAccountFingerprint } : {}),
    startedAt: new Date().toISOString(),
  };
}

export function isSyncOwnershipCurrent(
  snapshot: SyncOwnershipSnapshot | null | undefined,
  profileId: string | null | undefined,
  authenticatedEmail: string | null | undefined,
): boolean {
  if (!snapshot || !snapshot.profileId || !snapshot.authenticatedEmail) {
    return false;
  }

  return snapshot.profileId === String(profileId ?? '').trim()
    && snapshot.authenticatedEmail === normalized(authenticatedEmail);
}

/**
 * A collected provider payload can only be persisted to the profile that
 * started the run, or to an explicitly linked profile with the same signed-in
 * EasySeas account email. This prevents a stale UI selection from writing one
 * account's Royal/Carnival data into somebody else's profile.
 */
export function canPersistSyncToTarget(
  snapshot: SyncOwnershipSnapshot | null | undefined,
  targetProfileId: string | null | undefined,
  targetProfileEmail: string | null | undefined,
): boolean {
  if (!snapshot?.profileId || !snapshot.authenticatedEmail) return false;
  const targetId = String(targetProfileId ?? '').trim();
  const targetEmail = normalized(targetProfileEmail);
  return targetId === snapshot.profileId || targetEmail === snapshot.authenticatedEmail;
}

export function createSyncHandoffCounters(): SyncHandoffCounters {
  return { ...emptyCounters };
}

export function updateSyncHandoffCounters(
  current: SyncHandoffCounters,
  updates: Partial<SyncHandoffCounters>,
): SyncHandoffCounters {
  const next = { ...current };
  (Object.keys(emptyCounters) as Array<keyof SyncHandoffCounters>).forEach((key) => {
    if (updates[key] !== undefined) {
      next[key] = positiveInteger(updates[key]);
    }
  });

  const accounted = next.rejectedRows + next.deduplicatedRows + next.acknowledgedRows;
  next.unaccountedRows = Math.max(0, next.discoveredRows - accounted);
  return next;
}

function identityForRow(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const value = row as Record<string, unknown>;
  const providerId = value.sourceRecordId ?? value.providerRecordId ?? value.reservationNumber ?? value.bookingId ?? value.id;
  if (String(providerId ?? '').trim()) return `id:${normalized(providerId)}`;

  return [
    value.offerCode,
    value.shipName,
    value.sailingDate ?? value.sailDate ?? value.sailingStartDate,
    value.cabinType,
    value.numberOfGuests,
  ].map(normalized).join('|');
}

/**
 * Readback checks compare the accepted payload with the persisted collection.
 * They deliberately use stable source identities, not generated array indexes.
 */
export function verifySyncReadback(expectedRows: unknown[], storedRows: unknown[]): SyncReadbackReport {
  const expected = new Set(expectedRows.map(identityForRow).filter(Boolean));
  const stored = new Set(storedRows.map(identityForRow).filter(Boolean));
  let matchedRows = 0;
  expected.forEach((identity) => {
    if (stored.has(identity)) matchedRows += 1;
  });
  let unexpectedRows = 0;
  stored.forEach((identity) => {
    if (!expected.has(identity)) unexpectedRows += 1;
  });

  return {
    expectedRows: expected.size,
    storedRows: stored.size,
    matchedRows,
    missingRows: Math.max(0, expected.size - matchedRows),
    unexpectedRows,
    complete: expected.size === matchedRows,
  };
}
