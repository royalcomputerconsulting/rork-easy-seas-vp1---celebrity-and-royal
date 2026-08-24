const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/carnival/syncSupport.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '../storage/quotaSafeStorage') return { quotaSafeGetJsonItem: async (_key, fallback) => fallback, quotaSafeSetJsonItem: async () => {}, quotaSafeRemoveItem: async () => {} };
  if (request === '@react-native-async-storage/async-storage') {
    return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  }
  if (request === '@/lib/storage/storageKeys') {
    return { ALL_STORAGE_KEYS: { CARNIVAL_SYNC_CHECKPOINT: 'carnival_checkpoint' }, getUserScopedKey: (key) => key };
  }
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

const normalizeRows = (value) => Array.isArray(value) ? value : [];
const accumulators = new Map();

assert.equal(
  support.collectCarnivalSailingChunk(accumulators, {
    requestId: 9,
    offerCode: 'RATE-9',
    totalChunks: 2,
    chunkIndex: 2,
    sailings: [{ id: 'second' }],
  }, normalizeRows),
  null,
);
assert.equal(accumulators.size, 1);

const completed = support.collectCarnivalSailingChunk(accumulators, {
  requestId: 9,
  totalChunks: 2,
  chunkIndex: 1,
  isFinal: true,
  sailings: [{ id: 'first' }],
}, normalizeRows);
assert.deepEqual(completed, {
  offerCode: 'RATE-9',
  totalChunks: 2,
  rows: [{ id: 'first' }, { id: 'second' }],
});
assert.equal(accumulators.size, 0);

assert.equal(
  support.collectCarnivalSailingChunk(accumulators, {
    requestId: 10,
    offerCode: 'RATE-10',
    totalChunks: 3,
    chunkIndex: 3,
    isFinal: true,
    sailings: [{ id: 'third' }],
  }, normalizeRows),
  null,
  'a final message cannot complete a run with missing chunk indexes',
);
assert.equal(accumulators.get(10).chunks.size, 1);
assert.equal(
  support.collectCarnivalSailingChunk(accumulators, {
    requestId: 11,
    offerCode: 'RATE-11',
    totalChunks: 1,
    chunkIndex: 1,
    isFinal: true,
    sailings: [{ id: 'separate-request' }],
  }, normalizeRows).rows[0].id,
  'separate-request',
);
assert.equal(accumulators.has(10), true, 'a separate request must not merge or erase unfinished work');

console.log('Carnival chunk boundary regression checks passed');
