const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
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
const certificatePdf = loadStandaloneTs('lib/royalCaribbean/certificatePdf.ts', {
  'react-native': { Linking: { openURL: async () => undefined }, Platform: { OS: 'ios' } },
  '@/lib/certificates/certificatePdfPipeline': pipeline,
});

assert.deepEqual(pipeline.getCertificateFamilyDefinition('2607A05'), {
  family: 'A', familyCode: 'A', codeClassification: 'certificate', known: true, layout: 'standard',
});
assert.deepEqual(pipeline.getCertificateFamilyDefinition('2607C05'), {
  family: 'C', familyCode: 'C', codeClassification: 'certificate', known: true, layout: 'standard',
});
assert.equal(pipeline.isCertificateCode('2607D05'), false);
assert.equal(pipeline.getCertificateFamilyDefinition('2607D05').codeClassification, 'marketing_offer');
assert.deepEqual(pipeline.discoverCertificateCodesFromText('2607A01 2607D05 2607C01', { monthCode: '2607' }), ['2607A01', '2607C01']);

const marketingPdf = new TextEncoder().encode('%PDF-1.4\n(2607D05)');
const rejected = pipeline.parseCertificatePdfOnDevice({
  status: 'downloaded',
  bytes: marketingPdf,
  provenance: { originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607D05.pdf', retrievedAt: '2026-07-17T00:00:00.000Z' },
}, '2607D05');
assert.equal(rejected.status, 'parse_failed');
assert.equal(rejected.sailings.length, 0);
assert.match(rejected.warnings[0], /marketing offer code/);

assert.equal(certificatePdf.getCertificatePdfMatch({ offerCode: '2607D05' }), null);
assert.equal(certificatePdf.getCertificatePdfMatch({ offerName: '2607A05' })?.certificateFamily, 'A');

const backend = fs.readFileSync(path.join(root, 'backend/trpc/routes/certificate-explorer.ts'), 'utf8');
const explorer = fs.readFileSync(path.join(root, 'components/CertificateExplorerModal.tsx'), 'utf8');
assert.doesNotMatch(backend, /includeD/);
assert.doesNotMatch(explorer, /includeD|D Certificates/);

console.log('Certificate marketing-code regression checks passed');
