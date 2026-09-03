const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const seasons = loadTs('lib/casino/casinoProgramSeasons.ts');
const identity = loadTs('lib/casino/casinoCruiseIdentity.ts');
const truth = loadTs('lib/casino/casinoTruthEngine.ts', {
  './casinoProgramSeasons': seasons,
  './casinoCruiseIdentity': identity,
});
const dashboardEngine = loadTs('lib/casino/casinoDashboardMetrics.ts');

const baseCruise = {
  id: 'item-30',
  ownerProfileId: 'owner-a',
  reservationNumber: 'ABC123',
  shipName: 'Icon of the Seas',
  sailDate: '2026-08-15',
  returnDate: '2026-08-22',
  nights: 7,
  brand: 'royal',
  sourceAuthority: 'user_entered',
  pointsEarned: 3_275,
  earnedPoints: 3_000,
  casinoPoints: 0,
  cashResult: 950,
  coinIn: 16_375,
  theoreticalLoss: 1_310,
  hoursPlayed: 16,
  ratedGamingDays: 4,
  instantCertificateOfferCode: '2608C04',
  instantCertificateValue: 2_400,
  retailValue: 4_000,
  amountPaid: 200,
  itinerary: [
    { day: 1, port: 'Miami', isSeaDay: false },
    { day: 2, port: 'At Sea', isSeaDay: true },
    { day: 3, port: 'Cozumel', isSeaDay: false },
    { day: 4, port: 'At Sea', isSeaDay: true },
  ],
};

const row = truth.buildCasinoCruiseTruth({
  cruise: baseCruise,
  sessions: [{ id: 'partial', cruiseId: 'item-30', date: '2026-08-16', durationMinutes: 60, pointsEarned: 100, cashIn: 100, cashOut: 120, recordKind: 'actual' }],
  certificates: [{ certificateCode: '2608C04', tradeInValue: 1_800, cruiseId: 'item-30' }],
  pointsPerHourFallback: 400,
  houseEdgeFallback: 0.08,
});

assert.equal(row.points.value, 3_275, 'raw saved cruise points must beat partial sessions and certificate thresholds');
assert.equal(row.points.kind, 'user_entered');
assert.equal(row.netGamingResult.value, 950, 'raw saved cruise win/loss must beat partial sessions');
assert.equal(row.hours.value, 1, 'actual timed sessions remain actual play-hour evidence when present');
assert.equal(row.coinIn.value, 16_375);
assert.equal(row.theoreticalLoss.value, 1_310);
assert.equal(row.ratedGamingDays, 4);
assert.equal(row.certificateCreatedValue.value, 2_400, 'saved cruise certificate value must beat linked fallback value');
assert.equal(row.certificateCreatedValue.kind, 'user_entered');

const thresholdOnly = truth.buildCasinoCruiseTruth({
  cruise: { ...baseCruise, id: 'threshold-only', reservationNumber: 'THRESHOLD', pointsEarned: undefined, earnedPoints: undefined, casinoPoints: undefined, cashResult: undefined, coinIn: undefined, theoreticalLoss: undefined, hoursPlayed: undefined, instantCertificateValue: undefined },
  certificates: [],
  pointsPerHourFallback: 400,
  houseEdgeFallback: 0.08,
});
assert.equal(thresholdOnly.points.value, 3_000);
assert.equal(thresholdOnly.points.kind, 'estimated', 'certificate thresholds must never masquerade as actual cruise points');
assert.equal(thresholdOnly.certificateCreatedValue.value, null, 'certificate threshold points must not invent certificate dollar value');

const dashboard = dashboardEngine.buildCasinoDashboardMetrics({ truths: [row, thresholdOnly], sessions: [], sessionAnalytics: {} });
assert.equal(dashboard.totalCertificateCreatedValue, 2_400);
assert.equal(dashboard.certificateCreatedValueConfidence, 'actual');
assert.ok(dashboard.totalCasinoAvailabilityHours > 0);
assert.ok(dashboard.adt > 0);

const ui = fs.readFileSync('components/casino/CasinoCommandCenter.tsx', 'utf8');
for (const label of ['Certificate-created value', 'Comp coverage / cash ROI', 'Casino availability', 'Modeled points per play hour', 'Average daily theo']) {
  assert.ok(ui.includes(label), `Casino UI is missing ${label}`);
}
assert.match(ui, /economicsByCruise\.get\(trip\.cruiseId\)/, 'Casino and Booked must join through the same cruise id');
assert.match(ui, /buildCruiseDetailsParams\(cruise, \{ source: 'casino' \}\)/, 'Casino rows must open canonical Booked cruise detail identity');
assert.match(ui, /Certificate-created value uses the saved earned award value once/);

console.log('PASS Build 445 Item 30 Casino calculation precedence, evidence, economics, and certificate-created value.');
