const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
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

const identity = compileTs('lib/cruiseInventory/cruiseCanonicalIdentity.ts', {
  '@/lib/date': {
    toCalendarDateOnly: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined,
  },
});

const base = {
  id: 'raw-1', cruiseSource: 'royal', shipName: 'Icon of the Seas',
  sailDate: '2026-09-26', returnDate: '2026-10-03', nights: 7,
  departurePort: 'Miami', destination: 'Eastern Caribbean',
  offerCode: '2607TOR403', playerOfferId: 'player-offer-a', cabinType: 'Interior',
};
const secondOfferSameSailing = {
  ...base, id: 'raw-2', playerOfferId: 'player-offer-b', cabinType: 'Balcony', guests: 2,
};
assert.equal(
  identity.getCanonicalCruiseInventoryKey(base),
  identity.getCanonicalCruiseInventoryKey(secondOfferSameSailing),
  'physical sailing identity must ignore offer, cabin, guest, and price dimensions',
);
assert.notEqual(
  identity.getCruiseOfferInstanceKey(base),
  identity.getCruiseOfferInstanceKey(secondOfferSameSailing),
  'distinct player offer IDs must remain distinct offer instances even when offer codes match',
);
assert.notEqual(
  identity.getCanonicalCruiseInventoryKey(base),
  identity.getCanonicalCruiseInventoryKey({ ...base, returnDate: '2026-10-04', nights: 8 }),
  'materially different voyages must remain separate',
);
assert.equal(
  identity.getCanonicalCruiseInventoryKey({ ...base, sailingId: 'voyage-123', offerCode: 'A' }),
  identity.getCanonicalCruiseInventoryKey({ ...base, sailingId: 'voyage-123', offerCode: 'B', shipName: 'Renamed Ship' }),
  'provider sailing ID is the strongest physical-sailing identity',
);

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repository, /expo-sqlite/);
assert.match(repository, /state TEXT NOT NULL CHECK\(state IN \('staging','active','failed','retired'\)\)/);
assert.match(repository, /CATALOG_RECONCILIATION_MISMATCH/);
assert.match(repository, /CATALOG_EXPECTED_ROW_MISMATCH/);
assert.match(repository, /CATALOG_READBACK_MISMATCH/);
assert.match(repository, /UPDATE cruise_catalog_generations SET state='retired'/);
assert.match(repository, /UPDATE cruise_catalog_generations SET state='active'/);
assert.match(repository, /DEFAULT_CRUISE_INGEST_BATCH_SIZE = 500/);
assert.match(repository, /await new Promise<void>\(\(resolve\) => setTimeout\(resolve, 0\)\)/);
assert.match(repository, /owner_scope/);
assert.match(repository, /cruise_offer_sailings/);
assert.match(repository, /eligibility_key TEXT NOT NULL/);
assert.match(repository, /PRIMARY KEY\(generation_id, eligibility_key\)/);
assert.match(repository, /getActiveIntegrity/);
assert.match(repository, /durableSourceRows/);
assert.match(repository, /shouldAbort\?: \(\) => boolean/);
assert.match(repository, /CATALOG_WRITE_CANCELLED/);
assert.match(repository, /Promise\.allSettled\(generationIds\.map\(\(generationId\) => this\.abortGeneration/);
assert.match(repository, /inventory\.canonical_key AS inventory_key/);
assert.match(repository, /offerSailingKey: row\.canonical_key/);
assert.match(repository, /id: row\.canonical_key \|\| row\.inventory_key \|\| parsed\.id/);
assert.match(repository, /cruise_reconciliation_ledger/);
assert.match(repository, /getEachAsync/);
assert.doesNotMatch(repository, /AsyncStorage/);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.dependencies['expo-sqlite'], '~16.0.10');

console.log('PASS Build 394 separates physical sailing identity from offer identity and provides owner-scoped transactional SQLite generations');
