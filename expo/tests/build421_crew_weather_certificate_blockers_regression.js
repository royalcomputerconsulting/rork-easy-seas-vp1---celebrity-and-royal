const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const crewProvider = read('state/CrewRecognitionProvider.tsx');
const crewScreen = read('components/crew-recognition/CrewRecognitionSection.tsx');
const bundle = read('lib/dataBundle/bundleOperations.ts');
const settings = read('app/(tabs)/settings.tsx');
const appEvents = read('lib/appDataEvents.ts');
assert.match(crewProvider, /filteredLocalEntries\.slice\(start, start \+ pageSize\)/, 'crew rendering must use a bounded page');
assert.match(crewProvider, /InteractionManager\.runAfterInteractions/, 'large import work must yield to navigation');
assert.match(crewProvider, /ensureLocalDataLoaded/, 'crew records must hydrate only when their screen requests them');
assert.match(crewProvider, /On-demand local data loaded for user/);
assert.doesNotMatch(crewProvider, /CREW_STARTUP_HYDRATION_DELAY_MS/, 'root crew hydration must not compete with startup');
assert.match(crewScreen, /crew-recognition\.pagination/);
assert.match(crewScreen, /showing at most \{pageSize\}/);
assert.doesNotMatch(bundle, /filterRecordsForProfileGate\(crewEntries/, 'account-scoped crew rows must not be removed by a cruise-profile filter');
assert.doesNotMatch(bundle, /filterRecordsForProfileGate\(bundle\.crewRecognition\.entries/, 'restored crew rows must remain lossless');
assert.match(settings, /emitAppDataEvent\('cloudDataRestored'\)/);
assert.match(appEvents, /subscribeToAppDataEvent/);

const weather = read('state/SailingWeatherProvider.tsx');
const weatherCard = read('components/SailingWeatherCard.tsx');
assert.match(weather, /FORECAST_PREFETCH_HORIZON_DAYS = 16/);
assert.match(weather, /forecast_days=16/);
assert.match(weather, /api\.open-meteo\.com\/v1\/gfs/);
assert.match(weather, /Best-match weather failed; retrying NOAA GFS/);
assert.match(weatherCard, /manualRefreshMessage/);
assert.match(weatherCard, /both live forecast providers returned no usable data/);

const batch = read('lib/certificates/certificateBatchDownload.ts');
const codes = read('app/certificate-codes.tsx');
const lookup = read('app/certificate-lookup.tsx');
const pdf = read('lib/royalCaribbean/certificatePdf.ts');
assert.match(batch, /Downloading \$\{ordinal\} of \$\{discoveredEntries\.length\}/);
assert.match(batch, /skippedCompletedCodes\.length \+ completedCodes, discoveredEntries\.length/);
assert.match(batch, /Certificate download complete:/);
assert.match(codes, /missingArchiveCodes/);
assert.match(codes, /FileSystem\.getInfoAsync/);
assert.match(lookup, /Once any real document\/catalog result exists/);
assert.match(pdf, /Retained PDF is missing; opening the official Royal source instead/);

console.log('PASS Build 421 crew paging/backup, actionable weather retry, and reconciled certificate library progress');
