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
const bytes = new Uint8Array(Buffer.from(fs.readFileSync(path.join(root, 'tests/fixtures/certificate-variants-binary.pdf.base64'), 'utf8').trim(), 'base64'));
assert.deepEqual(Array.from(bytes.slice(0, 5)), [0x25, 0x50, 0x44, 0x46, 0x2d]);
assert.equal(bytes[10], 0xe2, 'fixture must retain binary PDF bytes, not just text');
assert.equal(pipeline.sha256DocumentHash(new TextEncoder().encode('abc')), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

const download = {
  status: 'downloaded',
  bytes,
  provenance: {
    originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A05.pdf',
    retrievedAt: '2026-07-16T00:00:00.000Z',
    documentHash: pipeline.sha256DocumentHash(bytes),
    documentVersion: pipeline.sha256DocumentHash(bytes),
    documentSize: bytes.length,
  },
};
const parsed = pipeline.parseCertificatePdfOnDevice(download, '2607A05');
assert.equal(parsed.status, 'parsed_successfully');
assert.equal(parsed.sailings.length, 3);
assert.equal(parsed.sailings[0].certificateFamily, 'A');
assert.equal(parsed.sailings[0].certificateFamilyCode, 'A');
assert.equal(parsed.sailings[0].parserVersion, 'certificate-parser-v2.4-hermes-explicit-date-parser');
assert.equal(parsed.sailings[0].documentHash, download.provenance.documentHash);
assert.equal(parsed.sailings[2].sourcePage, 2);
assert.equal(parsed.sailings[2].pageAttribution, 'explicit');

const iconVariants = parsed.sailings.filter((row) => row.shipName === 'Icon of the Seas' && row.sailingDate === '2026-04-02');
assert.equal(iconVariants.length, 2, 'same ship/date material variants must remain separate');
assert.deepEqual(iconVariants.map((row) => row.cabinCategory).sort(), ['Balcony', 'Suite']);
const balcony = iconVariants.find((row) => row.cabinCategory === 'Balcony');
assert.equal(balcony.freePlay, 500);
assert.equal(balcony.onboardCredit, 250);
assert.equal(balcony.tradeInValue, 125);
assert.equal(balcony.pointRequirement, 12000, 'point requirements are not dollar benefits');
assert.deepEqual(balcony.benefits.filter((benefit) => benefit.kind === 'onboard_credit').map((benefit) => benefit.amount), [250, 50]);

const duplicateOnAnotherPage = { ...balcony, sourceReferences: [{ page: 3, group: 'repeated-row', pageAttribution: 'explicit' }] };
const deduped = pipeline.dedupeCertificateSailings([balcony, duplicateOnAnotherPage]);
assert.equal(deduped.length, 1, 'only exact material duplicates may consolidate');
assert.equal(deduped[0].sourceReferences.length, 2, 'duplicate consolidation must retain every source reference');
assert.equal(pipeline.classifyCertificateFamily('2607Z05'), 'unclassified');
assert.equal(pipeline.getCertificateFamilyDefinition('2607Z05').familyCode, 'Z');
assert.equal(pipeline.classifyCertificateFamily('2607D05'), 'unclassified');
assert.equal(pipeline.getCertificateFamilyDefinition('2607D05').codeClassification, 'marketing_offer');
assert.deepEqual(pipeline.discoverCertificateCodesFromText('2607A01 2607D05 2507C02', { monthCode: '2607' }), ['2607A01']);
assert.deepEqual(pipeline.discoverCertificateCodesFromDownloadedPdf(download, { monthCode: '2607', familyCodes: ['A'] }), ['2607A05']);
assert.deepEqual(pipeline.discoverCertificateCodesFromText('2607D05', { monthCode: '2607', familyCodes: ['D'] }), []);

const backend = pipeline.parseCertificatePdfTextOnBackend('2607A05\nIcon of the Seas 04/02/2026\nBalcony\n2 Guests\nFree Play $500\nOBC $250', download.provenance, '2607A05');
const deviceEquivalent = pipeline.parseCertificatePdfOnDevice({ ...download, bytes: new Uint8Array(Buffer.from('%PDF-1.4\n(2607A05)\n(Icon of the Seas 04/02/2026)\n(Balcony)\n(2 Guests)\n(Free Play $500)\n(OBC $250)')) }, '2607A05');
const reconciliation = pipeline.reconcileCertificateParserResults(backend, deviceEquivalent);
assert.equal(reconciliation.status, 'equivalent');

const asyncStorage = { getItem: async () => null, setItem: async () => undefined };
const documentStore = loadStandaloneTs('lib/certificates/certificateDocumentStore.ts', {
  '../storage/quotaSafeStorage': {
    quotaSafeGetItem: async (key) => (typeof storage !== 'undefined' ? storage.get(key) ?? null : typeof stored !== 'undefined' ? stored.get(key) ?? null : null),
    quotaSafeSetJsonItem: async (key, value) => { const target = typeof storage !== 'undefined' ? storage : typeof stored !== 'undefined' ? stored : null; if (target) target.set(key, JSON.stringify(value)); },
  },
  '@react-native-async-storage/async-storage': { default: asyncStorage },
  './certificatePdfPipeline': pipeline,
});
const document = documentStore.createCertificateDocumentRecord(download, parsed);
assert.deepEqual(Array.from(documentStore.restoreCertificateDocumentBytes(document)), Array.from(bytes));
const reparsedDocument = documentStore.reprocessCertificateDocumentRecord(document, '2607A05');
assert.equal(reparsedDocument.parseHistory.length, 2);
assert.equal(reparsedDocument.parseHistory[1].result.sailings.length, 3);

const backendSource = fs.readFileSync(path.join(root, 'backend/trpc/routes/certificate-explorer.ts'), 'utf8');
assert.match(backendSource, /discoverIndexEntries/);
assert.match(backendSource, /discoverCertificateCodesFromText/);
assert.match(backendSource, /parseCertificatePdfTextOnBackend/);
assert.doesNotMatch(backendSource, /KNOWN_CERTIFICATE_SUFFIXES/);
const explorerSource = fs.readFileSync(path.join(root, 'components/CertificateExplorerModal.tsx'), 'utf8');
const batchSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateBatchDownload.ts'), 'utf8');
assert.match(explorerSource, /downloadCertificateCatalogBatched/);
assert.match(batchSource, /discoverCertificateCodesFromDownloadedPdf/);
assert.doesNotMatch(batchSource, /trpcClient/);
console.log('Certificate integrity items 1-20 regression checks passed');
