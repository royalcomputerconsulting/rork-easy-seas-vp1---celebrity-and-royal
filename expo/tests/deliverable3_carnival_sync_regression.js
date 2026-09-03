const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const support = read('lib/carnival/syncSupport.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const settings = read('app/(tabs)/settings.tsx');
const screen = read('app/carnival-sync.tsx');
const monitor = read('lib/royalCaribbean/networkMonitorScript.ts');
const collectors = read('lib/carnival/carnivalOffersExtraction.ts');
const types = read('lib/royalCaribbean/types.ts');

assert.match(support, /export function getCarnivalSyncAccess/);
assert.match(support, /authentication_required/);
assert.match(support, /return \{ state: 'enabled', enabled: true/);
assert.doesNotMatch(support, /isAdmin/);

assert.match(support, /CARNIVAL_SYNC_CHECKPOINT_VERSION/);
assert.match(support, /profile_mismatch/);
assert.match(support, /account_mismatch/);
assert.match(support, /sanitizeBookedCruiseRows/);
assert.match(support, /evaluateCarnivalSyncOutcome/);

assert.match(provider, /persistCarnivalCheckpoint/);
assert.match(provider, /resumeCarnivalSync/);
assert.match(provider, /CARNIVAL_SYNC_CANCELLED/);
assert.match(provider, /inspectCarnivalStructuredPayload/);
assert.match(provider, /carnivalOutcome === 'invalid_response'/);
assert.match(provider, /carnivalOutcome === 'partial'/);
assert.match(provider, /carnivalVifpPoints/);

const carnivalQuickAction = settings.slice(settings.indexOf('Sync Carnival Cruises') - 700, settings.indexOf('Sync Carnival Cruises') + 300);
assert.match(carnivalQuickAction, /carnivalSyncAccess\.enabled/);
assert.doesNotMatch(carnivalQuickAction, /isAdmin\s*&&/);

assert.match(screen, /Resume Saved Carnival Sync/);
assert.match(screen, /complete_with_warnings/);
assert.match(screen, /Partial Sync Saved/);

assert.match(monitor, /carnival_structured_payload/);
assert.match(monitor, /let the app classify its structure instead of treating the URL as authority/);
assert.match(collectors, /Prioritizing Carnival JSON already used by the signed-in page/);
assert.match(collectors, /No live JSON or page offer data was available; trying API fallback paths/);
assert.match(collectors, /No signed-in page JSON was available; trying limited booking API fallback paths/);

assert.match(types, /'complete_with_warnings'/);
assert.match(types, /'resumable'/);
assert.match(types, /CarnivalCollectionEvidenceMap/);

console.log('Deliverable 3 Carnival sync regression checks passed');
