const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/carnival/syncSupport.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '../storage/quotaSafeStorage') return { quotaSafeGetJsonItem: async (_key, fallback) => fallback, quotaSafeSetJsonItem: async () => {}, quotaSafeRemoveItem: async () => {} };
  if (request === '@react-native-async-storage/async-storage') return { default: {} };
  if (request === '@/lib/storage/storageKeys') return { ALL_STORAGE_KEYS: {}, getUserScopedKey: (key) => key };
  return originalLoad.call(this, request, parent, isMain);
};
let support;
try {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  support = mod.exports;
} finally {
  Module._load = originalLoad;
}

assert.deepEqual(
  support.parseCarnivalVifpPayload({ PastGuestNumber: 1234, TierCode: '03', FirstName: ' Ada ', LastName: 'Lovelace', Points: 0, CruiseDays: 17, CruiseCount: 4 }),
  { vifpNumber: '1234', vifpTier: 'Platinum', firstName: 'Ada', lastName: 'Lovelace', vifpPoints: '0', cruiseDayPoints: '17', cruiseCount: '4' },
);
assert.deepEqual(
  support.parseCarnivalVifpPayload({ vifpNumber: 'A-7', tierName: 'Sapphire', VifpPoints: '  ' }),
  { vifpNumber: 'A-7', vifpTier: 'Sapphire', firstName: '', lastName: '', vifpPoints: '', cruiseDayPoints: '', cruiseCount: '' },
);
assert.equal(support.parseCarnivalVifpPayload({}), null);
assert.equal(support.parseCarnivalVifpPayload(null), null);

const provider = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
assert.match(provider, /parseCarnivalVifpPayload/);
assert.doesNotMatch(provider, /const tierMap: Record<string, string> = \{ '01': 'Red'/);
console.log('Carnival VIFP payload boundary regression checks passed');
