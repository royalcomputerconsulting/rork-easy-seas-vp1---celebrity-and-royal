const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { selectCruiseInventoryProviderRows } = loadTs('lib/cruiseInventory/cruiseCanonicalIdentity.ts');
const { applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');

function sailing(provider, index, offerIndex = 0) {
  const ship = provider === 'royal'
    ? 'Harmony of the Seas'
    : provider === 'celebrity'
      ? 'Celebrity Equinox'
      : 'Carnival Celebration';
  const offerCode = `${provider.toUpperCase()}-${String(offerIndex + 1).padStart(2, '0')}`;
  return {
    id: `${provider}-sailing-${index}`,
    sourceRecordId: `${provider}-source-${index}`,
    cruiseSource: provider,
    offerSource: provider,
    offerCode,
    offerName: `${provider} offer ${offerIndex + 1}`,
    playerOfferId: `${provider}-instance-${offerIndex + 1}`,
    shipName: ship,
    sailDate: `2027-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    returnDate: `2027-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 2).padStart(2, '0')}`,
    nights: 1,
    cabinType: index % 2 ? 'Balcony' : 'Interior',
    guests: index % 3 ? '2 Guests' : '1 Guest',
    status: 'available',
  };
}

const royalRows = Array.from({ length: 3151 }, (_, index) => sailing('royal', index, index % 13));
const celebrityRows = Array.from({ length: 46 }, (_, index) => sailing('celebrity', index, index % 3));
const carnivalRows = Array.from({ length: 2597 }, (_, index) => sailing('carnival', index, index % 7));
const combined = [...celebrityRows, ...royalRows, ...carnivalRows];

assert.equal(selectCruiseInventoryProviderRows(combined, ['royal']).length, 3151, 'Royal catalog commit must keep all 3,151 row-distinct options');
assert.equal(selectCruiseInventoryProviderRows(combined, ['celebrity']).length, 46);
assert.equal(selectCruiseInventoryProviderRows(combined, ['carnival']).length, 2597);
assert.equal(selectCruiseInventoryProviderRows(combined).length, combined.length, 'full restore must still be able to replace every provider');
assert.equal(new Set(royalRows.map((row) => row.playerOfferId)).size, 13, 'the acceptance fixture must carry 13 distinct Royal offer instances');

const oldRoyal = sailing('royal', 9000, 0);
oldRoyal.ownerProfileId = 'primary';
const preservedCelebrity = { ...sailing('celebrity', 9001, 0), ownerProfileId: 'primary' };
const preservedCarnival = { ...sailing('carnival', 9002, 0), ownerProfileId: 'primary' };
const incomingRoyal = { ...sailing('royal', 9100, 1), ownerProfileId: 'primary' };
const applied = applySyncPreview({
  offers: { new: [], updates: [], unchanged: [] },
  cruises: { new: [incomingRoyal], updates: [], unchanged: [] },
  bookedCruises: { new: [], updates: [], unchanged: [] },
  loyalty: null,
}, [], [oldRoyal, preservedCelebrity, preservedCarnival], [], 'royal', {
  allowOfferRemoval: false,
  allowCruiseRemoval: true,
  allowBookedCruiseRemoval: false,
  targetOwnerProfileId: 'primary',
  includeUnownedRecords: false,
});
assert.ok(applied.cruises.some((row) => row.id === incomingRoyal.id));
assert.ok(!applied.cruises.some((row) => row.id === oldRoyal.id), 'the prior Royal scope must be replaced');
assert.ok(applied.cruises.some((row) => row.id === preservedCelebrity.id), 'Celebrity must survive Royal refresh');
assert.ok(applied.cruises.some((row) => row.id === preservedCarnival.id), 'Carnival must survive Royal refresh');

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repository, /selectCruiseInventoryProviderRows\(cruises, options\.providersToReplace\)/);
assert.match(repository, /withExclusiveTransactionAsync/);

const core = read('state/CoreDataProvider.tsx');
assert.match(core, /providersToReplace: options\?\.cruiseInventoryProviders/);
assert.match(core, /onCruiseInventoryCommitted\?\./);
assert.match(core, /activeCounts: activeInventoryCounts/);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /providerReconciliations\.every/);
assert.match(provider, /cruiseInventoryProviders: \[syncSource\]/, 'provider sync must physically replace only its own SQLite generation');
assert.match(provider, /SYNC_PROVIDER_GENERATION_READBACK_FAILED/);
assert.match(provider, /SYNC_COMMITTED_READBACK_VERIFIED/);
assert.match(provider, /commitRunId: committedRunId/);
assert.match(provider, /inventoryGenerationIds: cruiseInventoryReadback\.generationIds/);
assert.match(provider, /grandTotalAvailableCruiseRows:/);
assert.match(provider, /availableCruiseRowsAfterReconciliation =\s*cruiseInventoryReadback\?\.providerAvailableRows/);

const readbackIndex = provider.indexOf("'READBACK_AVAILABLE_CRUISES'");
const commitIndex = provider.indexOf("'FINALIZE_LOCAL_TRANSACTION'");
const publishIndex = provider.indexOf("'PUBLISH_LOCAL_COMMIT'");
const finalStatusIndex = provider.indexOf("console.log('[RoyalCaribbeanSync] Setting final sync status:'");
assert.ok(readbackIndex >= 0 && commitIndex > readbackIndex, 'manifest commit must follow storage and SQLite readback');
assert.ok(publishIndex > commitIndex, 'live publication must follow committed manifest');
assert.ok(finalStatusIndex > publishIndex, 'success/complete status must follow committed readback and publication');

console.log('PASS Build 445 Item 1: 13 Royal offers / 3,151 row-distinct sailings, provider-only replacement, exclusive transaction, committed generation receipt, and success ordering');
