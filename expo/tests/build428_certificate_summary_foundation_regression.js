const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filename = path.join(root, 'lib/certificates/certificateSummary.ts');
const output = ts.transpileModule(read('lib/certificates/certificateSummary.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === './certificateSailingIndex') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let summary;
try {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  summary = mod.exports;
} finally {
  Module._load = originalLoad;
}

const level = (overrides = {}) => ({
  certificateCode: '2609A04', certificateType: 'A', level: '04', points: 3000,
  departurePort: 'Port Canaveral, Florida', itinerary: '4 Night Bahamas & Perfect Day Cruise',
  shipClass: 'Oasis Class', nights: 4, startDay: 'Friday', endDay: 'Tuesday',
  isWeekendDeparture: true, isFloridaDeparture: true, offerTypeLabel: 'Cruise fare',
  guestCount: 1, cabinLabel: 'Oceanview', isGty: false, freePlay: 0, onBoardCredit: 0,
  tradeInValue: null, nextCruiseBonusLabel: null, benefitSummary: [], sourcePage: 1,
  sourceGroup: 'page-1-row-1', validationStatus: 'accepted', pdfUrl: 'file://certificate.pdf',
  monthlyIndexUrl: 'https://example.test/index.pdf', ...overrides,
});

const matches = [
  {
    shipName: 'Utopia of the Seas', sailDate: '2026-09-18', decisionGuide: [],
    levels: [
      level(),
      level({ guestCount: 2, sourceGroup: 'page-1-row-2' }),
      level({ cabinLabel: 'Balcony', guestCount: 2, isGty: true, sourceGroup: 'page-1-row-3' }),
    ],
  },
  {
    shipName: 'Icon of the Seas', sailDate: '2026-09-21', decisionGuide: [],
    levels: [level({ certificateCode: '2609A05', level: '05', points: 2000, departurePort: 'Miami, Florida', shipClass: 'Icon Class', nights: 7, startDay: 'Monday', endDay: 'Monday', isWeekendDeparture: false, guestCount: 2 })],
  },
  {
    shipName: 'Ovation of the Seas', sailDate: '2026-10-02', decisionGuide: [],
    levels: [level({ certificateCode: '2609A05', level: '05', points: 2000, departurePort: 'Los Angeles, California', shipClass: 'Quantum Class', nights: 3, startDay: 'Friday', endDay: 'Monday', guestCount: null, isFloridaDeparture: false })],
  },
];

const report = summary.buildCertificateSummaryReport(matches);
assert.equal(report.certificateCount, 2);
assert.equal(report.totalOptions, 5, 'guest/cabin variants must remain separate certificate options');
assert.equal(report.physicalSailingCount, 3, 'physical sailings must be reported separately from entitlement rows');
const a04 = report.rows.find((row) => row.certificateCode === '2609A04');
assert.equal(a04.oneGuestOptions, 1);
assert.equal(a04.twoGuestOptions, 2);
assert.equal(a04.totalOptions, 3);
assert.equal(a04.weekendDepartures, 3);
assert.equal(a04.floridaDepartures, 3);
assert.equal(a04.shortestNights, 4);
assert.equal(a04.longestNights, 4);
const a05 = report.rows.find((row) => row.certificateCode === '2609A05');
assert.equal(a05.twoGuestOptions, 1);
assert.equal(a05.unknownGuestOptions, 1);
assert.equal(a05.shortestNights, 3);
assert.equal(a05.longestNights, 7);

assert.equal(summary.filterCertificateSummaryOptions(report.options, {
  metric: 'two_guests', metricCertificateCode: '2609A04',
}).length, 2, 'two-guest figure must drill into the exact two matching option rows');
assert.equal(summary.filterCertificateSummaryOptions(report.options, {
  metric: 'shortest', metricCertificateCode: '2609A05',
}).length, 1, 'shortest figure must drill into only minimum-night rows');
assert.equal(summary.filterCertificateSummaryOptions(report.options, {
  shipClasses: ['Icon Class'], floridaDepartureOnly: true,
}).length, 1, 'combined summary filters must be deterministic');

const indexSource = read('lib/certificates/certificateSailingIndex.ts');
for (const marker of ['tradeInValue', 'nextCruiseBonusLabel', 'departurePort', 'shipClass', 'nights', 'isGty']) {
  assert.match(indexSource, new RegExp(marker), `material certificate identity must retain ${marker}`);
}
const codesScreen = read('app/certificate-codes.tsx');
assert.match(codesScreen, /certificate-codes\.cert-summary/, 'Certificate Codes must expose the Cert Summary entry point');
assert.match(codesScreen, /\/certificate-summary/, 'Cert Summary must use its own route');

const indexFilename = path.join(root, 'lib/certificates/certificateSailingIndex.ts');
const indexOutput = ts.transpileModule(indexSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: indexFilename,
}).outputText;
Module._load = function patchedIndexLoad(request, parent, isMain) {
  if (request === './certificateCatalog') return { buildCertificatePdfUrl: (code) => `https://example.test/${code}.pdf` };
  if (request === './certificatePdfParserCore') return {
    DEFAULT_CERTIFICATE_POINTS: { '04': 3000 },
    parseCertificateCode: (code) => ({ family: code[4], levelCode: code.slice(5), monthCode: code.slice(0, 4) }),
  };
  if (request === '../cruiseRecordIntegrity') return {
    parseGuestEligibility: (value) => Number(String(value).match(/\d+/)?.[0]) || null,
    formatGuestEligibility: (value, fallback) => value == null ? fallback : `${value} guest${value === 1 ? '' : 's'}`,
  };
  if (request === '@/constants/shipInfo') return {
    ROYAL_CARIBBEAN_SHIPS: { 'Utopia of the Seas': { class: 'Oasis Class' } },
  };
  return originalLoad.call(this, request, parent, isMain);
};
let index;
try {
  const mod = new Module(indexFilename, module);
  mod.filename = indexFilename;
  mod.paths = Module._nodeModulePaths(path.dirname(indexFilename));
  mod._compile(indexOutput, indexFilename);
  index = mod.exports;
} finally {
  Module._load = originalLoad;
}
const indexed = index.buildLocalCertificateSailingIndex([{
  certificateCode: '2609A04',
  parsedSailings: [
    { certificateCode: '2609A04', shipName: 'Utopia of the Seas', sailingDate: '2026-09-18', departurePort: 'Port Canaveral, Florida', itinerary: '4 Night Bahamas', cabinCategory: 'Oceanview', occupancy: '1 guest', sourcePage: 1, sourceGroup: 'row-1', benefits: [] },
    { certificateCode: '2609A04', shipName: 'Utopia of the Seas', sailingDate: '2026-09-18', departurePort: 'Port Canaveral, Florida', itinerary: '4 Night Bahamas', cabinCategory: 'Oceanview', occupancy: '2 guests', sourcePage: 1, sourceGroup: 'row-2', benefits: [] },
    { certificateCode: '2609A04', shipName: 'Utopia of the Seas', sailingDate: '2026-09-18', departurePort: 'Port Canaveral, Florida', itinerary: '4 Night Bahamas', cabinCategory: 'Oceanview', occupancy: '2 guests', sourcePage: 2, sourceGroup: 'duplicate-row', benefits: [] },
  ],
}]);
assert.equal(indexed.length, 1);
assert.equal(indexed[0].levels.length, 2, 'actual index must preserve 1/2-guest variants but remove exact repeated rows');
assert.deepEqual(indexed[0].levels.map((entry) => entry.guestCount).sort(), [1, 2]);
assert.equal(indexed[0].levels[0].shipClass, 'Oasis Class');
assert.equal(indexed[0].levels[0].nights, 4);
assert.equal(indexed[0].levels[0].isFloridaDeparture, true);

console.log('PASS Build 428 Stage 1 certificate summary foundation, entitlement identity, exact metrics, drill-down predicates, and entry point');
