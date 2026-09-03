const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
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

(async () => {
  const app = JSON.parse(read('app.json')).expo;
  const pkg = JSON.parse(read('package.json'));
  assert.equal(app.version, '13.0.44');
  assert.equal(String(app.ios.buildNumber), '410');
  assert.equal(app.android.versionCode, 130067);
  assert.equal(pkg.version, '13.0.44');
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.production.autoIncrement, true);

  const layout = read('app/_layout.tsx');
  const gateStart = layout.indexOf('function AuthenticatedFeatureGate()');
  const gateEnd = layout.indexOf('\nfunction AuthenticatedProviderTree()', gateStart);
  assert.ok(gateStart >= 0 && gateEnd > gateStart, 'authenticated startup gate must be locatable');
  const gate = layout.slice(gateStart, gateEnd);
  assert.match(gate, /Main navigation rendered immediately/);
  assert.match(gate, /<FeatureDataProviders>/);
  assert.match(gate, /<CasinoProviders>/);
  assert.match(gate, /<ServiceProviders>/);
  assert.match(gate, /<AuthenticatedAppContent \/>/);
  assert.doesNotMatch(gate, /startupStage|setStartupStage|InteractionManager|LocalDataStartup|if \(isLoading\).*return/s);
  assert.doesNotMatch(layout, /Finishing local setup|Loading local feature data|Loading local casino data|this iPhone/);
  assert.match(layout, /Loading saved EasySeas data from this device/);
  assert.match(layout, /Local setup exceeded 2500ms; releasing navigation without waiting/);
  assert.match(layout, /freshStartReleased/);
  assert.match(layout, /releaseFreshStart/);

  const providerComposition = read('lib/composeProviders.tsx');
  assert.match(providerComposition, /class ProviderBoundary/);
  assert.match(providerComposition, /continuing without that provider so the app can still open/);
  assert.match(providerComposition, /fallback=\{acc\}/);

  const auth = read('state/AuthProvider.tsx');
  const authStart = auth.indexOf('const checkAuthentication');
  const authEnd = auth.indexOf('const initializeAuth', authStart);
  const authBootstrap = auth.slice(authStart, authEnd);
  assert.match(authBootstrap, /no backend refresh was started/);
  assert.doesNotMatch(authBootstrap, /trpcClient|refreshWhitelistInBackground|getWhitelistInternal\(\)/);
  assert.match(auth, /Device-protected login completed from local state/);

  const sync = read('state/UserDataSyncProvider.tsx');
  assert.match(sync, /automatic backend restore is disabled/);
  assert.doesNotMatch(sync, /void initSync\(\)/);

  const core = read('state/CoreDataProvider.tsx');
  const loadStart = core.indexOf('const loadFromStorage = useCallback');
  const loadEnd = core.indexOf('useEffect(() => {\n    loadFromStorageRef.current', loadStart);
  const localLoad = core.slice(loadStart, loadEnd);
  assert.doesNotMatch(localLoad, /await\s+loadFromBackend\s*\(/);
  assert.match(localLoad, /readAllStorageKeys/);

  const loadersSource = read('state/coreData/storageLoaders.ts');
  assert.match(loadersSource, /LOCAL_STORAGE_READ_TIMEOUT_MS = 1800/);
  assert.match(loadersSource, /readStorageArrayWithTimeout\(keys\.CRUISES/);
  assert.match(loadersSource, /quotaSafeGetJsonItemWithRaw/);
  assert.match(loadersSource, /continuing startup with the remaining saved data/);

  const never = new Promise(() => {});
  const loaders = compileTs('state/coreData/storageLoaders.ts', {
    '@/types/models': { SAMPLE_CLUB_ROYALE_PROFILE: {} },
    '@/lib/lifecycleManager': { updateAllCruiseLifecycles: (items) => ({ updatedCruises: items, report: { upcomingCount: 0, inProgressCount: 0, completedCount: 0, updates: [] } }) },
    '@/lib/cruiseOverlapGuards': {
      applyKnownBookingCorrectionsToCruise: (item) => item,
      applyUserConfirmedBookedCruiseManifest: (items) => items,
      isKnownInvalidBookedCruise: () => false,
    },
    './storageConfig': {
      STORAGE_KEYS: {}, DEFAULT_SETTINGS: {}, getScopedStorageKeys: () => ({
        CRUISES: 'cruises', BOOKED_CRUISES: 'booked', CASINO_OFFERS: 'offers', CALENDAR_EVENTS: 'events',
        LAST_SYNC: 'last', SETTINGS: 'settings', USER_POINTS: 'points', CLUB_PROFILE: 'profile', HAS_IMPORTED_DATA: 'imported',
      }),
    },
    '@/lib/storage/quotaSafeStorage': { quotaSafeGetItem: () => never },
    '@/lib/storage/dataOwnership': { containsKnownForeignPersonalData: () => false },
    '@/lib/dataIdentity': { dedupeBookedCruises: (items) => items, dedupeCalendarEvents: (items) => items },
    '@/lib/dataAuthority': { canonicalizeDataRecords: (items) => items },
    '@/lib/calendar/cruiseEvents': { generateCruiseCalendarEvents: () => [] },
  });

  const started = Date.now();
  const value = await loaders.readStorageValueWithTimeout('hung-key', 'hung fixture', 25);
  const elapsed = Date.now() - started;
  assert.equal(value, null);
  assert.ok(elapsed >= 15 && elapsed < 250, `hung storage read should fail open quickly, elapsed=${elapsed}ms`);

  console.log('PASS build337_startup_fail_open_regression — navigation is never gated by provider hydration, startup performs no backend refresh, device wording is cross-platform, and hung storage reads time out safely');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
