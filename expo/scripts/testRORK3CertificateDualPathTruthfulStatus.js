const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-rork3-'));

const statusSource = path.join(root, 'lib/certificates/certificateParsingStatus.ts');
const statusOutput = path.join(temp, 'certificateParsingStatus.js');
const compiled = ts.transpileModule(fs.readFileSync(statusSource, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true },
  fileName: statusSource,
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.strictEqual(errors.length, 0, 'certificate status module must transpile without diagnostics');
fs.writeFileSync(statusOutput, compiled.outputText);
const {
  normalizeCertificateParseDiagnostics,
  countCertificateSailingGroups,
  countCertificateSailingReferences,
} = require(statusOutput);

const matches = [{
  shipName: 'Navigator Of The Seas',
  sailDate: '2026-07-20',
  levels: [{ certificateCode: '2607C06' }, { certificateCode: '2607C07' }],
}];
assert.strictEqual(countCertificateSailingGroups(matches, '2607C06'), 1);
assert.strictEqual(countCertificateSailingReferences(matches, '2607C06'), 1);
let diagnostic = normalizeCertificateParseDiagnostics({
  certificateCode: '2607C06',
  status: 'ok',
  parserSource: 'backend',
  extractedTextLength: 12000,
  sailingsFound: 0,
}, [], 'backend');
assert.strictEqual(diagnostic.status, 'parse_failed', 'readable PDF with zero sailings must never be a success');
assert(/no eligible sailings/i.test(diagnostic.message));

diagnostic = normalizeCertificateParseDiagnostics({
  certificateCode: '2607C06',
  status: 'parsed',
  parserSource: 'backend',
  extractedTextLength: 12000,
  parsedSailingReferences: 1,
  sailingGroups: 1,
}, matches, 'backend');
assert.strictEqual(diagnostic.status, 'parsed');
assert.strictEqual(diagnostic.parsedSailingReferences, 1);
assert.strictEqual(diagnostic.sailingGroups, 1);

diagnostic = normalizeCertificateParseDiagnostics({
  certificateCode: '2607C06',
  status: 'error',
  parserSource: 'direct-device',
  errorMessage: 'Unsupported PDF response: missing %PDF header',
}, [], 'direct-device');
assert.strictEqual(diagnostic.status, 'unsupported_pdf');

diagnostic = normalizeCertificateParseDiagnostics({
  certificateCode: '2607C06',
  status: 'error',
  parserSource: 'backend',
  errorMessage: 'Request timed out',
}, [], 'backend');
assert.strictEqual(diagnostic.status, 'network_error');

const batch = read('lib/certificates/certificateBatchDownload.ts');
const direct = read('lib/certificates/clientCertificatePdfEngine.ts');
const backend = read('backend/trpc/routes/certificate-explorer.ts');
const codes = read('app/certificate-codes.tsx');
const modal = read('components/CertificateExplorerModal.tsx');
const trpc = read('lib/trpc.ts');

assert(batch.includes("chunk(entries, 3)"), 'small backend batches must remain');
assert(batch.includes('callBackend([code]'), 'individual backend retry must remain');
assert(batch.includes('fetchCertificatesDirectFromRoyalCaribbean'), 'direct-device verification/fallback must remain');
assert(batch.includes('reconcileCertificateParserOutputs'), 'backend/device material reconciliation must remain');
assert(batch.includes("diagnostic.status === 'parsed'"), 'only parsed status may be logged as success');
assert(batch.includes('parsedSailingReferenceCount'), 'reference count evidence must be returned');
assert(batch.includes('parsedSailingGroupCount'), 'group count evidence must be returned');
assert(direct.includes("header !== '%PDF-'"), 'direct parser must verify the PDF signature');
assert(backend.includes("header !== '%PDF-'"), 'backend parser must verify the PDF signature');
assert(direct.includes("status: sailings.length > 0 ? 'parsed' : 'parse_failed'"));
assert(backend.includes("status: sailings.length > 0 ? 'parsed' : 'parse_failed'"));
assert(direct.includes('parseCertificatePdfTextFixture'), 'production parser must expose deterministic fixture entry point');
assert(codes.includes('Certificate scan finished with issues'), 'UI must surface partial failures');
assert(!codes.includes('This certificate was downloaded, but no eligible sailings were parsed'), 'false-success copy must be removed');
assert(modal.includes("e.status === 'parse_failed'"), 'diagnostic modal must report parse failures');
assert(trpc.includes('return isCertificateRequest ? 60_000 : 15_000'), 'bounded certificate request timeout must remain');
assert(!trpc.includes('return isCertificateRequest ? 180_000'), 'retired three-minute single request must not return');

console.log('PASS RORK-3 certificate dual-path truthful status');
