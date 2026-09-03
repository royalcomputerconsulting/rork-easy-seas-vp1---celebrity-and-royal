const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/storage/persistenceCoordinator.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText;
const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled, filename);
const pc = mod.exports;

(async () => {
  pc.resetPersistenceCoordinatorForTests();
  const order = [];
  const first = pc.enqueuePersistence({ key: 'same', runId: 'run1', hash: 'a', execute: async () => { order.push('first-start'); await new Promise(r => setTimeout(r, 20)); order.push('first-end'); return 1; } });
  const second = pc.enqueuePersistence({ key: 'same', runId: 'run2', hash: 'b', execute: async () => { order.push('second'); return 2; } });
  assert.equal(await first, 1);
  assert.equal(await second, 2);
  assert.deepEqual(order, ['first-start', 'first-end', 'second'], 'active run commits atomically; replacement runs next without invalidating the active pointer');

  const gate = {};
  gate.promise = new Promise((resolve) => { gate.resolve = resolve; });
  const active = pc.enqueuePersistence({ key: 'coalesce', runId: 'active', execute: async () => { await gate.promise; return 'active'; } });
  const superseded = pc.enqueuePersistence({ key: 'coalesce', runId: 'old-queued', execute: async () => 'old' });
  const newest = pc.enqueuePersistence({ key: 'coalesce', runId: 'newest', execute: async () => 'newest' });
  await assert.rejects(superseded, /SUPERSEDED/);
  gate.resolve();
  assert.equal(await active, 'active');
  assert.equal(await newest, 'newest');

  const parallel = [];
  await Promise.all([
    pc.enqueuePersistence({ key: 'a', runId: 'a1', execute: async () => { parallel.push('a-start'); await new Promise(r => setTimeout(r, 10)); parallel.push('a-end'); } }),
    pc.enqueuePersistence({ key: 'b', runId: 'b1', execute: async () => { parallel.push('b-start'); await new Promise(r => setTimeout(r, 5)); parallel.push('b-end'); } }),
  ]);
  assert.ok(parallel.indexOf('b-start') < parallel.indexOf('a-end'), 'different keys should run concurrently');
  await pc.flushPersistence();
  console.log('PASS build337_stage1_persistence_coordinator_runtime');
})().catch((error) => { console.error(error); process.exit(1); });
