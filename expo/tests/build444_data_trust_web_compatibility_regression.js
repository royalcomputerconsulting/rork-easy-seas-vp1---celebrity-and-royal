const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'app/data-trust-center.tsx'), 'utf8');

assert.match(source, /Alert, Platform, ScrollView/);
assert.match(source, /const isWebPreview = Platform\.OS === 'web'/);
assert.match(source, /if \(isWebPreview\) \{\s*setDiagnostics\(\[\]\); setDomainDiagnostics\(\[\]\); setIssues\(\[\]\); setRepairHistory\(\[\]\)/);
assert.match(source, /if \(isWebPreview\) return undefined; let cancelled = false/);
assert.match(source, /iOS trust tools protected in browser preview/);
assert.match(source, /disabled=\{!!busy \|\| isWebPreview\}/);
assert.match(source, /editable=\{!isWebPreview\}/);

for (const operation of ['runIntegrity', 'migrate', 'createBackup', 'pickRestore', 'applySafeRestore']) {
  const start = source.indexOf(`const ${operation} = async`);
  assert.ok(start >= 0, `${operation} is missing.`);
  const sample = source.slice(start, start + 260);
  assert.match(sample, /if \(isWebPreview\)/, `${operation} can still open a native SQLite or filesystem path in the browser preview.`);
}

console.log('PASS build444_data_trust_web_compatibility_regression');
