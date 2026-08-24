const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-build383-certificate-view-'));

function compile(relativePath, outputName) {
  const filename = path.join(root, relativePath);
  const result = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${relativePath} must transpile without syntax diagnostics`);
  const output = path.join(temp, outputName);
  fs.writeFileSync(output, result.outputText);
  return output;
}

const core = require(compile('lib/certificates/certificatePdfParserCore.ts', 'certificatePdfParserCore.js'));
const catalogPath = compile('lib/certificates/certificateCatalog.ts', 'certificateCatalog.js');
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '@/lib/certificates/certificatePdfParserCore') return core;
  return originalLoad.call(this, request, parent, isMain);
};
const catalog = require(catalogPath);
Module._load = originalLoad;

const storedRow = {
  certificateCode: '2608C07',
  shipName: 'Icon of the Seas',
  sailingDate: '2026-09-26',
  cabinCategory: 'Interior',
};
const entries = catalog.buildStoredCertificateCatalogEntries({
  certificates: [{
    certificateCode: '2608C07',
    sourcePdfUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C07.pdf',
    parserStatus: 'parsed_with_warnings',
    parserSource: 'device',
    parsedSailings: [storedRow],
  }],
  documents: [{
    documentKind: 'certificate',
    originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C07.pdf',
    provenance: { documentArchiveUri: 'file:///certificate-library/2608C07.pdf' },
    parseHistory: [{ result: { status: 'parsed_with_warnings', parserSource: 'device', sailings: [storedRow] } }],
  }, {
    documentKind: 'monthly_index',
    originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C.pdf',
    provenance: { documentArchiveUri: 'file:///certificate-library/2608C.pdf' },
    parseHistory: [{ result: { status: 'parse_failed', sailings: [] } }],
  }],
});

assert.equal(entries.length, 1, 'the monthly index must not appear as a certificate offer');
assert.equal(entries[0].certificateCode, '2608C07');
assert.equal(entries[0].status, 'parsed');
assert.equal(entries[0].parsedSailingReferences, 1);
assert.equal(entries[0].sailingGroups, 1);
assert.equal(entries[0].documentArchiveUri, 'file:///certificate-library/2608C07.pdf');
assert.equal(entries[0].parserSource, 'direct-device');

const screen = read('app/certificate-codes.tsx');
assert.match(screen, /buildStoredCertificateCatalogEntries/);
assert.match(screen, /certificates: searchableCertificates/);
assert.match(screen, /documents: certificateDocuments/);
assert.match(screen, /entry\.status === 'parsed' && savedSailingCount > 0/);
assert.match(screen, /pathname: '\/certificate-lookup'/);
assert.match(screen, /Tap a saved code to view and filter its eligible sailings/);

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

console.log('PASS Build 383 View Certificates restores saved PDFs and opens locally parsed sailing filters without redownloading');
