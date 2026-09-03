const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /expo-file-system\/legacy/, 'native spreadsheet import must use the SDK 54 legacy file API');
assert.match(settings, /FileSystem\.EncodingType\.UTF8/, 'CSV must be read as UTF-8 text');
assert.match(settings, /XLSX\.read\(csvText, \{ type: 'string'/, 'CSV text must use the XLSX string parser');
assert.match(settings, /FileSystem\.EncodingType\.Base64/, 'XLSX must be read as binary base64');
assert.match(settings, /SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID/, 'confirmed historical rows must enable the annual Casino reconciliation');
assert.match(settings, /guestNames: activeGuestName \? \[activeGuestName\] : \[\]/, 'imported casino history must be attached to the active profile');
assert.match(settings, /await coreData\.flushPendingWrites\(\)/, 'Save All must flush edited cruise/casino closeouts first');

const weather = read('components/VoyageWeatherSection.tsx');
assert.match(weather, /const toggleExpanded = useCallback/);
assert.match(weather, /testID={`toggle-voyage-weather-\$\{cruise\.id\}`}/);
assert.match(weather, /accessibilityState=\{\{ expanded \}\}/);
assert.match(weather, /<Pressable[\s\S]*?onPress=\{toggleExpanded\}/, 'the complete weather row must be an explicit press target');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /resolvedSyncOwnerProfile = currentUser \?\? users\.find/, 'sync owner must survive delayed current-user hydration');
assert.match(provider, /'PUBLISH_LOCAL_COMMIT'/, 'verified sync data must be published to live app state');
assert.match(provider, /\(\) => coreDataContext\.refreshData\(\)/, 'publication must reload authoritative local storage');

const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
for (const field of ['pointsEarned', 'coinIn', 'cashResult', 'hoursPlayed', 'retailValue', 'casinoHistoryImportId']) {
  assert(syncLogic.includes(`'${field}'`), `provider sync must preserve local ${field}`);
}

const cruiseDetails = read('app/(tabs)/(overview)/cruise-details.tsx');
for (const field of ['pointsEarned', 'earnedPoints', 'casinoPoints', 'winningsBroughtHome', 'netResult', 'cashResult']) {
  assert(cruiseDetails.includes(`${field}:`), `manual cruise-detail entry must write canonical ${field}`);
}
assert.doesNotMatch(cruiseDetails, /coinIn:\s*pointsValue\s*\*\s*DOLLARS_PER_POINT/, 'manual point entry must not silently claim slot coin-in');
const closeout = read('lib/casino/postCruiseCloseout.ts');
assert.match(closeout, /points !== undefined && input\.slotPointsConfirmed/, 'points × $5 requires explicit eligible-slot confirmation');
assert.match(closeout, /ratedGamingDays/, 'closeout must persist explicit rated gaming days for ADT');

const integrityFile = path.join(root, 'lib/sync/syncRunIntegrity.ts');
const compiled = ts.transpileModule(read('lib/sync/syncRunIntegrity.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: integrityFile,
}).outputText;
const mod = new Module(integrityFile, module);
mod.filename = integrityFile;
mod.paths = Module._nodeModulePaths(path.dirname(integrityFile));
mod._compile(compiled, integrityFile);
const snapshot = mod.exports.createSyncOwnershipSnapshot('royal', 'signed-in-profile', 'owner@example.com');
assert.equal(mod.exports.canPersistSyncToTarget(snapshot, 'second-local-profile', 'guest@example.com', ['signed-in-profile', 'second-local-profile']), true);
assert.equal(mod.exports.canPersistSyncToTarget(snapshot, 'foreign-profile', 'guest@example.com', ['signed-in-profile']), false);

console.log('PASS build415 weather toggle, casino CSV import, Save All flush, sync ownership, and live publication regression');
