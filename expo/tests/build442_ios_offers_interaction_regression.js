const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const offerIntelligenceSource = fs.readFileSync(path.join(root, 'lib/offerIntelligence.ts'), 'utf8');
const tabLayoutSource = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const offersSource = fs.readFileSync(path.join(root, 'app/(tabs)/(overview)/index.tsx'), 'utf8');

assert.match(offerIntelligenceSource, /MAX_OFFER_PLANNING_SAMPLE_SIZE = 24/);
assert.match(offerIntelligenceSource, /getRepresentativeCruiseSample/);
assert.match(offerIntelligenceSource, /counts and financial values still use the full catalog/);
assert.doesNotMatch(offersSource, /if \(coreLoading\).*ActivityIndicator/s, 'Offers must not replace the tab navigator with a blocking loader');
for (const route of ['(overview)', 'scheduling', 'booked', 'events', 'analytics', 'machines', 'settings']) {
  assert.ok(tabLayoutSource.includes(`name="${route}"`), `iOS tab route missing: ${route}`);
}

const { buildCommandCenterBuckets } = loadTs('lib/offerIntelligence.ts');
const offers = Array.from({ length: 13 }, (_, index) => ({
  id: `ios-offer-${index}`,
  offerCode: `IOS${index}`,
  offerName: `iOS offer ${index}`,
  expiryDate: '2026-09-20',
  brand: 'royal',
  status: 'active',
}));
const cruises = Array.from({ length: 3151 }, (_, index) => ({
  id: `ios-sailing-${index}`,
  offerCode: `IOS${index % offers.length}`,
  shipName: `iOS Ship ${index % 8}`,
  sailDate: '2026-10-01',
  returnDate: '2026-10-08',
  nights: 7,
  destination: 'Caribbean',
  departurePort: 'Miami',
  itinerary: [
    { day: 1, port: 'Miami', type: 'port' },
    { day: 2, port: 'At Sea', type: 'sea' },
    { day: 3, port: 'Nassau', type: 'port' },
  ],
  guests: 2,
  cabinType: 'Balcony',
}));

const startedAt = Date.now();
const buckets = buildCommandCenterBuckets(offers, cruises, [], null);
const elapsedMs = Date.now() - startedAt;
const scoredOffers = buckets.flatMap((bucket) => bucket.offers);

assert.equal(scoredOffers.length, 13, 'All 13 offers must remain available after bounded planning analysis');
assert.ok(elapsedMs < 1000, `3,151-sailing Offers analysis blocked the interaction budget: ${elapsedMs}ms`);
assert.ok(
  scoredOffers.every((item) => item.intelligence.reasons.some((reason) => reason.includes('representative sample of 24'))),
  'Large offer groups must disclose that planning-only factors use a representative sample',
);

console.log(`PASS Build 442 iOS Offers interaction: 13 offers / 3,151 sailings scored in ${elapsedMs}ms without dropping full counts`);
