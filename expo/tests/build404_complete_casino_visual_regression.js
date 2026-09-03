const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTs(relativeFile, dependencyMap = {}) {
  const filename = path.join(root, relativeFile);
  const output = ts.transpileModule(read(relativeFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const old = Module._load;
  Module._load = (request, parent, main) => request in dependencyMap ? dependencyMap[request] : request.startsWith('@/') ? {} : old(request, parent, main);
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally { Module._load = old; }
}

const ui = read('components/casino/CasinoCommandCenter.tsx');
for (const label of ['Intelligence', 'Charts', 'Play', 'Calcs']) assert.ok(ui.includes(`label: '${label}'`), `missing four-page tab ${label}`);
for (const feature of [
  'Current-season cruise activity', 'Historical annual economics', 'Cruise portfolio',
  'Casino charts', 'Points by cruise', 'Cash result by cruise', 'Annual value capture',
  'Cruise-derived play', 'Modeled PPH target', 'Optional session streaks',
  'Casino calculations', 'Coin-in volume', 'Theoretical loss', 'Average daily theo',
  'Modeled points per play hour', 'Value per modeled play hour', 'Value per casino cruise', 'Theo risk per modeled play hour',
  'Result versus expected loss', 'Historical play-data stability', 'Sustainability',
]) assert.ok(ui.includes(feature), `missing restored Casino feature: ${feature}`);
assert.doesNotMatch(ui, /label="Press efficiency"/, 'Press efficiency must stay removed until its required inputs exist');
assert.match(ui, /function ProgressMeter/);
assert.match(ui, /function ColorMetric/);
assert.match(ui, /function DistributionBar/);
assert.match(ui, /programTrips\.slice\(0, 12\)/, 'portfolio must be bounded on the mounted scroll screen');

const economicsHook = read('hooks/useCasinoEconomicsData.ts');
assert.doesNotMatch(economicsHook, /knownProfileFallback/);
assert.doesNotMatch(economicsHook, /CONFIRMED_CLUB_ROYALE_2025_POINTS/);
assert.match(economicsHook, /Array\.isArray\(localData\?\.booked\)/);
assert.match(economicsHook, /Array\.isArray\(storedBookedCruises\)/);

const metrics = loadTs('lib/casino/casinoDashboardMetrics.ts');
const evidence = (value, kind = 'actual') => ({ value, kind, source: kind });
const rows = [
  { cruiseId: 'a', shipName: 'A', sailDate: '2026-04-01', points: evidence(1000), hours: evidence(10), coinIn: evidence(5000), theoreticalLoss: evidence(400), netGamingResult: evidence(500), seaDays: 2, portDays: 2, casinoAvailabilityHours: 44, casinoAvailableDays: 4, casinoAvailabilitySource: 'itinerary', ratedGamingDays: 4, ratedGamingDaysSource: 'casino_availability_estimate' },
  { cruiseId: 'b', shipName: 'B', sailDate: '2026-05-01', points: evidence(2000), hours: evidence(20), coinIn: evidence(10000), theoreticalLoss: evidence(800), netGamingResult: evidence(-200), seaDays: 3, portDays: 2, casinoAvailabilityHours: 60, casinoAvailableDays: 5, casinoAvailabilitySource: 'itinerary', ratedGamingDays: 5, ratedGamingDaysSource: 'casino_availability_estimate' },
];
const sessionAnalytics = {
  actualSessionCount: 2, generatedSessionCount: 0, totalPlayTimeMinutes: 1800,
  totalBuyIn: 0, totalCashOut: 0, netWinLoss: 300, totalPointsEarned: 3000,
  totalCoinIn: 15000, coinInSource: 'actual', ratedGamingDays: 2, adt: 600,
  avgSessionLength: 900, avgBuyIn: 0, avgWinLoss: 150, winRate: 50, lossRate: 50,
  breakEvenRate: 0, bestSession: null, worstSession: null, pointsPerHour: 100,
  machineTypeBreakdown: {}, denominationBreakdown: {}, varianceStats: { standardDeviation: 350, variance: 122500, maxWin: 500, maxLoss: -200, medianWinLoss: 150 },
  machinePerformance: {}, streakData: { currentStreak: 0, currentStreakType: 'none', longestWinStreak: 1, longestLossStreak: 1 },
  theoreticalVsActual: { theoreticalLoss: 1200, actualLoss: 0, variance: 1500, variancePercent: 125, isRunningHot: true, isRunningCold: false },
};
const summary = metrics.buildCasinoDashboardMetrics({ truths: rows, sessions: [], sessionAnalytics });
assert.equal(summary.totalPoints, 3000);
assert.equal(summary.totalHours, 30);
assert.equal(summary.pointsPerHour, 100);
assert.equal(summary.totalCasinoAvailabilityHours, 104);
assert.equal(summary.casinoAvailableDays, 9);
assert.equal(Math.round(summary.adt), 133);
assert.equal(summary.adtConfidence, 'estimated');
assert.equal(summary.totalCoinIn, 15000);
assert.equal(summary.totalTheo, 1200);
assert.equal(summary.totalNet, 300);
assert.equal(summary.winRate, 50);
assert.equal(summary.lossRate, 50);
assert.equal(summary.theoVariance, 1500);
assert.ok(summary.dataCoverage > 99);

const empty = metrics.buildCasinoDashboardMetrics({ truths: [], sessions: [], sessionAnalytics: { ...sessionAnalytics, actualSessionCount: 0 } });
assert.equal(empty.totalPoints, 0);
assert.equal(empty.totalCoinIn, null);
assert.equal(empty.totalTheo, null);
assert.equal(empty.totalNet, null);
assert.equal(empty.offerSafetyIndex, null);

console.log('PASS Build 404 complete owner-scoped Casino calculations and visual feature regression');
