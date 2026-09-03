const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const tabs = read('app/(tabs)/_layout.tsx');
const core = read('state/CoreDataProvider.tsx');
const storage = read('lib/storage/quotaSafeStorage.ts');
const certificates = read('state/CertificatesProvider.tsx');
const certificateCodes = read('app/certificate-codes.tsx');
const certificateLookup = read('app/certificate-lookup.tsx');
const slotLibrary = read('state/SlotMachineLibraryProvider.tsx');
const slotsScreen = read('app/(tabs)/machines.tsx');
const agent = read('state/AgentXProvider.tsx');
const askMyData = read('app/ask-my-data.tsx');
const offerIntelligence = read('lib/offerIntelligence.ts');
const overview = read('app/(tabs)/(overview)/index.tsx');
const priceHistory = read('state/PriceHistoryProvider.tsx');
const priceSync = read('lib/usePriceTrackingSync.ts');
const weather = read('state/SailingWeatherProvider.tsx');
const providerSync = read('state/RoyalCaribbeanSyncProvider.tsx');
const cloud = read('state/UserDataSyncProvider.tsx');

assert.equal(app.version, '13.0.45');
assert.equal(String(app.ios.buildNumber), '411');
assert.equal(app.android.versionCode, 130068);
assert.equal(pkg.version, '13.0.45');

// Preserve the Build 339 navigation surface and background inactive screens.
for (const route of ['(overview)', 'scheduling', 'booked', 'events', 'analytics', 'machines', 'settings']) {
  assert.ok(tabs.includes(`name="${route}"`), `missing stable tab route ${route}`);
}
assert.match(tabs, /lazy:\s*true/);
assert.match(tabs, /freezeOnBlur:\s*Platform\.OS !== 'web'/);

// Core startup remains local-first, fail-open, coherent, and measurable.
assert.match(core, /cruiseInventoryRepository\.getCounts\(inventoryOwnerScope\)/);
assert.match(core, /includeAvailableCruises: activeInventoryRows === 0/);
assert.match(core, /cruiseInventoryRepository\.migrateLegacyCatalog/);
assert.match(core, /CORE_DATA_HYDRATION_TIMING/);
assert.match(core, /setCasinoOffersState\(hydratedOffers\);[\s\S]*setCruisesState\(parsedCruises\);[\s\S]*setBookedCruisesState\(ownedBookedCruises\);[\s\S]*setCalendarEventsState\(ownedEvents\)/);
assert.match(core, /InteractionManager\.runAfterInteractions/);

// Typed JSON provider reads parse the transactional value once instead of
// routing through quotaSafeGetItem's validation parse first.
const typedJsonReader = storage.slice(storage.indexOf('export async function quotaSafeGetJsonItem'), storage.indexOf('export async function quotaSafeRemoveItem'));
assert.match(typedJsonReader, /raw = await readRawStoredValue\(key\)/);
assert.doesNotMatch(typedJsonReader, /quotaSafeGetItem\(key\)/);
assert.match(typedJsonReader, /readLastGoodValue\(key\)/);

// Heavy certificate and machine collections hydrate on their consumer screen,
// not merely because the application provider tree mounted.
const certificateStartupEffect = certificates.slice(certificates.indexOf('// Certificate documents can contain'), certificates.indexOf('useEffect(() => {', certificates.indexOf('// Certificate documents can contain')));
assert.doesNotMatch(certificateStartupEffect, /loadCertificateDocuments/);
assert.match(certificateCodes, /void refreshCertificateDocuments\(\)/);
assert.match(certificateLookup, /void refreshCertificateDocuments\(\)/);
assert.doesNotMatch(slotLibrary, /setTimeout\([^)]*initializeAndLoadData/);
assert.match(slotsScreen, /InteractionManager\.runAfterInteractions\([\s\S]*void reload\(\)/);
assert.match(askMyData, /void refreshCertificateDocuments\(\)/);
assert.match(askMyData, /void reloadSlotLibrary\(\)/);

// The hidden Agent does not build the full multi-provider narrative index.
assert.match(agent, /if \(!isVisible\) return \[\]/);
assert.match(askMyData, /setVisible\(true\)/);

// Offer intelligence creates one association index, retains instance identity,
// and visible cards score only their already-associated sailings.
assert.match(offerIntelligence, /interface CruiseAssociationIndex/);
assert.match(offerIntelligence, /const associationIndex = buildCruiseAssociationIndex\(cruises\)/);
assert.match(offerIntelligence, /const instanceKey = getOfferInstanceKey\(offer\)/);
assert.match(overview, /calculateOfferIntelligenceScore\(item\.representativeOffer, item\.cruises/);

// Price tracking batches hydrated offers into one state publication and waits
// for navigation interactions before beginning non-urgent work.
assert.match(priceHistory, /if \(recordsToAdd\.length > 0\) \{[\s\S]*setPriceHistory\(\(previous\) => \[\.\.\.previous, \.\.\.recordsToAdd\]\)/);
assert.doesNotMatch(priceHistory.slice(priceHistory.indexOf('const bulkRecordFromOffers'), priceHistory.indexOf('const getPriceDrops')), /recordPriceFromOffer\(/);
assert.match(priceSync, /InteractionManager\.runAfterInteractions/);

// Weather refresh is still four-hour cached, but cannot compete with cold-start
// interactions. Provider sync durability/readback and manual-only cloud remain.
assert.match(weather, /BACKGROUND_PREFETCH_DELAY_MS = 8000/);
assert.match(weather, /InteractionManager\.runAfterInteractions/);
assert.match(providerSync, /await Promise\.all\(\[[\s\S]*COMMIT_OFFERS[\s\S]*COMMIT_AVAILABLE_CRUISES[\s\S]*COMMIT_BOOKINGS_HISTORY/);
assert.match(providerSync, /READBACK_OFFERS[\s\S]*READBACK_AVAILABLE_CRUISES[\s\S]*READBACK_BOOKINGS_AND_HISTORY/);
assert.match(cloud, /automatic backend restore is disabled/i);

console.log('PASS Build 383 end-to-end local data path, cold-start scheduling, and transactional sync regression');
