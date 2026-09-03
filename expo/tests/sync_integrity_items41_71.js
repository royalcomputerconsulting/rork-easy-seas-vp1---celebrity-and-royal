const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const runIntegrity = read('lib/sync/syncRunIntegrity.ts');
const royalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
const royalTypes = read('lib/royalCaribbean/types.ts');
const carnivalSupport = read('lib/carnival/syncSupport.ts');
const carnivalScreen = read('app/carnival-sync.tsx');
const royalScreen = read('app/royal-caribbean-sync.tsx');
const settings = read('app/(tabs)/settings.tsx');
const weather = read('state/SailingWeatherProvider.tsx');
const weatherCard = read('components/SailingWeatherCard.tsx');

for (const counter of [
  'discoveredRows', 'normalizedRows', 'emittedRows', 'acknowledgedRows',
  'receivedRows', 'rejectedRows', 'deduplicatedRows', 'insertedRows',
  'updatedRows', 'unchangedRows', 'databaseReadbackRows',
]) {
  assert.match(runIntegrity, new RegExp(counter));
}
assert.match(runIntegrity, /createSyncOwnershipSnapshot/);
assert.match(runIntegrity, /isSyncOwnershipCurrent/);
assert.match(runIntegrity, /verifySyncReadback/);
assert.match(royalProvider, /SYNC_ACCOUNT_CHANGED/);
assert.match(royalProvider, /assertSyncOwnership\('offer persistence'\)/);
assert.match(royalProvider, /assertSyncOwnership\('storage readback'\)/);
assert.match(royalProvider, /readBackPersistedRows\(ALL_STORAGE_KEYS\.CASINO_OFFERS/);
assert.match(royalProvider, /getCruiseInventoryIntegrity/);
assert.match(royalProvider, /integrity\.durableSourceRows/);
assert.match(royalProvider, /readBackPersistedRows\(ALL_STORAGE_KEYS\.BOOKED_CRUISES/);
assert.match(royalTypes, /emittedRows: number/);
assert.match(royalTypes, /acknowledgedRows: number/);
assert.match(royalTypes, /receivedRows: number/);
assert.match(royalTypes, /databaseReadbackRows: number/);

assert.doesNotMatch(carnivalSupport, /CARNIVAL_SYNC_ROLLOUT_ENABLED\s*=\s*true/);
assert.match(carnivalSupport, /Carnival sync is an on-device workflow/);
assert.doesNotMatch(carnivalSupport, /CarnivalRemoteAccessPolicy/);
assert.doesNotMatch(carnivalSupport, /resolveCarnivalSyncAccess/);
assert.match(carnivalSupport, /createCarnivalRateCodeEvidence/);
assert.match(carnivalSupport, /hasIncompleteCarnivalRateCodes/);
assert.match(royalProvider, /Carnival pagination remains incomplete/);
assert.match(royalProvider, /Carnival did not provide terminal proof/);
assert.match(royalProvider, /carnivalRateCodesRef/);
assert.doesNotMatch(settings, /trpc\.access\.getCarnivalSyncPolicy\.useQuery/);
assert.match(settings, /function getLocalCarnivalSyncAccess/);
assert.match(settings, /getLocalCarnivalSyncAccess\(isAuthenticated, currentUser\?\.id\)/);
assert.doesNotMatch(settings, /getCarnivalSyncAccess/);
assert.doesNotMatch(settings, /getCarnivalSyncAccess\(authenticatedEmail/);
assert.doesNotMatch(carnivalScreen, /WebCookieSyncModal/);
assert.doesNotMatch(carnivalScreen, /cookieSyncMutation/);
assert.doesNotMatch(royalScreen, /WebCookieSyncModal/);
assert.doesNotMatch(royalScreen, /cookieSyncMutation/);
assert.match(carnivalScreen, /carnival-web-workspace/);
assert.match(carnivalScreen, /carnival-sync-access-notice/);

assert.match(weather, /marineDataStatus: 'verified' \| 'pending' \| 'unavailable'/);
assert.match(weather, /Marine data unavailable: EasySeas cannot assess sea state/);
assert.match(weather, /NOAA wave forecast is pending publication/);
assert.doesNotMatch(weather, /id: 'marine-data-unavailable'/);
assert.match(weather, /metrics\.marineDataStatus === 'verified' && \(severeWind \|\| severeSeas\)/);
assert.match(weatherCard, /forecast\.metrics\.marineDataStatus === 'pending'/);

console.log('Items 41-71 sync integrity regression checks passed.');
