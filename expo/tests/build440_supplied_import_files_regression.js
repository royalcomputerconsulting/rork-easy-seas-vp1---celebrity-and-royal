const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) { return Object.prototype.hasOwnProperty.call(stubs, request) ? stubs[request] : originalLoad.call(this, request, parent, isMain); };
  try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled, filename); return mod.exports; }
  finally { Module._load = originalLoad; }
}

const offersPath = process.env.EASYSEAS_TEST_OFFERS_CSV;
const crewPath = process.env.EASYSEAS_TEST_CREW_XLSX;
const completedPath = process.env.EASYSEAS_TEST_COMPLETED_CSV;
const backupPaths = String(process.env.EASYSEAS_TEST_BACKUPS || '').split(path.delimiter).filter(Boolean);

assert.ok(offersPath && fs.existsSync(offersPath), 'EASYSEAS_TEST_OFFERS_CSV must identify the supplied offers CSV');
assert.ok(crewPath && fs.existsSync(crewPath), 'EASYSEAS_TEST_CREW_XLSX must identify the supplied crew workbook');
assert.ok(completedPath && fs.existsSync(completedPath), 'EASYSEAS_TEST_COMPLETED_CSV must identify the supplied completed-cruise CSV');
assert.ok(backupPaths.length >= 2 && backupPaths.every(fs.existsSync), 'EASYSEAS_TEST_BACKUPS must identify both supplied backups');

const csvParser = compileTs('lib/csv/csvParser.ts');
const offersParser = compileTs('lib/csv/offersParser.ts', {
  './csvParser': csvParser,
  '@/lib/valueCalculator': { getDoubleOccupancyRoomRetailValue: (value) => Number(value || 0) * 2 },
  '@/lib/cruiseRecordIntegrity': { knownNightCount: (value) => Number(value || 0) || 0 },
});
const parsedOffers = offersParser.parseOffersCSV(fs.readFileSync(offersPath, 'utf8'));
const suppliedOfferDataRows = fs.readFileSync(offersPath, 'utf8').split(/\r?\n/).filter((line) => line.trim()).length - 1;
const suppliedOfferCodes = new Set(parsedOffers.cruises.map((row) => row.offerCode).filter(Boolean));
assert.equal(parsedOffers.cruises.length, suppliedOfferDataRows, 'all currently supplied offer-sailing rows must remain available one-for-one');
assert.equal(parsedOffers.offers.length, suppliedOfferCodes.size, 'the offer-instance count must match the distinct codes in the currently supplied file');
assert.ok(parsedOffers.cruises.every((row) => row.shipName && row.sailDate), 'every parsed option must retain ship and sail date');
assert.ok(parsedOffers.cruises.every((row) => row.guestsInfo), 'every parsed option must retain row-level guest eligibility');

const crewWorkbook = compileTs('lib/crewRecognitionWorkbook.ts');
const crewImport = compileTs('lib/crewRecognitionImport.ts');
const workbookBytes = fs.readFileSync(crewPath);
const converted = crewWorkbook.crewWorkbookBytesToCsv(workbookBytes);
assert.equal(converted.sheetName, 'Master Registry');
assert.equal(converted.rowCount, 776, 'the supplied master registry must expose all 776 data rows');
const parsedCrew = crewImport.parseCrewRecognitionImport(converted.csv, 'fixture-owner');
assert.ok(parsedCrew.entries.length >= 776, 'crew import must retain at least one recognition row per master-registry row');
assert.ok(parsedCrew.entries.every((row) => row.userId === 'fixture-owner'), 'crew data must be owner scoped');

const completedLines = fs.readFileSync(completedPath, 'utf8').split(/\r?\n/).filter((line) => line.trim());
assert.equal(completedLines.length, 37, 'completed history fixture must retain header, 33 cruise rows, and three total rows');
assert.match(completedLines[0], /Club Royale Casino Points/);
assert.match(completedLines[0], /Winnings Home/);

for (const backupPath of backupPaths) {
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  for (const key of ['cruises', 'bookedCruises', 'casinoOffers', 'calendarEvents', 'casinoSessions', 'certificates', 'users', 'machines', 'crewRecognition', 'casinoData']) {
    assert.ok(Object.prototype.hasOwnProperty.call(backup, key), `${path.basename(backupPath)} must retain ${key}`);
  }
  assert.ok(Array.isArray(backup.cruises) && backup.cruises.length >= 2500, `${path.basename(backupPath)} must exercise large-catalog restore`);
}

console.log(`Build 440 supplied fixtures passed: ${parsedOffers.cruises.length} offer rows, ${parsedOffers.offers.length} offers, ${converted.rowCount} crew rows, 36 completed data/total rows, and ${backupPaths.length} backups.`);
