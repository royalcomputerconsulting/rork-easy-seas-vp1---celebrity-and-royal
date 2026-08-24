const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/certificates/certificatePdfParserCore.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(compiled, filename);

function glyphSpaced(value) {
  return Array.from(value).join(' ');
}

const entry = {
  certificateCode: '2608A01',
  certificateType: 'A',
  points: 25000,
  pdfUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608A01.pdf',
  monthlyIndexUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608A.pdf',
};

const liveStyleRow = glyphSpaced(
  '2608A01 Adventure Of The Seas Fort Lauderdale, Florida August 24, 2026 6 Night Caribbean Cruise Balcony Cruise Fare For 2 Guests',
);
const rowResult = mod.exports.parseCertificateSailingsFromText(entry, liveStyleRow);
assert.equal(rowResult.length, 1, 'glyph-spaced live row must not become a zero-sailing certificate');
assert.equal(rowResult[0].shipName, 'Adventure Of The Seas');
assert.equal(rowResult[0].sailDate, '2026-08-24');
assert.equal(rowResult[0].cabinLabel, 'Balcony');
assert.equal(rowResult[0].guestCount, 2);

const columnarText = glyphSpaced([
  'Offer Code Ship Departure Port Sail Date Itinerary Stateroom Type Offer Type',
  '2608A01 2608A01',
  'Adventure Of The Seas Icon Of The Seas',
  'August 24, 2026 September 5, 2026',
  'Balcony Interior',
  'Cruise Fare For 2 Guests Cruise Fare For 1 Guest',
].join(' '));
const columnarResult = mod.exports.parseCertificateSailingsFromText(entry, columnarText);
assert.equal(columnarResult.length, 2, 'glyph-spaced column runs must preserve every ship/date row');
assert.deepEqual(columnarResult.map((row) => `${row.shipName}|${row.sailDate}`), [
  'Adventure Of The Seas|2026-08-24',
  'Icon Of The Seas|2026-09-05',
]);

const documentStoreSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateDocumentStore.ts'), 'utf8');
assert.match(documentStoreSource, /bytesBase64:\s*download\.provenance\.documentArchiveUri\s*\?\s*''\s*:\s*encodeBase64/);
assert.match(documentStoreSource, /bytesBase64:\s*nextRecord\.bytesBase64/);
assert.match(documentStoreSource, /parseHistory:\s*\[\.\.\.record\.parseHistory,\s*\.\.\.nextRecord\.parseHistory\]\.slice\(-2\)/);

console.log('PASS Build 381 live certificate glyph-stream recovery and file-first batch storage regression');
