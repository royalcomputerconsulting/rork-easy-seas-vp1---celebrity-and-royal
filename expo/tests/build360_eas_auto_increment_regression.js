const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const eas = JSON.parse(read('eas.json'));
const appConfigSource = read('app.config.js');
const nativeVersionPlugin = read('plugins/withForcedIOSVersion.js');

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

// Production builds use Expo's recommended remote source and increment every
// invocation. Marketing version remains intentionally controlled by source.
assert.equal(eas.cli.appVersionSource, 'remote');
assert.equal(eas.build.production.autoIncrement, true);
assert.equal(eas.build.production.distribution, 'store');

assert.ok(appConfigSource.includes("APP_STORE_VERSION = '13.0.44'"));
assert.ok(appConfigSource.includes('Developer-facing iOS/Android build numbers remain sourced'));
assert.ok(!appConfigSource.includes('IOS_BUILD_NUMBER'));
assert.ok(!appConfigSource.includes('ANDROID_VERSION_CODE'));
assert.ok(!appConfigSource.includes('CFBundleVersion:'));

assert.ok(nativeVersionPlugin.includes('CFBundleShortVersionString'));
assert.ok(nativeVersionPlugin.includes('MARKETING_VERSION'));
assert.ok(!nativeVersionPlugin.includes('IOS_BUILD_NUMBER'));
assert.ok(!nativeVersionPlugin.includes('modResults.CFBundleVersion'));
assert.ok(!nativeVersionPlugin.includes('CURRENT_PROJECT_VERSION ='));

// The local baseline remains useful for local Expo builds and as the value used
// to initialize EAS remote version management before the first auto-increment.
const appConfigFactory = require(path.join(root, 'app.config.js'));
const resolved = appConfigFactory({ config: { ios: { buildNumber: '352' }, android: { versionCode: 352 } } });
assert.equal(resolved.version, '13.0.44');
assert.equal(String(resolved.ios.buildNumber), '410');
assert.equal(resolved.android.versionCode, 130067);
assert.equal(resolved.ios.infoPlist.CFBundleShortVersionString, '13.0.44');
assert.equal(resolved.ios.infoPlist.CFBundleVersion, undefined);

console.log('PASS EAS version guard: marketing version protected, duplicate CFBundleVersion hard-lock removed, and EAS production auto-increment enabled');
