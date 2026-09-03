const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const suppliedCsv = process.env.EASYSEAS_TEST_COMPLETED_CSV
  || '/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/completed_cruises_2025_2026.csv';
assert.ok(fs.existsSync(suppliedCsv), 'the supplied completed-cruise CSV must remain available for acceptance');

const workbook = XLSX.read(fs.readFileSync(suppliedCsv, 'utf8'), { type: 'string', raw: true });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
const cruiseRows = rows.filter((row) => row.Ship && row['Sail Date'] && !/total/i.test(String(row['Sail Date'])));
const totalRows = rows.filter((row) => /total/i.test(String(row['Sail Date'])));
assert.equal(cruiseRows.length, 33, 'the supplied file must review exactly 33 physical completed cruises');
assert.equal(totalRows.length, 3, 'report totals must remain reconciliation evidence, never fake cruise rows');

const imported = cruiseRows.map((row, index) => {
  const points = row['Club Royale Casino Points'] === '' ? undefined : Number(row['Club Royale Casino Points']);
  const coinIn = row['Coin-In Equivalent @ $5/Point'] === '' ? undefined : Number(row['Coin-In Equivalent @ $5/Point']);
  const winnings = row['Winnings Home'] === '' ? undefined : Number(row['Winnings Home']);
  const retail = row['Retail Value'] === '' ? undefined : Number(row['Retail Value']);
  const paid = row['Amount Paid'] === '' ? undefined : Number(row['Amount Paid']);
  const cash = row['Net Cash'] === '' ? undefined : Number(row['Net Cash']);
  return {
    id: `fixture-${index}`,
    ownerProfileId: 'primary-owner',
    sourceEmail: 'scott@example.com',
    guestNames: ['Scott Merlis'],
    reservationNumber: String(row.Reservation),
    shipName: String(row.Ship),
    sailDate: String(row['Sail Date']),
    returnDate: new Date(new Date(`${row['Sail Date']}T12:00:00Z`).getTime() + Number(row.Nights) * 86400000).toISOString().slice(0, 10),
    nights: Number(row.Nights),
    destination: String(row.Itinerary),
    cabinType: String(row.Cabin),
    pointsEarned: points,
    earnedPoints: points,
    casinoPoints: points,
    coinIn,
    winningsBroughtHome: winnings,
    winnings,
    totalWinnings: winnings,
    retailValue: retail,
    totalRetailCost: retail,
    amountPaid: paid,
    pricePaid: paid,
    netEffectivePaid: paid,
    cashResult: cash,
    netResult: cash,
    status: 'completed',
    completionState: 'completed',
    cruiseSource: 'royal',
    brand: 'Royal Caribbean',
    casinoHistoryImportId: `completed-cruises-2025-2026:${row.Reservation}:${row['Sail Date']}`,
  };
});

const merge = loadTs('lib/imports/completedCruiseHistoryMerge.ts');
const firstImported = imported[0];
const existingManual = {
  ...firstImported,
  id: 'saved-manual-row',
  pointsEarned: 9999,
  earnedPoints: 9999,
  casinoPoints: 9999,
  winningsBroughtHome: 1234,
  winnings: 1234,
  totalWinnings: 1234,
  amountPaid: 0,
  pricePaid: 0,
  netEffectivePaid: 0,
  hoursPlayed: 17.5,
  sourceAuthority: 'manual',
};
const secondarySameReservation = {
  ...firstImported,
  id: 'secondary-row',
  ownerProfileId: 'secondary-owner',
  sourceEmail: 'secondary@example.com',
  pointsEarned: 77,
  earnedPoints: 77,
  casinoPoints: 77,
};

const merged = merge.mergeCompletedCruiseHistory([existingManual, secondarySameReservation], imported);
assert.equal(merged.cruises.length, 34, '33 primary rows plus the isolated secondary record must persist');
assert.equal(merged.addedCruises.length, 32);
assert.equal(merged.updatedRows, 1);
const saved = merged.cruises.find((row) => row.id === 'saved-manual-row');
assert.equal(saved.pointsEarned, 9999, 'manual points must win over imported fallback');
assert.equal(saved.winningsBroughtHome, 1234, 'manual win/loss must win over imported fallback');
assert.equal(saved.amountPaid, 0, 'an intentional saved zero must not be replaced');
assert.equal(saved.hoursPlayed, 17.5);
assert.equal(saved.sourceAuthority, 'manual');
assert.equal(merged.cruises.find((row) => row.id === 'secondary-row').pointsEarned, 77, 'same reservation must not leak across owners');

const secondMerge = merge.mergeCompletedCruiseHistory(merged.cruises, imported);
assert.equal(secondMerge.cruises.length, merged.cruises.length, 'reimport must be idempotent');
assert.equal(secondMerge.addedCruises.length, 0);
assert.equal(secondMerge.updatedRows, 33);

const integrity = loadTs('lib/sync/syncRunIntegrity.ts');
const readback = integrity.verifyBookedCruiseSyncReadback(imported, secondMerge.cruises);
assert.equal(readback.complete, true);
assert.equal(readback.matchedRows, 33);

// This is the same economics consumer used by Booked, Casino, and Agent SEA.
// It must see the imported owner rows and reconcile the final annual report.
const economics = loadTs('lib/casinoCruiseEconomics.ts');
const primaryRows = secondMerge.cruises.filter((row) => row.ownerProfileId === 'primary-owner');
const summary = economics.buildCruiseEconomicsSummary(primaryRows, new Date('2026-08-23T12:00:00Z'), { useKnownAnnualReportFacts: true });
assert.equal(summary.totals.cruises, 21);
assert.equal(summary.totals.totalNights, 106);
assert.equal(summary.totals.totalRetailValue, 47774);
assert.equal(summary.totals.totalPaid, 4238.41);
assert.equal(summary.totals.totalPoints, 58680);
assert.equal(summary.totals.totalCoinIn, 293400);
assert.equal(summary.totals.totalWinningsHome, 19457);
assert.equal(summary.totals.totalCashResult, 15218.59);

const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');
const applyStart = settings.indexOf("title: 'Completed Cruise Import Review'");
const applyEnd = settings.indexOf('const handleExportBookedCSV', applyStart);
const applySource = settings.slice(applyStart, applyEnd);
assert.equal((applySource.match(/await setBookedCruises\(merged\)/g) || []).length, 1, 'Apply must persist booked cruises exactly once');
assert.match(applySource, /verifyBookedCruiseSyncReadback\(preparedImportedCruises, persistedBookedCruises\)/);
assert.match(applySource, /COMPLETED_HISTORY_READBACK_FAILED/);
assert.ok(applySource.indexOf('verifyBookedCruiseSyncReadback') < applySource.indexOf("Alert.alert(\n              'Import Applied'"), 'success must follow persisted readback');

console.log('PASS Build 445 Item 2: supplied 33-row import, one apply, owner isolation, manual precedence, idempotence, readback, and all annual Casino economics');
