const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const intelligence = {
  score: 88,
  rating: 'Excellent',
  explanation: 'Excellent value',
  reasons: ['Cabin value is verified.'],
  casinoPaysFor: {
    retailCabinValue: 3200, taxesFees: 250, upgradeCost: 0, freePlay: 500, onboardCredit: 50,
    casinoCoveredValue: 3750, userOutOfPocket: 250, effectiveSavingsPercentage: 94, compEfficiencyRating: 'Excellent', missingInputs: [],
  },
  daysUntilExpiration: 30,
  profileMatch: true,
  brandLabel: 'Royal Caribbean / Club Royale',
};
const lib = compileTs('lib/shouldIBook.ts', {
  '@/types/models': {},
  '@/lib/offerIntelligence': {
    calculateOfferIntelligenceScore: () => intelligence,
    getOfferExpiryDate: (offer) => offer.expiryDate,
  },
  '@/lib/date': {
    getDaysUntil: (value) => value === '2020-01-01' ? -1 : 30,
    toCalendarDateOnly: (value) => String(value ?? '').slice(0, 10),
  },
});

const offer = { id: 'offer-1', offerType: 'comped', title: 'Balcony', status: 'active', expiryDate: '2026-10-01' };
const cruise = { id: 'cruise-1', shipName: 'Icon of the Seas', sailDate: '2026-09-26', returnDate: '2026-10-03', departurePort: 'Miami', destination: 'Eastern Caribbean', nights: 7, ports: ['Miami', 'St. Thomas'] };
const strong = lib.evaluateShouldIBook({ offer, cruise, bookedCruises: [] });
assert.equal(strong.verdict, 'strong_candidate');
assert.equal(strong.confidence, 'high');
assert.equal(strong.estimatedNetVacationValue, 3500);
assert.equal(strong.costPerNight, 36);
assert.equal(strong.factors.length, 5);
assert.ok(strong.verifyBeforeBooking.length >= 4);
assert.match(strong.disclaimer, /never books automatically/i);

const conflict = lib.evaluateShouldIBook({
  offer,
  cruise,
  bookedCruises: [{ id: 'other', shipName: 'Harmony', sailDate: '2026-09-29', returnDate: '2026-10-04', nights: 5 }],
});
assert.equal(conflict.verdict, 'not_bookable');
assert.equal(conflict.verdictLabel, 'Schedule conflict');
assert.ok(conflict.score <= 25);
assert.equal(conflict.factors.find((factor) => factor.id === 'schedule').status, 'blocking');

const expired = lib.evaluateShouldIBook({ offer: { ...offer, expiryDate: '2020-01-01' }, cruise, bookedCruises: [] });
assert.equal(expired.verdict, 'not_bookable');
assert.equal(expired.verdictLabel, 'Offer expired');

const screen = read('app/offer-details.tsx');
assert.match(screen, /offer-details-should-i-book/);
assert.match(screen, /should-i-book-transparent-breakdown/);
assert.match(screen, /Verify before booking/);
assert.match(screen, /evaluateShouldIBook/);

console.log('PASS build398_should_i_book_regression — transparent value/cost/schedule/evidence factors, conflict and expiry blockers, verification checklist, and non-booking disclaimer verified');
