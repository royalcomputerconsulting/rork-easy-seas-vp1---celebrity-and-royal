const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const fixtureRoot = path.join(root, 'tests/fixtures/royal-august-2026-live');
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const historicalFixtureRoot = path.join(root, 'tests/fixtures/royal-april-2026-uploaded');
const historicalManifest = JSON.parse(fs.readFileSync(path.join(historicalFixtureRoot, 'manifest.json'), 'utf8'));

const originalLoad = Module._load;
Module._load = function patchedCertificateLoad(request, parent, isMain) {
  if (String(request).includes('certificateDocumentStore')) {
    return {
      archiveCertificatePdfBytes: async () => ({}),
      archiveCertificatePdfBytesBatch: async () => new Map(),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');
  const engine = loadTs('lib/certificates/clientCertificatePdfEngine.ts');
  assert.match(engine.CLIENT_CERTIFICATE_PDF_ENGINE_VERSION, /dual-row-parser-completeness-authority/);
  assert.equal(manifest.certificates.length, 28, 'The complete August A/C certificate catalog must remain covered.');

  let totalSailings = 0;
  for (const expected of manifest.certificates) {
    const bytes = fs.readFileSync(path.join(fixtureRoot, `${expected.code}.pdf`));
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, expected.sha256, `${expected.code} fixture changed unexpectedly.`);
    const result = engine.parseCertificatePdfBytesBestAvailableFixture({
      certificateCode: expected.code,
      pdfBytes: new Uint8Array(bytes),
    });
    assert.equal(result.sailingCount, expected.sailings, `${expected.code} must retain every verified sailing row.`);
    assert.ok(result.firstSailing?.shipName && result.firstSailing?.sailDate, `${expected.code} needs a material first row.`);
    assert.ok(result.lastSailing?.shipName && result.lastSailing?.sailDate, `${expected.code} needs a material last row.`);
    assert.equal(result.parserAuthority, expected.authority ?? 'structured-text');
    totalSailings += result.sailingCount;
  }
  assert.equal(totalSailings, 26430, 'The 28 official August certificates must retain the complete verified sailing total.');

  let historicalTotal = 0;
  for (const expected of historicalManifest.certificates) {
    const bytes = fs.readFileSync(path.join(historicalFixtureRoot, `${expected.code}.pdf`));
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, expected.sha256, `${expected.code} uploaded fixture changed unexpectedly.`);
    const selected = engine.parseCertificatePdfBytesBestAvailableFixture({
      certificateCode: expected.code,
      pdfBytes: new Uint8Array(bytes),
    });
    const forcedShared = engine.parseCertificatePdfBytesWithDeviceFallbackFixture({
      certificateCode: expected.code,
      pdfBytes: new Uint8Array(bytes),
    });
    assert.equal(selected.sailingCount, expected.sailings, `${expected.code} must retain every uploaded-fixture sailing row.`);
    assert.equal(forcedShared.sailingCount, expected.sailings, `${expected.code} shared device parser must agree with the selected result.`);
    assert.equal(`${selected.firstSailing.shipName}|${selected.firstSailing.sailDate}`, expected.first);
    assert.equal(`${selected.lastSailing.shipName}|${selected.lastSailing.sailDate}`, expected.last);
    historicalTotal += selected.sailingCount;
  }
  assert.equal(historicalTotal, 1423);
  console.log(`PASS Build 388: 28 official August PDFs (${totalSailings} rows) + uploaded April PDFs (${historicalTotal} rows)`);
} finally {
  Module._load = originalLoad;
}
