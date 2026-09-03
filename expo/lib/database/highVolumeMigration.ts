import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetItem } from '@/lib/storage/quotaSafeStorage';
import { getHealthTrustDatabase, upsertDomainRecords } from './HealthTrustDatabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HighVolumeDomain { domain: string; storageKey: string; storageAliases?: string[]; shared?: boolean; discoverProfileKeys?: boolean; legacyGlobal?: boolean; }
export interface MigrationRollbackResult { ownerId: string; domain: string; sourceKey: string; removedRows: number; restoredRows: number; auditId: string; }
export const HIGH_VOLUME_DOMAINS: HighVolumeDomain[] = [
  { domain: 'booked_cruises', storageKey: ALL_STORAGE_KEYS.BOOKED_CRUISES },
  // Offers and certificate records are shared by the primary/secondary
  // profiles inside one signed-in account, not between unrelated accounts.
  { domain: 'casino_offers', storageKey: ALL_STORAGE_KEYS.CASINO_OFFERS },
  { domain: 'calendar_events', storageKey: ALL_STORAGE_KEYS.CALENDAR_EVENTS },
  { domain: 'casino_sessions', storageKey: ALL_STORAGE_KEYS.CASINO_SESSIONS },
  { domain: 'certificates', storageKey: ALL_STORAGE_KEYS.CERTIFICATES },
  { domain: 'crew_recognition', storageKey: ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES, discoverProfileKeys: true },
  { domain: 'crew_sailings', storageKey: ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS, discoverProfileKeys: true },
  { domain: 'machine_encyclopedia', storageKey: ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA, storageAliases: ['easyseas_machine_encyclopedia_v2_262_only'], legacyGlobal: true },
  { domain: 'slot_atlas', storageKey: ALL_STORAGE_KEYS.MY_SLOT_ATLAS, storageAliases: ['easyseas_my_slot_atlas_v2_262_only'] },
];

export function hashText(value: string): string { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function records(value: unknown): unknown[] { if (Array.isArray(value)) return value; if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => ({ storageObjectKey: key, value: item })); return []; }
export function highVolumeRecordId(record: unknown, index: number): string { const value = record && typeof record === 'object' ? record as Record<string, unknown> : {}; return String(value.id ?? value.recordId ?? value.cruiseId ?? value.certificateCode ?? value.crewMemberId ?? value.storageObjectKey ?? `row-${index}-${hashText(JSON.stringify(record))}`); }

async function sourceKeys(ownerId: string, definition: HighVolumeDomain): Promise<string[]> {
  const bases = [definition.storageKey, ...(definition.storageAliases ?? [])];
  const normal = definition.shared
    ? bases
    : bases.flatMap((base) => definition.legacyGlobal ? [getUserScopedKey(base, ownerId), base] : [getUserScopedKey(base, ownerId)]);
  if (!definition.discoverProfileKeys) return normal;
  const suffix = `::${ownerId.toLowerCase().trim()}`; const all = await AsyncStorage.getAllKeys();
  return [...new Set([...normal, ...all.filter((storageKey) => bases.some((base) => storageKey.startsWith(`${base}::profile::`)) && storageKey.toLowerCase().endsWith(suffix))])];
}

async function migrateSource(ownerId: string, definition: HighVolumeDomain, sourceKey: string, onProgress?: (processed: number, total: number) => void): Promise<{ migrated: number; skipped: boolean }> {
  // Resolve pointer-backed values as well as inline values. Large cruise,
  // certificate, and crew collections are commonly stored outside AsyncStorage.
  const raw = await quotaSafeGetItem(sourceKey);
  if (!raw) return { migrated: 0, skipped: true };
  const sourceHash = hashText(raw); const checkpointId = `${ownerId}:${definition.domain}:${sourceHash}`; const db = await getHealthTrustDatabase();
  const effectiveOwner = definition.shared ? '__shared__' : ownerId;
  const stagingDomain = `${definition.domain}::migration::${sourceHash}`;
  const rollbackDomain = `${definition.domain}::rollback::${sourceHash}`;
  const existing = await db.getFirstAsync<{ last_index: number; state: string }>('SELECT last_index,state FROM migration_checkpoints WHERE id=?', [checkpointId]);
  // A completed source hash is skipped before JSON parsing, keeping repeated
  // launches from materializing a large legacy collection just to re-check it.
  if (existing?.state === 'complete') return { migrated: 0, skipped: true };
  let parsed: unknown; try { parsed = JSON.parse(raw); } catch (error) { await db.runAsync('INSERT OR REPLACE INTO migration_checkpoints(id,owner_id,domain,source_key,state,last_index,total_rows,source_hash,started_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [checkpointId, ownerId, definition.domain, sourceKey, 'failed', 0, 0, sourceHash, new Date().toISOString(), new Date().toISOString(), error instanceof Error ? error.message : String(error)]); throw error; }
  const rows = records(parsed);
  const restartingRollback = existing?.state === 'rolled_back';
  const start = restartingRollback ? 0 : Math.max(0, Number(existing?.last_index ?? 0)); const timestamp = new Date().toISOString();
  if (!existing || restartingRollback) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain IN (?,?)', [effectiveOwner, stagingDomain, rollbackDomain]);
      await db.runAsync(`INSERT OR REPLACE INTO domain_records(owner_id,domain,record_id,record_json,source_storage_key,source_hash,updated_at)
        SELECT owner_id,?,record_id,record_json,source_storage_key,source_hash,updated_at FROM domain_records
        WHERE owner_id=? AND domain=? AND source_storage_key=?`, [rollbackDomain, effectiveOwner, definition.domain, sourceKey]);
    });
  }
  await db.runAsync('INSERT OR REPLACE INTO migration_checkpoints(id,owner_id,domain,source_key,state,last_index,total_rows,source_hash,started_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)', [checkpointId, ownerId, definition.domain, sourceKey, 'running', start, rows.length, sourceHash, timestamp, timestamp]);
  for (let offset = start; offset < rows.length; offset += 250) {
    // The database partition is the authenticated account. Profile ids remain
    // in each record payload so primary and secondary travelers can still be
    // filtered without allowing one signed-in account to read another one's
    // rows. Shared offer/certificate catalogs use the explicit shared scope.
    const batch = rows.slice(offset, offset + 250).map((record, index) => ({ ownerId: effectiveOwner, domain: stagingDomain, recordId: highVolumeRecordId(record, offset + index), recordJson: JSON.stringify(record), sourceStorageKey: sourceKey, sourceHash, updatedAt: new Date().toISOString() }));
    await upsertDomainRecords(batch); const processed = Math.min(rows.length, offset + batch.length);
    await db.runAsync('UPDATE migration_checkpoints SET last_index=?,updated_at=? WHERE id=?', [processed, new Date().toISOString(), checkpointId]); onProgress?.(processed, rows.length); await yieldToUi();
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain=? AND source_storage_key=?', [effectiveOwner, definition.domain, sourceKey]);
    await db.runAsync(`INSERT OR REPLACE INTO domain_records(owner_id,domain,record_id,record_json,source_storage_key,source_hash,updated_at)
      SELECT owner_id,?,record_id,record_json,source_storage_key,source_hash,updated_at FROM domain_records
      WHERE owner_id=? AND domain=?`, [definition.domain, effectiveOwner, stagingDomain]);
    await db.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain=?', [effectiveOwner, stagingDomain]);
    await db.runAsync('UPDATE migration_checkpoints SET state=?,last_index=?,updated_at=? WHERE id=?', ['complete', rows.length, new Date().toISOString(), checkpointId]);
  });
  return { migrated: rows.length, skipped: false };
}

export async function migrateHighVolumeDomain(ownerId: string, definition: HighVolumeDomain, onProgress?: (processed: number, total: number) => void): Promise<{ domain: string; migrated: number; sourceRetained: true; skipped: boolean }> {
  const keys = await sourceKeys(ownerId, definition); let migrated = 0; let skipped = true;
  for (const sourceKey of keys) { const result = await migrateSource(ownerId, definition, sourceKey, onProgress); migrated += result.migrated; skipped = skipped && result.skipped; }
  return { domain: definition.domain, migrated, sourceRetained: true, skipped };
}

export async function migrateAllHighVolumeDomains(ownerId: string, onProgress?: (domain: string, processed: number, total: number) => void, definitions: HighVolumeDomain[] = HIGH_VOLUME_DOMAINS) {
  const results = [];
  for (const definition of definitions) results.push(await migrateHighVolumeDomain(ownerId, definition, (processed, total) => onProgress?.(definition.domain, processed, total)));
  return results;
}

export async function rollbackHighVolumeMigration(ownerId: string, definition: HighVolumeDomain, sourceKey: string, reason = 'User requested rollback from migration diagnostics'): Promise<MigrationRollbackResult> {
  const normalizedOwner = ownerId.toLowerCase().trim();
  const effectiveOwner = definition.shared ? '__shared__' : normalizedOwner;
  const db = await getHealthTrustDatabase();
  const checkpoint = await db.getFirstAsync<{ id: string; source_hash: string | null }>('SELECT id,source_hash FROM migration_checkpoints WHERE owner_id=? AND domain=? AND source_key=? ORDER BY updated_at DESC LIMIT 1', [normalizedOwner, definition.domain, sourceKey]);
  if (!checkpoint) throw new Error('MIGRATION_ROLLBACK_CHECKPOINT_NOT_FOUND');
  const sourceHash = String(checkpoint.source_hash ?? '');
  const stagingDomain = `${definition.domain}::migration::${sourceHash}`;
  const rollbackDomain = `${definition.domain}::rollback::${sourceHash}`;
  const liveCount = Number((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM domain_records WHERE owner_id=? AND domain=? AND source_storage_key=? AND source_hash=?', [effectiveOwner, definition.domain, sourceKey, sourceHash]))?.count ?? 0);
  const rollbackCount = Number((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM domain_records WHERE owner_id=? AND domain=?', [effectiveOwner, rollbackDomain]))?.count ?? 0);
  const auditId = `migration-rollback:${checkpoint.id}:${Date.now()}`;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain=? AND source_storage_key=? AND source_hash=?', [effectiveOwner, definition.domain, sourceKey, sourceHash]);
    await db.runAsync(`INSERT OR REPLACE INTO domain_records(owner_id,domain,record_id,record_json,source_storage_key,source_hash,updated_at)
      SELECT owner_id,?,record_id,record_json,source_storage_key,source_hash,updated_at FROM domain_records
      WHERE owner_id=? AND domain=?`, [definition.domain, effectiveOwner, rollbackDomain]);
    await db.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain IN (?,?)', [effectiveOwner, stagingDomain, rollbackDomain]);
    await db.runAsync("UPDATE migration_checkpoints SET state='rolled_back',last_index=0,updated_at=?,error=? WHERE id=?", [new Date().toISOString(), reason, checkpoint.id]);
    await db.runAsync('INSERT INTO migration_rollback_history(id,owner_id,domain,source_key,source_hash,removed_rows,rolled_back_at,reason) VALUES(?,?,?,?,?,?,?,?)', [auditId, normalizedOwner, definition.domain, sourceKey, sourceHash || null, liveCount, new Date().toISOString(), reason]);
  });
  return { ownerId: normalizedOwner, domain: definition.domain, sourceKey, removedRows: liveCount, restoredRows: rollbackCount, auditId };
}
