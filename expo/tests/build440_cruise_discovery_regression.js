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
const rows = [
  { id: 'a', shipName: 'Icon', shipClass: 'Icon Class', cabinType: 'Balcony', guestCount: 2, departurePort: 'Miami', regionOrDestination: 'Caribbean', sailDate: '2026-09-12', nights: 7, hasOffer: true, hasCertificate: false },
  { id: 'b', shipName: 'Oasis', shipClass: 'Oasis Class', cabinType: 'Interior', guestCount: 1, departurePort: 'Fort Lauderdale', regionOrDestination: 'Bahamas', sailDate: '2026-10-05', nights: 4, hasOffer: false, hasCertificate: true },
  { id: 'c', shipName: 'Quantum', shipClass: 'Quantum Class', cabinType: 'Suite', guestCount: null, departurePort: 'Seattle', regionOrDestination: 'Alaska', sailDate: '2026-11-01', nights: 10, hasOffer: true, hasCertificate: true },
];
const empty = { cabinType: 'all', selectedShips: [], selectedShipClasses: [], guestCounts: [], departurePorts: [], regions: [], dateFrom: '', dateTo: '', minNights: '', maxNights: '', eligibility: 'all' };
const ids = (filters = empty) => rows.filter((row) => matchesCruiseDiscoveryFilters(row, filters)).map((row) => row.id);

assert.deepEqual(ids(), ['a', 'b', 'c']);
assert.deepEqual(ids({ ...empty, selectedShips: ['Icon'] }), ['a']);
assert.deepEqual(ids({ ...empty, selectedShipClasses: ['Oasis Class'] }), ['b']);
assert.deepEqual(ids({ ...empty, cabinType: 'Suite' }), ['c']);
assert.deepEqual(ids({ ...empty, guestCounts: [1] }), ['b']);
assert.deepEqual(ids({ ...empty, departurePorts: ['Seattle'] }), ['c']);
assert.deepEqual(ids({ ...empty, regions: ['Caribbean'] }), ['a']);
assert.deepEqual(ids({ ...empty, dateFrom: '2026-10-01', dateTo: '2026-10-31' }), ['b']);
assert.deepEqual(ids({ ...empty, minNights: '5', maxNights: '8' }), ['a']);
assert.deepEqual(ids({ ...empty, eligibility: 'offer' }), ['a', 'c']);
assert.deepEqual(ids({ ...empty, eligibility: 'certificate' }), ['b', 'c']);
assert.deepEqual(ids({ ...empty, minNights: 'not-a-number' }), ['a', 'b', 'c'], 'invalid input must not generate a NaN query filter');

const screen = read('app/(tabs)/scheduling.tsx');
for (const testID of [
  'cruises-open-filter-screen', 'cruises-close-filter-screen', 'cruises-filter-date-from',
  'cruises-filter-date-to', 'cruises-filter-min-nights', 'cruises-filter-max-nights',
  'cruises-filter-clear-all', 'cruises-filter-apply', 'cruises-favorites-before-catalog',
]) assert(screen.includes(`testID="${testID}"`) || screen.includes(`testID={\`${testID}`), `missing ${testID}`);
assert.match(screen, /testID=\{`cruises-filter-eligibility-\$\{value\}`\}/, 'all eligibility modes must be selectable');
assert.match(screen, /schedulingViewStateCache/, 'tab, filter, and scroll state must survive detail navigation');
assert.match(screen, /scrollToOffset/, 'catalog must restore the prior position');
assert.match(screen, /matchesCruiseDiscoveryFilters/, 'screen must use the executable discovery filter engine');
assert(screen.indexOf('cruises-favorites-before-catalog') < screen.indexOf('cruises-catalog-list'), 'favorites must remain reachable before the long virtualized catalog');

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
for (const field of ['shipClasses', 'guestCounts', 'regionsOrDestinations', 'offerLinked']) assert(repository.includes(field), `repository query missing ${field}`);

const card = read('components/CruiseCard.tsx');
assert.match(card, /seaDayDensity\.isItineraryKnown/, 'cards must distinguish unknown itineraries from factual zero values');
assert.match(card, /Itinerary needed for casino score/, 'compact cards must explain why casino scoring is unavailable');
assert.match(card, /testID="cruise-card-provenance"/, 'cruise rows must show supplied provenance');

console.log('Build 440 cruise discovery, row truth, favorites reachability, and navigation-state regression passed.');
