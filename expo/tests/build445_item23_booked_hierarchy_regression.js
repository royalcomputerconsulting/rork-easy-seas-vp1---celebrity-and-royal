const assert = require('node:assert/strict');
const fs = require('node:fs');

const booked = fs.readFileSync('app/(tabs)/booked.tsx', 'utf8');
const today = fs.readFileSync('app/today-on-cruise.tsx', 'utf8');

for (const marker of [
  '<TabIdentityBand tab="booked"',
  'style={styles.heroImage}',
  'testID="booked-next-cruise-card"',
  'Next voyage',
  'testID="booked-next-voyage-readiness"',
  'Voyage alerts',
  'testID="booked-sailing-weather-section"',
  'testID="booked-casino-opportunity-section"',
  "{ label: 'All', value: 'all' }",
  "{ label: 'Upcoming', value: 'upcoming' }",
  "{ label: 'Completed', value: 'completed' }",
  '<MinimalistFilterBar',
  'testID="booked-cruise-list-section"',
]) assert.ok(booked.includes(marker), `Booked hierarchy is missing ${marker}.`);

// Consecutive trips must expose the complete producing voyages, not a made-up
// ship-name summary that cannot be opened or reconciled.
assert.match(booked, /testID="booked-consecutive-voyage-blocks"/);
assert.match(booked, /booked-consecutive-voyage-card-/);
assert.match(booked, /block\.voyages\.map\(\(group, voyageIndex\)/);
assert.match(booked, /cruise=\{group\.voyage\}/);
assert.match(booked, /relatedReservationCount=\{group\.reservations\.length\}/);
assert.match(booked, /handleCruisePress\(group\.voyage\)/);
assert.doesNotMatch(booked, /block\.voyages\.map\(\(group\) => group\.voyage\.shipName\)\.join/);

// Multiple reservations remain separate in storage and are summarized on the
// canonical card; detailed reservation fields remain available on detail.
assert.match(booked, /buildPhysicalBookedVoyageGroups/);
assert.match(booked, /getBookedCruiseRenderKey/);
assert.match(booked, /relatedReservationCount/);
assert.match(booked, /booked-related-reservations/);

// The launched Today screen consumes the same premium page system.
assert.match(today, /#F3F3F2|colors\.background/);
assert.match(today, /ThemedSectionHeader|ThemedSectionCard/);
assert.match(today, /buildCruiseDetailsParams/);

console.log('PASS Build 445 Item 23 Booked hierarchy, complete back-to-back voyage cards, filters, readiness, weather, casino, and reservation truth');
