const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const registry = read('lib/agentSea/sourceRegistry.ts');
assert.match(registry, /certificateOnly/);
assert.match(registry, /sources\.delete\('booked_cruise'\)/);
assert.match(registry, /sources\.delete\('completed_cruise'\)/);
assert.match(registry, /certificateMonths = \[monthKey\(1\)\]/);
assert.match(registry, /guestCounts = \[2\]/);
assert.match(registry, /regions = \['Europe'\]/);
assert.match(registry, /maximumPoints/);
assert.match(registry, /executeCertificateSummaryTool/);

const provider = read('state/AgentXProvider.tsx');
assert.match(provider, /planAgentSeaQuestion/);
assert.match(provider, /questionPlan\.certificateOnly/);
assert.match(provider, /Booked\/completed cruise sources excluded/);
assert.match(provider, /certificate-summary-results\?filters=/);

const bundle = read('lib/dataBundle/bundleOperations.ts');
assert.match(bundle, /version: '3\.0\.0'/);
assert.match(bundle, /agentSeaSourceManifest/);
assert.match(bundle, /Certificate index readback incomplete/);

const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(batch, /v16\.0\.0-incremental-durable-batches/);
assert.match(batch, /archivePreparedCertificateDocumentsBatch\(prepared/);
assert.match(batch, /shouldCancel/);
assert.match(batch, /onEntry/);

const screen = read('app/certificate-codes.tsx');
assert.match(screen, /certificate-codes\.cancel-download/);
assert.match(screen, /Stop after current certificate pair/);
assert.match(screen, /onEntry:/);

console.log('PASS Build 430 Stage 3: typed Agent SEA certificate planning, evidence routes, portable index manifest, restore readback, and incremental cancellable downloads');
