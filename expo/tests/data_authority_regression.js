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

const verified = {
  id: 'verified', reservationNumber: 'RC-123', ownerProfileId: 'profile-a', cruiseSource: 'royal',
  shipName: 'Icon of the Seas', sailDate: '2026-04-02', returnDate: '2026-04-09', nights: 7,
  dataConfidence: 'verified', validationStatus: 'valid', isFallback: false,
};
const quarantinedFallback = {
  id: 'fallback', reservationNumber: 'RC-123', ownerProfileId: 'profile-a', cruiseSource: 'royal',
  shipName: 'Unknown ship', sailDate: '2026-02-29', returnDate: '2026-02-30', nights: 5,
  dataConfidence: 'verified', validationStatus: 'quarantined', isFallback: true,
};

const reconciled = identity.dedupeBookedCruises([verified, quarantinedFallback]);
assert.equal(reconciled.length, 1);
assert.equal(reconciled[0].shipName, 'Icon of the Seas');
assert.equal(reconciled[0].sailDate, '2026-04-02');
assert.equal(reconciled[0].returnDate, '2026-04-09');
assert.equal(reconciled[0].nights, 7);
assert.doesNotMatch(identity.getCruiseIdentityKey({ ...verified, sailDate: '2026-02-29', returnDate: undefined }), /2026-02-29/);

console.log('Data-authority regression checks passed');
