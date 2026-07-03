const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const classifier = read('lib/offers/offerCodeClassifier.ts');
const attribution = read('lib/offers/offerAttribution.ts');
const chain = read('lib/casino/certificateEarningChain.ts');
const makeout = read('lib/value/trueMakeout.ts');
const summary = read('lib/analytics/casinoValueAttribution.ts');
const analytics = read('app/(tabs)/analytics.tsx');
const agentx = read('state/AgentXProvider.tsx');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));

assert(classifier.includes("'05': 2000"), 'Instant certificate ladder must include 05 = 2,000 points.');
assert(classifier.includes("'03A': 4000"), 'Instant certificate ladder must include 03A = 4,000 points.');
assert(classifier.includes("offerType: 'marketing-offer'"), 'Non-instant codes must classify as marketing offers.');
assert(classifier.includes('freeplay-perk'), 'FreePlay/OBC perk codes must be separated from cruise certificates.');
assert(attribution.includes('buildBookedCruiseOfferAttribution'), 'Booked cruise offer attribution engine missing.');
assert(read('lib/migration/offerAttributionBackfill.ts').includes('bookingCertificatePointsRequired'), 'Backfill must normalize certificate point requirements.');
assert(chain.includes('Coin-in') || chain.includes('coinIn'), 'Certificate earning chain must track coin-in volume.');
assert(chain.includes('acquisitionCashCost'), 'Certificate earning chain must track cash acquisition cost.');
assert(makeout.includes('Coin-in is volume') || makeout.includes('actualCashCost'), 'True make-out must distinguish coin-in volume from real cost.');
assert(makeout.includes('netMakeout'), 'True make-out engine must calculate netMakeout.');
assert(summary.includes('buildCasinoValueAttributionSummary'), 'Unified casino value attribution summary missing.');

assert(analytics.includes('Portfolio'), 'Casino Portfolio tab label missing.');
assert(analytics.includes('Value'), 'Cruise Value tab label missing.');
assert(analytics.includes('Play'), 'Play Sessions tab label missing.');
assert(analytics.includes('Forecast'), 'Casino Forecasting tab label missing.');
assert(analytics.includes('OfferAttributionLedgerCard'), 'Offer Attribution Ledger not wired into analytics screen.');
assert(analytics.includes('TrueMakeoutLedgerCard'), 'True Make-Out Ledger not wired into analytics screen.');
assert(analytics.includes('CertificateCreatedByPlayCard'), 'Certificate Created by Play card not wired into sessions tab.');
assert(analytics.includes('KeepPlayingDecisionCard'), 'Keep Playing Decision card not wired into forecasting tab.');
assert(analytics.includes('casinoValueAttributionSummary'), 'Analytics screen must build shared attribution summary.');

assert(agentx.includes('offer-attribution-true-makeout'), 'AgentX missing offer attribution / true make-out context block.');
assert(agentx.includes('Coin-in is volume, not cost'), 'AgentX must include coin-in vs cost guardrail.');

assert(pkg.version === '9.11.54', `package.json version should be 9.11.54, got ${pkg.version}`);
assert(app.expo.version === '9.11.54', `app.json expo.version should be 9.11.54, got ${app.expo.version}`);
assert(app.expo.ios.buildNumber === '9.11.54', `iOS buildNumber should be 9.11.54, got ${app.expo.ios.buildNumber}`);
assert(app.expo.android.versionCode === 91154, `Android versionCode should be 91154, got ${app.expo.android.versionCode}`);

console.log('✅ v1062 offer attribution + casino tab restructure checks passed');
