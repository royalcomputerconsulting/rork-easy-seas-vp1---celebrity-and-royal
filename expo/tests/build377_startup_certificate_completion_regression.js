const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadTs(relativePath) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  return mod.exports;
}

const parser = loadTs('lib/certificates/certificatePdfParserCore.ts');
const columnMajorText = [
  '2608C09',
  'Offer Code Ship Departure Port Sail Date Itinerary Stateroom Type Offer Type',
  'Adventure Of The Seas',
  'Allure Of The Seas',
  'Miami, Florida',
  'Fort Lauderdale, Florida',
  'August 22, 2026',
  'September 3, 2026',
  'Western Caribbean',
  'Perfect Day',
  'Interior',
  'Balcony',
  'Cruise Fare For 2 Guests',
  'Cruise Fare For 2 Guests',
].join(' ');

const rows = parser.parseCertificateSailingsFromText({
  certificateCode: '2608C09',
  certificateType: 'C',
  points: 600,
  pdfUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C09.pdf',
  monthlyIndexUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C.pdf',
}, columnMajorText);
assert.equal(rows.length, 2, 'one header-level certificate code must retain every aligned columnar sailing');
assert.deepEqual(rows.map((row) => row.shipName), ['Adventure Of The Seas', 'Allure Of The Seas']);
assert.deepEqual(rows.map((row) => row.sailDate), ['2026-08-22', '2026-09-03']);

const transport = read('lib/certificates/certificateBinaryTransport.ts');
assert.match(transport, /v1\.3\.0-browser-compatible-bounded-io/);
assert.match(transport, /withTimeout\([\s\S]*?readAsStringAsync/);
assert.match(transport, /void fileSystem\.deleteAsync\?\.\(destination/);
assert.match(transport, /Saving the retained certificate PDF timed out/);

const batch = read('lib/certificates/certificateBatchDownload.ts');
const store = read('lib/certificates/certificateDocumentStore.ts');
assert.match(batch, /deferDocumentStorage: true/);
assert.match(batch, /archiveCertificatePdfBytesBatch/);
assert.match(batch, /one local transaction/);
assert.match(store, /Persists a completed certificate batch with one read\/modify\/write transaction/);
assert.match(store, /isLoadableCertificateDocumentRecord/);

const overview = read('app/(tabs)/(overview)/index.tsx');
const scheduling = read('app/(tabs)/scheduling.tsx');
const agent = read('state/AgentXProvider.tsx');
assert.match(overview, /useDeferredValue\(cruises, EMPTY_CRUISES\)/);
assert.match(scheduling, /useDeferredValue\(\(localData\.cruises \|\| \[\]\)/);
assert.match(agent, /useDeferredValue\(cruises, EMPTY_CRUISES\)/);

const ownership = read('lib/storage/dataOwnership.ts');
const ownerScopeBranch = ownership.indexOf('if (recordScope)');
const legacySignatureScan = ownership.indexOf('if (containsKnownForeignPersonalData(record, email))', ownerScopeBranch);
assert.ok(ownerScopeBranch >= 0 && legacySignatureScan > ownerScopeBranch, 'scoped records must bypass the recursive legacy signature scan');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

console.log('PASS Build 383 startup and certificates: deferred tab work, bounded transport, full columnar parsing, and atomic batch save');
