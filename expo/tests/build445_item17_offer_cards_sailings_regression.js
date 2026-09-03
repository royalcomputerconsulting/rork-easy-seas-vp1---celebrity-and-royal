const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');
const card = read('components/CasinoOfferCard.tsx');
const details = read('app/offer-details.tsx');
const offers = read('app/(tabs)/(overview)/index.tsx');
const cruiseCard = read('components/CruiseCard.tsx');

// The one shared offer card must carry the complete decision set and its evidence.
for (const contract of [
  'Casino offer',
  'offerName',
  'offerCode',
  'expiryDate',
  'Points level',
  'Guests',
  'Stateroom',
  'Est. stateroom value',
  'cruiseCountLabel',
  'Planning score',
  'casino-offer-card.provenance',
]) {
  assert.ok(card.includes(contract), `The canonical offer card must show ${contract}.`);
}
assert.match(card, /getUniqueImageForCruise/);
assert.match(card, /style=\{styles\.heroImage\}/);
assert.match(card, /backgroundColor: '#FFFFFF'/);

// Offer details reuse the exact cruise card used in discovery and booked flows.
assert.match(details, /import \{ CruiseCard \} from '@\/components\/CruiseCard'/);
assert.match(details, /<CruiseCard[\s\S]*?mini[\s\S]*?showRetailValue/);
assert.match(read('app/(tabs)/scheduling.tsx'), /<CruiseCard/);
assert.match(read('app/(tabs)/booked.tsx'), /<CruiseCard/);
for (const field of ['class', 'point level', 'Guest', 'GTY', 'NextCruise bonus', 'modeled golden hours', 'modeled casino points', 'Source:']) {
  assert.ok(cruiseCard.includes(field), `The shared cruise card must retain ${field}.`);
}

// Large offer inventories remain bounded, clickable, searchable, and fully filterable.
assert.match(details, /const OFFER_VISIBLE_PAGE_SIZE = 20/);
assert.match(details, /data=\{pagedOfferCruises\}/);
assert.match(details, /Previous 20 eligible sailings/);
assert.match(details, /Next 20 eligible sailings/);
for (const field of ['ships', 'shipClasses', 'cabins', 'guestCounts', 'departurePorts', 'dateFrom', 'dateTo', 'minNights', 'maxNights', 'gty', 'nextCruiseBonus']) {
  assert.ok(details.includes(field), `Offer sailing filters must include ${field}.`);
}
assert.match(details, /cruise\.itineraryName/);
assert.match(details, /cruise\.portsAndTimes/);
assert.match(details, /Clear all filters/);
assert.match(details, /eligibleRowsLoaded\.toLocaleString\(\).*eligible sailings/);

// Every requested action has a concrete handler rather than a decorative control.
for (const action of ['view', 'decode', 'compare', 'archive', 'skip']) {
  assert.ok(offers.includes(`handleCommandCenterAction('${action}', item)`), `Command-center ${action} must be wired.`);
}
for (const testId of [
  'casino-offer-card.view-all-cruises',
  'casino-offer-card.decode-offer',
  'casino-offer-card.view-pdf-of-offer',
]) {
  assert.ok(card.includes(testId), `${testId} must remain actionable.`);
}
for (const testId of ['offer-details-should-i-book', 'offer-mark-in-progress', 'offer-mark-used', 'offer-list-retry']) {
  assert.ok(details.includes(testId), `${testId} must remain actionable.`);
}

// The detail story card uses the same neutral premium anatomy, not the former blue gradient.
assert.match(details, /colors=\{\['#FFFFFF', '#F8FAFB', '#F3F3F2'\]\}/);
assert.doesNotMatch(details, /colors=\{\['#E0F2FE', '#DBEAFE', '#E0F7FA'\]\}/);

console.log('PASS build445_item17_offer_cards_sailings_regression');
