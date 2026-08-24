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

function loadDocumentStore(storage) {
  const filename = path.join(root, 'lib/certificates/certificateDocumentStore.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../storage/quotaSafeStorage') {
      return {
        quotaSafeGetItem: async (key) => storage.get(key) ?? null,
        quotaSafeSetJsonItem: async (key, value) => storage.set(key, JSON.stringify(value)),
      };
    }
    if (request === '@react-native-async-storage/async-storage') {
      return {
        default: {
          getItem: async (key) => storage.get(key) ?? null,
          setItem: async (key, value) => storage.set(key, value),
        },
      };
    }
    if (request === './certificatePdfPipeline') return pipeline;
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

const loadedPipeline = loadPipeline();
const pipeline = loadedPipeline.api;
assert.equal(typeof pipeline.sha256DocumentHash, 'function', 'certificate pipeline loader must expose the canonical hash function');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/royal-july-2026-production-fixtures.json'), 'utf8'));
const storage = new Map();
const documentStore = loadDocumentStore(storage);

async function run() {
for (const fixture of fixtures) {
  const filePath = path.join(fixtureDirectory, fixture.fileName);
  const bytes = new Uint8Array(fs.readFileSync(filePath));
  assert.deepEqual(Array.from(bytes.slice(0, 5)), [0x25, 0x50, 0x44, 0x46, 0x2d], `${fixture.code} must be a PDF`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.sha256, `${fixture.code} hash changed`);
  const documentHash = pipeline.sha256DocumentHash(bytes);
  const parsed = pipeline.parseCertificatePdfOnDevice({
    status: 'downloaded',
    bytes,
    provenance: { originalUrl: fixture.url, retrievedAt: '2026-07-16T00:00:00.000Z', documentHash, documentVersion: documentHash },
  }, fixture.code);
  const backend = pipeline.parseCertificatePdfTextOnBackend(
    pipeline.extractCertificatePdfText(bytes),
    { originalUrl: fixture.url, retrievedAt: '2026-07-16T00:00:00.000Z', documentHash, documentVersion: documentHash },
    fixture.code,
  );
  const comparison = pipeline.reconcileCertificateParserResults(backend, parsed);
  assert.ok(parsed.sailings.length > 0, `${fixture.code} must produce sailing rows`);
  assert.ok(parsed.sailings.every((row) => row.certificateCode === fixture.code), `${fixture.code} must not leak another certificate code`);
  assert.ok(parsed.sailings.every((row) => row.certificateFamily === fixture.family), `${fixture.code} family must remain correct`);
  assert.ok(parsed.sailings.every((row) => /(?:Of The Seas|Mardi Gras)$/i.test(row.shipName)), `${fixture.code} ship names must not include a port`);
  assert.ok(parsed.sailings.some((row) => row.freePlay !== undefined), `${fixture.code} must retain scoped FreePlay evidence`);
  assert.equal(comparison.status, 'equivalent', `${fixture.code} backend/device parser rows must agree`);
  const archived = await documentStore.storeCertificateDocument('royal-production-fixtures', {
    status: 'downloaded',
    bytes,
    provenance: { originalUrl: fixture.url, retrievedAt: '2026-07-16T00:00:00.000Z', documentHash, documentVersion: documentHash },
  }, parsed, { backendResult: backend, comparison });
  assert.equal(archived.parserReconciliations.at(-1).status, 'equivalent', `${fixture.code} must retain parser parity evidence`);
  assert.deepEqual(Array.from(documentStore.restoreCertificateDocumentBytes(archived)), Array.from(bytes), `${fixture.code} archived PDF bytes must remain hash-valid`);
}

console.log(`Royal production certificate fixture checks passed (${fixtures.length} PDFs).`);
}

run().then(() => {
  loadedPipeline.restore();
}).catch((error) => {
  loadedPipeline.restore();
  console.error(error);
  process.exitCode = 1;
});
