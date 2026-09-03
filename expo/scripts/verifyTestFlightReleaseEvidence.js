const fs = require('node:fs');
const path = require('node:path');

const evidencePath = process.argv[2] || path.join(process.cwd(), 'native-validation-evidence.json');
const EXPECTED = {
  version: '13.0.44',
  minimumIosBuild: 410,
  bundleIdentifier: 'app.rork.easy-seas-vp1-celebrity-and-royal',
};
const requiredChecks = [
  'ios.startupOfflineLocalAuthCompletes',
  'ios.startupSplashExitsWithinFiveSeconds',
  'ios.startupCloudUnavailableDoesNotBlock',
  'ios.startupUsesExistingLocalData',
  'ios.startupNoCloudRestoreScreen',
  'ios.startupNoAutomaticBackendRequest',
  'ios.startupCorruptCollectionIsolation',
  'ios.logoutPreservesLocalData',
  'ios.accountSwitchPreservesScopedData',
  'ios.largeLocalDatasetRestartReadback',
  'ios.startupStorageHealthFailureNonblocking',
  'ios.foregroundDoesNotTriggerCloudSync',
  'ios.manualCloudBackupRestoreOptional',
  'ios.largeLocalDatasetUiResponsive',
  'ios.localDataSurvivesUpgrade',
  'ios.cleanInstallStartup',
  'ios.upgradeInstallStartup',
  'ios.carnivalScreenOpen20Times',
  'ios.carnivalAuthenticatedSync',
  'ios.carnivalNoNativeCrash',
  'ios.carnivalBackNavigation',
  'ios.carnivalOffersAndSailingsCaptured',
  'ios.carnivalHistoricalCruiseClassification',
  'ios.carnivalNoUndefinedDuration',
  'ios.royalAuthenticatedSync',
  'ios.royalBookedCruisesMatchSource',
  'ios.royalCompletedCruisesMatchSource',
  'ios.royalPersistenceReadback',
  'ios.royalLocalCommitCompletes',
  'ios.royalCloudBackupDoesNotBlock',
  'ios.certificateIndividualDirectDownload',
  'ios.certificateBatchDownload',
  'ios.certificateRetainedPdfOpen',
  'ios.certificate2607CVIP2Parsed',
  'ios.certificate2607A01Parsed',
  'ios.logoFillVerified',
  'ios.settingsAndNavigationRegression',
  'testflight.noNewCrashObserved',
];
const requiredText = [
  'device.model',
  'device.osVersion',
  'device.testedAt',
  'device.tester',
  'artifacts.royalSyncLog',
  'artifacts.carnivalSyncLog',
  'artifacts.certificateLog',
  'artifacts.screenRecording',
  'artifacts.crashReview',
];

function get(obj, dotted) {
  return dotted.split('.').reduce((value, key) => value && value[key], obj);
}
function fail(lines) {
  console.error('TESTFLIGHT RELEASE GATE FAILED:');
  for (const line of lines) console.error(`- ${line}`);
  process.exit(1);
}

if (!fs.existsSync(evidencePath)) fail([`evidence file not found: ${evidencePath}`]);
let evidence;
try {
  evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
} catch (error) {
  fail([`invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
}
const problems = [];
if (evidence.release?.version !== EXPECTED.version) problems.push(`release.version must be ${EXPECTED.version}`);
if (!Number.isInteger(Number(evidence.release?.iosBuild)) || Number(evidence.release?.iosBuild) < EXPECTED.minimumIosBuild) {
  problems.push(`release.iosBuild must be at least ${EXPECTED.minimumIosBuild}`);
}
if (evidence.release?.bundleIdentifier !== EXPECTED.bundleIdentifier) problems.push('release.bundleIdentifier does not match EasySeas');
for (const key of requiredChecks) if (get(evidence, key) !== true) problems.push(`${key} must be true`);
for (const key of requiredText) {
  const value = get(evidence, key);
  if (typeof value !== 'string' || value.trim().length < 3) problems.push(`${key} must contain an evidence reference`);
}
if (problems.length > 0) fail(problems);
console.log(`PASS TestFlight release evidence: EasySeas ${EXPECTED.version} (minimum build ${EXPECTED.minimumIosBuild}) physical-iPhone acceptance is fully recorded.`);
