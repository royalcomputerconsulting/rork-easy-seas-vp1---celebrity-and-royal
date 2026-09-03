const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const { matchesCruiseDiscoveryFilters } = compileTs('lib/cruises/cruiseDiscoveryFilters.ts');
const empty = { cabinType: 'all', selectedShips: [], selectedShipClasses: [], guestCounts: [], departurePorts: [], regions: [], dateFrom: '', dateTo: '', minNights: '', maxNights: '', eligibility: 'all' };
const fixtures = [
  { id: 'offer', shipName: 'Icon', shipClass: 'Icon Class', cabinType: 'Balcony', guestCount: 2, departurePort: 'Miami', regionOrDestination: 'Caribbean', sailDate: '2026-09-20', nights: 7, hasOffer: true, hasCertificate: false },
  { id: 'cert', shipName: 'Oasis', shipClass: 'Oasis Class', cabinType: 'Interior', guestCount: 1, departurePort: 'Fort Lauderdale', regionOrDestination: 'Bahamas', sailDate: '2026-10-05', nights: 4, hasOffer: false, hasCertificate: true },
  { id: 'plain', shipName: 'Quantum', shipClass: 'Quantum Class', cabinType: 'Suite', guestCount: 2, departurePort: 'Seattle', regionOrDestination: 'Alaska', sailDate: '2026-11-01', nights: 10, hasOffer: false, hasCertificate: false },
];
const selected = (filters) => fixtures.filter((row) => matchesCruiseDiscoveryFilters(row, filters)).map((row) => row.id);
assert.deepEqual(selected({ ...empty, eligibility: 'offer' }), ['offer']);
assert.deepEqual(selected({ ...empty, eligibility: 'certificate' }), ['cert']);
assert.deepEqual(selected({ ...empty, selectedShipClasses: ['Quantum Class'], guestCounts: [2], departurePorts: ['Seattle'], regions: ['Alaska'], minNights: '7', maxNights: '12' }), ['plain']);

const screen = read('app/(tabs)/scheduling.tsx');
const bar = read('components/ui/MinimalistFilterBar.tsx');
const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');

for (const testID of [
  'cruises-discovery-controls-section', 'cruises-search-input', 'cruises-clear-search',
  'cruises-sort-soonest', 'cruises-sort-latest', 'cruises-sort-value',
  'cruises-open-filter-screen', 'cruises-active-filter-summary',
  'cruises-active-filters-clear', 'cruises-filter-apply', 'cruises-filter-clear-all',
]) assert.ok(screen.includes(testID) || bar.includes(testID), `Cruises discovery is missing ${testID}`);

for (const marker of [
  'searchValue={filters.searchQuery}', 'onSearchChange={_handleSearch}',
  "hasOffer: Boolean(cruise.offerCode || cruise.offerName || cruise.offerInstanceId)",
  'activeFilterLabels', 'schedulingViewStateCache', 'scrollToOffset',
  'Favorite cruises and staterooms', 'cruises-favorites-before-catalog',
]) assert.ok(screen.includes(marker), `Cruises screen is missing ${marker}`);

for (const category of [
  'Ship class', 'Stateroom entitlement', 'Guests', 'Departure port',
  'Region or destination', 'Sailing dates', 'Cruise length', 'Eligibility source', 'Schedule',
]) assert.ok(screen.includes(category), `filter sheet is missing ${category}`);

assert.match(bar, /<TextInput/);
assert.match(bar, /accessibilityLabel="Search cruises"/);
assert.match(repository, /shipClasses: string\[\]/);
assert.match(repository, /guestCounts: number\[\]/);
assert.match(repository, /json_extract\(raw_json, '\$\.shipClass'\)/);
assert.match(repository, /json_extract\(raw_json, '\$\.guestCount'\)/);
assert.match(repository, /cruise_offer_sailings linked_offer/);

console.log('PASS Build 445 Item 20 premium Cruises discovery controls, complete facets, exact eligibility, and retained state');
