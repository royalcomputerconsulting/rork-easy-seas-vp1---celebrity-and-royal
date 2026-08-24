const assert = require('assert');
const fs = require('fs');

const coordinator = fs.readFileSync('lib/storage/persistenceCoordinator.ts', 'utf8');
const quota = fs.readFileSync('lib/storage/quotaSafeStorage.ts', 'utf8');
const certStore = fs.readFileSync('lib/certificates/certificateDocumentStore.ts', 'utf8');
const askStore = fs.readFileSync('lib/askAllOffers/storage.ts', 'utf8');

assert.match(coordinator, /activeRunByKey/, 'active writes must remain authoritative');
assert.match(coordinator, /cancelSupersededQueuedEntries/, 'queued duplicate writes must be coalesced');
assert.doesNotMatch(coordinator, /STALE_PERSISTENCE_RUN_AFTER_WRITE/, 'active writes must not be invalidated after activation');
assert.match(quota, /STALE_NATIVE_WRITE_BEFORE_ACTIVATION/, 'native activation still requires run ownership');
assert.doesNotMatch(certStore, /AsyncStorage/, 'certificate persistence must not bypass the coordinator');
assert.match(certStore, /quotaSafeSetJsonItem/, 'certificate writes must use coordinated storage');
assert.doesNotMatch(askStore, /AsyncStorage/, 'Ask My Data persistence must not bypass the coordinator');
assert.match(askStore, /quotaSafeSetJsonItem/, 'Ask My Data writes must use coordinated storage');
console.log('PASS build338 persistence/expo guard regression');
