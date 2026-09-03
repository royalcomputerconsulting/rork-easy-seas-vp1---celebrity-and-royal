const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;

assert.equal(app.version, '13.0.61');
assert.equal(String(app.ios.buildNumber), '427');
assert.equal(app.android.versionCode, 130093);

const { USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS } = loadTs('constants/confirmedBookedCruises.ts');
assert.equal(USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.length, 14);
assert.equal(new Set(USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.map((row) => row.bookingId)).size, 14);
assert.equal(new Set(USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.map((row) => `${row.shipName}|${row.sailDate}`)).size, 13);
assert.equal(
  Array.from(new Map(USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.map((row) => [`${row.shipName}|${row.sailDate}|${row.returnDate}`, row])).values())
    .reduce((sum, row) => sum + Number(row.nights || 0), 0),
  86,
);
const icon = USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.find((row) => row.bookingId === '5330038');
assert.deepEqual(
  { shipName: icon.shipName, sailDate: icon.sailDate, returnDate: icon.returnDate, nights: icon.nights, cabinType: icon.cabinType },
  { shipName: 'Icon of the Seas', sailDate: '2026-10-31', returnDate: '2026-11-07', nights: 7, cabinType: 'Interior' },
);
const utopia = USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.find((row) => row.bookingId === '1861386');
assert.deepEqual(
  { shipName: utopia.shipName, sailDate: utopia.sailDate, returnDate: utopia.returnDate, nights: utopia.nights, cabinType: utopia.cabinType, cabinNumber: utopia.cabinNumber },
  { shipName: 'Utopia of the Seas', sailDate: '2026-10-19', returnDate: '2026-10-24', nights: 5, cabinType: 'Ocean View', cabinNumber: '10526' },
);

const { dedupeBookedCruises } = loadTs('lib/dataIdentity.ts');
const sameSailingReservations = USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.filter(
  (row) => row.shipName === 'Harmony of the Seas' && row.sailDate === '2026-09-15',
);
assert.deepEqual(dedupeBookedCruises(sameSailingReservations).map((row) => row.bookingId).sort(), ['3677807', '6748172']);

const { transformBookedCruisesToAppFormat, transformOfferRowsToCruisesAndOffers } = loadTs('lib/royalCaribbean/dataTransformers.ts');
const normalizedBooking = transformBookedCruisesToAppFormat([{
  rawBooking: {
    bookingId: '3658443', sailDate: '20260910', numberOfNights: 5, deckNumber: '7',
    stateroomNumber: '7146', stateroomType: 'B',
    passengers: [{ firstName: 'SCOTT', lastName: 'MERLIS', stateroomNumber: '7146', stateroomType: 'B', stateroomCategoryCode: '4D' }],
  },
  sourcePage: 'Upcoming', shipName: 'Harmony of the Seas', cruiseTitle: '5 Night Bahamas',
  sailingStartDate: '09/10/26', sailingEndDate: '09/15/26', sailingDates: '09/10/26 - 09/15/26',
  itinerary: '5 Night Bahamas & Perfect Day Cruise', departurePort: 'Port Canaveral',
  cabinType: 'TBD', cabinNumberOrGTY: '7146', bookingId: 'HARMONY-20260910',
  status: 'booked', loyaltyLevel: '', loyaltyPoints: '',
}], null)[0];
assert.equal(normalizedBooking.bookingId, '3658443');
assert.equal(normalizedBooking.reservationNumber, '3658443');
assert.equal(normalizedBooking.nights, 5);
assert.equal(normalizedBooking.cabinType, 'Balcony');
assert.equal(normalizedBooking.cabinNumber, '7146');
assert.equal(normalizedBooking.cabinCategory, '4D');
assert.deepEqual(normalizedBooking.guestNames, ['Scott Merlis']);

const offerBase = {
  sourcePage: 'Offers', offerName: 'Winning Plays', offerCode: '26TOR403', offerExpirationDate: '09/03/26',
  offerType: 'Club Royale', shipName: 'Harmony of the Seas', sailingDate: '09/03/26',
  itinerary: '2 Night Perfect Day', departurePort: 'Port Canaveral', cabinType: 'Ocean View GTY',
  numberOfGuests: '2 Guests', perks: '-', loyaltyLevel: '', loyaltyPoints: '', totalNights: 2,
};
const transformedOffers = transformOfferRowsToCruisesAndOffers([
  { ...offerBase, playerOfferId: 'PLAYER-A' },
  { ...offerBase, playerOfferId: 'PLAYER-B' },
  { ...offerBase, playerOfferId: 'PLAYER-C' },
], null);
assert.equal(transformedOffers.offers.length, 3);
assert.equal(transformedOffers.cruises.length, 3);
assert.deepEqual(transformedOffers.offers.map((offer) => offer.playerOfferId).sort(), ['PLAYER-A', 'PLAYER-B', 'PLAYER-C']);
assert.ok(transformedOffers.offers.every((offer) => offer.cruiseIds.length === 1));

const { validateOfferCruiseReferences } = loadTs('lib/royalCaribbean/syncIntegrity.ts');
assert.equal(validateOfferCruiseReferences(transformedOffers.offers, transformedOffers.cruises).valid, true);
const brokenOffers = [{ ...transformedOffers.offers[0], cruiseIds: ['missing-sailing'], cruiseId: 'missing-sailing' }];
assert.deepEqual(validateOfferCruiseReferences(brokenOffers, transformedOffers.cruises).danglingCruiseIds, ['missing-sailing']);

// Regression: cruise reconciliation retains an existing stable ID while the
// incoming offer graph still contains transform-time IDs. All 15 offer
// instances, including three TOR403 and three TOR503 instances, must survive
// and be relinked to their own sailing records.
const { applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');
const repeatedCodes = ['TOR403', 'TOR403', 'TOR403', 'TOR503', 'TOR503', 'TOR503'];
const offerCodes = [...repeatedCodes, ...Array.from({ length: 9 }, (_, index) => `UNIQUE${index + 1}`)];
const existingSailings = offerCodes.map((offerCode, index) => ({
  id: `stable-cruise-${index}`,
  shipName: `Ship ${index}`,
  sailDate: `2026-10-${String(index + 1).padStart(2, '0')}`,
  returnDate: `2026-10-${String(index + 2).padStart(2, '0')}`,
  departurePort: 'Miami', destination: 'Caribbean', nights: 1,
  offerCode, playerOfferId: `INSTANCE-${index}`, offerInstanceId: `INSTANCE-${index}`,
  cruiseSource: 'royal', status: 'available', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}));
const incomingSailings = existingSailings.map((cruise, index) => ({ ...cruise, id: `temporary-cruise-${index}` }));
const incomingOffers = offerCodes.map((offerCode, index) => ({
  id: `offer-instance-${index}`, offerCode, offerName: `Offer ${index}`,
  playerOfferId: `INSTANCE-${index}`, offerInstanceId: `INSTANCE-${index}`,
  cruiseId: `temporary-cruise-${index}`, cruiseIds: [`temporary-cruise-${index}`],
  offerSource: 'royal', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}));
const applied = applySyncPreview({
  offers: { new: incomingOffers, updates: [], unchanged: [] },
  cruises: {
    new: [],
    updates: existingSailings.map((existing, index) => ({ existing, updated: { ...incomingSailings[index], id: existing.id } })),
    unchanged: [],
  },
  bookedCruises: { new: [], updates: [], unchanged: [] },
  loyalty: null,
}, [], existingSailings, [], 'royal');
assert.equal(applied.offers.length, 15);
assert.equal(applied.cruises.length, 15);
assert.equal(applied.offers.filter((offer) => offer.offerCode === 'TOR403').length, 3);
assert.equal(applied.offers.filter((offer) => offer.offerCode === 'TOR503').length, 3);
assert.equal(validateOfferCruiseReferences(applied.offers, applied.cruises).valid, true);
assert.ok(applied.offers.every((offer, index) => offer.cruiseIds[0] === `stable-cruise-${index}`));

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /validateOfferCruiseReferences\(finalOffers, finalCruises\)/);
assert.match(provider, /await Promise\.all\(\[\s*offersRequireCommit/);
assert.match(provider, /ROLLBACK_OFFERS/);
assert.match(provider, /Previous local data restored; no partial sync was published/);
assert.match(provider, /offer\.playerOfferId \|\| offer\.carnivalOfferId \|\| offer\.offerInstanceId/);

const overview = read('app/(tabs)/(overview)/index.tsx');
const details = read('app/offer-details.tsx');
assert.match(overview, /getOfferLookupKey\(offer: CasinoOffer\)/);
assert.match(overview, /offerKeyByCruiseId/);
assert.match(overview, /codeCandidates\.length === 1/);
assert.match(overview, /offerId=\$\{encodeURIComponent\(offer\.id\)\}/);
assert.match(details, /linkedCruiseIds\.has\(cruise\.id\)/);
assert.match(details, /offerInstanceId/);

const weather = read('state/SailingWeatherProvider.tsx');
assert.match(weather, /MARINE_STRATEGY_VERSION = 3/);
assert.match(weather, /cell_selection=sea/);
assert.match(weather, /secondaryMarine = preferLongRangeMarineModel/);
assert.match(weather, /fetchMarineCandidate\(bestMatchMarineUrl, 'Open-Meteo marine best match'\)/);

console.log('PASS Build 369: current Royal bookings, duplicate-code offer instances, atomic local sync, instance-aware UI, and marine fallback integrity');
