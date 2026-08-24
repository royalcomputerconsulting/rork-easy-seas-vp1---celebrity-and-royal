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

const integrity = loadStandaloneTs('lib/royalCaribbean/syncIntegrity.ts');
const date = loadStandaloneTs('lib/date.ts');
const transformers = loadStandaloneTs('lib/royalCaribbean/dataTransformers.ts', {
  '@/lib/valueCalculator': { getDoubleOccupancyRoomRetailValue: (value) => typeof value === 'number' ? value * 2 : undefined },
  '@/lib/date': date,
  './syncIntegrity': integrity,
});

function row(overrides = {}) {
  return {
    bookingId: '123456', shipName: 'Icon of the Seas', sailingStartDate: '2026-04-02', sailingEndDate: '2026-04-09',
    departurePort: 'Miami, Florida', itinerary: 'Western Caribbean', cruiseTitle: '7 Night Western Caribbean',
    cabinType: 'Balcony', cabinNumberOrGTY: '', numberOfGuests: '2', numberOfNights: 7,
    status: 'completed', sourcePage: 'Past Trips',
    interiorPrice: '', oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '', portList: '',
    ...overrides,
  };
}

const valid = transformers.transformBookedCruisesToAppFormat([row()], null, 'royal')[0];
assert.equal(valid.status, 'completed');
assert.equal(valid.validationStatus, 'valid');
assert.equal(valid.dataConfidence, 'verified');
assert.equal(valid.nights, 7);

const missingEnd = transformers.transformBookedCruisesToAppFormat([row({ sailingEndDate: '' })], null, 'royal')[0];
assert.equal(missingEnd.status, 'reviewNeeded');
assert.equal(missingEnd.validationStatus, 'quarantined');
assert.equal(missingEnd.completionState, undefined);

const textOnly = transformers.transformBookedCruisesToAppFormat([row({ sailingEndDate: '', numberOfNights: undefined })], null, 'royal')[0];
assert.equal(textOnly.status, 'reviewNeeded');
assert.equal(textOnly.validationStatus, 'quarantined');
assert.equal(textOnly.nights, 7, 'text evidence may be retained without becoming a verified completed schedule');

const conflict = transformers.transformBookedCruisesToAppFormat([row({ numberOfNights: 5 })], null, 'royal')[0];
assert.equal(conflict.status, 'reviewNeeded');
assert.equal(conflict.validationStatus, 'quarantined');

const impossibleDate = transformers.transformBookedCruisesToAppFormat([row({ sailingStartDate: '2026-02-29' })], null, 'royal')[0];
assert.equal(impossibleDate.status, 'reviewNeeded');
assert.equal(impossibleDate.validationStatus, 'quarantined');

console.log('Royal malformed-record regression checks passed');
