const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('app/(tabs)/(overview)/index.tsx', 'utf8');

for (const field of ['expiry', 'cabin', 'guests', 'minimumValue', 'source']) {
  assert.ok(source.includes(`${field}:`), `Offer filter state must include ${field}`);
}
for (const label of ['Expiration', 'Cabin entitlement', 'Guests', 'Minimum recorded value', 'Source']) {
  assert.ok(source.includes(`>${label}<`), `Offer filter sheet must show ${label}`);
}
for (const control of ['offers-filter-sheet', 'offers-filter-clear-all', 'offers-filter-apply']) {
  assert.ok(source.includes(control), `Offer filter sheet must expose ${control}`);
}
assert.match(source, /sortedOffers\.length\.toLocaleString\(\).*groupedOffers\.length\.toLocaleString\(\).*offers/);
assert.match(source, /setOfferFilters\(DEFAULT_OFFER_FILTERS\)/);
assert.match(source, /keyboardShouldPersistTaps="always"/);
assert.match(source, /<IntelligenceFilterStrip[\s\S]*?showTitle=\{false\}/, 'Owner, brand, and program filters must remain in the single Filter offers section.');

console.log('PASS Build 445 Offers filter sheet covers owner, program, expiry, cabin, guests, value, source, result count, Apply, and Clear All.');
