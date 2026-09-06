import * as forge from 'node-forge';
import { getHealthTrustDatabase, HEALTH_TRUST_SCHEMA_VERSION } from '@/lib/database/HealthTrustDatabase';
import type { FullAppDataBundle } from '@/lib/dataBundle/bundleOperations';
import type { ProvenanceLink } from '@/types/provenance';
import type { ExperiencePreferences } from '@/constants/easySeasDesignSystem';

export const INCREMENTAL_BACKUP_FORMAT = 'easyseas-incremental-encrypted-v1';
const PBKDF2_ITERATIONS = 180_000;
export type BackupOperation = 'add' | 'update' | 'delete';
export interface BackupDatasetRecord { dataset: string; recordId: string; operation: BackupOperation; contentHash: string; encryptedChunk: string; }
export interface IncrementalBackupManifest { format: typeof INCREMENTAL_BACKUP_FORMAT; backupId: string; ownerId: string; schemaVersion: number; appVersion: string; createdAt: string; kind: 'full' | 'incremental'; baseBackupId: string | null; encryption: { algorithm: 'AES-256-GCM'; kdf: 'PBKDF2-SHA256'; iterations: number; salt: string; keyCheck: string; }; datasets: Array<{ name: string; adds: number; updates: number; deletes: number; preserved: number; contentHash: string }>; recordCount: number; contentHash: string; includes: string[]; }
export interface IncrementalBackupEnvelope { manifest: IncrementalBackupManifest; records: BackupDatasetRecord[]; }
export interface IncrementalBackupArchive { format: 'easyseas-incremental-chain-v1'; chain: IncrementalBackupEnvelope[]; }
export interface RestorePreviewRow { dataset: string; add: number; update: number; preserve: number; conflict: number; reject: number; delete: number; }
export interface RestorePreview { backupId: string; rows: RestorePreviewRow[]; totals: Omit<RestorePreviewRow, 'dataset'>; requiresConfirmation: true; conflicts: Array<{ dataset: string; recordId: string; reason: string }>; }
export type BackupDatasetMap = Record<string, Record<string, unknown>>;
export interface BackupStorageAssessment { requiredBytes: number; availableBytes: number; sufficient: boolean; reserveBytes: number; message: string; }
export interface RestoreReadbackRow { dataset: string; expected: number; actual: number; missing: number; mismatched: number; }
export interface RestoreReadbackReport { exact: boolean; rows: RestoreReadbackRow[]; expectedTotal: number; actualTotal: number; }

export interface BackupResumeCheckpoint {
  ownerId: string;
  baseBackupId: string | null;
  recoveryKey: string;
  completedDatasets: string[];
  records: BackupDatasetRecord[];
  datasetSummary: IncrementalBackupManifest['datasets'];
}

export class BackupCancelledError extends Error {
  readonly checkpoint: BackupResumeCheckpoint;
  constructor(checkpoint: BackupResumeCheckpoint) {
    super('BACKUP_CANCELLED');
    this.name = 'BackupCancelledError';
    this.checkpoint = checkpoint;
  }
}

const datasetContentHash = (datasetRecords: Record<string, unknown>) => hashText(
  Object.entries(datasetRecords)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, value]) => `${id}:${hashText(stableJson(value))}`)
    .join('|'),
);

function hashText(value: string): string { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`; return JSON.stringify(value); }
function bytesToBase64(bytes: string): string { return forge.util.encode64(bytes); }
function base64ToBytes(value: string): string { return forge.util.decode64(value); }
function randomBytes(count: number): string { return forge.random.getBytesSync(count); }
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Produces a conservative byte estimate without first creating one enormous
 * JSON string. AES-GCM/base64 expands the payload, and the app keeps a local
 * chain plus a shareable copy, so the multiplier deliberately includes both
 * files and a bounded safety reserve.
 */
export async function estimateBackupStorageBytes(
  datasets: BackupDatasetMap,
  existingArchiveBytes = 0,
  onProgress?: (dataset: string, processed: number, total: number) => void,
  signal?: { readonly aborted: boolean },
): Promise<number> {
  let sourceBytes = 0;
  for (const [dataset, rows] of Object.entries(datasets)) {
    const entries = Object.entries(rows);
    for (let index = 0; index < entries.length; index += 1) {
      if (signal?.aborted) throw new Error('BACKUP_PREFLIGHT_CANCELLED');
      const [recordId, value] = entries[index];
      const serialized = stableJson(value);
      sourceBytes += forge.util.encodeUtf8(serialized).length + forge.util.encodeUtf8(recordId).length + forge.util.encodeUtf8(dataset).length + 256;
      if ((index + 1) % 100 === 0) {
        onProgress?.(dataset, index + 1, entries.length);
        await yieldToUi();
      }
    }
    onProgress?.(dataset, entries.length, entries.length);
    await yieldToUi();
  }
  const encryptedAndBase64 = Math.ceil(sourceBytes * 4 / 3);
  const completeArchive = existingArchiveBytes + encryptedAndBase64 + 1_048_576;
  return Math.ceil(completeArchive * 2.25);
}

export function assessBackupStorageCapacity(requiredBytes: number, availableBytes: number, reserveBytes = 128 * 1024 * 1024): BackupStorageAssessment {
  const normalizedRequired = Math.max(0, Math.ceil(requiredBytes));
  const normalizedAvailable = Math.max(0, Math.floor(availableBytes));
  const sufficient = normalizedAvailable >= normalizedRequired + reserveBytes;
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  return {
    requiredBytes: normalizedRequired,
    availableBytes: normalizedAvailable,
    sufficient,
    reserveBytes,
    message: sufficient
      ? `${mb(normalizedAvailable)} MB available; ${mb(normalizedRequired)} MB required plus ${mb(reserveBytes)} MB safety reserve.`
      : `Not enough free space. ${mb(normalizedAvailable)} MB is available, but this backup needs ${mb(normalizedRequired)} MB plus a ${mb(reserveBytes)} MB safety reserve. No backup file was written.`,
  };
}

export function assertBackupStorageCapacity(requiredBytes: number, availableBytes: number, reserveBytes?: number): BackupStorageAssessment {
  const assessment = assessBackupStorageCapacity(requiredBytes, availableBytes, reserveBytes);
  if (!assessment.sufficient) throw new Error(`BACKUP_INSUFFICIENT_STORAGE: ${assessment.message}`);
  return assessment;
}

async function derivePasswordKey(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => forge.pkcs5.pbkdf2(password, salt, PBKDF2_ITERATIONS, 32, 'sha256', (error: unknown, key: string) => error ? reject(error) : resolve(key)));
}
function encryptJson(value: unknown, key: string): string { const iv = randomBytes(12); const cipher = forge.cipher.createCipher('AES-GCM', key); cipher.start({ iv, tagLength: 128 }); cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(JSON.stringify(value)))); if (!cipher.finish()) throw new Error('BACKUP_ENCRYPTION_FAILED'); return JSON.stringify({ iv: bytesToBase64(iv), tag: bytesToBase64(cipher.mode.tag.getBytes()), body: bytesToBase64(cipher.output.getBytes()) }); }
function decryptJson<T>(value: string, key: string): T { const envelope = JSON.parse(value) as { iv: string; tag: string; body: string }; const decipher = forge.cipher.createDecipher('AES-GCM', key); decipher.start({ iv: base64ToBytes(envelope.iv), tagLength: 128, tag: forge.util.createBuffer(base64ToBytes(envelope.tag)) }); decipher.update(forge.util.createBuffer(base64ToBytes(envelope.body))); if (!decipher.finish()) throw new Error('BACKUP_CREDENTIAL_INVALID_OR_DATA_DAMAGED'); return JSON.parse(forge.util.decodeUtf8(decipher.output.getBytes())) as T; }

function mapArray(records: unknown[] | undefined, fallback: string): Record<string, unknown> { const output: Record<string, unknown> = {}; (records ?? []).forEach((record, index) => { const value = record && typeof record === 'object' ? record as Record<string, unknown> : {}; const id = String(value.id ?? value.recordId ?? value.cruiseId ?? value.certificateCode ?? `${fallback}-${index}`); output[id] = record; }); return output; }
export function buildBackupDatasetMap(bundle: FullAppDataBundle, extras?: { provenance?: ProvenanceLink[]; preferences?: Record<string, ExperiencePreferences>; rawUserPreferences?: Record<string, unknown> }): BackupDatasetMap {
  return {
    cruises: mapArray(bundle.cruises, 'cruise'), bookedCruises: mapArray(bundle.bookedCruises, 'booking'), casinoOffers: mapArray(bundle.casinoOffers, 'offer'), calendarEvents: mapArray(bundle.calendarEvents, 'event'), casinoSessions: mapArray(bundle.casinoSessions, 'session'),
    certificates: mapArray(bundle.certificates, 'certificate'), certificateDocuments: mapArray(bundle.certificateDocuments ?? [], 'certificate-document'), users: mapArray(bundle.users, 'user'), crewRecognition: mapArray(bundle.crewRecognition.entries, 'crew'), crewSailings: mapArray(bundle.crewRecognition.sailings, 'crew-sailing'),
    machineEncyclopedia: mapArray(bundle.machines.encyclopedia, 'machine'), savedAtlasMachines: mapArray(bundle.machines.atlasIds.map((id) => ({ id })), 'atlas'), customSlotMachines: mapArray(bundle.machines.userMachines ?? [], 'custom-machine'), deckPlanLocations: mapArray(bundle.machines.deckLocations ?? [], 'deck-location'),
    casinoHistory: { casinoData: bundle.casinoData ?? null }, profile: { current: bundle.userProfile ?? null }, settings: { app: bundle.settings ?? null }, loyalty: { points: bundle.loyaltyData, extended: bundle.extendedLoyaltyData ?? null, clubRoyale: bundle.clubRoyaleProfile ?? null }, playingHours: { current: bundle.playingHours ?? null },
    provenance: mapArray(extras?.provenance ?? [], 'provenance'), experiencePreferences: extras?.preferences ?? {}, userPreferences: extras?.rawUserPreferences ?? {},
    sourceManifests: { agentSea: bundle.agentSeaSourceManifest ?? null },
  };
}

export async function createIncrementalEncryptedBackup(input: {
  ownerId: string;
  appVersion: string;
  datasets: BackupDatasetMap;
  password: string;
  previous?: IncrementalBackupEnvelope | null;
  previousChain?: IncrementalBackupEnvelope[];
  recoveryKey?: string;
  signal?: { readonly aborted: boolean };
  resume?: BackupResumeCheckpoint;
  onProgress?: (dataset: string, processed: number, total: number) => void;
  onCheckpoint?: (checkpoint: BackupResumeCheckpoint) => void;
}): Promise<{ envelope: IncrementalBackupEnvelope; recoveryKey: string }> {
  if (input.password.length < 8) throw new Error('BACKUP_PASSWORD_MUST_BE_AT_LEAST_8_CHARACTERS');
  const previousChain = input.previousChain?.length ? input.previousChain : input.previous ? [input.previous] : [];
  const previousSnapshot = previousChain.at(-1) ?? null;
  if (input.resume && (input.resume.ownerId !== input.ownerId || input.resume.baseBackupId !== (previousSnapshot?.manifest.backupId ?? null))) {
    throw new Error('BACKUP_RESUME_CHECKPOINT_SCOPE_MISMATCH');
  }
  const backupId = `backup-${Date.now()}-${hashText(input.ownerId)}`; const salt = randomBytes(16); const passwordKey = await derivePasswordKey(input.password, salt); const recoveryKeyBytes = input.resume?.recoveryKey ? base64ToBytes(input.resume.recoveryKey) : input.recoveryKey ? base64ToBytes(input.recoveryKey) : randomBytes(32); const recoveryKey = bytesToBase64(recoveryKeyBytes);
  const keyCheck = encryptJson({ backupId, check: 'easyseas' }, passwordKey); const previousHashes = new Map<string, string>();
  previousChain.forEach((snapshot) => snapshot.records.forEach((record) => { const key = `${record.dataset}:${record.recordId}`; if (record.operation === 'delete') previousHashes.delete(key); else previousHashes.set(key, record.contentHash); }));
  const records: BackupDatasetRecord[] = [...(input.resume?.records ?? [])]; const datasetSummary: IncrementalBackupManifest['datasets'] = [...(input.resume?.datasetSummary ?? [])];
  const completedDatasets = new Set(input.resume?.completedDatasets ?? []);
  const checkpoint = (): BackupResumeCheckpoint => ({
    ownerId: input.ownerId,
    baseBackupId: previousSnapshot?.manifest.backupId ?? null,
    recoveryKey,
    completedDatasets: Array.from(completedDatasets),
    records: [...records],
    datasetSummary: [...datasetSummary],
  });
  const throwIfCancelled = () => {
    if (input.signal?.aborted) throw new BackupCancelledError(checkpoint());
  };
  throwIfCancelled();
  for (const [dataset, datasetRecords] of Object.entries(input.datasets)) {
    if (completedDatasets.has(dataset)) {
      const retained = datasetSummary.find((row) => row.name === dataset);
      if (!retained || retained.contentHash !== datasetContentHash(datasetRecords)) throw new Error('BACKUP_RESUME_DATASET_CHANGED');
      input.onProgress?.(dataset, Object.keys(datasetRecords).length, Object.keys(datasetRecords).length);
      continue;
    }
    throwIfCancelled();
    const pendingRecords: BackupDatasetRecord[] = [];
    const previousIds = new Set([...previousHashes.keys()].filter((key) => key.startsWith(`${dataset}:`)).map((key) => key.slice(dataset.length + 1))); let adds = 0, updates = 0, deletes = 0, preserved = 0; let processed = 0;
    for (const [recordId, value] of Object.entries(datasetRecords)) { const serialized = stableJson(value); const largeRecord = serialized.length > 250_000; if (largeRecord) await yieldToUi(); throwIfCancelled(); const contentHash = hashText(serialized); const previousHash = previousHashes.get(`${dataset}:${recordId}`); if (previousHash === contentHash) preserved += 1; else { const operation: BackupOperation = previousHash ? 'update' : 'add'; operation === 'add' ? adds += 1 : updates += 1; pendingRecords.push({ dataset, recordId, operation, contentHash, encryptedChunk: encryptJson({ value }, recoveryKeyBytes) }); } previousIds.delete(recordId); processed += 1; if (largeRecord || processed % 100 === 0) { input.onProgress?.(dataset, processed, Object.keys(datasetRecords).length); await yieldToUi(); throwIfCancelled(); } }
    previousIds.forEach((recordId) => { deletes += 1; pendingRecords.push({ dataset, recordId, operation: 'delete', contentHash: hashText('deleted'), encryptedChunk: encryptJson({ deleted: true }, recoveryKeyBytes) }); });
    const contentHash = datasetContentHash(datasetRecords); records.push(...pendingRecords); datasetSummary.push({ name: dataset, adds, updates, deletes, preserved, contentHash }); completedDatasets.add(dataset); input.onProgress?.(dataset, processed, Object.keys(datasetRecords).length); input.onCheckpoint?.(checkpoint()); await yieldToUi(); throwIfCancelled();
  }
  const createdAt = new Date().toISOString(); const manifest: IncrementalBackupManifest = { format: INCREMENTAL_BACKUP_FORMAT, backupId, ownerId: input.ownerId, schemaVersion: HEALTH_TRUST_SCHEMA_VERSION, appVersion: input.appVersion, createdAt, kind: previousSnapshot ? 'incremental' : 'full', baseBackupId: previousSnapshot?.manifest.backupId ?? null, encryption: { algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt), keyCheck }, datasets: datasetSummary, recordCount: records.length, contentHash: hashText(datasetSummary.map((row) => `${row.name}:${row.contentHash}`).join('|')), includes: ['certificate documents', 'crew recognition', 'profiles', 'casino history', 'loyalty', 'user preferences', 'experience preferences', 'provenance', 'offer-sailing relationships', 'Agent SEA source manifests and rebuildable caches'] };
  const passwordWrappedRecovery = encryptJson({ recoveryKey }, passwordKey); manifest.encryption.keyCheck = JSON.stringify({ check: keyCheck, recovery: passwordWrappedRecovery });
  const db = await getHealthTrustDatabase(); await db.withTransactionAsync(async () => { await db.runAsync('INSERT INTO backup_manifests(id,owner_id,schema_version,base_backup_id,created_at,kind,state,dataset_count,record_count,content_hash,encryption,file_uri) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)', [backupId, input.ownerId, manifest.schemaVersion, manifest.baseBackupId, createdAt, manifest.kind, 'complete', datasetSummary.length, records.length, manifest.contentHash, manifest.encryption.algorithm]); for (const row of records) await db.runAsync('INSERT INTO backup_dataset_entries(backup_id,dataset,record_id,operation,content_hash,encrypted_chunk) VALUES(?,?,?,?,?,?)', [backupId, row.dataset, row.recordId, row.operation, row.contentHash, row.encryptedChunk]); });
  return { envelope: { manifest, records }, recoveryKey };
}

async function resolveBackupKey(envelope: IncrementalBackupEnvelope, credential: string, recoveryKey = false): Promise<string> { if (recoveryKey) return base64ToBytes(credential); const wrapper = JSON.parse(envelope.manifest.encryption.keyCheck) as { check: string; recovery: string }; const key = await derivePasswordKey(credential, base64ToBytes(envelope.manifest.encryption.salt)); const check = decryptJson<{ backupId: string; check: string }>(wrapper.check, key); if (check.backupId !== envelope.manifest.backupId || check.check !== 'easyseas') throw new Error('BACKUP_CREDENTIAL_INVALID'); return base64ToBytes(decryptJson<{ recoveryKey: string }>(wrapper.recovery, key).recoveryKey); }
export async function decryptBackupDatasets(envelope: IncrementalBackupEnvelope, credential: string, credentialType: 'password' | 'recovery-key' = 'password', base: BackupDatasetMap = {}, onProgress?: (processed: number, total: number) => void, signal?: { readonly aborted: boolean }): Promise<BackupDatasetMap> { if (envelope.manifest.format !== INCREMENTAL_BACKUP_FORMAT) throw new Error('UNSUPPORTED_BACKUP_FORMAT'); if (signal?.aborted) throw new Error('RESTORE_CANCELLED'); const key = await resolveBackupKey(envelope, credential, credentialType === 'recovery-key'); const output: BackupDatasetMap = Object.fromEntries(Object.entries(base).map(([name, rows]) => [name, { ...rows }])); for (let index = 0; index < envelope.records.length; index += 1) { if (signal?.aborted) throw new Error('RESTORE_CANCELLED'); const record = envelope.records[index]; const largeRecord = record.encryptedChunk.length > 250_000; if (largeRecord) await yieldToUi(); output[record.dataset] = output[record.dataset] ?? {}; if (record.operation === 'delete') delete output[record.dataset][record.recordId]; else output[record.dataset][record.recordId] = decryptJson<{ value: unknown }>(record.encryptedChunk, key).value; if (largeRecord || index % 100 === 0) { onProgress?.(index + 1, envelope.records.length); await yieldToUi(); if (signal?.aborted) throw new Error('RESTORE_CANCELLED'); } } onProgress?.(envelope.records.length, envelope.records.length); return output; }

export function previewBackupDatasetMap(currentMap: BackupDatasetMap, incoming: BackupDatasetMap, backupId: string): RestorePreview { const rows: RestorePreviewRow[] = []; const conflicts: RestorePreview['conflicts'] = []; for (const dataset of new Set([...Object.keys(currentMap), ...Object.keys(incoming)])) { const current = currentMap[dataset] ?? {}, next = incoming[dataset] ?? {}; let add = 0, update = 0, preserve = 0, conflict = 0, reject = 0, deleted = 0; for (const [recordId, value] of Object.entries(next)) { if (!(recordId in current)) add += 1; else if (stableJson(current[recordId]) === stableJson(value)) preserve += 1; else { update += 1; conflict += 1; conflicts.push({ dataset, recordId, reason: 'The backup and current app contain different values. Current data is preserved until the user chooses a resolution.' }); } } for (const recordId of Object.keys(current)) if (!(recordId in next)) deleted += 1; rows.push({ dataset, add, update, preserve, conflict, reject, delete: deleted }); } const totals = rows.reduce((sum, row) => ({ add: sum.add + row.add, update: sum.update + row.update, preserve: sum.preserve + row.preserve, conflict: sum.conflict + row.conflict, reject: sum.reject + row.reject, delete: sum.delete + row.delete }), { add: 0, update: 0, preserve: 0, conflict: 0, reject: 0, delete: 0 }); return { backupId, rows, totals, requiresConfirmation: true, conflicts }; }
export async function previewEncryptedRestore(input: { envelope: IncrementalBackupEnvelope; credential: string; credentialType?: 'password' | 'recovery-key'; current: BackupDatasetMap; base?: BackupDatasetMap }): Promise<RestorePreview> { const incoming = await decryptBackupDatasets(input.envelope, input.credential, input.credentialType, input.base); return previewBackupDatasetMap(input.current, incoming, input.envelope.manifest.backupId); }

export function serializeEncryptedBackup(envelope: IncrementalBackupEnvelope): string { return JSON.stringify(envelope); }
export function validateIncrementalBackupEnvelope(value: unknown): IncrementalBackupEnvelope {
  const envelope = value as IncrementalBackupEnvelope;
  if (!envelope || typeof envelope !== 'object' || envelope.manifest?.format !== INCREMENTAL_BACKUP_FORMAT || !Array.isArray(envelope.records)) throw new Error('INVALID_EASYSEAS_INCREMENTAL_BACKUP');
  if (!envelope.manifest.backupId || !envelope.manifest.ownerId || !envelope.manifest.encryption?.keyCheck || envelope.manifest.encryption.algorithm !== 'AES-256-GCM') throw new Error('INVALID_EASYSEAS_BACKUP_MANIFEST');
  if (envelope.manifest.recordCount !== envelope.records.length || !Array.isArray(envelope.manifest.datasets)) throw new Error('EASYSEAS_BACKUP_RECORD_COUNT_MISMATCH');
  const identities = new Set<string>();
  for (const record of envelope.records) {
    if (!record || typeof record.dataset !== 'string' || !record.dataset || typeof record.recordId !== 'string' || !record.recordId || !['add', 'update', 'delete'].includes(record.operation) || typeof record.contentHash !== 'string' || typeof record.encryptedChunk !== 'string' || !record.encryptedChunk) throw new Error('INVALID_EASYSEAS_BACKUP_RECORD');
    const identity = `${record.dataset}\u0000${record.recordId}`;
    if (identities.has(identity)) throw new Error('DUPLICATE_EASYSEAS_BACKUP_RECORD');
    identities.add(identity);
  }
  return envelope;
}
export function parseEncryptedBackup(raw: string): IncrementalBackupEnvelope { try { return validateIncrementalBackupEnvelope(JSON.parse(raw)); } catch (error) { if (error instanceof SyntaxError) throw new Error('TRUNCATED_OR_INVALID_EASYSEAS_BACKUP'); throw error; } }
export function serializeBackupArchive(chain: IncrementalBackupEnvelope[]): string { if (!chain.length || chain[0].manifest.kind !== 'full') throw new Error('BACKUP_CHAIN_REQUIRES_FULL_BASE'); return JSON.stringify({ format: 'easyseas-incremental-chain-v1', chain } satisfies IncrementalBackupArchive); }
export function parseBackupArchive(raw: string): IncrementalBackupArchive { try { const value = JSON.parse(raw) as IncrementalBackupArchive; if (value?.format !== 'easyseas-incremental-chain-v1' || !Array.isArray(value.chain) || !value.chain.length || value.chain[0].manifest.kind !== 'full') throw new Error('INVALID_EASYSEAS_BACKUP_CHAIN'); value.chain.forEach(validateIncrementalBackupEnvelope); for (let index = 1; index < value.chain.length; index += 1) if (value.chain[index].manifest.baseBackupId !== value.chain[index - 1].manifest.backupId) throw new Error('BROKEN_EASYSEAS_BACKUP_CHAIN'); return value; } catch (error) { if (error instanceof SyntaxError) throw new Error('TRUNCATED_OR_INVALID_EASYSEAS_BACKUP'); throw error; } }
export async function decryptBackupArchive(archive: IncrementalBackupArchive, credential: string, credentialType: 'password' | 'recovery-key' = 'password', onProgress?: (backup: number, total: number) => void, signal?: { readonly aborted: boolean }): Promise<BackupDatasetMap> { let datasets: BackupDatasetMap = {}; for (let index = 0; index < archive.chain.length; index += 1) { if (signal?.aborted) throw new Error('RESTORE_CANCELLED'); datasets = await decryptBackupDatasets(archive.chain[index], credential, credentialType, datasets, undefined, signal); onProgress?.(index + 1, archive.chain.length); await yieldToUi(); } return datasets; }

function values<T>(map: BackupDatasetMap, key: string): T[] { return Object.values(map[key] ?? {}) as T[]; }
export function mergeRestoreDatasets(current: BackupDatasetMap, incoming: BackupDatasetMap, conflictResolution: 'preserve-current' | 'use-backup' = 'preserve-current'): BackupDatasetMap {
  const output: BackupDatasetMap = {};
  for (const dataset of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
    output[dataset] = { ...(incoming[dataset] ?? {}), ...(conflictResolution === 'preserve-current' ? current[dataset] ?? {} : {}) };
    if (conflictResolution === 'use-backup') output[dataset] = { ...(current[dataset] ?? {}), ...(incoming[dataset] ?? {}) };
  }
  return output;
}

export function compareRestoreReadback(expected: BackupDatasetMap, actual: BackupDatasetMap): RestoreReadbackReport {
  const rows: RestoreReadbackRow[] = [];
  for (const dataset of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const expectedRows = expected[dataset] ?? {};
    const actualRows = actual[dataset] ?? {};
    let missing = 0;
    let mismatched = 0;
    for (const [recordId, value] of Object.entries(expectedRows)) {
      if (!(recordId in actualRows)) missing += 1;
      else if (stableJson(value) !== stableJson(actualRows[recordId])) mismatched += 1;
    }
    rows.push({ dataset, expected: Object.keys(expectedRows).length, actual: Object.keys(actualRows).length, missing, mismatched });
  }
  const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
  const actualTotal = rows.reduce((sum, row) => sum + row.actual, 0);
  return { exact: rows.every((row) => row.expected === row.actual && row.missing === 0 && row.mismatched === 0), rows, expectedTotal, actualTotal };
}

export function restoreBundleFromDatasetMap(base: FullAppDataBundle, map: BackupDatasetMap): FullAppDataBundle {
  const casinoData = (map.casinoHistory?.casinoData ?? base.casinoData) as FullAppDataBundle['casinoData'];
  const loyalty = map.loyalty ?? {};
  return {
    ...base,
    version: base.version,
    exportDate: new Date().toISOString(),
    cruises: values(map, 'cruises'), bookedCruises: values(map, 'bookedCruises'), casinoOffers: values(map, 'casinoOffers'), calendarEvents: values(map, 'calendarEvents'), casinoSessions: values(map, 'casinoSessions'), certificates: values(map, 'certificates'), certificateDocuments: values(map, 'certificateDocuments'), users: values(map, 'users'),
    crewRecognition: { entries: values(map, 'crewRecognition'), sailings: values(map, 'crewSailings') },
    machines: { encyclopedia: values(map, 'machineEncyclopedia'), atlasIds: values<{ id: string }>(map, 'savedAtlasMachines').map((row) => row.id), userMachines: values(map, 'customSlotMachines'), deckLocations: values(map, 'deckPlanLocations') },
    casinoData, userProfile: (map.profile?.current ?? base.userProfile) as FullAppDataBundle['userProfile'], settings: (map.settings?.app ?? base.settings) as FullAppDataBundle['settings'],
    loyaltyData: (loyalty.points ?? base.loyaltyData) as FullAppDataBundle['loyaltyData'], extendedLoyaltyData: (loyalty.extended ?? base.extendedLoyaltyData) as FullAppDataBundle['extendedLoyaltyData'], clubRoyaleProfile: (loyalty.clubRoyale ?? base.clubRoyaleProfile) as FullAppDataBundle['clubRoyaleProfile'], playingHours: (map.playingHours?.current ?? base.playingHours) as FullAppDataBundle['playingHours'],
    agentSeaSourceManifest: (map.sourceManifests?.agentSea ?? base.agentSeaSourceManifest) as FullAppDataBundle['agentSeaSourceManifest'],
    provenanceLinks: values(map, 'provenance') as FullAppDataBundle['provenanceLinks'],
    userPreferences: map.userPreferences ?? base.userPreferences,
  };
}
