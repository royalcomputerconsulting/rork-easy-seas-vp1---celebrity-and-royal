const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

for (const file of [
  'lib/certificates/certificateDocumentStore.ts',
  'lib/carnival/syncSupport.ts',
  'lib/askAllOffers/storage.ts',
]) {
  const src = read(file);
  assert.match(src, /import\s+\{[^}]*quotaSafe/s, `${file} must statically import coordinated storage`);
  assert.doesNotMatch(src, /require\([^)]*quotaSafeStorage/, `${file} must not dynamically resolve storage`);
  assert.doesNotMatch(src, /AsyncStorage\.(setItem|removeItem|multiSet)/, `${file} must not bypass coordinated persistence`);
}

const recovery = read('lib/storage/storageRecovery.ts');
assert.match(recovery, /Read-only by design/);
assert.doesNotMatch(recovery, /AsyncStorage\.setItem\(STORAGE_HEALTHCHECK_KEY/);
assert.doesNotMatch(recovery, /AsyncStorage\.removeItem\(STORAGE_HEALTHCHECK_KEY/);

const transaction = read('lib/storage/syncTransaction.ts');
assert.match(transaction, /recoverIncompleteSyncTransaction/);
assert.match(transaction, /INTERRUPTED_BEFORE_COMMIT/);
assert.match(transaction, /phase: 'complete'/);
assert.match(transaction, /phase: 'aborted'/);

const layout = read('app/_layout.tsx');
assert.match(layout, /recoverIncompleteSyncTransaction/);
assert.doesNotMatch(layout, /Promise\.all\(\[ensureStorageHealthy\(\), recoverIncompleteSyncTransaction\(\)\]\)/);
assert.ok(layout.indexOf('SplashScreen.hideAsync') < layout.indexOf('recoverIncompleteSyncTransaction().catch'));

const coordinator = read('lib/storage/persistenceCoordinator.ts');
assert.match(coordinator, /cancelSupersededQueuedEntries/);
assert.match(coordinator, /active writes remain authoritative until they finish/i);
assert.match(coordinator, /flushPersistence/);

const royal = read('state/RoyalCaribbeanSyncProvider.tsx');
for (const token of ['beginSyncTransaction', 'recordSyncDataset', 'commitSyncTransaction', 'abortSyncTransaction', 'LOCAL_COMMIT_COMPLETE']) {
  assert.match(royal, new RegExp(token), `Royal sync missing ${token}`);
}
const carnivalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(carnivalProvider, /syncSource = cruiseLine === 'carnival'/, 'shared sync provider must identify Carnival transactions');
for (const token of ['beginSyncTransaction', 'recordSyncDataset', 'commitSyncTransaction', 'abortSyncTransaction']) {
  assert.match(carnivalProvider, new RegExp(token), `Carnival transaction path missing ${token}`);
}

console.log('PASS build339_final_data_integrity_regression');
