const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const { calculateCasinoAvailabilityForCruise, calculatePersonalizedPlayEstimate } = loadTs('lib/casinoAvailability.ts');
const { calculateSeaDayDensityScore } = loadTs('lib/cruisePlanningIntelligence.ts');
const { projectCrownAnchorCruisePoints, isSuiteOrHigherCabin } = loadTs('lib/loyalty/crownAnchorCruisePoints.ts');

const itinerary = [
  { day: 1, port: 'Port Canaveral, Florida', departure: '16:00', isSeaDay: false, source: 'provider', dataConfidence: 'verified' },
  { day: 2, port: 'At Sea', isSeaDay: true, source: 'provider', dataConfidence: 'verified' },
  { day: 3, port: 'Nassau, Bahamas', arrival: '08:00', departure: '17:00', isSeaDay: false, source: 'provider', dataConfidence: 'verified' },
  { day: 4, port: 'At Sea', isSeaDay: true, source: 'provider', dataConfidence: 'verified' },
  { day: 5, port: 'Perfect Day at CocoCay', arrival: '07:00', departure: '17:00', isSeaDay: false, source: 'provider', dataConfidence: 'verified' },
  { day: 6, port: 'At Sea', isSeaDay: true, source: 'provider', dataConfidence: 'verified' },
  { day: 7, port: 'Bimini, Bahamas', arrival: '08:00', departure: '17:00', isSeaDay: false, source: 'provider', dataConfidence: 'verified' },
  { day: 8, port: 'Port Canaveral, Florida', arrival: '06:00', isSeaDay: false, source: 'provider', dataConfidence: 'verified' },
];

const knownCruise = {
  id: 'known', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', returnDate: '2026-09-17', nights: 7,
  departurePort: 'Port Canaveral, Florida', destination: 'Bahamas & Perfect Day', itinerary,
  cabinType: 'Balcony GTY', guests: 2, status: 'available',
};
const operational = calculateCasinoAvailabilityForCruise(knownCruise, undefined, { quiet: true });
assert.equal(operational.totalDays, 8);
assert.equal(operational.seaDays, 3);
assert.equal(operational.portDays, 3, 'Port calls exclude embarkation and disembarkation');
assert.ok(operational.casinoOpenDays > 0);
assert.ok(operational.estimatedCasinoHours > 0);
const play = calculatePersonalizedPlayEstimate(operational, { enabled: true, sessions: [{ id: 'early', name: 'Early morning', startTime: '05:00', endTime: '07:30', enabled: true }] });
assert.ok(play.goldenHoursTotal > 0);
assert.ok(play.estimatedPoints > 0);
const density = calculateSeaDayDensityScore(knownCruise);
assert.equal(density.isItineraryKnown, true);
assert.equal(density.seaDays, 3);
assert.equal(density.portDays, 3);
assert.ok(density.casinoOpportunityScore > 0);

const missingCruise = { id: 'missing', shipName: 'Icon of the Seas', sailDate: '2026-10-01', nights: 7, itineraryName: 'Eastern Caribbean', status: 'available' };
const missingOperational = calculateCasinoAvailabilityForCruise(missingCruise, undefined, { quiet: true });
assert.equal(missingOperational.totalDays, 0);
assert.equal(calculateSeaDayDensityScore(missingCruise).isItineraryKnown, false, 'Marketing itinerary names must not become fabricated day plans');

const loyaltyBase = { ...knownCruise, id: 'booked', status: 'booked' };
assert.equal(projectCrownAnchorCruisePoints({ ...loyaltyBase, guests: 1 }).points, 14, 'Solo cabin earns two points per night');
assert.equal(projectCrownAnchorCruisePoints({ ...loyaltyBase, guests: 2 }).points, 7, 'Each occupant in a shared cabin earns one point per night');
assert.equal(projectCrownAnchorCruisePoints({ ...loyaltyBase, guests: 2, cabinType: 'Grand Suite' }).points, 14, 'Shared suite adds one point per night');
assert.equal(projectCrownAnchorCruisePoints({ ...loyaltyBase, guests: 1, cabinType: 'Owners Loft' }).points, 21, 'Named loft categories receive the suite-or-higher bonus');
assert.equal(isSuiteOrHigherCabin({ cabinType: 'Balcony', cabinCategory: 'JS' }), true, 'Provider suite category codes receive the bonus');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const apiTransformers = read('lib/royalCaribbean/apiTransformers.ts');
const offerTransformers = read('lib/royalCaribbean/dataTransformers.ts');
const offerDetails = read('app/offer-details.tsx');
const card = read('components/CruiseCard.tsx');
assert.match(apiTransformers, /source: 'provider' as const/);
assert.match(apiTransformers, /dataConfidence: 'verified' as const/);
assert.match(offerTransformers, /itinerary: providerItinerary/);
assert.match(offerTransformers, /cabinType: offer\.cabinType \|\| undefined/);
assert.match(offerTransformers, /guestsInfo: offer\.numberOfGuests/);
assert.match(offerDetails, /<CruiseCard[\s\S]*?mini[\s\S]*?showRetailValue/);
assert.match(card, /cruise-card-mini-sea-day-score/);
assert.match(card, /cruise-card-modeled-casino-metrics/);
assert.match(card, /cruise-card-full-modeled-casino-metrics/);
assert.match(card, /Itinerary needed for casino score/);
assert.match(card, /formatGuestEligibility\(bookedCruise, 'Guests not stated'\)/);
assert.match(offerDetails, /nextCruiseBonus/);
assert.match(card, /cruise-card-crown-anchor-projection/);
assert.match(card, /Itinerary needed for sea-day and casino opportunity scoring/);

console.log('PASS Build 445 Item 5: provider itinerary provenance drives accurate day/hour/card metrics; missing schedules remain unknown; occupancy and suite-or-higher loyalty rules reconcile');
