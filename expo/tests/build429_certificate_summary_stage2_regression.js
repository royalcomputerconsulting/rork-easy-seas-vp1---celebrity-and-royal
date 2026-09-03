const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filename = path.join(root, 'lib/certificates/certificateSummary.ts');
const output = ts.transpileModule(read('lib/certificates/certificateSummary.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) { if (request === './certificateSailingIndex') return {}; return originalLoad.call(this, request, parent, isMain); };
let summary;
try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); summary = mod.exports; } finally { Module._load = originalLoad; }

const option = (overrides = {}) => ({
  optionId: 'base', certificateCode: '2609A04', certificateMonth: '2026-09', certificateType: 'A', level: '04', points: 3000,
  shipName: 'Utopia of the Seas', sailDate: '2026-09-18', shipClass: 'Oasis Class', departurePort: 'Port Canaveral, Florida',
  itinerary: 'Bahamas & Perfect Day Cruise', nights: 4, startDay: 'Friday', endDay: 'Tuesday', isWeekendDeparture: true,
  isFloridaDeparture: true, offerTypeLabel: 'Cruise fare', guestCount: 2, cabinLabel: 'Balcony', isGty: false,
  freePlay: 500, onBoardCredit: 100, tradeInValue: null, nextCruiseBonusLabel: '$100 NextCruise', benefitSummary: [],
  sourcePage: 1, sourceGroup: 'row-1', validationStatus: 'accepted', pdfUrl: 'file://a.pdf', monthlyIndexUrl: 'https://example.test/a.pdf', ...overrides,
});
const options = [
  option(),
  option({ optionId: 'icon', certificateCode: '2609A05', level: '05', points: 2000, shipName: 'Icon of the Seas', shipClass: 'Icon Class', sailDate: '2026-09-25', departurePort: 'Miami, Florida', itinerary: 'Eastern Caribbean', nights: 7, startDay: 'Friday', cabinLabel: 'Oceanview', guestCount: 1, freePlay: 100, onBoardCredit: 0, nextCruiseBonusLabel: null }),
  option({ optionId: 'missing', certificateCode: '2609A06', level: '06', points: 1500, shipName: 'Ovation of the Seas', shipClass: null, sailDate: '2026-10-02', departurePort: null, itinerary: 'Ensenada Cruise', nights: null, startDay: 'Friday', cabinLabel: null, guestCount: null, isFloridaDeparture: false, freePlay: null, onBoardCredit: null, nextCruiseBonusLabel: null, validationStatus: 'quarantined' }),
];

assert.deepEqual(summary.filterCertificateSummaryOptions(options, { shipClasses: ['Icon Class'], guestCounts: [1] }).map((item) => item.optionId), ['icon']);
assert.deepEqual(summary.filterCertificateSummaryOptions(options, { searchQuery: 'icon eastern oceanview' }).map((item) => item.optionId), ['icon']);
assert.deepEqual(summary.filterCertificateSummaryOptions(options, { minimumPoints: 2500, minimumFreePlay: 400, floridaDepartureOnly: true }).map((item) => item.optionId), ['base']);
assert.equal(summary.filterCertificateSummaryOptions(options, { qualityIssues: ['missing_guest_count'] }).length, 1);
assert.equal(summary.filterCertificateSummaryOptions(options, { qualityIssues: ['missing_ship_class', 'missing_departure_port'] }).length, 1, 'quality issues use OR within the selected review categories');
assert.deepEqual(summary.sortCertificateSummaryOptions(options, 'points_low').map((item) => item.points), [1500, 2000, 3000]);
assert.deepEqual(summary.sortCertificateSummaryOptions(options, 'freeplay_high').map((item) => item.optionId), ['base', 'icon', 'missing']);
const quality = summary.getCertificateSummaryQualityCounts(options);
assert.equal(quality.missing_guest_count, 1);
assert.equal(quality.missing_nights, 1);
assert.equal(quality.not_accepted, 1);

const screen = read('app/certificate-summary.tsx');
const modal = read('components/certificates/CertificateSummaryFilterModal.tsx');
const results = read('app/certificate-summary-results.tsx');
for (const marker of ['Summary', 'Ships & Classes', 'Sailings', 'Data Quality', 'certificate-summary.open-filters', '/certificate-summary-results', 'Ask Agent SEA']) assert.match(screen, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
for (const marker of ['Clear All', 'Cancel', 'Apply Filters', 'Ship class', 'Guest eligibility', 'Departure ports', 'Points and duration', 'Recorded benefits']) assert.match(modal, new RegExp(marker));
for (const marker of ['FlatList', 'PAGE_SIZE', 'certificate-summary-results.pagination', 'removeClippedSubviews', 'Search ship, port, itinerary, cabin, code', 'Ask Agent SEA', 'Local PDF evidence']) assert.match(results, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(results, /data=\{visible\}/, 'large matching result sets must feed the paged slice to FlatList');
assert.doesNotMatch(results, /\{matching\.map\(/, 'large matching result sets must not be mapped into one React tree');

console.log('PASS Build 429 Stage 2 Cert Summary filters, matrices, quality drill-downs, virtualized paging, sorting, evidence, and Agent SEA handoff');
