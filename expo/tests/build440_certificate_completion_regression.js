const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const loggerModule = compileTs('lib/certificates/certificateDownloadLogger.ts');
const logger = loggerModule.certificateDownloadLogger;
logger.startSession('Starting cancellation fixture', { certificateCodes: ['2609A04', '2609A05'] });
logger.updateCertificate('2609A04', 'saved', 'Saved locally', 12);
logger.finish('Stopped safely; saved rows remain available.', 'warning');
const stopped = logger.getSnapshot();
assert.equal(stopped.isActive, false, 'a stopped download must never leave the progress logger active');
assert.equal(stopped.completed, 1);
assert.equal(stopped.total, 2);
assert.match(stopped.currentActivity, /Stopped safely/);

const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(batch, /detail\.includes\(CERTIFICATE_BATCH_CANCELLED\)/, 'batch cancellation must have a dedicated terminal path');
assert.match(batch, /Completed PDFs and sailing rows remain saved/, 'cancellation must explain durable partial completion');

const codes = read('app/certificate-codes.tsx');
assert.match(codes, /certificate-codes\.cancel-download/);
assert.match(codes, /Certificate download stopped/);
assert.match(codes, /Press Download Missing \/ Retry Failed/);

const provider = read('state/CertificatesProvider.tsx');
assert.match(provider, /PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY/, 'monthly PDFs must use shared durable storage');
assert.match(provider, /loadSearchableCertificates/, 'export must hydrate documents without visiting the certificate page');

const review = read('app/casino/certificate-link-review.tsx');
assert.match(review, /linkCertificateToEarningCruise/, 'issue/sailing date inference must be consumed by the review UI');
assert.match(review, /Confirm suggestion/, 'inferences must require explicit confirmation');
assert.match(review, /View \{parsedRows\.toLocaleString\(\)\} eligible rows/, 'earning evidence must link to future eligible rows');
assert.match(review, /Certificate threshold/, 'certificate points must be labeled as a threshold rather than actual play');

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /const exportCertificates = await loadSearchableCertificates\(\)/);
assert.match(settings, /progress: certificateExportProgress/);
assert.match(settings, /settings-export-certificates-zip/);

console.log('Build 440 certificate cancellation, durable hydration, earning-link review, and export completion regression passed.');
