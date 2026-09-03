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

const integrity = loadStandaloneTs('lib/cruiseRecordIntegrity.ts');
assert.equal(integrity.knownNightCount(undefined), undefined);
assert.equal(integrity.knownNightCount(7), 7);
assert.equal(integrity.knownGuestCount(0), undefined);
assert.equal(integrity.deriveReturnDateUtc('2026-12-30', 3), '2027-01-02');
assert.equal(integrity.deriveReturnDateUtc('12-30-2026', 3), '2027-01-02');
assert.equal(integrity.isGeneratedBookingIdentifier('RES-123456'), true);

const date = loadStandaloneTs('lib/date.ts');
const cruiseDays = loadStandaloneTs('lib/cruiseDayPipeline.ts', { './date': date });
assert.equal(cruiseDays.toCruiseDateOnly('04-02-2026'), '2026-04-02');
assert.equal(cruiseDays.toCruiseDateOnly('04/02/26'), '2026-04-02');

const csvOffers = read('lib/csv/offersParser.ts');
const imports = read('app/import-cruises.tsx');
const carnival = read('lib/carnival/carnivalOffersExtraction.ts');
const casinoAvailability = read('lib/casinoAvailability.ts');
const coreData = read('state/CoreDataProvider.tsx');
const storageLoaders = read('state/coreData/storageLoaders.ts');
const scheduler = read('app/(tabs)/scheduling.tsx');
const details = read('app/(tabs)/(overview)/cruise-details.tsx');
const backendCertificates = read('backend/trpc/routes/certificate-explorer.ts');

assert.match(csvOffers, /knownNightCount/);
assert.doesNotMatch(csvOffers, /getNumericValue\(colIndices\.nights\) \|\| 7/);
assert.doesNotMatch(imports, /parseInt\(nightsStr\) \|\| 7/);
assert.doesNotMatch(imports, /item\.nights \|\| 7/);
assert.match(imports, /validationStatus: .*'partial'/);
assert.doesNotMatch(carnival, /cabinNumberOrGTY: booking\.stateroomNumber \|\| booking\.cabinNumber \|\| 'GTY'/);
assert.doesNotMatch(carnival, /numberOfGuests: \(booking\.guestCount \|\| booking\.numberOfGuests \|\| 2\)/);
assert.match(casinoAvailability, /canUseItineraryForOperationalDecisions/);
assert.match(casinoAvailability, /Itinerary is not authoritative enough for casino availability/);
assert.doesNotMatch(coreData, /enrichCruisesWithMockItineraries/);
assert.doesNotMatch(storageLoaders, /enrichCruisesWithMockItineraries\(cruises\)/);
assert.match(scheduler, /from '@\/lib\/itineraryIntegrity'/);
assert.doesNotMatch(scheduler, /function findSingleMaterialOffer/);
assert.doesNotMatch(details, /reservationNumber: `RES-/);
assert.doesNotMatch(backendCertificates, /function extractCertificateBenefits/);
assert.doesNotMatch(backendCertificates, /function extractStructuredRowsFromCertificatePdf/);
assert.doesNotMatch(backendCertificates, /function extractPointsFromPdfText/);

const pipeline = loadStandaloneTs('lib/certificates/certificatePdfPipeline.ts');
const stored = new Map();
const documentStore = loadStandaloneTs('lib/certificates/certificateDocumentStore.ts', {
  '../storage/quotaSafeStorage': {
    quotaSafeGetItem: async (key) => (typeof storage !== 'undefined' ? storage.get(key) ?? null : typeof stored !== 'undefined' ? stored.get(key) ?? null : null),
    quotaSafeSetJsonItem: async (key, value) => { const target = typeof storage !== 'undefined' ? storage : typeof stored !== 'undefined' ? stored : null; if (target) target.set(key, JSON.stringify(value)); },
  },
  '@react-native-async-storage/async-storage': {
    default: {
      getItem: async (key) => stored.get(key) ?? null,
      setItem: async (key, value) => stored.set(key, value),
    },
  },
  './certificatePdfPipeline': pipeline,
});

(async () => {
  const bytes = new Uint8Array(Buffer.from('%PDF-1.4\n(2607A05)\n(Icon of the Seas 04/02/2026)\n(Balcony)\n(2 Guests)\n(Free Play $500)'));
  const hash = pipeline.sha256DocumentHash(bytes);
  const download = {
    status: 'downloaded',
    bytes,
    provenance: { originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A05.pdf', retrievedAt: '2026-07-16T00:00:00.000Z', documentHash: hash, documentVersion: hash },
  };
  const parsed = pipeline.parseCertificatePdfOnDevice(download, '2607A05');
  const saved = await documentStore.storeCertificateDocument('profile-a', download, parsed);
  const reloaded = await documentStore.listCertificateDocuments('profile-a');
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].documentHash, saved.documentHash);
  assert.deepEqual(Array.from(documentStore.restoreCertificateDocumentBytes(reloaded[0])), Array.from(bytes));
  const reparsed = await documentStore.reprocessStoredCertificateDocument('profile-a', saved.id, '2607A05');
  assert.equal(reparsed.parseHistory.length, 2);
  const corrupted = { ...reloaded[0], bytesBase64: `${reloaded[0].bytesBase64.slice(0, -4)}AAAA` };
  assert.equal(documentStore.isValidCertificateDocumentRecord(corrupted), false);
  console.log('Partial-item closure regression checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
