const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const carnival = read('app/carnival-sync.tsx');
assert(!carnival.includes('setWebSyncError('), 'Carnival screen must not call an undefined state setter');
assert(carnival.includes('MAX_WEBVIEW_MESSAGE_SIZE'), 'Carnival must retain oversized-message crash protection');
assert(carnival.includes('<ErrorBoundary>'), 'Carnival screen must remain protected by an error boundary');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert(overview.includes("easyseas-scott-astin-logo.jpeg"), 'Offers must use the bundled Easy Seas artwork');
assert(!overview.includes("easy-seas-offers-hero.png"), 'Offers must not reference the missing hero asset');
assert(!/if \(coreLoading\)[\s\S]{0,500}Loading your data/.test(overview), 'Offers must not hard-block indefinitely on hydration');

const core = read('state/CoreDataProvider.tsx');
assert(core.includes('Preserving the current in-memory data after load failure'), 'Core data load failure must preserve last known-good data');
assert(!core.includes('TIMEOUT: isLoading forced to FALSE'), 'Core loading must not publish empty state through a fake watchdog');
assert(core.includes('determineUserStatus(snapshot, true, false)'), 'Core startup must use local storage without cloud availability');

const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert.equal(app.expo.version, '13.0.44');
assert.equal(app.expo.ios.buildNumber, '410');
assert.equal(app.expo.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

for (const asset of [
  app.expo.icon,
  app.expo.splash.image,
  app.expo.android.adaptiveIcon.foregroundImage,
  './assets/images/easyseas-scott-astin-logo.jpeg',
]) {
  assert(fs.existsSync(path.join(root, asset)), `Required bundled asset is missing: ${asset}`);
}

console.log('Build 334 runtime safety regression checks passed.');
