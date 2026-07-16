const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');

const {
  INSTANT_CERTIFICATE_POINT_LADDER,
  buildCertificateMonthCode,
  getNextMonthCertificateTargets,
} = loadTs('lib/certificates/instantCertificateUrls.ts');
const { buildCertificateChaseRecommendation } = loadTs('lib/certificates/certificateChaseRecommendation.ts');
const { buildLedgerFromCruise } = loadTs('lib/value/cruiseValueLedger.ts');

assert.deepStrictEqual(
  {
    points1500: INSTANT_CERTIFICATE_POINT_LADDER['06'],
    points2000: INSTANT_CERTIFICATE_POINT_LADDER['05'],
    points4000: INSTANT_CERTIFICATE_POINT_LADDER['03A'],
    points6500: INSTANT_CERTIFICATE_POINT_LADDER['03'],
    points9000: INSTANT_CERTIFICATE_POINT_LADDER['02A'],
    points15000: INSTANT_CERTIFICATE_POINT_LADDER['02'],
    points25000: INSTANT_CERTIFICATE_POINT_LADDER['01'],
  },
  {
    points1500: 1500,
    points2000: 2000,
    points4000: 4000,
    points6500: 6500,
    points9000: 9000,
    points15000: 15000,
    points25000: 25000,
  },
  'The Build 314 personal target ladder changed unexpectedly.',
);

assert.strictEqual(buildCertificateMonthCode(new Date(2026, 11, 15)), '2612');
const januaryTargets = getNextMonthCertificateTargets(new Date(2026, 11, 15));
assert.ok(januaryTargets.length > 0 && januaryTargets.every(target => target.monthCode === '2701'), 'December-to-January rollover must remain correct.');

const sessionSource = fs.readFileSync(path.join(root, 'state/CasinoSessionProvider.tsx'), 'utf8');
for (const field of [
  'pointsEarned', 'cashCoinIn', 'freeplayCoinIn', 'coinIn', 'coinOut', 'winLoss',
  'durationMinutes', 'machineId', 'rtp', 'volatility', 'estimatedTheo',
  'estimatedExpectedLoss', 'casinoDay', 'gameCategory', 'pointsSource',
]) {
  assert.ok(sessionSource.includes(field), `CasinoSession compatibility field missing: ${field}`);
}

const ledger = buildLedgerFromCruise({
  id: 'opt0-ledger-fixture',
  offerValue: 1200,
  instantCertificateValue: 2500,
  freePlay: 100,
  nextCruiseCertificateValue: 75,
  voomValue: 210,
  diningValue: 150,
  spaValue: 80,
  taxes: 190,
  amountPaid: 190,
});
const amounts = Object.fromEntries(ledger.map(item => [item.category, item.amount]));
assert.strictEqual(amounts['casino-offer'], 1200);
assert.strictEqual(amounts['instant-certificate'], 2500);
assert.strictEqual(amounts.freeplay, 100);
assert.strictEqual(amounts['nextcruise-obc'], 75);
assert.strictEqual(amounts.internet, 210);
assert.strictEqual(amounts['specialty-dining'], 150);
assert.strictEqual(amounts.spa, 80);
assert.strictEqual(amounts['taxes-fees'], 190);
assert.strictEqual(amounts['cash-paid'], 190);

const genericA = buildCertificateChaseRecommendation({ currentPoints: 3880 });
const genericB = buildCertificateChaseRecommendation({
  currentPoints: 3880,
  personalHistory: [{ points: 9000, result: 3000 }],
  bankrollRemaining: 1,
  remainingCasinoHours: 0,
});
assert.deepStrictEqual(genericB, genericA, 'Legacy chase logic unexpectedly became personalized during OPT-0.');
assert.strictEqual(genericA.nextLevel.pointsRequired, 4000);
assert.strictEqual(genericA.pointsNeeded, 120);
assert.strictEqual(genericA.recommendation, 'light-chase');

const analytics = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
assert.ok(analytics.includes('<BestPlayTodayCard'), 'Analytics route lost Best Play Today wiring.');
assert.ok(analytics.includes('<KeepPlayingDecisionCard'), 'Analytics route lost Keep Playing wiring.');
const keepPlaying = fs.readFileSync(path.join(root, 'components/casino/KeepPlayingDecisionCard.tsx'), 'utf8');
assert.ok(keepPlaying.includes("@/lib/certificates/certificateChaseRecommendation"), 'OPT-0 must retain legacy static recommendation rollback behavior.');

console.log('PASS testOPT0OptimizerBaselineContracts');
