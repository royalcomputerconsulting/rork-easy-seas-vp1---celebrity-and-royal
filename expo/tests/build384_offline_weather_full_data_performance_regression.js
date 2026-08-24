const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const weather = read('state/SailingWeatherProvider.tsx');
assert.match(weather, /findCachedForecastForCruiseDay/);
assert.ok(weather.indexOf('findCachedForecastForCruiseDay(') < weather.indexOf('const resolvedPoint = await resolveCruiseWeatherPoint'), 'offline cache lookup must precede network-dependent coordinate resolution');
assert.match(weather, /Stale-while-revalidate keeps tab changes responsive/);
assert.match(weather, /source: 'cache-stale'/);

const storage = read('lib/storage/quotaSafeStorage.ts');
const loaders = read('state/coreData/storageLoaders.ts');
const coreProvider = read('state/CoreDataProvider.tsx');
assert.match(storage, /quotaSafeGetJsonItemWithRaw/);
assert.match(loaders, /readStorageArrayWithTimeout/);
assert.match(loaders, /parsedCruisesData: cruisesResult\.value/);
assert.doesNotMatch(coreProvider, /parseJsonArray<Cruise>\(snapshot\.cruisesData/);

const askProvider = read('state/AgentXProvider.tsx');
const askScreen = read('app/ask-my-data.tsx');
assert.match(askProvider, /cachedForecasts/);
assert.match(askProvider, /casino-session-/);
assert.match(askProvider, /machine-condition-/);
assert.match(askScreen, /showAgentModes=\{false\}/);
assert.match(askScreen, /unifiedComposer/);

const certificateProvider = read('state/CertificatesProvider.tsx');
const certificateIndex = read('lib/certificates/certificateSailingIndex.ts');
const certificateStore = read('lib/certificates/certificateDocumentStore.ts');
assert.match(certificateProvider, /documentLoadRef/);
assert.match(certificateProvider, /sourceDocumentArchiveUri/);
assert.match(certificateIndex, /certificate\.sourceDocumentArchiveUri/);
assert.match(certificateStore, /parseHistory: \[\.\.\.record\.parseHistory, \.\.\.nextRecord\.parseHistory\]\.slice\(-2\)/);

const carnivalSupport = read('lib/carnival/syncSupport.ts');
const syncProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(carnivalSupport, /hasOfferSailingEvidence/);
assert.match(carnivalSupport, /collections\.offers\.count > 0 && !hasOfferSailingEvidence/);
assert.match(syncProvider, /everyDiscoveredRateCodeCompleted/);
assert.match(syncProvider, /Every discovered rate code completed pagination and returned no sailing rows/);
assert.match(syncProvider, /playerOfferId/);
assert.match(syncProvider, /offerInstanceId/);

const scheduling = read('app/(tabs)/scheduling.tsx');
assert.match(scheduling, /materialOfferCandidateIndex/);
assert.match(scheduling, /byCruiseId/);
assert.match(scheduling, /byOfferCode/);

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

console.log('PASS Build 384 offline weather, full local Agent scope, certificate hydration, Carnival completion proof, and tab performance regression');
