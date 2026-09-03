#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const rows = new Map();
const key = (owner, domain) => `${owner}|${domain}`;
const db = {
  countDomainRecords: async (owner, domain) => (rows.get(key(owner, domain)) || []).length,
  countDomainRecordsFiltered: async (owner, domain, search) => {
    const source = rows.get(key(owner, domain)) || [];
    if (!search) return source.length;
    const needle = search.toLowerCase();
    return source.filter((row) => row.recordJson.toLowerCase().includes(needle)).length;
  },
  listAllDomainRecords: async (owner, domain) => (rows.get(key(owner, domain)) || []).map((row) => JSON.parse(row.recordJson)),
  listAllDomainRecordsByOwnerPrefix: async (prefix, domain) => Array.from(rows.entries())
    .filter(([entryKey]) => entryKey.startsWith(prefix) && entryKey.endsWith(`|${domain}`))
    .flatMap(([, source]) => source.map((row) => JSON.parse(row.recordJson))),
  listDomainRecordsFiltered: async (owner, domain, options) => {
    const needle = options.search?.toLowerCase();
    return (rows.get(key(owner, domain)) || [])
      .filter((row) => !needle || row.recordJson.toLowerCase().includes(needle))
      .slice(options.offset, options.offset + options.limit)
      .map((row) => JSON.parse(row.recordJson));
  },
  replaceDomainRecords: async (owner, domain, nextRows) => rows.set(key(owner, domain), nextRows),
  upsertDomainRecords: async (nextRows) => {
    for (const row of nextRows) {
      const collection = rows.get(key(row.ownerId, row.domain)) || [];
      rows.set(key(row.ownerId, row.domain), [...collection.filter((item) => item.recordId !== row.recordId), row]);
    }
  },
};

const definitions = [
  { domain: 'booked_cruises', storageKey: 'booked' },
  { domain: 'casino_offers', storageKey: 'offers' },
  { domain: 'calendar_events', storageKey: 'events' },
  { domain: 'casino_sessions', storageKey: 'sessions' },
  { domain: 'certificates', storageKey: 'certificates' },
  { domain: 'crew_recognition', storageKey: 'crew' },
  { domain: 'crew_sailings', storageKey: 'crew-sailings' },
  { domain: 'machine_encyclopedia', storageKey: 'machines', legacyGlobal: true },
  { domain: 'slot_atlas', storageKey: 'atlas' },
];
const migration = {
  HIGH_VOLUME_DOMAINS: definitions,
  highVolumeRecordId: (record, index) => String(record?.id ?? `row-${index}`),
  hashText: (value) => String(value.length),
  migrateHighVolumeDomain: async () => ({ migrated: 0, skipped: true }),
};

const storage = new Map();
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === './HealthTrustDatabase') return db;
  if (request === './highVolumeMigration') return migration;
  if (request === 'react-native') return { Platform: { OS: 'ios' } };
  if (request === '@react-native-async-storage/async-storage') return { default: { getAllKeys: async () => Array.from(storage.keys()) } };
  if (request === '@/lib/storage/storageKeys') return { getUserScopedKey: (base, owner) => `${base}::${owner}` };
  if (request === '@/lib/storage/quotaSafeStorage') return {
    quotaSafeGetItem: async (storageKey) => storage.get(storageKey) ?? null,
    quotaSafeSetJsonItem: async (storageKey, value) => storage.set(storageKey, JSON.stringify(value)),
  };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const file = path.join(root, 'lib/database/highVolumeRepository.ts');
  const js = ts.transpileModule(read('lib/database/highVolumeRepository.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  const repository = mod.exports;

  (async () => {
    await repository.replaceHighVolumeDomain('primary@example.com', 'crew_recognition', [
      { id: 'crew-a', fullName: 'Alice Able' },
      { id: 'crew-b', fullName: 'Bob Baker' },
      { id: 'crew-c', fullName: 'Cara Cook' },
    ]);
    await repository.replaceHighVolumeDomain('second@example.com', 'crew_recognition', [
      { id: 'crew-z', fullName: 'Zed Zero' },
    ]);
    assert.deepEqual(
      (await repository.listHighVolumeDomain('primary@example.com', 'crew_recognition')).map((row) => row.id),
      ['crew-a', 'crew-b', 'crew-c'],
      'a second signed-in account must never share a private crew repository partition',
    );
    assert.deepEqual(
      (await repository.listHighVolumeDomain('second@example.com', 'crew_recognition')).map((row) => row.id),
      ['crew-z'],
    );

    await repository.replaceHighVolumeDomain('primary@example.com', 'casino_offers', [{ id: 'offer-primary' }]);
    await repository.replaceHighVolumeDomain('second@example.com', 'casino_offers', [{ id: 'offer-second' }]);
    assert.deepEqual((await repository.listHighVolumeDomain('primary@example.com', 'casino_offers')).map((row) => row.id), ['offer-primary']);
    assert.deepEqual((await repository.listHighVolumeDomain('second@example.com', 'casino_offers')).map((row) => row.id), ['offer-second']);

    const page = await repository.listHighVolumeDomainPage('primary@example.com', 'crew_recognition', { limit: 1, offset: 0, search: 'a' });
    assert.equal(page.rows.length, 1);
    assert.equal(page.total, 3);
    assert.equal(page.hasMore, true);
    const secondPage = await repository.listHighVolumeDomainPage('primary@example.com', 'crew_recognition', { limit: 2, offset: 1, search: 'a' });
    assert.equal(secondPage.rows.length, 2);
    assert.equal(secondPage.hasMore, false);

    const accountOwner = 'primary@example.com::profile::';
    await repository.replaceHighVolumeDomain(`${accountOwner}owner`, 'crew_recognition', [{ id: 'owner-row' }]);
    await repository.replaceHighVolumeDomain(`${accountOwner}guest`, 'crew_recognition', [{ id: 'guest-row' }]);
    const allProfiles = await repository.listHighVolumeDomainByOwnerPrefix(accountOwner, 'crew_recognition');
    assert.deepEqual(new Set(allProfiles.map((row) => row.id)), new Set(['owner-row', 'guest-row']));

    for (const provider of [
      'state/CoreDataProvider.tsx',
      'state/CertificatesProvider.tsx',
      'state/CasinoSessionProvider.tsx',
      'state/CrewRecognitionProvider.tsx',
      'state/SlotMachineLibraryProvider.tsx',
    ]) {
      assert.match(read(provider), /HighVolumeDomain/, `${provider} must use the indexed repository`);
    }
    assert.match(read('state/CoreDataProvider.tsx'), /includeHighVolumeCore: false/);
    assert.match(read('state/CrewRecognitionProvider.tsx'), /intentionally loaded only when/);
    assert.match(read('state/CertificatesProvider.tsx'), /hydrateHighVolumeDomain<Certificate>/);
    assert.match(read('lib/dataBundle/bundleOperations.ts'), /listHighVolumeDomainByOwnerPrefix/);
    assert.match(read('lib/dataBundle/bundleOperations.ts'), /replaceHighVolumeDomain/);
    console.log('Build 439 high-volume repository, pagination, account isolation, and provider-cutover regression passed');
  })().catch((error) => { console.error(error); process.exitCode = 1; });
} finally {
  Module._load = originalLoad;
}
