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

assert.match(pkg.scripts['verify:source-release'], /build410_requirements_batch3_4_regression\.js/);

for (const label of [
  'Economic Health Analysis',
  'ROI + portfolio diversity + cruise count + points pace + retail captured value + data coverage',
  'Ship comparison · points per night',
  'Ship data confidence',
  'season trend · posted vs expected points',
  "activeTab === 'charts'",
  'chartsReady &&',
  'Season and rolling trend charts load only on this page so tab changes stay immediate',
]) {
  assert.ok(casino.includes(label), `Charts/economic health surface missing: ${label}`);
}

for (const label of [
  'Simple onboard session entry',
  'starting cash-in',
  'ending cash-out',
  'separately paid jackpots',
  'start/end time or duration',
  'ship/cruise, game type, and notes',
  'crash-safe',
  'reconcile back to the cruise once—not twice',
  'PPH goals, history, comparison, leaderboard',
  'Today / Week / Month / All-Time',
  'minimum-data guard',
  'Weekly goal and XP',
  'Start onboard casino mode',
  'View or add sessions',
]) {
  assert.ok(casino.includes(label), `Session/PPH capability missing: ${label}`);
}

for (const label of [
  'Cash result = cash-out + separately paid jackpots − cash-in',
  'Club Royale slots may derive coin-in as qualifying points × $5',
  'Blue Chip, table, poker, and unknown play require explicit coin-in',
  'Theo = explicit theo, else valid coin-in × configured house edge',
  'ADT = theo ÷ rated gaming days',
  'Risk per hour is theoretical loss ÷ play hours',
  'Press efficiency is unavailable until press exposure',
  'Offer Safety Index combines consistency, sample size, points pace, variance, and confidence',
]) {
  assert.ok(casino.includes(label), `Calculation guardrail missing: ${label}`);
}

assert.match(truthEngine, /cashOut \+ \(session\.handpayIncludedInCashOut \? 0 : handpay\) - cashIn/, 'cash result must avoid handpay double counting');
assert.match(truthEngine, /program === 'club_royale'/, 'Club Royale coin-in conversion must be program-specific');
assert.match(truthEngine, /points \* 5/, 'Club Royale slot coin-in may derive from points × $5');
assert.match(truthEngine, /return \{ value: null, kind: 'missing'/, 'non-Royal/unknown coin-in must stay missing unless explicit');
assert.match(truthEngine, /recordedTheo/, 'explicit theoretical loss must be preferred');
assert.match(truthEngine, /coinIn\.value \* hold/, 'theo estimate must use valid coin-in × house edge');
assert.match(dashboard, /ratedGamingDays/, 'ADT must use rated gaming days, not blindly substitute cruise nights');

assert.match(dashboard, /offerSafetyIndex/, 'dashboard must calculate Offer Safety Index');
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
