const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const {
  resolveOfferCabinEntitlement,
  resolveOfferGuestEntitlement,
  resolveOfferPointRequirement,
} = loadTs('lib/offers/offerDisplayTruth.ts');
const { normalizeOfferValue } = loadTs('lib/offers/offerValueNormalization.ts');

const baseSailing = {
  id: 'row-1', shipName: 'Icon of the Seas', sailDate: '2026-09-12', returnDate: '2026-09-19',
  departurePort: 'Miami, Florida', destination: 'Eastern Caribbean', nights: 7, status: 'available',
};

assert.equal(
  resolveOfferPointRequirement({ offerCode: '2609A04', pointsRequired: 4321 }, []).value,
  4321,
  'An explicit offer point field must beat decoded certificate-code points',
);
assert.equal(
  resolveOfferPointRequirement({ offerCode: '2609A04' }, [{ ...baseSailing, pointLevel: 2750 }]).value,
  2750,
  'An explicit eligible-row point field must beat decoded certificate-code points',
);
assert.equal(resolveOfferPointRequirement({ offerCode: '2609A04' }, []).value, 3000);
assert.equal(
  resolveOfferPointRequirement({ offerCode: '2609A04' }, [
    { ...baseSailing, pointLevel: 2000 },
    { ...baseSailing, id: 'row-2', pointLevel: 3000 },
  ]).label,
  'Varies by sailing',
);

const mixedCabins = [
  { ...baseSailing, cabinType: 'Balcony' },
  { ...baseSailing, id: 'row-2', cabinType: 'Grand Suite' },
];
assert.equal(resolveOfferCabinEntitlement({ roomType: 'Balcony' }, mixedCabins).label, 'Varies by sailing');
assert.equal(resolveOfferCabinEntitlement(undefined, [{ ...baseSailing, cabinType: 'Oceanview' }]).label, 'Oceanview');

const mixedGuests = [
  { ...baseSailing, guestsInfo: '1 guest' },
  { ...baseSailing, id: 'row-2', guestsInfo: '2 guests' },
];
assert.equal(resolveOfferGuestEntitlement(undefined, mixedGuests).label, 'Varies by sailing');
assert.equal(resolveOfferGuestEntitlement(undefined, [{ ...baseSailing, guestsInfo: '2 guests' }]).label, '2 guests');

const providerValue = normalizeOfferValue({
  id: 'offer-provider-value', offerCode: '2609A04', value: 2400, roomType: 'Balcony', freePlay: 100,
}, [{ ...baseSailing, cabinType: 'Balcony', balconyPrice: 750 }]);
assert.equal(providerValue.faceValue.value, 2400, 'Provider offer value must remain distinct from cabin retail');
assert.equal(providerValue.faceValue.evidence, 'provider');
assert.equal(providerValue.components.cabinRetail.value, 1500, 'Per-person sailing price must be shown as full-room retail');
assert.equal(providerValue.components.cabinRetail.evidence, 'derived');

const pricedRows = [500, 1000, 1500].map((balconyPrice, index) => ({
  ...baseSailing, id: `priced-${index}`, cabinType: 'Balcony', balconyPrice,
}));
const derived = normalizeOfferValue({ id: 'offer-derived', offerCode: '2609A04', roomType: 'Balcony' }, pricedRows);
assert.deepEqual(derived.cabinRetailRange, { minimum: 1000, median: 2000, maximum: 3000 });
assert.equal(derived.components.cabinRetail.value, 2000);
assert.match(derived.components.cabinRetail.explanation, /alternatives are never summed/);

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const card = read('components/CasinoOfferCard.tsx');
const details = read('app/offer-details.tsx');
assert.match(card, /resolveOfferPointRequirement/);
assert.match(card, /resolveOfferCabinEntitlement/);
assert.match(card, /resolveOfferGuestEntitlement/);
assert.match(card, /Provider offer value/);
assert.match(card, /Est\. stateroom value/);
assert.match(card, /casino-offer-card\.provenance/);
assert.doesNotMatch(card, /aggregateTotalValue/);
assert.doesNotMatch(card, /totalCabinValue \+=/);
assert.match(details, /offer-details-entitlement-truth/);
assert.match(details, /Provider value/);
assert.match(details, /Est\. stateroom value/);
assert.match(details, /OFFER_VISIBLE_PAGE_SIZE = 20/);
assert.match(details, /data=\{pagedOfferCruises\}/);

console.log('PASS Build 445 Item 6: points, cabin, guests, provider value, and full-room sailing value remain truthful and provenance-labeled on cards and details');
