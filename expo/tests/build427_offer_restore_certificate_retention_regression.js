const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const loadTs = (file) => {
  const filename = path.join(root, file);
  const output = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
};

const offers = loadTs('lib/offers/offerInstanceIdentity.ts');
const rows = Array.from({ length: 1000 }, (_, index) => ({
  id: `sailing-${index}`,
  offerCode: '26ABC',
  offerName: 'Summer Offer',
  playerOfferId: 'player-offer-1',
  shipName: index % 2 ? 'Icon of the Seas' : 'Harmony of the Seas',
  sailingDate: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
}));
rows.push({ ...rows[0], id: 'second-real-offer', playerOfferId: 'player-offer-2' });
assert.equal(offers.collapseOfferSailingRowsToOfferInstances(rows).length, 2,
  'sailing rows collapse, while two provider offer instances sharing a code remain distinct');

const settings = read('app/(tabs)/settings.tsx');
assert.doesNotMatch(settings, /setLocalData\(\{\s*cruises:\s*\[\]/,
  'Load All must not overwrite the restored SQLite catalog with the stale pre-import state');
assert.match(settings, /pathname:\s*'\/data-trust-center'[\s\S]*intent:\s*'restore'/,
  'Load All must open the conflict-safe encrypted restore workflow');
const dataTrustCenter = read('app/data-trust-center.tsx');
assert.match(dataTrustCenter, /await core\.refreshData\(\)/,
  'The restore workflow must publish the restored authoritative snapshot before reporting success');
assert.match(dataTrustCenter, /compareRestoreReadback\(merged, readback\.map\)/,
  'The restore workflow must verify exact durable readback before reporting success');

const provider = read('state/CoreDataProvider.tsx');
assert.match(provider, /CASINO_OFFERS_RECOVERED_FROM_INVENTORY/,
  'startup must recover a missing compact offer table from durable SQLite sailing inventory');
assert.match(provider, /collapseOfferSailingRowsToOfferInstances/,
  'CoreData must persist true marketing offer instances rather than sailing rows');

const certificateStore = read('lib/certificates/certificateDocumentStore.ts');
assert.match(certificateStore, /retainRollingPublicCertificateCatalog/);
assert.match(certificateStore, /PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY/);
assert.match(certificateStore, /hasReplacement/,
  'a failed/missing replacement must never erase the last retained monthly catalog');

const originalLoad = Module._load;
Module._load = (request, parent, isMain) => {
  if (request.includes('quotaSafeStorage')) return {};
  if (request.includes('certificatePdfPipeline')) return { sha256DocumentHash: () => 'hash' };
  return originalLoad(request, parent, isMain);
};
let certificateModule;
try {
  certificateModule = loadTs('lib/certificates/certificateDocumentStore.ts');
} finally {
  Module._load = originalLoad;
}
const doc = (code) => ({
  id: code, documentHash: code, documentVersion: '1', originalUrl: `https://royal/${code}.pdf`,
  provenance: {}, bytesBase64: 'AA==', storedAt: '2026-08-01T00:00:00Z',
  parseHistory: [{ parsedAt: '2026-08-01T00:00:00Z', parserSource: 'device', parserVersion: '1', result: { sailings: [{ certificateCode: code }] } }],
  parserReconciliations: [], documentKind: 'certificate', schemaVersion: 5,
});
assert.deepEqual(
  certificateModule.retainRollingPublicCertificateCatalog(
    [doc('2607C01'), doc('2608C01'), doc('2609A01'), doc('2610C01')],
    new Date('2026-08-15T12:00:00Z'),
  ).map((record) => record.id),
  ['2608C01', '2609A01'],
  'once replacements exist, only current and next-month public catalogs remain active',
);
assert.equal(
  certificateModule.retainRollingPublicCertificateCatalog([doc('2607C01')], new Date('2026-08-15T12:00:00Z')).length,
  1,
  'without a successful replacement the last usable prior-month document remains retained',
);

const bundleOperations = read('lib/dataBundle/bundleOperations.ts');
assert.match(bundleOperations, /embedRetainedCertificateBytesForBackup/);
assert.match(bundleOperations, /readAsStringAsync\(document\.provenance\.documentArchiveUri/,
  'Save All must embed locally archived PDFs so Load All remains portable to another device');
assert.match(bundleOperations, /for \(const document of documents\)/,
  'PDF embedding must be sequential to bound memory use');

const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.74');
assert.equal(String(app.ios.buildNumber), '445');
assert.equal(app.android.versionCode, 130107);

console.log('PASS Build 427 authoritative offer restore/count and rolling shared certificate retention regression');
