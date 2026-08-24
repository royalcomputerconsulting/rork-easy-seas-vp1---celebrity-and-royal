const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const fixtures = [
  { file: path.join(root, 'tests/fixtures/royal-july-2026-live/2607A02A.pdf'), code: '2607A02A', family: 'A', rows: 1520, first: { shipName: 'Spectrum Of The Seas', sailingDate: '2026-07-03', cabinCategory: 'Balcony', occupancy: '2 guests', freePlay: 750, onboardCredit: 50 } },
  { file: path.join(root, 'tests/fixtures/certificates/2605C03A.pdf'), code: '2605C03A', family: 'C', rows: 915, first: { shipName: 'Anthem Of The Seas', sailingDate: '2026-05-01', cabinCategory: 'Balcony', occupancy: '2 guests', freePlay: 300, onboardCredit: 100 } },
  { file: path.join(root, 'tests/fixtures/certificates/2604C05.pdf'), code: '2604C05', family: 'C', rows: 1012, first: { shipName: 'Enchantment Of The Seas', sailingDate: '2026-04-02', cabinCategory: 'Oceanview', occupancy: '2 Guests', freePlay: 100, onboardCredit: undefined } },
  { file: path.join(root, 'tests/fixtures/certificates/2604A08.pdf'), code: '2604A08', family: 'A', rows: 411, first: { shipName: 'Enchantment Of The Seas', sailingDate: '2026-04-02', cabinCategory: 'Oceanview', occupancy: '1 Guest', freePlay: undefined, onboardCredit: undefined } },
];

function load(file, mocks = {}, keepPatched = false) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file }).outputText;
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) { if (mocks[request]) return mocks[request]; return originalLoad.call(this, request, parent, isMain); };
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); mod._compile(compiled, file);
  if (!keepPatched) Module._load = originalLoad;
  return { api: mod.exports, restore: () => { Module._load = originalLoad; } };
}

const pako = { inflate: (bytes) => new Uint8Array(zlib.inflateSync(Buffer.from(bytes))), inflateRaw: (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))) };
const loadedPipeline = load(path.join(root, 'lib/certificates/certificatePdfPipeline.ts'), { pako }, true);
const pipeline = loadedPipeline.api;
for (const fixture of fixtures) {
  assert.ok(fs.existsSync(fixture.file), `Missing fixture ${fixture.file}`);
  const bytes = new Uint8Array(fs.readFileSync(fixture.file));
  assert.equal(Buffer.from(bytes.slice(0,5)).toString('latin1'), '%PDF-');
  const hash = pipeline.sha256DocumentHash(bytes);
  const result = pipeline.parseCertificatePdfOnDevice({ status: 'downloaded', bytes, provenance: { originalUrl: `https://www.royalcaribbean.com/${fixture.code}.pdf`, retrievedAt: '2026-07-19T00:00:00.000Z', documentHash: hash, documentVersion: hash } }, fixture.code);
  assert.equal(result.status, 'parsed_successfully', `${fixture.code} should parse without warnings`);
  assert.equal(result.sailings.length, fixture.rows, `${fixture.code} row count`);
  assert.equal(result.sailings[0].certificateFamily, fixture.family);
  for (const [key,value] of Object.entries(fixture.first)) assert.equal(result.sailings[0][key], value, `${fixture.code} first row ${key}`);
  assert.ok(result.sailings.every((row) => row.certificateCode === fixture.code));
  assert.ok(result.sailings.every((row) => row.shipName && row.sailingDate && row.cabinCategory));
}
loadedPipeline.restore();

const batchSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateBatchDownload.ts'), 'utf8');
const codesSource = fs.readFileSync(path.join(root, 'app/certificate-codes.tsx'), 'utf8');
const lookupSource = fs.readFileSync(path.join(root, 'app/certificate-lookup.tsx'), 'utf8');
assert.ok(!batchSource.includes("input.includeD ?? true ? 'D'"), 'batch must not default to D-family codes');
assert.ok(!codesSource.includes('Download All A/C/D'), 'download-all label must be A/C only');
assert.ok(!lookupSource.includes('D Certificates'), 'lookup must not expose D as a certificate family');
console.log('Uploaded Royal certificate fixture regression passed (4 PDFs, 3,858 sailing rows).');
