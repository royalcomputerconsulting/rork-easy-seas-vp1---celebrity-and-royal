const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const navigation = loadTs('lib/navigation/cruiseDetails.ts');
const refreshedOfferOption = {
  id: 'new-generation-id',
  inventoryCanonicalKey: 'royal|harmony|2027-01-03|option-13',
  sourceRecordId: 'royal-source-row-981',
  offerSailingKey: 'offer-option-key-981',
  offerInstanceKey: 'royal|instance|13',
  shipName: 'Harmony of the Seas', sailDate: '2027-01-03', returnDate: '2027-01-10', nights: 7,
  offerCode: '2701A04', cabinType: 'Balcony', guests: 2, status: 'available',
};
const siblingOfferOption = {
  ...refreshedOfferOption,
  id: 'sibling-generation-id',
  inventoryCanonicalKey: 'royal|harmony|2027-01-03|option-14',
  sourceRecordId: 'royal-source-row-982',
  offerSailingKey: 'offer-option-key-982',
  offerCode: '2701A05', cabinType: 'Interior', guests: 1,
};

const staleTappedRow = {
  ...refreshedOfferOption,
  id: 'old-generation-id',
  inventoryCanonicalKey: 'old-canonical-key',
};
const offerParams = navigation.buildCruiseDetailsParams(staleTappedRow, { source: 'offer-details' });
assert.equal(navigation.resolveCruiseDetailsRecord([siblingOfferOption, refreshedOfferOption], offerParams), refreshedOfferOption, 'provider source identity must survive generation replacement');

const optionOnlyParams = { shipName: refreshedOfferOption.shipName, sailDate: refreshedOfferOption.sailDate, offerOptionId: 'offer-option-key-982' };
assert.equal(navigation.resolveCruiseDetailsRecord([refreshedOfferOption, siblingOfferOption], optionOnlyParams), siblingOfferOption, 'offer-option identity must preserve cabin/guest row distinctions');

const firstReservation = {
  id: 'booking-a', reservationNumber: 'RES-A', bookingId: 'BWO-A', ownerProfileId: 'primary',
  shipName: 'Harmony of the Seas', sailDate: '2027-01-03', returnDate: '2027-01-10', nights: 7, status: 'booked',
};
const secondReservation = { ...firstReservation, id: 'booking-b', reservationNumber: 'RES-B', bookingId: 'BWO-B' };
const bookedParams = navigation.buildCruiseDetailsParams(firstReservation, { source: 'booked' });
assert.equal(navigation.resolveCruiseDetailsRecord([secondReservation, firstReservation], bookedParams), firstReservation, 'multiple reservations on the same physical voyage must remain distinct');
assert.equal(navigation.resolveCruiseDetailsRecord([firstReservation, secondReservation], { shipName: firstReservation.shipName, sailDate: firstReservation.sailDate }), undefined, 'ambiguous material evidence must never choose a random reservation');

const calendarParams = navigation.buildCruiseDetailsParams(firstReservation, { source: 'calendar' });
assert.equal(navigation.resolveCruiseDetailsRecord([firstReservation, secondReservation], calendarParams), firstReservation);

const certificateParams = navigation.buildCruiseDetailsParams({
  id: 'certificate-option-1', sourceRecordId: 'certificate-option-1', offerOptionId: 'certificate-option-1',
  shipName: 'Icon of the Seas', sailDate: '2027-05-08', nights: 7, destination: 'Eastern Caribbean',
  departurePort: 'Miami, Florida', cabinType: 'Oceanview', guests: 2, certificateCode: '2705C04', status: 'available',
}, { source: 'certificate' });
assert.equal(navigation.resolveCruiseDetailsRecord([], certificateParams), undefined);
const certificateFallback = navigation.createCruiseDetailsRouteFallback(certificateParams);
assert.equal(certificateFallback.shipName, 'Icon of the Seas');
assert.equal(certificateFallback.nights, 7);
assert.equal(certificateFallback.cabinType, 'Oceanview');
assert.equal(certificateFallback.stateroomType, 'Oceanview');
assert.equal(certificateFallback.guests, 2);
assert.equal(certificateFallback.offerCode, '2705C04');
assert.equal(certificateFallback.isRouteEvidenceFallback, true);
assert.equal(certificateFallback.dataConfidence, 'partial');

const structuredItineraryParams = navigation.buildCruiseDetailsParams({
  id: 'structured-itinerary', shipName: 'Utopia of the Seas', sailDate: '2027-06-01',
  itinerary: [{ day: 1, port: 'Port Canaveral' }], destination: 'Bahamas',
});
assert.notEqual(structuredItineraryParams.itineraryName, '[object Object]', 'structured itinerary rows must never leak into a route label');

const agentPath = navigation.buildCruiseDetailsPath(refreshedOfferOption, { source: 'agent-sea' });
const agentUrl = new URL(agentPath, 'https://easyseas.local');
assert.equal(agentUrl.searchParams.get('sourceRecordId'), refreshedOfferOption.sourceRecordId);
assert.equal(agentUrl.searchParams.get('offerOptionId'), refreshedOfferOption.offerSailingKey);
assert.equal(agentUrl.searchParams.get('shipName'), refreshedOfferOption.shipName);
assert.equal(navigation.resolveCruiseDetailsRecord([siblingOfferOption, refreshedOfferOption], Object.fromEntries(agentUrl.searchParams)), refreshedOfferOption);

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const details = read('app/(tabs)/(overview)/cruise-details.tsx');
const offerDetails = read('app/offer-details.tsx');
const cruises = read('app/(tabs)/scheduling.tsx');
const booked = read('app/(tabs)/booked.tsx');
const calendar = read('app/day-agenda.tsx');
const certificates = read('app/certificate-summary-results.tsx');
const agent = read('lib/askMyData.ts');
const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');

assert.match(details, /createCruiseDetailsRouteFallback\(routeParams\)/);
assert.match(details, /cruise-details-route-evidence-fallback/);
for (const [name, source] of Object.entries({ offerDetails, cruises, booked, calendar, certificates })) {
  assert.match(source, /buildCruiseDetailsParams/, `${name} must use the canonical route builder`);
}
assert.match(agent, /buildCruiseDetailsPath\(cruise, \{ source: 'agent-sea' \}\)/);
assert.match(repository, /sourceRecordId\?: string/);
assert.match(repository, /offerInstanceKey\?: string/);
assert.match(repository, /inventory\.source_identity=\?/);
assert.match(offerDetails, /offerDetailViewStateCache/);
assert.match(offerDetails, /scrollToOffset/);
assert.match(cruises, /schedulingViewStateCache/);
assert.match(cruises, /scrollToOffset/);

console.log('PASS Build 445 Item 3: Offers, available Cruises, Booked, certificates, Calendar, and Agent SEA resolve one canonical detail contract; stale generations and duplicate reservations remain safe');
