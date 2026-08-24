const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const core = read('state/CoreDataProvider.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const scheduling = read('app/(tabs)/scheduling.tsx');
const sync = read('state/RoyalCaribbeanSyncProvider.tsx');

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

// Navigation retains state but inactive data-heavy trees cannot recompute.
assert.match(tabs, /detachInactiveScreens=\{Platform\.OS !== 'web'\}/);
assert.match(tabs, /lazy:\s*true/);
assert.match(tabs, /freezeOnBlur:\s*Platform\.OS !== 'web'/);

// Ordinary edits publish state immediately and persist the newest per-key
// snapshot only after the navigation/tap interaction has completed.
assert.match(core, /backgroundPersistenceRequestsRef\s*=\s*useRef<Map<string, BackgroundPersistenceRequest>>\(new Map\(\)\)/);
assert.match(core, /InteractionManager\.runAfterInteractions\(\(\)\s*=>\s*\{/);
assert.match(core, /backgroundPersistenceRequestsRef\.current\.set\(key,/);
assert.match(core, /await persistData\(request\.key, request\.data, \{ updateLastSync: false \}\)/);
assert.match(core, /await persistLastSyncDate\(latestSyncTimestamp\)/);
assert.match(core, /cruiseInventoryRepository\.replaceCatalog\(ownedCruises/);
assert.match(core, /getAllCruises\(\)\.then\(\(current\) => setCruises/);
assert.match(core, /scheduleBackgroundPersist\(skRef\.current\.BOOKED_CRUISES, updated\)/);
assert.match(core, /scheduleBackgroundPersist\(skRef\.current\.CASINO_OFFERS, updated\)/);
assert.match(core, /scheduleBackgroundPersist\(skRef\.current\.CALENDAR_EVENTS, updated\)/);
assert.doesNotMatch(core, /void persistData\(/);

// Authoritative sync commits remain durable/awaited and consolidate metadata.
assert.match(core, /cruiseInventoryRepository\.replaceCatalog\(ownedCruises/);
assert.match(core, /legacy_catalog_retained:/);
assert.doesNotMatch(core, /persistData\(skRef\.current\.CRUISES, ownedCruises/);
assert.match(core, /await persistData\(skRef\.current\.BOOKED_CRUISES, normalizedCruises, options\)/);
assert.match(core, /await persistData\(skRef\.current\.CASINO_OFFERS, nonMockOffers, options\)/);
assert.match(sync, /updateLastSync:\s*false,[\s\S]*markImportedData:\s*false/);
assert.match(sync, /coreDataContext\.finalizeLocalSyncMetadata\(datasetCommitTimestamp\)/);

// The large Cruises screen queries cursor pages and renders a small stable-keyed window on entry.
assert.match(scheduling, /queryCruises\(\{/);
assert.match(scheduling, /limit: activeTab === 'foryou' \? 200 : 75/);
assert.match(scheduling, /nextCatalogCursorRef/);
assert.match(scheduling, /onEndReached/);
assert.match(scheduling, /keyExtractor=\{\(item, index\) => item\.id\?\.trim\(\) \|\| `scheduled-cruise-/);
assert.match(scheduling, /initialNumToRender=\{6\}/);
assert.match(scheduling, /maxToRenderPerBatch=\{6\}/);
assert.match(scheduling, /windowSize=\{9\}/);

console.log('PASS Build 383 navigation responsiveness and coalesced background persistence regression');
