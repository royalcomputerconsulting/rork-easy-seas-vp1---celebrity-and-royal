const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

const relationships = compileTs('lib/bookedVoyageRelationships.ts', {
  '@/lib/date': { createDateFromString: (value) => new Date(`${value}T12:00:00Z`) },
});

const base = { ownerProfileId: 'scott', brand: 'royal', shipName: 'Harmony', sailDate: '2026-09-10', returnDate: '2026-09-15', nights: 5 };
const records = [
  { ...base, id: 'r1', bookingId: '3658443', cabinType: 'Balcony' },
  { ...base, id: 'r2', bookingId: '6748172', cabinType: 'Interior' },
  { ...base, id: 'r3', bookingId: '3677807', sailDate: '2026-09-15', returnDate: '2026-09-19', nights: 4 },
  { ...base, id: 'r4', bookingId: '5709803', sailDate: '2026-09-19', returnDate: '2026-09-26', nights: 7 },
];
const groups = relationships.buildPhysicalBookedVoyageGroups(records);
assert.equal(groups.length, 3, 'two reservations must remain distinct records related to one physical voyage');
assert.equal(groups[0].reservations.length, 2);
assert.deepEqual(groups[0].reservations.map((record) => record.bookingId), ['3658443', '6748172']);
const blocks = relationships.buildConsecutiveBookedVoyageBlocks(records);
assert.equal(blocks.length, 1);
assert.equal(blocks[0].voyages.length, 3);
assert.equal(blocks[0].nights, 16, 'duplicate reservations cannot double-count physical voyage nights');

const booked = read('app/(tabs)/booked.tsx');
for (const id of ['booked-next-cruise-card', 'booked-next-voyage-readiness', 'booked-consecutive-voyage-blocks', 'booked-related-reservations']) {
  assert(booked.includes(`testID="${id}"`), `Booked workflow missing ${id}`);
}
assert.match(booked, /MinimalistFilterBar/, 'Upcoming, Completed, and All must remain available');
assert.match(booked, /getBookedCruiseRenderKey/, 'separate reservation identities must remain independently actionable');

const details = read('app/(tabs)/(overview)/cruise-details.tsx');
assert.match(details, /testID="cruise-details-top-itinerary"/, 'actual itinerary must remain at the top of cruise details');
assert.match(details, /hasKnownPlanningItinerary/, 'planning must distinguish missing evidence from factual zeroes');
assert.match(details, /!planningCruise \|\| !hasKnownPlanningItinerary/, 'expensive comparison planning must not run without itinerary evidence');
assert.match(details, /pointsSource: 'manual'/, 'manual per-cruise point truth must be labeled and persisted');
assert.match(details, /casinoCloseoutSource: 'manual'/, 'manual win-loss closeout must be labeled and persisted');
for (const id of ['cruise-detail-reservation-number', 'cruise-detail-stateroom-number', 'edit-cruise-pricing', 'cruise-details-phase3-planning-intelligence']) {
  assert(details.includes(`testID="${id}"`), `cruise detail missing ${id}`);
}
assert.match(details, /testID="edit-cruise-notes"/, 'cruise notes must remain editable without leaving the detail record');

console.log('Build 440 Booked physical-voyage, itinerary, readiness, and planning-truth regression passed.');
