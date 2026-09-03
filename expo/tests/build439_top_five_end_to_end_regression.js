#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
const mockDatabase = {
  withTransactionAsync: async (run) => run(),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  runAsync: async () => undefined,
};
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/database/HealthTrustDatabase') return { getHealthTrustDatabase: async () => mockDatabase };
  return originalLoad.call(this, request, parent, isMain);
};

function load(relative) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  return mod.exports;
}

try {
  const relationships = load('lib/relationships/relationshipGraph.ts');
  const integrity = load('lib/integrity/integrityCenter.ts');
  const optimizer = load('lib/intelligence/certificateRedemptionOptimizer.ts');
  const lifecycle = load('lib/casino/certificateEarningChain.ts');

  const primaryCruise = {
    id: 'primary-cruise', ownerId: 'primary', status: 'completed', shipName: 'Harmony',
    sailDate: '2026-09-10', returnDate: '2026-09-15', casinoPoints: 3_000,
    certificateCodeUsed: '2609A04', offerCode: '2609A04', retailValue: 2_500,
  };
  const certificate = { id: 'cert-1', certificateCode: '2609A04', points: 3_000, earnedCruiseId: 'primary-cruise', issueDate: '2026-09-14' };
  const offer = { id: 'offer-1', offerCode: '2609A04', certificateCode: '2609A04', title: 'September Balcony', value: 2_500 };

  const graph = relationships.buildRelationshipGraph({ bookedCruises: [primaryCruise], certificates: [certificate], offers: [offer], activeOwnerId: 'primary' });
  assert.equal(graph.completed, 1);
  assert.equal(graph.realized, 2_500);
  assert(graph.edges.some((edge) => edge.id === 'earned:primary-cruise:cert-1' && edge.confidence === 'exact'));
  assert(graph.edges.some((edge) => edge.id === 'offer-link:cert-1:offer-1'));
  assert(graph.edges.some((edge) => edge.id === 'missing-sailing:offer-1' && edge.confidence === 'unresolved'), 'a booking must not be joined directly to an offer when the eligible-sailing relationship is missing');
  const rejected = relationships.buildRelationshipGraph({ bookedCruises: [primaryCruise], certificates: [certificate], offers: [offer], activeOwnerId: 'primary', corrections: { 'earned:primary-cruise:cert-1': 'reject' } });
  assert(!rejected.edges.some((edge) => edge.id === 'earned:primary-cruise:cert-1'), 'a rejected inferred/user-reviewed relationship must remain excluded');
  const secondaryGraph = relationships.buildRelationshipGraph({ bookedCruises: [], certificates: [certificate], offers: [offer], activeOwnerId: 'secondary' });
  assert.equal(secondaryGraph.completed, 0, 'the secondary profile must not inherit the primary cruise');
  assert(!secondaryGraph.edges.some((edge) => edge.id.includes('primary-cruise')));

  const findings = integrity.scanIntegrity({
    ownerId: 'primary',
    loyalty: [{ id: 'royale', ownerId: 'primary', program: 'Club Royale', updatedAt: '2026-01-01T00:00:00.000Z' }],
  }, new Date('2026-08-29T12:00:00.000Z'));
  const inbox = integrity.integrityIssuesToInbox(findings);
  assert(inbox.some((item) => item.type === 'integrity:stale_loyalty' && item.ownerId === 'primary' && item.route.includes('data-trust-center')));
  assert(!inbox.some((item) => item.ownerId === 'secondary'), 'Action Inbox fixture must remain owner-scoped');

  const sailings = [
    { shipName: 'Harmony', sailDate: '2026-09-10', levels: [{ certificateCode: '2609A04', cabinLabel: 'Balcony', guestCount: 2, departurePort: 'Port Canaveral', freePlay: 500, onBoardCredit: 75, itinerary: 'Bahamas' }] },
    { shipName: 'Icon', sailDate: '2026-10-10', levels: [{ certificateCode: '2609A04', cabinLabel: 'Interior', guestCount: 1, departurePort: 'Miami', freePlay: 100, onBoardCredit: 0, itinerary: 'Caribbean' }] },
  ];
  const recommendations = optimizer.optimizeCertificateRedemption(sailings, {
    certificateCode: '2609A04', requiredGuestCount: 2, preferredShips: ['Harmony'],
    airfareBySailing: { 'harmony__2026-09-10': 100 }, taxesBySailing: { 'harmony__2026-09-10': 50 },
    upgradeBySailing: { 'harmony__2026-09-10': 0 }, maxTravelCost: 500,
  }, new Date('2026-08-29T12:00:00.000Z'));
  assert.equal(recommendations.length, 1, 'hard exclusions must be honored before best-use ranking');
  assert.equal(recommendations[0].shipName, 'Harmony');
  assert.equal(recommendations[0].confidence, 'high');
  assert(recommendations[0].rankingFactors.length >= 8);

  const earningLink = lifecycle.linkCertificateToEarningCruise({ certificate, completedCruises: [primaryCruise] });
  assert.equal(earningLink.likelyEarningCruise.id, 'primary-cruise');
  assert.equal(earningLink.confidence, 'high');

  for (const route of ['app/relationship-explorer.tsx', 'app/action-inbox.tsx', 'app/certificate-portfolio.tsx', 'app/casino/relationship-intelligence.tsx', 'app/data-trust-center.tsx']) {
    assert(fs.existsSync(path.join(root, route)), `${route} must remain navigable`);
  }
  const repository = fs.readFileSync(path.join(root, 'lib/database/highVolumeRepository.ts'), 'utf8');
  assert.match(repository, /listHighVolumeDomainPage/);
  assert.match(repository, /countDomainRecordsFiltered/);
  console.log('Build 439 top-five owner-scoped end-to-end fixture and navigation regression passed');
} finally {
  Module._load = originalLoad;
}
