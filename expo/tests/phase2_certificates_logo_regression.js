const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
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

(async () => {
  const transport = compileTs('lib/certificates/certificateBinaryTransport.ts', {
    'react-native': { Platform: { OS: 'web' } },
  });
  assert.equal(transport.isApprovedCertificatePdfUrl('https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607C06.pdf'), true);
  assert.equal(transport.isApprovedCertificatePdfUrl('http://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607C06.pdf'), false);
  assert.equal(transport.isApprovedCertificatePdfUrl('https://example.com/2607C06.pdf'), false);
  assert.deepEqual(Array.from(transport.decodeBase64Bytes(Buffer.from('%PDF-test').toString('base64'))), Array.from(Buffer.from('%PDF-test')));

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607C06.pdf',
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/pdf' : null },
    blob: async () => ({ arrayBuffer: async () => Uint8Array.from(Buffer.from('%PDF-1.4\nfixture')).buffer }),
  });
  try {
    const binary = await transport.downloadCertificateBinary('https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607C06.pdf');
    assert.equal(binary.transport, 'fetch-blob', 'blob fallback must work when Response.arrayBuffer is unavailable');
    assert.equal(String.fromCharCode(...binary.bytes.slice(0, 5)), '%PDF-');
  } finally {
    global.fetch = originalFetch;
  }

  const pipeline = compileTs('lib/certificates/certificatePdfPipeline.ts');
  const storage = new Map();
  const asyncStorage = {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => { storage.set(key, value); },
  };
  const documentStore = compileTs('lib/certificates/certificateDocumentStore.ts', {
    '../storage/quotaSafeStorage': {
    quotaSafeGetItem: async (key) => (typeof storage !== 'undefined' ? storage.get(key) ?? null : typeof stored !== 'undefined' ? stored.get(key) ?? null : null),
    quotaSafeSetJsonItem: async (key, value) => { const target = typeof storage !== 'undefined' ? storage : typeof stored !== 'undefined' ? stored : null; if (target) target.set(key, JSON.stringify(value)); },
  },
  '@react-native-async-storage/async-storage': { default: asyncStorage },
    './certificatePdfPipeline': pipeline,
  });
  assert.equal(typeof documentStore.archiveCertificatePdfBytes, 'function', 'direct-device archiver must be a real exported function');
  const bytes = new Uint8Array(Buffer.from('%PDF-1.4\n(2607C06)\n(Navigator Of The Seas July 24, 2026)\n(Balcony)'));
  const evidence = await documentStore.archiveCertificatePdfBytes({
    certificateCode: '2607C06',
    sourceUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607C06.pdf',
    bytes,
  });
  assert.equal(evidence.storageStatus, 'stored');
  assert.match(evidence.sha256, /^sha256:/);

  const clientEngine = read('lib/certificates/clientCertificatePdfEngine.ts');
  assert.match(clientEngine, /downloadPublicCertificatePdf\(url\)/, 'direct device engine must use the binary-safe PDF downloader');
  assert.doesNotMatch(clientEngine, /response\.arrayBuffer\(\)/, 'direct device engine must not blindly call an unavailable Response.arrayBuffer');
  assert.doesNotMatch(clientEngine, /const dateMatches[\s\S]{0,100}const dateMatches/, 'duplicate date matcher declaration must be absent');

  const batch = read('lib/certificates/certificateBatchDownload.ts');
  assert.match(batch, /Promise\.all\(codes\.map/, 'direct Royal downloads must use bounded group concurrency');
  assert.doesNotMatch(batch, /callBackend|trpcClient/, 'certificate downloads must not depend on the Easy Seas backend');
  assert.match(batch, /monthly index downloaded directly from Royal/);

  const codes = read('app/certificate-codes.tsx');
  assert.ok(!codes.includes("</Text>\\n{getMonthLabelForTarget(target)}"), 'month controls must not render a literal backslash-n');
  assert.match(codes, /styles\.monthLabelGroup/);
  assert.match(codes, /entry\.documentArchiveUri \|\| entry\.pdfUrl/);
  assert.match(codes, /downloadCertificateCatalogBatched/);

  const overview = read('app/(tabs)/(overview)/index.tsx');
  assert.match(overview, /resizeMode="cover"/);
  assert.match(overview, /offersHeroImageCard:[\s\S]{0,180}height: 220/);

  const opener = read('lib/royalCaribbean/certificatePdf.ts');
  assert.match(opener, /url\.startsWith\('file:\/\/'\)/);
  assert.match(opener, /Sharing\.shareAsync/);

  console.log('PASS phase2_certificates_logo_regression');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
