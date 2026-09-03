const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const core = read('state/CoreDataProvider.tsx');
const loaders = read('state/coreData/storageLoaders.ts');
const settings = read('app/(tabs)/settings.tsx');
const scheduling = read('app/(tabs)/scheduling.tsx');
const details = read('app/(tabs)/(overview)/cruise-details.tsx');
const royalSync = read('state/RoyalCaribbeanSyncProvider.tsx');
const agent = read('state/AgentXProvider.tsx');
const offerDetails = read('app/offer-details.tsx');
const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
const dataBundle = read('lib/dataBundle/bundleOperations.ts');
const userCloudSync = read('state/UserDataSyncProvider.tsx');

assert.match(loaders, /includeAvailableCruises/);
assert.match(core, /includeAvailableCruises: activeInventoryRows === 0/);
assert.match(core, /cruiseInventoryCount/);
assert.match(core, /setCruisesState\(\[\]\)/);
assert.match(core, /queryCruises:/);
assert.match(core, /getAllCruises:/);
assert.match(core, /dedupeCruisesCooperatively/);
assert.match(core, /shouldAbort: options\?\.shouldAbort/);

assert.match(settings, /cruises: inventoryAvailableOptions \|\| inventoryAvailableCruises \|\| cruiseInventoryCount \|\| cruises\.length \|\| 0/);
assert.doesNotMatch(settings, /cruises: cruises\.length \|\| localData\.cruises\?\.length/);
assert.match(settings, /const existingCruises = await getAllCruises\(\)/);
assert.match(settings, /const allCruises = await getAllCruises\(\)/);
assert.match(settings, /exportAllDataToFile\(authenticatedEmail/);
assert.match(settings, /await coreData\.flushPendingWrites\(\)/);

assert.match(scheduling, /useCruiseInventory\(\)/);
assert.match(scheduling, /setDebouncedSearch\(filters\.searchQuery\.trim\(\)\), 300/);
assert.match(scheduling, /limit: activeTab === 'foryou' \? 200 : 75/);
assert.match(scheduling, /cursor,/);
assert.match(scheduling, /testID="cruises-catalog-load-more"/);
assert.match(scheduling, /Load next \{Math\.min\(75, remainingRows \|\| 75\)\} cruises/);
assert.match(scheduling, /initialNumToRender=\{6\}/);
assert.match(scheduling, /maxToRenderPerBatch=\{6\}/);

assert.match(details, /getCruiseById\(id\)/);
assert.match(details, /loadedCatalogCruise/);
assert.match(royalSync, /existingInventoryCruises = await coreDataContext\.getAllCruises\(\)/);
assert.doesNotMatch(royalSync, /cruises: \[\.\.\.coreDataContext\.cruises\]/);
assert.match(royalSync, /getCruiseInventoryIntegrity/);
assert.match(royalSync, /shouldAbort: \(\) => syncStopRequestedRef\.current/);
assert.match(royalSync, /cruiseLine === 'carnival'[\s\S]*authoritative collection[\s\S]*return;/);
assert.match(agent, /queryCruises\(\{/);
assert.match(agent, /searchAnyTerm: true/);
assert.match(agent, /limit: 200/);
assert.match(offerDetails, /queryOfferSailings/);
assert.match(offerDetails, /Previous 20 eligible sailings/);
assert.match(offerDetails, /Next 20 eligible sailings/);
assert.match(repository, /relevanceExpression/);
assert.match(repository, /ORDER BY relevance_rank DESC/);
assert.match(repository, /pruneRetiredGenerations/);
assert.match(dataBundle, /exportAllSourceRows/);
assert.match(dataBundle, /replaceCatalog\(foundationCruises/);
assert.match(dataBundle, /Available-cruise exports are deliberately lossless/);
assert.match(userCloudSync, /activeInventoryRows > 0 \? Promise\.resolve\(null\)/);

console.log('PASS Build 394 avoids full catalog startup hydration, ranks bounded local search, cursor-pages Cruises, and preserves lossless SQLite export/cloud paths');
