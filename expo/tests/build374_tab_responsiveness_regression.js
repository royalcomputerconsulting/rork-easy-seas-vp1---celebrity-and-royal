const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const tabs = read('app/(tabs)/_layout.tsx');
const scheduling = read('app/(tabs)/scheduling.tsx');
const backToBackSource = read('lib/backToBackFinder.ts');

assert.match(tabs, /detachInactiveScreens=\{Platform\.OS !== 'web'\}/);
assert.match(tabs, /lazy: true/);
assert.match(tabs, /freezeOnBlur: Platform\.OS !== 'web'/);
for (const route of ['(overview)', 'scheduling', 'booked', 'events', 'analytics', 'machines', 'settings']) {
  assert.ok(tabs.includes(`name="${route}"`), `Build 339 tab route missing after performance repair: ${route}`);
}

assert.doesNotMatch(scheduling, /setB2bSets/);
assert.doesNotMatch(scheduling, /getBackToBackSets\(enrichedCruises\)/);
assert.match(scheduling, /if \(activeTab !== 'foryou'\) return \[\]/);
assert.match(scheduling, /const b2bSets = useMemo/);
assert.match(backToBackSource, /const B2B_DEBUG = typeof __DEV__ !== 'undefined' && __DEV__/);
assert.equal((backToBackSource.match(/console\.log\(/g) || []).length, 1, 'Production B2B calculation must not emit per-sailing logs');

const { findBackToBackSets } = loadTs('lib/backToBackFinder.ts');
const cruises = Array.from({ length: 2500 }, (_, index) => {
  const sailDate = new Date(2026, 7, 17 + (index % 365));
  const returnDate = new Date(sailDate);
  const nights = 3 + (index % 7);
  returnDate.setDate(returnDate.getDate() + nights);
  return {
    id: `tab-performance-${index}`,
    shipName: `Performance Ship ${index % 20}`,
    sailDate: sailDate.toISOString().slice(0, 10),
    returnDate: returnDate.toISOString().slice(0, 10),
    nights,
    departurePort: `Port ${index % 10}`,
    offerCode: `PERF${index % 100}`,
    status: 'available',
  };
});

const startedAt = Date.now();
const sets = findBackToBackSets(cruises, new Set(), {
  maxGapDays: 2,
  requireDifferentOffers: true,
  excludeConflicts: false,
  minChainLength: 2,
  bookedCruises: [],
  casinoOffers: [],
});
const elapsedMs = Date.now() - startedAt;
assert.ok(Array.isArray(sets));
assert.ok(elapsedMs < 1500, `2,500-row Back-to-Back calculation exceeded the responsiveness budget: ${elapsedMs}ms`);

console.log(`PASS Build 380 tab responsiveness: inactive trees freeze and 2,500-row B2B analysis completed in ${elapsedMs}ms`);
