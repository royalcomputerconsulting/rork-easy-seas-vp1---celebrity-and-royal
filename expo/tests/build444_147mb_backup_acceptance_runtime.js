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

try {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  const backup = mod.exports;

  (async () => {
    const oneMiB = 'S'.repeat(1024 * 1024);
    const requiredDomains = {
      cruises: { 'cruise-1': { id: 'cruise-1', shipName: 'Harmony of the Seas', sailDate: '2026-09-10' } },
      bookedCruises: { 'booking-1': { id: 'booking-1', ownerProfileId: 'primary', casinoPoints: 23446 } },
      casinoOffers: { 'offer-1': { id: 'offer-1', code: '2609A05', eligibleCruiseCount: 1335 } },
      calendarEvents: { 'event-1': { id: 'event-1', cruiseId: 'booking-1', title: 'Nassau' } },
      casinoSessions: { 'session-1': { id: 'session-1', ownerProfileId: 'primary', points: 667, winLoss: 581 } },
      certificates: { 'certificate-1': { id: 'certificate-1', certificateCode: '2609A05' } },
      users: { primary: { id: 'primary', name: 'Sanitized Primary' }, secondary: { id: 'secondary', name: 'Sanitized Secondary' } },
      crewRecognition: { 'crew-1': { id: 'crew-1', ownerProfileId: 'primary', fullName: 'Sanitized Crew Member' } },
      crewSailings: { 'crew-sailing-1': { id: 'crew-sailing-1', ownerProfileId: 'primary', shipName: 'Harmony of the Seas' } },
      machineEncyclopedia: { 'machine-1': { id: 'machine-1', name: 'Sanitized Machine' } },
      savedAtlasMachines: { 'atlas-1': { id: 'atlas-1' } },
      customSlotMachines: { 'custom-1': { id: 'custom-1', ownerProfileId: 'primary' } },
      deckPlanLocations: { 'deck-1': { id: 'deck-1', shipName: 'Harmony of the Seas', deck: 4 } },
      casinoHistory: { casinoData: { annualPoints: 58680, netCash: 15218.59 } },
      profile: { current: { id: 'primary', crownAnchorPoints: 711 } },
      settings: { app: { theme: 'light', reducedMotion: true } },
      loyalty: { points: { clubRoyalePoints: 23446 }, extended: { captainsClubPoints: 1045 } },
      playingHours: { current: { earlyMorning: true } },
      provenance: { 'prov-1': { id: 'prov-1', ownerId: 'primary', sourceType: 'provider_sync' } },
      experiencePreferences: { primary: { density: 'comfortable', highContrast: false } },
      userPreferences: { primary: { notifications: true } },
      certificateDocuments: records(148, (index) => ({ id: `certificate-document-${index}`, documentHash: `sanitized-${index}`, payload: oneMiB })),
    };
    const payloadBytes = 148 * 1024 * 1024;
    assert(payloadBytes >= 147 * 1024 * 1024, 'qualification input must be at least 147 MiB before encryption');

    let progressEvents = 0;
    let eventLoopTicks = 0;
    const ticker = setInterval(() => { eventLoopTicks += 1; }, 1);
    const estimated = await backup.estimateBackupStorageBytes(requiredDomains, 0, () => { progressEvents += 1; });
    assert(estimated > payloadBytes, 'storage preflight must account for encryption, base64, two files, and reserve overhead');
    const enough = backup.assessBackupStorageCapacity(estimated, estimated + 256 * 1024 * 1024);
    assert.equal(enough.sufficient, true);
    const insufficient = backup.assessBackupStorageCapacity(estimated, estimated - 1);
    assert.equal(insufficient.sufficient, false);
    assert.throws(() => backup.assertBackupStorageCapacity(estimated, estimated - 1), /BACKUP_INSUFFICIENT_STORAGE/);

    const startedAt = Date.now();
    const full = await backup.createIncrementalEncryptedBackup({
      ownerId: 'primary',
      appVersion: '13.0.74',
      password: 'sanitized 147mb qualification',
      datasets: requiredDomains,
      onProgress: () => { progressEvents += 1; },
    });
    clearInterval(ticker);
    const elapsedMs = Date.now() - startedAt;
    const expectedRecords = Object.values(requiredDomains).reduce((sum, dataset) => sum + Object.keys(dataset).length, 0);
    assert.equal(full.envelope.records.length, expectedRecords);
    assert.equal(committedTransactions, 1, 'completed backup publishes one indexed manifest transaction');
    assert.equal(committedRows, expectedRecords, 'every encrypted row must be indexed');
    assert(progressEvents > 148, 'large backup must report bounded progress throughout preflight and encryption');
    assert(eventLoopTicks > 10, 'large-record work must yield repeatedly so the UI event loop remains responsive');

    const restored = await backup.decryptBackupDatasets(full.envelope, full.recoveryKey, 'recovery-key');
    const readback = backup.compareRestoreReadback(requiredDomains, restored);
    assert.equal(readback.exact, true);
    assert.equal(readback.expectedTotal, expectedRecords);
    assert.equal(restored.certificateDocuments['certificate-document-0'].payload.length, 1024 * 1024);
    assert.equal(restored.certificateDocuments['certificate-document-147'].documentHash, 'sanitized-147');
    assert.equal(restored.bookedCruises['booking-1'].casinoPoints, 23446);
    assert.equal(restored.casinoHistory.casinoData.annualPoints, 58680);
    assert.equal(restored.users.secondary.name, 'Sanitized Secondary');

    const current = {
      cruises: { 'cruise-1': requiredDomains.cruises['cruise-1'], 'current-only': { id: 'current-only' } },
      casinoOffers: { 'offer-1': { id: 'offer-1', code: 'CURRENT' } },
    };
    const preview = backup.previewBackupDatasetMap(current, restored, full.envelope.manifest.backupId);
    assert(preview.totals.add > 0);
    assert(preview.totals.preserve > 0);
    assert(preview.totals.update > 0);
    assert(preview.totals.conflict > 0);
    assert.equal(preview.totals.reject, 0);
    assert(preview.totals.delete > 0);
    const merged = backup.mergeRestoreDatasets(current, restored, 'preserve-current');
    assert.equal(merged.casinoOffers['offer-1'].code, 'CURRENT');

    committedTransactions = 0;
    committedRows = 0;
    const signal = { aborted: false };
    let checkpoint;
    await assert.rejects(async () => {
      try {
        await backup.createIncrementalEncryptedBackup({
          ownerId: 'primary', appVersion: '13.0.74', password: 'cancel resume qualification',
          datasets: { metadata: { one: { id: 'one' } }, cruises: records(250, (index) => ({ id: `resume-${index}`, value: index })) },
          signal,
          onProgress: (dataset, done) => { if (dataset === 'cruises' && done >= 100) signal.aborted = true; },
        });
      } catch (error) { checkpoint = error.checkpoint; throw error; }
    }, /BACKUP_CANCELLED/);
    assert.deepEqual(checkpoint.completedDatasets, ['metadata']);
    assert.equal(committedTransactions, 0, 'cancelled work must remain unpublished');
    const resumed = await backup.createIncrementalEncryptedBackup({
      ownerId: 'primary', appVersion: '13.0.74', password: 'cancel resume qualification',
      datasets: { metadata: { one: { id: 'one' } }, cruises: records(250, (index) => ({ id: `resume-${index}`, value: index })) },
      resume: checkpoint,
    });
    assert.equal(resumed.envelope.records.length, 251);

    const smallRaw = backup.serializeBackupArchive([resumed.envelope]);
    assert.throws(() => backup.parseBackupArchive(smallRaw.slice(0, -17)), /TRUNCATED_OR_INVALID_EASYSEAS_BACKUP/);
    const malformed = JSON.parse(smallRaw);
    malformed.chain[0].manifest.recordCount += 1;
    assert.throws(() => backup.parseBackupArchive(JSON.stringify(malformed)), /EASYSEAS_BACKUP_RECORD_COUNT_MISMATCH/);
    const damaged = JSON.parse(smallRaw);
    const encrypted = JSON.parse(damaged.chain[0].records[0].encryptedChunk);
    encrypted.body = `${encrypted.body.slice(0, -4)}AAAA`;
    damaged.chain[0].records[0].encryptedChunk = JSON.stringify(encrypted);
    const damagedArchive = backup.parseBackupArchive(JSON.stringify(damaged));
    await assert.rejects(() => backup.decryptBackupArchive(damagedArchive, resumed.recoveryKey, 'recovery-key'), /BACKUP_CREDENTIAL_INVALID_OR_DATA_DAMAGED/);

    const trustSource = fs.readFileSync(path.join(root, 'app/data-trust-center.tsx'), 'utf8');
    for (const contract of ['getFreeDiskStorageAsync', 'assertBackupStorageCapacity', 'BACKUP_OWNER_MISMATCH', 'compareRestoreReadback', 'rollbackBundle', 'The pre-restore data checkpoint was restored']) assert.match(trustSource, new RegExp(contract));
    console.log(`PASS Build 444 147 MiB backup: ${expectedRecords} records, ${readback.actualTotal} exact readback, ${progressEvents} progress events, ${eventLoopTicks} UI yields, ${elapsedMs}ms encryption; low-space, cancel/resume, preview, rollback contract, corruption, and truncation verified`);
  })().catch((error) => { console.error(error); process.exitCode = 1; });
} finally {
  Module._load = originalLoad;
}
