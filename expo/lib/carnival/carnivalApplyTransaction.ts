import { carnivalStableHash, stableStringify } from './carnivalSyncRuntime';

export const CARNIVAL_APPLY_JOURNAL_VERSION = 1;

export type CarnivalApplyJournalStatus = 'staged' | 'applying' | 'rolling_back' | 'committed';

export interface CarnivalApplySnapshot {
  offers: unknown[];
  cruises: unknown[];
  bookedCruises: unknown[];
  profile: Record<string, unknown> | null;
}

export interface CarnivalApplyTarget {
  offers: unknown[];
  cruises: unknown[];
  bookedCruises: unknown[];
  profileUpdates: Record<string, unknown>;
}

export interface CarnivalApplyJournal {
  version: number;
  transactionId: string;
  status: CarnivalApplyJournalStatus;
  targetProfileId: string;
  selectedSections: Record<string, boolean>;
  before: CarnivalApplySnapshot;
  after: CarnivalApplyTarget;
  beforeChecksum: string;
  afterChecksum: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function calculateCarnivalApplyChecksum(value: unknown): string {
  return carnivalStableHash(stableStringify(value));
}

export function createCarnivalApplyJournal(input: {
  transactionId: string;
  targetProfileId?: string | null;
  selectedSections: Record<string, boolean>;
  before: CarnivalApplySnapshot;
  after: CarnivalApplyTarget;
  now?: Date;
}): CarnivalApplyJournal {
  const now = input.now ?? new Date();
  const before = cloneJson(input.before);
  const after = cloneJson(input.after);
  return {
    version: CARNIVAL_APPLY_JOURNAL_VERSION,
    transactionId: input.transactionId,
    status: 'staged',
    targetProfileId: String(input.targetProfileId ?? ''),
    selectedSections: { ...input.selectedSections },
    before,
    after,
    beforeChecksum: calculateCarnivalApplyChecksum(before),
    afterChecksum: calculateCarnivalApplyChecksum(after),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function validateCarnivalApplyJournal(journal: CarnivalApplyJournal): { valid: boolean; reason?: string } {
  if (!journal || journal.version !== CARNIVAL_APPLY_JOURNAL_VERSION) {
    return { valid: false, reason: 'unsupported journal version' };
  }
  if (!journal.transactionId || !journal.createdAt || !journal.updatedAt) {
    return { valid: false, reason: 'missing transaction metadata' };
  }
  if (journal.beforeChecksum !== calculateCarnivalApplyChecksum(journal.before)) {
    return { valid: false, reason: 'before snapshot checksum mismatch' };
  }
  if (journal.afterChecksum !== calculateCarnivalApplyChecksum(journal.after)) {
    return { valid: false, reason: 'staged target checksum mismatch' };
  }
  const hasProfileUpdates = Object.keys(journal.after.profileUpdates ?? {}).length > 0;
  if (hasProfileUpdates && !journal.targetProfileId) {
    return { valid: false, reason: 'profile updates require a target profile id' };
  }
  if (hasProfileUpdates && !journal.before.profile) {
    return { valid: false, reason: 'profile updates require a pre-sync profile snapshot' };
  }
  if (hasProfileUpdates) {
    const snapshotId = String(journal.before.profile?.id ?? '');
    if (!snapshotId || snapshotId !== journal.targetProfileId) {
      return { valid: false, reason: 'profile snapshot does not match the target profile id' };
    }
  }
  return { valid: true };
}

export function updateCarnivalApplyJournal(
  journal: CarnivalApplyJournal,
  status: CarnivalApplyJournalStatus,
  lastError?: string,
  now = new Date(),
): CarnivalApplyJournal {
  return {
    ...journal,
    status,
    updatedAt: now.toISOString(),
    ...(lastError ? { lastError } : {}),
  };
}

export interface CarnivalApplyTransactionWriters {
  writeOffers(value: unknown[]): Promise<void>;
  writeCruises(value: unknown[]): Promise<void>;
  writeBookedCruises(value: unknown[]): Promise<void>;
  writeProfile(value: Record<string, unknown> | null): Promise<void>;
  writeJournal?(value: CarnivalApplyJournal | null): Promise<void>;
}

export interface CarnivalApplyTransactionResult {
  committed: boolean;
  rolledBack: boolean;
  journal: CarnivalApplyJournal;
  error?: string;
}

/**
 * Executable all-or-nothing local apply primitive. The provider uses the same
 * staged snapshot shape, while tests can inject failing writers after any
 * collection write to prove the recovery path restores every prior value.
 */
export async function executeCarnivalApplyTransaction(
  journalInput: CarnivalApplyJournal,
  writers: CarnivalApplyTransactionWriters,
): Promise<CarnivalApplyTransactionResult> {
  const validation = validateCarnivalApplyJournal(journalInput);
  if (!validation.valid) {
    throw new Error(`Invalid Carnival apply journal: ${validation.reason || 'unknown reason'}`);
  }
  let journal = updateCarnivalApplyJournal(journalInput, 'applying');
  await writers.writeJournal?.(journal);
  try {
    await writers.writeOffers(cloneJson(journal.after.offers));
    await writers.writeCruises(cloneJson(journal.after.cruises));
    await writers.writeBookedCruises(cloneJson(journal.after.bookedCruises));
    const nextProfile = journal.before.profile
      ? { ...cloneJson(journal.before.profile), ...cloneJson(journal.after.profileUpdates) }
      : Object.keys(journal.after.profileUpdates || {}).length
        ? cloneJson(journal.after.profileUpdates)
        : null;
    await writers.writeProfile(nextProfile);
    journal = updateCarnivalApplyJournal(journal, 'committed');
    await writers.writeJournal?.(journal);
    return { committed: true, rolledBack: false, journal };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    journal = updateCarnivalApplyJournal(journal, 'rolling_back', message);
    await writers.writeJournal?.(journal);
    const rollbackErrors: string[] = [];
    for (const operation of [
      () => writers.writeOffers(cloneJson(journal.before.offers)),
      () => writers.writeCruises(cloneJson(journal.before.cruises)),
      () => writers.writeBookedCruises(cloneJson(journal.before.bookedCruises)),
      () => writers.writeProfile(cloneJson(journal.before.profile)),
    ]) {
      try { await operation(); } catch (rollbackError) { rollbackErrors.push(String(rollbackError)); }
    }
    const finalError = rollbackErrors.length
      ? `${message}; rollback errors: ${rollbackErrors.join(' | ')}`
      : message;
    journal = updateCarnivalApplyJournal(journal, 'staged', finalError);
    await writers.writeJournal?.(journal);
    return { committed: false, rolledBack: rollbackErrors.length === 0, journal, error: finalError };
  }
}
