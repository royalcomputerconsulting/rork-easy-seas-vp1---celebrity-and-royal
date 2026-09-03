#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const compile = (relative, mocks) => {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) { return request in mocks ? mocks[request] : originalLoad.call(this, request, parent, isMain); };
  try {
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); mod._compile(js, file); return mod.exports;
  } finally { Module._load = originalLoad; }
};

(async () => {
  const legacyRows = Array.from({ length: 600 }, (_, index) => ({ id: `offer-${index}`, code: `2609A${index % 13}` }));
  const sourceKey = '@offers::account@example.com';
  const domainRows = new Map();
  const rowKey = (owner, domain, id) => `${owner}\u0000${domain}\u0000${id}`;
  domainRows.set(rowKey('account@example.com', 'casino_offers', 'old-offer'), { ownerId: 'account@example.com', domain: 'casino_offers', recordId: 'old-offer', recordJson: JSON.stringify({ id: 'old-offer' }), sourceStorageKey: sourceKey, sourceHash: 'old-hash', updatedAt: 'old' });
  const checkpoints = new Map();
  const rollbackAudits = [];
  let upsertCalls = 0;
  let failSecondBatch = true;
  const matching = (owner, domain) => [...domainRows.values()].filter((row) => row.ownerId === owner && row.domain === domain);
  const removeWhere = (predicate) => { for (const [key, row] of domainRows) if (predicate(row)) domainRows.delete(key); };
  const db = {
    withTransactionAsync: async (run) => run(),
    getFirstAsync: async (sql, args) => {
      if (/SELECT last_index,state FROM migration_checkpoints/.test(sql)) { const row = checkpoints.get(args[0]); return row ? { last_index: row.lastIndex, state: row.state } : null; }
      if (/SELECT id,source_hash FROM migration_checkpoints/.test(sql)) { const rows = [...checkpoints.values()].filter((row) => row.ownerId === args[0] && row.domain === args[1] && row.sourceKey === args[2]); return rows.at(-1) ? { id: rows.at(-1).id, source_hash: rows.at(-1).sourceHash } : null; }
      if (/COUNT\(\*\).*source_storage_key=\? AND source_hash=\?/.test(sql)) return { count: matching(args[0], args[1]).filter((row) => row.sourceStorageKey === args[2] && row.sourceHash === args[3]).length };
      if (/COUNT\(\*\).*domain=\?/.test(sql)) return { count: matching(args[0], args[1]).length };
      return null;
    },
    runAsync: async (sql, args = []) => {
      if (/DELETE FROM domain_records WHERE owner_id=\? AND domain IN/.test(sql)) { removeWhere((row) => row.ownerId === args[0] && (row.domain === args[1] || row.domain === args[2])); return; }
      if (/DELETE FROM domain_records WHERE owner_id=\? AND domain=\? AND source_storage_key=\? AND source_hash=\?/.test(sql)) { removeWhere((row) => row.ownerId === args[0] && row.domain === args[1] && row.sourceStorageKey === args[2] && row.sourceHash === args[3]); return; }
      if (/DELETE FROM domain_records WHERE owner_id=\? AND domain=\? AND source_storage_key=\?/.test(sql)) { removeWhere((row) => row.ownerId === args[0] && row.domain === args[1] && row.sourceStorageKey === args[2]); return; }
      if (/DELETE FROM domain_records WHERE owner_id=\? AND domain=\?/.test(sql)) { removeWhere((row) => row.ownerId === args[0] && row.domain === args[1]); return; }
      if (/INSERT OR REPLACE INTO domain_records[\s\S]*SELECT owner_id,\?,record_id[\s\S]*source_storage_key=\?/.test(sql)) {
        const [destination, owner, sourceDomain, storageKey] = args;
        matching(owner, sourceDomain).filter((row) => row.sourceStorageKey === storageKey).forEach((row) => domainRows.set(rowKey(owner, destination, row.recordId), { ...row, domain: destination })); return;
      }
      if (/INSERT OR REPLACE INTO domain_records[\s\S]*SELECT owner_id,\?,record_id/.test(sql)) {
        const [destination, owner, sourceDomain] = args;
        matching(owner, sourceDomain).forEach((row) => domainRows.set(rowKey(owner, destination, row.recordId), { ...row, domain: destination })); return;
      }
      if (/INSERT OR REPLACE INTO migration_checkpoints/.test(sql)) { checkpoints.set(args[0], { id: args[0], ownerId: args[1], domain: args[2], sourceKey: args[3], state: args[4], lastIndex: args[5], total: args[6], sourceHash: args[7] }); return; }
      if (/UPDATE migration_checkpoints SET last_index/.test(sql)) { checkpoints.get(args[2]).lastIndex = args[0]; return; }
      if (/UPDATE migration_checkpoints SET state=\?,last_index/.test(sql)) { const row = checkpoints.get(args[3]); row.state = args[0]; row.lastIndex = args[1]; return; }
      if (/UPDATE migration_checkpoints SET state='rolled_back'/.test(sql)) { const row = checkpoints.get(args[2]); row.state = 'rolled_back'; row.lastIndex = 0; row.error = args[1]; return; }
      if (/INSERT INTO migration_rollback_history/.test(sql)) { rollbackAudits.push(args); return; }
    },
  };
  const upsertDomainRecords = async (rows) => {
    upsertCalls += 1;
    if (failSecondBatch && upsertCalls === 2) throw new Error('SIMULATED_INTERRUPTION');
    rows.forEach((row) => domainRows.set(rowKey(row.ownerId, row.domain, row.recordId), row));
  };
  const migration = compile('lib/database/highVolumeMigration.ts', {
    '@/lib/storage/storageKeys': { ALL_STORAGE_KEYS: {}, getUserScopedKey: (key) => key },
    '@/lib/storage/quotaSafeStorage': { quotaSafeGetItem: async (key) => key === sourceKey ? JSON.stringify(legacyRows) : null },
    './HealthTrustDatabase': { getHealthTrustDatabase: async () => db, upsertDomainRecords },
    '@react-native-async-storage/async-storage': { default: { getAllKeys: async () => [] } },
  });
  const definition = { domain: 'casino_offers', storageKey: sourceKey };
  await assert.rejects(() => migration.migrateHighVolumeDomain('account@example.com', definition), /SIMULATED_INTERRUPTION/);
  assert.equal(matching('account@example.com', 'casino_offers').length, 1, 'interrupted staging must leave the prior live generation untouched');
  assert.equal([...checkpoints.values()][0].lastIndex, 250, 'checkpoint must stop at the last committed batch');
  failSecondBatch = false;
  await migration.migrateHighVolumeDomain('account@example.com', definition);
  assert.equal(matching('account@example.com', 'casino_offers').length, 600, 'resume must atomically promote the complete staged generation');
  assert.equal([...checkpoints.values()][0].state, 'complete');
  const rollback = await migration.rollbackHighVolumeMigration('account@example.com', definition, sourceKey, 'acceptance rollback');
  assert.equal(rollback.removedRows, 600);
  assert.equal(rollback.restoredRows, 1);
  assert.equal(matching('account@example.com', 'casino_offers').length, 1);
  assert.equal(JSON.parse(matching('account@example.com', 'casino_offers')[0].recordJson).id, 'old-offer');
  assert.equal(rollbackAudits.length, 1, 'migration rollback must retain an audit record');

  const history = [];
  const quarantines = [];
  const issueStates = new Map();
  const integrityDb = {
    withTransactionAsync: async (run) => run(),
    getFirstAsync: async (sql, args) => {
      if (/FROM repair_history/.test(sql)) return history.find((row) => row.id === args[0]) ?? null;
      if (/FROM integrity_quarantine/.test(sql)) return quarantines.find((row) => row.issue_id === args[0] && !row.restored_at) ?? null;
      return null;
    },
    runAsync: async (sql, args = []) => {
      if (/INSERT OR REPLACE INTO integrity_quarantine/.test(sql)) { quarantines.push({ id: args[0], issue_id: args[1], owner_id: args[2], restored_at: null }); return; }
      if (/INSERT INTO repair_history/.test(sql)) { history.push({ id: args[0], issue_id: args[1], owner_id: args[2], repair_kind: args[3], before_json: args[4], after_json: args[5], result: args[7] }); return; }
      if (/UPDATE integrity_issues SET state=\?/.test(sql)) { issueStates.set(args[2], args[0]); return; }
      if (/UPDATE integrity_quarantine SET restored_at/.test(sql)) { const row = quarantines.find((item) => item.id === args[1]); row.restored_at = args[0]; return; }
      if (/UPDATE integrity_issues SET state='open'/.test(sql)) { issueStates.set(args[1], 'open'); return; }
    },
  };
  const integrity = compile('lib/integrity/integrityCenter.ts', { '@/lib/database/HealthTrustDatabase': { getHealthTrustDatabase: async () => integrityDb } });
  const issues = integrity.scanIntegrity({ ownerId: 'primary', cruises: [{ id: 'c1', ownerId: 'primary', shipName: 'Harmony', sailDate: '2026-09-10' }], offers: [{ id: 'o1' }], offerSailings: [{ id: 'broken', offerId: 'o1', cruiseId: 'missing' }] }, new Date('2026-08-31T00:00:00Z'));
  const orphan = issues.find((row) => row.kind === 'orphan_offer_sailing');
  assert.equal(integrity.buildRepairPreview(orphan).allowed, true);
  assert.equal((await integrity.applyIntegrityRepair(orphan)).applied, true);
  const appliedHistory = history.find((row) => row.result === 'applied');
  assert(appliedHistory);
  const restoredRepair = await integrity.rollbackIntegrityRepair(appliedHistory.id, 'primary');
  assert.equal(restoredRepair.applied, true);
  assert.equal(quarantines[0].restored_at != null, true);
  assert.equal(issueStates.get(orphan.id), 'open');
  assert(history.some((row) => row.result === 'rolled_back'));

  const actionInbox = fs.readFileSync(path.join(root, 'app/action-inbox.tsx'), 'utf8');
  assert.match(actionInbox, /integrityOwnerIds/);
  assert.match(actionInbox, /users\.map\(\(user\) => user\.id\)/);
  assert.match(actionInbox, /new Map\(issueGroups\.flat\(\)/);
  const trustCenter = fs.readFileSync(path.join(root, 'app/data-trust-center.tsx'), 'utf8');
  for (const token of ['getDomainMigrationDiagnostics', 'confirmMigrationRollback', 'rollbackHighVolumeMigration', 'Indexed migration checkpoints', 'confirmRepairRollback', 'Restore quarantined relationship']) assert.match(trustCenter, new RegExp(token));
  const observer = fs.readFileSync(path.join(root, 'components/DataTrustObserver.tsx'), 'utf8');
  for (const token of ['persistProvenanceSnapshot', 'cruise:', 'offer:', 'certificate:', 'casino,', 'loyalty:', 'financial:', 'weather:', 'crew:', 'profile:', 'preference:']) assert.match(observer, new RegExp(token));
  const providers = ['state/CoreDataProvider.tsx', 'state/CertificatesProvider.tsx', 'state/CasinoSessionProvider.tsx', 'state/CrewRecognitionProvider.tsx', 'state/SlotMachineLibraryProvider.tsx'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  for (const token of ['hydrateHighVolumeDomain', 'replaceHighVolumeDomain', 'booked_cruises', 'casino_offers', 'calendar_events', 'casino_sessions', 'certificates', 'crew_recognition', 'crew_sailings', 'machine_encyclopedia', 'slot_atlas']) assert.match(providers, new RegExp(token));
  const cruiseRepository = fs.readFileSync(path.join(root, 'lib/cruiseInventory/CruiseInventoryRepository.ts'), 'utf8');
  assert.match(cruiseRepository, /withTransactionAsync/);
  assert.match(cruiseRepository, /owner_scope/);
  assert.match(cruiseRepository, /CATALOG_READBACK_MISMATCH/);
  console.log('PASS Build 444 database/integrity acceptance: interrupted staging, atomic resume, audited rollback, repair rollback, all-profile inbox, provenance domains, indexed consumers, and owner-scoped cruise repository verified');
})().catch((error) => { console.error(error); process.exitCode = 1; });
