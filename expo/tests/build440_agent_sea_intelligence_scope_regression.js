#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadTypeScriptModule(relative, mocks) {
  const file = path.join(root, relative);
  const source = read(relative);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(file, module);
    mod.filename = file;
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    mod._compile(js, file);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const registry = loadTypeScriptModule('lib/agentSea/sourceRegistry.ts', {
  '@/lib/provenance/provenance': { provenanceCitation: (link) => link, formatProvenanceCitation: (citation) => citation.sourceRecord || 'source' },
  '@/lib/certificates/certificateSailingIndex': { buildLocalCertificateSailingIndex: () => [] },
  '@/lib/certificates/certificateSummary': {
    buildCertificateSummaryReport: () => ({ certificateCount: 0, totalOptions: 0, physicalSailingCount: 0, rows: [] }),
    filterCertificateSummaryOptions: (rows) => rows,
    flattenCertificateSummaryOptions: () => [],
    sortCertificateSummaryOptions: (rows) => rows,
  },
});

const manifest = registry.buildAgentSeaSourceManifest({
  ownerId: 'primary',
  cruises: [{ id: 'shared-cruise' }],
  offers: [{ id: 'shared-offer' }],
  bookedCruises: [{ id: 'private-booked', ownerProfileId: 'primary', status: 'booked' }],
  loyaltyRecords: [{ id: 'loyalty', ownerProfileId: 'primary' }],
  financialRecords: [{ id: 'finance', ownerProfileId: 'primary' }],
  casinoRecords: [{ id: 'casino', ownerProfileId: 'primary' }],
  crewRecords: [{ id: 'crew', ownerProfileId: 'primary' }],
  weatherRecords: [{ id: 'weather', ownerProfileId: 'primary' }],
  provenanceRecords: [{ id: 'provenance', ownerId: 'primary', sourceType: 'manual_entry' }],
});
assert.equal(manifest.counts.loyalty, 1);
assert.equal(manifest.counts.finance, 1);
assert.equal(manifest.counts.provenance, 1);
assert.match(registry.executeAgentSeaSourceManifestTool('Where did my financial loyalty data come from?', manifest), /finance: 1 indexed record/);
assert.match(registry.executeAgentSeaSourceManifestTool('Where did my financial loyalty data come from?', manifest), /loyalty: 1 indexed record/);
assert.match(registry.executeAgentSeaSourceManifestTool('Where did my financial loyalty data come from?', manifest), /provenance: 1 indexed record/);

const direct = loadTypeScriptModule('lib/agentSea/directAnswers.ts', {
  '@/lib/casino/casinoTruthEngine': {
    buildCasinoCruiseTruth: ({ cruise }) => cruise.__truth,
  },
  '@/lib/casino/casinoProgramSeasons': {
    getCasinoProgramSeason: () => ({ label: '2026 Club Royale earning year' }),
    isDateInCasinoSeason: () => true,
  },
  '@/lib/format': { formatCount: (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}` },
});
const answer = direct.buildAgentSeaDirectAnswer({
  question: 'What is my ADT?',
  bookedCruises: [{ __truth: {
    cruiseId: 'c1', program: 'club_royale', sailDate: '2026-06-01', shipName: 'Harmony of the Seas',
    theoreticalLoss: { value: 900, kind: 'recorded' }, ratedGamingDays: 3,
    ratedGamingDaysSource: 'recorded',
  } }],
});
assert.match(answer.text, /\$300\.00 per rated gaming day/);
assert.match(answer.evidence, /Harmony of the Seas/);

const provider = read('state/AgentXProvider.tsx');
assert.match(provider, /sharedIntelligenceFilterSnapshot/);
assert.match(provider, /privateIntelligenceFilterSnapshot/);
assert.match(provider, /selectedProfileId: 'all' as const/);
assert.match(provider, /if \(directAnswer\) \{/);
assert.match(provider, /content: directAnswer\.text/);
assert.match(provider, /const finalAnswer = aiResult\.text \|\| localAnswer/);
assert.ok(provider.indexOf('if (directAnswer) {') < provider.indexOf('const catalogPage = await queryCruises'), 'deterministic answers must return before the broad catalog query');
assert.match(provider, /executeAgentSeaSourceManifestTool/);
assert.match(provider, /loyaltyRecords:/);
assert.match(provider, /financialRecords:/);
assert.match(provider, /provenanceRecords:/);

const ai = read('lib/agentSeaAI.ts');
assert.match(ai, /expo-secure-store/);
assert.match(ai, /accountStorageKey/);
assert.doesNotMatch(ai, /sk-proj-/);

console.log('PASS build440_agent_sea_intelligence_scope_regression');
