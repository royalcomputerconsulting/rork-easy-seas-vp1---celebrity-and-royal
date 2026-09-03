const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const store = read('lib/certificates/certificateDocumentStore.ts');
assert.match(store, /PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY/);

const provider = read('state/CertificatesProvider.tsx');
assert.match(provider, /documentStorageKeyRef = useRef\(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY\)/);
assert.match(provider, /legacyDocumentStorageKeyRef/);
assert.match(provider, /Migrated legacy profile certificate PDFs into shared Club Royale reference storage/);

for (const screen of ['app/certificate-codes.tsx', 'app/certificate-lookup.tsx', 'components/CertificateExplorerModal.tsx']) {
  const source = read(screen);
  assert.match(source, /documentStorageKey: PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY/, `${screen} must save public monthly certificates to shared storage`);
  assert.doesNotMatch(source, /getUserScopedKey\(CERTIFICATE_DOCUMENT_STORE_KEY/, `${screen} must not isolate public monthly PDFs by user`);
}

const bundle = read('lib/dataBundle/bundleOperations.ts');
assert.match(bundle, /certificateDocuments: CertificateDocumentRecord\[\]/);
assert.match(bundle, /totalCertificateSailingRows/);
assert.match(bundle, /quotaSafeSetJsonItem\(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY, merged\)/);
assert.match(bundle, /Imported shared Club Royale certificate documents/);

const fileIO = read('lib/dataBundle/bundleFileIO.ts');
assert.match(fileIO, /retained Club Royale certificate PDF/);
assert.match(fileIO, /parsed certificate sailing row/);

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /shared Club Royale certificate PDFs with parsed sailing rows/i);
assert.match(settings, /shared downloaded Club Royale certificate PDFs and parsed sailing rows/);

console.log('PASS Build 426 shared monthly certificate persistence and Save All/Load All coverage');
