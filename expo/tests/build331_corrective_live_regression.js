const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
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

const pako = {
  inflate: (bytes) => new Uint8Array(zlib.inflateSync(Buffer.from(bytes))),
  inflateRaw: (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))),
};
const pipelineSource = read('lib/certificates/certificatePdfPipeline.ts');
assert.match(pipelineSource, /import \* as pakoModule from 'pako'/, 'pako must be statically bundled by Metro/Hermes');
assert.doesNotMatch(pipelineSource, /require\(['"]pako['"]\)/, 'dynamic pako require must not return in the production parser');
const pipeline = compileTs('lib/certificates/certificatePdfPipeline.ts', { pako });

const fixtures = [
  {
    code: '2607CVIP2', rows: 1097,
    first: { shipName: 'Wonder Of The Seas', sailingDate: '2026-07-10', cabinCategory: 'Grand Suite', freePlay: 2500, onboardCredit: 50 },
  },
  {
    code: '2607A01', rows: 1226,
    first: { shipName: 'Spectrum Of The Seas', sailingDate: '2026-07-07', cabinCategory: 'Junior Suite', freePlay: 1500, onboardCredit: 50 },
  },
];
for (const fixture of fixtures) {
  const pdfPath = path.join(root, 'tests/fixtures/build331', `${fixture.code}.pdf`);
  const textPath = path.join(root, 'tests/fixtures/build331', `${fixture.code}.txt`);
  assert.ok(fs.existsSync(pdfPath), `missing ${fixture.code} PDF fixture`);
  assert.ok(fs.existsSync(textPath), `missing ${fixture.code} text evidence`);
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString('latin1'), '%PDF-');
  const hash = pipeline.sha256DocumentHash(bytes);
  const parsed = pipeline.parseCertificatePdfOnDevice({
    status: 'downloaded',
    bytes,
    provenance: {
      originalUrl: `https://www.royalcaribbean.com/${fixture.code}.pdf`,
      retrievedAt: '2026-07-20T19:45:22.179Z',
      documentHash: hash,
      documentVersion: hash,
    },
  }, fixture.code);
  assert.equal(parsed.status, 'parsed_successfully', `${fixture.code} live PDF must parse`);
  assert.equal(parsed.sailings.length, fixture.rows, `${fixture.code} exact live row count`);
  for (const [key, value] of Object.entries(fixture.first)) assert.equal(parsed.sailings[0][key], value, `${fixture.code} first row ${key}`);
}

const bookingNormalization = compileTs('lib/royalCaribbean/bookingNormalization.ts');
assert.equal(bookingNormalization.resolveRoyalCruiseStatus({
  sailDate: '2023-09-02T00:00:00Z',
  completePastStartWhenEndUnknown: true,
  today: '2026-07-20',
}), 'Completed', 'old Carnival record with no end date must not be Upcoming');
assert.equal(bookingNormalization.resolveRoyalCruiseStatus({
  sailDate: '2026-07-17', endDate: '2026-07-24', today: '2026-07-20',
}), 'In Progress', 'underway Royal cruise must remain active');

const asyncStorageStub = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
const syncSupport = compileTs('lib/carnival/syncSupport.ts', {
  '../storage/quotaSafeStorage': { quotaSafeGetJsonItem: async (_key, fallback) => fallback, quotaSafeSetJsonItem: async () => {}, quotaSafeRemoveItem: async () => {} },
  '@react-native-async-storage/async-storage': { default: asyncStorageStub },
  '@/lib/storage/storageKeys': { ALL_STORAGE_KEYS: { CARNIVAL_SYNC_CHECKPOINT: 'checkpoint' }, getUserScopedKey: (key) => key },
});
const ambiguousProfileArray = [{ shipName: 'CARNIVAL PANORAMA', sailDate: '2023-09-02T00:00:00Z' }];
assert.equal(syncSupport.inspectCarnivalStructuredPayload(ambiguousProfileArray, {
  url: 'https://www.carnival.com/profilemanagement/api/v1.0/Profiles', endpoint: 'bookings',
}).bookings.length, 0, 'Profiles identity root array must not masquerade as upcoming bookings');
assert.equal(syncSupport.inspectCarnivalStructuredPayload(ambiguousProfileArray, {
  url: 'https://www.carnival.com/profilemanagement/api/bookings', endpoint: 'bookings',
}).bookings.length, 1, 'authoritative booking root arrays remain supported');
const incompleteCollections = syncSupport.createCarnivalCollectionEvidence();
incompleteCollections.offers = { status: 'unavailable', count: 0, source: 'final_reconciliation', capturedAt: new Date().toISOString() };
incompleteCollections.bookedCruises = { status: 'captured', count: 1, source: 'browser_collector', capturedAt: new Date().toISOString() };
incompleteCollections.vifpIdentity = { status: 'captured', count: 1, source: 'profile', capturedAt: new Date().toISOString() };
assert.equal(syncSupport.evaluateCarnivalSyncOutcome(incompleteCollections, {}), 'partial', 'zero unverified offers cannot be labeled complete');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /offersUrl: 'https:\/\/www\.carnival\.com\/profilemanagement\/profiles\/offers'/, 'Carnival Step 1 must use signed-in personalized offers');
assert.match(provider, /duration unavailable/, 'logs must never interpolate undefined nights');
assert.doesNotMatch(provider, /\(\$\{c\.numberOfNights\} nights\)/, 'malformed duration interpolation must be removed');
assert.match(provider, /LOCAL_COMMIT_COMPLETE/);
assert.match(provider, /Local-only sync complete\. No backend connection was required/);
assert.doesNotMatch(provider, /BACKEND_UPLOAD/, 'provider sync must not require backend upload');
assert.doesNotMatch(provider, /await coreDataContext\.syncToBackend\(\)/, 'cloud upload may not hold the local sync spinner open');
assert.match(provider, /finalProviderActiveBookedCruises/, 'final provider counts must not include Royal/Celebrity rows in Carnival summary');

const carnivalScreen = read('app/carnival-sync.tsx');
assert.match(carnivalScreen, /testID="carnival-sync-back-button"/);
assert.match(carnivalScreen, /router\.canGoBack\(\)/);
assert.match(carnivalScreen, /router\.replace\('\/settings'\)/);
assert.match(carnivalScreen, /webViewRef\.current = null/);
assert.match(carnivalScreen, /Completed Cruises:/, 'exported log must separate completed cruises');

const packageJson = JSON.parse(read('package.json'));
const appJson = JSON.parse(read('app.json'));
assert.equal(packageJson.version, '13.0.44');
assert.equal(appJson.expo.version, '13.0.44');
assert.equal(appJson.expo.ios.buildNumber, '410');
assert.equal(appJson.expo.android.versionCode, 130067);

console.log('PASS build332_corrective_live_regression — live PDFs, Carnival lifecycle/back, and nonblocking Royal commit verified');
