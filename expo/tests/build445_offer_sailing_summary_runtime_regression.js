const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/cruiseInventory/CruiseInventoryRepository.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;

let capturedSql = '';
let capturedParams = [];
const mockDb = {
  execAsync: async () => undefined,
  runAsync: async () => ({ changes: 1, lastInsertRowId: 1 }),
  getAllAsync: async () => [],
  getFirstAsync: async (sql, params) => {
    if (!String(sql).includes('WITH offer_rows AS')) return null;
    capturedSql = sql;
    capturedParams = params;
    return {
      total: 3151,
      cabin_types: 'Balcony,Interior,Ocean View,Suite',
      guest_counts: '1,2',
      point_requirements: '3000',
      minimum_room_value: 420,
      maximum_room_value: 8400,
      minimum_nights: 2,
      maximum_nights: 18,
    };
  },
};

const stubs = {
  'expo-sqlite': { openDatabaseAsync: async () => mockDb },
  '@/lib/performance/performanceDiagnostics': {
    beginPerformanceSpan: () => () => undefined,
    recordPerformanceCount: () => undefined,
  },
  './cruiseCanonicalIdentity': {
    getCanonicalCruiseInventoryKey: () => 'physical',
    getCruiseInventoryOptionKey: () => 'option',
    getCruiseInventoryProvider: () => 'royal',
    getCruiseInventorySourceIdentity: () => 'source',
    getCruiseOfferInstanceKey: () => 'instance',
    selectCruiseInventoryProviderRows: (rows) => rows,
  },
};
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return originalLoad.call(this, request, parent, isMain);
};
let repository;
try {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  repository = mod.exports.cruiseInventoryRepository;
} finally {
  Module._load = originalLoad;
}

(async () => {
  await repository.initialize();
  const summary = await repository.queryOfferSailingSummary({ ownerScopeId: 'person@example.com', offerInstanceKey: 'PLAYER-OFFER-1' });
  assert.equal(summary.total, 3151);
  assert.deepEqual(summary.cabinTypes, ['Balcony', 'Interior', 'Ocean View', 'Suite']);
  assert.deepEqual(summary.guestCounts, [1, 2]);
  assert.deepEqual(summary.pointRequirements, [3000]);
  assert.equal(summary.minimumRoomValue, 420);
  assert.equal(summary.maximumRoomValue, 8400);
  assert.equal(summary.minimumNights, 2);
  assert.equal(summary.maximumNights, 18);
  assert.match(capturedSql, /GROUP_CONCAT\(DISTINCT cabin_type\)/);
  assert.match(capturedSql, /MIN\(NULLIF\(full_room_value, 0\)\)/);
  assert.match(capturedSql, /relationships\.offer_instance_key=\?/);
  assert.deepEqual(capturedParams, ['person@example.com', 'player-offer-1']);

  const overview = fs.readFileSync(path.join(root, 'app/(tabs)/(overview)/index.tsx'), 'utf8');
  const card = fs.readFileSync(path.join(root, 'components/CasinoOfferCard.tsx'), 'utf8');
  assert.match(overview, /queryOfferSailingSummary/);
  assert.match(overview, /bestTotal === 0/, 'code fallback must never combine populated distinct provider instances');
  assert.match(card, /All eligible sailing rows/);
  assert.match(card, /All eligible sailing prices/);
  assert.match(card, /sailingSummary\?\.guestCounts/);
  assert.match(card, /sailingSummary\?\.cabinTypes/);
  console.log('PASS build445_offer_sailing_summary_runtime_regression');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
