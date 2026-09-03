const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const appJson = JSON.parse(read('app.json'));
const tabsLayout = read('app/(tabs)/_layout.tsx');
const rootLayout = read('app/_layout.tsx');
const casinoScreen = read('components/casino/CasinoCommandCenter.tsx');
const ledgerTypes = read('types/casinoLedger.ts');
const ledgerHook = read('hooks/useCasinoLedger.ts');
const truthEngine = read('lib/casino/casinoTruthEngine.ts');
const seasons = read('lib/casino/casinoProgramSeasons.ts');
const identity = read('lib/casino/casinoCruiseIdentity.ts');

assert.equal(appJson.expo.version, '13.0.61');
assert.equal(appJson.expo.ios.buildNumber, '427');
assert.equal(appJson.expo.android.versionCode, 130093);
assert.match(pkg.scripts['verify:source-release'], /runMaintainedReleaseTests\.js/);

assert.match(rootLayout, /<ErrorBoundary>/, 'root diagnostic ErrorBoundary must remain mounted');
assert.match(tabsLayout, /name="machines"/, 'Casino tab route must remain present');
assert.match(casinoScreen, /testID="casino-relationship-intelligence"/, 'Casino tab must expose a stable launch test id');

for (const label of ['Intelligence', 'Charts', 'Play', 'Calcs']) {
  assert.match(casinoScreen, new RegExp(`label: '${label}'`), `Casino shell missing ${label} selector`);
}

assert.match(casinoScreen, /CASINO_TRUTH_BATCH_SIZE = 125/, 'truth building must stay bounded');
assert.match(casinoScreen, /setTimeout\(processBatch, 0\)/, 'truth building must yield between batches');
assert.match(casinoScreen, /runAfterUiSettles/, 'charts must defer until navigation settles through the guarded scheduler');
assert.ok(casinoScreen.includes('const sourceLabel'), 'Casino screen must define visible source labels');
assert.ok(casinoScreen.includes("return 'UNAVAILABLE'"), 'visible result labels must distinguish unavailable data');

for (const required of ['ownerProfileId', 'sourceEmail', 'reservationNumber', 'bookingId', 'matchKey', 'matchSource']) {
  assert.match(ledgerTypes, new RegExp(required), `ledger type missing ${required}`);
  assert.match(ledgerHook, new RegExp(required), `ledger hook missing ${required}`);
}

for (const quality of ['Actual', 'Imported', 'Synced', 'Derived', 'Estimated', 'Incomplete', 'Unavailable']) {
  assert.match(ledgerTypes, new RegExp(`'${quality}'`), `ledger data quality missing ${quality}`);
}

assert.ok(ledgerHook.includes("if (kind === 'provider_reported') return 'synced';"), 'provider data must be comparison/synced evidence');
assert.match(truthEngine, /cruisePoints \?\? \(sessionPoints > 0 \? sessionPoints : null\)/, 'manual cruise points must remain authoritative over session fallback');
assert.match(truthEngine, /pointDerivedCoinIn\(program, pointsValue\)/, 'coin-in estimates must go through program-specific conversion rules');

assert.match(identity, /matchKey: `reservation:\$\{reservation\}`/, 'reservation must be the first matching key');
assert.match(identity, /matchKey: `booking:\$\{booking\}`/, 'booking ID must be the second matching key');
assert.match(identity, /matchKey: `owner-ship-date:\$\{owner\}:\$\{ship\}:\$\{sailing\}`/, 'owner + ship + date fallback must include owner');
assert.match(identity, /matchSource: 'ship-date'/, 'ship/date fallback must be explicit and detectable');

assert.match(seasons, /const resetMonth = program === 'blue_chip' \? 8 : 4/, 'Blue Chip must reset on August 1 and Club Royale on April 1');
assert.match(seasons, /const resetDay = 1/, 'casino seasons must reset on the first of the reset month');
assert.match(seasons, /endDateExclusive = dateKey\(startYear \+ 1, resetMonth, resetDay\)/, 'season end must be exclusive one year after reset');

assert.doesNotMatch(casinoScreen, /58860|58,680|293,400/, 'Casino UI must not contain hardcoded private totals');

console.log('PASS build410 requirements batch 1: runtime shell, ledger foundation, source labels, stable matching, performance, and seasons');
