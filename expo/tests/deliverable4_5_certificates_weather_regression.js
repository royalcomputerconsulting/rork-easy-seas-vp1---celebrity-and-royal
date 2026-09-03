const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
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

const certificates = loadStandaloneTs('lib/certificates/certificatePdfPipeline.ts');
const date = loadStandaloneTs('lib/date.ts');
const cruiseDays = loadStandaloneTs('lib/cruiseDayPipeline.ts', { './date': date });
const certificatePdf = fs.readFileSync(path.join(root, 'lib/royalCaribbean/certificatePdf.ts'), 'utf8');
const explorer = fs.readFileSync(path.join(root, 'components/CertificateExplorerModal.tsx'), 'utf8');
const certificateBatch = fs.readFileSync(path.join(root, 'lib/certificates/certificateBatchDownload.ts'), 'utf8');
const clientCertificate = fs.readFileSync(path.join(root, 'lib/certificates/clientCertificatePdfEngine.ts'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'lib/calendar/cruiseEvents.ts'), 'utf8');
const weather = fs.readFileSync(path.join(root, 'state/SailingWeatherProvider.tsx'), 'utf8');
const weatherCard = fs.readFileSync(path.join(root, 'components/SailingWeatherCard.tsx'), 'utf8');
const booked = fs.readFileSync(path.join(root, 'app/(tabs)/booked.tsx'), 'utf8');

assert.equal(certificates.classifyCertificateFamily('2607D05'), 'unclassified');
assert.equal(certificates.getCertificateFamilyDefinition('2607D05').codeClassification, 'marketing_offer');
assert.equal(certificates.classifyCertificateFamily('2607Z05'), 'unclassified');
assert.match(certificatePdf, /DIRECT_CERTIFICATE_CODE_REGEX/);
assert.match(certificatePdf, /isCertificateCode/);
assert.match(explorer, /downloadCertificateCatalogBatched/);
assert.match(certificateBatch, /downloadPublicCertificatePdf/);
assert.match(clientCertificate, /archiveCertificatePdfBytes/);
assert.doesNotMatch(certificateBatch, /trpcClient/);
assert.doesNotMatch(explorer, /D Certificates/);

const marketingPdf = new TextEncoder().encode('%PDF-1.4\n(2607D05)\n(Icon of the Seas 04/02/2026)\n(Balcony)\n(2 guests)\n(Free Play $500)');
const marketingParse = certificates.parseCertificatePdfOnDevice({
  status: 'downloaded',
  bytes: marketingPdf,
  provenance: { originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607D05.pdf', retrievedAt: '2026-07-16T00:00:00.000Z' },
}, '2607D05');
assert.equal(marketingParse.status, 'parse_failed');
assert.equal(marketingParse.sailings.length, 0);
assert.match(marketingParse.warnings[0], /marketing offer code/);

const fakePdf = new TextEncoder().encode('%PDF-1.4\n(2607A05)\n(Icon of the Seas 04/02/2026)\n(Balcony)\n(2 guests)\n(Free Play $500)\n(Onboard Credit $250)');
const parsed = certificates.parseCertificatePdfOnDevice({
  status: 'downloaded',
  bytes: fakePdf,
  provenance: { originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A05.pdf', retrievedAt: '2026-07-16T00:00:00.000Z' },
}, '2607A05');
assert.equal(parsed.status, 'parsed_successfully');
assert.equal(parsed.sailings.length, 1);
assert.equal(parsed.sailings[0].certificateFamily, 'A');
assert.equal(parsed.sailings[0].freePlay, 500);
assert.equal(parsed.sailings[0].onboardCredit, 250);
assert.equal(parsed.sailings[0].sourcePage, 1);

const variants = certificates.dedupeCertificateSailings([
  { ...parsed.sailings[0], cabinCategory: 'Balcony', freePlay: 500 },
  { ...parsed.sailings[0], cabinCategory: 'Suite', freePlay: 750 },
]);
assert.equal(variants.length, 2, 'benefit or cabin variants must not collapse');

const derivedPlan = cruiseDays.buildCruiseDayPlan({ sailDate: '2026-04-01', nights: 3 });
assert.equal(derivedPlan.returnDate, '2026-04-04');
assert.equal(derivedPlan.days.length, 4);
assert.equal(derivedPlan.integrity, 'partial');

const conflictingPlan = cruiseDays.buildCruiseDayPlan({ sailDate: '2026-04-01', returnDate: '2026-04-06', nights: 7 });
assert.equal(conflictingPlan.integrity, 'conflict');
assert.equal(conflictingPlan.days.length, 6);

const unknownItineraryPlan = cruiseDays.buildCruiseDayPlan({ sailDate: '2026-04-01', returnDate: '2026-04-03', itinerary: [{ day: 1, port: 'Miami', isSeaDay: false }] });
assert.equal(unknownItineraryPlan.days[1].isSeaDay, false);
assert.equal(unknownItineraryPlan.days[1].port, '');
assert.equal(unknownItineraryPlan.days[1].source, 'unknown');

assert.match(calendar, /buildCruiseDayPlan/);
assert.match(calendar, /Itinerary Pending/);
assert.doesNotMatch(calendar, /const totalDays = Math\.max\(1, \(typeof cruise\.nights/);
assert.match(weather, /isWithinForecastWindow/);
assert.doesNotMatch(weather, /Estimated sea-day/);
assert.match(weather, /Forecast at verified itinerary coordinates/);
assert.match(weather, /skipped for historical weather/);
assert.doesNotMatch(weather, /cruise\.destination \|\| cruise\.itineraryName/);
assert.match(weatherCard, /Forecast not available yet/);
assert.match(weatherCard, /Typical September planning range/);
assert.match(weatherCard, /dated forecast may change quickly and supersedes this climatology/);
assert.match(booked, /VoyageWeatherSection/);
assert.match(booked, /booked-sailing-weather-section/);

console.log('Deliverable 4 and 5 certificate and weather regression checks passed');
