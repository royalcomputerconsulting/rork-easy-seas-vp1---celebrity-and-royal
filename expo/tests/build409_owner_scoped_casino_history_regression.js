const assert = require('node:assert/strict');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const facts = loadTs('lib/casinoAnnualReportFacts.ts').ANNUAL_CASINO_REPORT_FACTS;
const history = loadTs('lib/casino/ownerScopedCasinoHistory.ts');
const pointTruth = loadTs('lib/casinoPointTruth.ts');
const economics = loadTs('lib/casinoCruiseEconomics.ts');

const empty = history.applyOwnerScopedCasinoHistoryToCruises([]);
assert.deepEqual(empty, [], 'an empty account must remain empty');

const unrelated = history.applyOwnerScopedCasinoHistory({
  id: 'other-passenger', shipName: 'Harmony of the Seas', sailDate: '2025-04-20', returnDate: '2025-04-27', nights: 7,
  status: 'completed', guestNames: ['Another Passenger'],
});
assert.equal(unrelated.pointsEarned, undefined, 'same sailing must not leak Scott history to another owner');
assert.equal(unrelated.casinoHistoryImportId, undefined);

const existing = facts.map((fact) => ({
  id: `saved-${fact.sailDate}-${fact.ship}`, shipName: fact.ship, sailDate: fact.sailDate, returnDate: fact.returnDate,
  nights: fact.nights, status: 'completed', completionState: 'completed', brand: 'Royal Caribbean', cruiseSource: 'royal',
  guestNames: ['Scott Merlis'],
}));
const migrated = history.applyOwnerScopedCasinoHistoryToCruises(existing);
assert.equal(migrated.length, 21, 'migration enriches existing cruise rows and never creates extras');
assert.equal(migrated.reduce((sum, row) => sum + row.pointsEarned, 0), 34537);
assert.equal(migrated.reduce((sum, row) => sum + row.retailValue, 0), 47774);
assert.equal(Math.round(migrated.reduce((sum, row) => sum + row.amountPaid, 0) * 100) / 100, 4238.41);
assert.equal(Math.round(migrated.reduce((sum, row) => sum + row.winningsBroughtHome, 0)), 19457);
assert.equal(history.hasCompleteOwnerScopedAnnualCasinoHistory(migrated), true);
assert.deepEqual(history.applyOwnerScopedCasinoHistoryToCruises(migrated), migrated, 'migration is idempotent');

const manual = history.applyOwnerScopedCasinoHistory({ ...existing[0], pointsEarned: 9999, earnedPoints: 9999, casinoPoints: 9999, winningsBroughtHome: 1234 });
assert.equal(manual.pointsEarned, 9999, 'manual cruise points win');
assert.equal(manual.winningsBroughtHome, 1234, 'manual cruise result wins');

const normalizedManual = pointTruth.normalizeCruiseCasinoPerformance({
  id: 'manual-current', shipName: 'Quantum of the Seas', sailDate: '2026-04-07', returnDate: '2026-04-10', nights: 3,
  status: 'completed', completionState: 'completed', brand: 'Royal Caribbean', cruiseSource: 'royal', guestNames: ['Scott Merlis'],
  pointsEarned: 875, earnedPoints: 875, casinoPoints: 875, winningsBroughtHome: 1100,
});
assert.equal(normalizedManual.pointsEarned, 875, 'current-season known fact must not overwrite an app/manual edit');
assert.equal(normalizedManual.winningsBroughtHome, 1100);

const reconciliation = history.getAnnualCasinoPointsReconciliation(migrated);
assert.deepEqual(reconciliation, { isComplete: true, cruiseAllocatedPoints: 34537, confirmedAnnualPoints: 58680, unallocatedPoints: 24143 });
const summary = economics.buildCruiseEconomicsSummary(migrated, new Date('2026-08-23T12:00:00Z'), { useKnownAnnualReportFacts: true });
assert.equal(summary.totals.totalPoints, 58680);
assert.equal(summary.totals.totalCoinIn, 293400);
assert.match(summary.footnotes.join(' '), /24,143/);
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2026_POINTS, 24631, 'current season account total is not the four-Quantum subset');

const currentSubset = pointTruth.KNOWN_CURRENT_CLUB_ROYALE_CRUISES.reduce((sum, row) => sum + row.pointsEarned, 0);
assert.equal(currentSubset, 6660);
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2026_POINTS - currentSubset, 17971, 'newer saved cruise records and reconciliation account for the balance');

const discrepancy = pointTruth.buildClubRoyaleDiscrepancy(6660, 0);
assert.equal(discrepancy.appPoints, 6660);
assert.equal(discrepancy.difference, 6660);
assert.match(discrepancy.message, /Saved app and manual per-cruise points remain authoritative/);

console.log('PASS build409 owner-scoped casino history, exact totals, isolation, idempotence, and manual precedence');
