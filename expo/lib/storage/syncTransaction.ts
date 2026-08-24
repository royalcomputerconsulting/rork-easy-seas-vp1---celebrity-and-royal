import { quotaSafeGetJsonItem, quotaSafeSetJsonItem, hashStorageValue } from './quotaSafeStorage';
import { appendDiagnosticJournal } from './diagnosticJournal';

export type SyncDatasetName = 'offers' | 'cruises' | 'bookedCruises' | 'loyalty' | 'profile';
export interface SyncDatasetCommit {
  hash: string;
  count: number;
  committedAt: string;
  /** The manifest hash is diagnostic only; the storage layer verifies the complete serialized dataset. */
  hashMode?: 'bounded-dataset-fingerprint-v1';
}
export type SyncTransactionPhase = 'preparing' | 'writing' | 'verifying' | 'publishing' | 'complete' | 'aborted';
export interface SyncTransactionManifest {
  version: 1;
  runId: string;
  source: 'royal' | 'celebrity' | 'carnival';
  status: 'prepared' | 'committed' | 'aborted';
  phase?: SyncTransactionPhase;
  startedAt: string;
  committedAt?: string;
  abortedAt?: string;
  error?: string;
  datasets: Partial<Record<SyncDatasetName, SyncDatasetCommit>>;
}

export const SYNC_TRANSACTION_MANIFEST_KEY = '@easyseas_sync_transaction_manifest_v1';
const MANIFEST_KEY = SYNC_TRANSACTION_MANIFEST_KEY;

export function createSyncTransactionRunId(source: string): string {
  return `${source}-sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const DATASET_FINGERPRINT_SAMPLE_LIMIT = 64;
const DATASET_FINGERPRINT_VALUE_LIMIT = 160;
const DATASET_IDENTITY_KEYS = [
  'id',
  'offerInstanceId',
  'playerOfferId',
  'carnivalOfferId',
  'offerCode',
  'offerName',
  'shipName',
  'sailingDate',
  'sailDate',
  'returnDate',
  'bookingId',
  'reservationId',
  'source',
  'cruiseSource',
] as const;

function compactFingerprintValue(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, DATASET_FINGERPRINT_VALUE_LIMIT);
  return `[${Array.isArray(value) ? 'array' : typeof value}]`;
}

function compactRowIdentity(row: unknown): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return compactFingerprintValue(row);
  const record = row as Record<string, unknown>;
  const identity: Record<string, string | number | boolean | null> = {};
  for (const key of DATASET_IDENTITY_KEYS) {
    if (record[key] !== undefined) identity[key] = compactFingerprintValue(record[key]);
  }
  if (Object.keys(identity).length > 0) return identity;
  for (const key of Object.keys(record).sort().slice(0, 12)) {
    identity[key] = compactFingerprintValue(record[key]);
  }
  return identity;
}

/**
 * The persistence layer already hashes and verifies every byte written to its
 * native transaction file. The sync manifest only needs a bounded diagnostic
 * fingerprint. Re-stringifying multi-thousand-row datasets here previously
 * blocked Hermes long enough to trip the 10-second Carnival checkpoint.
 */
function buildDatasetFingerprint(rows: unknown): string {
  if (!Array.isArray(rows)) return hashStorageValue(JSON.stringify(compactRowIdentity(rows)));
  const sampleCount = Math.min(DATASET_FINGERPRINT_SAMPLE_LIMIT, rows.length);
  const sampledRows: unknown[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const rowIndex = sampleCount <= 1
      ? 0
      : Math.round((index * (rows.length - 1)) / (sampleCount - 1));
    sampledRows.push(compactRowIdentity(rows[rowIndex]));
  }
  return hashStorageValue(JSON.stringify({ version: 1, count: rows.length, sampledRows }));
}

export async function beginSyncTransaction(source: SyncTransactionManifest['source'], runId = createSyncTransactionRunId(source)): Promise<SyncTransactionManifest> {
  const manifest: SyncTransactionManifest = { version: 1, runId, source, status: 'prepared', phase: 'preparing', startedAt: new Date().toISOString(), datasets: {} };
  await quotaSafeSetJsonItem(MANIFEST_KEY, manifest, { runId: `${runId}:manifest:prepared` });
  appendDiagnosticJournal('SYNC_TRANSACTION_PREPARED', { runId, source });
  return manifest;
}

export async function recordSyncDataset(manifest: SyncTransactionManifest, name: SyncDatasetName, rows: unknown): Promise<SyncTransactionManifest> {
  const count = Array.isArray(rows) ? rows.length : rows == null ? 0 : 1;
  const hash = buildDatasetFingerprint(rows);
  const next: SyncTransactionManifest = {
    ...manifest,
    phase: 'writing',
    datasets: {
      ...manifest.datasets,
      [name]: { count, hash, committedAt: new Date().toISOString(), hashMode: 'bounded-dataset-fingerprint-v1' },
    },
  };
  await quotaSafeSetJsonItem(MANIFEST_KEY, next, { runId: `${manifest.runId}:manifest:${name}` });
  appendDiagnosticJournal('SYNC_DATASET_RECORDED', {
    runId: manifest.runId,
    name,
    count,
    hash,
    hashMode: 'bounded-dataset-fingerprint-v1',
  });
  return next;
}

/**
 * Record a completed group of dataset writes with one manifest persistence.
 * The datasets themselves have already been written and byte-verified by the
 * storage layer; this manifest contains only bounded diagnostic fingerprints.
 * Writing it once avoids three serial filesystem transactions at the end of a
 * large Royal or Carnival sync without weakening any dataset verification.
 */
export async function recordSyncDatasets(
  manifest: SyncTransactionManifest,
  datasets: Partial<Record<SyncDatasetName, unknown>>,
): Promise<SyncTransactionManifest> {
  const committedAt = new Date().toISOString();
  const commits: Partial<Record<SyncDatasetName, SyncDatasetCommit>> = {};

  for (const [name, rows] of Object.entries(datasets) as Array<[SyncDatasetName, unknown]>) {
    const count = Array.isArray(rows) ? rows.length : rows == null ? 0 : 1;
    const hash = buildDatasetFingerprint(rows);
    commits[name] = { count, hash, committedAt, hashMode: 'bounded-dataset-fingerprint-v1' };
    appendDiagnosticJournal('SYNC_DATASET_RECORDED', {
      runId: manifest.runId,
      name,
      count,
      hash,
      hashMode: 'bounded-dataset-fingerprint-v1',
    });
  }

  const next: SyncTransactionManifest = {
    ...manifest,
    phase: 'writing',
    datasets: { ...manifest.datasets, ...commits },
  };
  await quotaSafeSetJsonItem(MANIFEST_KEY, next, { runId: `${manifest.runId}:manifest:datasets` });
  return next;
}

export async function commitSyncTransaction(manifest: SyncTransactionManifest): Promise<SyncTransactionManifest> {
  const next: SyncTransactionManifest = { ...manifest, status: 'committed', phase: 'complete', committedAt: new Date().toISOString() };
  await quotaSafeSetJsonItem(MANIFEST_KEY, next, { runId: `${manifest.runId}:manifest:committed` });
  appendDiagnosticJournal('SYNC_TRANSACTION_COMMITTED', { runId: manifest.runId, source: manifest.source, datasets: Object.keys(manifest.datasets) });
  return next;
}

export async function abortSyncTransaction(manifest: SyncTransactionManifest | null, error: unknown): Promise<void> {
  if (!manifest) return;
  const next: SyncTransactionManifest = {
    ...manifest,
    status: 'aborted',
    phase: 'aborted',
    abortedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await quotaSafeSetJsonItem(MANIFEST_KEY, next, { runId: `${manifest.runId}:manifest:aborted` }).catch(() => undefined);
  appendDiagnosticJournal('SYNC_TRANSACTION_ABORTED', { runId: manifest.runId, error: next.error });
}

export async function loadLastSyncTransaction(): Promise<SyncTransactionManifest | null> {
  return quotaSafeGetJsonItem<SyncTransactionManifest | null>(MANIFEST_KEY, null, (value): value is SyncTransactionManifest => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Partial<SyncTransactionManifest>;
    return record.version === 1 && typeof record.runId === 'string' && ['prepared', 'committed', 'aborted'].includes(String(record.status));
  });
}


/**
 * Cold-start recovery for a sync interrupted before its commit marker. The
 * committed datasets remain untouched; only the incomplete manifest is
 * closed so the next sync can start without inheriting a phantom in-flight
 * state.
 */
export async function recoverIncompleteSyncTransaction(): Promise<SyncTransactionManifest | null> {
  const manifest = await loadLastSyncTransaction();
  if (!manifest || manifest.status !== 'prepared') return manifest;
  const recovered: SyncTransactionManifest = {
    ...manifest,
    status: 'aborted',
    phase: 'aborted',
    abortedAt: new Date().toISOString(),
    error: 'INTERRUPTED_BEFORE_COMMIT',
  };
  await quotaSafeSetJsonItem(MANIFEST_KEY, recovered, { runId: `${manifest.runId}:manifest:startup-recovery` });
  appendDiagnosticJournal('SYNC_TRANSACTION_RECOVERED', { runId: manifest.runId, source: manifest.source });
  return recovered;
}
