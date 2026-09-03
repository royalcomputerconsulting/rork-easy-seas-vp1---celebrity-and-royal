const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const provider = read('state/CertificatesProvider.tsx');
const screen = read('app/certificate-codes.tsx');

assert.match(provider, /certificateDocumentLoadState: 'idle' \| 'loading' \| 'ready' \| 'error'/);
assert.match(provider, /cacheDocumentProjections\(current, documents\)/, 'a one-time document restore must seed the indexed certificate projection');
assert.match(provider, /cacheDocumentProjections\(current, \[stored\]\)/, 'new downloads must update the fast projection without rereading the complete document library');
assert.doesNotMatch(provider.match(/const storeCertificateDocument[\s\S]*?const reprocessCertificateDocument/)?.[0] ?? '', /loadCertificateDocuments\(\{ force: true \}\)/, 'one saved document must not force a full-library reload');
assert.doesNotMatch(screen, /runAfterUiSettles/, 'certificate focus must not wait indefinitely for InteractionManager');
assert.match(screen, /setTimeout\(\(\) => \{[\s\S]*?refreshCertificateDocuments\(\)[\s\S]*?\}, 32\)/);
assert.match(screen, /certificate-codes\.library-loading/);
assert.match(screen, /Restoring saved certificate results/);
assert.match(screen, /certificate-codes\.library-retry/);

console.log('PASS Build 446 certificate hydration starts after first paint, reports readiness, seeds a fast indexed projection, and avoids full-library reload after each saved document.');
