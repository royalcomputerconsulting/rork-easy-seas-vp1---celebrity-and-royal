const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');
const { parseRoyalCruiseInvoiceText } = loadTs('lib/casino/cruiseInvoiceParser.ts');
const { parseRoyalCruiseInvoicePdf } = loadTs('lib/casino/royalReceiptPdf.ts');
const { linkCertificateToEarningCruise } = loadTs('lib/casino/certificateEarningChain.ts');
const { ANNUAL_CASINO_REPORT_FACTS } = loadTs('lib/casinoAnnualReportFacts.ts');

const receipt = (header, rows, footer = '') => `CRUISE VACATION RECEIPT\n${header}\nCRUISE FARE\n${rows}\n${footer}`;
const navigator = parseRoyalCruiseInvoiceText(receipt(
  'R e s e r v a t i on ID: 3156149 Issue Date: 01 APR 2025\nShip: NAVIGATOR OF THE SEAS Sailing Date: 08 SEP 2025\nDeparture Date: 08 SEP 2025 Cruise Duration: 04 Nights\nStateroom: 4V 9639\nDescription: Interior\nSpecial Services: CR TARGETED OFFER(25RCL406)',
  'Cruise Fare 543.00 543.00 1086.00\nCasino Comp -310.00 -310.00 -620.00\nTBC1-FP25 0.00\nYHP5-Casino Slots -233.00 -233.00 -466.00\nTaxes, fees, and port expenses: 127.17 127.17 254.34\nTotal Charge: 127.17 127.17 254.34\nAmount Paid: 254.34\nBalance Due: $0.00',
));
assert.equal(navigator.reservationId, '3156149');
assert.equal(navigator.shipName, 'Navigator Of The Seas');
assert.equal(navigator.sailDate, '2025-09-08');
assert.equal(navigator.offerCode, '25RCL406');
assert.equal(navigator.cruiseFare, 1086);
assert.equal(navigator.casinoCompValue, 1086);
assert.equal(navigator.freePlay, 25);

const quantum = parseRoyalCruiseInvoiceText(receipt(
  'R e s e r v a t i on ID: 1527694 Issue Date: 12 DEC 2025\nShip: QUANTUM OF THE SEAS Sailing Date: 15 APR 2026\nDeparture Date: 15 APR 2026 Cruise Duration: 06 Nights\nStateroom: XB GTY\nDescription: OCEAN VIEW BALCONY GUARANTEE\nSpecial Services:',
  'Cruise Fare 1820.00 1820.00\nCasino 75 -1080.00 -1080.00\nCasino 75 -285.00 -285.00\nYHP5-Casino Slots -455.00 -455.00\nTaxes, fees, and port expenses: 151.70 151.70\nTotal Charge: 151.70 151.70\nAmount Paid: 0.00\nBalance Due: $151.70',
  'Onboard Credit: $100.00 $100.00',
));
assert.equal(quantum.reservationId, '1527694');
assert.equal(quantum.casinoCompValue, 1820);
assert.equal(quantum.onboardCredit, 100);

assert.equal(ANNUAL_CASINO_REPORT_FACTS.length, 21);
// The final user-approved ledger displays raw pasted points on each cruise row.
// The confirmed 58,680 annual account total remains separate reconciliation evidence.
assert.equal(ANNUAL_CASINO_REPORT_FACTS.reduce((sum, row) => sum + row.pointsEarned, 0), 34537);
assert.equal(ANNUAL_CASINO_REPORT_FACTS.reduce((sum, row) => sum + (row.originalCasinoPoints ?? 0), 0), 34537);
assert.equal(ANNUAL_CASINO_REPORT_FACTS.reduce((sum, row) => sum + (row.annualReconciliationPoints ?? 0), 0), 24143);
assert.equal(ANNUAL_CASINO_REPORT_FACTS.reduce((sum, row) => sum + row.retailValue, 0), 47774);
assert.equal(Math.round(ANNUAL_CASINO_REPORT_FACTS.reduce((sum, row) => sum + row.amountPaid, 0) * 100) / 100, 4238.41);

const completed = [
  { id: 'nav-sep-8', shipName: 'Navigator of the Seas', sailDate: '2025-09-08', returnDate: '2025-09-12', cruiseLine: 'Royal Caribbean', earnedPoints: 976 },
  { id: 'nav-sep-15', shipName: 'Navigator of the Seas', sailDate: '2025-09-15', returnDate: '2025-09-19', cruiseLine: 'Royal Caribbean', earnedPoints: 817 },
];
const linked = linkCertificateToEarningCruise({ certificate: { certificateCode: '2509C01', issueDate: '2025-09-10', expiryDate: '2026-03-10' }, completedCruises: completed });
assert.equal(linked.confidence, 'high');
assert.equal(linked.likelyEarningCruise.id, 'nav-sep-8');
assert.equal(linked.likelyEarningCruise.earnedPoints, 976);

const realFixtures = [
  ['/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/Downloads/Cruise_Vacation_Receipt.pdf', '3156149', 1086, 254.34],
  ['/Users/rcg/Documents/Cruise_Vacation_Receipt 2.pdf', '1527694', 1820, 151.70],
  ['/Users/rcg/Documents/Cruise_Vacation_Receipt.pdf', '6458636', 4454, 229.19],
];
for (const [fixture, reservationId, fare, taxes] of realFixtures) {
  if (!fs.existsSync(fixture)) continue;
  const parsed = parseRoyalCruiseInvoicePdf(new Uint8Array(fs.readFileSync(fixture)));
  assert.equal(parsed.reservationId, reservationId);
  assert.equal(parsed.cruiseFare, fare);
  assert.equal(parsed.casinoCompValue, fare);
  assert.equal(parsed.taxesFees, taxes);
}

for (const relative of ['app/casino/invoice-import.tsx', 'components/casino/CasinoCommandCenter.tsx', 'app/(tabs)/(overview)/cruise-details.tsx']) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.match(source, /invoice-import|Royal receipt|Cruise Vacation Receipt/);
}
console.log('Build 402 receipt, annual report, and certificate issue-date linkage regression passed.');
