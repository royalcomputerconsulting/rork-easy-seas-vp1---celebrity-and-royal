const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const {
  collapseOfferSailingRowsToOfferInstances,
  selectAuthoritativeOfferInstances,
} = loadTs('lib/offers/offerInstanceIdentity.ts');

const offer = (instance, row = 0) => ({
  id: `offer-${instance}-${row}`,
  playerOfferId: `royal-instance-${instance}`,
  offerCode: `2609A${String(instance).padStart(2, '0')}`,
  offerName: `Royal offer ${instance}`,
});
const authoritative = Array.from({ length: 13 }, (_, index) => offer(index + 1));
const legacyRows = Array.from({ length: 3151 }, (_, index) => offer((index % 13) + 1, index));
assert.equal(collapseOfferSailingRowsToOfferInstances(legacyRows).length, 13);
assert.equal(
  selectAuthoritativeOfferInstances(authoritative, legacyRows, true).length,
  13,
  'Hydrated CoreData must remain the only Settings/Offers/Command Center offer authority',
);
assert.equal(
  selectAuthoritativeOfferInstances([], legacyRows, false).length,
  13,
  'The legacy snapshot may prevent a false startup zero only while CoreData is hydrating',
);
assert.equal(
  selectAuthoritativeOfferInstances([], legacyRows, true).length,
  0,
  'Once authoritative hydration completes, stale legacy rows must not be merged back in',
);

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const settings = read('app/(tabs)/settings.tsx');
const overview = read('app/(tabs)/(overview)/index.tsx');
const commandCenter = read('app/war-room.tsx');
const hook = read('hooks/useCruiseInventory.ts');
const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
const restore = read('lib/dataBundle/bundleOperations.ts');
const trustCenter = read('app/data-trust-center.tsx');

assert.match(settings, /selectAuthoritativeOfferInstances/);
assert.match(settings, /!coreData\.isLoading/);
assert.match(settings, /settings-data-overview-loading/);
assert.match(settings, /inventoryPhysicalSailings/);
assert.match(overview, /offers-hydration-loading/);
assert.match(overview, /dataLoading=\{coreDataLoading\}/);
assert.match(commandCenter, /command-center-hydration-loading/);
assert.match(commandCenter, /!coreDataLoading && totalManagementCount === 0/);
assert.match(hook, /setCounts\(EMPTY_COUNTS\)[\s\S]*setIsInventoryReady\(false\)[\s\S]*setOwnerScopeId/);
assert.match(hook, /totalPhysicalSailings/);
assert.match(repository, /SELECT COUNT\(\*\) AS count FROM cruise_inventory\s+WHERE owner_scope=\? AND active=1/);
assert.match(restore, /Cruise catalog readback incomplete/);
assert.match(restore, /Offer catalog readback incomplete/);
assert.match(settings, /pathname: '\/data-trust-center', params: \{ intent: 'restore' \}/, 'Settings must route Load All through the conflict-safe restore workflow');
assert.match(trustCenter, /await core\.refreshData\(\);[\s\S]*const readback = await currentBackupContext\(\)/, 'The trust center must publish the committed restore generation before exact readback and success');

console.log('PASS Build 445 Item 7: startup never publishes false zeroes, authoritative offer instances cannot merge with stale fallback rows, option/physical counts remain distinct, and backup restore requires repository readback');
