const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filename = path.join(root, 'lib/certificates/certificatePortfolioMatrix.ts');
const output = ts.transpileModule(read('lib/certificates/certificatePortfolioMatrix.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@/types/models' || request === '@/components/CertificateManagerModal' || request === './certificateSailingIndex') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let lib;
try {
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); lib = mod.exports;
} finally { Module._load = originalLoad; }

const level = (code, points, cabin, fp = 0, port = 'Miami') => ({
  certificateCode: code, certificateType: code[4], level: code.slice(5), points, departurePort: port,
  itinerary: 'Caribbean', offerTypeLabel: 'Cruise fare', guestCount: 2, cabinLabel: cabin,
  freePlay: fp, onBoardCredit: 0, benefitSummary: [], pdfUrl: 'https://example.test/cert.pdf', monthlyIndexUrl: 'https://example.test/index.pdf',
});
const matches = [
  { shipName: 'Icon of the Seas', sailDate: '2026-09-26', decisionGuide: [], levels: [level('2608C01', 1200, 'Balcony', 500), level('2608C02', 2000, 'Interior', 200)] },
  { shipName: 'Wonder of the Seas', sailDate: '2026-10-03', decisionGuide: [], levels: [level('2608C01', 1200, 'Balcony', 500, 'Port Canaveral')] },
  { shipName: 'Utopia of the Seas', sailDate: '2026-10-10', decisionGuide: [], levels: [level('2608A01', 800, 'Oceanview', 100)] },
];
const report = lib.buildCertificatePortfolioMatrix(
  matches,
  [{ id: 'offer-1', offerType: 'comped', title: 'Icon offer', shipName: 'Icon of the Seas', sailingDate: '2026-09-26', status: 'active' }],
  [{ id: 'cert-1', type: 'freeplay', label: '2608A01 Reward', value: 100, status: 'available', certificateCode: '2608A01', expiryDate: '2026-09-01' }],
  new Date(2026, 7, 21, 12),
);
assert.equal(report.certificateCount, 3);
assert.equal(report.sailingCount, 3);
assert.equal(report.overlapSailingCount, 1);
assert.equal(report.uniqueAccessCount, 2);
assert.equal(report.certificateOnlyCount, 2);
assert.equal(report.dominatedUseCount, 1, 'higher-point weaker certificate must be flagged for poor-value review');
assert.equal(report.expiringCertificateCount, 1);
assert.equal(report.rows.find((row) => row.certificateCode === '2608C01').sailingCount, 2);
assert.ok(report.rows.find((row) => row.certificateCode === '2608C02').signals.includes('dominated'));
assert.ok(report.rows.find((row) => row.certificateCode === '2608A01').signals.includes('unique'));

const screen = read('app/certificate-portfolio.tsx');
const lookup = read('app/certificate-lookup.tsx');
assert.match(screen, /Portfolio Matrix/);
assert.match(screen, /Available Cruises/);
assert.match(screen, /Poor-value review/);
assert.match(screen, /certificate-portfolio\.matrix/);
assert.match(lookup, /certificate-lookup\.portfolio-matrix/);

console.log('PASS build400_certificate_portfolio_matrix_regression — ships/months/cabins/ports, overlaps, unique access, conservative certificate-only matching, dominated uses, and expiry signals verified');
