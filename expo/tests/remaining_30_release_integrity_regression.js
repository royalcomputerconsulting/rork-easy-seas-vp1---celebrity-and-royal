const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const runtime = loadStandaloneTs('lib/carnival/runtimeCompatibility.ts');
const storage = new Map();
const support = loadStandaloneTs('lib/carnival/syncSupport.ts', {
  '../storage/quotaSafeStorage': { quotaSafeGetJsonItem: async (_key, fallback) => fallback, quotaSafeSetJsonItem: async () => {}, quotaSafeRemoveItem: async () => {} },
  '@react-native-async-storage/async-storage': {
    default: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async (key) => storage.delete(key),
    },
  },
  '@/lib/storage/storageKeys': {
    ALL_STORAGE_KEYS: { CARNIVAL_SYNC_CHECKPOINT: 'carnival_checkpoint' },
    getUserScopedKey: (key, email) => `${key}:${email ?? 'anonymous'}`,
  },
});
const date = loadStandaloneTs('lib/date.ts');
const cruiseDays = loadStandaloneTs('lib/cruiseDayPipeline.ts', { './date': date });

assert.equal(runtime.assessCarnivalRuntimeCompatibility({
  url: 'https://www.carnival.com/profilemanagement/profiles/cruises',
  loggedIn: true,
  profileSignals: true,
  offerSignals: false,
}).state, 'ready');
assert.equal(runtime.assessCarnivalRuntimeCompatibility({
  url: 'https://www.carnival.com/profilemanagement/profiles/cruises',
  loggedIn: true,
  challengeDetected: true,
}).state, 'challenge_detected');
assert.equal(runtime.assessCarnivalRuntimeCompatibility({
  url: 'https://www.carnival.com/profilemanagement/profiles/cruises',
  loggedIn: true,
  profileSignals: false,
  offerSignals: false,
}).state, 'unsupported_layout');
assert.equal(runtime.assessCarnivalRuntimeCompatibility({
  url: 'https://example.invalid/',
  loggedIn: true,
  profileSignals: true,
}).state, 'invalid_origin');

const ownerFingerprint = support.createCarnivalOwnerFingerprint('profile-a', 'owner@example.com');
const accountFingerprint = support.createCarnivalAccountFingerprint('123456789');
assert.match(ownerFingerprint, /^easyseas-/);
assert.match(accountFingerprint, /^carnival-/);
const checkpoint = support.buildCarnivalCheckpoint({
  syncRunId: 'run-a',
  profileId: 'profile-a',
  accountFingerprint,
  ownerFingerprint,
  createdAt: new Date().toISOString(),
  completedStages: ['offers'],
  pendingStages: ['bookings'],
  collections: support.createCarnivalCollectionEvidence(),
  rateCodes: {},
  offerRows: [],
  bookedCruiseRows: [],
  loyaltyData: {},
});
assert.equal(checkpoint.version, 3);
assert.equal(support.validateCarnivalSyncCheckpoint(checkpoint, 'profile-a', accountFingerprint, ownerFingerprint).valid, true);
assert.equal(support.validateCarnivalSyncCheckpoint(checkpoint, 'profile-a', accountFingerprint, 'easyseas-other').reason, 'owner_mismatch');
assert.equal(support.validateCarnivalSyncCheckpoint(checkpoint, 'profile-a', 'carnival-other', ownerFingerprint).reason, 'account_mismatch');
assert.equal(support.validateCarnivalSyncCheckpoint({
  ...checkpoint,
  updatedAt: new Date(Date.now() - support.CARNIVAL_SYNC_CHECKPOINT_MAX_AGE_MS - 1).toISOString(),
}, 'profile-a', accountFingerprint, ownerFingerprint).reason, 'checkpoint_expired');
assert.equal(support.validateCarnivalSyncCheckpoint({ ...checkpoint, accountFingerprint: '' }, 'profile-a', accountFingerprint, ownerFingerprint).requiresAccountVerification, true);

assert.equal(date.toTimeZoneCalendarDateOnly(new Date('2026-01-01T01:30:00.000Z'), 'America/Los_Angeles'), '2025-12-31');
assert.equal(date.toTimeZoneCalendarDateOnly(new Date('2026-01-01T01:30:00.000Z'), 'Pacific/Kiritimati'), '2026-01-01');
assert.equal(date.toTimeZoneCalendarDateOnly(new Date('invalid'), 'America/Los_Angeles'), undefined);
assert.equal(
  cruiseDays.getCruiseDayForDate(
    { sailDate: '2025-12-31', nights: 2, timeZone: 'America/Los_Angeles' },
    new Date('2026-01-01T01:30:00.000Z'),
  )?.day,
  1,
);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const authDetection = read('lib/royalCaribbean/authDetection.ts');
const documentStore = read('lib/certificates/certificateDocumentStore.ts');
const certificateProvider = read('state/CertificatesProvider.tsx');
const extensionContent = read('assets/easy-seas-extension/content.js');
const extensionPageScript = read('assets/easy-seas-extension/page-script.js');
assert.match(provider, /createCarnivalOwnerFingerprint/);
assert.match(provider, /CARNIVAL_CHECKPOINT_SAVE_FAILED/);
assert.match(provider, /carnival_runtime_probe/);
assert.match(authDetection, /carnivalChallenge/);
assert.match(authDetection, /challengeDetected: carnivalChallenge/);
assert.match(authDetection, /carnival_runtime_probe/);
assert.match(documentStore, /inspectCertificateDocumentStorage/);
assert.match(certificateProvider, /loadCertificateDocumentsWithReport/);
assert.doesNotMatch(extensionContent, /es_auth|es_isLoggedIn|authorization['\"]|appKey/);
assert.doesNotMatch(extensionPageScript, /accessToken|authToken|token:|findAppKey/);
assert.match(extensionContent, /credentials: 'include'/);

console.log('Remaining-ticket lifecycle, compatibility, restart, and timezone regression checks passed');
