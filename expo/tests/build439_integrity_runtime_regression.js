#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'lib/integrity/integrityCenter.ts');
const source = fs.readFileSync(file, 'utf8');
const statements = [];
const mockDatabase = {
  withTransactionAsync: async (run) => run(),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  runAsync: async (sql, args) => { statements.push({ sql, args }); },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/database/HealthTrustDatabase') return { getHealthTrustDatabase: async () => mockDatabase };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  const center = mod.exports;
  const now = new Date('2026-08-29T12:00:00.000Z');
  const representative = {
    ownerId: 'primary',
    cruises: [
      { id: 'cruise-a', ownerId: 'primary', shipName: 'Harmony', sailDate: '2026-09-10', reservationNumber: '123' },
      { id: 'cruise-b', ownerId: 'primary', shipName: 'Harmony', sailDate: '2026-09-10', reservationNumber: '123' },
      { id: 'cruise-bad-date', ownerId: 'primary', shipName: 'Icon', sailDate: '09/99/2026', reservationNumber: '456' },
      { id: 'leaked-cruise', ownerId: 'secondary', shipName: 'Oasis', sailDate: '2026-11-01', reservationNumber: '789' },
    ],
    offers: [{ id: 'offer-a' }],
    offerSailings: [{ id: 'orphan-link', offerId: 'offer-a', cruiseId: 'not-present' }],
    certificates: [{ id: 'cert-a', certificateCode: '2609A03', issueDate: '2025-01-01' }],
    loyalty: [{ id: 'loyalty-a', ownerId: 'primary', program: 'Club Royale', updatedAt: '2026-01-01T00:00:00.000Z' }],
    casinoTotals: [{ id: 'casino-a', ownerId: 'primary', points: 1_000, coinIn: 500 }],
    relationships: [{ id: 'edge-a', from: 'cruise-a', to: '' }],
  };
  const issues = center.scanIntegrity(representative, now);
  const kinds = new Set(issues.map((row) => row.kind));
  for (const kind of [
    'duplicate_cruise',
    'orphan_offer_sailing',
    'owner_leakage',
    'unlinked_certificate',
    'impossible_total',
    'stale_loyalty',
    'malformed_date',
    'broken_relationship',
  ]) assert(kinds.has(kind), `representative fixture must detect ${kind}`);

  for (const blockedKind of ['duplicate_cruise', 'owner_leakage', 'unlinked_certificate', 'impossible_total', 'malformed_date']) {
    const preview = center.buildRepairPreview(issues.find((row) => row.kind === blockedKind));
    assert.equal(preview.allowed, false, `${blockedKind} must never silently alter records`);
    assert.equal(preview.requiresConfirmation, true);
  }

  const orphan = issues.find((row) => row.kind === 'orphan_offer_sailing');
  const orphanPreview = center.buildRepairPreview(orphan);
  assert.equal(orphanPreview.allowed, true);
  (async () => {
    const applied = await center.applyIntegrityRepair(orphan);
    assert.equal(applied.applied, true);
    assert(statements.some((entry) => /INSERT OR REPLACE INTO integrity_quarantine/.test(entry.sql)), 'safe repair must retain reversible quarantine evidence');
    assert(!statements.some((entry) => /DELETE FROM domain_records|UPDATE domain_records/i.test(entry.sql)), 'integrity repair must not silently modify shared cruise/offer repositories');

    const secondUser = center.scanIntegrity({
      ownerId: 'secondary',
      cruises: [{ id: 'primary-only', ownerId: 'primary', shipName: 'Icon', sailDate: '2026-10-01', reservationNumber: '111' }],
    }, now);
    assert(secondUser.some((row) => row.kind === 'owner_leakage' && row.ambiguous), 'a second-user fixture must expose owner leakage as blocked review work');

    const postSync = center.scanIntegrity({
      ownerId: 'primary',
      cruises: [{ id: 'cruise-a', ownerId: 'primary', shipName: 'Harmony', sailDate: '2026-09-10', reservationNumber: '123' }],
      offers: [{ id: 'offer-a' }],
      offerSailings: [{ id: 'valid-link', offerId: 'offer-a', cruiseId: 'cruise-a' }],
      loyalty: [{ id: 'loyalty-a', ownerId: 'primary', program: 'Club Royale', updatedAt: '2026-08-29T11:00:00.000Z' }],
      casinoTotals: [{ id: 'casino-a', ownerId: 'primary', points: 1_000, coinIn: 5_000 }],
    }, now);
    assert.equal(postSync.length, 0, 'post-sync reconciled fixture must be clean');

    const restored = JSON.parse(JSON.stringify(representative));
    assert.deepEqual(
      new Set(center.scanIntegrity(restored, now).map((row) => row.kind)),
      kinds,
      'restored-backup fixture must produce the same transparent findings',
    );
    console.log('Build 439 integrity primary/secondary/restore/post-sync runtime regression passed');
  })().catch((error) => { console.error(error); process.exitCode = 1; });
} finally {
  Module._load = originalLoad;
}
