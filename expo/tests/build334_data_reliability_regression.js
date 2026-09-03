const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

const app = json('app.json').expo;
const pkg = json('package.json');
assert.equal(app.version, '13.0.45');
assert.equal(String(app.ios.buildNumber), '411');
assert.equal(app.android.versionCode, 130068);
assert.equal(pkg.version, '13.0.45');
assert.match(pkg.scripts['verify:source-release'], /verifyBuild337Startup\.js/);
assert.match(pkg.scripts['verify:source-release'], /build356_performance_certificate_carnival_regression\.js/);

const core = read('state/CoreDataProvider.tsx');
const loadStart = core.indexOf('const loadFromStorage = useCallback');
const loadEnd = core.indexOf('useEffect(() => {\n    loadFromStorageRef.current', loadStart);
const localLoad = core.slice(loadStart, loadEnd);
assert.ok(loadStart >= 0 && loadEnd > loadStart, 'Core local load implementation must be locatable');
assert.doesNotMatch(localLoad, /await\s+loadFromBackend\s*\(/, 'startup local load must not wait for backend restore');
assert.match(localLoad, /determineUserStatus\(snapshot, true, false\)/, 'local storage must be the startup authority');
assert.doesNotMatch(core, /TIMEOUT: isLoading forced to FALSE/, 'fake hydration watchdog must remain removed');
assert.match(core, /Foregrounding does not trigger a full reload or any backend work/);
assert.match(core, /postHydrationWrites/);
assert.match(core, /InteractionManager\.runAfterInteractions/);
assert.match(core, /Deferred post-hydration persistence complete/);
assert.match(core, /Account switch detected - preserving all scoped local data/);
assert.doesNotMatch(core, /AsyncStorage\.clear\s*\(/);

const sync = read('state/UserDataSyncProvider.tsx');
assert.match(sync, /automatic backend restore is disabled/i);
assert.match(sync, /Local device storage is the startup authority/);
assert.doesNotMatch(sync, /void\s+initSync\s*\(/);
assert.doesNotMatch(sync, /AsyncStorage\.clear\s*\(/);

const auth = read('state/AuthProvider.tsx');
assert.match(auth, /Loaded local auth state without waiting for the network/);
assert.match(auth, /multiRemove/);
assert.doesNotMatch(auth, /AsyncStorage\.clear\s*\(/, 'logout must preserve local user data');

const recovery = read('lib/storage/storageRecovery.ts');
assert.match(recovery, /STORAGE_OPERATION_TIMEOUT_MS = 1500/);
assert.match(recovery, /non-destructive healthcheck/);
assert.doesNotMatch(recovery, /AsyncStorage\.clear\s*\(/);
assert.doesNotMatch(recovery, /multiRemove\s*\(/);

const layout = read('app/_layout.tsx');
assert.doesNotMatch(layout, /clearAllAppData/);
assert.match(layout, /Missing launch metadata must never erase recognized local data/);
assert.match(layout, /function AuthenticatedFeatureGate/);
assert.match(layout, /Main navigation rendered immediately/);
assert.match(layout, /hydrating in the background/);
assert.match(layout, /<AuthenticatedAppContent \/>/);
assert.doesNotMatch(layout, /setStartupStage/);
assert.doesNotMatch(layout, /Loading local feature data/);
assert.doesNotMatch(layout, /Loading local casino data/);
assert.doesNotMatch(layout, /Finishing local setup/);
assert.doesNotMatch(layout, /this iPhone/);
assert.match(layout, /<AuthenticatedFeatureGate \/>/);

const slotLibrary = read('state/SlotMachineLibraryProvider.tsx');
assert.match(slotLibrary, /Shared-library cloud backfill is intentionally manual/);
assert.doesNotMatch(slotLibrary, /void saveSharedMachineJSON\(encyclopedia, 'import'\)/);

const crew = read('state/CrewRecognitionProvider.tsx');
assert.match(crew, /cloudRefreshEnabled/);
assert.match(crew, /enabled:\s*cloudRefreshEnabled/);
assert.match(crew, /quotaSafeGetJsonItem/);

const quota = read('lib/storage/quotaSafeStorage.ts');
for (const marker of [
  'FILE_POINTER_PREFIX',
  'easyseas-data-v1',
  'LAST_GOOD_SUFFIX',
  'CORRUPT_SUFFIX',
  'scheduleNativeMigration',
  'stringifyJsonCooperatively',
  'writeNativeValue',
  'readNativeLastGood',
]) assert.ok(quota.includes(marker), `quota-safe storage missing ${marker}`);
assert.match(quota, /expo-file-system\/legacy/);

const loaders = read('state/coreData/storageLoaders.ts');
assert.match(loaders, /export function parseJsonArray/);
assert.match(loaders, /Isolated invalid/);

for (const provider of [
  'state/CertificatesProvider.tsx',
  'state/SlotMachineLibraryProvider.tsx',
  'state/CasinoSessionProvider.tsx',
  'state/SailingWeatherProvider.tsx',
  'state/LoyaltyProvider.tsx',
  'state/PriceHistoryProvider.tsx',
]) {
  const source = read(provider);
  assert.match(source, /quotaSafe(Get|Set)/, `${provider} must use quota-safe storage for its durable data`);
}

console.log('PASS build334_data_reliability_regression — startup is local-first, storage recovery is non-destructive, navigation is fail-open while providers hydrate, and bulky datasets use resilient native storage');
