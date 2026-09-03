const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const { calculateSeaDayDensityScore } = loadTs('lib/cruisePlanningIntelligence.ts');
const { calculateCasinoAvailabilityForCruise, calculatePersonalizedPlayEstimate } = loadTs('lib/casinoAvailability.ts');

const cruise = {
  id: 'item-25-truth',
  shipName: 'Harmony of the Seas',
  sailDate: '2026-09-10',
  returnDate: '2026-09-17',
  nights: 7,
  departurePort: 'Port Canaveral, Florida',
  itinerary: [
    { day: 1, port: 'Port Canaveral, Florida', departure: '16:00', isSeaDay: false, source: 'provider' },
    { day: 2, port: 'At Sea', isSeaDay: true, source: 'provider' },
    { day: 3, port: 'Nassau, Bahamas', arrival: '08:00', departure: '17:00', isSeaDay: false, source: 'provider' },
    { day: 4, port: 'At Sea', isSeaDay: true, source: 'provider' },
    { day: 5, port: 'Perfect Day at CocoCay', arrival: '07:00', departure: '17:00', isSeaDay: false, source: 'provider' },
    { day: 6, port: 'At Sea', isSeaDay: true, source: 'provider' },
    { day: 7, port: 'Bimini, Bahamas', arrival: '08:00', departure: '17:00', isSeaDay: false, source: 'provider' },
    { day: 8, port: 'Port Canaveral, Florida', arrival: '06:00', isSeaDay: false, source: 'provider' },
  ],
};

const density = calculateSeaDayDensityScore(cruise);
const availability = calculateCasinoAvailabilityForCruise(cruise, undefined, { quiet: true });
const play = calculatePersonalizedPlayEstimate(availability, {
  enabled: true,
  sessions: [
    { id: 'early', label: 'Early morning', startTime: '05:00', endTime: '07:30', enabled: true },
    { id: 'open', label: 'Opening hour', startTime: '18:00', endTime: '19:00', enabled: true },
  ],
});
assert.equal(density.isItineraryKnown, true);
assert.equal(density.seaDays, 3);
assert.equal(density.portDays, 3);
assert.ok(density.casinoOpportunityScore > 0 && density.casinoOpportunityScore <= 100);
assert.ok(availability.casinoOpenDays > 0);
assert.ok(availability.estimatedCasinoHours > 0);
assert.ok(play.estimatedPlayHours > 0);
assert.ok(play.estimatedPoints > 0);
assert.ok(Number.isFinite(play.estimatedPoints / play.estimatedPlayHours));

const card = fs.readFileSync('components/CruiseCard.tsx', 'utf8');
for (const marker of [
  'calculateSeaDayDensityScore(cruise)',
  'calculateCasinoAvailabilityForCruise(cruise',
  'calculatePersonalizedPlayEstimate(casino',
  'casinoOpenDays: casino.casinoOpenDays',
  'casinoOpenHours: casino.estimatedCasinoHours',
  'modeledPlayerHours: play.estimatedPlayHours',
  'pointsPerHour',
  'modeled player hours',
  'points/hour',
  'cruise-card-points-per-hour',
]) assert.ok(card.includes(marker), `Canonical booked card is missing ${marker}.`);
assert.match(card, /if \(!seaDayDensity\.isItineraryKnown\) return null/);
assert.match(card, /Itinerary needed for casino score/);

const booked = fs.readFileSync('app/(tabs)/booked.tsx', 'utf8');
assert.match(booked, /<VoyageWeatherSection cruise=\{nextCruise\}/);
assert.match(booked, /testID="booked-sailing-weather-section"/);
assert.match(booked, /testID="booked-casino-opportunity-section"/);

const weatherSection = fs.readFileSync('components/VoyageWeatherSection.tsx', 'utf8');
assert.match(weatherSection, /expandedWeatherSections/);
assert.match(weatherSection, /setPersistentExpanded\(true\)/);
assert.match(weatherSection, /finally \{[\s\S]*setPersistentExpanded\(true\)/);
assert.match(weatherSection, /plan\.days\.map/);

const weatherCard = fs.readFileSync('components/SailingWeatherCard.tsx', 'utf8');
const weatherPosition = fs.readFileSync('lib/weatherPositionPresentation.ts', 'utf8');
const planningBranch = weatherCard.slice(
  weatherCard.indexOf("if (forecast.source === 'planning' && !planningHasCurrentAreaEvidence)"),
  weatherCard.indexOf('return (', weatherCard.indexOf("if (forecast.source === 'planning' && !planningHasCurrentAreaEvidence)")) + 5000,
);
assert.match(planningBranch, /<VisibleItineraryMap/);
assert.match(weatherCard, /sailing-weather-visible-map-/);
assert.match(weatherCard, /nearestBuoyObservation\.distanceMiles/);
assert.match(weatherPosition, /not live AIS ship tracking/i);

const provider = fs.readFileSync('state/SailingWeatherProvider.tsx', 'utf8');
assert.match(provider, /resolveCruiseWeatherPoint/);
assert.match(provider, /Marine forecast along day \$\{canonicalDay\.day\} itinerary position/);
assert.match(provider, /fetchNearestNdbcObservation/);
assert.match(provider, /distanceMiles/);
assert.match(provider, /source: 'cache-stale'/);

console.log('PASS Build 445 Item 25 shared Booked casino opportunity truth, modeled player rate, route weather, persistent refresh, visible map, and buoy evidence');
