const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/casino/casinoRelationshipIntelligence.ts');
const source = fs.readFileSync(filename, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(output, filename);
const lib = mod.exports;

const completed = {
  id: 'trip-1', shipName: 'Icon of the Seas', sailDate: '2026-01-01', returnDate: '2026-01-08', nights: 7,
  status: 'completed', completionState: 'completed', sourceAuthority: 'user_entered', pointsEarned: 7000,
  coinIn: 35000, theoreticalLoss: 2800, amountPaid: 200, cruiseValueCaptured: 4000, hostCompsReceived: 200,
};
const future = { id: 'trip-2', shipName: 'Harmony of the Seas', sailDate: '2026-10-01', returnDate: '2026-10-08', nights: 7, status: 'booked' };
const sessions = [
  { id: 's1', cruiseId: 'trip-1', date: '2026-01-02', startTime: '10:00', endTime: '12:00', durationMinutes: 120, winLoss: -200, pointsEarned: 1000, freePlayUsed: 100, compsReceived: 50, createdAt: '2026-01-02' },
  { id: 's2', cruiseId: 'trip-1', date: '2026-01-03', startTime: '10:00', endTime: '12:00', durationMinutes: 120, winLoss: 100, pointsEarned: 1000, createdAt: '2026-01-03' },
];
const offers = [
  { id: 'o1', playerOfferId: 'p1', offerCode: 'SHARED', offerType: 'comped', title: 'Offer one', received: '2026-02-01', retailCabinValue: 2000, freePlay: 100 },
  { id: 'o2', playerOfferId: 'p2', offerCode: 'SHARED', offerType: 'comped', title: 'Offer two', received: '2026-02-02', retailCabinValue: 3000 },
];
const trip = lib.buildCasinoTripReport(completed, sessions);
assert.equal(trip.hours.value, 4);
assert.equal(trip.cashResult.value, -100);
assert.equal(trip.hourlyWinLoss.value, -25);
assert.equal(trip.hourlyWinLoss.source, 'actual');
assert.equal(trip.actualVsTheoretical.value, 3.57);
assert.match(trip.freePlayOutcomeProxy.explanation, /limited proxy/i);
assert.match(trip.trueCruiseCasinoRoi.explanation, /not a gambling-profit claim/i);

const snapshot = lib.buildCasinoRelationshipSnapshot({ cruises: [completed, future], sessions, offers, currentPoints: 23963, now: new Date('2026-08-21T12:00:00Z') });
assert.equal(snapshot.pointsPace.nextTier, 'Signature');
assert.equal(snapshot.pointsPace.pointsToNextTier, 1038);
assert.equal(snapshot.tierSimulation[2].projectedTier, 'Signature');
assert.equal(snapshot.playerWorth.offeredValue.value, 5100);
assert.match(snapshot.playerWorth.warning, /cannot know/i);
assert.equal(snapshot.offerResponse[1].subsequentOfferInstances, 2);
assert.equal(snapshot.offerResponse[1].source, 'estimated');
assert.match(snapshot.offerResponse[1].explanation, /does not claim/i);

const screen = fs.readFileSync(path.join(root, 'app/casino/relationship-intelligence.tsx'), 'utf8');
for (const phrase of ['Hourly win/loss', 'Casino trip reports', 'Tier progress simulator', 'Certificate threshold economics', 'Actual vs theoretical', 'Comp reinvestment', 'FreePlay outcome proxy', 'True cruise casino ROI', 'Casino cost per night', 'Historical offer response', 'Offer value, use & attribution', 'WHAT AM I WORTH?', 'Easy Seas Casino Intelligence']) assert.match(screen, new RegExp(phrase, 'i'));
assert.match(screen, /Shared marketing codes are never collapsed or guessed/);
assert.match(fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8'), /casino-relationship-intelligence/);
const agent = fs.readFileSync(path.join(root, 'state/AgentXProvider.tsx'), 'utf8');
assert.match(agent, /buildCasinoRelationshipSnapshot/);
assert.match(agent, /casino-relationship-intelligence/);
assert.match(agent, /Saved certificate threshold recommendation/);
console.log('PASS build416_casino_relationship_intelligence_regression');
