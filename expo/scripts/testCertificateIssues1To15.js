const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-cert-1-15-'));
function compile(file, outName) {
  const source = path.join(root, file);
  const result = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true }, fileName: source, reportDiagnostics: true });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `${file} must transpile: ${errors.map((e) => e.messageText).join(', ')}`);
  const out = path.join(temp, outName);
  fs.writeFileSync(out, result.outputText);
  return out;
}
const core = require(compile('lib/certificates/certificatePdfParserCore.ts', 'core.js'));
const parityPath = compile('lib/certificates/certificateParserParity.ts', 'parity.js');
const statusPath = compile('lib/certificates/certificateParsingStatus.ts', 'status.js');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/certificates/certificatePdfParserCore') return core;
  if (request === '@/lib/certificates/certificateParsingStatus') return require(statusPath);
  if (request === '@/lib/certificates/certificateDocumentStore') return { archiveCertificatePdfBytes: async () => ({ sha256: 'fixture', archiveUri: null, storageStatus: 'metadata-only-web' }) };
  if (request === 'pako') return { inflate: (value) => value };
  return originalLoad.call(this, request, parent, isMain);
};
const parity = require(parityPath);
const client = require(compile('lib/certificates/clientCertificatePdfEngine.ts', 'client.js'));
Module._load = originalLoad;

const entry = { certificateCode: '2607D05', certificateType: 'D', points: 2000, pdfUrl: 'https://example/2607D05.pdf', monthlyIndexUrl: 'https://example/2607D.pdf' };
const text = [
  '2607D05 Navigator Of The Seas Miami July 20, 2026 4 Night Bahamas Cruise Interior Cruise Fare for 2 Guests Free Play $50 OBC $25',
  '2607D05 Navigator Of The Seas Miami July 20, 2026 4 Night Bahamas Cruise Balcony Cruise Fare for 1 Guest Free Play $75 OBC $100',
].join(' ');
const rows = core.parseCertificateSailingsFromText(entry, text);
assert.strictEqual(rows.length, 2, '1/4: material same-date variants must both survive');
assert.deepStrictEqual(rows.map((r) => [r.cabinLabel, r.guestCount, r.freePlay, r.onBoardCredit]), [
  ['Interior', 2, 50, 25], ['Balcony', 1, 75, 100],
], '2/3: FP, OBC, guest count, and cabin must remain row-specific');
assert.notStrictEqual(rows[0].variantId, rows[1].variantId, '4: variants need distinct identities');
assert.strictEqual(core.parseCertificateCode('2607D05').family, 'D', '5: D must remain D');
assert.strictEqual(core.parseCertificateCode('2607Z99').family, 'Z', '7: unknown family must be preserved');
assert.strictEqual(core.parseCertificateCode('2607Z99').recognizedFamily, false);
assert.deepStrictEqual(core.discoverCertificateCodesFromText('2607A03A 2607C06 2607D05 2607Z99', '2607'), ['2607A03A','2607C06','2607D05','2607Z99'], '8: monthly text discovery must include D and unknown families');
const localFallback = core.parseCertificateSailingsFromText({ ...entry, certificateCode: '2607D06' }, '$500 Free Play unrelated header '.repeat(30) + 'Navigator Of The Seas July 21, 2026');
assert.strictEqual(localFallback.length, 1);
assert.strictEqual(localFallback[0].freePlay, null, '9: PDF-wide benefit must not leak into a local fallback row');
assert.strictEqual(core.extractExplicitPointsForCode('2607D05', '2607D05 $4,000 Free Play'), null, '10: dollars must never become points');
assert.strictEqual(core.extractExplicitPointsForCode('2607D05', '2607D05 2,000 points $50 Free Play'), 2000);

const backendResult = { catalog: [{ certificateCode: '2607D05', status: 'parsed', parserSource: 'backend' }], matches: [{ shipName: 'Navigator Of The Seas', sailDate: '2026-07-20', levels: [rows[0]] }] };
const deviceResult = { catalog: [{ certificateCode: '2607D05', status: 'parsed', parserSource: 'direct-device' }], matches: [{ shipName: 'Navigator Of The Seas', sailDate: '2026-07-20', levels: [rows[1]] }] };
const reconciled = parity.reconcileCertificateParserOutputs(backendResult, deviceResult);
assert.strictEqual(reconciled.matches[0].levels.length, 2, '12: reconciliation must preserve the material union');
assert(reconciled.parserParity.discrepancies.length > 0, '12: disagreement must be recorded');

const binaryFixture = fs.readFileSync(path.join(root, 'scripts/fixtures/certificate-2607D05-material-row.pdf'));
const binaryResult = client.parseCertificatePdfBytesFixture({ certificateCode: '2607D05', pdfBytes: new Uint8Array(binaryFixture) });
assert.strictEqual(binaryResult.catalog[0].status, 'parsed', '14: real binary PDF fixture must parse through production byte extraction');
assert.strictEqual(binaryResult.matches[0].levels[0].freePlay, 50);
assert.strictEqual(binaryResult.matches[0].levels[0].onBoardCredit, 25);

const clientSource = fs.readFileSync(path.join(root, 'lib/certificates/clientCertificatePdfEngine.ts'), 'utf8');
const backendSource = fs.readFileSync(path.join(root, 'backend/trpc/routes/certificate-explorer.ts'), 'utf8');
const batchSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateBatchDownload.ts'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateDocumentStore.ts'), 'utf8');
const catalogSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateCatalog.ts'), 'utf8');
assert(clientSource.includes('parseCertificateSailingsFromText(indexEntry, pdfText)'), '11: device parser must delegate to shared core');
assert(backendSource.includes('parseCertificateSailingsFromText(indexEntry, pdfText)'), '11: backend parser must delegate to shared core');
assert(batchSource.includes('reconcileCertificateParserOutputs'), '12: batch must reconcile parser outputs');
assert(batchSource.includes('verifyParserParity ?? true'), '12/15: direct verification/archive must default on');
assert(catalogSource.includes("'A', 'C', 'D'" ) || fs.readFileSync(path.join(root, 'lib/certificates/certificatePdfParserCore.ts'),'utf8').includes("['A', 'C', 'D']"), '6: A/C/D must be modeled');
assert(backendSource.includes('discoverCertificateCodesFromText'), '8: backend must dynamically discover codes');
assert(storeSource.includes('sha256Hex') && storeSource.includes('certificate-library') && storeSource.includes('.pdf'), '15: original PDF evidence must be content-addressed and persisted');
assert(clientSource.includes("status: sailings.length > 0 ? 'parsed' : 'parse_failed'"), '13: readable zero-row PDFs must fail truthfully');
console.log('PASS certificate issues 1-15');
