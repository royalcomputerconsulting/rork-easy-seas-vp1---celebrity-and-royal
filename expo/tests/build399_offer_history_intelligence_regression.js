const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filename = path.join(root, 'lib/offerHistoryIntelligence.ts');
const output = ts.transpileModule(read('lib/offerHistoryIntelligence.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@/types/models') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let lib;
try {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  lib = mod.exports;
} finally {
  Module._load = originalLoad;
}

const base = { offerCode: '2607TOR403', offerType: 'comped', title: 'Three valid instances', brand: 'royal', value: 1000 };
const offers = [
  { ...base, id: 'local-a', playerOfferId: 'player-a', status: 'booked' },
  { ...base, id: 'local-b', playerOfferId: 'player-b', status: 'active' },
  { ...base, id: 'local-c', playerOfferId: 'player-c', status: 'active' },
];
const bookings = [
  { id: 'booking-a', shipName: 'Icon', sailDate: '2026-09-26', returnDate: '2026-10-03', departurePort: 'Miami', destination: 'Caribbean', nights: 7, playerOfferId: 'player-a', offerCode: '2607TOR403', cruiseValueCaptured: 2400 },
  { id: 'booking-ambiguous', shipName: 'Harmony', sailDate: '2026-10-01', returnDate: '2026-10-06', departurePort: 'Miami', destination: 'Bahamas', nights: 5, offerCode: '2607TOR403', cruiseValueCaptured: 1800 },
];
const report = lib.buildOfferHistoryReport(offers, bookings, new Date('2026-08-21T12:00:00Z'));
assert.equal(report.totalInstances, 3, 'same-code offers must remain three distinct instances');
assert.equal(report.uniqueMarketingCodes, 1, 'marketing code count must remain separate from instance count');
assert.equal(new Set(report.records.map((row) => row.instanceKey)).size, 3);
assert.equal(report.records.find((row) => row.offerId === 'local-a').capturedValue, 2400, 'provider instance may receive exact captured value');
assert.equal(report.records.find((row) => row.offerId === 'local-b').capturedValue, 0, 'ambiguous same-code booking must not be guessed');
assert.equal(report.records.find((row) => row.offerId === 'local-c').capturedValue, 0, 'ambiguous same-code booking must not be guessed');
assert.equal(report.capturedValue, 2400);
assert.equal(report.redeemed, 1);

const uniqueFallback = lib.buildOfferHistoryReport(
  [{ ...base, id: 'only', offerCode: 'UNIQUE', playerOfferId: undefined, status: 'active' }],
  [{ ...bookings[1], id: 'unique-booking', offerCode: 'UNIQUE', cruiseValueCaptured: 900 }],
  new Date('2026-08-21T12:00:00Z'),
);
assert.equal(uniqueFallback.records[0].attribution, 'unique-code');
assert.equal(uniqueFallback.records[0].capturedValue, 900);

const screen = read('app/war-room.tsx');
assert.match(screen, /offer-history-intelligence/);
assert.match(screen, /Every provider offer instance is counted separately/);
assert.match(screen, /uniqueMarketingCodes/);
assert.match(screen, /bookedCruises/);

console.log('PASS build399_offer_history_intelligence_regression — offer instances stay distinct, exact provider attribution wins, and ambiguous shared-code bookings are never guessed');
