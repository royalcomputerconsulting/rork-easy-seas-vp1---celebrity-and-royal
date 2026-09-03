const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const casino = read('components/casino/CasinoCommandCenter.tsx');
const economics = read('hooks/useCasinoEconomicsData.ts');

for (const [id, label] of [
  ['intelligence', 'Intelligence'],
  ['charts', 'Charts'],
  ['session', 'Play'],
  ['calcs', 'Calcs'],
]) {
  assert.ok(casino.includes(`{ id: '${id}', label: '${label}' }`), `${label} work area is missing`);
  assert.ok(casino.includes(`casinoDataReady && activeTab === '${id}'`), `${label} must wait for authoritative data hydration`);
}

assert.match(casino, /TabIdentityBand tab="casino"/);
assert.match(casino, /PremiumVoyageArtwork kind="casino"/);
assert.match(casino, /ThemedSectionHeader tab="casino"/);
assert.match(casino, /casino-data-hydration-status/);
assert.match(casino, /casino-data-hydrating-card/);
assert.match(casino, /Loading saved casino and completed-cruise history/);
assert.match(casino, /Restoring your casino history/);
assert.match(casino, /value: casinoDataReady \? String\(currentSeasonTrips\.length\) : 'Loading…'/);
assert.match(casino, /value: casinoDataReady \? percent\(dashboard\.dataCoverage\) : 'Loading…'/);

assert.match(economics, /\[\.\.\.localBooked, \.\.\.storedBooked\]/, 'legacy and transactional cruise history must be merged');
assert.match(economics, /dedupeBookedCruises/, 'merged history must be reconciled by canonical booked-cruise identity');
assert.match(economics, /filterRecordsForProfile/, 'casino history must remain owner scoped');
assert.match(economics, /isHydrating: isLoading/, 'Casino consumers must receive repository hydration state');

console.log('PASS Build 445 Item 29 Casino shell and hydration truth regression.');
