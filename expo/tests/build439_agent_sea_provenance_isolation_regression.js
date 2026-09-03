#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const source = read('lib/agentSea/sourceRegistry.ts');
const file = path.join(root, 'lib/agentSea/sourceRegistry.ts');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/provenance/provenance') return {
    provenanceCitation: (link) => ({ sourceLabel: link.sourceRecord, observedAt: link.observedAt, confidence: link.confidence, formula: link.formula }),
    formatProvenanceCitation: (citation) => `Source: ${citation.sourceLabel}`,
  };
  if (request === '@/lib/certificates/certificateSailingIndex') return { buildLocalCertificateSailingIndex: () => [] };
  if (request === '@/lib/certificates/certificateSummary') return {
    buildCertificateSummaryReport: () => ({ certificateCount: 0, totalOptions: 0, physicalSailingCount: 0, rows: [] }),
    filterCertificateSummaryOptions: (rows) => rows,
    flattenCertificateSummaryOptions: () => [],
    sortCertificateSummaryOptions: (rows) => rows,
  };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  const registry = mod.exports;
  const observedAt = '2026-08-29T12:00:00.000Z';
  const links = [
    { id: 'p', ownerId: 'primary', entityId: 'same-cruise', field: 'casinoPoints', sourceRecord: 'Primary private win/loss', observedAt, confidence: 'high' },
    { id: 's', ownerId: 'secondary', entityId: 'same-cruise', field: 'casinoPoints', sourceRecord: 'Secondary private win/loss', observedAt, confidence: 'high' },
    { id: 'o', ownerId: null, entityId: 'shared-offer', field: 'offerCode', sourceRecord: 'Shared Club Royale sync', observedAt, confidence: 'high' },
    { id: 'bad', ownerId: 'primary', entityId: 'shared-offer', field: 'offerCode', sourceRecord: 'Private value must not decorate shared facts', observedAt, confidence: 'high' },
  ];
  const primary = registry.buildAgentSeaSourceRegistry({
    ownerId: 'primary',
    bookedCruises: [{ id: 'same-cruise', ownerProfileId: 'primary', status: 'completed' }],
    offers: [{ id: 'shared-offer', offerCode: '2609A03' }],
    provenanceLinks: links,
  });
  const primaryCitation = registry.buildAgentSeaProvenanceCitationBlock(primary);
  assert.match(primaryCitation, /Primary private win\/loss/);
  assert.doesNotMatch(primaryCitation, /Secondary private win\/loss/);
  assert.match(primaryCitation, /Shared Club Royale sync/);
  assert.doesNotMatch(primaryCitation, /Private value must not decorate shared facts/);

  const secondary = registry.buildAgentSeaSourceRegistry({
    ownerId: 'secondary',
    bookedCruises: [{ id: 'same-cruise', ownerProfileId: 'secondary', status: 'completed' }],
    offers: [{ id: 'shared-offer', offerCode: '2609A03' }],
    provenanceLinks: links,
  });
  const secondaryCitation = registry.buildAgentSeaProvenanceCitationBlock(secondary);
  assert.match(secondaryCitation, /Secondary private win\/loss/);
  assert.doesNotMatch(secondaryCitation, /Primary private win\/loss/);
  assert.match(secondaryCitation, /Shared Club Royale sync/);

  const bundle = read('lib/dataBundle/bundleOperations.ts');
  assert.match(bundle, /provenanceLinks\?: ProvenanceLink\[\]/);
  assert.match(bundle, /listAllProvenanceLinks/);
  assert.match(bundle, /storeProvenanceLinks\(safeLinks\)/);
  assert.match(bundle, /provenanceLinks: bundle\.provenanceLinks \?\? \[\]/);
  const agent = read('state/AgentXProvider.tsx');
  assert.match(agent, /aiEvidenceWithProvenance/);
  assert.match(agent, /listAllProvenanceLinks\(provenanceOwner\)/);
  console.log('Build 439 Agent SEA provenance citation and primary/secondary owner-isolation regression passed');
} finally {
  Module._load = originalLoad;
}
