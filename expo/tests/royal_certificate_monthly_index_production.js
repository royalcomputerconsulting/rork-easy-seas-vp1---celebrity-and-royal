const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let pako;
try {
  pako = require('pako');
  if (typeof pako?.inflate !== 'function' || typeof pako?.inflateRaw !== 'function') throw new Error('CommonJS pako runtime is incomplete');
} catch {
  const zlib = require('node:zlib');
  pako = {
    inflate: (bytes) => new Uint8Array(zlib.inflateSync(Buffer.from(bytes))),
    inflateRaw: (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))),
  };
}


const root = path.resolve(__dirname, '..');
const fixtureDirectory = process.env.EASYSEAS_REAL_CERTIFICATE_FIXTURE_DIR || path.join(root, 'tests/fixtures/royal-july-2026-live');

function loadPipeline() {
  const filename = path.join(root, 'lib/certificates/certificatePdfPipeline.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'pako') return pako;
    return originalLoad.call(this, request, parent, isMain);
  };
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  // certificatePdfPipeline resolves pako lazily on the first compressed PDF.
  // Keep this test hook active through the fixture run.
  return { api: mod.exports, restore: () => { Module._load = originalLoad; } };
}

const loadedPipeline = loadPipeline();
const pipeline = loadedPipeline.api;
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/royal-monthly-index-production-fixtures.json'), 'utf8'));

for (const fixture of fixtures) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(fixtureDirectory, fixture.fileName)));
  assert.deepEqual(Array.from(bytes.slice(0, 5)), [0x25, 0x50, 0x44, 0x46, 0x2d], `${fixture.code} must be a PDF`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.sha256, `${fixture.code} hash changed`);
  const discovered = pipeline.discoverCertificateCodesFromDownloadedPdf({
    status: 'downloaded',
    bytes,
    provenance: { originalUrl: fixture.url, retrievedAt: '2026-07-16T00:00:00.000Z', documentHash: fixture.sha256, documentVersion: fixture.sha256 },
  }, { monthCode: fixture.monthCode, familyCodes: [fixture.familyCode] });
  assert.deepEqual(discovered, fixture.discoveredCodes, `${fixture.code} must discover its exact published codes in document order`);
}

loadedPipeline.restore();
console.log(`Royal production monthly-index discovery checks passed (${fixtures.length} index PDF).`);
