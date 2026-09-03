const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const parser = loadTs('lib/certificates/certificatePdfParserCore.ts');

// The physical-device report stopped after "Downloading official Royal PDF".
// Keep a current CVIP2 table layout here so transport and parser repairs cannot
// accidentally regress to a successful download with zero retained rows.
const cvip2Text = [
  'Offer Code Ship Departure Port Sail Date Itinerary Stateroom Type Offer Type Next Cruise OBC',
  '2608CVIP2 Icon Of The Seas® Miami, Florida September 26, 2026 7 Night Eastern Caribbean Interior Cruise Fare For 2 Guests $100',
  '2608CVIP2 Wonder Of The Seas® Miami, Florida October 4, 2026 7 Night Western Caribbean Balcony Cruise Fare For 2 Guests $100',
  '2608CVIP2 Utopia Of The Seas® Port Canaveral, Florida October 12, 2026 4 Night Bahamas Junior Suite Cruise Fare For 1 Guest $75',
].join(' ');
const rows = parser.parseCertificateSailingsFromText({
  certificateCode: '2608CVIP2',
  certificateType: 'C',
  points: 40000,
  pdfUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608CVIP2.pdf',
  monthlyIndexUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C.pdf',
}, cvip2Text);
assert.equal(rows.length, 3, 'CVIP2 material rows must survive the current flattened Royal PDF layout');
assert.deepEqual(rows.map((row) => row.sailDate), ['2026-09-26', '2026-10-04', '2026-10-12']);

const transport = read('lib/certificates/certificateBinaryTransport.ts');
assert.match(transport, /NATIVE_FILESYSTEM_TIMEOUT_MS = 12_000/);
assert.match(transport, /Promise\.race\(\[nativeDownload, timeout\]\)/);
assert.match(transport, /return await downloadWithFetch\(url, headers, timeoutMs\)/);
assert.match(transport, /Certificate PDF download failed\. Native path:/);

const store = read('lib/certificates/certificateDocumentStore.ts');
assert.match(store, /mergeMaterialCertificateSailings/);
assert.match(store, /recoveredRows\.push/);
assert.match(store, /status: 'parsed_with_warnings'/);
assert.match(store, /shared-material-row/);
assert.match(store, /mergeMaterialCertificateSailings\(parsedResult, input\.materialSailings \?\? \[\]\)/);

const originalModuleLoad = Module._load;
Module._load = function loadWithStorageStub(request, parent, isMain) {
  if (request === '../storage/quotaSafeStorage' || String(request).endsWith('/lib/storage/quotaSafeStorage')) {
    return { quotaSafeGetItem: async () => null, quotaSafeSetJsonItem: async () => ({}) };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};
const documentStore = loadTs('lib/certificates/certificateDocumentStore.ts');
const merged = documentStore.mergeMaterialCertificateSailings({
  status: 'parsed_zero_sailings',
  parserSource: 'device',
  parserVersion: 'fixture-parser',
  sailings: [],
  rejectedRows: [],
  pageReports: [],
  provenance: {
    originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608CVIP2.pdf',
    retrievedAt: '2026-08-18T00:00:00.000Z',
    documentHash: 'sha256:fixture',
    documentVersion: 'sha256:fixture',
  },
  warnings: [],
}, [rows[0]]);
assert.equal(merged.status, 'parsed_with_warnings');
assert.equal(merged.sailings.length, 1, 'material parser rows must be inserted when the archival parser returns zero');
assert.equal(merged.sailings[0].shipName, 'Icon Of The Seas');
assert.equal(merged.sailings[0].sailingDate, '2026-09-26');
assert.equal(merged.sailings[0].departurePort, 'Miami, Florida');

const panel = read('components/certificates/CertificateDownloadLogPanel.tsx');
assert.match(panel, /expo-file-system\/legacy/);
assert.match(panel, /writeAsStringAsync\(fileUri, text/);
assert.match(panel, /UTI: 'public\.plain-text'/);
assert.match(panel, /certificate-download-\$\{stamp\}\.txt/);
assert.doesNotMatch(panel, /new ExpoFile/);

const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(batch, /Royal is responding slowly; Easy Seas is trying the timed fetch fallback/);
assert.match(batch, /clearTimeout\(slowDownloadNotice\)/);

console.log('PASS Build 380 certificate device timeout, retained-row parser, and plain-text log export regression');
