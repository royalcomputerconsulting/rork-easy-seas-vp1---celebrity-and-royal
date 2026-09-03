const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) { return Object.prototype.hasOwnProperty.call(stubs, request) ? stubs[request] : originalLoad.call(this, request, parent, isMain); };
  try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled, filename); return mod.exports; }
  finally { Module._load = originalLoad; }
}

const catalog = compileTs('lib/certificates/certificateCatalog.ts', {
  '@/lib/certificates/certificatePdfParserCore': { DEFAULT_CERTIFICATE_POINTS: { '01': 25000 }, DEFAULT_CERTIFICATE_FAMILIES: ['A', 'C'], parseCertificateCode: (code) => ({ code, monthCode: code.slice(0, 4), family: code.slice(4, 5), levelCode: code.slice(5), recognizedFamily: true }) },
});

const beforeWindow = catalog.getCertificateMonthAvailability(new Date(2026, 7, 21, 12));
assert.equal(beforeWindow.currentMonthCode, '2608');
assert.equal(beforeWindow.nextMonthCode, '2609');
assert.equal(beforeWindow.nextMonthAvailable, false);
assert.equal(beforeWindow.nextMonthOpensOn, '2026-08-22');
assert.equal(beforeWindow.daysUntilNextMonthAvailable, 1);

const firstWindowDay = catalog.getCertificateMonthAvailability(new Date(2026, 7, 22, 0, 1));
assert.equal(firstWindowDay.nextMonthAvailable, true);

const rollover = catalog.getCertificateMonthAvailability(new Date(2026, 8, 1, 0, 1));
assert.equal(rollover.currentMonthCode, '2609', 'the prior future month must become the current month automatically');
assert.equal(rollover.nextMonthCode, '2610');
assert.equal(rollover.nextMonthAvailable, false);
assert.equal(rollover.nextMonthOpensOn, '2026-09-21');

for (const relative of ['app/certificate-codes.tsx', 'app/certificate-lookup.tsx', 'app/certificate-summary.tsx']) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.match(source, /useCertificateMonthAvailability\(10\)/, `${relative} must use the live date-driven publication window`);
  assert.match(source, /nextMonthAvailable/, `${relative} must block unpublished next-month catalogs`);
  assert.match(source, /currentMonthCode/, `${relative} must react to month rollover`);
}

const summarySource = fs.readFileSync(path.join(root, 'app/certificate-summary.tsx'), 'utf8');
assert.match(summarySource, /restored\?\.target === 'nextMonth' && !monthAvailability\.nextMonthAvailable/, 'Cert Summary must not restore a next-month view before that catalog is published');
assert.match(summarySource, /certificateMonths: \[monthKey\(restoredTarget\)\]/, 'restored summary filters must follow the date-clamped month target');

console.log('Build 440 certificate month rollover regression passed.');
