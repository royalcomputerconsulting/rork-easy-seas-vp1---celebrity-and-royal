const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const date = loadStandaloneTs('lib/date.ts');
const identity = loadStandaloneTs('lib/royalCaribbean/syncIntegrity.ts');
const transformers = loadStandaloneTs('lib/royalCaribbean/dataTransformers.ts', {
  '@/lib/valueCalculator': { getDoubleOccupancyRoomRetailValue: (value) => typeof value === 'number' ? value * 2 : undefined },
  '@/lib/date': date,
  './syncIntegrity': identity,
});

const base = {
  sourcePage: 'certificate', playerOfferId: 'player-offer-1', offerName: 'September offer', offerCode: '2609A04',
  offerExpirationDate: '2026-09-30', offerType: 'comped', perks: '', loyaltyLevel: 'Signature', loyaltyPoints: '3000',
  interiorPrice: '$100', oceanviewPrice: '$200', balconyPrice: '$300', suitePrice: '$400', taxesAndFees: '$150',
};
const rows = [
  {
    ...base, shipName: 'Navigator of the Seas', sailingDate: '2026-10-02', itinerary: '8 NT Mexican Riviera',
    departurePort: 'Los Angeles, California', cabinType: 'Balcony', numberOfGuests: '1',
    portList: 'Los Angeles, Ensenada, Cabo San Lucas', totalNights: undefined,
    dayByDayItinerary: [
      { day: 1, type: 'PORT', portName: 'Los Angeles', departureTime: '16:00' },
      { day: 2, type: 'SEA', portName: 'At Sea' },
      { day: 3, type: 'PORT', portName: 'Ensenada', arrivalTime: '08:00', departureTime: '17:00' },
    ],
  },
  {
    ...base, shipName: 'Icon of the Seas', sailingDate: '2026-10-10', itinerary: '7 Night Eastern Caribbean',
    departurePort: 'Miami, Florida', cabinType: 'Suite', numberOfGuests: '2',
    portList: 'Miami, St. Thomas, Perfect Day at CocoCay', totalNights: 7,
    dayByDayItinerary: [
      { day: 1, type: 'PORT', portName: 'Miami', departureTime: '16:00' },
      { day: 2, type: 'SEA', portName: 'At Sea' },
      { day: 3, type: 'PORT', portName: 'St. Thomas', arrivalTime: '08:00', departureTime: '17:00' },
    ],
  },
];

const transformed = transformers.transformOfferRowsToCruisesAndOffers(rows, null, 'royal');
assert.equal(transformed.cruises.length, 2);
assert.equal(transformed.offers.length, 1, 'one provider offer instance owns both eligible sailing rows');
assert.equal(transformed.cruises[0].nights, 8, 'compact Royal NT notation must parse as nights');
assert.equal(transformed.cruises[0].returnDate, '10-10-2026');
assert.equal(transformed.cruises[0].cabinType, 'Balcony');
assert.equal(transformed.cruises[0].guests, 1);
assert.deepEqual(transformed.cruises[0].ports.slice(0, 3), ['Los Angeles', 'At Sea', 'Ensenada']);
assert.equal(transformed.cruises[1].cabinType, 'Suite');
assert.equal(transformed.cruises[1].guests, 2);
assert.deepEqual(transformed.cruises[1].ports.slice(0, 3), ['Miami', 'At Sea', 'St. Thomas']);

const aggregate = transformed.offers[0];
assert.equal(aggregate.cruiseIds.length, 2);
for (const field of ['shipName', 'sailingDate', 'itineraryName', 'nights', 'itinerary', 'ports', 'portsAndTimes', 'roomType', 'guestsInfo', 'guests']) {
  assert.equal(aggregate[field], undefined, `varying ${field} must not leak from the first sailing into the offer summary`);
}

const itineraryIntegrity = loadStandaloneTs('lib/itineraryIntegrity.ts', {
  './dataAuthority': {
    getDataAuthority: () => 'unknown',
    isAtLeastAsAuthoritative: () => false,
    isOperationallyAuthoritative: () => false,
  },
});
const contaminatedAggregate = {
  ...aggregate,
  shipName: 'Navigator of the Seas',
  sailingDate: transformed.cruises[0].sailDate,
  ports: transformed.cruises[0].ports,
  portsAndTimes: transformed.cruises[0].portsAndTimes,
};
assert.equal(
  itineraryIntegrity.findSingleMaterialOffer(transformed.cruises[1], [contaminatedAggregate]),
  undefined,
  'explicit offer membership must not copy another sailing\'s ship/date/itinerary material',
);

const details = fs.readFileSync(path.join(root, 'app/offer-details.tsx'), 'utf8');
assert.doesNotMatch(details, /portsAndTimes:\s*cruise\.portsAndTimes\s*\|\|\s*offer\.portsAndTimes/);
assert.doesNotMatch(details, /ports:\s*cruise\.ports\s*\|\|\s*offer\.ports/);
assert.doesNotMatch(details, /fallbackOffer\?\.roomType/);
assert.doesNotMatch(details, /fallbackOffer\?\.cabinType/);

console.log('PASS build445_offer_sailing_material_truth_regression');
