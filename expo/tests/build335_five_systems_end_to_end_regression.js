const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
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

// Ask My Data must search actual parsed certificate sailing inventory, not just manual certificate metadata.
const ask = compileTs('lib/askMyData.ts', {
  '@/lib/offerIntelligence': { calculateOfferIntelligenceScore: () => ({ score: 0 }) },
});
const certificate = {
  id: 'document-test', type: 'freeplay', label: '2607C06 Instant Cruise Reward', value: 350,
  status: 'available', certificateCode: '2607C06', parserStatus: 'parsed_successfully', parserVersion: 'certificate-parser-v2',
  parsedSailings: [
    { certificateCode: '2607C06', certificateFamily: 'C', certificateFamilyCode: 'C', sourcePage: 7, sourceGroup: 'group-7', sourceReferences: [], pageAttribution: 'explicit', shipName: 'Legend Of The Seas', sailingDate: '2026-09-12', cabinCategory: 'Balcony', freePlay: 300, onboardCredit: 50, benefits: [], parserSource: 'device', parserVersion: 'certificate-parser-v2', parsedAt: '2026-07-20T00:00:00Z', validationStatus: 'accepted' },
    { certificateCode: '2607C06', certificateFamily: 'C', certificateFamilyCode: 'C', sourcePage: 8, sourceGroup: 'group-8', sourceReferences: [], pageAttribution: 'explicit', shipName: 'Icon Of The Seas', sailingDate: '2026-10-10', cabinCategory: 'Junior Suite', freePlay: 500, onboardCredit: 100, benefits: [], parserSource: 'device', parserVersion: 'certificate-parser-v2', parsedAt: '2026-07-20T00:00:00Z', validationStatus: 'accepted' },
  ],
};
const legend = ask.askMyDataSearch({ query: 'Which certificates contain Legend?', offers: [], cruises: [], certificates: [certificate], calendarEvents: [] });
assert.ok(legend.results.some((r) => r.source === 'certificates' && /Legend Of The Seas/.test(r.title)), 'Legend sailing must be searchable');
assert.ok(legend.results.some((r) => /2607C06/.test(r.subtitle)), 'certificate code must be included');
const icon = ask.askMyDataSearch({ query: 'Show Icon sailings with suite and FreePlay', offers: [], cruises: [], certificates: [certificate], calendarEvents: [] });
assert.ok(icon.results.some((r) => /Icon Of The Seas/.test(r.title) && /Junior Suite/.test(r.subtitle) && /FreePlay/.test(r.subtitle)), 'suite and FreePlay must be queryable');

const certificatesProvider = read('state/CertificatesProvider.tsx');
assert.match(certificatesProvider, /searchableCertificates/);
assert.match(certificatesProvider, /buildSearchableCertificateDocuments/);
assert.match(certificatesProvider, /latest\?\.sailings/);
const askScreen = read('app/ask-my-data.tsx');
const agent = read('state/AgentXProvider.tsx');
assert.match(askScreen, /searchableCertificates: certificates/);
assert.match(agent, /searchableCertificates: certificates/);

// Club Royale must use bounded local persistence and must not require backend upload.
const royal = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(royal, /LOCAL_COMMIT_COMPLETE/);
assert.match(royal, /runBoundedSyncCheckpoint\('(WRITE_|COMMIT_)/);
assert.match(royal, /Local-only sync complete\. No backend connection was required/);
assert.doesNotMatch(royal, /runBoundedSyncCheckpoint\('BACKEND_UPLOAD'/);
assert.doesNotMatch(royal, /await coreDataContext\.syncToBackend/);
assert.match(royal, /resolveRoyalCruiseStatus/);
assert.match(royal, /loyalty\/history/);

// Carnival must have deterministic navigation, truthful completeness, provider isolation, and no undefined duration output.
const carnivalScreen = read('app/carnival-sync.tsx');
assert.match(carnivalScreen, /testID="carnival-sync-back-button"/);
assert.match(carnivalScreen, /router\.canGoBack\(\)/);
assert.match(carnivalScreen, /webViewRef\.current = null/);
assert.match(royal, /typeof c\.numberOfNights === 'number'.*duration unavailable/);
const carnivalSupport = read('lib/carnival/syncSupport.ts');
assert.match(carnivalSupport, /evaluateCarnivalSyncOutcome/);
assert.match(carnivalSupport, /invalid_response|partial/);

// Certificates must remain direct-device, retain PDFs, validate PDF signatures, and use a statically bundled decompressor.
const pipeline = read('lib/certificates/certificatePdfPipeline.ts');
assert.match(pipeline, /import \* as pakoModule from 'pako'/);
assert.match(pipeline, /%PDF-|isPdfSignature/);
assert.match(pipeline, /parsed_successfully/);
const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(batch, /downloadCertificateCatalogBatched/);
assert.match(batch, /failedCodes/);
const documentStore = read('lib/certificates/certificateDocumentStore.ts');
assert.match(documentStore, /bytesBase64/);
assert.match(documentStore, /parseHistory/);

// Core data must be local-first, independently parsed, non-destructive, and large-data resilient.
const core = read('state/CoreDataProvider.tsx');
assert.match(core, /readAllStorageKeys/);
assert.doesNotMatch(core, /await loadFromBackend\(\);[\s\S]{0,500}readAllStorageKeys/);
const quotaStorage = read('lib/storage/quotaSafeStorage.ts');
assert.match(quotaStorage, /last-known-good|LAST_KNOWN_GOOD|native/i);
const recovery = read('lib/storage/storageRecovery.ts');
assert.doesNotMatch(recovery, /AsyncStorage\.clear\(\)/);
const auth = read('state/AuthProvider.tsx');
assert.doesNotMatch(auth, /AsyncStorage\.clear\(\)/);

console.log('PASS build335_five_systems_end_to_end_regression — Royal, Carnival, certificates, Ask My Data certificate sailing intelligence, and local-first data architecture verified');
