const assert = require('node:assert/strict');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const truth = loadTs('lib/casino/casinoTruthEngine.ts');
const dashboard = loadTs('lib/casino/casinoDashboardMetrics.ts');
const pointTruth = loadTs('lib/casinoPointTruth.ts');
const annual = loadTs('lib/casinoAnnualReportFacts.ts').ANNUAL_CASINO_REPORT_FACTS;

const rawPasted = {
  id: 'raw-pasted', shipName: 'Navigator of the Seas', sailDate: '2025-09-08', returnDate: '2025-09-12', nights: 4,
  cruiseSource: 'royal', casinoProgram: 'clubRoyale', status: 'completed', completionState: 'completed',
  pointsEarned: 0, earnedPoints: 976, casinoPoints: 600, calculationConfidence: 'estimated',
  instantCertificateOfferCode: '2509A09', notes: 'Raw pasted per-cruise points; annual reconciliation remains separate.',
};
const rawTruth = truth.buildCasinoCruiseTruth({ cruise: rawPasted, pointsPerHourFallback: 400, houseEdgeFallback: 0.08 });
assert.equal(rawTruth.points.value, 976, 'raw pasted points must beat a certificate floor and a stale zero alias');
assert.equal(rawTruth.points.kind, 'user_entered');
assert.equal(rawTruth.coinIn.value, 4_880, 'Club Royale points produce labeled $5/point modeled volume even without session entry');
assert.equal(rawTruth.theoreticalLoss.value, 390.4);
assert.equal(pointTruth.getBookedCruiseCasinoPoints(rawPasted), 976);

const allocated = { ...rawPasted, id: 'allocated', pointsEarned: 2_099, earnedPoints: 2_099, notes: 'Final user-approved allocation of annual unassigned points.' };
const allocatedTruth = truth.buildCasinoCruiseTruth({ cruise: allocated });
assert.equal(allocatedTruth.points.value, 600, 'explicit reconciliation allocation may yield to certificate evidence');
assert.equal(allocatedTruth.points.kind, 'estimated');

const manual = {
  ...rawPasted,
  id: 'manual',
  pointsEarned: 4_000,
  earnedPoints: 4_000,
  casinoPoints: 4_000,
  calculationConfidence: 'actual',
  notes: 'Manual cruise closeout.',
  itinerary: [
    { day: 1, port: 'Miami', isSeaDay: false },
    { day: 2, port: 'At Sea', isSeaDay: true },
    { day: 3, port: 'Nassau', isSeaDay: false },
    { day: 4, port: 'Miami', isSeaDay: false },
  ],
};
const manualTruth = truth.buildCasinoCruiseTruth({
  cruise: manual,
  sessions: [{ id: 'partial', cruiseId: 'manual', date: '2025-09-09', pointsEarned: 100, durationMinutes: 30, recordKind: 'actual' }],
  pointsPerHourFallback: 400,
  houseEdgeFallback: 0.08,
});
assert.equal(manualTruth.points.value, 4_000, 'partial sessions must never replace final cruise points');
assert.equal(manualTruth.hours.value, 0.5, 'actual session time remains separately authoritative when supplied');
assert.equal(manualTruth.seaDays, 1);
assert.equal(manualTruth.portDays, 3);
assert.equal(manualTruth.casinoAvailabilityHours, 34);
assert.equal(manualTruth.ratedGamingDays, 4);

const metrics = dashboard.buildCasinoDashboardMetrics({
  truths: [rawTruth],
  sessions: [],
  sessionAnalytics: { actualSessionCount: 0, ratedGamingDays: 0 },
});
assert.equal(metrics.adt, 390.4 / 4);
assert.equal(metrics.adtConfidence, 'estimated');

assert.equal(annual.length, 21);
assert.equal(annual.reduce((sum, row) => sum + row.nights, 0), 106);
assert.equal(annual.reduce((sum, row) => sum + row.retailValue, 0), 47_774);
assert.equal(annual.reduce((sum, row) => sum + row.amountPaid, 0), 4_238.41);
assert.equal(annual.reduce((sum, row) => sum + row.winningsBroughtHome, 0), 19_457);
assert.equal(annual.reduce((sum, row) => sum + row.pointsEarned, 0), 34_537, 'per-cruise rows retain raw pasted points');
assert.equal(annual.reduce((sum, row) => sum + (row.annualReconciliationPoints ?? 0), 0), 24_143);
assert.equal(34_537 + 24_143, 58_680);
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2025_POINTS, 58_680, 'annual account reconciliation remains separate');
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2025_COIN_IN, 293_400);
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2025_WINNINGS_HOME, 19_457);
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2025_NET_CASH_RESULT, 15_218.59);

console.log('Build 440 raw points, ADT, theoretical, value, and annual reconciliation regression passed.');
