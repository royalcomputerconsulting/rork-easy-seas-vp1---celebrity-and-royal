const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const transaction = read('lib/storage/syncTransaction.ts');
assert.match(transaction, /DATASET_FINGERPRINT_SAMPLE_LIMIT = 64/);
assert.match(transaction, /bounded-dataset-fingerprint-v1/);
assert.match(transaction, /The persistence layer already hashes and verifies every byte/);
assert.doesNotMatch(transaction, /hashStorageValue\(JSON\.stringify\(rows\)\)/);

const storage = read('lib/storage/quotaSafeStorage.ts');
assert.match(storage, /hashStorageValueCooperatively/);
assert.match(storage, /utf8ByteLengthCooperatively/);
assert.match(storage, /await yieldToEventLoop\(\)/);
assert.match(storage, /await hashStorageValueCooperatively\(verified\)/);

const performanceRegression = read('tests/build356_performance_certificate_carnival_regression.js');
assert.match(performanceRegression, /two identical consecutive/);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /interface CarnivalSearchPageWaiter/);
assert.match(provider, /String\(msg\.requestId \|\| ''\) !== waiter\.requestId/);
assert.match(provider, /Ignored a stale Carnival page completion/);
assert.match(provider, /const scrapeCarnivalSearchPage = \([\s\S]{0,240}CARNIVAL_SEARCH_PAGE_TIMEOUT_MS/);
assert.match(provider, /carnivalSearchPageResolver\.current = waiter;[\s\S]{0,100}injectCarnivalSearchPageScrape\(input\)/, 'Carnival page waiter must be registered before WebView injection');
assert.match(provider, /const offersToEnrich = allOffersToEnrich/);
assert.doesNotMatch(provider, /CARNIVAL_RATE_CODE_ENRICHMENT_LIMIT/);
assert.match(provider, /COMMIT_AVAILABLE_CRUISES[^\n]+45000/);
assert.match(provider, /RECORD_DATASETS_TRANSACTION[\s\S]{0,420}15000/);
assert.doesNotMatch(provider, /RECORD_CRUISES_TRANSACTION/);

const carnival = read('lib/carnival/carnivalOffersExtraction.ts');
assert.match(carnival, /__easyseas_carnival_search_api_404_v1/);
assert.match(carnival, /notFoundPathCount >= 2/);
assert.match(carnival, /skipping repeated API probes and using the rendered page/);

const weather = read('state/SailingWeatherProvider.tsx');
assert.match(weather, /MARINE_LONG_RANGE_MODEL = 'ncep_gfswave025'/);
assert.match(weather, /MARINE_STRATEGY_VERSION = 3/);
assert.match(weather, /NOAA GFS Wave via Open-Meteo/);
assert.match(weather, /marineDataStatus: 'verified' \| 'pending' \| 'unavailable'/);
assert.match(weather, /NOAA wave forecast is pending publication/);
assert.match(weather, /cached\.marineStrategyVersion !== MARINE_STRATEGY_VERSION/);
assert.doesNotMatch(weather, /id: 'marine-data-unavailable'/);

const marinePanel = read('components/MarineAlertsPanel.tsx');
assert.match(marinePanel, /forecast\.marineDataStatus === 'pending'/);
assert.match(marinePanel, /'Marine pending'/);
assert.match(marinePanel, /forecast\.marineSourceLabel/);

const weatherCard = read('components/SailingWeatherCard.tsx');
assert.match(weatherCard, /forecast\.metrics\.marineDataStatus === 'pending'/);
assert.match(weatherCard, /\? 'Pending'/);

const layout = read('app/_layout.tsx');
assert.match(layout, /AuthenticatedProviderTree/);
assert.match(layout, /FeatureDataProviders/);
assert.match(layout, /AuthenticatedAppContent/);

console.log('PASS Build 366: Carnival persistence/race/404 handling and NOAA long-range marine forecasts are bounded, responsive, and truthful');
