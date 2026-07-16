const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_VERSION = '12.4.2';
const EXPECTED_BUILD = '314';
const EXPECTED_ANDROID = 120405;

function fail(message) {
  console.error(`APP STORE VERSION CHECK FAILED: ${message}`);
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const appConfigFactory = require(path.join(ROOT, 'app.config.js'));

const resolved = appConfigFactory({
  config: {
    version: '9.17.1',
    ios: { buildNumber: '309' },
    android: { versionCode: 91701 },
  },
});

if (appJson.expo.version !== EXPECTED_VERSION) fail(`app.json version is ${appJson.expo.version}`);
if (String(appJson.expo.ios.buildNumber) !== EXPECTED_BUILD) fail(`app.json iOS build is ${appJson.expo.ios.buildNumber}`);
if (appJson.expo.android.versionCode !== EXPECTED_ANDROID) fail(`app.json Android code is ${appJson.expo.android.versionCode}`);
if (pkg.version !== EXPECTED_VERSION) fail(`package.json version is ${pkg.version}`);
if (resolved.version !== EXPECTED_VERSION) fail(`resolved Expo version is ${resolved.version}`);
if (String(resolved.ios?.buildNumber) !== EXPECTED_BUILD) fail(`resolved iOS build is ${resolved.ios?.buildNumber}`);
if (resolved.ios?.infoPlist?.CFBundleShortVersionString !== EXPECTED_VERSION) fail('resolved Info.plist marketing version is not hard-locked');
if (String(resolved.ios?.infoPlist?.CFBundleVersion) !== EXPECTED_BUILD) fail('resolved Info.plist build is not hard-locked');
if (resolved.android?.versionCode !== EXPECTED_ANDROID) fail(`resolved Android code is ${resolved.android?.versionCode}`);

const pluginPath = path.join(ROOT, 'plugins', 'withForcedIOSVersion.js');
const pluginText = fs.readFileSync(pluginPath, 'utf8');
if (!pluginText.includes("APP_STORE_VERSION = '12.4.2'")) fail('native config plugin has wrong marketing version');
if (!pluginText.includes("IOS_BUILD_NUMBER = '314'")) fail('native config plugin has wrong build number');
if (!pluginText.includes('CFBundleShortVersionString')) fail('native config plugin does not write Info.plist');
if (!pluginText.includes('MARKETING_VERSION')) fail('native config plugin does not write Xcode marketing version');

console.log('PASS verifyAppStoreVersion: resolved iOS version 12.4.2 (314), stale 9.17.1 override defeated');
