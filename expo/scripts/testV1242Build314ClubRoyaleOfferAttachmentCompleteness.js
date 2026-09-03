const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');
const { reconcileOfferCruiseAttachments, applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');
function assert(condition, message) { if (!condition) throw new Error(message); }

const fixture = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/clubRoyale/offer-sailing-cardinality.json'), 'utf8'));
const offers = fixture.offers.map((spec, index) => ({
  id: `offer-${index + 1}`,
  offerCode: spec.offerCode,
  offerName: `Test Offer ${index + 1}`,
  title: `Test Offer ${index + 1}`,
  offerType: 'comped',
  offerSource: 'royal',
  cruiseIds: [`stale-${index + 1}`],
  expires: '2027-01-31',
  status: 'active',
}));
const ships = ['Icon of the Seas', 'Star of the Seas', 'Wonder of the Seas', 'Harmony of the Seas', 'Symphony of the Seas'];
const cruises = [];
for (let offerIndex = 0; offerIndex < fixture.offers.length; offerIndex += 1) {
  const spec = fixture.offers[offerIndex];
  for (let rowIndex = 0; rowIndex < spec.rowCount; rowIndex += 1) {
    // The first row under every offer intentionally uses the same ship/date; separate offer
    // codes must remain separate eligibility relationships.
    const dateOrdinal = rowIndex === 0 ? 0 : offerIndex * 500 + rowIndex;
    const base = new Date(Date.UTC(2027, 0, 1));
    base.setUTCDate(base.getUTCDate() + dateOrdinal);
    const returnDate = new Date(base); returnDate.setUTCDate(returnDate.getUTCDate() + 7);
    cruises.push({
      id: `sailing-${offerIndex + 1}-${rowIndex + 1}`,
      shipName: rowIndex === 0 ? 'Icon of the Seas' : ships[(offerIndex + rowIndex) % ships.length],
      sailDate: base.toISOString().slice(0, 10),
      returnDate: returnDate.toISOString().slice(0, 10),
      departurePort: 'Test Port', destination: `Test Destination ${rowIndex % 9}`, nights: 7,
      cabinType: rowIndex % 2 === 0 ? 'Balcony' : 'Oceanview',
      itineraryName: `Test Itinerary ${rowIndex % 11}`,
      offerCode: spec.offerCode,
      offerName: `Test Offer ${offerIndex + 1}`,
      offerExpiry: '2027-01-31',
      status: 'available', cruiseSource: 'royal', offerSource: 'royal', brand: 'royal',
    });
  }
}
assert(cruises.length === fixture.totalEligibilityRows, 'Fixture generator must create all 1,467 eligibility rows.');

const originalLog = console.log;
console.log = () => {};
let direct;
try { direct = reconcileOfferCruiseAttachments(offers, cruises); } finally { console.log = originalLog; }
assert(direct.offers.length === 4, 'All four offers must remain after attachment reconciliation.');
assert(direct.audit.totalRelationships === 1467, 'All 1,467 offer-to-sailing relationships must remain represented.');
assert(direct.audit.danglingIdsRemoved === 4, 'Four intentionally stale IDs must be removed.');
assert(direct.audit.offersWithoutSailings.length === 0, 'No captured offer may lose all sailings.');
for (let index = 0; index < fixture.offers.length; index += 1) {
  assert(direct.offers[index].cruiseIds.length === fixture.offers[index].rowCount, `Offer ${fixture.offers[index].offerCode} attachment count mismatch.`);
}

const preview = {
  offers: { new: offers, updates: [], unchanged: [] },
  cruises: { new: cruises, updates: [], unchanged: [] },
  bookedCruises: { new: [], updates: [], unchanged: [] },
  loyalty: null,
};
console.log = () => {};
let firstApply;
try {
firstApply = applySyncPreview(preview, [], [], [], 'royal', {
  allowOfferRemoval: true, allowCruiseRemoval: true, allowBookedCruiseRemoval: false,
});
} finally { console.log = originalLog; }
assert(firstApply.offers.length === 4, 'Apply Sync must retain all four offers.');
assert(firstApply.cruises.length === 1467, 'Apply Sync must retain all 1,467 distinct offer-sailing rows.');
assert(firstApply.offers.reduce((sum, offer) => sum + (offer.cruiseIds || []).length, 0) === 1467, 'Apply Sync must rebuild all attachments after canonical IDs are finalized.');
assert(firstApply.cruises.filter(row => row.shipName === 'Icon of the Seas' && row.sailDate === '2027-01-01').length === 4, 'Same physical sailing under four different offer codes must remain four eligibility rows.');

const secondPreview = {
  offers: { new: [], updates: firstApply.offers.map(offer => ({ existing: offer, updated: offer })), unchanged: [] },
  cruises: { new: [], updates: firstApply.cruises.map(cruise => ({ existing: cruise, updated: cruise })), unchanged: [] },
  bookedCruises: { new: [], updates: [], unchanged: [] },
  loyalty: null,
};
console.log = () => {};
let secondApply;
try {
secondApply = applySyncPreview(secondPreview, firstApply.offers, firstApply.cruises, [], 'royal', {
  allowOfferRemoval: true, allowCruiseRemoval: true, allowBookedCruiseRemoval: false,
});
} finally { console.log = originalLog; }
assert(secondApply.offers.length === 4, 'Second identical sync must retain four offers.');
assert(secondApply.cruises.length === 1467, 'Second identical sync must retain 1,467 rows without drift.');
assert(secondApply.offers.reduce((sum, offer) => sum + (offer.cruiseIds || []).length, 0) === 1467, 'Second identical sync must retain all attachments.');

const coreDataProvider = fs.readFileSync(path.join(root, 'state/CoreDataProvider.tsx'), 'utf8');
for (const marker of [
  'Available sailing storage readback mismatch',
  'Available sailing reconciliation audit',
  'Casino offer storage readback mismatch',
  'Casino offer reconciliation audit',
  'offerToSailingRelationships',
]) assert(coreDataProvider.includes(marker), `CoreData persistence is missing offer/sailing marker: ${marker}`);
assert(coreDataProvider.includes('setCruisesState(readbackStateRows)'), 'Available-sailing in-memory state must come from verified storage readback.');
assert(coreDataProvider.includes('setCasinoOffersState(readbackOffers)'), 'Offer in-memory state must come from verified storage readback.');

console.log('PASS testV1242Build314ClubRoyaleOfferAttachmentCompleteness');
