import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIntegrityIssuesCsv, filterIntegrityIssuesForExport } from '../lib/integrity/integrityIssueExport';
import type { IntegrityIssue } from '../lib/integrity/integrityCenter';

const now = '2026-09-01T12:00:00.000Z';
const issue = (severity: IntegrityIssue['severity'], title: string): IntegrityIssue => ({
  id: `issue-${severity}`,
  ownerId: 'owner-1',
  severity,
  kind: severity === 'critical' ? 'owner_leakage' : 'stale_loyalty',
  title,
  detail: `Detail with a comma, and "quoted" evidence for ${title}`,
  entityType: 'test-record',
  entityIds: [`record-${severity}`],
  evidence: { severity, source: 'test' },
  repair: severity === 'critical' ? null : { kind: 'request_loyalty_sync', payload: { program: 'Royal' } },
  ambiguous: severity === 'critical',
  state: 'open',
  detectedAt: now,
  updatedAt: now,
});

const issues = [issue('critical', 'Critical issue'), issue('high', 'High issue'), issue('medium', 'Medium warning'), issue('low', 'Low warning')];
assert.equal(filterIntegrityIssuesForExport(issues, 'all').length, 4);
assert.deepEqual(filterIntegrityIssuesForExport(issues, 'errors').map((row) => row.severity), ['critical', 'high']);
assert.deepEqual(filterIntegrityIssuesForExport(issues, 'warnings').map((row) => row.severity), ['medium', 'low']);

const csv = buildIntegrityIssuesCsv(issues);
assert.match(csv, /"Severity","Owner","Source","Domain","Issue Type","Title"/);
assert.match(csv, /"Critical issue"/);
assert.match(csv, /"Detail with a comma, and ""quoted"" evidence/);
assert.match(csv, /"record-critical"/);

const screen = fs.readFileSync(path.join(process.cwd(), 'app/data-trust-center.tsx'), 'utf8');
const disclosure = fs.readFileSync(path.join(process.cwd(), 'components/ui/ProgressiveDisclosure.tsx'), 'utf8');
[
  "exportIntegrityReport('all')",
  "exportIntegrityReport('warnings')",
  "exportIntegrityReport('errors')",
  'title="Load Encrypted Backup"',
  'data-trust-copy-recovery-key',
  'data-trust-paste-recovery-key',
  'data-trust-load-with-saved-recovery-key',
  'data-trust-recover-all-data',
  "pickRestore({ value: recoveryKey, type: 'recovery-key' })",
].forEach((required) => assert.ok(screen.includes(required), `Missing Data Trust behavior: ${required}`));
assert.ok(disclosure.includes('item.onPress'), 'Summary conclusions must support direct actions.');
assert.ok(disclosure.includes('progressive-conclusion-${item.id}'), 'Actionable summary conclusions need stable test IDs.');

console.log('PASS Build 445 Data Trust issue export, explicit encrypted load, and recovery-key workflow');
