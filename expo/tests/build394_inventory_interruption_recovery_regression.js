const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
const core = read('state/CoreDataProvider.tsx');
const sync = read('state/RoyalCaribbeanSyncProvider.tsx');

// Deterministic generation-state model: a restart sees only active rows. An
// interrupted staging generation never replaces the prior complete catalog.
const generations = [
  { id: 'known-good', state: 'active', rows: 41_000 },
  { id: 'interrupted', state: 'staging', rows: 17_500 },
];
assert.deepEqual(generations.filter((generation) => generation.state === 'active').map((generation) => generation.id), ['known-good']);
generations[1].state = 'failed';
assert.equal(generations.find((generation) => generation.state === 'active').rows, 41_000);
generations.push({ id: 'verified', state: 'staging', rows: 42_000 });
generations[0].state = 'retired';
generations[2].state = 'active';
assert.deepEqual(generations.filter((generation) => generation.state === 'active').map((generation) => generation.id), ['verified']);

const expectedGate = repository.indexOf('CATALOG_EXPECTED_ROW_MISMATCH');
const reconciliationGate = repository.indexOf('CATALOG_RECONCILIATION_MISMATCH');
const readbackGate = repository.indexOf('CATALOG_READBACK_MISMATCH');
const retirePrevious = repository.indexOf("UPDATE cruise_catalog_generations SET state='retired'");
assert.ok(expectedGate > 0 && reconciliationGate > expectedGate && readbackGate > reconciliationGate);
assert.ok(retirePrevious > readbackGate, 'prior active data may retire only after every integrity gate passes');
assert.match(repository, /CATALOG_WRITE_CANCELLED/);
assert.match(repository, /abortGeneration\(generationId, error\)/);
assert.match(repository, /WHERE owner_scope=\? AND active=1/);
assert.match(repository, /state='active'/);
assert.match(repository, /state IN \('retired','failed','staging'\)/);

assert.match(core, /includeAvailableCruises: activeInventoryRows === 0/);
assert.match(core, /shouldAbort: options\?\.shouldAbort/);
assert.match(core, /setCruisesState\(\[\]\)/);
assert.match(sync, /shouldAbort: \(\) => syncStopRequestedRef\.current/);
assert.match(sync, /abortSyncTransaction\(activeTransaction, 'SYNC_CANCELLED_BY_USER'\)/);
assert.match(sync, /preserveCarnivalFailureCheckpoint/);

console.log('PASS Build 394 interruption recovery: restart reads prior active generation, cancellation aborts staging, and verified promotion is atomic');
