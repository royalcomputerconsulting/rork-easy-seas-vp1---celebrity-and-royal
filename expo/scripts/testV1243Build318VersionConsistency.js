const fs = require('fs');
const path = require('path');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));

assert(app.expo.version === '12.4.4', 'Expo marketing version must be 12.4.4');
assert(app.expo.ios.buildNumber === '319', 'iOS build number must be 319');
assert(app.expo.android.versionCode === 120410, 'Android versionCode must be 120410');
assert(pkg.version === '12.4.4', 'package.json version must be 12.4.4');

const config = read('app.config.js');
assert(config.includes("APP_STORE_VERSION = '12.4.4'"), 'Dynamic config marketing version is stale');
assert(config.includes("IOS_BUILD_NUMBER = '319'"), 'Dynamic config iOS build is stale');
assert(config.includes('ANDROID_VERSION_CODE = 120410'), 'Dynamic config Android code is stale');

const plugin = read('plugins/withForcedIOSVersion.js');
assert(plugin.includes("APP_STORE_VERSION = '12.4.4'"), 'Native plugin marketing version is stale');
assert(plugin.includes("IOS_BUILD_NUMBER = '319'"), 'Native plugin build number is stale');
assert(plugin.includes('MARKETING_VERSION'), 'Native plugin must write Xcode marketing version');
assert(plugin.includes('CURRENT_PROJECT_VERSION'), 'Native plugin must write Xcode build number');

const runtime = read('lib/appVersion.ts');
assert(runtime.includes("EASYSEAS_APP_VERSION = '12.4.4'"), 'Runtime app version is stale');
assert(runtime.includes("EASYSEAS_IOS_BUILD_NUMBER = '319'"), 'Runtime iOS build is stale');
assert(runtime.includes('EASYSEAS_ANDROID_VERSION_CODE = 120410'), 'Runtime Android code is stale');

const settings = read('app/(tabs)/settings.tsx');
assert(settings.includes('EASYSEAS_DIAGNOSTIC_VERSION'), 'Diagnostic export must use shared release identity');
assert(!settings.includes("version: '9.10.89'"), 'Stale diagnostic version remains');

const manual = read('components/UserManualModal.tsx');
assert(manual.includes('EASYSEAS_APP_VERSION') && manual.includes('EASYSEAS_IOS_BUILD_NUMBER'), 'User manual must use shared release identity');
assert(!manual.includes('App Version 1.0.0'), 'Stale user manual version remains');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(provider.includes('v12.4.4-build319-carnival-integrity active'), 'Current Carnival integrity marker is stale');
assert(provider.includes('v12.4.4-build319-carnival-priority1-8 active'), 'Current Carnival feature marker is stale');
assert(provider.includes('Carnival safe sync engine v12.4.4 build 319 started'), 'Current Carnival run log version is stale');

const extension = read('assets/easy-seas-extension/carnival-sync.js');
const extensionSource = read('lib/chromeExtension.ts');
assert(extension.includes("version: '12.4.4-deprecated'"), 'Packaged deprecated extension version is stale');
assert(extensionSource.includes("version: '12.4.4-deprecated'"), 'Generated deprecated extension version is stale');

console.log('PASS testV1243Build318VersionConsistency');
