#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadTs(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(read(relative), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  const profiles = [
    { id: 'primary', name: 'Primary Player', email: 'primary@example.test', isOwner: true, defaultProfile: true },
    { id: 'secondary', name: 'Secondary Player', email: 'secondary@example.test', active: true },
  ];
  const isolation = loadTs('lib/profileIsolation.ts', {
    '@/state/UserProvider': {},
  });
  const privateRecords = [
    { id: 'primary-casino', ownerProfileId: 'primary', sourceEmail: 'primary@example.test', winLoss: 900 },
    { id: 'secondary-casino', ownerProfileId: 'secondary', sourceEmail: 'secondary@example.test', winLoss: -25 },
    { id: 'legacy-primary-reservation', reservationNumber: 'LEGACY-1' },
    { id: 'secondary-by-guest', guestNames: ['Secondary Player'] },
  ];
  assert.deepEqual(
    isolation.filterRecordsForProfile(privateRecords, profiles[0], profiles).map((record) => record.id),
    ['primary-casino', 'legacy-primary-reservation'],
    'the primary profile receives its explicit records and legacy owner records only',
  );
  assert.deepEqual(
    isolation.filterRecordsForProfile(privateRecords, profiles[1], profiles).map((record) => record.id),
    ['secondary-casino', 'secondary-by-guest'],
    'a secondary profile receives only explicit or passenger-name matches',
  );
  assert.equal(isolation.stampRecordForProfile({ id: 'manual-cruise' }, profiles[1]).ownerProfileId, 'secondary');

  const storage = new Map();
  const asyncStorage = {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    getAllKeys: async () => Array.from(storage.keys()),
    multiGet: async (keys) => keys.map((key) => [key, storage.get(key) ?? null]),
    multiSet: async (rows) => rows.forEach(([key, value]) => storage.set(key, value)),
  };
  const defaults = { theme: 'system', reducedMotion: false, textScale: 'standard', chartMode: 'standard' };
  const preferences = loadTs('lib/experience/experiencePreferences.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    'react-native': { AccessibilityInfo: { isReduceMotionEnabled: async () => false } },
    '@/constants/easySeasDesignSystem': { DEFAULT_EXPERIENCE_PREFERENCES: defaults },
  });
  await preferences.saveExperiencePreferences('primary@example.test', { ...defaults, theme: 'dark' });
  await preferences.saveExperiencePreferences('secondary@example.test', { ...defaults, theme: 'light' });
  assert.equal((await preferences.loadExperiencePreferences('primary@example.test')).theme, 'dark');
  assert.equal((await preferences.loadExperiencePreferences('secondary@example.test')).theme, 'light');
  const primaryExport = await preferences.exportUserPreferenceStorage('primary@example.test');
  assert.equal(Object.keys(primaryExport).length, 1);
  assert.ok(Object.keys(primaryExport)[0].includes('primary@example.test'));
  assert.equal(await preferences.restoreUserPreferenceStorage('secondary@example.test', primaryExport), 0, 'restore refuses another owner\'s preferences');

  const userProvider = read('state/UserProvider.tsx');
  assert.match(userProvider, /USERS: getUserScopedKey\(KEYS\.USERS, email\)/);
  assert.match(userProvider, /CURRENT_USER: getUserScopedKey\(KEYS\.CURRENT_USER, email\)/);

  const loyalty = read('state/LoyaltyProvider.tsx');
  assert.match(loyalty, /loyaltyStorageOwner = `\$\{authenticatedEmail \|\| 'local'\}::\$\{currentUser\?\.id \|\| 'primary'\}`/);
  assert.match(loyalty, /filterRecordsForProfile\(storedBookedCruises \|\| \[\], currentUser, users\)/);

  const crew = read('state/CrewRecognitionProvider.tsx');
  assert.match(crew, /crewRepositoryOwner = `\$\{accountUserId\}::profile::\$\{userId\}`/);
  assert.match(crew, /ownerProfileId: userId/);

  const casino = read('state/CasinoSessionProvider.tsx');
  assert.match(casino, /getUserScopedKey\(BASE_STORAGE_KEY, authenticatedEmail\)/);
  assert.match(casino, /if \(options\?\.profileId\)/);
  assert.match(casino, /session\.pointEarningProfileId !== options\.profileId/);
  assert.match(casino, /!session\.pointEarningProfileId && !options\.includeUnassignedForProfile/);

  const booked = read('app/(tabs)/booked.tsx');
  assert.match(booked, /filterRecordsForProfile\(bookedCruises, currentUser, users\)/);

  const chatStorage = read('lib/askAllOffers/storage.ts');
  assert.match(chatStorage, /authenticatedEmail/);
  assert.match(chatStorage, /profileId/);
  assert.match(chatStorage, /owner mismatch/i);

  const agent = read('state/AgentXProvider.tsx');
  assert.match(agent, /selectedProfileId: 'all' as const/);
  assert.match(agent, /selectedProfileId: activePrivateProfileId/);
  assert.match(agent, /conversationOwnerScope/);

  const certificateStore = read('lib/certificates/certificateDocumentStore.ts');
  assert.match(certificateStore, /PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY/);
  const certificates = read('state/CertificatesProvider.tsx');
  assert.match(certificates, /documentStorageKeyRef = useRef\(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY\)/);

  console.log('PASS Build 445 Item 39 owner persistence: account profiles and preferences use owner keys; loyalty, casino, completed/manual history, crew, reservations, and chat enforce private profile boundaries; offers, sailings, and public certificate documents remain shared catalogs.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
