const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const primitives = read('components/ui/EasySeasPrimitives.tsx');
for (const state of ['loading', 'empty', 'missing', 'estimated', 'reconciled', 'offline', 'error', 'partial-success', 'success']) {
  assert.ok(primitives.includes(`'${state}'`) || primitives.includes(`${state}:`), `shared state language must include ${state}`);
}
assert.match(primitives, /function DataStateCard/, 'a canonical data-state surface must exist');
assert.match(primitives, /Counts remain unavailable until readback finishes|No durable data commit has been reported yet\./, 'loading language must not masquerade as a final zero');
assert.match(primitives, /Source:/, 'state surfaces must be able to expose provenance');
assert.match(primitives, /Updated /, 'state surfaces must be able to expose freshness');
assert.match(primitives, /Current item:/, 'long operations must identify their current item');
assert.match(primitives, /of \{total\?\.toLocaleString\(\)\}/, 'long operations must expose current and total counts');
assert.match(primitives, /secondaryActionLabel/, 'state surfaces must support a secondary repair path');

const operation = read('components/ui/OperationStatusCard.tsx');
for (const status of ['running', 'success', 'partial-success', 'offline', 'error', 'cancelled']) {
  assert.ok(operation.includes(`'${status}'`), `operation feedback must distinguish ${status}`);
}
for (const action of ['Cancel safely', 'Retry', 'Undo']) {
  assert.ok(operation.includes(action), `operation feedback must retain ${action}`);
}
assert.match(operation, /Durable data commit|Final output or durable data commit verified/, 'operation feedback must distinguish committed output');
assert.match(operation, /Existing app data was preserved/, 'failed or cancelled operations must explicitly preserve existing data');

const consumers = [
  ['app/(tabs)/(overview)/index.tsx', 'offers-hydration-loading'],
  ['app/(tabs)/scheduling.tsx', 'cruises-catalog-loading'],
  ['app/(tabs)/booked.tsx', 'booked-cruises-loading'],
];
for (const [file, testId] of consumers) {
  const source = read(file);
  assert.match(source, /DataStateCard/, `${file} must consume the canonical state surface`);
  assert.ok(source.includes(testId), `${file} must expose its truthful loading state for device tests`);
  assert.match(source, /remain unavailable until (?:repository )?readback finishes/, `${file} must not present loading repositories as a final zero`);
}

console.log('build445 item 11 standard state language regression passed');
