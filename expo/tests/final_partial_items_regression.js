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

const pipeline = loadStandaloneTs('lib/certificates/certificatePdfPipeline.ts');
const bytes = new Uint8Array(Buffer.from('%PDF-1.4\n(2607A02A)\n(Icon of the Seas 04/02/2026)\n(Balcony)\n(2 Guests)\n(Free Play $500)'));
const documentHash = pipeline.sha256DocumentHash(bytes);
const download = {
  status: 'downloaded',
  bytes,
  provenance: { originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A02A.pdf', retrievedAt: '2026-07-16T00:00:00.000Z', documentHash, documentVersion: documentHash },
};
const device = pipeline.parseCertificatePdfOnDevice(download, '2607A02A');
const backend = pipeline.parseCertificatePdfTextOnBackend('2607A02A\nIcon of the Seas 04/02/2026\nBalcony\n2 Guests\nFree Play $500', { originalUrl: download.provenance.originalUrl, retrievedAt: download.provenance.retrievedAt }, '2607A02A');
const comparison = pipeline.reconcileCertificateParserResults(backend, device);
assert.equal(comparison.status, 'equivalent', 'transport hashes must not create a false parser disagreement');

const storage = new Map();
const documentStore = loadStandaloneTs('lib/certificates/certificateDocumentStore.ts', {
  '../storage/quotaSafeStorage': {
    quotaSafeGetItem: async (key) => (typeof storage !== 'undefined' ? storage.get(key) ?? null : typeof stored !== 'undefined' ? stored.get(key) ?? null : null),
    quotaSafeSetJsonItem: async (key, value) => { const target = typeof storage !== 'undefined' ? storage : typeof stored !== 'undefined' ? stored : null; if (target) target.set(key, JSON.stringify(value)); },
  },
  '@react-native-async-storage/async-storage': { default: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) } },
  './certificatePdfPipeline': pipeline,
});

(async () => {
  const stored = await documentStore.storeCertificateDocument('profile-a', download, device, { backendResult: backend, comparison });
  assert.equal(stored.schemaVersion, 5);
  assert.equal(stored.parserReconciliations.length, 1);
  assert.equal(stored.parserReconciliations[0].status, 'equivalent');
  const restored = await documentStore.listCertificateDocuments('profile-a');
  assert.equal(restored[0].parserReconciliations.length, 1);

  const indexBytes = new Uint8Array(Buffer.from('%PDF-1.4\n(2607A)\n(2607A01)\n(2607A02A)'));
  const indexHash = pipeline.sha256DocumentHash(indexBytes);
  const indexDownload = {
    status: 'downloaded',
    bytes: indexBytes,
    provenance: { originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A.pdf', retrievedAt: '2026-07-16T00:00:00.000Z', documentHash: indexHash, documentVersion: indexHash },
  };
  const discoveredCodes = pipeline.discoverCertificateCodesFromDownloadedPdf(indexDownload, { monthCode: '2607', familyCodes: ['A'] });
  assert.deepEqual(discoveredCodes, ['2607A', '2607A01', '2607A02A']);
  const storedIndex = await documentStore.storeCertificateDocument(
    'profile-a',
    indexDownload,
    pipeline.parseCertificatePdfOnDevice(indexDownload, '2607A'),
    undefined,
    { documentKind: 'monthly_index', discoveryEvidence: { monthCode: '2607', familyCode: 'A', discoveredCodes, discoveredAt: '2026-07-16T00:00:00.000Z' } },
  );
  assert.equal(storedIndex.documentKind, 'monthly_index');
  assert.deepEqual(storedIndex.discoveryEvidence.discoveredCodes, discoveredCodes);
  const reprocessedIndex = await documentStore.reprocessStoredCertificateDocument('profile-a', storedIndex.id, '2607A');
  assert.equal(reprocessedIndex.documentKind, 'monthly_index');
  assert.deepEqual(reprocessedIndex.discoveryEvidence.discoveredCodes, discoveredCodes);
  assert.equal(reprocessedIndex.parseHistory.length, 2);

  const events = loadStandaloneTs('lib/cruiseRecordChangeEvents.ts');
  const received = [];
  const unsubscribe = events.subscribeToCruiseRecordChanges((change) => received.push(change));
  events.notifyCruiseRecordChanged({ cruiseId: 'cruise-1', kind: 'updated', changedFields: ['sailDate'] });
  unsubscribe();
  events.notifyCruiseRecordChanged({ cruiseId: 'cruise-2', kind: 'removed' });
  assert.deepEqual(received, [{ cruiseId: 'cruise-1', kind: 'updated', changedFields: ['sailDate'] }]);

  const defaultSources = [
    'components/CasinoOfferCard.tsx', 'components/OfferCard.tsx', 'components/CruiseCard.tsx',
    'lib/valueCalculator.ts', 'lib/offerIntelligence.ts', 'lib/casinoCalculator.ts',
    'lib/whatIfSimulator.ts', 'lib/historicalPerformance.ts', 'lib/casinoCruiseEconomics.ts', 'lib/csv/bookedParser.ts',
    'app/(tabs)/(overview)/index.tsx', 'state/RoyalCaribbeanSyncProvider.tsx',
    'lib/carnival/carnivalOffersExtraction.ts', 'lib/royalCaribbean/step1_offers.ts',
  ].map(read).join('\n');
  assert.doesNotMatch(
    defaultSources,
    /(?:numberOfNights|nightCount|durationNights|numberOfGuests|guestCount)[\s\S]{0,80}(?:\|\||\?\?)\s*(?:7|2)\b/i,
  );
  assert.doesNotMatch(
    defaultSources,
    /(?:nights|numberOfNights|nightCount|durationNights|guests|numberOfGuests|guestCount)\s*>\s*0\s*\?\s*\w+\s*:\s*(?:7|2)\b/i,
  );
  assert.doesNotMatch(defaultSources, /numberOfGuests:\s*'2'/);

  const carnivalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
  const carnivalSupport = read('lib/carnival/syncSupport.ts');
  const carnivalScreen = read('app/carnival-sync.tsx');
  const carnivalBoundary = read('state/CarnivalSyncProvider.tsx');
  assert.match(carnivalProvider, /injectCarnivalSearchPageScrape/);
  assert.match(carnivalProvider, /case 'carnival_search_page_complete'/);
  assert.match(carnivalProvider, /createCarnivalSailingKey/);
  assert.doesNotMatch(carnivalProvider, /collectCarnivalSailingChunk/);
  assert.match(carnivalProvider, /case 'carnival_rate_code_pagination'/);
  assert.match(carnivalSupport, /expectedPages/);
  assert.match(carnivalSupport, /entry\.expectedPages/);
  assert.match(carnivalSupport, /assessCarnivalRateCodePagination/);
  assert.match(carnivalSupport, /export function collectCarnivalSailingChunk/);
  assert.match(carnivalScreen, /useCarnivalSync/);
  assert.doesNotMatch(carnivalScreen, /useRoyalCaribbeanSync/);
  assert.match(carnivalBoundary, /Carnival screens receive only Carnival operations/);
  const carnivalExtractor = read('lib/carnival/carnivalOffersExtraction.ts');
  assert.match(carnivalExtractor, /function knownGuestCount/);
  assert.doesNotMatch(carnivalExtractor, /\?\s*['"]1['"]\s*:\s*['"]2['"]/);
  assert.doesNotMatch(carnivalExtractor, /numberOfGuests:\s*['"]2['"]/);

  const weather = read('state/SailingWeatherProvider.tsx');
  const coreData = read('state/CoreDataProvider.tsx');
  const valueCalculator = read('lib/valueCalculator.ts');
  assert.match(weather, /subscribeToCruiseRecordChanges/);
  assert.match(coreData, /notifyCruiseRecordChanged/);
  assert.match(valueCalculator, /canUseScheduleForEstimate/);
  assert.match(valueCalculator, /dataConfidence === 'verified'/);
  assert.match(read('lib/certificates/certificatePdfPipeline.ts'), /extractCompressedPdfText/);
  assert.match(read('lib/certificates/certificatePdfPipeline.ts'), /findCompactCertificateRows/);

  console.log('Final partial-item regression checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
