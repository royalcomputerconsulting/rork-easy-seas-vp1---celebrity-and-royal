const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const { projectCrownAnchorCruisePoints } = loadTs('lib/loyalty/crownAnchorCruisePoints.ts');
const { calculateSeaDayDensityScore } = loadTs('lib/cruisePlanningIntelligence.ts');
const { enrichBookedCruisesWithCatalogFacts } = loadTs('lib/bookedCruiseDisplayTruth.ts');
const { buildPhysicalBookedVoyageGroups, buildCanonicalBookedVoyages, buildConsecutiveBookedVoyageBlocks } = loadTs('lib/bookedVoyageRelationships.ts');
const { buildCruiseEconomicsSummary } = loadTs('lib/casinoCruiseEconomics.ts');

const itinerary = [
  { day: 1, port: 'Port Canaveral, Florida', isSeaDay: false, source: 'provider' },
  { day: 2, port: 'At Sea', isSeaDay: true, source: 'provider' },
  { day: 3, port: 'Nassau, Bahamas', isSeaDay: false, source: 'provider' },
  { day: 4, port: 'At Sea', isSeaDay: true, source: 'provider' },
  { day: 5, port: 'Perfect Day at CocoCay', isSeaDay: false, source: 'provider' },
  { day: 6, port: 'At Sea', isSeaDay: true, source: 'provider' },
  { day: 7, port: 'Bimini, Bahamas', isSeaDay: false, source: 'provider' },
  { day: 8, port: 'Port Canaveral, Florida', isSeaDay: false, source: 'provider' },
];

const shared = {
  sourceEmail: 'owner@example.com',
  shipName: 'Harmony of the Seas',
  sailDate: '2026-09-10',
  returnDate: '2026-09-17',
  nights: 7,
  cruiseSource: 'royal',
  brand: 'Royal Caribbean',
  offerCode: '2609A04',
  casinoProgram: 'clubRoyale',
  status: 'completed',
  completionState: 'completed',
};

const reservations = [
  {
    ...shared,
    id: 'booking-a',
    ownerProfileId: 'primary-v1',
    reservationNumber: 'A100',
    cabinType: 'Balcony',
    guestNames: ['Scott', 'Guest'],
    guests: 2,
  },
  {
    ...shared,
    id: 'booking-b',
    ownerProfileId: 'primary-v2',
    reservationNumber: 'B200',
    cabinType: 'Interior',
    guestNames: ['Scott'],
    guests: 1,
    itinerary,
    pointsEarned: 2500,
    earnedPoints: 2500,
    casinoPoints: 2500,
    pointsSource: 'manual',
    winningsBroughtHome: 500,
    cashResult: 500,
    casinoCloseoutSource: 'manual',
    sourceAuthority: 'user_entered',
  },
];

const groups = buildPhysicalBookedVoyageGroups(reservations);
assert.equal(groups.length, 1, 'Two reservations on the same owner/ship/date voyage must form one physical voyage');
assert.equal(groups[0].reservations.length, 2, 'Both reservation records must remain independently retained');
assert.equal(buildCanonicalBookedVoyages(reservations).length, 1, 'Calculation input must contain one canonical voyage');
assert.equal(buildCanonicalBookedVoyages(reservations)[0].pointsEarned, 2500, 'Manual cruise points must win canonical evidence selection');

const economics = buildCruiseEconomicsSummary(reservations, new Date('2026-10-01T12:00:00Z'), { scope: 'completedOnly' });
assert.equal(economics.totals.cruises, 1, 'Casino economics must not double-count a second reservation');
assert.equal(economics.totals.totalNights, 7, 'Voyage nights must not double-count a second reservation');
assert.equal(economics.totals.totalPoints, 2500, 'Casino points must not double-count a second reservation');

assert.deepEqual(projectCrownAnchorCruisePoints({ ...shared, id: 'solo', guestNames: ['Scott'], guests: 1 }), {
  points: 14,
  multiplier: 2,
  guestCount: 1,
  source: 'saved_guest_count',
  explanation: '7 nights × 2 points per night (solo)',
});
assert.equal(projectCrownAnchorCruisePoints({ ...shared, id: 'double', guestNames: ['Scott', 'Guest'], guests: 2 }).points, 7, 'Each occupant in a shared cabin earns one point per night');
assert.equal(projectCrownAnchorCruisePoints({ ...shared, id: 'unknown', guestNames: undefined, guests: undefined }).points, null, 'Unknown occupancy must not be treated as solo');
assert.equal(projectCrownAnchorCruisePoints({ ...shared, id: 'suite-double', cabinType: 'Grand Suite', guests: 2 }).points, 14, 'A shared suite earns one occupancy point plus one suite point per night');
assert.equal(projectCrownAnchorCruisePoints({ ...shared, id: 'suite-solo', cabinType: 'Grand Suite', guests: 1 }).points, 21, 'A solo suite earns two occupancy points plus one suite point per night');

const missingItineraryBooking = { ...shared, id: 'needs-enrichment', status: 'booked', completionState: 'upcoming', itinerary: undefined, ports: undefined };
const catalogRows = [
  { ...shared, id: 'catalog-1', status: 'available', cabinType: 'Balcony', guests: 2, itinerary, destination: 'Bahamas & Perfect Day', departurePort: 'Port Canaveral, Florida' },
  { ...shared, id: 'catalog-2', status: 'available', cabinType: 'Interior', guests: 1, itinerary, destination: 'Bahamas & Perfect Day', departurePort: 'Port Canaveral, Florida' },
];
const enriched = enrichBookedCruisesWithCatalogFacts([missingItineraryBooking], catalogRows)[0];
assert.equal(enriched.itinerary.length, 8, 'A unanimous matching catalog itinerary must enrich the booked card');
const score = calculateSeaDayDensityScore(enriched);
assert.equal(score.isItineraryKnown, true);
assert.equal(score.seaDays, 3);
assert.equal(score.portDays, 3, 'Port-day count must exclude embarkation and disembarkation');
assert.ok(score.casinoOpportunityScore > 0, 'A known itinerary must produce a nonzero evidence-based casino opportunity score');

const conflictingCatalog = [
  catalogRows[0],
  { ...catalogRows[1], itinerary: itinerary.map((day) => day.day === 3 ? { ...day, port: 'Cozumel, Mexico' } : day) },
];
const unresolved = enrichBookedCruisesWithCatalogFacts([missingItineraryBooking], conflictingCatalog)[0];
assert.equal(unresolved.itinerary, undefined, 'Conflicting catalog itineraries must remain unresolved instead of selecting an arbitrary row');
assert.equal(calculateSeaDayDensityScore(unresolved).isItineraryKnown, false, 'Missing itinerary truth must be labeled unknown rather than displayed as factual zero');

const blocks = buildConsecutiveBookedVoyageBlocks([
  ...reservations,
  { ...shared, id: 'next-voyage', reservationNumber: 'C300', sailDate: '2026-09-17', returnDate: '2026-09-21', nights: 4 },
]);
assert.equal(blocks.length, 1);
assert.equal(blocks[0].voyages.length, 2);
assert.equal(blocks[0].nights, 11, 'Consecutive blocks must count physical voyage nights, not reservation rows');

const cardSource = fs.readFileSync(path.join(root, 'components/CruiseCard.tsx'), 'utf8');
const bookedSource = fs.readFileSync(path.join(root, 'app/(tabs)/booked.tsx'), 'utf8');
const detailsSource = fs.readFileSync(path.join(root, 'app/(tabs)/(overview)/cruise-details.tsx'), 'utf8');
const loyaltyProviderSource = fs.readFileSync(path.join(root, 'state/LoyaltyProvider.tsx'), 'utf8');
const loyaltyScreenSource = fs.readFileSync(path.join(root, 'app/casino/loyalty-data.tsx'), 'utf8');
assert.doesNotMatch(cardSource, /cruise\.nights \* 2/, 'Booked cards must not apply a blanket two-points-per-night rule');
assert.match(cardSource, /projectCrownAnchorCruisePoints/, 'Booked cards must use the occupancy-aware Crown & Anchor projection');
assert.match(cardSource, /Itinerary needed for casino score/, 'Unknown itinerary cannot masquerade as a factual zero score');
assert.match(loyaltyProviderSource, /projectCrownAnchorCruisePoints\(cruise\)/, 'The main Loyalty provider must share the same occupancy-aware projection');
assert.match(loyaltyScreenSource, /plus 1 additional point per night in a suite/i, 'Casino loyalty evidence must explain the confirmed suite bonus');
assert.match(bookedSource, /enrichBookedCruisesWithCatalogFacts/, 'Booked cards must consume unambiguous catalog itinerary truth');
for (const id of ['booked-next-cruise-card', 'booked-next-voyage-readiness', 'booked-consecutive-voyage-blocks', 'booked-related-reservations', 'booked-cruise-list-section']) {
  assert.ok(bookedSource.includes(`testID="${id}"`), `Booked acceptance target missing: ${id}`);
}
assert.ok(detailsSource.indexOf('testID="cruise-details-top-itinerary"') < detailsSource.indexOf('testID="cruise-details-phase3-planning-intelligence"'), 'The actual itinerary must appear before Cruise Planning Intelligence');
for (const id of ['cruise-detail-reservation-number', 'cruise-detail-stateroom-number', 'edit-cruise-pricing', 'edit-cruise-notes']) {
  assert.ok(detailsSource.includes(`testID="${id}"`), `Cruise detail acceptance target missing: ${id}`);
}

console.log('PASS Build 444 Cruises/Booked acceptance: filters and state retained, occupancy-aware loyalty points, itinerary truth, physical-voyage relationships, casino calculations, and planning evidence reconcile');
