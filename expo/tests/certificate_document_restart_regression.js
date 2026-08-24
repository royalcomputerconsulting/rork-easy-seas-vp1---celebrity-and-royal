const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const persistedStorage = new Map();

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
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

function loadDocumentStore() {
  const pipeline = loadStandaloneTs('lib/certificates/certificatePdfPipeline.ts');
  const storage = {
    default: {
      getItem: async (key) => persistedStorage.get(key) ?? null,
      setItem: async (key, value) => persistedStorage.set(key, value),
    },
  };
  return {
    pipeline,
    store: loadStandaloneTs('lib/certificates/certificateDocumentStore.ts', {
      '@react-native-async-storage/async-storage': storage,
      '../storage/quotaSafeStorage': {
        quotaSafeGetItem: async (key) => persistedStorage.get(key) ?? null,
        quotaSafeSetJsonItem: async (key, value) => persistedStorage.set(key, JSON.stringify(value)),
      },
      './certificatePdfPipeline': pipeline,
    }),
  };
}

(async () => {
  const firstLaunch = loadDocumentStore();
  const bytes = new Uint8Array(Buffer.from('%PDF-1.4\n(2607A02A)\n(Icon of the Seas 04/02/2026)\n(Balcony)\n(2 Guests)\n(Free Play $500)'));
  const documentHash = firstLaunch.pipeline.sha256DocumentHash(bytes);
  const download = {
    status: 'downloaded',
    bytes,
    provenance: {
      originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A02A.pdf',
      retrievedAt: '2026-07-17T00:00:00.000Z',
      documentHash,
      documentVersion: documentHash,
    },
  };
  const parsed = firstLaunch.pipeline.parseCertificatePdfOnDevice(download, '2607A02A');
  const saved = await firstLaunch.store.storeCertificateDocument(
    '@easyseas_certificate_documents_v2:profile-a',
    download,
    parsed,
    undefined,
    {
      documentKind: 'monthly_index',
      discoveryEvidence: {
        monthCode: '2607',
        familyCode: 'A',
        discoveredCodes: ['2607A02A'],
        discoveredAt: '2026-07-17T00:00:00.000Z',
      },
    },
  );
  const persistedPayload = persistedStorage.get('@easyseas_certificate_documents_v2:profile-a');
  assert.ok(persistedPayload, 'first launch must write a durable JSON payload');

  // A fresh module instance models a cold app launch while retaining only the
  // serialized AsyncStorage payload, not any in-memory document-store state.
  const restartedLaunch = loadDocumentStore();
  const reloaded = await restartedLaunch.store.listCertificateDocuments('@easyseas_certificate_documents_v2:profile-a');
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, saved.id);
  assert.equal(reloaded[0].documentKind, 'monthly_index');
  assert.deepEqual(reloaded[0].discoveryEvidence.discoveredCodes, ['2607A02A']);
  assert.equal(reloaded[0].parseHistory.length, 1);
  assert.deepEqual(Array.from(restartedLaunch.store.restoreCertificateDocumentBytes(reloaded[0])), Array.from(bytes));
  assert.deepEqual(await restartedLaunch.store.listCertificateDocuments('@easyseas_certificate_documents_v2:profile-b'), []);

  const reprocessed = await restartedLaunch.store.reprocessStoredCertificateDocument(
    '@easyseas_certificate_documents_v2:profile-a',
    saved.id,
    '2607A02A',
  );
  assert.equal(reprocessed.parseHistory.length, 2, 'a post-restart reprocess must append, not replace, parser history');
  assert.equal(reprocessed.documentKind, 'monthly_index');
  assert.deepEqual(reprocessed.discoveryEvidence.discoveredCodes, ['2607A02A']);

  const secondRestart = loadDocumentStore();
  const reparsedReload = await secondRestart.store.listCertificateDocuments('@easyseas_certificate_documents_v2:profile-a');
  assert.equal(reparsedReload.length, 1);
  assert.equal(reparsedReload[0].parseHistory.length, 2, 'the post-restart reprocess must survive the following cold start');
  assert.deepEqual(Array.from(secondRestart.store.restoreCertificateDocumentBytes(reparsedReload[0])), Array.from(bytes));

  console.log('Certificate document cold-start persistence regression checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
