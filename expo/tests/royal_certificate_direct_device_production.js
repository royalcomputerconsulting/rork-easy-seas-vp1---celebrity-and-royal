const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const fixtureDirectory = process.env.EASYSEAS_REAL_CERTIFICATE_FIXTURE_DIR || path.join(root, 'tests/fixtures/royal-july-2026-live');

function compileModule(filename, mocks = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  Module._load = originalLoad;
  return mod.exports;
}

const pako = {
  inflate: (bytes) => new Uint8Array(zlib.inflateSync(Buffer.from(bytes))),
  inflateRaw: (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))),
};

const pipelineFile = path.join(root, 'lib/certificates/certificatePdfPipeline.ts');
const pipelineCompiled = ts.transpileModule(fs.readFileSync(pipelineFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: pipelineFile,
}).outputText;
const originalLoad = Module._load;
Module._load = function pipelineLoad(request, parent, isMain) {
  if (request === 'pako') return pako;
  return originalLoad.call(this, request, parent, isMain);
};
const pipelineModule = new Module(pipelineFile, module);
pipelineModule.filename = pipelineFile;
pipelineModule.paths = Module._nodeModulePaths(path.dirname(pipelineFile));
pipelineModule._compile(pipelineCompiled, pipelineFile);
const pipeline = pipelineModule.exports;
// Prime the lazy pako runtime while the test hook is active.
pipeline.extractCertificatePdfText(new Uint8Array(Buffer.from('%PDF-')));
Module._load = originalLoad;

const parserCore = compileModule(path.join(root, 'lib/certificates/certificatePdfParserCore.ts'));
const client = compileModule(path.join(root, 'lib/certificates/clientCertificatePdfEngine.ts'), {
  '@/lib/certificates/certificateDocumentStore': {
    archiveCertificatePdfBytes: async () => ({ archiveUri: 'test://certificate.pdf', sha256: 'test' }),
  },
  '@/lib/certificates/certificatePdfPipeline': pipeline,
  '@/lib/certificates/certificatePdfParserCore': parserCore,
});

const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/royal-july-2026-production-fixtures.json'), 'utf8'));
for (const fixture of fixtures) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(fixtureDirectory, fixture.fileName)));
  const parsed = client.parseCertificatePdfBytesFixture({ certificateCode: fixture.code, pdfBytes: bytes });
  const references = parsed.matches.reduce((sum, match) => sum + (Array.isArray(match.levels) ? match.levels.length : 0), 0);
  assert.ok(parsed.catalog.length === 1, `${fixture.code} direct-device catalog row must exist`);
  assert.ok(references > 0, `${fixture.code} direct-device path must produce sailing references`);
  assert.equal(parsed.catalog[0].status, 'parsed', `${fixture.code} direct-device status must be parsed`);
}

console.log(`Royal direct-device production parser checks passed (${fixtures.length} PDFs).`);
