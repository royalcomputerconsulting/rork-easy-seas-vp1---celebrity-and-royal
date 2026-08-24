const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
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

const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const authority = compileTs('lib/dataAuthority.ts', {
  './date': { toCalendarDateOnly: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined },
});
const canonicalRecord = {
  id: 'already-canonical', sailDate: '2026-09-10', sourceAuthority: 'provider',
  dataConfidence: 'verified', validationStatus: 'valid', sourceEvidence: { authority: 'provider' },
};
assert.equal(authority.canonicalizeDataRecord(canonicalRecord), canonicalRecord, 'canonical hydration must preserve an already-normalized record reference');
const canonicalRecords = Array.from({ length: 5000 }, (_, index) => ({ ...canonicalRecord, id: `cruise-${index}` }));
assert.equal(authority.canonicalizeDataRecords(canonicalRecords), canonicalRecords, 'canonical hydration must not duplicate an unchanged large array');

const ownership = compileTs('lib/storage/dataOwnership.ts');
const ownedRecords = Array.from({ length: 5000 }, (_, index) => ({
  id: `owned-${index}`,
  dataOwnerScopeId: 'person@example.com::device', dataOwnerEmail: 'person@example.com', dataOwnerSyncedAt: '2026-08-20T00:00:00.000Z',
  ownerProfileId: 'person@example.com', sourceEmail: 'person@example.com', importStatus: 'assigned', reconciliationStatus: 'matched',
}));
assert.equal(ownership.filterRecordsForOwner(ownedRecords, 'person@example.com::device', 'person@example.com', 'fixture'), ownedRecords);
assert.equal(ownership.stampRecordsForOwner(ownedRecords, 'person@example.com::device', 'person@example.com'), ownedRecords, 'owner stamping must not clone an unchanged large array');

const filters = compileTs('lib/intelligenceFilters.ts');
assert.equal(filters.filterRecordsByIntelligence(ownedRecords, { selectedProfileId: 'all', selectedBrand: 'all', selectedProgram: 'all' }, []), ownedRecords, 'default intelligence scope must reuse the source array');

const storage = read('lib/storage/quotaSafeStorage.ts');
assert.match(storage, /withBulkySerializationSlot/);
assert.match(storage, /analyzeStorageValueCooperatively/);
assert.match(storage, /jsonParseQueue/);
assert.match(storage, /Never run two multi-megabyte JSON parses back-to-back/);
assert.match(storage, /value\.length < 100 \? value\.length : 50/);

const loaders = read('state/coreData/storageLoaders.ts');
assert.match(loaders, /STORAGE_VALUE_PRESENT/);
assert.doesNotMatch(loaders, /cruisesData:\s*cruisesResult\.raw,/);

const core = read('state/CoreDataProvider.tsx');
assert.match(core, /prepareOwnedRecordsCooperatively/);
assert.match(core, /chunkSize = 250/);

const agent = read('state/AgentXProvider.tsx');
assert.match(agent, /isVisible \? filterRecordsByIntelligence\(deferredCruises/);

const certificateScreen = read('app/certificate-codes.tsx');
assert.match(certificateScreen, /useFocusEffect/);
assert.match(certificateScreen, /isScreenFocusedRef/);
assert.match(certificateScreen, /pendingDocumentRefreshRef/);
assert.match(certificateScreen, /certificate-codes\.background-completion/);
assert.match(certificateScreen, /setAgentVisible\(chatOpen\)/);

const certificateBatch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(certificateBatch, /preparedArchivesByCode/);
assert.match(certificateBatch, /prepareCertificatePdfArchive/);
assert.doesNotMatch(certificateBatch, /archiveInputsByCode/);

const certificateStore = read('lib/certificates/certificateDocumentStore.ts');
assert.match(certificateStore, /input\.parsedResult \?\? parseCertificatePdfOnDevice/);
assert.match(certificateStore, /archivePreparedCertificateDocumentsBatch/);
assert.match(certificateStore, /quotaSafeGetJsonItemWithRaw<unknown\[]>/);
assert.doesNotMatch(certificateStore, /coordinatedGetItem/);

const certificatesProvider = read('state/CertificatesProvider.tsx');
const weatherProvider = read('state/SailingWeatherProvider.tsx');
const priceProvider = read('state/PriceHistoryProvider.tsx');
const alertsProvider = read('state/AlertsProvider.tsx');
assert.match(certificatesProvider, /loadedCertificatesSnapshotRef/);
assert.match(weatherProvider, /loadedCacheSnapshotRef/);
assert.match(priceProvider, /loadedHistorySnapshotRef/);
assert.match(alertsProvider, /storageReadyRef/);

const tabs = read('app/(tabs)/_layout.tsx');
assert.match(tabs, /freezeOnBlur/);
assert.match(tabs, /detachInactiveScreens/);

console.log('PASS Build 394 bounds large persistence work, avoids duplicate hydration arrays and writes, and keeps background certificate completion non-modal off-screen');
