const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const { getCanonicalCruiseCabinLabel, formatGuestEligibility } = loadTs('lib/cruiseRecordIntegrity.ts');

assert.equal(getCanonicalCruiseCabinLabel({ cabinType: 'ocean view' }), 'Oceanview');
assert.equal(getCanonicalCruiseCabinLabel({ stateroomType: 'B', stateroomNumber: 'GTY' }), 'Balcony · GTY');
assert.equal(getCanonicalCruiseCabinLabel({ cabinType: 'Grand Suite', guests: 2 }), 'Grand Suite');
assert.equal(getCanonicalCruiseCabinLabel({ stateroomCategoryCode: '4V' }), 'Category 4V');
assert.equal(getCanonicalCruiseCabinLabel({ gty: true }), 'GTY · Stateroom category not supplied');
assert.equal(getCanonicalCruiseCabinLabel({}), null);
assert.equal(formatGuestEligibility({ guestsInfo: 'single occupancy' }), '1 Guest');
assert.equal(formatGuestEligibility({ guests: 2 }), '2 Guests');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const card = read('components/CruiseCard.tsx');
const offers = read('app/offer-details.tsx');
const cruises = read('app/(tabs)/scheduling.tsx');
const booked = read('app/(tabs)/booked.tsx');
const casino = read('components/casino/CasinoCommandCenter.tsx');

for (const [name, source] of [['Offers', offers], ['Cruises', cruises], ['Booked', booked], ['Casino', casino]]) {
  assert.match(source, /<CruiseCard/, `${name} must render the shared canonical cruise card.`);
}
assert.match(card, /getCanonicalCruiseCabinLabel\(cruise\)/, 'Every shared card must resolve cabin data into one canonical field.');
assert.doesNotMatch(card, /miniEnrichmentLabel}>Type:/, 'Cabin type must not be repeated in a second enrichment position.');
assert.match(offers, /cabinType: item\.cabinType \|\| eligibleCabinLabel/, 'Offer rows must preserve their row-specific cabin entitlement.');
assert.match(offers, /guests: getCruiseGuestEligibility\(item\) \?\? offerGuestTruth\.value/, 'Offer rows must preserve row-specific guest entitlement.');
assert.match(cruises, /physicalCruise[\s\S]*?<CruiseCard[\s\S]*?relatedOfferOptionCount=\{slot\.offers\.length\}/, 'Back-to-back results must show their constituent canonical cruise cards.');
assert.match(cruises, /Build Operational Trip Plan/, 'The back-to-back redesign must preserve operational planning.');

console.log('Build 445 canonical cruise card, cabin, guest, and back-to-back contract passed.');
