const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filename = path.join(root, 'lib/certificates/certificateStackingLedger.ts');
const output = ts.transpileModule(read('lib/certificates/certificateStackingLedger.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@/lib/storage/quotaSafeStorage') return { quotaSafeGetJsonItem: async () => [], quotaSafeSetJsonItem: async () => undefined };
  return originalLoad.call(this, request, parent, isMain);
};
let lib;
try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); lib = mod.exports; } finally { Module._load = originalLoad; }

const rows = lib.mergeStackingLedger(['2608C01', '2608A01'], [], new Date('2026-08-21T12:00:00Z'));
assert.equal(rows.length, 14, 'seven stacking dimensions must exist for each certificate code');
assert.equal(new Set(rows.map((row) => row.id)).size, 14);
assert.ok(rows.every((row) => row.status === 'unknown' && row.outcome === 'unknown'), 'the app must never invent stacking claims');

const inferred = { ...rows[0], status: 'terms_inferred', outcome: 'conditional', evidence: 'Terms appear to permit this only on select sailings.' };
assert.deepEqual(lib.validateStackingRule(inferred), []);
const unsupported = { ...rows[1], status: 'verified', outcome: 'can_stack', evidence: 'yes' };
assert.ok(lib.validateStackingRule(unsupported).some((error) => /evidence/i.test(error)));
assert.ok(lib.validateStackingRule({ ...unsupported, evidence: 'Official Royal terms state this combination is allowed.', sourceLabel: '' }).some((error) => /official source/i.test(error)));
assert.deepEqual(lib.validateStackingRule({ ...unsupported, evidence: 'Official Royal terms state this combination is allowed.', sourceLabel: 'Royal certificate terms' }), []);

const screen = read('app/certificate-stacking-ledger.tsx');
const portfolio = read('app/certificate-portfolio.tsx');
assert.match(screen, /Unknown remains unknown until documented/);
assert.match(screen, /Host confirmed/);
assert.match(screen, /Supporting evidence/);
assert.match(screen, /stacking-ledger\.save/);
assert.match(portfolio, /certificate-portfolio\.stacking-ledger/);

console.log('PASS build402_certificate_stacking_ledger_regression — seven combinations per code, unknown-by-default safety, evidence validation, official-source verification, and local ledger UI verified');
