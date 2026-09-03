const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
function load(relative) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const graphLib = load('lib/relationships/relationshipGraph.ts');
const earningCruise = {
  id: 'earning', ownerId: 'primary', status: 'completed', shipName: 'Harmony of the Seas',
  sailDate: '2026-09-10', returnDate: '2026-09-15', casinoPoints: 3_200,
};
const redeemedBooking = {
  id: 'booking', ownerId: 'primary', status: 'booked', shipName: 'Harmony of the Seas',
  sailDate: '2026-10-20', returnDate: '2026-10-25', reservationNumber: 'ABC123',
  certificateCodeUsed: '2609A04', retailValue: 2_500, amountPaid: 0, winningsHome: 950,
};
const certificate = {
  id: 'cert', certificateCode: '2609A04', pointsRequired: 3_000,
  earnedOnCruise: 'earning', issueDate: '2026-09-14',
  parsedSailings: [{
    shipName: 'Harmony of the Seas', sailDate: '2026-10-20', certificateCode: '2609A04',
    cabinLabel: 'Balcony', guestCount: 2, nights: 5,
  }],
};
const offer = { id: 'offer', offerCode: '2609A04', certificateCode: '2609A04', title: 'September offer', value: 2_500 };
const graph = graphLib.buildRelationshipGraph({
  bookedCruises: [earningCruise, redeemedBooking], certificates: [certificate], offers: [offer],
  activeOwnerId: 'primary',
});

const earned = graph.edges.find((edge) => edge.id === 'earned:earning:cert');
assert.equal(earned?.confidence, 'exact');
assert.match(earned?.label ?? '', /3,200 actual cruise points/);
assert.match(earned?.label ?? '', /3,000-point threshold/);
assert.match(earned?.label ?? '', /issued 2026-09-14/);
assert(graph.edges.some((edge) => edge.id.startsWith('cert-sailing:cert:') && edge.confidence === 'exact'));
assert(graph.edges.some((edge) => edge.id.startsWith('offer-sailing:offer:') && edge.confidence === 'exact'));
assert(graph.edges.some((edge) => edge.id.includes(':booking') && edge.from.startsWith('sailing:') && edge.confidence === 'exact'));
const realized = graph.edges.find((edge) => edge.id === 'booking-realized:booking');
assert.equal(realized?.confidence, 'exact', 'a saved zero paid amount is exact evidence, not a missing value');
assert.match(realized?.label ?? '', /\$2,500 retail \+ \$950 casino result − \$0 paid/);
assert.equal(graph.nodes.find((node) => node.id === 'realized:booking')?.value, 3_450);

const missingDates = graphLib.buildRelationshipGraph({
  bookedCruises: [{ id: 'undated', ownerId: 'primary', status: 'completed', casinoPoints: 1_200 }],
  certificates: [{ id: 'undated-cert', certificateCode: '2609A07', pointsRequired: 1_200 }],
  activeOwnerId: 'primary',
});
assert(!missingDates.edges.some((edge) => edge.id.startsWith('inferred:')), 'missing dates must never create a false date-proximity link');
assert(missingDates.edges.some((edge) => edge.id === 'missing-cert:undated' && edge.confidence === 'unresolved'));

const explorer = read('app/relationship-explorer.tsx');
const map = read('components/ui/InteractiveRelationshipMap.tsx');
const review = read('app/casino/certificate-link-review.tsx');
for (const marker of ['Review certificate earning links', '/casino/certificate-link-review', 'InteractiveRelationshipMap']) assert.match(explorer, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
for (const marker of ['Relationship list alternative', 'List view', 'Confirm link', 'Reject link', 'Load 50 more relationships']) assert.ok(map.includes(marker), `accessible relationship alternative is missing ${marker}`);
for (const marker of ['Certificate issued', 'Earning cruise', 'Saved cruise points', 'Certificate threshold', 'Relationship confidence', 'Confirm suggestion', 'View {parsedRows.toLocaleString()} eligible rows']) assert.ok(review.includes(marker), `certificate link review is missing ${marker}`);

console.log('PASS Build 445 Item 19 earning-date/points confidence, eligible sailing, booking, realized value, and accessible list evidence');
