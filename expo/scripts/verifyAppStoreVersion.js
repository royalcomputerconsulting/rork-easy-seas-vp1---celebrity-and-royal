const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_VERSION = '13.0.45';
const EXPECTED_BUILD = '411';
const EXPECTED_ANDROID = 130068;
const EXPECTED_NATIVE_BUILD_FLOOR = 411;

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

const sourceReleaseCommand = pkg.scripts?.['verify:source-release'] || '';
for (const command of [
  'node scripts/verifyAppStoreVersion.js',
  'node scripts/transpileTypeScriptSyntax.js',
  'node scripts/runMaintainedReleaseTests.js',
  'node scripts/verifyBuild337Startup.js',
  'node tests/build356_performance_certificate_carnival_regression.js',
  'node tests/build356_celebrity_navigation_regression.js',
  'node tests/build357_loyalty_status_match_regression.js',
  'node tests/build358_my_cruises_navigation_regression.js',
  'node tests/build359_full_conversation_audit_regression.js',
  'node tests/build360_eas_auto_increment_regression.js',
  'node tests/build363_club_royale_tier_retention_regression.js',
  'node tests/build364_itinerary_weather_offline_regression.js',
  'node tests/build365_august_certificate_parser_regression.js',
  'node tests/build366_carnival_weather_performance_regression.js',
  'node tests/build367_offer_booking_marine_atomic_regression.js',
  'node tests/build369_sync_certificate_cloud_regression.js',
  'node tests/build370_royal_celebrity_reference_alias_regression.js',
  'node scripts/testBuild371CarnivalFullCatalog.js',
  'node tests/build371_certificate_catalog_regression.js',
  'node tests/build371_certificate_ask_index_regression.js',
  'node tests/build371_unified_easy_seas_agent_regression.js',
  'node tests/build372_certificate_device_export_regression.js',
  'node tests/build396_certificate_resume_weather_refresh_regression.js',
  'node tests/build397_weather_loyalty_carnival_agent_regression.js',
]) {
  if (!sourceReleaseCommand.includes(command)) fail(`source-release verification is missing: ${command}`);
}

for (const requiredFile of [
  'tests/phase1_critical_sync_repairs_regression.js',
  'tests/phase2_certificates_logo_regression.js',
  'tests/build331_corrective_live_regression.js',
  'tests/build332_startup_recovery_regression.js',
  'tests/build334_local_first_startup_regression.js',
  'scripts/runMaintainedReleaseTests.js',
  'scripts/verifyBuild337Startup.js',
  'tests/build337_startup_fail_open_regression.js',
  'tests/build356_performance_certificate_carnival_regression.js',
  'tests/build356_celebrity_navigation_regression.js',
  'tests/build357_loyalty_status_match_regression.js',
  'tests/build358_my_cruises_navigation_regression.js',
  'tests/build359_full_conversation_audit_regression.js',
  'tests/build360_eas_auto_increment_regression.js',
  'tests/build363_club_royale_tier_retention_regression.js',
  'tests/build364_itinerary_weather_offline_regression.js',
  'tests/build365_august_certificate_parser_regression.js',
  'tests/build366_carnival_weather_performance_regression.js',
  'tests/build367_offer_booking_marine_atomic_regression.js',
  'tests/build370_royal_celebrity_reference_alias_regression.js',
  'scripts/testBuild371CarnivalFullCatalog.js',
  'tests/build371_certificate_catalog_regression.js',
  'tests/build371_certificate_ask_index_regression.js',
  'tests/build371_unified_easy_seas_agent_regression.js',
  'tests/build372_certificate_device_export_regression.js',
  'tests/build396_certificate_resume_weather_refresh_regression.js',
  'tests/build397_weather_loyalty_carnival_agent_regression.js',
  'scripts/verifyTestFlightReleaseEvidence.js',
]) {
  if (!fs.existsSync(path.join(ROOT, requiredFile))) fail(`required release file is missing: ${requiredFile}`);
}

console.log(`PASS verifyAppStoreVersion: EasySeas ${EXPECTED_VERSION} local baseline ${EXPECTED_BUILD}, Android ${EXPECTED_ANDROID}; EAS remote auto-increment enabled`);
