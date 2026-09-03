#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const health = read('lib/database/HealthTrustDatabase.ts');
const migration = read('lib/database/highVolumeMigration.ts');
const repository = read('lib/database/highVolumeRepository.ts');
const cruiseRepository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
const startup = read('state/CoreDataProvider.tsx');
const storageLoader = read('state/coreData/storageLoaders.ts');
const cruiseHook = read('hooks/useCruiseInventory.ts');

assert.match(health, /HEALTH_TRUST_SCHEMA_VERSION = 6/);
assert.match(health, /PRAGMA foreign_keys=ON/);
assert.match(health, /PRAGMA journal_mode=WAL/);
assert.match(health, /withTransactionAsync/);
for (const table of ['schema_migrations', 'migration_checkpoints', 'domain_records', 'provenance_links', 'integrity_issues', 'repair_history', 'backup_manifests', 'backup_dataset_entries', 'integrity_quarantine', 'migration_rollback_history']) {
  assert.match(health, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `versioned database table missing: ${table}`);
}
for (const contract of ['FOREIGN KEY(issue_id)', 'FOREIGN KEY(base_backup_id)', 'FOREIGN KEY(backup_id)', 'idx_domain_records_owner_domain', 'idx_migration_checkpoint_owner', 'idx_provenance_entity']) {
  assert.ok(health.includes(contract), `foreign-key/index contract missing: ${contract}`);
}

for (const domain of ['booked_cruises', 'casino_offers', 'calendar_events', 'casino_sessions', 'certificates', 'crew_recognition', 'crew_sailings', 'machine_encyclopedia', 'slot_atlas']) {
  assert.match(migration, new RegExp(`domain: '${domain}'`), `migration inventory missing ${domain}`);
}
for (const contract of ['::migration::', '::rollback::', 'last_index', 'source_hash', 'await yieldToUi()', 'state=\'rolled_back\'', 'migration_rollback_history']) {
  assert.ok(migration.includes(contract), `resumable migration contract missing: ${contract}`);
}

for (const contract of ['listHighVolumeDomainPage', 'countDomainRecordsFiltered', 'listDomainRecordsFiltered', 'replaceDomainRecords', 'hydrateHighVolumeDomain']) {
  assert.ok(repository.includes(contract), `indexed repository API missing: ${contract}`);
}
assert.match(repository, /if \(await countDomainRecords\(effectiveOwner, definition\.domain\) === 0\)/);
assert.match(repository, /await migrateHighVolumeDomain/);
assert.match(repository, /return listAllDomainRecords<T>/);

assert.match(startup, /cruiseInventoryRepository\.getCounts/);
assert.match(startup, /hydrateHighVolumeDomain<BookedCruise>/);
assert.match(startup, /hydrateHighVolumeDomain<CasinoOffer>/);
assert.match(startup, /hydrateHighVolumeDomain<CalendarEvent>/);
assert.match(startup, /includeAvailableCruises: activeInventoryRows === 0/);
assert.match(startup, /includeHighVolumeCore: false/);
assert.match(storageLoader, /includeHighVolumeCore \? readStorageArrayWithTimeout<BookedCruise>/);
assert.match(storageLoader, /includeAvailableCruises\s*\? readStorageArrayWithTimeout<Cruise>/s);
assert.match(cruiseHook, /cruiseInventoryRepository\.query/);
assert.match(cruiseHook, /cruiseInventoryRepository\.queryOfferSailings/);
assert.match(cruiseHook, /cruiseInventoryRepository\.getFacets/);

for (const provider of [
  'state/CertificatesProvider.tsx',
  'state/CasinoSessionProvider.tsx',
  'state/CrewRecognitionProvider.tsx',
  'state/SlotMachineLibraryProvider.tsx',
]) {
  const source = read(provider);
  assert.match(source, /(hydrate|list|replace)HighVolumeDomain/, `${provider} must use the indexed repository during normal runtime`);
}

for (const contract of ['owner_scope', 'FOREIGN KEY(generation_id)', 'idx_cruise_inventory_owner_active_date', 'idx_cruise_offer_sailing_offer', 'DEFAULT_CRUISE_INGEST_BATCH_SIZE = 500', 'getEachAsync']) {
  assert.ok(cruiseRepository.includes(contract), `cruise inventory repository contract missing: ${contract}`);
}
assert.doesNotMatch(cruiseRepository, /AsyncStorage/);

console.log('PASS Build 445 Item 42 database acceptance: schema v6, transactions, FKs/indexes, resumable staged migrations and rollback, normal provider cutover, startup JSON bypass, and paged cruise/list queries are all wired.');
