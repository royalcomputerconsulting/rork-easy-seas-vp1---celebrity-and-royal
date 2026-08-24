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

const checkpoints = new Set([5_000, 25_000, 50_000, 100_000, 250_000]);
const physicalKeys = new Set();
const eligibilityKeys = new Set();
const observed = [];
const startedAt = Date.now();

for (let index = 0; index < 250_000; index += 1) {
  const physicalIndex = Math.floor(index / 4);
  const day = String((physicalIndex % 28) + 1).padStart(2, '0');
  const month = String((Math.floor(physicalIndex / 28) % 12) + 1).padStart(2, '0');
  const row = {
    id: `source-${index}`,
    sailingId: `provider-voyage-${physicalIndex}`,
    cruiseSource: physicalIndex % 7 === 0 ? 'carnival' : 'royal',
    shipName: `Fixture Ship ${physicalIndex % 31}`,
    sailDate: `2027-${month}-${day}`,
    returnDate: `2027-${month}-${day}`,
    nights: 7,
    playerOfferId: `player-offer-${index}`,
    offerCode: `FIXTURE${physicalIndex % 97}`,
    cabinType: ['Interior', 'Ocean View', 'Balcony', 'Suite'][index % 4],
    guests: (index % 3) + 1,
  };
  const physicalKey = identity.getCanonicalCruiseInventoryKey(row);
  const offerKey = identity.getCruiseOfferInstanceKey(row);
  assert.ok(physicalKey, `physical key missing at ${index}`);
  assert.ok(offerKey, `offer key missing at ${index}`);
  physicalKeys.add(physicalKey);
  eligibilityKeys.add(`${offerKey}|${physicalKey}|${row.cabinType}|${row.guests}`);

  const processed = index + 1;
  if (checkpoints.has(processed)) {
    observed.push({
      rows: processed,
      canonical: physicalKeys.size,
      eligibility: eligibilityKeys.size,
    });
  }
}

for (const result of observed) {
  assert.equal(result.canonical, Math.ceil(result.rows / 4), `canonical reconciliation at ${result.rows}`);
  assert.equal(result.eligibility, result.rows, `offer/cabin/guest eligibility loss at ${result.rows}`);
  assert.equal(result.rows, result.canonical + (result.rows - result.canonical), `raw reconciliation at ${result.rows}`);
}

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repository, /DEFAULT_CRUISE_INGEST_BATCH_SIZE = 500/);
assert.match(repository, /MAX_CRUISE_PAGE_SIZE = 200/);
assert.match(repository, /expected_raw_rows/);
assert.match(repository, /raw_rows !== row\.canonical_rows \+ row\.duplicates_merged \+ row\.rejected_rows/);
assert.match(repository, /state='active'/);
assert.match(repository, /pruneRetiredGenerations/);
assert.match(repository, /keepPerProvider = 2/);
assert.doesNotMatch(repository, /VACUUM/i);

const elapsedMs = Date.now() - startedAt;
console.log(`PASS Build 394 deterministic 5K/25K/50K/100K/250K fixtures: 250000 raw, ${physicalKeys.size} physical, ${eligibilityKeys.size} lossless eligibility rows in ${elapsedMs}ms`);
