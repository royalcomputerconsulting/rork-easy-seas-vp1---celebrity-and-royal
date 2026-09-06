import * as SQLite from 'expo-sqlite';
import type { Cruise } from '@/types/models';
import { beginPerformanceSpan, recordPerformanceCount } from '@/lib/performance/performanceDiagnostics';
import { getCanonicalCruiseCabinLabel } from '@/lib/cruiseRecordIntegrity';
import {
  getCanonicalCruiseInventoryKey,
  getCruiseInventoryOptionKey,
  getCruiseInventoryProvider,
  getCruiseInventorySourceIdentity,
  getCruiseOfferInstanceKey,
  selectCruiseInventoryProviderRows,
} from './cruiseCanonicalIdentity';

const DATABASE_NAME = 'easyseas-cruise-inventory.db';
const SCHEMA_VERSION = 3;
export const DEFAULT_CRUISE_PAGE_SIZE = 75;
export const MAX_CRUISE_PAGE_SIZE = 200;
export const DEFAULT_CRUISE_INGEST_BATCH_SIZE = 500;

type Database = SQLite.SQLiteDatabase;

export interface CruiseInventoryCursor {
  sailDate: string;
  canonicalKey: string;
  sortValue?: string | number;
}

export interface CruiseInventoryQuery {
  ownerScopeId?: string;
  providers?: string[];
  shipNames?: string[];
  departurePorts?: string[];
  destinations?: string[];
  destinationRegions?: string[];
  regionsOrDestinations?: string[];
  shipClasses?: string[];
  guestCounts?: number[];
  cabinTypes?: string[];
  offerLinked?: boolean;
  search?: string;
  searchAnyTerm?: boolean;
  minNights?: number;
  maxNights?: number;
  sailDateFrom?: string;
  sailDateTo?: string;
  cursor?: CruiseInventoryCursor | null;
  limit?: number;
  sortBy?: 'sailDate' | 'nights' | 'value';
  sortDirection?: 'asc' | 'desc';
}

export interface CruiseInventoryPage {
  rows: Cruise[];
  nextCursor: CruiseInventoryCursor | null;
  total: number;
  queryMs: number;
}

export interface CruiseOfferSailingQuery {
  ownerScopeId?: string;
  offerInstanceKey?: string;
  offerCode?: string;
  cursor?: CruiseInventoryCursor | null;
  limit?: number;
  sortBy?: 'sailDate' | 'nights' | 'value';
  sortDirection?: 'asc' | 'desc';
}

export interface CruiseOfferSailingSummary {
  total: number;
  cabinTypes: string[];
  guestCounts: number[];
  pointRequirements: number[];
  minimumRoomValue: number | null;
  maximumRoomValue: number | null;
  minimumNights: number | null;
  maximumNights: number | null;
}

export interface CruiseInventoryIdentityQuery {
  id?: string;
  offerOptionId?: string;
  sourceRecordId?: string;
  sourceIdentity?: string;
  offerInstanceKey?: string;
  shipName?: string;
  sailDate?: string;
  offerCode?: string;
}

export interface CruiseInventoryCounts {
  /** Queryable available cruise option rows. Offer/cabin/guest/B2B variants are intentionally retained. */
  total: number;
  /** Exact offer-to-sailing rows plus source rows that are not offer-linked. */
  sourceTotal: number;
  /** Exact offer-to-sailing eligibility relationships in active generations. */
  offerSailingRelationships: number;
  /** Unique canonical physical departures, reported separately from option rows. */
  physicalSailings?: number;
  byProvider: Record<string, number>;
  activeGenerationIds: string[];
}

export interface CruiseInventoryIntegrity {
  rawRows: number;
  canonicalRows: number;
  duplicatesMerged: number;
  rejectedRows: number;
  offerSailingRelationships: number;
  durableSourceRows: number;
  readbackRows: number;
  activeGenerations: number;
  reconciled: boolean;
}

export interface CruiseInventoryFacets {
  shipNames: string[];
  shipClasses: string[];
  guestCounts: number[];
  providers: string[];
  departurePorts: string[];
  destinations: string[];
}

export interface CruiseInventoryReconciliation {
  generationId: string;
  provider: string;
  rawRows: number;
  canonicalRows: number;
  duplicatesMerged: number;
  rejectedRows: number;
  offerSailingRelationships: number;
  persistedRows: number;
  readbackRows: number;
  retiredRows: number;
  state: 'staging' | 'active' | 'failed' | 'retired';
}

export type CruiseInventoryChangeKind = 'added' | 'changed' | 'removed' | 'rejected' | 'preserved';
export interface CruiseInventoryChange {
  generationId: string;
  provider: string;
  kind: CruiseInventoryChangeKind;
  recordKey: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  reason: string;
  createdAt: string;
}
export interface CruiseSyncReport {
  generationId: string;
  provider: string;
  startedAt: string;
  completedAt?: string | null;
  added: number;
  changed: number;
  removed: number;
  rejected: number;
  preserved: number;
  previousOfferSailings: number;
  nextOfferSailings: number;
  evidenceComplete: boolean;
}

export interface CruiseInventoryProgress {
  provider: string;
  generationId: string;
  processedRows: number;
  totalRows: number;
  canonicalRows: number;
  duplicatesMerged: number;
  rejectedRows: number;
}

export interface ReplaceCruiseInventoryOptions {
  ownerScopeId?: string;
  runId?: string;
  /**
   * Restrict a provider refresh to the named catalog scopes. Provider syncs
   * pass exactly one value here so a Royal refresh cannot retire/rebuild an
   * otherwise untouched Celebrity or Carnival generation. Omit for full
   * backup restores and migrations that intentionally replace every scope.
   */
  providersToReplace?: string[];
  batchSize?: number;
  onProgress?: (progress: CruiseInventoryProgress) => void;
  yieldBetweenBatches?: boolean;
  shouldAbort?: () => boolean;
}

interface CruiseRow {
  canonical_key: string;
  inventory_key?: string;
  sail_date: string;
  sort_value?: string | number;
  relevance_rank?: number;
  raw_json: string;
}

interface CountRow {
  count: number;
}

interface ProviderCountRow {
  provider: string;
  count: number;
}

interface GenerationRow {
  id: string;
  owner_scope: string;
  provider: string;
  expected_raw_rows: number;
  raw_rows: number;
  canonical_rows: number;
  duplicates_merged: number;
  rejected_rows: number;
  relationship_rows: number;
  state: CruiseInventoryReconciliation['state'];
}

interface PreparedCruiseRow {
  canonicalKey: string;
  provider: string;
  sourceIdentity: string;
  cruiseLine: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  valueAmount: number;
  departurePort: string;
  destination: string;
  destinationRegion: string;
  itineraryText: string;
  portsText: string;
  searchText: string;
  rawJson: string;
  offerInstanceKey: string | null;
  eligibilityKey: string | null;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ id: (value as { id?: unknown })?.id ?? '', validationStatus: 'quarantined' });
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function prepareCruiseRow(cruise: Cruise): PreparedCruiseRow | null {
  const canonicalKey = getCruiseInventoryOptionKey(cruise);
  if (!canonicalKey) return null;
  const provider = getCruiseInventoryProvider(cruise);
  const itineraryText = normalizeText(cruise.itineraryName)
    || (Array.isArray(cruise.itineraryRaw) ? cruise.itineraryRaw.join(' • ') : '')
    || (Array.isArray(cruise.itinerary) ? cruise.itinerary.map((day) => day.port).filter(Boolean).join(' • ') : '');
  const portsText = Array.isArray(cruise.ports) ? cruise.ports.filter(Boolean).join(' • ') : normalizeText(cruise.portsAndTimes);
  const shipName = normalizeText(cruise.shipName);
  const departurePort = normalizeText(cruise.departurePort);
  const destination = normalizeText(cruise.destination);
  const destinationRegion = normalizeText(cruise.destinationRegion);
  const shipClass = normalizeText((cruise as Cruise & { shipClassName?: string; vesselClass?: string }).shipClass)
    || normalizeText((cruise as Cruise & { shipClassName?: string }).shipClassName)
    || normalizeText((cruise as Cruise & { vesselClass?: string }).vesselClass);
  const offerInstanceKey = getCruiseOfferInstanceKey(cruise);
  const cabinLabel = getCanonicalCruiseCabinLabel(cruise) ?? '';
  const valueAmount = [
    cruise.totalValue,
    cruise.retailValue,
    cruise.compValue,
    cruise.offerValue,
    cruise.totalPrice,
    cruise.price,
  ].map(Number).find((value) => Number.isFinite(value) && value >= 0) ?? 0;
  return {
    canonicalKey,
    provider,
    sourceIdentity: getCruiseInventorySourceIdentity(cruise),
    cruiseLine: normalizeText(cruise.brand ?? cruise.cruiseSource ?? provider),
    shipName,
    sailDate: normalizeText(cruise.sailDate),
    returnDate: normalizeText(cruise.returnDate),
    nights: Number.isFinite(Number(cruise.nights)) ? Math.max(0, Number(cruise.nights)) : 0,
    valueAmount,
    departurePort,
    destination,
    destinationRegion,
    itineraryText,
    portsText,
    searchText: [
      provider,
      shipName,
      shipClass ? `${shipClass} class` : '',
      departurePort,
      destination,
      destinationRegion,
      itineraryText,
      portsText,
      cruise.offerCode,
      cruise.offerName,
      cruise.offerCategory,
      cabinLabel,
    ].join(' ').toLowerCase(),
    rawJson: safeJsonStringify(cruise),
    offerInstanceKey,
    eligibilityKey: offerInstanceKey ? [
      offerInstanceKey,
      canonicalKey,
      cabinLabel.toLowerCase(),
      normalizeText(cruise.guests).toLowerCase(),
      normalizeText(cruise.guestsInfo).toLowerCase(),
      normalizeText(cruise.offerCategory ?? cruise.category).toLowerCase(),
    ].join('|') : null,
  };
}

function makeGenerationId(provider: string, runId?: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${runId ?? `catalog-${Date.now()}`}-${provider}-${nonce}`;
}

function normalizeProvider(value: string): string {
  return value.trim().toLowerCase() || 'unknown';
}

function normalizeOwnerScope(value: string | null | undefined): string {
  return value?.trim() || 'local-default';
}

function boundedLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(MAX_CRUISE_PAGE_SIZE, Math.trunc(limit ?? DEFAULT_CRUISE_PAGE_SIZE)));
}

function parseCruiseRow(row: CruiseRow): Cruise | null {
  try {
    const parsed = JSON.parse(row.raw_json) as Cruise;
    return { ...parsed, id: row.canonical_key, sailDate: row.sail_date || parsed.sailDate };
  } catch {
    return null;
  }
}

class CruiseInventoryRepository {
  private databasePromise: Promise<Database> | null = null;
  private writeTail: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private readonly listeners = new Set<(revision: number) => void>();

  private async getDatabase(): Promise<Database> {
    if (!this.databasePromise) {
      this.databasePromise = this.openAndMigrate().catch((error) => {
        this.databasePromise = null;
        throw error;
      });
    }
    return this.databasePromise;
  }

  private async openAndMigrate(): Promise<Database> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.initialize');
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cruise_inventory_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cruise_catalog_generations (
        id TEXT PRIMARY KEY NOT NULL,
        owner_scope TEXT NOT NULL,
        provider TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('staging','active','failed','retired')),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        expected_raw_rows INTEGER NOT NULL DEFAULT 0,
        raw_rows INTEGER NOT NULL DEFAULT 0,
        canonical_rows INTEGER NOT NULL DEFAULT 0,
        duplicates_merged INTEGER NOT NULL DEFAULT 0,
        rejected_rows INTEGER NOT NULL DEFAULT 0,
        relationship_rows INTEGER NOT NULL DEFAULT 0,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS cruise_inventory (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        generation_id TEXT NOT NULL,
        owner_scope TEXT NOT NULL,
        provider TEXT NOT NULL,
        canonical_key TEXT NOT NULL,
        source_identity TEXT,
        cruise_line TEXT,
        ship_name TEXT NOT NULL,
        sail_date TEXT NOT NULL,
        return_date TEXT,
        nights INTEGER NOT NULL DEFAULT 0,
        value_amount REAL NOT NULL DEFAULT 0,
        departure_port TEXT,
        destination TEXT,
        destination_region TEXT,
        itinerary_text TEXT,
        ports_text TEXT,
        search_text TEXT,
        raw_json TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 0,
        retired_at TEXT,
        UNIQUE(generation_id, canonical_key),
        FOREIGN KEY(generation_id) REFERENCES cruise_catalog_generations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS cruise_offer_sailings (
        generation_id TEXT NOT NULL,
        owner_scope TEXT NOT NULL,
        provider TEXT NOT NULL,
        eligibility_key TEXT NOT NULL,
        offer_instance_key TEXT NOT NULL,
        canonical_key TEXT NOT NULL,
        offer_code TEXT,
        cabin_type TEXT,
        eligibility_json TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY(generation_id, eligibility_key),
        FOREIGN KEY(generation_id) REFERENCES cruise_catalog_generations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS cruise_reconciliation_ledger (
        generation_id TEXT NOT NULL,
        owner_scope TEXT NOT NULL,
        raw_index INTEGER NOT NULL,
        provider TEXT NOT NULL,
        canonical_key TEXT,
        disposition TEXT NOT NULL,
        reason TEXT NOT NULL,
        source_identity TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY(generation_id, raw_index),
        FOREIGN KEY(generation_id) REFERENCES cruise_catalog_generations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS cruise_inventory_changes (
        generation_id TEXT NOT NULL,
        owner_scope TEXT NOT NULL,
        provider TEXT NOT NULL,
        change_kind TEXT NOT NULL CHECK(change_kind IN ('added','changed','removed','rejected','preserved')),
        record_key TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(generation_id, change_kind, record_key),
        FOREIGN KEY(generation_id) REFERENCES cruise_catalog_generations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS cruise_sync_reports (
        generation_id TEXT PRIMARY KEY NOT NULL,
        owner_scope TEXT NOT NULL,
        provider TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        added_rows INTEGER NOT NULL DEFAULT 0,
        changed_rows INTEGER NOT NULL DEFAULT 0,
        removed_rows INTEGER NOT NULL DEFAULT 0,
        rejected_rows INTEGER NOT NULL DEFAULT 0,
        preserved_rows INTEGER NOT NULL DEFAULT 0,
        previous_offer_sailings INTEGER NOT NULL DEFAULT 0,
        next_offer_sailings INTEGER NOT NULL DEFAULT 0,
        evidence_complete INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(generation_id) REFERENCES cruise_catalog_generations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_active_date ON cruise_inventory(active, sail_date, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_owner_active_date ON cruise_inventory(owner_scope, active, sail_date, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_owner_provider_date ON cruise_inventory(owner_scope, provider, active, sail_date, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_owner_ship_date ON cruise_inventory(owner_scope, ship_name, active, sail_date, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_owner_port_date ON cruise_inventory(owner_scope, departure_port, active, sail_date, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_owner_nights_date ON cruise_inventory(owner_scope, nights, active, sail_date, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_provider_date ON cruise_inventory(provider, active, sail_date);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_ship_date ON cruise_inventory(ship_name, active, sail_date);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_port_date ON cruise_inventory(departure_port, active, sail_date);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_nights_date ON cruise_inventory(nights, active, sail_date);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_destination ON cruise_inventory(destination, destination_region, active);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_source_identity ON cruise_inventory(provider, source_identity);
      CREATE INDEX IF NOT EXISTS idx_cruise_offer_sailing_canonical ON cruise_offer_sailings(canonical_key, generation_id);
      CREATE INDEX IF NOT EXISTS idx_cruise_offer_sailing_offer ON cruise_offer_sailings(offer_instance_key, generation_id);
      CREATE INDEX IF NOT EXISTS idx_cruise_offer_sailing_cabin ON cruise_offer_sailings(owner_scope, cabin_type, canonical_key);
      CREATE INDEX IF NOT EXISTS idx_cruise_inventory_changes_run ON cruise_inventory_changes(owner_scope, provider, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cruise_sync_reports_owner ON cruise_sync_reports(owner_scope, completed_at DESC);
    `);
    const inventoryColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cruise_inventory)');
    if (!inventoryColumns.some((column) => column.name === 'value_amount')) {
      await db.execAsync('ALTER TABLE cruise_inventory ADD COLUMN value_amount REAL NOT NULL DEFAULT 0;');
    }
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_cruise_inventory_owner_value_date ON cruise_inventory(owner_scope, value_amount, active, sail_date, canonical_key);',
    );
    await db.runAsync(
      `INSERT INTO cruise_inventory_metadata(key, value, updated_at) VALUES('schema_version', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [String(SCHEMA_VERSION), new Date().toISOString()],
    );
    finishDiagnostic({ schemaVersion: SCHEMA_VERSION });
    return db;
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(task, task);
    this.writeTail = run.then(() => undefined, () => undefined);
    return run;
  }

  /**
   * expo-sqlite's ordinary withTransactionAsync transaction is not exclusive:
   * unrelated async database work may enter the transaction while its callback
   * is awaiting. On iOS that can surface as "cannot start a transaction within
   * a transaction" during large provider syncs. Repository writes are already
   * serialized by enqueueWrite, so use the exclusive transaction handle for
   * every multi-statement catalog mutation. The fallback keeps web/test mocks
   * compatible without weakening native iOS behavior.
   */
  private async withSerializedTransaction<T>(db: Database, task: (transaction: Database) => Promise<T>): Promise<T> {
    if (typeof db.withExclusiveTransactionAsync === 'function') {
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
  }

  private notifyRevision(): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener(this.revision));
  }

  subscribe(listener: (revision: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRevision(): number {
    return this.revision;
  }

  async initialize(): Promise<void> {
    await this.getDatabase();
  }

  async getMetadata(key: string): Promise<string | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM cruise_inventory_metadata WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      await db.runAsync(
        `INSERT INTO cruise_inventory_metadata(key, value, updated_at) VALUES(?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
        [key, value, new Date().toISOString()],
      );
    });
  }

  async beginGeneration(ownerScopeValue: string | undefined, providerValue: string, expectedRawRows: number, runId?: string): Promise<string> {
    return this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      const provider = normalizeProvider(providerValue);
      const ownerScope = normalizeOwnerScope(ownerScopeValue);
      const generationId = makeGenerationId(provider, runId);
      await db.runAsync(
        `INSERT INTO cruise_catalog_generations(
          id, owner_scope, provider, state, started_at, expected_raw_rows
        ) VALUES(?, ?, ?, 'staging', ?, ?)`,
        [generationId, ownerScope, provider, new Date().toISOString(), Math.max(0, expectedRawRows)],
      );
      return generationId;
    });
  }

  async appendGenerationBatch(
    generationId: string,
    providerValue: string,
    cruises: Cruise[],
    rawOffset: number,
  ): Promise<CruiseInventoryProgress> {
    return this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      const provider = normalizeProvider(providerValue);
      const generation = await db.getFirstAsync<{ owner_scope: string }>(
        `SELECT owner_scope FROM cruise_catalog_generations WHERE id=? AND state='staging'`,
        [generationId],
      );
      if (!generation) throw new Error(`CATALOG_GENERATION_NOT_STAGING:${generationId}`);
      const ownerScope = generation.owner_scope;
      const now = new Date().toISOString();
      let canonicalRows = 0;
      let duplicatesMerged = 0;
      let rejectedRows = 0;

      await this.withSerializedTransaction(db, async (transaction) => {
        const insertCruise = await transaction.prepareAsync(`
          INSERT OR IGNORE INTO cruise_inventory(
            generation_id, owner_scope, provider, canonical_key, source_identity, cruise_line,
            ship_name, sail_date, return_date, nights, value_amount, departure_port, destination,
            destination_region, itinerary_text, ports_text, search_text, raw_json,
            first_seen_at, last_seen_at, active
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `);
        const updateCruise = await transaction.prepareAsync(`
          UPDATE cruise_inventory SET
            source_identity=?, cruise_line=?, ship_name=?, sail_date=?, return_date=?, nights=?, value_amount=?,
            departure_port=?, destination=?, destination_region=?, itinerary_text=?, ports_text=?,
            search_text=?, raw_json=?, last_seen_at=?
          WHERE generation_id=? AND canonical_key=?
        `);
        const insertRelationship = await transaction.prepareAsync(`
          INSERT INTO cruise_offer_sailings(
            generation_id, owner_scope, provider, eligibility_key, offer_instance_key, canonical_key, offer_code, cabin_type, eligibility_json,
            first_seen_at, last_seen_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(generation_id, eligibility_key)
          DO UPDATE SET offer_code=excluded.offer_code, cabin_type=excluded.cabin_type,
                        eligibility_json=excluded.eligibility_json, last_seen_at=excluded.last_seen_at
        `);
        const insertLedger = await transaction.prepareAsync(`
          INSERT OR REPLACE INTO cruise_reconciliation_ledger(
            generation_id, owner_scope, raw_index, provider, canonical_key, disposition,
            reason, source_identity, created_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        try {
          for (let index = 0; index < cruises.length; index += 1) {
            const rawIndex = rawOffset + index;
            const prepared = prepareCruiseRow(cruises[index]);
            if (!prepared || prepared.provider !== provider) {
              rejectedRows += 1;
              await insertLedger.executeAsync([
                generationId, ownerScope, rawIndex, provider, prepared?.canonicalKey ?? null,
                'rejected', prepared ? `provider-mismatch:${prepared.provider}` : 'missing-ship-or-sail-date',
                prepared?.sourceIdentity ?? null, now,
              ]);
              continue;
            }

            const insertion = await insertCruise.executeAsync([
              generationId, ownerScope, provider, prepared.canonicalKey, prepared.sourceIdentity, prepared.cruiseLine,
              prepared.shipName, prepared.sailDate, prepared.returnDate, prepared.nights,
              prepared.valueAmount, prepared.departurePort, prepared.destination, prepared.destinationRegion,
              prepared.itineraryText, prepared.portsText, prepared.searchText, prepared.rawJson,
              now, now,
            ]);
            const isDuplicate = insertion.changes === 0;
            if (isDuplicate) {
              duplicatesMerged += 1;
              await updateCruise.executeAsync([
                prepared.sourceIdentity, prepared.cruiseLine, prepared.shipName, prepared.sailDate,
                prepared.returnDate, prepared.nights, prepared.valueAmount, prepared.departurePort, prepared.destination,
                prepared.destinationRegion, prepared.itineraryText, prepared.portsText,
                prepared.searchText, prepared.rawJson, now, generationId, prepared.canonicalKey,
              ]);
            } else {
              canonicalRows += 1;
            }

            if (prepared.offerInstanceKey && prepared.eligibilityKey) {
              await insertRelationship.executeAsync([
                generationId, ownerScope, provider, prepared.eligibilityKey, prepared.offerInstanceKey, prepared.canonicalKey,
                normalizeText(cruises[index].offerCode), getCanonicalCruiseCabinLabel(cruises[index]) ?? '',
                prepared.rawJson, now, now,
              ]);
            }
            await insertLedger.executeAsync([
              generationId, ownerScope, rawIndex, provider, prepared.canonicalKey,
              isDuplicate ? 'merged' : 'canonical',
              isDuplicate ? 'same-provider-exact-offer-option' : 'new-offer-sailing-option',
              prepared.sourceIdentity || null, now,
            ]);
          }
        } finally {
          await Promise.all([
            insertCruise.finalizeAsync(),
            updateCruise.finalizeAsync(),
            insertRelationship.finalizeAsync(),
            insertLedger.finalizeAsync(),
          ]);
        }

        await transaction.runAsync(
          `UPDATE cruise_catalog_generations SET
             raw_rows=raw_rows+?, canonical_rows=canonical_rows+?,
             duplicates_merged=duplicates_merged+?, rejected_rows=rejected_rows+?,
             relationship_rows=(SELECT COUNT(*) FROM cruise_offer_sailings WHERE generation_id=?)
           WHERE id=? AND state='staging'`,
          [cruises.length, canonicalRows, duplicatesMerged, rejectedRows, generationId, generationId],
        );
      });

      const state = await this.getGeneration(generationId);
      return {
        provider,
        generationId,
        processedRows: state?.rawRows ?? rawOffset + cruises.length,
        totalRows: state?.rawRows ?? rawOffset + cruises.length,
        canonicalRows: state?.canonicalRows ?? canonicalRows,
        duplicatesMerged: state?.duplicatesMerged ?? duplicatesMerged,
        rejectedRows: state?.rejectedRows ?? rejectedRows,
      };
    });
  }

  private async promoteGenerations(generationIds: string[]): Promise<CruiseInventoryReconciliation[]> {
    return this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      const promoted: CruiseInventoryReconciliation[] = [];
      await this.withSerializedTransaction(db, async (transaction) => {
        for (const generationId of generationIds) {
          const row = await transaction.getFirstAsync<GenerationRow>(
            `SELECT id, owner_scope, provider, expected_raw_rows, raw_rows, canonical_rows, duplicates_merged,
                    rejected_rows, relationship_rows, state
             FROM cruise_catalog_generations WHERE id=?`,
            [generationId],
          );
          if (!row || row.state !== 'staging') throw new Error(`CATALOG_GENERATION_NOT_STAGING:${generationId}`);
          if (row.expected_raw_rows > 0 && row.raw_rows !== row.expected_raw_rows) {
            throw new Error(`CATALOG_EXPECTED_ROW_MISMATCH:${generationId}:${row.raw_rows}/${row.expected_raw_rows}`);
          }
          if (row.raw_rows !== row.canonical_rows + row.duplicates_merged + row.rejected_rows) {
            throw new Error(`CATALOG_RECONCILIATION_MISMATCH:${generationId}`);
          }
          const persisted = await transaction.getFirstAsync<CountRow>(
            'SELECT COUNT(*) AS count FROM cruise_inventory WHERE generation_id=?',
            [generationId],
          );
          if ((persisted?.count ?? 0) !== row.canonical_rows) {
            throw new Error(`CATALOG_READBACK_MISMATCH:${generationId}`);
          }

          const previous = await transaction.getFirstAsync<CountRow>(
            `SELECT COUNT(*) AS count FROM cruise_inventory i
             JOIN cruise_catalog_generations g ON g.id=i.generation_id
             WHERE g.owner_scope=? AND g.provider=? AND g.state='active' AND i.active=1`,
            [row.owner_scope, row.provider],
          );
          const completedAt = new Date().toISOString();
          // Persist only the compact delta. The complete catalog remains in its
          // generation tables and is not copied into a second JSON snapshot.
          await transaction.runAsync(
            `INSERT OR REPLACE INTO cruise_inventory_changes(
               generation_id, owner_scope, provider, change_kind, record_key, before_json, after_json, reason, created_at
             )
             SELECT ?, ?, ?, 'added', next.eligibility_key, NULL, next.eligibility_json,
                    'present-in-new-provider-capture-only', ?
             FROM cruise_offer_sailings next
             WHERE next.generation_id=? AND NOT EXISTS (
               SELECT 1 FROM cruise_offer_sailings old
               JOIN cruise_catalog_generations oldg ON oldg.id=old.generation_id
               WHERE oldg.owner_scope=? AND oldg.provider=? AND oldg.state='active'
                 AND old.eligibility_key=next.eligibility_key
             )`,
            [generationId, row.owner_scope, row.provider, completedAt, generationId, row.owner_scope, row.provider],
          );
          await transaction.runAsync(
            `INSERT OR REPLACE INTO cruise_inventory_changes(
               generation_id, owner_scope, provider, change_kind, record_key, before_json, after_json, reason, created_at
             )
             SELECT ?, ?, ?, 'removed', old.eligibility_key, old.eligibility_json, NULL,
                    'absent-from-complete-new-provider-capture', ?
             FROM cruise_offer_sailings old
             JOIN cruise_catalog_generations oldg ON oldg.id=old.generation_id
             WHERE oldg.owner_scope=? AND oldg.provider=? AND oldg.state='active'
               AND NOT EXISTS (SELECT 1 FROM cruise_offer_sailings next
                               WHERE next.generation_id=? AND next.eligibility_key=old.eligibility_key)`,
            [generationId, row.owner_scope, row.provider, completedAt, row.owner_scope, row.provider, generationId],
          );
          await transaction.runAsync(
            `INSERT OR REPLACE INTO cruise_inventory_changes(
               generation_id, owner_scope, provider, change_kind, record_key, before_json, after_json, reason, created_at
             )
             SELECT ?, ?, ?, 'changed', next.eligibility_key, old.eligibility_json, next.eligibility_json,
                    'same-provider-record-with-updated-fields', ?
             FROM cruise_offer_sailings next
             JOIN cruise_offer_sailings old ON old.eligibility_key=next.eligibility_key
             JOIN cruise_catalog_generations oldg ON oldg.id=old.generation_id
             WHERE next.generation_id=? AND oldg.owner_scope=? AND oldg.provider=? AND oldg.state='active'
               AND old.eligibility_json<>next.eligibility_json`,
            [generationId, row.owner_scope, row.provider, completedAt, generationId, row.owner_scope, row.provider],
          );
          await transaction.runAsync(
            `INSERT OR REPLACE INTO cruise_inventory_changes(
               generation_id, owner_scope, provider, change_kind, record_key, before_json, after_json, reason, created_at
             )
             SELECT ?, ?, ?, 'rejected', CAST(raw_index AS TEXT), NULL, NULL, reason, created_at
             FROM cruise_reconciliation_ledger WHERE generation_id=? AND disposition='rejected'`,
            [generationId, row.owner_scope, row.provider, generationId],
          );
          const deltaCounts = await transaction.getAllAsync<{ change_kind: CruiseInventoryChangeKind; count: number }>(
            `SELECT change_kind, COUNT(*) AS count FROM cruise_inventory_changes WHERE generation_id=? GROUP BY change_kind`,
            [generationId],
          );
          const delta = Object.fromEntries(deltaCounts.map((entry) => [entry.change_kind, entry.count])) as Partial<Record<CruiseInventoryChangeKind, number>>;
          const previousOfferCount = await transaction.getFirstAsync<CountRow>(
            `SELECT COUNT(*) AS count FROM cruise_offer_sailings old
             JOIN cruise_catalog_generations oldg ON oldg.id=old.generation_id
             WHERE oldg.owner_scope=? AND oldg.provider=? AND oldg.state='active'`,
            [row.owner_scope, row.provider],
          );
          const preserved = Math.max(0, row.relationship_rows - (delta.added ?? 0) - (delta.changed ?? 0));
          await transaction.runAsync(
            `INSERT OR REPLACE INTO cruise_sync_reports(
               generation_id, owner_scope, provider, started_at, completed_at, added_rows, changed_rows,
               removed_rows, rejected_rows, preserved_rows, previous_offer_sailings, next_offer_sailings, evidence_complete
             ) SELECT id, owner_scope, provider, started_at, ?, ?, ?, ?, ?, ?, ?, ?, 1
                 FROM cruise_catalog_generations WHERE id=?`,
            [completedAt, delta.added ?? 0, delta.changed ?? 0, delta.removed ?? 0, row.rejected_rows,
             preserved, previousOfferCount?.count ?? 0, row.relationship_rows, generationId],
          );
          await transaction.runAsync(
            `UPDATE cruise_inventory SET active=0, retired_at=?
             WHERE generation_id IN (
               SELECT id FROM cruise_catalog_generations WHERE owner_scope=? AND provider=? AND state='active'
             )`,
            [completedAt, row.owner_scope, row.provider],
          );
          await transaction.runAsync(
            `UPDATE cruise_catalog_generations SET state='retired', completed_at=COALESCE(completed_at, ?)
             WHERE owner_scope=? AND provider=? AND state='active'`,
            [completedAt, row.owner_scope, row.provider],
          );
          await transaction.runAsync('UPDATE cruise_inventory SET active=1, retired_at=NULL WHERE generation_id=?', [generationId]);
          await transaction.runAsync(
            `UPDATE cruise_catalog_generations SET state='active', completed_at=? WHERE id=?`,
            [completedAt, generationId],
          );
          promoted.push({
            generationId,
            provider: row.provider,
            rawRows: row.raw_rows,
            canonicalRows: row.canonical_rows,
            duplicatesMerged: row.duplicates_merged,
            rejectedRows: row.rejected_rows,
            offerSailingRelationships: row.relationship_rows,
            persistedRows: persisted?.count ?? 0,
            readbackRows: persisted?.count ?? 0,
            retiredRows: previous?.count ?? 0,
            state: 'active',
          });
        }
      });
      this.notifyRevision();
      return promoted;
    });
  }

  async abortGeneration(generationId: string, error: unknown): Promise<void> {
    await this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      await db.runAsync(
        `UPDATE cruise_catalog_generations SET state='failed', completed_at=?, error=?
         WHERE id=? AND state='staging'`,
        [new Date().toISOString(), error instanceof Error ? error.message : String(error), generationId],
      );
    });
  }

  async replaceCatalog(
    cruises: Cruise[],
    options: ReplaceCruiseInventoryOptions = {},
  ): Promise<CruiseInventoryReconciliation[]> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.replaceCatalog', {
      inputRows: cruises.length,
      runId: options.runId,
    });
    const grouped = new Map<string, Cruise[]>();
    selectCruiseInventoryProviderRows(cruises, options.providersToReplace).forEach((cruise) => {
      const provider = getCruiseInventoryProvider(cruise);
      const rows = grouped.get(provider) ?? [];
      rows.push(cruise);
      grouped.set(provider, rows);
    });
    const generationIds: string[] = [];
    try {
      for (const [provider, providerRows] of grouped) {
        if (options.shouldAbort?.()) throw new Error('CATALOG_WRITE_CANCELLED');
        const generationId = await this.beginGeneration(options.ownerScopeId, provider, providerRows.length, options.runId);
        generationIds.push(generationId);
        const batchSize = Math.max(50, Math.min(1_000, options.batchSize ?? DEFAULT_CRUISE_INGEST_BATCH_SIZE));
        for (let offset = 0; offset < providerRows.length; offset += batchSize) {
          if (options.shouldAbort?.()) throw new Error('CATALOG_WRITE_CANCELLED');
          const progress = await this.appendGenerationBatch(
            generationId,
            provider,
            providerRows.slice(offset, offset + batchSize),
            offset,
          );
          options.onProgress?.({ ...progress, totalRows: providerRows.length });
          if (options.yieldBetweenBatches ?? true) {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        }
      }
      if (options.shouldAbort?.()) throw new Error('CATALOG_WRITE_CANCELLED');
      const result = await this.promoteGenerations(generationIds);
      finishDiagnostic({
        providers: result.length,
        rawRows: result.reduce((sum, entry) => sum + entry.rawRows, 0),
        canonicalRows: result.reduce((sum, entry) => sum + entry.canonicalRows, 0),
        rejectedRows: result.reduce((sum, entry) => sum + entry.rejectedRows, 0),
        success: true,
      });
      return result;
    } catch (error) {
      await Promise.allSettled(generationIds.map((generationId) => this.abortGeneration(generationId, error)));
      finishDiagnostic({ success: false, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async migrateLegacyCatalog(cruises: Cruise[], migrationKey: string, ownerScopeId?: string): Promise<CruiseInventoryReconciliation[]> {
    const completedKey = `legacy_migration:${normalizeOwnerScope(ownerScopeId)}:${migrationKey}`;
    if (await this.getMetadata(completedKey)) return [];
    const result = cruises.length > 0
      ? await this.replaceCatalog(cruises, { runId: `migration-${migrationKey}`, ownerScopeId })
      : [];
    await this.setMetadata(completedKey, JSON.stringify({
      completedAt: new Date().toISOString(),
      sourceRows: cruises.length,
      canonicalRows: result.reduce((sum, entry) => sum + entry.canonicalRows, 0),
    }));
    return result;
  }

  async getGeneration(generationId: string): Promise<CruiseInventoryReconciliation | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<GenerationRow>(
      `SELECT id, owner_scope, provider, expected_raw_rows, raw_rows, canonical_rows, duplicates_merged,
              rejected_rows, relationship_rows, state
       FROM cruise_catalog_generations WHERE id=?`,
      [generationId],
    );
    if (!row) return null;
    const persisted = await db.getFirstAsync<CountRow>(
      'SELECT COUNT(*) AS count FROM cruise_inventory WHERE generation_id=?',
      [generationId],
    );
    return {
      generationId: row.id,
      provider: row.provider,
      rawRows: row.raw_rows,
      canonicalRows: row.canonical_rows,
      duplicatesMerged: row.duplicates_merged,
      rejectedRows: row.rejected_rows,
      offerSailingRelationships: row.relationship_rows,
      persistedRows: persisted?.count ?? 0,
      readbackRows: persisted?.count ?? 0,
      retiredRows: 0,
      state: row.state,
    };
  }

  async getSyncReports(ownerScopeId?: string, limit = 25): Promise<CruiseSyncReport[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM cruise_sync_reports WHERE owner_scope=? ORDER BY completed_at DESC LIMIT ?`,
      [normalizeOwnerScope(ownerScopeId), Math.max(1, Math.min(100, Math.trunc(limit)))],
    );
    return rows.map((row) => ({
      generationId: row.generation_id, provider: row.provider, startedAt: row.started_at,
      completedAt: row.completed_at, added: row.added_rows, changed: row.changed_rows,
      removed: row.removed_rows, rejected: row.rejected_rows, preserved: row.preserved_rows,
      previousOfferSailings: row.previous_offer_sailings, nextOfferSailings: row.next_offer_sailings,
      evidenceComplete: row.evidence_complete === 1,
    }));
  }

  async getSyncChanges(generationId: string, kind?: CruiseInventoryChangeKind): Promise<CruiseInventoryChange[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM cruise_inventory_changes WHERE generation_id=? ${kind ? 'AND change_kind=?' : ''}
       ORDER BY change_kind, record_key LIMIT 5000`,
      kind ? [generationId, kind] : [generationId],
    );
    return rows.map((row) => ({ generationId: row.generation_id, provider: row.provider, kind: row.change_kind,
      recordKey: row.record_key, beforeJson: row.before_json, afterJson: row.after_json,
      reason: row.reason, createdAt: row.created_at }));
  }

  async getCounts(ownerScopeId?: string): Promise<CruiseInventoryCounts> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.count');
    const db = await this.getDatabase();
    const scope = normalizeOwnerScope(ownerScopeId);
    const [rows, generationRows, relationshipCount, sourceCount, physicalCount] = await Promise.all([
      db.getAllAsync<ProviderCountRow>(
        `SELECT provider, SUM(count) AS count FROM (
           SELECT relationships.provider AS provider, COUNT(*) AS count
           FROM cruise_offer_sailings relationships
           JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
           WHERE relationships.owner_scope=? AND generations.state='active'
           GROUP BY relationships.provider
           UNION ALL
           SELECT inventory.provider AS provider, COUNT(*) AS count
           FROM cruise_inventory inventory
           WHERE inventory.owner_scope=? AND inventory.active=1
             AND NOT EXISTS (
               SELECT 1 FROM cruise_offer_sailings relationships
               WHERE relationships.generation_id=inventory.generation_id
                 AND relationships.canonical_key=inventory.canonical_key
             )
           GROUP BY inventory.provider
         ) GROUP BY provider ORDER BY provider`,
        [scope, scope],
      ),
      db.getAllAsync<{ id: string }>(
        `SELECT id FROM cruise_catalog_generations WHERE owner_scope=? AND state='active' ORDER BY provider`,
        [scope],
      ),
      db.getFirstAsync<CountRow>(
        `SELECT COUNT(*) AS count FROM cruise_offer_sailings relationships
         JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
         WHERE relationships.owner_scope=? AND generations.state='active'`,
        [scope],
      ),
      db.getFirstAsync<CountRow>(
        `SELECT
           (SELECT COUNT(*) FROM cruise_offer_sailings relationships
            JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
            WHERE relationships.owner_scope=? AND generations.state='active')
           +
           (SELECT COUNT(*) FROM cruise_inventory inventory
            WHERE inventory.owner_scope=? AND inventory.active=1
              AND NOT EXISTS (
                SELECT 1 FROM cruise_offer_sailings relationships
                WHERE relationships.generation_id=inventory.generation_id
                  AND relationships.canonical_key=inventory.canonical_key
              )) AS count`,
        [scope, scope],
      ),
      db.getFirstAsync<CountRow>(
        `SELECT COUNT(*) AS count FROM cruise_inventory
         WHERE owner_scope=? AND active=1`,
        [scope],
      ),
    ]);
    const byProvider = Object.fromEntries(rows.map((row) => [row.provider, row.count]));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const offerSailingRelationships = relationshipCount?.count ?? 0;
    const sourceTotal = sourceCount?.count ?? total;
    const physicalSailings = physicalCount?.count ?? 0;
    finishDiagnostic({ databaseQueryRows: rows.length, aggregateCount: total, sourceTotal, offerSailingRelationships, physicalSailings });
    return { total, sourceTotal, offerSailingRelationships, physicalSailings, byProvider, activeGenerationIds: generationRows.map((row) => row.id) };
  }

  async getActiveIntegrity(ownerScopeId?: string): Promise<CruiseInventoryIntegrity> {
    const db = await this.getDatabase();
    const scope = normalizeOwnerScope(ownerScopeId);
    const generation = await db.getFirstAsync<{
      raw_rows: number;
      canonical_rows: number;
      duplicates_merged: number;
      rejected_rows: number;
      relationship_rows: number;
      active_generations: number;
    }>(
      `SELECT COALESCE(SUM(raw_rows), 0) AS raw_rows,
              COALESCE(SUM(canonical_rows), 0) AS canonical_rows,
              COALESCE(SUM(duplicates_merged), 0) AS duplicates_merged,
              COALESCE(SUM(rejected_rows), 0) AS rejected_rows,
              COALESCE(SUM(relationship_rows), 0) AS relationship_rows,
              COUNT(*) AS active_generations
       FROM cruise_catalog_generations WHERE owner_scope=? AND state='active'`,
      [scope],
    );
    const readback = await db.getFirstAsync<CountRow>(
      'SELECT COUNT(*) AS count FROM cruise_inventory WHERE owner_scope=? AND active=1',
      [scope],
    );
    const durable = await db.getFirstAsync<CountRow>(
      `SELECT
         (SELECT COUNT(*) FROM cruise_offer_sailings relationships
          JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
          WHERE relationships.owner_scope=? AND generations.state='active')
         +
         (SELECT COUNT(*) FROM cruise_inventory inventory
          WHERE inventory.owner_scope=? AND inventory.active=1
            AND NOT EXISTS (
              SELECT 1 FROM cruise_offer_sailings relationships
              WHERE relationships.generation_id=inventory.generation_id
                AND relationships.canonical_key=inventory.canonical_key
            )) AS count`,
      [scope, scope],
    );
    const rawRows = generation?.raw_rows ?? 0;
    const canonicalRows = generation?.canonical_rows ?? 0;
    const duplicatesMerged = generation?.duplicates_merged ?? 0;
    const rejectedRows = generation?.rejected_rows ?? 0;
    const readbackRows = readback?.count ?? 0;
    return {
      rawRows,
      canonicalRows,
      duplicatesMerged,
      rejectedRows,
      offerSailingRelationships: generation?.relationship_rows ?? 0,
      durableSourceRows: durable?.count ?? 0,
      readbackRows,
      activeGenerations: generation?.active_generations ?? 0,
      reconciled: rawRows === canonicalRows + duplicatesMerged + rejectedRows
        && canonicalRows === readbackRows,
    };
  }

  async getFacets(ownerScopeId?: string): Promise<CruiseInventoryFacets> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.facets');
    const db = await this.getDatabase();
    const scope = normalizeOwnerScope(ownerScopeId);
    const [ships, shipClasses, guestCounts, providers, ports, destinations] = await Promise.all([
      db.getAllAsync<{ value: string }>(
        `SELECT DISTINCT ship_name AS value FROM cruise_inventory
         WHERE owner_scope=? AND active=1 AND ship_name<>'' ORDER BY ship_name LIMIT 1000`,
        [scope],
      ),
      db.getAllAsync<{ value: string }>(
        `SELECT DISTINCT COALESCE(
           json_extract(raw_json, '$.shipClass'),
           json_extract(raw_json, '$.shipClassName'),
           json_extract(raw_json, '$.vesselClass'),
           ''
         ) AS value FROM cruise_inventory
         WHERE owner_scope=? AND active=1 AND COALESCE(
           json_extract(raw_json, '$.shipClass'),
           json_extract(raw_json, '$.shipClassName'),
           json_extract(raw_json, '$.vesselClass'),
           ''
         )<>'' ORDER BY value LIMIT 100`,
        [scope],
      ),
      db.getAllAsync<{ value: number }>(
        `SELECT DISTINCT CAST(COALESCE(
           json_extract(raw_json, '$.guests'),
           json_extract(raw_json, '$.guestCount'),
           0
         ) AS INTEGER) AS value FROM cruise_inventory
         WHERE owner_scope=? AND active=1 AND CAST(COALESCE(
           json_extract(raw_json, '$.guests'),
           json_extract(raw_json, '$.guestCount'),
           0
         ) AS INTEGER)>0 ORDER BY value LIMIT 20`,
        [scope],
      ),
      db.getAllAsync<{ value: string }>(
        `SELECT DISTINCT provider AS value FROM cruise_inventory
         WHERE owner_scope=? AND active=1 AND provider<>'' ORDER BY provider LIMIT 100`,
        [scope],
      ),
      db.getAllAsync<{ value: string }>(
        `SELECT DISTINCT departure_port AS value FROM cruise_inventory
         WHERE owner_scope=? AND active=1 AND departure_port<>'' ORDER BY departure_port LIMIT 1000`,
        [scope],
      ),
      db.getAllAsync<{ value: string }>(
        `SELECT DISTINCT destination AS value FROM cruise_inventory
         WHERE owner_scope=? AND active=1 AND destination<>'' ORDER BY destination LIMIT 1000`,
        [scope],
      ),
    ]);
    finishDiagnostic({
      ships: ships.length,
      providers: providers.length,
      ports: ports.length,
      destinations: destinations.length,
    });
    return {
      shipNames: ships.map((row) => row.value),
      shipClasses: shipClasses.map((row) => row.value),
      guestCounts: guestCounts.map((row) => row.value),
      providers: providers.map((row) => row.value),
      departurePorts: ports.map((row) => row.value),
      destinations: destinations.map((row) => row.value),
    };
  }

  async query(query: CruiseInventoryQuery = {}): Promise<CruiseInventoryPage> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.query', {
      requestedLimit: query.limit,
    });
    const startedAt = Date.now();
    const db = await this.getDatabase();
    const where = ['owner_scope=?', 'active=1'];
    const params: Array<string | number> = [normalizeOwnerScope(query.ownerScopeId)];
    const selectParams: Array<string | number> = [];
    let relevanceExpression = '0';
    const appendList = (column: string, values?: string[]) => {
      const normalized = values?.map((value) => value.trim()).filter(Boolean) ?? [];
      if (normalized.length === 0) return;
      where.push(`${column} IN (${normalized.map(() => '?').join(',')})`);
      params.push(...normalized);
    };
    appendList('provider', query.providers?.map(normalizeProvider));
    appendList('ship_name', query.shipNames);
    appendList('departure_port', query.departurePorts);
    appendList('destination', query.destinations);
    appendList('destination_region', query.destinationRegions);
    const regionsOrDestinations = query.regionsOrDestinations?.map((value) => value.trim()).filter(Boolean) ?? [];
    if (regionsOrDestinations.length > 0) {
      const placeholders = regionsOrDestinations.map(() => '?').join(',');
      where.push(`(destination_region IN (${placeholders}) OR destination IN (${placeholders}))`);
      params.push(...regionsOrDestinations, ...regionsOrDestinations);
    }
    const shipClasses = query.shipClasses?.map((value) => value.trim()).filter(Boolean) ?? [];
    if (shipClasses.length > 0) {
      where.push(`COALESCE(
        json_extract(raw_json, '$.shipClass'),
        json_extract(raw_json, '$.shipClassName'),
        json_extract(raw_json, '$.vesselClass'),
        ''
      ) IN (${shipClasses.map(() => '?').join(',')})`);
      params.push(...shipClasses);
    }
    const guestCounts = query.guestCounts?.filter((value) => Number.isFinite(value) && value > 0) ?? [];
    if (guestCounts.length > 0) {
      where.push(`CAST(COALESCE(
        json_extract(raw_json, '$.guests'),
        json_extract(raw_json, '$.guestCount'),
        0
      ) AS INTEGER) IN (${guestCounts.map(() => '?').join(',')})`);
      params.push(...guestCounts);
    }
    if (typeof query.offerLinked === 'boolean') {
      where.push(`${query.offerLinked ? '' : 'NOT '}EXISTS (
        SELECT 1 FROM cruise_offer_sailings linked_offer
        WHERE linked_offer.owner_scope=cruise_inventory.owner_scope
          AND linked_offer.generation_id=cruise_inventory.generation_id
          AND linked_offer.canonical_key=cruise_inventory.canonical_key
      )`);
    }
    const cabinTypes = query.cabinTypes?.map((value) => value.trim()).filter(Boolean) ?? [];
    if (cabinTypes.length > 0) {
      where.push(`EXISTS (
        SELECT 1 FROM cruise_offer_sailings eligibility
        WHERE eligibility.generation_id=cruise_inventory.generation_id
          AND eligibility.canonical_key=cruise_inventory.canonical_key
          AND eligibility.cabin_type IN (${cabinTypes.map(() => '?').join(',')})
      )`);
      params.push(...cabinTypes);
    }
    if (typeof query.minNights === 'number') { where.push('nights>=?'); params.push(query.minNights); }
    if (typeof query.maxNights === 'number') { where.push('nights<=?'); params.push(query.maxNights); }
    if (query.sailDateFrom) { where.push('sail_date>=?'); params.push(query.sailDateFrom); }
    if (query.sailDateTo) { where.push('sail_date<=?'); params.push(query.sailDateTo); }
    const search = query.search?.trim().toLowerCase();
    if (search) {
      const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
      const stopWords = new Set(['about', 'anything', 'cruise', 'cruises', 'find', 'from', 'have', 'offer', 'offers', 'show', 'that', 'the', 'this', 'used', 'what', 'when', 'where', 'which', 'with']);
      const splitTerms = Array.from(new Set(search.split(/[^a-z0-9]+/i).map((term) => term.trim()).filter((term) => term.length >= 2)));
      const terms = (query.searchAnyTerm ? splitTerms.filter((term) => !stopWords.has(term)) : splitTerms).slice(0, 12);
      if (terms.length > 0) {
        const patterns = terms.map((term) => `%${escapeLike(term)}%`);
        where.push(`(${terms.map(() => "search_text LIKE ? ESCAPE '\\\\'").join(query.searchAnyTerm ? ' OR ' : ' AND ')})`);
        params.push(...patterns);
        if (query.searchAnyTerm) {
          relevanceExpression = terms.map(() => "CASE WHEN search_text LIKE ? ESCAPE '\\\\' THEN 1 ELSE 0 END").join(' + ');
          selectParams.push(...patterns);
        }
      }
    }
    const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC';
    const sortColumn = query.sortBy === 'nights'
      ? 'nights'
      : query.sortBy === 'value'
        ? 'value_amount'
        : 'sail_date';
    if (query.cursor && !query.searchAnyTerm) {
      const cursorValue = query.cursor.sortValue ?? query.cursor.sailDate;
      where.push(direction === 'ASC'
        ? `(${sortColumn}>? OR (${sortColumn}=? AND canonical_key>?))`
        : `(${sortColumn}<? OR (${sortColumn}=? AND canonical_key<?))`);
      params.push(cursorValue, cursorValue, query.cursor.canonicalKey);
    }
    const limit = boundedLimit(query.limit);
    const sqlWhere = where.join(' AND ');
    const rows = await db.getAllAsync<CruiseRow>(
      `SELECT canonical_key, sail_date, ${sortColumn} AS sort_value,
              (${relevanceExpression}) AS relevance_rank, raw_json FROM cruise_inventory
       WHERE ${sqlWhere}
       ORDER BY relevance_rank DESC, ${sortColumn} ${direction}, canonical_key ${direction}
       LIMIT ?`,
      [...selectParams, ...params, limit],
    );
    const countParams = query.cursor && !query.searchAnyTerm ? params.slice(0, -3) : params;
    const countWhere = query.cursor && !query.searchAnyTerm ? where.slice(0, -1).join(' AND ') : sqlWhere;
    const count = await db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS count FROM cruise_inventory WHERE ${countWhere}`,
      countParams,
    );
    const parsedRows = rows.map(parseCruiseRow).filter((row): row is Cruise => row !== null);
    const last = rows.at(-1);
    const queryMs = Date.now() - startedAt;
    finishDiagnostic({ databaseQueryRows: rows.length, parsedRows: parsedRows.length, total: count?.count ?? 0 });
    recordPerformanceCount('CruiseInventoryRepository.databaseQueryRows', rows.length, { limit, total: count?.count ?? 0 });
    return {
      rows: parsedRows,
      nextCursor: !query.searchAnyTerm && rows.length === limit && last
        ? { sailDate: last.sail_date, canonicalKey: last.canonical_key, sortValue: last.sort_value ?? last.sail_date }
        : null,
      total: count?.count ?? 0,
      queryMs,
    };
  }

  async getById(canonicalKey: string, ownerScopeId?: string): Promise<Cruise | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<CruiseRow>(
      `SELECT canonical_key, sail_date, raw_json FROM cruise_inventory
       WHERE owner_scope=? AND active=1 AND canonical_key=? LIMIT 1`,
      [normalizeOwnerScope(ownerScopeId), canonicalKey],
    );
    return row ? parseCruiseRow(row) : null;
  }

  /** Resolve a details route across canonical, provider, relationship, and
   * material identities. IDs can legitimately change when a provider refresh
   * replaces an active catalog generation; ship/date/offer evidence keeps a
   * tapped sailing resolvable without exposing a stale "Cruise Not Found". */
  async getByIdentity(query: CruiseInventoryIdentityQuery, ownerScopeId?: string): Promise<Cruise | null> {
    const db = await this.getDatabase();
    const scope = normalizeOwnerScope(ownerScopeId);
    const id = normalizeText(query.id);
    const offerOptionId = normalizeText(query.offerOptionId);
    const sourceIdentity = normalizeText(query.sourceRecordId ?? query.sourceIdentity ?? query.id);
    const offerInstanceKey = normalizeText(query.offerInstanceKey).toLowerCase();
    const shipName = normalizeText(query.shipName);
    const sailDate = normalizeText(query.sailDate);
    const offerCode = normalizeText(query.offerCode).toLowerCase();
    if (!id && !sourceIdentity && !offerOptionId && !(shipName && sailDate)) return null;
    const row = await db.getFirstAsync<CruiseRow>(
      `SELECT inventory.canonical_key, inventory.sail_date, inventory.raw_json
       FROM cruise_inventory inventory
       WHERE inventory.owner_scope=? AND inventory.active=1 AND (
         inventory.canonical_key=? OR inventory.source_identity=?
         OR json_extract(inventory.raw_json, '$.id')=?
         OR EXISTS (
           SELECT 1 FROM cruise_offer_sailings relationship
           WHERE relationship.generation_id=inventory.generation_id
             AND relationship.canonical_key=inventory.canonical_key
             AND relationship.eligibility_key=?
         )
         OR (inventory.ship_name=? AND inventory.sail_date=? AND (
           (?='' AND ?='') OR EXISTS (
             SELECT 1 FROM cruise_offer_sailings relationship
             WHERE relationship.generation_id=inventory.generation_id
               AND relationship.canonical_key=inventory.canonical_key
               AND (?='' OR LOWER(relationship.offer_code)=?)
               AND (?='' OR LOWER(relationship.offer_instance_key)=?)
           )
         ))
       )
       ORDER BY CASE
         WHEN inventory.canonical_key=? THEN 0
         WHEN inventory.source_identity=? THEN 1
         WHEN json_extract(inventory.raw_json, '$.id')=? THEN 2
         WHEN EXISTS (
           SELECT 1 FROM cruise_offer_sailings relationship
           WHERE relationship.generation_id=inventory.generation_id
             AND relationship.canonical_key=inventory.canonical_key
             AND relationship.eligibility_key=?
         ) THEN 3
         ELSE 4
       END
       LIMIT 1`,
      [scope, id, sourceIdentity, id, offerOptionId, shipName, sailDate,
       offerCode, offerInstanceKey, offerCode, offerCode, offerInstanceKey, offerInstanceKey,
       id, sourceIdentity, id, offerOptionId],
    );
    return row ? parseCruiseRow(row) : null;
  }

  async queryOfferSailings(query: CruiseOfferSailingQuery): Promise<CruiseInventoryPage> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.queryOfferSailings');
    const startedAt = Date.now();
    const db = await this.getDatabase();
    const where = ["relationships.owner_scope=?", "generations.state='active'", 'inventory.active=1'];
    const params: Array<string | number> = [normalizeOwnerScope(query.ownerScopeId)];
    if (query.offerInstanceKey?.trim()) {
      where.push('relationships.offer_instance_key=?');
      params.push(query.offerInstanceKey.trim().toLowerCase());
    } else if (query.offerCode?.trim()) {
      where.push('LOWER(relationships.offer_code)=?');
      params.push(query.offerCode.trim().toLowerCase());
    } else {
      return { rows: [], nextCursor: null, total: 0, queryMs: 0 };
    }
    const sortColumn = query.sortBy === 'nights'
      ? 'inventory.nights'
      : query.sortBy === 'value'
        ? 'inventory.value_amount'
        : 'inventory.sail_date';
    const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC';
    if (query.cursor) {
      const cursorValue = query.cursor.sortValue ?? query.cursor.sailDate;
      where.push(direction === 'ASC'
        ? `(${sortColumn}>? OR (${sortColumn}=? AND relationships.eligibility_key>?))`
        : `(${sortColumn}<? OR (${sortColumn}=? AND relationships.eligibility_key<?))`);
      params.push(cursorValue, cursorValue, query.cursor.canonicalKey);
    }
    const limit = boundedLimit(query.limit);
    const sqlWhere = where.join(' AND ');
    const rows = await db.getAllAsync<CruiseRow>(
      `SELECT relationships.eligibility_key AS canonical_key,
              inventory.canonical_key AS inventory_key, inventory.sail_date,
              ${sortColumn} AS sort_value, relationships.eligibility_json AS raw_json
       FROM cruise_offer_sailings relationships
       JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
       JOIN cruise_inventory inventory
         ON inventory.generation_id=relationships.generation_id
        AND inventory.canonical_key=relationships.canonical_key
       WHERE ${sqlWhere}
       ORDER BY ${sortColumn} ${direction}, relationships.eligibility_key ${direction}
       LIMIT ?`,
      [...params, limit],
    );
    const countParams = query.cursor ? params.slice(0, -3) : params;
    const countWhere = query.cursor ? where.slice(0, -1).join(' AND ') : sqlWhere;
    const count = await db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS count
       FROM cruise_offer_sailings relationships
       JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
       JOIN cruise_inventory inventory
         ON inventory.generation_id=relationships.generation_id
        AND inventory.canonical_key=relationships.canonical_key
       WHERE ${countWhere}`,
      countParams,
    );
    const parsedRows = rows.map((row) => {
      try {
        const parsed = JSON.parse(row.raw_json) as Cruise;
        // Eligibility rows retain the exact source payload, while navigation
        // resolves the queryable offer-sailing option stored in SQLite.
        return {
          ...parsed,
          sourceCruiseId: row.inventory_key || parsed.id,
          inventoryCanonicalKey: row.inventory_key || parsed.id,
          offerSailingKey: row.canonical_key,
          id: row.canonical_key || row.inventory_key || parsed.id,
        } as Cruise;
      } catch {
        return null;
      }
    }).filter((row): row is Cruise => row !== null);
    const last = rows.at(-1);
    const queryMs = Date.now() - startedAt;
    finishDiagnostic({ databaseQueryRows: rows.length, total: count?.count ?? 0, queryMs });
    return {
      rows: parsedRows,
      total: count?.count ?? 0,
      queryMs,
      nextCursor: rows.length === limit && last
        ? { sailDate: last.sail_date, canonicalKey: last.canonical_key, sortValue: last.sort_value ?? last.sail_date }
        : null,
    };
  }

  /**
   * Exact offer-card facts without materializing every eligible sailing in
   * JavaScript. The relationship JSON is the provider row retained for that
   * offer option; SQLite reduces all rows to bounded cabin/guest/point/value
   * facets while the full clickable catalog remains paged separately.
   */
  async queryOfferSailingSummary(query: CruiseOfferSailingQuery): Promise<CruiseOfferSailingSummary> {
    const finishDiagnostic = beginPerformanceSpan('CruiseInventoryRepository.queryOfferSailingSummary');
    const db = await this.getDatabase();
    const where = ["relationships.owner_scope=?", "generations.state='active'", 'inventory.active=1'];
    const params: Array<string | number> = [normalizeOwnerScope(query.ownerScopeId)];
    if (query.offerInstanceKey?.trim()) {
      where.push('relationships.offer_instance_key=?');
      params.push(query.offerInstanceKey.trim().toLowerCase());
    } else if (query.offerCode?.trim()) {
      where.push('LOWER(relationships.offer_code)=?');
      params.push(query.offerCode.trim().toLowerCase());
    } else {
      return { total: 0, cabinTypes: [], guestCounts: [], pointRequirements: [], minimumRoomValue: null, maximumRoomValue: null, minimumNights: null, maximumNights: null };
    }

    const row = await db.getFirstAsync<{
      total: number;
      cabin_types: string | null;
      guest_counts: string | null;
      point_requirements: string | null;
      minimum_room_value: number | null;
      maximum_room_value: number | null;
      minimum_nights: number | null;
      maximum_nights: number | null;
    }>(
      `WITH offer_rows AS (
         SELECT
           COALESCE(
             NULLIF(TRIM(relationships.cabin_type), ''),
             NULLIF(TRIM(json_extract(relationships.eligibility_json, '$.cabinType')), ''),
             NULLIF(TRIM(json_extract(relationships.eligibility_json, '$.stateroomType')), ''),
             NULLIF(TRIM(json_extract(relationships.eligibility_json, '$.roomType')), ''),
             NULLIF(TRIM(json_extract(relationships.eligibility_json, '$.cabinCategory')), ''),
             NULLIF(TRIM(json_extract(relationships.eligibility_json, '$.stateroomCategoryCode')), '')
           ) AS cabin_type,
           CAST(json_extract(relationships.eligibility_json, '$.guests') AS INTEGER) AS guest_count,
           CAST(COALESCE(
             json_extract(relationships.eligibility_json, '$.pointRequirement'),
             json_extract(relationships.eligibility_json, '$.pointsRequired'),
             json_extract(relationships.eligibility_json, '$.pointsLevel'),
             json_extract(relationships.eligibility_json, '$.thresholdPoints')
           ) AS INTEGER) AS point_requirement,
           CAST(json_extract(relationships.eligibility_json, '$.nights') AS INTEGER) AS nights,
           2.0 * CASE
             WHEN LOWER(COALESCE(relationships.cabin_type, json_extract(relationships.eligibility_json, '$.cabinType'), '')) LIKE '%suite%'
               THEN COALESCE(NULLIF(CAST(json_extract(relationships.eligibility_json, '$.suitePrice') AS REAL), 0), NULLIF(CAST(json_extract(relationships.eligibility_json, '$.price') AS REAL), 0), 0)
             WHEN LOWER(COALESCE(relationships.cabin_type, json_extract(relationships.eligibility_json, '$.cabinType'), '')) LIKE '%balcon%'
               THEN COALESCE(NULLIF(CAST(json_extract(relationships.eligibility_json, '$.balconyPrice') AS REAL), 0), NULLIF(CAST(json_extract(relationships.eligibility_json, '$.price') AS REAL), 0), 0)
             WHEN LOWER(COALESCE(relationships.cabin_type, json_extract(relationships.eligibility_json, '$.cabinType'), '')) LIKE '%ocean%'
               THEN COALESCE(NULLIF(CAST(json_extract(relationships.eligibility_json, '$.oceanviewPrice') AS REAL), 0), NULLIF(CAST(json_extract(relationships.eligibility_json, '$.price') AS REAL), 0), 0)
             WHEN LOWER(COALESCE(relationships.cabin_type, json_extract(relationships.eligibility_json, '$.cabinType'), '')) LIKE '%interior%'
               OR LOWER(COALESCE(relationships.cabin_type, json_extract(relationships.eligibility_json, '$.cabinType'), '')) LIKE '%inside%'
               THEN COALESCE(NULLIF(CAST(json_extract(relationships.eligibility_json, '$.interiorPrice') AS REAL), 0), NULLIF(CAST(json_extract(relationships.eligibility_json, '$.price') AS REAL), 0), 0)
             ELSE COALESCE(
               NULLIF(CAST(json_extract(relationships.eligibility_json, '$.price') AS REAL), 0),
               NULLIF(CAST(json_extract(relationships.eligibility_json, '$.interiorPrice') AS REAL), 0),
               NULLIF(CAST(json_extract(relationships.eligibility_json, '$.oceanviewPrice') AS REAL), 0),
               NULLIF(CAST(json_extract(relationships.eligibility_json, '$.balconyPrice') AS REAL), 0),
               NULLIF(CAST(json_extract(relationships.eligibility_json, '$.suitePrice') AS REAL), 0),
               0
             )
           END AS full_room_value
         FROM cruise_offer_sailings relationships
         JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
         JOIN cruise_inventory inventory
           ON inventory.generation_id=relationships.generation_id
          AND inventory.canonical_key=relationships.canonical_key
         WHERE ${where.join(' AND ')}
       )
       SELECT
         COUNT(*) AS total,
         GROUP_CONCAT(DISTINCT cabin_type) AS cabin_types,
         GROUP_CONCAT(DISTINCT CASE WHEN guest_count>0 THEN guest_count END) AS guest_counts,
         GROUP_CONCAT(DISTINCT CASE WHEN point_requirement>0 THEN point_requirement END) AS point_requirements,
         MIN(NULLIF(full_room_value, 0)) AS minimum_room_value,
         MAX(NULLIF(full_room_value, 0)) AS maximum_room_value,
         MIN(CASE WHEN nights>0 THEN nights END) AS minimum_nights,
         MAX(CASE WHEN nights>0 THEN nights END) AS maximum_nights
       FROM offer_rows`,
      params,
    );

    const splitText = (value: string | null | undefined): string[] => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const splitNumbers = (value: string | null | undefined): number[] => splitText(value).map(Number).filter((item) => Number.isFinite(item) && item > 0).sort((left, right) => left - right);
    const result: CruiseOfferSailingSummary = {
      total: Number(row?.total ?? 0),
      cabinTypes: splitText(row?.cabin_types).sort((left, right) => left.localeCompare(right)),
      guestCounts: splitNumbers(row?.guest_counts),
      pointRequirements: splitNumbers(row?.point_requirements),
      minimumRoomValue: row?.minimum_room_value == null ? null : Number(row.minimum_room_value),
      maximumRoomValue: row?.maximum_room_value == null ? null : Number(row.maximum_room_value),
      minimumNights: row?.minimum_nights == null ? null : Number(row.minimum_nights),
      maximumNights: row?.maximum_nights == null ? null : Number(row.maximum_nights),
    };
    finishDiagnostic({ total: result.total, cabinTypes: result.cabinTypes.length, guestCounts: result.guestCounts.length });
    return result;
  }

  async exportAll(onBatch: (rows: Cruise[]) => Promise<void> | void, batchSize = 500, ownerScopeId?: string): Promise<number> {
    const db = await this.getDatabase();
    let batch: Cruise[] = [];
    let exported = 0;
    for await (const row of db.getEachAsync<CruiseRow>(
      `SELECT canonical_key, sail_date, raw_json FROM cruise_inventory
       WHERE owner_scope=? AND active=1 ORDER BY sail_date, canonical_key`,
      [normalizeOwnerScope(ownerScopeId)],
    )) {
      const cruise = parseCruiseRow(row);
      if (cruise) batch.push(cruise);
      if (batch.length >= batchSize) {
        await onBatch(batch);
        exported += batch.length;
        batch = [];
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    if (batch.length > 0) {
      await onBatch(batch);
      exported += batch.length;
    }
    return exported;
  }

  /**
   * Explicit compatibility/sync export. Unlike ordinary catalog queries, this
   * includes every distinct offer-sailing eligibility row so a future Royal or
   * Carnival reconciliation cannot collapse existing offers to one physical
   * sailing record.
   */
  async exportAllSourceRows(
    onBatch: (rows: Cruise[]) => Promise<void> | void,
    batchSize = 500,
    ownerScopeId?: string,
  ): Promise<number> {
    const db = await this.getDatabase();
    const scope = normalizeOwnerScope(ownerScopeId);
    let batch: Cruise[] = [];
    let exported = 0;
    for await (const row of db.getEachAsync<{ raw_json: string }>(
      `SELECT relationships.eligibility_json AS raw_json
       FROM cruise_offer_sailings relationships
       JOIN cruise_catalog_generations generations ON generations.id=relationships.generation_id
       WHERE relationships.owner_scope=? AND generations.state='active'
       UNION ALL
       SELECT inventory.raw_json AS raw_json
       FROM cruise_inventory inventory
       WHERE inventory.owner_scope=? AND inventory.active=1
         AND NOT EXISTS (
           SELECT 1 FROM cruise_offer_sailings relationships
           WHERE relationships.generation_id=inventory.generation_id
             AND relationships.canonical_key=inventory.canonical_key
         )`,
      [scope, scope],
    )) {
      try {
        batch.push(JSON.parse(row.raw_json) as Cruise);
      } catch {
        // A corrupt compatibility row is skipped, while the canonical catalog
        // remains queryable and its reconciliation ledger retains the evidence.
      }
      if (batch.length >= batchSize) {
        await onBatch(batch);
        exported += batch.length;
        batch = [];
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    if (batch.length > 0) {
      await onBatch(batch);
      exported += batch.length;
    }
    return exported;
  }

  async pruneRetiredGenerations(ownerScopeId?: string, keepPerProvider = 2): Promise<number> {
    return this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      const scope = normalizeOwnerScope(ownerScopeId);
      const rows = await db.getAllAsync<{
        id: string;
        provider: string;
        state: string;
        started_at: string;
        completed_at: string | null;
      }>(
        `SELECT id, provider, state, started_at, completed_at
         FROM cruise_catalog_generations
         WHERE owner_scope=? AND state IN ('retired','failed','staging')
         ORDER BY provider, COALESCE(completed_at, started_at) DESC`,
        [scope],
      );
      const retainedByProvider = new Map<string, number>();
      const staleCutoff = Date.now() - (24 * 60 * 60 * 1000);
      const deleteIds: string[] = [];
      rows.forEach((row) => {
        if (row.state === 'retired') {
          const retained = retainedByProvider.get(row.provider) ?? 0;
          if (retained < Math.max(1, keepPerProvider)) {
            retainedByProvider.set(row.provider, retained + 1);
          } else {
            deleteIds.push(row.id);
          }
          return;
        }
        const timestamp = Date.parse(row.completed_at || row.started_at);
        if (Number.isFinite(timestamp) && timestamp < staleCutoff) deleteIds.push(row.id);
      });
      if (deleteIds.length === 0) return 0;
      await this.withSerializedTransaction(db, async (transaction) => {
        for (const id of deleteIds) {
          await transaction.runAsync('DELETE FROM cruise_catalog_generations WHERE id=?', [id]);
        }
      });
      recordPerformanceCount('CruiseInventoryRepository.prunedGenerations', deleteIds.length, {
        ownerScope: scope,
        foregroundCompactionScheduled: false,
      });
      return deleteIds.length;
    });
  }

  async clear(ownerScopeId?: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const db = await this.getDatabase();
      await this.withSerializedTransaction(db, async (transaction) => {
        const scope = normalizeOwnerScope(ownerScopeId);
        const generations = await transaction.getAllAsync<{ id: string }>(
          'SELECT id FROM cruise_catalog_generations WHERE owner_scope=?',
          [scope],
        );
        for (const generation of generations) {
          await transaction.runAsync('DELETE FROM cruise_catalog_generations WHERE id=?', [generation.id]);
        }
        await transaction.runAsync('DELETE FROM cruise_inventory_metadata WHERE key LIKE ?', [`legacy_migration:${scope}:%`]);
      });
      this.notifyRevision();
    });
  }
}

export const cruiseInventoryRepository = new CruiseInventoryRepository();
