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
const authority = loadStandaloneTs('lib/dataAuthority.ts', { './date': date });
const identity = loadStandaloneTs('lib/dataIdentity.ts', { './date': date, './dataAuthority': authority });

assert.equal(date.toCalendarDateOnly('2026-12-31T23:30:00-10:00'), '2026-12-31');
assert.equal(date.toCalendarDateOnly('December 32, 2026'), undefined);
assert.equal(date.addCalendarDateDays('2026-12-30', 3), '2027-01-02');
assert.equal(date.compareCalendarDates('2026-12-31T23:30:00-10:00', '2027-01-01'), -1);

const providerRecord = authority.canonicalizeDataRecord({
  id: 'provider',
  sailDate: '2026-12-31T23:30:00-10:00',
  returnDate: '2027-01-07T02:00:00+14:00',
  sourceProvider: 'royal',
  sourceRecordId: 'reservation-1',
  dataConfidence: 'verified',
  validationStatus: 'valid',
  sourceEvidence: { rawCategory: 'booked_cruise' },
});
assert.equal(providerRecord.sailDate, '2026-12-31');
assert.equal(providerRecord.returnDate, '2027-01-07');
assert.equal(providerRecord.sourceAuthority, 'provider');
assert.equal(providerRecord.sourceEvidence.authority, 'provider');

const invalidRecord = authority.canonicalizeDataRecord({
  id: 'invalid',
  sailDate: '2026-02-29',
  sourceProvider: 'royal',
  dataConfidence: 'verified',
});
assert.equal(invalidRecord.validationStatus, 'quarantined');
assert.equal(invalidRecord.dataConfidence, 'partial');
assert.equal(invalidRecord.sourceAuthority, 'unknown');
assert.match(invalidRecord.sourceEvidence.reason, /Invalid calendar date evidence/);

const reconciled = identity.dedupeBookedCruises([
  { ...providerRecord, reservationNumber: 'R-1', ownerProfileId: 'profile-a', cruiseSource: 'royal', shipName: 'Icon of the Seas', nights: 7 },
  { ...invalidRecord, reservationNumber: 'R-1', ownerProfileId: 'profile-a', cruiseSource: 'royal', shipName: 'Unknown ship', nights: 5 },
]);
assert.equal(reconciled.length, 1);
assert.equal(reconciled[0].sailDate, '2026-12-31');
assert.equal(reconciled[0].sourceAuthority, 'provider');

const coreData = fs.readFileSync(path.join(root, 'state/CoreDataProvider.tsx'), 'utf8');
const storageLoaders = fs.readFileSync(path.join(root, 'state/coreData/storageLoaders.ts'), 'utf8');
assert.match(coreData, /canonicalizeDataRecords\(owned/);
assert.match(coreData, /canonicalizeDataRecord\(cruise/);
assert.match(storageLoaders, /canonicalizeDataRecords/);

console.log('Canonical record integrity regression checks passed');
