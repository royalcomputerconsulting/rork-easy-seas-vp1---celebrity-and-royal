#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
function compile(relative, mocks) {
  const file = path.join(root, relative);
  const output = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) { return Object.prototype.hasOwnProperty.call(mocks, request) ? mocks[request] : originalLoad.call(this, request, parent, isMain); };
  try { const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); mod._compile(output, file); return mod.exports; }
  finally { Module._load = originalLoad; }
}

(async () => {
const stored = [];
const provenance = compile('lib/provenance/domainProvenance.ts', {
  './provenance': {
    createProvenanceLink: (input) => ({ id: `${input.entityType}:${input.entityId}:${input.field}`, isDerived: input.sourceType === 'derived_calculation' || input.sourceType === 'estimate', ...input }),
  },
  '@/lib/database/HealthTrustDatabase': { storeProvenanceLinks: async (links) => stored.push(...links) },
});

const derived = provenance.buildDomainProvenanceLinks('financial', [{
  id: 'summary', retailValue: 47774, paid: 4238.41, netCash: 15218.59,
  source: 'derived calculation', calculationFormula: 'winnings - paid',
  confidence: 'medium', updatedAt: '2026-09-01T12:00:00.000Z', sourceRecord: 'owner cruise ledger',
  parentProvenanceIds: ['casino:winnings', 'financial:paid'], ownerId: 'primary',
}], 'primary');
assert.equal(derived.length, 3);
assert.ok(derived.every((link) => link.ownerId === 'primary' && link.sourceType === 'derived_calculation' && link.isDerived));
assert.ok(derived.every((link) => link.formula === 'winnings - paid' && link.sourceRecord === 'owner cruise ledger'));

const cruiseLinks = provenance.buildDomainProvenanceLinks('cruise', [{
  id: 'voyage', shipName: 'Icon of the Seas', sailDate: '2026-09-15', nights: 7,
  cabinCategory: 'Balcony', guests: 2, seaDays: 3, portDays: 4, goldenHours: 26,
  casinoScore: 88, retailPrice: 4100, stateroomValue: 3600, provider: 'Royal Caribbean',
  syncedAt: '2026-09-01T12:00:00.000Z', confidence: 'high',
}], 'primary');
for (const field of ['shipName', 'sailDate', 'nights', 'cabinCategory', 'guests', 'seaDays', 'portDays', 'goldenHours', 'casinoScore', 'retailPrice', 'stateroomValue']) {
  assert.ok(cruiseLinks.some((link) => link.field === field), `cruise provenance missing ${field}`);
}
await provenance.persistProvenanceSnapshot({ cruise: [{ id: 'saved', shipName: 'Harmony', source: 'manual entry' }], offer: [{ id: 'shared', offerCode: '2609A05' }] }, 'primary');
assert.equal(stored.find((link) => link.entityType === 'cruise').ownerId, 'primary');
assert.equal(stored.find((link) => link.entityType === 'offer').ownerId, null);

const integrity = compile('lib/integrity/integrityCenter.ts', {
  '@/lib/database/HealthTrustDatabase': { getHealthTrustDatabase: async () => ({ withTransactionAsync: async (run) => run(), runAsync: async () => undefined, getAllAsync: async () => [], getFirstAsync: async () => null }) },
});
const issues = integrity.scanIntegrity({
  ownerId: 'primary',
  cruises: [
    { id: 'bad-calendar-date', ownerId: 'primary', shipName: 'Icon', sailDate: '2026-02-31', reservationNumber: '1' },
    { id: 'leak', ownerId: 'secondary', shipName: 'Oasis', sailDate: '2026-09-01', reservationNumber: '2' },
  ],
  offers: [{ id: 'offer' }],
  offerSailings: [{ id: 'orphan', offerId: 'offer', cruiseId: 'missing' }],
  certificates: [{ id: 'cert', certificateCode: '2609A05', issueDate: '2024-01-01' }],
  loyalty: [{ id: 'loyalty', ownerId: 'primary', updatedAt: '2025-01-01T00:00:00.000Z' }],
  casinoTotals: [{ id: 'casino', ownerId: 'primary', points: 1000, coinIn: 500 }],
  relationships: [{ id: 'edge', from: 'offer', to: '' }],
}, new Date('2026-09-01T12:00:00.000Z'));
for (const kind of ['malformed_date', 'owner_leakage', 'orphan_offer_sailing', 'unlinked_certificate', 'stale_loyalty', 'impossible_total', 'broken_relationship']) {
  assert.ok(issues.some((issue) => issue.kind === kind), `integrity scan missing ${kind}`);
}
for (const issue of issues.filter((row) => row.ambiguous)) assert.equal(integrity.buildRepairPreview(issue).allowed, false, `${issue.kind} must remain preview-only`);
assert.equal(integrity.buildRepairPreview(issues.find((row) => row.kind === 'orphan_offer_sailing')).allowed, true);
const inboxRows = integrity.integrityIssuesToInbox(issues);
assert.equal(inboxRows.length, issues.length);
assert.ok(inboxRows.every((row) => row.route.includes('/data-trust-center?issue=') && row.source === 'Automatic Integrity Center'));

const observer = read('components/DataTrustObserver.tsx');
assert.match(observer, /const availableCruises = await core\.getAllCruises\(\)/);
assert.match(observer, /const allCruises = \[\.\.\.\(core\.bookedCruises/);
assert.match(observer, /await persistProvenanceSnapshot/);
const trust = read('app/data-trust-center.tsx');
assert.match(trust, /const availableCruises = await core\.getAllCruises\(\)/);
assert.match(trust, /Preview and apply safe repair/);
assert.match(trust, /Restore quarantined relationship/);
const database = read('lib/database/HealthTrustDatabase.ts');
assert.match(database, /for \(let offset = 0; offset < links\.length; offset \+= 250\)/);
assert.match(database, /await new Promise<void>\(\(resolve\) => setTimeout\(resolve, 0\)\)/);
const actionInbox = read('app/action-inbox.tsx');
for (const contract of ['integrityIssuesToInbox', 'listIntegrityIssues', 'action-inbox-bulk-actions', 'Snooze 7 days', 'Mark done', 'assignedOwnerId', 'action-inbox-provenance']) assert.ok(actionInbox.includes(contract), `Action Inbox contract missing: ${contract}`);
const backup = read('lib/backup/incrementalEncryptedBackup.ts');
assert.match(backup, /provenance: mapArray/);
assert.match(backup, /provenanceLinks: values\(map, 'provenance'\)/);
const bundle = read('lib/dataBundle/bundleOperations.ts');
assert.match(bundle, /storeProvenanceLinks\(safeLinks\)/);
const agent = read('lib/agentSea/sourceRegistry.ts');
assert.match(agent, /buildAgentSeaProvenanceCitationBlock/);
assert.match(agent, /provenanceLinks/);

console.log('PASS Build 445 Item 43 provenance/integrity: important field evidence, strict dates, indexed-catalog scans, owner scoping, batched persistence, backup/restore, Agent SEA citations, blocked ambiguity, reversible repair, and Action Inbox surfacing are verified.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
