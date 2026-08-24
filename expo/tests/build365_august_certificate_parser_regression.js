const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
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

const pako = {
  inflate: (bytes) => new Uint8Array(zlib.inflateSync(Buffer.from(bytes))),
  inflateRaw: (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))),
};

function compressedPdfObject(objectNumber, content) {
  const compressed = zlib.deflateSync(Buffer.from(content, 'latin1'));
  return Buffer.concat([
    Buffer.from(`${objectNumber} 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'),
    compressed,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ]);
}

function encodeWithShiftedGlyphMap(text) {
  return Array.from(text)
    .map((character) => (character.charCodeAt(0) + 0x100).toString(16).padStart(4, '0'))
    .join('');
}

const cmap = [
  '/CIDInit /ProcSet findresource begin',
  '12 dict begin',
  'begincmap',
  '1 beginbfrange',
  '<0100> <017F> <0000>',
  'endbfrange',
  'endcmap',
  'end',
  'end',
].join('\n');
const augustRow = '2608C08 Jewel Of The Seas® Fort Lauderdale, Florida August 10, 2026 4 Night Bahamas & Perfect Day Cruise Balcony - GTY Cruise Fare For 1 Guest $25';
const content = `BT\n/F1 10 Tf\n<${encodeWithShiftedGlyphMap(augustRow)}> Tj\nET`;
const pdfBytes = new Uint8Array(Buffer.concat([
  Buffer.from('%PDF-1.7\n', 'latin1'),
  compressedPdfObject(1, cmap),
  compressedPdfObject(2, content),
  Buffer.from('%%EOF\n', 'latin1'),
]));

const pipeline = compileTs('lib/certificates/certificatePdfPipeline.ts', { pako });
const extracted = pipeline.extractCertificatePdfText(pdfBytes);
assert.match(extracted, /2608C08 Jewel Of The Seas/);
assert.match(extracted, /August 10, 2026/);
const parsed = pipeline.parseCertificatePdfOnDevice({
  status: 'downloaded',
  bytes: pdfBytes,
  provenance: {
    originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C08.pdf',
    retrievedAt: '2026-08-02T12:59:07.000Z',
  },
}, '2608C08');
assert.equal(parsed.status, 'parsed_successfully');
assert.equal(parsed.sailings.length, 1);
assert.equal(parsed.sailings[0].shipName, 'Jewel Of The Seas');
assert.equal(parsed.sailings[0].sailingDate, '2026-08-10');
assert.equal(parsed.sailings[0].cabinCategory.toLowerCase(), 'balcony');
assert.equal(parsed.sailings[0].occupancy.toLowerCase(), '1 guest');

const batchSource = read('lib/certificates/certificateBatchDownload.ts');
const loggerSource = read('lib/certificates/certificateDownloadLogger.ts');
const codesScreen = read('app/certificate-codes.tsx');
assert.match(batchSource, /downloadedBytes=\$\{diagnostic\.downloadedBytes/);
assert.match(batchSource, /extractedTextCharacters=\$\{diagnostic\.extractedTextLength/);
assert.match(batchSource, /diagnostic\.evidence\.forEach/);
assert.match(loggerSource, /v12\.7\.0-hermes-explicit-date-evidence/);
assert.match(codesScreen, /certificateCodes: \[entry\.certificateCode\],[\s\S]*?resetLog: true/);

const appJson = JSON.parse(read('app.json'));
assert.equal(appJson.expo.version, '13.0.44');
assert.equal(appJson.expo.ios.buildNumber, '410');
assert.equal(appJson.expo.android.versionCode, 130067);

console.log('PASS Build 366 August certificate parser regression — ToUnicode hex rows and evidence logging verified');
