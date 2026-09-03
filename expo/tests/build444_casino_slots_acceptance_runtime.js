const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const truthEngine = loadTs('lib/casino/casinoTruthEngine.ts');
const dashboardEngine = loadTs('lib/casino/casinoDashboardMetrics.ts');
const economicsEngine = loadTs('lib/casinoCruiseEconomics.ts');
const facts = loadTs('lib/casinoAnnualReportFacts.ts').ANNUAL_CASINO_REPORT_FACTS;
const machineFilter = loadTs('lib/slotMachineLibraryFilter.ts');

const completedCruises = facts.map((fact, index) => ({
  id: `annual-${index}`,
  shipName: fact.ship,
  sailDate: fact.sailDate,
  returnDate: fact.returnDate,
  nights: fact.nights,
  status: 'completed',
  completionState: 'completed',
  cruiseSource: 'royal',
  brand: 'Royal Caribbean',
  casinoProgram: 'clubRoyale',
  isCasinoOffer: true,
  pointsEarned: fact.pointsEarned,
  earnedPoints: fact.pointsEarned,
  retailValue: fact.retailValue,
  amountPaid: fact.amountPaid,
  winningsBroughtHome: fact.winningsBroughtHome,
  cashResult: fact.winningsBroughtHome - fact.amountPaid,
  calculationConfidence: fact.calculationConfidence,
  notes: fact.notes,
}));

const truths = completedCruises.map((cruise) => truthEngine.buildCasinoCruiseTruth({
  cruise,
  sessions: [],
  pointsPerHourFallback: 400,
  houseEdgeFallback: 0.08,
}));
assert.equal(truths.length, 21);
assert.equal(truths.reduce((sum, truth) => sum + truth.points.value, 0), 34_537, 'raw pasted cruise points must remain row-level truth');
assert.equal(truths.reduce((sum, truth) => sum + truth.coinIn.value, 0), 172_685, 'raw row coin-in must stay separate from annual reconciliation');
assert.ok(truths.every((truth) => truth.hours.kind === 'estimated'), 'session-free history must estimate play time instead of fabricating sessions');
assert.ok(truths.every((truth) => truth.ratedGamingDaysSource === 'casino_availability_estimate'));

const reconciliation = truthEngine.reconcileCasinoSeason({
  program: 'club_royale',
  asOf: '2026-03-31',
  syncedPoints: 58_680,
  cruises: truths,
});
assert.equal(reconciliation.attributedCruisePoints, 34_537);
assert.equal(reconciliation.unallocatedPoints, 24_143);
assert.equal(reconciliation.overAttributedPoints, 0);

const dashboard = dashboardEngine.buildCasinoDashboardMetrics({
  truths,
  sessions: [],
  sessionAnalytics: { actualSessionCount: 0, ratedGamingDays: 0 },
});
assert.equal(dashboard.tripCount, 21);
assert.equal(dashboard.totalPoints, 34_537);
assert.equal(dashboard.totalCoinIn, 172_685);
assert.equal(dashboard.totalTheo, 13_814.8);
assert.equal(dashboard.adtConfidence, 'estimated');
assert.ok(dashboard.adt > 0);
assert.equal(dashboard.actualHours, null, 'the UI must not call estimated play time an actual session total');
assert.ok(dashboard.estimatedHours > 0);

const economics = economicsEngine.buildCruiseEconomicsSummary(completedCruises, new Date('2026-03-31T12:00:00Z'), {
  scope: 'annualCompletedRoyal',
  useKnownAnnualReportFacts: true,
  minimumTotalPoints: 58_680,
  pointsAdjustmentNote: 'Confirmed annual account reconciliation.',
});
assert.equal(economics.totals.cruises, 21);
assert.equal(economics.totals.totalNights, 106);
assert.equal(economics.totals.totalRetail, 47_774);
assert.equal(economics.totals.totalPaid, 4_238.41);
assert.equal(economics.totals.totalPoints, 58_680);
assert.equal(economics.totals.totalCoinIn, 293_400);
assert.equal(economics.totals.totalWinningsHome, 19_457);
assert.equal(economics.totals.totalNetCash, 15_218.59);
assert.equal(economics.roiStyle.netRoiOnPaid, 359.06);

const machines = Array.from({ length: 20_000 }, (_, index) => ({
  id: `machine-${index}`,
  machineName: `${index % 2 ? 'Buffalo' : 'Dragon'} ${String(index).padStart(5, '0')}`,
  manufacturer: index % 3 === 0 ? 'Aristocrat' : 'IGT',
  gameSeries: index % 2 ? 'Buffalo' : 'Dragon Link',
  theme: index % 2 ? 'Animals' : 'Mythology',
  isFavorite: index % 100 === 0,
  shipAssignments: [{ shipName: index % 4 === 0 ? 'Harmony of the Seas' : 'Icon of the Seas' }],
}));
machines.push({ id: 'malformed-row', machineName: undefined, manufacturer: undefined, shipAssignments: [{ shipName: undefined }] });
const started = performance.now();
const filtered = machineFilter.filterSlotMachineLibrary(machines, {
  searchQuery: 'dragon',
  favoritesOnly: true,
  manufacturer: 'Aristocrat',
  ship: 'Harmony of the Seas',
});
const elapsed = performance.now() - started;
assert.ok(filtered.length > 0);
assert.ok(filtered.every((machine) => machine.isFavorite && machine.manufacturer === 'Aristocrat'));
assert.ok(elapsed < 500, `20,001-row machine filtering took ${elapsed.toFixed(1)} ms`);
assert.equal(new Set(machines.slice(0, 20_000).map(machineFilter.getSlotMachineListKey)).size, 20_000);

const casino = read('components/casino/CasinoCommandCenter.tsx');
for (const id of ['intelligence', 'charts', 'session', 'calcs']) {
  assert.ok(casino.includes(`testID={\`casino-${'${tab.id}'}-tab\`}`), 'Casino tab selector instrumentation is missing');
  assert.match(casino, new RegExp(`activeTab === '${id}'`));
}
for (const section of ['casino-current-season-section', 'casino-charts-section', 'casino-play-section', 'casino-calculations-section', 'casino-strategy-tools-section']) {
  assert.ok(casino.includes(`testID="${section}"`), `${section} is missing`);
}
for (const tool of ['Royal receipt importer', 'Host CRM', 'Certificate wallet', 'Value scenarios', 'Completed sailings', 'Formula reference']) {
  assert.ok(casino.includes(tool), `${tool} is unreachable`);
}
assert.match(casino, /CASINO_TRUTH_BATCH_SIZE = 125/);
assert.match(casino, /setTimeout\(processBatch, 0\)/, 'large casino histories must yield between batches');

const slots = read('app/(tabs)/machines.tsx');
for (const target of ['machines.search.input', 'machines.filter.open', 'machines.filter.favorites', 'machines.filter.apply', 'machines.filter.reset', 'machines.exportFavorites', 'machines.exportAll', 'machines-open-verified-atlas', 'machines.sessions.add', 'machines.list']) {
  assert.ok(slots.includes(`testID="${target}"`), `${target} is missing`);
}
assert.match(slots, /filterSlotMachineLibrary/);
assert.match(slots, /keyExtractor=\{getSlotMachineListKey\}/);
assert.match(slots, /initialNumToRender=\{12\}/);
assert.match(slots, /maxToRenderPerBatch=\{16\}/);

console.log(`PASS Build 444 Casino and Slots acceptance; 20,001-row filter completed in ${elapsed.toFixed(1)} ms`);
