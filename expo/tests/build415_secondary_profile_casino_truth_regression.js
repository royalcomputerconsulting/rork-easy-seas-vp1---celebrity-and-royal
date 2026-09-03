const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const profileFile = path.join(root, 'lib/profileIsolation.ts');
const compiled = ts.transpileModule(read('lib/profileIsolation.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: profileFile,
}).outputText.replace(/require\("@\/state\/UserProvider"\);?/, '');
const profileModule = new Module(profileFile, module);
profileModule.filename = profileFile;
profileModule.paths = Module._nodeModulePaths(path.dirname(profileFile));
profileModule._compile(compiled, profileFile);

const primary = { id: 'primary', name: 'Primary Player', email: 'primary@example.com', isOwner: true, defaultProfile: true };
const secondary = { id: 'secondary', name: 'Second Player', email: 'second@example.com', active: true };
const profiles = [primary, secondary];
const records = [
  { id: 'p', ownerProfileId: 'primary', sourceEmail: 'primary@example.com' },
  { id: 's', ownerProfileId: 'secondary', sourceEmail: 'second@example.com' },
  { id: 'legacy' },
];
assert.deepEqual(profileModule.exports.filterRecordsForProfile(records, primary, profiles).map((row) => row.id), ['p', 'legacy']);
assert.deepEqual(profileModule.exports.filterRecordsForProfile(records, secondary, profiles).map((row) => row.id), ['s']);

const economicsHook = read('hooks/useCasinoEconomicsData.ts');
assert.match(economicsHook, /filterRecordsForProfile\([\s\S]*?scopedProfile,[\s\S]*?users/);
const commandCenter = read('components/casino/CasinoCommandCenter.tsx');
assert.match(commandCenter, /filterRecordsForProfile\(allSessions, casinoProfile, users\)/);
assert.match(commandCenter, /filterRecordsForProfile\(allSearchableCertificates, casinoProfile, users\)/);
assert.match(commandCenter, /casinoProfile\?\.clubRoyalePoints/);
assert.match(commandCenter, /casinoProfile\?\.celebrityBlueChipPoints/);
assert.match(commandCenter, /Modeled points per play hour/);
assert.match(commandCenter, /mutually exclusive sailings are not added together/);
assert.doesNotMatch(commandCenter, /label="Press efficiency"/);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /isActiveSyncTarget/);
assert.match(provider, /updateUserProfile\(targetProfile\.id, profileUpdates/);
assert.match(provider, /different profile is the sync target/);

const settings = read('app/(tabs)/settings.tsx');
const trustCenter = read('app/data-trust-center.tsx');
assert.match(settings, /pathname: '\/data-trust-center', params: \{ intent: 'backup' \}/);
assert.match(settings, /pathname: '\/data-trust-center', params: \{ intent: 'restore' \}/);
assert.match(trustCenter, /getAllStoredData\(authenticatedEmail\)/, 'Save All must cover the authenticated account instead of one selected traveler only');
assert.match(trustCenter, /backupOwner !== privateOwner/, 'Load All must reject a backup belonging to another private owner');
assert.match(trustCenter, /mergeRestoreDatasets\(pendingRestore\.current, pendingRestore\.incoming, 'preserve-current'\)/, 'restore conflicts must preserve current owner values');
assert.match(settings, /handleProfileSlotPress[\s\S]*?switchUser\(targetId\)[\s\S]*?switchUser\(primaryProfileUser\.id\)/, 'selecting either profile must switch the active loyalty/profile context too');
const bundleOperations = read('lib/dataBundle/bundleOperations.ts');
assert.match(bundleOperations, /const activeProfileEmail = normalizeBackupImportEmail\(gate\?\.activeProfileEmail\)/);
assert.match(bundleOperations, /const activeProfileEmail = gate\?\.hasGate \? gate\.activeProfileEmail : null/);

const loyalty = read('state/LoyaltyProvider.tsx');
assert.match(loyalty, /filterRecordsForProfile\(storedBookedCruises \|\| \[\], currentUser, users\)/, 'loyalty cruise calculations must be owner scoped');
assert.match(loyalty, /loyaltyStorageOwner = `\$\{authenticatedEmail \|\| 'local'\}::\$\{currentUser\?\.id \|\| 'primary'\}`/, 'manual and captured loyalty storage must be profile scoped');
assert.doesNotMatch(loyalty, /Math\.max\(CONFIRMED_CLUB_ROYALE_2026_POINTS/, 'current-season values must not be raised by a known-profile floor');
for (const file of ['app/(tabs)/(overview)/index.tsx', 'app/(tabs)/booked.tsx', 'app/(tabs)/events.tsx', 'app/ask-my-data.tsx']) {
  assert.match(read(file), /filterRecordsByIntelligence/, `${file} must apply the shared profile boundary`);
}
assert.match(read('app/ask-my-data.tsx'), /scopedOffers[\s\S]*scopedCruises[\s\S]*scopedBooked[\s\S]*scopedCertificates[\s\S]*scopedCalendar/, 'Ask My Data must scope all major datasets to the selected profile');

console.log('PASS Build 415 secondary-profile isolation and Casino truth regression');
