const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');
const card = read('components/CruiseCard.tsx');
const offerDetails = read('app/offer-details.tsx');
const cruises = read('app/(tabs)/scheduling.tsx');
const booked = read('app/(tabs)/booked.tsx');
const casino = read('components/casino/CasinoCommandCenter.tsx');
const planning = read('lib/cruisePlanningIntelligence.ts');

// One shared, premium, one-column card is the producing component in every
// requested cruise context. Each route keeps its full record identity.
for (const [name, source] of Object.entries({ offerDetails, cruises, booked, casino })) {
  assert.match(source, /import \{ CruiseCard \} from '@\/components\/CruiseCard'/, `${name} must import the canonical CruiseCard.`);
  assert.match(source, /<CruiseCard/, `${name} must render the canonical CruiseCard.`);
  assert.match(source, /buildCruiseDetailsParams/, `${name} must navigate with canonical cruise identity.`);
}

for (const marker of [
  'cruise-card-mini',
  'cruise-card-mini-sea-day-score',
  'Itinerary needed for casino score',
  'cruise-card-modeled-casino-metrics',
  'modeled golden hours',
  'modeled casino points',
  'Stateroom not stated',
  'C&amp;A pts',
  'casino pts',
  'point level',
  'cruise-card-financial-facts',
  'cruise-card-physical-voyage-relationship',
  'offer rows share this one physical voyage',
  'separate reservations share this physical voyage',
  'Source:',
]) assert.ok(card.includes(marker), `Canonical cruise card is missing ${marker}.`);

// The false-zero guard must be evidence based, not a display-only string swap.
assert.match(planning, /const isItineraryKnown = hasOperationalItinerary \|\| hasExplicitDayCounts/);
assert.match(card, /seaDayDensity\.isItineraryKnown \? \(/);
assert.doesNotMatch(card, /Casino Opp 0/);

// Duplicate offer options and multiple booked reservations stay distinct while
// the relationship to one physical voyage is made explicit.
assert.match(offerDetails, /relatedOfferOptionCount=\{offerOptionCountsByPhysicalVoyage/);
assert.match(cruises, /relatedOfferOptionCount=\{offerOptionCountsByPhysicalVoyage/);
assert.match(booked, /relatedReservationCount=\{reservationCountByVoyage/);
assert.match(casino, /relatedReservationCount=\{reservationCountByVoyage/);
assert.match(casino, /source: 'casino'/);

console.log('PASS Build 445 Item 21 canonical cruise card, truthful itinerary state, relationship explanation, and first-tap detail identity');
