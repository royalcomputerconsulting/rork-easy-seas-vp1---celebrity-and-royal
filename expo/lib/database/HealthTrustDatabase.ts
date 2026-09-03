import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { ProvenanceLink } from '@/types/provenance';

const DATABASE_NAME = 'easyseas-health-trust.db';
export const HEALTH_TRUST_SCHEMA_VERSION = 6;
type Database = SQLite.SQLiteDatabase;

export interface MigrationDiagnostic { version: number; name: string; state: 'started' | 'complete' | 'failed'; startedAt: string; completedAt?: string | null; error?: string | null; }
export interface DomainMigrationDiagnostic { id: string; ownerId: string; domain: string; sourceKey: string; state: 'running' | 'complete' | 'failed' | 'rolled_back'; lastIndex: number; totalRows: number; sourceHash?: string | null; updatedAt: string; error?: string | null; }
export interface DomainRecordRow { ownerId: string; domain: string; recordId: string; recordJson: string; sourceStorageKey?: string | null; sourceHash?: string | null; updatedAt: string; }

const migrations: Array<{ version: number; name: string; sql: string }> = [
  { version: 1, name: 'core-domain-records', sql: `
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,state TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT,error TEXT);
    CREATE TABLE IF NOT EXISTS migration_checkpoints(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,domain TEXT NOT NULL,source_key TEXT NOT NULL,state TEXT NOT NULL,last_index INTEGER NOT NULL DEFAULT 0,total_rows INTEGER NOT NULL DEFAULT 0,source_hash TEXT,started_at TEXT NOT NULL,updated_at TEXT NOT NULL,error TEXT);
    CREATE INDEX IF NOT EXISTS idx_migration_checkpoint_owner ON migration_checkpoints(owner_id,state);
    CREATE TABLE IF NOT EXISTS domain_records(owner_id TEXT NOT NULL,domain TEXT NOT NULL,record_id TEXT NOT NULL,record_json TEXT NOT NULL,source_storage_key TEXT,source_hash TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,domain,record_id));
    CREATE INDEX IF NOT EXISTS idx_domain_records_owner_domain ON domain_records(owner_id,domain,updated_at DESC);
  ` },
  { version: 2, name: 'universal-provenance', sql: `
    CREATE TABLE IF NOT EXISTS provenance_links(id TEXT PRIMARY KEY,owner_id TEXT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,field_name TEXT NOT NULL,source_type TEXT NOT NULL,observed_at TEXT NOT NULL,confidence TEXT NOT NULL,source_record TEXT NOT NULL,formula TEXT,source_hash TEXT,parent_ids_json TEXT,provider TEXT,notes TEXT,is_derived INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS idx_provenance_entity ON provenance_links(owner_id,entity_type,entity_id,field_name,observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_provenance_source ON provenance_links(source_type,confidence);
  ` },
  { version: 3, name: 'integrity-and-repair', sql: `
    CREATE TABLE IF NOT EXISTS integrity_issues(id TEXT PRIMARY KEY,owner_id TEXT,severity TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,entity_type TEXT,entity_ids_json TEXT NOT NULL,evidence_json TEXT NOT NULL,repair_kind TEXT,repair_payload_json TEXT,ambiguous INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL,detected_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_integrity_owner_state ON integrity_issues(owner_id,state,severity,detected_at DESC);
    CREATE TABLE IF NOT EXISTS repair_history(id TEXT PRIMARY KEY,issue_id TEXT NOT NULL,owner_id TEXT,repair_kind TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,confirmed_at TEXT NOT NULL,result TEXT NOT NULL,error TEXT,FOREIGN KEY(issue_id) REFERENCES integrity_issues(id));
    CREATE INDEX IF NOT EXISTS idx_repair_history_owner ON repair_history(owner_id,confirmed_at DESC);
  ` },
  { version: 4, name: 'incremental-backup-manifests', sql: `
    CREATE TABLE IF NOT EXISTS backup_manifests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,schema_version INTEGER NOT NULL,base_backup_id TEXT,created_at TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,dataset_count INTEGER NOT NULL,record_count INTEGER NOT NULL,content_hash TEXT NOT NULL,encryption TEXT NOT NULL,file_uri TEXT,FOREIGN KEY(base_backup_id) REFERENCES backup_manifests(id));
    CREATE INDEX IF NOT EXISTS idx_backup_owner_created ON backup_manifests(owner_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS backup_dataset_entries(backup_id TEXT NOT NULL,dataset TEXT NOT NULL,record_id TEXT NOT NULL,operation TEXT NOT NULL,content_hash TEXT NOT NULL,encrypted_chunk TEXT NOT NULL,PRIMARY KEY(backup_id,dataset,record_id),FOREIGN KEY(backup_id) REFERENCES backup_manifests(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_backup_entries_dataset ON backup_dataset_entries(backup_id,dataset,operation);
  ` },
  { version: 5, name: 'integrity-quarantine-and-history', sql: `
    CREATE TABLE IF NOT EXISTS integrity_quarantine(
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      owner_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      repair_kind TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      quarantined_at TEXT NOT NULL,
      restored_at TEXT,
      FOREIGN KEY(issue_id) REFERENCES integrity_issues(id)
    );
    CREATE INDEX IF NOT EXISTS idx_integrity_quarantine_owner ON integrity_quarantine(owner_id,restored_at,quarantined_at DESC);
    CREATE INDEX IF NOT EXISTS idx_integrity_quarantine_issue ON integrity_quarantine(issue_id,restored_at);
  ` },
  { version: 6, name: 'migration-rollback-audit', sql: `
    CREATE TABLE IF NOT EXISTS migration_rollback_history(
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      source_key TEXT NOT NULL,
      source_hash TEXT,
      removed_rows INTEGER NOT NULL,
      rolled_back_at TEXT NOT NULL,
      reason TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_migration_rollback_owner ON migration_rollback_history(owner_id,rolled_back_at DESC);
  ` },
];

let databasePromise: Promise<Database> | null = null;
let databaseWriteTail: Promise<void> = Promise.resolve();

/**
 * Every writer that targets easyseas-health-trust.db passes through this one
 * queue. Provider sync, background persistence, provenance, integrity scans,
 * migrations, and backup publication can all run from different React trees;
 * serializing here prevents two callers from beginning transactions on the
 * same native SQLite connection at once.
 */
export function enqueueHealthTrustWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = databaseWriteTail.then(task, task);
  databaseWriteTail = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Native iOS/Android writes use an exclusive transaction handle, so every SQL
 * statement belongs to the intended transaction even while the callback is
 * awaiting. Web retains the supported ordinary transaction API; the shared
 * queue still guarantees one application writer at a time on that platform.
 */
export async function withHealthTrustWriteTransaction<T>(
  task: (transaction: Database) => Promise<T>,
): Promise<T> {
  return enqueueHealthTrustWrite(async () => {
    const db = await getHealthTrustDatabase();
    if (Platform.OS !== 'web' && typeof db.withExclusiveTransactionAsync === 'function') {
      let result!: T;
      await db.withExclusiveTransactionAsync(async (transaction) => {
        result = await task(transaction as unknown as Database);
      });
      return result;
    }
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
    return result;
  });
}

async function runMigrations(db: Database): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,state TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT,error TEXT);');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = Number(row?.user_version ?? 0);
  for (const migration of migrations.filter((entry) => entry.version > currentVersion)) {
    const startedAt = new Date().toISOString();
    await db.runAsync('INSERT OR REPLACE INTO schema_migrations(version,name,state,started_at,completed_at,error) VALUES(?,?,?,?,NULL,NULL)', [migration.version, migration.name, 'started', startedAt]);
    try {
      await db.withTransactionAsync(async () => { await db.execAsync(migration.sql); await db.execAsync(`PRAGMA user_version=${migration.version};`); });
      await db.runAsync('UPDATE schema_migrations SET state=?,completed_at=? WHERE version=?', ['complete', new Date().toISOString(), migration.version]);
      currentVersion = migration.version;
    } catch (error) {
      await db.runAsync('UPDATE schema_migrations SET state=?,completed_at=?,error=? WHERE version=?', ['failed', new Date().toISOString(), error instanceof Error ? error.message : String(error), migration.version]).catch(() => undefined);
      throw error;
    }
  }
}

export async function getHealthTrustDatabase(): Promise<Database> {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => { await runMigrations(db); return db; }).catch((error) => { databasePromise = null; throw error; });
  return databasePromise;
}

export async function getMigrationDiagnostics(): Promise<MigrationDiagnostic[]> {
  const db = await getHealthTrustDatabase();
  const rows = await db.getAllAsync<any>('SELECT version,name,state,started_at,completed_at,error FROM schema_migrations ORDER BY version');
  return rows.map((row) => ({ version: row.version, name: row.name, state: row.state, startedAt: row.started_at, completedAt: row.completed_at, error: row.error }));
}

export async function getDomainMigrationDiagnostics(ownerId: string): Promise<DomainMigrationDiagnostic[]> {
  const db = await getHealthTrustDatabase();
  const rows = await db.getAllAsync<any>('SELECT id,owner_id,domain,source_key,state,last_index,total_rows,source_hash,updated_at,error FROM migration_checkpoints WHERE owner_id=? ORDER BY updated_at DESC', [ownerId.toLowerCase().trim()]);
  return rows.map((row) => ({ id: row.id, ownerId: row.owner_id, domain: row.domain, sourceKey: row.source_key, state: row.state, lastIndex: Number(row.last_index ?? 0), totalRows: Number(row.total_rows ?? 0), sourceHash: row.source_hash, updatedAt: row.updated_at, error: row.error }));
}

export async function upsertDomainRecords(rows: DomainRecordRow[]): Promise<void> {
  if (!rows.length) return;
  await withHealthTrustWriteTransaction(async (transaction) => {
    for (const row of rows) await transaction.runAsync('INSERT OR REPLACE INTO domain_records(owner_id,domain,record_id,record_json,source_storage_key,source_hash,updated_at) VALUES(?,?,?,?,?,?,?)', [row.ownerId, row.domain, row.recordId, row.recordJson, row.sourceStorageKey ?? null, row.sourceHash ?? null, row.updatedAt]);
  });
}

export async function replaceDomainRecords(ownerId: string, domain: string, rows: DomainRecordRow[]): Promise<void> {
  await withHealthTrustWriteTransaction(async (transaction) => {
    await transaction.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain=?', [ownerId, domain]);
    for (const row of rows) {
      await transaction.runAsync(
        'INSERT INTO domain_records(owner_id,domain,record_id,record_json,source_storage_key,source_hash,updated_at) VALUES(?,?,?,?,?,?,?)',
        [row.ownerId, row.domain, row.recordId, row.recordJson, row.sourceStorageKey ?? null, row.sourceHash ?? null, row.updatedAt],
      );
    }
  });
}

export async function deleteDomainRecord(ownerId: string, domain: string, recordId: string): Promise<void> {
  await enqueueHealthTrustWrite(async () => {
    const db = await getHealthTrustDatabase();
    await db.runAsync('DELETE FROM domain_records WHERE owner_id=? AND domain=? AND record_id=?', [ownerId, domain, recordId]);
  });
}

export async function listDomainRecords<T>(ownerId: string, domain: string, limit = 100, offset = 0): Promise<T[]> {
  const db = await getHealthTrustDatabase();
  const rows = await db.getAllAsync<{ record_json: string }>('SELECT record_json FROM domain_records WHERE owner_id=? AND domain=? ORDER BY updated_at DESC,record_id LIMIT ? OFFSET ?', [ownerId, domain, Math.max(1, Math.min(500, limit)), Math.max(0, offset)]);
  return rows.flatMap((row) => { try { return [JSON.parse(row.record_json) as T]; } catch { return []; } });
}

export async function countDomainRecords(ownerId: string, domain: string): Promise<number> {
  const db = await getHealthTrustDatabase();
  return Number((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM domain_records WHERE owner_id=? AND domain=?', [ownerId, domain]))?.count ?? 0);
}

function escapedLikeSearch(search: string): string {
  return `%${search.trim().toLowerCase().replace(/[\\%_]/g, (value) => `\\${value}`)}%`;
}

/**
 * Paged repository query used by large list screens. Search stays inside
 * SQLite so opening a filter sheet does not first materialize every JSON row
 * in Hermes. The escaped LIKE expression treats user-entered %, _, and \\ as
 * literal characters.
 */
export async function listDomainRecordsFiltered<T>(
  ownerId: string,
  domain: string,
  options?: { limit?: number; offset?: number; search?: string },
): Promise<T[]> {
  const db = await getHealthTrustDatabase();
  const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
  const offset = Math.max(0, options?.offset ?? 0);
  const search = options?.search?.trim();
  const rows = search
    ? await db.getAllAsync<{ record_json: string }>(
      "SELECT record_json FROM domain_records WHERE owner_id=? AND domain=? AND lower(record_json) LIKE ? ESCAPE '\\' ORDER BY updated_at DESC,record_id LIMIT ? OFFSET ?",
      [ownerId, domain, escapedLikeSearch(search), limit, offset],
    )
    : await db.getAllAsync<{ record_json: string }>(
      'SELECT record_json FROM domain_records WHERE owner_id=? AND domain=? ORDER BY updated_at DESC,record_id LIMIT ? OFFSET ?',
      [ownerId, domain, limit, offset],
    );
  return rows.flatMap((row) => {
    try { return [JSON.parse(row.record_json) as T]; } catch { return []; }
  });
}

export async function countDomainRecordsFiltered(ownerId: string, domain: string, search?: string): Promise<number> {
  const db = await getHealthTrustDatabase();
  const normalizedSearch = search?.trim();
  const row = normalizedSearch
    ? await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM domain_records WHERE owner_id=? AND domain=? AND lower(record_json) LIKE ? ESCAPE '\\'",
      [ownerId, domain, escapedLikeSearch(normalizedSearch)],
    )
    : await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM domain_records WHERE owner_id=? AND domain=?',
      [ownerId, domain],
    );
  return Number(row?.count ?? 0);
}

export async function listAllDomainRecords<T>(ownerId: string, domain: string, pageSize = 500): Promise<T[]> {
  const total = await countDomainRecords(ownerId, domain);
  const rows: T[] = [];
  const size = Math.max(1, Math.min(500, pageSize));
  for (let offset = 0; offset < total; offset += size) {
    rows.push(...await listDomainRecords<T>(ownerId, domain, size, offset));
    if (offset + size < total) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return rows;
}

/**
 * Reads every profile partition that belongs to one authenticated account.
 * The prefix is matched literally with substr instead of LIKE so email
 * addresses containing SQL wildcard characters cannot broaden the query.
 */
export async function listAllDomainRecordsByOwnerPrefix<T>(ownerPrefix: string, domain: string, pageSize = 500): Promise<T[]> {
  const db = await getHealthTrustDatabase();
  const size = Math.max(1, Math.min(500, pageSize));
  const prefixLength = ownerPrefix.length;
  const total = Number((await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM domain_records WHERE substr(owner_id,1,?)=? AND domain=?',
    [prefixLength, ownerPrefix, domain],
  ))?.count ?? 0);
  const records: T[] = [];
  for (let offset = 0; offset < total; offset += size) {
    const rows = await db.getAllAsync<{ record_json: string }>(
      'SELECT record_json FROM domain_records WHERE substr(owner_id,1,?)=? AND domain=? ORDER BY owner_id,updated_at DESC,record_id LIMIT ? OFFSET ?',
      [prefixLength, ownerPrefix, domain, size, offset],
    );
    rows.forEach((row) => {
      try { records.push(JSON.parse(row.record_json) as T); } catch { /* Ignore one malformed row without losing the remaining backup. */ }
    });
    if (offset + size < total) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return records;
}

export async function storeProvenanceLinks(links: ProvenanceLink[]): Promise<void> {
  if (!links.length) return;
  for (let offset = 0; offset < links.length; offset += 250) {
    const batch = links.slice(offset, offset + 250);
    await withHealthTrustWriteTransaction(async (transaction) => {
      for (const link of batch) await transaction.runAsync(`INSERT OR REPLACE INTO provenance_links(id,owner_id,entity_type,entity_id,field_name,source_type,observed_at,confidence,source_record,formula,source_hash,parent_ids_json,provider,notes,is_derived) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [link.id, link.ownerId, link.entityType, link.entityId, link.field, link.sourceType, link.observedAt, link.confidence, link.sourceRecord, link.formula ?? null, link.sourceHash ?? null, JSON.stringify(link.parentProvenanceIds ?? []), link.provider ?? null, link.notes ?? null, link.isDerived ? 1 : 0]);
    });
    if (offset + batch.length < links.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export async function listProvenanceLinks(ownerId: string | null, entityType: string, entityId: string, field?: string): Promise<ProvenanceLink[]> {
  const db = await getHealthTrustDatabase();
  const rows = field
    ? await db.getAllAsync<any>('SELECT * FROM provenance_links WHERE (owner_id=? OR owner_id IS NULL) AND entity_type=? AND entity_id=? AND field_name=? ORDER BY observed_at DESC', [ownerId, entityType, entityId, field])
    : await db.getAllAsync<any>('SELECT * FROM provenance_links WHERE (owner_id=? OR owner_id IS NULL) AND entity_type=? AND entity_id=? ORDER BY field_name,observed_at DESC', [ownerId, entityType, entityId]);
  return rows.map((row) => ({ id: row.id, ownerId: row.owner_id, entityType: row.entity_type, entityId: row.entity_id, field: row.field_name, sourceType: row.source_type, observedAt: row.observed_at, confidence: row.confidence, sourceRecord: row.source_record, formula: row.formula, sourceHash: row.source_hash, parentProvenanceIds: JSON.parse(row.parent_ids_json || '[]'), provider: row.provider, notes: row.notes, isDerived: Boolean(row.is_derived) }));
}

export async function listAllProvenanceLinks(ownerId: string): Promise<ProvenanceLink[]> {
  const db = await getHealthTrustDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM provenance_links WHERE owner_id=? OR owner_id IS NULL ORDER BY observed_at DESC', [ownerId]);
  return rows.map((row) => ({ id: row.id, ownerId: row.owner_id, entityType: row.entity_type, entityId: row.entity_id, field: row.field_name, sourceType: row.source_type, observedAt: row.observed_at, confidence: row.confidence, sourceRecord: row.source_record, formula: row.formula, sourceHash: row.source_hash, parentProvenanceIds: JSON.parse(row.parent_ids_json || '[]'), provider: row.provider, notes: row.notes, isDerived: Boolean(row.is_derived) }));
}
