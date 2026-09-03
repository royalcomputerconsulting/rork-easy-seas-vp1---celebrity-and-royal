import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildIntegrityIssuesJson } from '../lib/integrity/integrityIssueExport';
import type { IntegrityIssue } from '../lib/integrity/integrityCenter';

const screen = fs.readFileSync('app/data-trust-center.tsx', 'utf8');
for (const required of [
  'Current health score',
  'Health trend',
  'Last integrity scan',
  'label="Domain"',
  'label="Owner"',
  'label="Repair"',
  'label="Source"',
  'label="Status"',
  'data-trust-clear-filters',
  'data-trust-export-current-json',
  'Export CSV',
  'Export JSON',
]) assert.ok(screen.includes(required), `Data Trust is missing ${required}`);

const issue: IntegrityIssue = {
  id: 'issue-1', ownerId: 'owner-a', severity: 'critical', kind: 'orphan_offer_sailing',
  title: 'Orphan link', detail: 'The sailing does not resolve.', entityType: 'offer_sailing',
  entityIds: ['offer-1', 'sailing-2'], evidence: { source: 'certificate', offerId: 'offer-1' },
  repair: { kind: 'quarantine_orphan_link', payload: { id: 'link-1' } }, ambiguous: false,
  state: 'open', detectedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:01:00.000Z',
};
const parsed = JSON.parse(buildIntegrityIssuesJson([issue], { ownerId: 'owner-a', exportedAt: '2026-09-01T12:00:00.000Z', appliedFilters: { domain: 'offer_sailing' } }));
assert.equal(parsed.schemaVersion, 1);
assert.equal(parsed.issueCount, 1);
assert.equal(parsed.issues[0].severity, 'critical');
assert.equal(parsed.issues[0].owner, 'owner-a');
assert.deepEqual(parsed.issues[0].recordIds, ['offer-1', 'sailing-2']);
assert.equal(parsed.issues[0].repairability, 'safe');
assert.deepEqual(parsed.issues[0].proposedRepair.payload, { id: 'link-1' });
console.log('PASS Build 445 Data Trust summary, full filters, and CSV/JSON diagnostic export');
