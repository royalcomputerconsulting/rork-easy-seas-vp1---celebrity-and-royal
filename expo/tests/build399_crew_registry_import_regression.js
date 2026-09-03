const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/crewRecognitionImport.ts');
const source = fs.readFileSync(filename, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(output, filename);

const csv = fs.readFileSync(path.join(root, 'tests/fixtures/crew/master_registry_multisailing.csv'), 'utf8');
const parsedCsv = mod.exports.parseCrewRecognitionImport(csv, 'tester@example.com');
assert.equal(parsedCsv.format, 'csv');
assert.equal(parsedCsv.entries.length, 3, 'one crew member with two sailing dates must create two recognition rows');
assert.equal(parsedCsv.sailings.length, 3);
assert.equal(parsedCsv.entries[0].fullName, 'Doe, Jane', 'quoted commas must survive CSV parsing');
assert.deepEqual(parsedCsv.entries.filter((row) => row.fullName === 'Doe, Jane').map((row) => row.sailStartDate), ['2025-04-20', '2026-09-10']);

const text = `Ship: Radiance of the Seas
Sailing: 2026-09-26
John Smith | Casino | Dealer | Excellent service

Ship: Celebrity Equinox
Sailing: 2026-10-03; 2026-11-07
Maria Garcia | Beverage | Bartender`;
const parsedText = mod.exports.parseCrewRecognitionImport(text, 'tester@example.com');
assert.equal(parsedText.format, 'text');
assert.equal(parsedText.entries.length, 3);
assert.equal(parsedText.sailings.length, 3);
assert.deepEqual(parsedText.entries.filter((row) => row.fullName === 'Maria Garcia').map((row) => row.sailStartDate), ['2026-10-03', '2026-11-07']);
assert.equal(new Set(parsedText.entries.map(mod.exports.crewEntryIdentity)).size, 3);

const modal = fs.readFileSync(path.join(root, 'components/crew-recognition/ImportCrewTextModal.tsx'), 'utf8');
assert.match(modal, /\.csv,.txt/);
assert.match(modal, /multiple ships and sailings/i);
const provider = fs.readFileSync(path.join(root, 'state/CrewRecognitionProvider.tsx'), 'utf8');
assert.match(provider, /Existing data is merged, never replaced/);

console.log('PASS Build 399 multi-ship CSV/text crew registry import regression');
