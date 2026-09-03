const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/storage/quotaSafeStorage.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: filename,
}).outputText;

const asyncValues = new Map();
const asyncStorage = {
  async getItem(key) { return asyncValues.has(key) ? asyncValues.get(key) : null; },
  async setItem(key, value) { asyncValues.set(key, value); },
  async removeItem(key) { asyncValues.delete(key); },
};

const files = new Map();
const directories = new Set();
const fileSystem = {
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  async getInfoAsync(target) {
    return { exists: files.has(target) || directories.has(target) };
  },
  async makeDirectoryAsync(target) { directories.add(target); },
  async readAsStringAsync(target) {
    if (!files.has(target)) throw new Error(`missing ${target}`);
    return files.get(target);
  },
  async writeAsStringAsync(target, value) { files.set(target, value); },
  async deleteAsync(target) { files.delete(target); directories.delete(target); },
  async copyAsync({ from, to }) {
    if (!files.has(from)) throw new Error(`missing ${from}`);
    files.set(to, files.get(from));
  },
  async moveAsync({ from, to }) {
    if (!files.has(from)) throw new Error(`missing ${from}`);
    files.set(to, files.get(from));
    files.delete(from);
  },
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return { __esModule: true, default: asyncStorage };
  if (request === 'react-native') return { Platform: { OS: 'ios' } };
  if (request === 'expo-file-system/legacy') return fileSystem;
  if (request === './persistenceCoordinator' || request === './diagnosticJournal') {
    const resolved = path.join(path.dirname(filename), `${request.slice(2)}.ts`);
    const moduleSource = fs.readFileSync(resolved, 'utf8');
    const moduleCompiled = ts.transpileModule(moduleSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: resolved,
    }).outputText;
    const child = new Module(resolved, parent);
    child.filename = resolved;
    child.paths = Module._nodeModulePaths(path.dirname(resolved));
    child._compile(moduleCompiled, resolved);
    return child.exports;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let storage;
try {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  storage = mod.exports;
} finally {
  Module._load = originalLoad;
}

(async () => {
  const key = 'easyseas_cruises::scott@example.com';
  const first = Array.from({ length: 240 }, (_, index) => ({ id: `first-${index}`, ship: 'Test Ship' }));
  const second = Array.from({ length: 260 }, (_, index) => ({ id: `second-${index}`, ship: 'Next Ship' }));

  await storage.quotaSafeSetJsonItem(key, first);
  const firstPointerRaw = asyncValues.get(key);
  assert.match(firstPointerRaw, /^__EASYSEAS_FILE_V1__:/, 'bulky native value must be represented by a file pointer');
  const firstPointer = JSON.parse(firstPointerRaw.slice('__EASYSEAS_FILE_V1__:'.length));
  assert.deepEqual(JSON.parse(files.get(firstPointer.path)), first, 'first native snapshot must be exact');

  await storage.quotaSafeSetJsonItem(key, second);
  const secondPointerRaw = asyncValues.get(key);
  const secondPointer = JSON.parse(secondPointerRaw.slice('__EASYSEAS_FILE_V1__:'.length));
  assert.deepEqual(JSON.parse(await storage.quotaSafeGetItem(key)), second, 'latest native snapshot must read back exactly');

  files.set(secondPointer.path, '{corrupt json');
  const recovered = await storage.quotaSafeGetJsonItem(key, [], Array.isArray);
  assert.deepEqual(recovered, first, 'corrupt primary snapshot must recover the last-known-good collection');
  assert.ok(asyncValues.has(`${key}::__corrupt__`), 'corrupt payload must be quarantined for diagnostics');

  await storage.quotaSafeRemoveItem(key);
  assert.equal(asyncValues.has(key), false, 'remove must clear pointer metadata');
  assert.equal(files.has(secondPointer.path), false, 'remove must clear native primary data');

  console.log('PASS build334_resilient_storage_runtime_regression — native file pointers, exact readback, corruption quarantine, last-good recovery, and removal verified');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
