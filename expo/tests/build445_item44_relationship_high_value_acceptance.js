#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = (file) => {
  const absolute = path.join(root, file);
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  mod._compile(js, absolute);
  return mod.exports;
};

const relationships = load('lib/relationships/relationshipGraph.ts');
const graph = relationships.buildRelationshipGraph({
  activeOwnerId: 'primary',
  includeUnassignedPrivate: true,
  bookedCruises: [
    { id: 'trip', ownerProfileId: 'primary', status: 'completed', shipName: 'Harmony', sailDate: '2026-08-01', returnDate: '2026-08-08', pointsEarned: 3000, reservationNumber: 'BOOK', retailValue: 2500, amountPaid: 100, winningsHome: 400 },
    { id: 'trip', ownerProfileId: 'primary', status: 'completed', shipName: 'Harmony', sailDate: '2026-08-01', returnDate: '2026-08-08', pointsEarned: 3000, reservationNumber: 'BOOK', retailValue: 2500, amountPaid: 100, winningsHome: 400 },
  ],
  casinoSessions: [{ id: 'session', pointEarningProfileId: 'primary', cruiseId: 'trip', date: '2026-08-03', machineName: 'Buffalo', coinIn: 15000, winLoss: 500, pointsEarned: 3000 }],
  loyaltyRecords: [{ id: 'club-royale', program: 'Club Royale', tier: 'Signature', points: 23446, pointsSource: 'provider' }],
  certificates: [{ id: 'cert', certificateCode: '2609A04', earnedCruiseId: 'trip', points: 3000, parsedSailings: [{ id: 'sail', offerCode: '2609A04', certificateCode: '2609A04', shipName: 'Icon', sailDate: '2026-09-12', cabinLabel: 'Balcony', guestCount: 2 }] }],
  offers: [{ id: 'offer', offerCode: '2609A04', certificateCode: '2609A04', title: 'September offer', value: 1800 }],
  availableCruises: [{ id: 'sail', offerId: 'offer', offerCode: '2609A04', shipName: 'Icon', sailDate: '2026-09-12', cabinLabel: 'Balcony', guestCount: 2 }],
});
assert(graph.nodes.some((node) => node.id === 'play:session' && /coin-in/.test(node.valueLabel)));
assert(graph.nodes.some((node) => node.id === 'loyalty:club-royale' && /Signature/.test(node.label)));
assert(graph.edges.some((edge) => edge.id === 'play-points:session:trip'));
assert(graph.edges.some((edge) => edge.id === 'points-loyalty:trip:club-royale'));
assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length, 'relationship nodes must be unique');
assert.equal(new Set(graph.edges.map((edge) => edge.id)).size, graph.edges.length, 'relationship edges must be unique');
const nodeIds = new Set(graph.nodes.map((node) => node.id));
assert(graph.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)), 'no relationship edge may point to an orphan node');

const optimizer = load('lib/intelligence/certificateRedemptionOptimizer.ts');
const sailings = [
  { shipName: 'Harmony', sailDate: '2026-09-10', levels: [{ certificateCode: '2609A04', cabinLabel: 'Balcony', guestCount: 2, departurePort: 'Port Canaveral', freePlay: 500, onBoardCredit: 75, itinerary: 'Bahamas' }] },
  { shipName: 'Icon', sailDate: '2026-10-10', levels: [{ certificateCode: '2609A04', cabinLabel: 'Interior', guestCount: 1, departurePort: 'Miami', freePlay: 100, onBoardCredit: 0, itinerary: 'Caribbean' }] },
];
const evaluation = optimizer.evaluateCertificateRedemptions(sailings, {
  certificateCode: '2609A04',
  requiredGuestCount: 2,
  maxTravelCost: 300,
  airfareBySailing: { 'harmony__2026-09-10': 225, 'icon__2026-10-10': 400 },
  taxesBySailing: { 'harmony__2026-09-10': 0, 'icon__2026-10-10': 0 },
  upgradeBySailing: { 'harmony__2026-09-10': 0, 'icon__2026-10-10': 0 },
});
assert.equal(evaluation.recommendations.length, 1);
assert.equal(evaluation.recommendations[0].guestCount, 2);
assert.equal(evaluation.recommendations[0].cabinLabel, 'Balcony');
assert.equal(evaluation.recommendations[0].expectedOutOfPocket, 225);
assert.equal(evaluation.excluded.length, 1);
assert(evaluation.excluded[0].hardExclusionReasons.some((reason) => /2 guests/.test(reason)));
assert(evaluation.excluded[0].hardExclusionReasons.some((reason) => /cost exceeds/.test(reason)));

const explorer = read('app/relationship-explorer.tsx');
const casino = read('app/casino/relationship-intelligence.tsx');
for (const source of [explorer, casino]) {
  assert(source.includes('core.getAllCruises()'), 'relationship consumers must load SQLite-backed cruise authority');
  assert(source.includes('casinoSessions: sessions'));
  assert(source.includes('loyaltyRecords:'));
}
const map = read('components/ui/InteractiveRelationshipMap.tsx');
for (const marker of ['Relationship map', 'List view', 'Relationship list alternative', 'Load 50 more relationships', 'accessibilityLabel']) assert(map.includes(marker));

const inbox = read('app/action-inbox.tsx');
for (const marker of ['action-inbox-bulk-actions', 'Snooze 7 days', 'assignedOwnerId', 'canManageAllProfiles', 'Select all']) assert(inbox.includes(marker));

const portfolio = read('app/certificate-portfolio.tsx');
for (const marker of ['certificate-optimizer-excluded-review', 'hardExclusionReasons', 'guestCount', 'departurePort', 'Total trip cost']) assert(portfolio.includes(marker));

console.log('PASS build445_item44_relationship_high_value_acceptance');
