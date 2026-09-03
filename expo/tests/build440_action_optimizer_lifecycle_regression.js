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
  const mod = new Module(absolute, module); mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute)); mod._compile(js, absolute); return mod.exports;
};

const inbox = read('app/action-inbox.tsx');
for (const marker of ['action-inbox-bulk-actions', 'Snooze 7 days', 'assignedOwnerId', 'canManageAllProfiles', "useState<'all' | 'mine'>('mine')", 'action-inbox-provenance-', 'sourceRecordId', 'confidence', 'formula']) assert(inbox.includes(marker), `Action Inbox missing ${marker}`);
assert.match(inbox, /canManageAllProfiles \? users\.map/, 'secondary profiles must not receive cross-profile reassignment controls');

const portfolio = read('app/certificate-portfolio.tsx');
for (const marker of ['certificate-optimizer-controls', 'requiredGuestCount', 'maxTravelCost', 'excludedShips', 'travelCostBySailing', 'Total trip cost', 'Exclude ship', 'rankingFactors', 'alternativeReason']) assert(portfolio.includes(marker), `Optimizer UI missing ${marker}`);
const optimizer = load('lib/intelligence/certificateRedemptionOptimizer.ts');
const sailings = [
  { shipName: 'Harmony', sailDate: '2026-09-10', levels: [{ certificateCode: '2609A04', cabinLabel: 'Balcony', guestCount: 2, departurePort: 'Port Canaveral', freePlay: 500, onBoardCredit: 75, itinerary: 'Bahamas' }] },
  { shipName: 'Icon', sailDate: '2026-10-10', levels: [{ certificateCode: '2609A04', cabinLabel: 'Interior', guestCount: 1, departurePort: 'Miami', freePlay: 100, onBoardCredit: 0, itinerary: 'Caribbean' }] },
];
const ranked = optimizer.optimizeCertificateRedemption(sailings, { certificateCode: '2609A04', requiredGuestCount: 2, airfareBySailing: { 'harmony__2026-09-10': 225 }, taxesBySailing: { 'harmony__2026-09-10': 0 }, upgradeBySailing: { 'harmony__2026-09-10': 0 }, maxTravelCost: 300 });
assert.equal(ranked.length, 1); assert.equal(ranked[0].shipName, 'Harmony'); assert.equal(ranked[0].expectedOutOfPocket, 225); assert.equal(ranked[0].confidence, 'high');

const casino = read('app/casino/relationship-intelligence.tsx');
for (const marker of ['Casino relationship lifecycle', 'buildRelationshipGraph', 'Earning cruises', 'Eligible sailings', 'Bookings', 'unresolved link', 'casino-lifecycle-open-relationship-explorer']) assert(casino.includes(marker), `Casino lifecycle UI missing ${marker}`);
const graph = load('lib/relationships/relationshipGraph.ts').buildRelationshipGraph({
  activeOwnerId: 'primary',
  bookedCruises: [{ id: 'trip', ownerId: 'primary', status: 'completed', shipName: 'Harmony', sailDate: '2026-09-10', returnDate: '2026-09-15', pointsEarned: 3000, reservationNumber: 'ABC', retailValue: 2500, amountPaid: 200, winLoss: 500 }],
  certificates: [{ id: 'cert', certificateCode: '2609A04', earnedCruiseId: 'trip', points: 3000, parsedSailings: [{ id: 'sailing', shipName: 'Harmony', sailDate: '2026-09-10', cabinLabel: 'Balcony', guestCount: 2, certificateCode: '2609A04' }] }],
  offers: [{ id: 'offer', offerCode: '2609A04', title: 'Balcony offer' }],
});
assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length, 'lifecycle nodes must be deduplicated');
assert(graph.edges.some((edge) => edge.id === 'earned:trip:cert'));
assert(graph.edges.some((edge) => edge.id === 'offer-link:cert:offer'));
assert(graph.edges.some((edge) => edge.id.startsWith('cert-sailing:cert:')));
assert(graph.edges.some((edge) => edge.id === 'booking-realized:trip'));
console.log('Build 440 Action Inbox, certificate optimizer, and casino lifecycle regression passed');
