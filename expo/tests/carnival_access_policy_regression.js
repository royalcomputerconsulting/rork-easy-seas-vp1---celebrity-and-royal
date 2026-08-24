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

assert.equal(support.getCarnivalSyncAccess('').state, 'authentication_required');
assert.equal(support.getCarnivalSyncAccess('profile-a').state, 'enabled');
assert.equal(support.getCarnivalSyncAccess.length, 1);

const source = fs.readFileSync(filename, 'utf8');
assert.match(source, /Carnival sync is an on-device workflow/);
assert.doesNotMatch(source, /CarnivalRemoteAccessPolicy/);
assert.doesNotMatch(source, /resolveCarnivalSyncAccess/);
assert.doesNotMatch(source, /CARNIVAL_SYNC_ROLLOUT_ENABLED/);
console.log('Carnival local access regression checks passed');
