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
  support.assessCarnivalRateCodePagination({ requestedPages: 3, acknowledgedPages: 3, expectedPages: 3, receivedRows: 120, complete: true }),
  { requestedPages: 3, acknowledgedPages: 3, expectedPages: 3, receivedRows: 120, complete: true, status: 'captured', reason: '' },
);

const missingPage = support.assessCarnivalRateCodePagination({ requestedPages: 3, acknowledgedPages: 2, expectedPages: 3, complete: true });
assert.equal(missingPage.complete, false);
assert.equal(missingPage.status, 'incomplete');
assert.match(missingPage.reason, /2\/3/);

const noExpectedCount = support.assessCarnivalRateCodePagination({ requestedPages: 1, acknowledgedPages: 1, expectedPages: 0, complete: true });
assert.equal(noExpectedCount.complete, false);
assert.match(noExpectedCount.reason, /without an expected page count/);

const noCollectorAcknowledgement = support.assessCarnivalRateCodePagination({ requestedPages: 1, acknowledgedPages: 1, expectedPages: 1, complete: false });
assert.equal(noCollectorAcknowledgement.complete, false);
assert.equal(noCollectorAcknowledgement.status, 'incomplete');

console.log('Carnival pagination evidence regression checks passed');
