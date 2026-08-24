const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const date = loadStandaloneTs('lib/date.ts');
const cruiseDays = loadStandaloneTs('lib/cruiseDayPipeline.ts', { './date': date });
const weather = read('state/SailingWeatherProvider.tsx');
const weatherCard = read('components/SailingWeatherCard.tsx');
const details = read('app/(tabs)/(overview)/cruise-details.tsx');
const availability = read('lib/casinoAvailability.ts');
const enrichment = read('state/coreData/dataEnrichment.ts');
const coreData = read('state/CoreDataProvider.tsx');
const countries = read('app/countries.tsx');
const identity = read('lib/dataIdentity.ts');
const certificates = read('lib/certificates/certificatePdfPipeline.ts');
const coverage = read('constants/easySeasFeatureCoverage.ts');
const settings = read('app/(tabs)/settings.tsx');

const plan = cruiseDays.buildCruiseDayPlan({ sailDate: '2026-12-30', nights: 3 });
assert.deepEqual(plan.days.map((day) => day.date), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
assert.equal(cruiseDays.toCruiseDateOnly('2026-04-02T23:30:00-10:00'), '2026-04-02');
assert.equal(cruiseDays.isWithinForecastWindow(new Date('1900-01-01T00:00:00.000Z')), false);

assert.match(weather, /getUTCFullYear/);
assert.match(weather, /sessionRef\.current\.generation/);
assert.match(weather, /Discarded forecast from a previous account session/);
assert.match(weather, /itineraryFingerprint/);
assert.match(weather, /clearWeatherCacheForCruise/);
assert.match(weather, /count=10/);
assert.match(weather, /normalizePortName\(result\.name \?\? ''\) === candidate/);
assert.doesNotMatch(weather, /json\.results\?\.\[0\]/);
assert.doesNotMatch(weather, /Estimated sea-day/);
assert.match(weather, /Forecast at verified itinerary coordinates/);
assert.match(weather, /skipped for historical weather/);
assert.match(weather, /marineDataStatus: 'verified' \| 'pending' \| 'unavailable'/);
assert.match(weatherCard, /EasySeas model notes/);

assert.match(details, /parsePortsAndTimes\(cruise\.portsAndTimes, 'unknown'\)/);
assert.doesNotMatch(details, /line\.split\(\/\[;,\|\\t\]\//);
assert.match(details, /Unknown port/);
assert.match(availability, /parseStructuredPortsAndTimes/);
assert.doesNotMatch(availability, /line\.split\(\/\[;,\|\\t\]\//);
assert.match(availability, /findSingleMaterialOffer/);

assert.match(enrichment, /Bundled values are fixtures/);
assert.doesNotMatch(enrichment, /KNOWN_RETAIL_VALUES/);
assert.doesNotMatch(enrichment, /findReceiptByShipAndDate/);
assert.doesNotMatch(enrichment, /findFreeplayOBCByOfferCode/);
assert.match(coreData, /Demo cruise restoration is disabled in production data paths/);
assert.doesNotMatch(settings, /generateSampleData/);
assert.doesNotMatch(settings, /SAMPLE_LOYALTY_POINTS/);
assert.doesNotMatch(countries, /COMPLETED_CRUISES_DATA/);
assert.doesNotMatch(countries, /BOOKED_CRUISES_DATA/);
assert.doesNotMatch(countries, /CRUISE_HISTORY_SUPPLEMENT_DATA/);

assert.match(identity, /CRITICAL_RECONCILIATION_FIELDS/);
assert.match(identity, /isRecordIncomplete/);
assert.match(identity, /isAtLeastAsAuthoritative/);
assert.match(certificates, /CertificatePdfProvenance/);
assert.match(certificates, /reconcileCertificateParserResults/);
assert.match(coverage, /Operational Data Authority/);
assert.match(coverage, /Live authenticated device validation/);

console.log('Items 72-122 data-integrity regression checks passed');
