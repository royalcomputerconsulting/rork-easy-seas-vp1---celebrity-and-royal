const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_VERSION = '13.0.74';
const EXPECTED_BUILD = '445';
const EXPECTED_ANDROID = 130107;
const EXPECTED_NATIVE_BUILD_FLOOR = 445;

function fail(message) {
  console.error(`APP STORE VERSION CHECK FAILED: ${message}`);
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const appConfigFactory = require(path.join(ROOT, 'app.config.js'));

const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
if (easJson.cli?.appVersionSource !== 'remote') fail('eas.json must use EAS remote build-number management');
if (easJson.build?.production?.autoIncrement !== true) fail('production EAS builds must auto-increment CFBundleVersion/versionCode');

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
if (resolved.ios?.infoPlist?.CFBundleVersion !== undefined) fail('dynamic config must not hard-lock CFBundleVersion');
if (resolved.android?.versionCode !== EXPECTED_ANDROID) fail(`resolved Android code is ${resolved.android?.versionCode}`);

const pluginText = fs.readFileSync(path.join(ROOT, 'plugins', 'withForcedIOSVersion.js'), 'utf8');
if (!pluginText.includes(`APP_STORE_VERSION = '${EXPECTED_VERSION}'`)) fail('native config plugin has wrong marketing version');
if (!pluginText.includes('CFBundleShortVersionString')) fail('native config plugin does not write Info.plist');
if (!pluginText.includes('MARKETING_VERSION')) fail('native config plugin does not write Xcode marketing version');
if (pluginText.includes('IOS_BUILD_NUMBER')) fail('native config plugin must not hard-lock an iOS build number');
if (pluginText.includes('modResults.CFBundleVersion')) fail('native config plugin must leave CFBundleVersion to EAS');
if (pluginText.includes('CURRENT_PROJECT_VERSION =')) fail('native config plugin must leave CURRENT_PROJECT_VERSION to EAS');

const runtimeVersionText = fs.readFileSync(path.join(ROOT, 'lib', 'appVersion.ts'), 'utf8');
if (!runtimeVersionText.includes(`EASYSEAS_APP_VERSION = '${EXPECTED_VERSION}'`)) fail('runtime marketing version is stale');
if (!runtimeVersionText.includes(`EASYSEAS_IOS_BUILD_NUMBER = '${EXPECTED_BUILD}'`)) fail('runtime iOS build number is stale');
if (!runtimeVersionText.includes(`EASYSEAS_ANDROID_VERSION_CODE = ${EXPECTED_ANDROID}`)) fail('runtime Android version code is stale');

const ipaVerifierText = fs.readFileSync(path.join(ROOT, 'scripts', 'verifyIpaVersion.py'), 'utf8');
if (!ipaVerifierText.includes(`EXPECTED_VERSION = "${EXPECTED_VERSION}"`)) fail('IPA verifier has wrong marketing version');
if (!ipaVerifierText.includes(`EXPECTED_MIN_BUILD = ${EXPECTED_NATIVE_BUILD_FLOOR}`)) fail('IPA verifier has wrong App Store build floor');

// This is also the EAS post-install hook, so it verifies only build identity
// and Expo configuration. Local QA fixtures are validated separately by
// verify:source-release before packaging and need not ship to EAS.

console.log(`PASS verifyAppStoreVersion: EasySeas ${EXPECTED_VERSION} local baseline ${EXPECTED_BUILD}, Android ${EXPECTED_ANDROID}; EAS remote auto-increment enabled`);
