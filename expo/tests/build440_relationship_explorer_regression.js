#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const file = path.join(root, 'lib/relationships/relationshipGraph.ts');
const js = ts.transpileModule(read('lib/relationships/relationshipGraph.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(js, file);

const graph = mod.exports.buildRelationshipGraph({
  activeOwnerId: 'primary',
  includeUnassignedPrivate: false,
  bookedCruises: [
    { id: 'earning', ownerProfileId: 'primary', shipName: 'Harmony', sailDate: '2026-05-01', returnDate: '2026-05-06', status: 'completed', casinoPoints: 2000, coinIn: 10000, theoreticalLoss: 900 },
    { id: 'booking', ownerProfileId: 'primary', shipName: 'Icon', sailDate: '2026-09-12', status: 'booked', reservationNumber: 'R1', offerCode: '2609A03', retailValue: 2400, netEffectivePaid: 100, winningsHome: 500 },
    { id: 'other-user', ownerProfileId: 'secondary', shipName: 'Private Other', sailDate: '2026-10-01', status: 'booked', reservationNumber: 'SECRET', retailValue: 9999 },
  ],
  certificates: [{ id: 'cert', certificateCode: '2609A03', points: 2000, earnedCruiseId: 'earning', parsedSailings: [{ id: 'sail', certificateCode: '2609A03', offerCode: '2609A03', shipName: 'Icon', sailDate: '2026-09-12', cabinLabel: 'Balcony', guestCount: 2, nights: 7 }] }],
  offers: [{ id: 'offer', offerCode: '2609A03', certificateCode: '2609A03', title: 'September offer', value: 2400 }],
  availableCruises: [{ id: 'sail', offerId: 'offer', offerCode: '2609A03', shipName: 'Icon', sailDate: '2026-09-12', cabinLabel: 'Balcony', guestCount: 2, nights: 7 }],
});

assert.deepEqual([...new Set(graph.nodes.map((node) => node.column))].sort(), [0, 1, 2, 3, 4, 5, 6]);
assert(graph.edges.some((edge) => edge.from === 'cruise:earning' && edge.to === 'points:earning' && edge.confidence === 'exact'));
assert(graph.edges.some((edge) => edge.from === 'points:earning' && edge.to === 'cert:cert'));
assert(graph.edges.some((edge) => edge.from === 'cert:cert' && edge.to === 'offer:offer'));
assert(graph.edges.some((edge) => edge.from === 'offer:offer' && edge.to.startsWith('sailing:')));
assert(graph.edges.some((edge) => edge.from.startsWith('sailing:') && edge.to === 'booking:booking'));
assert(graph.edges.some((edge) => edge.from === 'booking:booking' && edge.to === 'realized:booking'));
assert.equal(graph.bookings, 2);
assert.equal(graph.realized, 2800);
assert(!graph.nodes.some((node) => node.label.includes('Private Other')));
assert(graph.nodes.some((node) => node.routePath));

const explorer = read('app/relationship-explorer.tsx');
assert.match(explorer, /activeOwnerId: ownerId/);
assert.match(explorer, /core\.getAllCruises\(\)/, 'relationship explorer must load the indexed native cruise catalog');
assert.match(explorer, /availableCruises,/);
assert.match(explorer, /casinoSessions: sessions/);
assert.match(explorer, /loyaltyRecords:/);
assert.match(explorer, /earning cruise → casino points → certificate → offer → eligible sailing → owner booking → realized value/);
assert.match(explorer, /InteractiveRelationshipMap nodes=\{routedNodes\}/);

const map = read('components/ui/InteractiveRelationshipMap.tsx');
assert.match(map, /const grouped = new Map<number, MapNode\[\]>/);
assert.match(map, /Relationship list alternative/);
assert.match(map, /Confirm link/);
assert.match(map, /Reject link/);
assert.match(map, /Load 50 more relationships/);
assert.equal(fs.existsSync(path.join(root, 'app/relationship-explorer 2.tsx')), false, 'obsolete duplicate Expo route must be removed');

console.log('PASS build440_relationship_explorer_regression');
