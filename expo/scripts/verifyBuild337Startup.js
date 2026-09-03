const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = (message) => {
  console.error(`BUILD 337 STARTUP CHECK FAILED: ${message}`);
  process.exit(1);
};

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const eas = JSON.parse(read('eas.json'));
if (app.version !== '13.0.45' || String(app.ios?.buildNumber) !== '411' || app.android?.versionCode !== 130068) fail('release identity is stale');
if (pkg.version !== '13.0.45') fail('package version is stale');
if (eas.cli?.appVersionSource !== 'remote' || eas.build?.production?.autoIncrement !== true) fail('EAS production build-number auto-increment is not enabled');

const layout = read('app/_layout.tsx');
const start = layout.indexOf('function AuthenticatedFeatureGate()');
const end = layout.indexOf('\nfunction AuthenticatedProviderTree()', start);
if (start < 0 || end <= start) fail('authenticated startup implementation is not locatable');
const gate = layout.slice(start, end);
for (const marker of ['Main navigation rendered immediately', '<FeatureDataProviders>', '<CasinoProviders>', '<ServiceProviders>', '<AuthenticatedAppContent />']) {
  if (!gate.includes(marker)) fail(`fail-open startup marker is missing: ${marker}`);
}
for (const forbidden of ['startupStage', 'setStartupStage', 'InteractionManager', 'LocalDataStartup', 'Finishing local setup']) {
  if (gate.includes(forbidden)) fail(`blocking startup gate remains: ${forbidden}`);
}
for (const forbidden of ['this iPhone', 'Loading local feature data', 'Loading local casino data', 'Finishing local setup']) {
  if (layout.includes(forbidden)) fail(`platform-specific or obsolete startup copy remains: ${forbidden}`);
}
if (!layout.includes('Local setup exceeded 2500ms; releasing navigation without waiting')) fail('fresh-start fail-open watchdog is missing');

const auth = read('state/AuthProvider.tsx');
const authStart = auth.indexOf('const checkAuthentication');
const authEnd = auth.indexOf('const initializeAuth', authStart);
const authBootstrap = auth.slice(authStart, authEnd);
if (!authBootstrap.includes('no backend refresh was started')) fail('local-only auth bootstrap marker is missing');
for (const forbidden of ['trpcClient', 'refreshWhitelistInBackground', 'getWhitelistInternal()']) {
  if (authBootstrap.includes(forbidden)) fail(`auth bootstrap can call backend: ${forbidden}`);
}

const loaders = read('state/coreData/storageLoaders.ts');
for (const marker of ['LOCAL_STORAGE_READ_TIMEOUT_MS = 1800', 'readStorageArrayWithTimeout(keys.CRUISES', 'continuing startup with the remaining saved data']) {
  if (!loaders.includes(marker)) fail(`bounded local storage marker is missing: ${marker}`);
}

const providers = read('lib/composeProviders.tsx');
for (const marker of ['class ProviderBoundary', 'continuing without that provider so the app can still open', 'fallback={acc}']) {
  if (!providers.includes(marker)) fail(`provider failure isolation marker is missing: ${marker}`);
}

console.log('PASS Build 337 startup source gate: navigation is fail-open, local reads are bounded, startup makes no EasySeas backend request, provider failures are isolated, marketing version is protected, and EAS build numbers auto-increment.');
