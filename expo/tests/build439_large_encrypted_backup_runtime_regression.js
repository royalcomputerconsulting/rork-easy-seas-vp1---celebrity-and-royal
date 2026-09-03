#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'lib/backup/incrementalEncryptedBackup.ts');
const source = fs.readFileSync(file, 'utf8');
let committedTransactions = 0;
let committedRows = 0;
const database = {
  withTransactionAsync: async (run) => { committedTransactions += 1; await run(); },
  runAsync: async (sql) => { if (/INSERT INTO backup_dataset_entries/.test(sql)) committedRows += 1; },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/database/HealthTrustDatabase') return { HEALTH_TRUST_SCHEMA_VERSION: 5, getHealthTrustDatabase: async () => database };
  return originalLoad.call(this, request, parent, isMain);
};

const records = (count, factory) => Object.fromEntries(Array.from({ length: count }, (_, index) => {
  const value = factory(index);
  return [value.id, value];
}));
const representative = {
  cruises: records(3151, (index) => ({ id: `cruise-${index}`, shipName: index % 2 ? 'Harmony' : 'Icon', sailDate: `2027-${String(index % 12 + 1).padStart(2, '0')}-01`, offerId: `offer-${index % 13}`, cabinType: index % 3 ? 'Balcony' : 'Interior', guests: index % 4 ? 2 : 1 })),
  crewRecognition: records(925, (index) => ({ id: `crew-${index}`, ownerProfileId: index % 2 ? 'primary' : 'secondary', fullName: `Crew Member ${index}`, shipName: `Ship ${index % 20}` })),
  certificates: records(26, (index) => ({ id: `cert-${index}`, certificateCode: `2609A${String(index).padStart(2, '0')}`, parsedSailings: index * 100 })),
  casinoSessions: records(50, (index) => ({ id: `session-${index}`, ownerProfileId: 'primary', points: index * 100, winLoss: index % 2 ? 581 : -200 })),
  provenance: records(80, (index) => ({ id: `provenance-${index}`, ownerId: index % 3 ? 'primary' : null, entityId: `cruise-${index}`, sourceType: 'provider_sync' })),
  userPreferences: { primary: { id: 'primary', theme: 'high-contrast', reducedMotion: true }, secondary: { id: 'secondary', theme: 'dark' } },
};

try {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  const backup = mod.exports;

  (async () => {
    const startedAt = Date.now();
    const full = await backup.createIncrementalEncryptedBackup({
      ownerId: 'account@example.com',
      appVersion: '13.0.73',
      password: 'representative large backup',
      datasets: representative,
    });
    const elapsedMs = Date.now() - startedAt;
    const expectedRecords = Object.values(representative).reduce((sum, dataset) => sum + Object.keys(dataset).length, 0);
    assert.equal(full.envelope.records.length, expectedRecords);
    assert.equal(committedTransactions, 1, 'a completed backup must publish exactly one manifest transaction');
    assert.equal(committedRows, expectedRecords);
    assert(elapsedMs < 60_000, `representative backup exceeded the 60-second responsiveness gate (${elapsedMs}ms)`);
    const restored = await backup.decryptBackupDatasets(full.envelope, full.recoveryKey, 'recovery-key');
    for (const [dataset, values] of Object.entries(representative)) {
      assert.equal(Object.keys(restored[dataset]).length, Object.keys(values).length, `${dataset} count must survive encryption exactly`);
    }
    assert.equal(restored.casinoSessions['session-1'].winLoss, 581);
    assert.equal(restored.userPreferences.primary.theme, 'high-contrast');
    assert.equal(restored.crewRecognition['crew-1'].ownerProfileId, 'primary');
    assert.equal(restored.crewRecognition['crew-0'].ownerProfileId, 'secondary');

    committedTransactions = 0;
    committedRows = 0;
    const signal = { aborted: false };
    let resumeCheckpoint = null;
    try {
      await backup.createIncrementalEncryptedBackup({
        ownerId: 'account@example.com',
        appVersion: '13.0.73',
        password: 'cancel and resume backup',
        datasets: { metadata: { one: { id: 'one', value: 1 } }, cruises: records(400, (index) => ({ id: `resume-cruise-${index}`, value: index })) },
        signal,
        onProgress: (dataset, done) => { if (dataset === 'cruises' && done >= 100) signal.aborted = true; },
      });
      assert.fail('the cancellable backup should stop');
    } catch (error) {
      assert(error instanceof backup.BackupCancelledError);
      resumeCheckpoint = error.checkpoint;
    }
    assert.equal(committedTransactions, 0, 'a cancelled backup must not publish a manifest or partial success');
    assert.deepEqual(resumeCheckpoint.completedDatasets, ['metadata']);

    const resumedDatasets = { metadata: { one: { id: 'one', value: 1 } }, cruises: records(400, (index) => ({ id: `resume-cruise-${index}`, value: index })) };
    const resumed = await backup.createIncrementalEncryptedBackup({
      ownerId: 'account@example.com',
      appVersion: '13.0.73',
      password: 'cancel and resume backup',
      datasets: resumedDatasets,
      resume: resumeCheckpoint,
    });
    assert.equal(committedTransactions, 1);
    assert.equal(resumed.envelope.records.length, 401);
    const resumedRestored = await backup.decryptBackupDatasets(resumed.envelope, resumed.recoveryKey, 'recovery-key');
    assert.deepEqual(resumedRestored.metadata.one, { id: 'one', value: 1 });
    assert.equal(Object.keys(resumedRestored.cruises).length, 400);

    const restoreSignal = { aborted: false };
    await assert.rejects(
      () => backup.decryptBackupDatasets(full.envelope, full.recoveryKey, 'recovery-key', {}, (done) => { if (done >= 100) restoreSignal.aborted = true; }, restoreSignal),
      /RESTORE_CANCELLED/,
    );
    console.log(`Build 439 representative encrypted backup: ${expectedRecords} records in ${elapsedMs}ms; exact restore, cancel, retry, and resume passed`);
  })().catch((error) => { console.error(error); process.exitCode = 1; });
} finally {
  Module._load = originalLoad;
}
