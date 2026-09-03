const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const offersPath = path.join(root, 'tests/fixtures/offers-current-2026-08-27.csv');
const crewPath = process.env.EASYSEAS_TEST_CREW_XLSX;
const completedPath = process.env.EASYSEAS_TEST_COMPLETED_CSV;
const backupPaths = String(process.env.EASYSEAS_TEST_BACKUPS || '').split(path.delimiter).filter(Boolean);

for (const [label, file] of [['packaged offers fixture', offersPath], ['crew workbook', crewPath], ['completed cruise CSV', completedPath]]) {
  assert.ok(file && fs.existsSync(file), `${label} is required for Build 444 supplied-file acceptance`);
}
assert.equal(backupPaths.length, 2, 'exactly two locally available supplied backups must be named');
assert.ok(backupPaths.every(fs.existsSync), 'each supplied backup must exist locally');

const offersParser = loadTs('lib/csv/offersParser.ts');
const parsedOffers = offersParser.parseOffersCSV(fs.readFileSync(offersPath, 'utf8'));
assert.equal(parsedOffers.cruises.length, 391);
assert.equal(parsedOffers.offers.length, 5);
assert.deepEqual([...new Set(parsedOffers.offers.map((offer) => offer.offerCode))].sort(), ['26BAF305', '26OCT104', '26PAS603', '26VAR503', '26WST203']);
assert.ok(parsedOffers.cruises.every((row) => row.shipName && row.sailDate));
assert.ok(parsedOffers.cruises.every((row) => row.cabinType || row.roomType || row.cabinCategory));
assert.ok(parsedOffers.cruises.every((row) => row.guestsInfo || row.numberOfGuests || row.guests));

const crewWorkbook = loadTs('lib/crewRecognitionWorkbook.ts');
const crewImport = loadTs('lib/crewRecognitionImport.ts');
const converted = crewWorkbook.crewWorkbookBytesToCsv(fs.readFileSync(crewPath));
assert.equal(converted.sheetName, 'Master Registry');
assert.equal(converted.rowCount, 776);
const parsedCrew = crewImport.parseCrewRecognitionImport(converted.csv, 'fixture-owner');
assert.ok(parsedCrew.entries.length >= 776);
assert.ok(parsedCrew.entries.every((row) => row.userId === 'fixture-owner'));

const completedText = fs.readFileSync(completedPath, 'utf8');
const completedWorkbook = XLSX.read(completedText, { type: 'string', raw: true });
const completedRows = XLSX.utils.sheet_to_json(completedWorkbook.Sheets[completedWorkbook.SheetNames[0]], { defval: '' });
assert.equal(completedRows.length, 36, 'completed CSV must retain 33 cruise rows and three total rows');
const cruiseRows = completedRows.filter((row) => row.Ship && row['Sail Date'] && !/total/i.test(String(row['Sail Date'])));
const totalRows = completedRows.filter((row) => /total/i.test(String(row['Sail Date'])));
assert.equal(cruiseRows.length, 33);
assert.equal(totalRows.length, 3);
assert.ok(cruiseRows.every((row) => row.Ship && row.Nights && row.Itinerary && row.Reservation));
assert.ok(Object.prototype.hasOwnProperty.call(cruiseRows[0], 'Club Royale Casino Points'));
assert.ok(Object.prototype.hasOwnProperty.call(cruiseRows[0], 'Winnings Home'));
const grandTotal = totalRows.find((row) => String(row['Sail Date']).toUpperCase() === 'GRAND TOTAL');
assert.ok(grandTotal);
assert.equal(Number(grandTotal.Nights), 179);
assert.equal(Number(grandTotal['Club Royale Casino Points']), 47_233, 'the supplied file value must remain raw file truth, not be silently rewritten to a different annual reconciliation');
assert.equal(Number(grandTotal['Net Cash']), 15_218.59);

let duplicateProfileIdsObserved = 0;
for (const backupPath of backupPaths) {
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  for (const key of ['cruises', 'bookedCruises', 'casinoOffers', 'calendarEvents', 'casinoSessions', 'certificates', 'users', 'machines', 'crewRecognition', 'casinoData']) {
    assert.ok(Object.prototype.hasOwnProperty.call(backup, key), `${path.basename(backupPath)} is missing ${key}`);
  }
  assert.ok(backup.cruises.length >= 2_500, `${path.basename(backupPath)} must exercise large-catalog restore`);
  duplicateProfileIdsObserved += backup.users.length - new Set(backup.users.map((user) => user.id)).size;
}
const userProviderSource = fs.readFileSync(path.join(root, 'state/UserProvider.tsx'), 'utf8');
assert.match(userProviderSource, /ensureUniqueUserProfileIds/);
assert.match(userProviderSource, /Repaired duplicate or missing user profile id/);

console.log(`PASS Build 444 supplied files: ${parsedOffers.cruises.length} offer rows/${parsedOffers.offers.length} offers, ${converted.rowCount} crew rows, ${cruiseRows.length} completed cruises, ${backupPaths.length} backups, ${duplicateProfileIdsObserved} legacy duplicate profile id(s) routed to repair`);
