const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

const layout = read('app/_layout.tsx');
assert.match(layout, /const \{ lastRestoreTime \} = useUserDataSync\(\)/);
assert.doesNotMatch(layout, /cloudRestoreScreen/);
assert.doesNotMatch(layout, /Restoring your data/);
assert.doesNotMatch(layout, /forceSkipRestore/);
assert.doesNotMatch(layout, /initialCheckComplete/);
assert.match(layout, /<VoyageNotificationObserver \/>/);
assert.match(layout, /<RootLayoutNav \/>/);
assert.ok(layout.indexOf('<VoyageNotificationObserver />') < layout.indexOf('<RootLayoutNav />'), 'notification observer must remain additive and must not replace or gate the Build 339 navigator');

const syncProvider = read('state/UserDataSyncProvider.tsx');
assert.match(syncProvider, /useState\(true\)/);
assert.match(syncProvider, /Local device storage is the startup authority/);
assert.match(syncProvider, /automatic backend restore is disabled/);
assert.doesNotMatch(syncProvider, /New user login detected, checking backend/);
assert.doesNotMatch(syncProvider, /Initial cloud restore/);
assert.doesNotMatch(syncProvider, /Running post-initialization cloud sync/);
assert.doesNotMatch(syncProvider, /void initSync\(\)/);
assert.match(syncProvider, /const forceSyncNow = useCallback/);
assert.match(syncProvider, /const loadFromCloud = useCallback/);

const auth = read('state/AuthProvider.tsx');
const checkAuthenticationBody = auth.slice(auth.indexOf('const checkAuthentication'), auth.indexOf('const initializeAuth'));
assert.doesNotMatch(checkAuthenticationBody, /trpcClient\.access\.getWhitelist/);
assert.match(auth, /Loaded local auth state without waiting for the network/);

const splash = read('components/WelcomeSplash.tsx');
assert.match(splash, /onAnimationCompleteRef/);
assert.match(splash, /\[fadeAnim, duration\]/);

console.log('PASS build334_local_first_startup_regression — existing local data opens without an automatic backend restore or startup cloud gate');
