const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const casino = read('components/casino/CasinoCommandCenter.tsx');
const truthEngine = read('lib/casino/casinoTruthEngine.ts');
const dashboard = read('lib/casino/casinoDashboardMetrics.ts');
const sessions = read('state/CasinoSessionProvider.tsx');
const onboard = read('app/casino/onboard-mode.tsx');
const pkg = JSON.parse(read('package.json'));

assert.match(pkg.scripts['verify:source-release'], /runMaintainedReleaseTests\.js/);

for (const label of [
  'Casino evidence composition',
  'Ship evidence confidence',
  'verified-field completeness',
  'attributed points by month',
  "activeTab === 'charts'",
  'chartsReady &&',
]) {
  assert.ok(casino.includes(label), `Charts/economic health surface missing: ${label}`);
}

for (const label of [
  'Cruise-derived play',
  'actual session entry is optional',
  'Final points, win/loss, itinerary days, and availability produce each sailing estimate',
  'casino availability comes from itinerary/open-day records',
  'estimated play hours = final points ÷ configured historical PPH',
  'modeled coin-in = Club Royale points × $5 when slot points are confirmed',
  'theoretical = coin-in × hold',
  'ADT = theoretical ÷ casino-available/rated days',
  'Optional actual session logs',
  'Cruise-level points and win/loss remain the normal source',
  'Start onboard casino mode',
  'Add cruise-level result',
]) {
  assert.ok(casino.includes(label), `Cruise-derived play capability missing: ${label}`);
}

for (const label of [
  'Cash result = cash-out + separately paid jackpots − cash-in',
  'Club Royale slots may derive coin-in as qualifying points × $5',
  'Blue Chip, table, poker, and unknown play require explicit coin-in',
  'Theo = explicit theo, else valid coin-in × configured house edge',
  'ADT = theo ÷ rated/available gaming days',
  'Risk per modeled play hour is theoretical loss ÷ estimated play hours',
  'Historical play-data stability',
  'Sustainability',
]) {
  assert.ok(casino.includes(label), `Calculation guardrail missing: ${label}`);
}

assert.match(truthEngine, /cashOut \+ \(session\.handpayIncludedInCashOut \? 0 : handpay\) - cashIn/, 'cash result must avoid handpay double counting');
assert.match(truthEngine, /program === 'club_royale'/, 'Club Royale coin-in conversion must be program-specific');
assert.match(truthEngine, /points \* 5/, 'Club Royale slot coin-in may derive from points × $5');
assert.match(truthEngine, /return \{ value: null, kind: 'missing'/, 'non-Royal/unknown coin-in must stay missing unless explicit');
assert.match(truthEngine, /recordedTheo/, 'explicit theoretical loss must be preferred');
assert.match(truthEngine, /coinIn\.value \* hold/, 'theo estimate must use valid coin-in × house edge');
assert.match(dashboard, /estimatedRatedGamingDays/, 'ADT must fall back to casino-available days when explicit rated days are missing');
assert.match(dashboard, /totalCasinoAvailabilityHours/, 'dashboard must expose casino availability hours for cruise-derived play estimates');

assert.match(dashboard, /offerSafetyIndex/, 'dashboard retains the internal compatibility field for historical play-data stability');
assert.match(dashboard, /sustainabilityScore/, 'dashboard must calculate sustainability score');
assert.match(dashboard, /theoVariancePercent/, 'dashboard must calculate theo variance percent');
assert.match(dashboard, /dataCoverage/, 'dashboard must calculate data coverage');

assert.match(sessions, /handpayIncludedInCashOut \? 0/, 'session analytics must prevent jackpot double-counting');
assert.match(sessions, /streakData/, 'session analytics must retain streak calculations');
assert.match(sessions, /actualSessionCount/, 'session analytics must separate actual sessions from generated rows');
assert.match(onboard, /cashIn: buyIn/, 'onboard mode must save cash-in');
assert.match(onboard, /cashOut: out/, 'onboard mode must save cash-out');
assert.match(onboard, /handpayIncludedInCashOut: false/, 'onboard mode must mark separate handpays explicitly');

console.log('PASS build410 requirements batch 3-4: economic health/charts, sessions/PPH, reconciliation, and casino calculation guardrails');
