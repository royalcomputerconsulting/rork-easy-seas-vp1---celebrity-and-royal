const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = (message) => {
  console.error(`BUILD 334 DATA RELIABILITY CHECK FAILED: ${message}`);
  process.exit(1);
};

const status = JSON.parse(read('PHASE3_RELEASE_GATE_STATUS.json'));
if (status.release?.version !== '12.4.19') fail('release gate version is not 12.4.19');
if (String(status.release?.iosBuild) !== '339') fail('release gate iOS build is not 334');
if (status.release?.androidVersionCode !== 120425) fail('release gate Android version code is not 120425');
if (status.productionSubmissionAllowed !== false) fail('production submission must remain blocked before physical-device evidence');
if (status.testFlightValidation?.status !== 'pending-physical-device') fail('physical-device gate is not pending');

const core = read('state/CoreDataProvider.tsx');
const loadStart = core.indexOf('const loadFromStorage = useCallback');
const loadEnd = core.indexOf('useEffect(() => {\n    loadFromStorageRef.current', loadStart);
if (loadStart < 0 || loadEnd <= loadStart) fail('local core hydration implementation is not locatable');
const localLoad = core.slice(loadStart, loadEnd);
if (/await\s+loadFromBackend\s*\(/.test(localLoad)) fail('startup core hydration still waits on backend restore');
for (const marker of [
  'determineUserStatus(snapshot, true, false)',
  'Preserving the current in-memory data after load failure',
  'Foregrounding does not trigger a full reload or any backend work',
  'preserving all scoped local data',
  'Deferred post-hydration persistence complete',
  'InteractionManager.runAfterInteractions',
]) if (!core.includes(marker)) fail(`CoreData local-first marker missing: ${marker}`);
if (core.includes('TIMEOUT: isLoading forced to FALSE')) fail('obsolete fake hydration watchdog remains');

const quota = read('lib/storage/quotaSafeStorage.ts');
for (const marker of [
  "import * as FileSystem from 'expo-file-system/legacy'",
  'FILE_POINTER_PREFIX',
  'LAST_GOOD_SUFFIX',
  'scheduleNativeMigration',
  'stringifyJsonCooperatively',
  'readNativeLastGood',
]) if (!quota.includes(marker)) fail(`resilient storage marker missing: ${marker}`);

const recovery = read('lib/storage/storageRecovery.ts');
if (!recovery.includes('STORAGE_OPERATION_TIMEOUT_MS = 1500')) fail('nonblocking storage health timeout is missing');
if (!recovery.includes('never enumerates/removes user data')) fail('non-destructive storage recovery contract is missing');
for (const forbidden of ['AsyncStorage.clear(', 'multiRemove(']) if (recovery.includes(forbidden)) fail(`destructive storage recovery marker remains: ${forbidden}`);

const auth = read('state/AuthProvider.tsx');
if (!auth.includes('Loaded local auth state without waiting for the network')) fail('local auth startup marker is missing');
if (auth.includes('AsyncStorage.clear(')) fail('logout still erases all local data');

const layout = read('app/_layout.tsx');
for (const marker of ['AuthenticatedFeatureGate', 'Main navigation rendered immediately', 'hydrating in the background', '<AuthenticatedAppContent />']) {
  if (!layout.includes(marker)) fail(`fail-open startup marker missing: ${marker}`);
}
for (const forbidden of ['startupStage', 'Loading local feature data', 'Loading local casino data', 'Finishing local setup', 'this iPhone']) {
  if (layout.includes(forbidden)) fail(`obsolete blocking/platform-specific startup marker remains: ${forbidden}`);
}
if (layout.includes('clearAllAppData')) fail('fresh-start handling still contains destructive reset code');

const slotLibrary = read('state/SlotMachineLibraryProvider.tsx');
if (!slotLibrary.includes('Shared-library cloud backfill is intentionally manual')) fail('slot-machine library still auto-uploads its full local dataset at startup');
if (slotLibrary.includes("void saveSharedMachineJSON(encyclopedia, 'import')")) fail('automatic slot-machine cloud backfill remains');

const crew = read('state/CrewRecognitionProvider.tsx');
if (!crew.includes('enabled: cloudRefreshEnabled')) fail('Crew Recognition still performs automatic startup backend queries');

const sync = read('state/UserDataSyncProvider.tsx');
for (const marker of ['Local device storage is the startup authority', 'automatic backend restore is disabled']) {
  if (!sync.includes(marker)) fail(`optional cloud-sync marker missing: ${marker}`);
}
if (sync.includes('void initSync()')) fail('automatic startup cloud restore remains');

const template = JSON.parse(read('native-validation-evidence.template.json'));
if (template.release?.version !== '12.4.19' || String(template.release?.iosBuild) !== '339') fail('native evidence template release identity is stale');
for (const check of [
  'startupUsesExistingLocalData',
  'startupNoAutomaticBackendRequest',
  'startupCorruptCollectionIsolation',
  'logoutPreservesLocalData',
  'accountSwitchPreservesScopedData',
  'largeLocalDatasetRestartReadback',
]) if (template.ios?.[check] !== false) fail(`native evidence must begin false: ${check}`);

console.log('PASS Build 334 data reliability source gate: local data is authoritative, cloud work is optional, startup is fail-open, and persistent data recovery is non-destructive.');
