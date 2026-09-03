const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const layout = read('app/(tabs)/_layout.tsx');
const casino = read('app/(tabs)/analytics.tsx');
const cruises = read('app/(tabs)/scheduling.tsx');
const booked = read('app/(tabs)/booked.tsx');
const offers = read('app/(tabs)/(overview)/index.tsx');
const quickActions = read('app/(tabs)/quick-actions.tsx');
const intelligenceFilters = read('components/IntelligenceFilterStrip.tsx');

assert.match(layout, /name="machines"[\s\S]*?href: null/);
assert.ok(layout.indexOf('name="settings"') < layout.indexOf('name="quick-actions"'));
assert.match(layout, /title: "Add"/);
assert.match(casino, /casino-open-slots-tab/);
assert.match(casino, /router\.push\('\/machines'/);

for (const task of ['Browse cruises', 'Import or restore data', 'Open calendar', 'Add or recognize crew', 'Record a casino session', 'Ask Agent SEA']) {
  assert.ok(quickActions.includes(task), `Missing common task: ${task}`);
}

assert.doesNotMatch(offers, /<QuickActionsFAB/);
assert.ok(offers.indexOf('title="Casino & Certificates"') < offers.indexOf('title="Active offers"'));
assert.equal((offers.match(/title="Casino & Certificates"/g) || []).length, 1);

assert.match(cruises, /showProfile=\{false\} showProgram=\{false\}/);
assert.match(cruises, /showShipFilterControl=\{false\}/);
assert.match(cruises, /Search ship, class, itinerary, port, or offer/);
assert.match(cruises, /filters\.searchQuery\.toLowerCase\(\)/);
assert.match(cruises, /cruises-open-filter-screen/);
assert.match(intelligenceFilters, /brand === 'royal'[\s\S]*?'clubRoyale'/);
assert.match(intelligenceFilters, /brand === 'celebrity'[\s\S]*?'blueChip'/);
assert.match(intelligenceFilters, /brand === 'silversea'[\s\S]*?'venetianSociety'/);

assert.doesNotMatch(cruises, /<FavoriteStateroomsSection/);
assert.match(booked, /booked-favorite-staterooms-section/);
assert.ok(booked.indexOf('booked-favorite-staterooms-section') < booked.indexOf('booked-consecutive-voyage-blocks'));

console.log('PASS build452_navigation_and_cruise_discovery_regression');
