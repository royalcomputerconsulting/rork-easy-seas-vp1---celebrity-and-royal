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

const { filterOfferSailingRows } = compileTs('lib/offers/offerSailingFilters.ts');
const rows = [
  { id: 'a', ship: 'Icon', shipClass: 'Icon Class', cabin: 'Balcony GTY', guests: 2, port: 'Miami', date: '2026-09-12', nights: 7, bonus: true, itinerary: 'Eastern Caribbean Perfect Day' },
  { id: 'b', ship: 'Oasis', shipClass: 'Oasis Class', cabin: 'Interior', guests: 1, port: 'Fort Lauderdale', date: '2026-10-05', nights: 4, bonus: false, itinerary: 'Bahamas Nassau' },
  { id: 'c', ship: 'Icon', shipClass: 'Icon Class', cabin: 'Suite', guests: 2, port: 'Miami', date: '2026-11-01', nights: 10, bonus: false, itinerary: 'Southern Caribbean' },
];
const empty = {
  ships: [], shipClasses: [], cabins: [], guestCounts: [], departurePorts: [],
  dateFrom: '', dateTo: '', minNights: '', maxNights: '', gty: 'all', nextCruiseBonus: 'all',
};
const accessors = {
  ship: (row) => row.ship,
  shipClass: (row) => row.shipClass,
  cabin: (row) => row.cabin,
  guestCount: (row) => row.guests,
  departurePort: (row) => row.port,
  sailDate: (row) => row.date,
  nights: (row) => row.nights,
  hasNextCruiseBonus: (row) => row.bonus,
  searchParts: (row) => [row.ship, row.shipClass, row.cabin, row.port, row.itinerary],
  dateToTime: (date) => new Date(`${date}T12:00:00Z`).getTime(),
};

const ids = (filters = empty, search = '') => filterOfferSailingRows(rows, search, filters, accessors).map((row) => row.id);
assert.deepEqual(ids(), ['a', 'b', 'c'], 'unfiltered rows preserve every provider relationship and order');
assert.deepEqual(ids({ ...empty, ships: ['Icon'] }), ['a', 'c']);
assert.deepEqual(ids({ ...empty, shipClasses: ['Oasis Class'] }), ['b']);
assert.deepEqual(ids({ ...empty, cabins: ['Suite'] }), ['c']);
assert.deepEqual(ids({ ...empty, guestCounts: [1] }), ['b']);
assert.deepEqual(ids({ ...empty, departurePorts: ['Miami'] }), ['a', 'c']);
assert.deepEqual(ids({ ...empty, dateFrom: '2026-10-01', dateTo: '2026-10-31' }), ['b']);
assert.deepEqual(ids({ ...empty, minNights: '5', maxNights: '8' }), ['a']);
assert.deepEqual(ids({ ...empty, gty: 'yes' }), ['a']);
assert.deepEqual(ids({ ...empty, nextCruiseBonus: 'yes' }), ['a']);
assert.deepEqual(ids(empty, 'icon southern'), ['c'], 'search combines ship and itinerary terms');

const details = read('app/offer-details.tsx');
for (const testID of [
  'offer-open-filter-sheet', 'offer-filter-date-from', 'offer-filter-date-to',
  'offer-filter-min-nights', 'offer-filter-max-nights', 'offer-filter-reset', 'offer-filter-apply',
  'sort-lowest-price', 'sort-longest', 'sort-shortest',
]) {
  assert(details.includes(`testID="${testID}"`), `missing ${testID}`);
}
assert.match(details, /testID=\{`offer-filter-gty-\$\{value\}`\}/, 'GTY filter modes must be selectable');
assert.match(details, /testID=\{`offer-filter-nextcruise-\$\{value\}`\}/, 'NextCruise filter modes must be selectable');
assert.match(details, /offerDetailViewStateCache/, 'offer filter, sort, and scroll state must survive detail navigation');
assert.match(details, /scrollToOffset/, 'returning to the offer must restore list position');
assert.match(details, /getCruiseGuestEligibility/, 'each row must show the provider guest entitlement');
assert.match(details, /getOfferSailingCabinLabel/, 'each row must show its stateroom entitlement');
assert.match(details, /NextCruise bonus/, 'each row must expose a supplied NextCruise bonus');
assert.match(details, /filterOfferSailingRows/, 'screen must use the executable filter engine');

console.log('Build 440 offer-detail filter, row-truth, and navigation-state regression passed.');
