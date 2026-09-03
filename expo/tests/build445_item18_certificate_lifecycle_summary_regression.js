const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const JSZip = require('jszip');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function withModuleStubs(stubs, callback) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    return stubs[request] ?? originalLoad.call(this, request, parent, isMain);
  };
  try { return callback(); } finally { Module._load = originalLoad; }
}

async function run() {
  const codes = read('app/certificate-codes.tsx');
  const summary = read('app/certificate-summary.tsx');
  const results = read('app/certificate-summary-results.tsx');
  const batch = read('lib/certificates/certificateBatchDownload.ts');
  const provider = read('state/CertificatesProvider.tsx');
  const bundle = read('lib/dataBundle/bundleOperations.ts');
  const availability = read('hooks/useCertificateMonthAvailability.ts');

  for (const marker of [
    'Downloaded certificate results', 'certificate-codes.metric-total',
    'certificate-codes.metric-one-guest', 'certificate-codes.metric-two-guests',
    'certificate-codes.metric-physical', 'By ship class', 'certificateSummaryByCode',
    'Total rows', 'Weekend', 'Florida', 'Shortest', 'Longest',
    "numColumns={1}", 'Download Missing / Retry Failed', 'cancel-download',
  ]) assert.ok(codes.includes(marker), `main certificate-code page is missing ${marker}`);

  for (const exactFilter of [
    "guestCounts: [1]", "guestCounts: [2]", 'weekendDepartureOnly: true',
    'floridaDepartureOnly: true', "metric: 'shortest'", "metric: 'longest'",
    "'physical_sailings'", 'shipClasses: [entry.shipClass]',
  ]) assert.ok(codes.includes(exactFilter), `certificate summary drill-down is missing ${exactFilter}`);

  for (const marker of ['Summary', 'Ships & Classes', 'Sailings', 'Data Quality', 'matrixDimension']) {
    assert.ok(summary.includes(marker), `certificate summary is missing ${marker}`);
  }

  assert.match(results, /const PAGE_SIZE = 20/);
  assert.match(results, /matching\.slice\(start, start \+ PAGE_SIZE\)/);
  assert.match(results, /certificate-summary-results\.pagination/);
  assert.match(results, /Previous certificate results page/);
  assert.match(results, /Next certificate results page/);
  assert.match(results, /certificate-summary-results\.open-cruise-/);
  for (const field of [
    'certificateCode', 'points', 'shipName', 'shipClass', 'departurePort',
    'sailDate', 'nights', 'startDay', 'endDay', 'itinerary', 'cabinLabel',
    'guestCount', 'isGty', 'nextCruiseBonusLabel',
  ]) assert.ok(results.includes(`item.${field}`), `certificate result row is missing ${field}`);

  assert.match(batch, /skipCertificateCodes/);
  assert.match(batch, /shouldCancel/);
  assert.match(batch, /CERTIFICATE_BATCH_CANCELLED/);
  assert.match(batch, /documentStorageKey/);
  assert.match(provider, /PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY/);
  assert.match(bundle, /certificateDocuments/);
  assert.match(bundle, /embedRetainedCertificateBytesForBackup/);
  assert.match(availability, /getCertificateMonthAvailability/);
  assert.match(codes, /nextMonthAvailable/);
  assert.match(codes, /priorCurrentMonthRef/);

  loadTs('lib/date.ts');
  const exporter = withModuleStubs({
    '@/lib/importExport': { exportBase64File: async () => true },
  }, () => loadTs('lib/certificates/certificateCsvZipExport.ts'));
  const built = await exporter.buildCertificateResultsZip([{
    certificateCode: '2609A05',
    parsedSailings: [{
      certificateCode: '2609A05', shipName: 'Harmony of the Seas', shipClass: 'Oasis Class',
      sailingDate: '2026-09-10', nights: 5, startDay: 'Thursday', endDay: 'Tuesday',
      departurePort: 'Port Canaveral, Florida', itinerary: 'Bahamas & Perfect Day',
      cabinCategory: 'Balcony', guestCount: 2, pointRequirement: 2000,
      gty: false, nextCruiseBonus: '$250 FreePlay',
    }],
  }], new Date('2026-09-01T12:00:00Z'));
  assert.equal(built.csvFileCount, 4);
  const zip = await JSZip.loadAsync(Buffer.from(built.base64, 'base64'));
  for (const file of [
    'certificate-summary.csv', 'certificate-ship-class-summary.csv',
    'all-certificate-sailing-options.csv', 'certificates/2609A05.csv', 'README.txt',
  ]) assert.ok(zip.file(file), `${file} is missing from certificate ZIP`);
  const classCsv = await zip.file('certificate-ship-class-summary.csv').async('string');
  assert.match(classCsv, /Ship Class,1-Guest Options,2-Guest Options/);
  assert.match(classCsv, /Oasis Class/);
  const masterCsv = await zip.file('all-certificate-sailing-options.csv').async('string');
  for (const header of [
    'Certificate Code', 'Points', 'Ship', 'Ship Class', 'Departure Port', 'Sail Date',
    'Nights', 'Start Day', 'End Day', 'Itinerary', 'Stateroom / Cabin', 'Guests',
    'GTY', 'NextCruise Bonus',
  ]) assert.ok(masterCsv.includes(header), `master certificate CSV is missing ${header}`);

  console.log('PASS Build 445 Item 18 certificate lifecycle, summaries, exact 20-row drill-downs, durable documents, and complete ZIP export');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
