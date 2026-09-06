import type { IntegrityIssue, IntegritySeverity } from './integrityCenter';

export type IntegrityIssueExportFilter = 'all' | 'errors' | 'warnings';
export type IntegrityIssueExportFormat = 'csv' | 'json';

const ERROR_SEVERITIES = new Set<IntegritySeverity>(['critical', 'high']);

export function filterIntegrityIssuesForExport(
  issues: IntegrityIssue[],
  filter: IntegrityIssueExportFilter,
): IntegrityIssue[] {
  if (filter === 'errors') return issues.filter((issue) => ERROR_SEVERITIES.has(issue.severity));
  if (filter === 'warnings') return issues.filter((issue) => !ERROR_SEVERITIES.has(issue.severity));
  return [...issues];
}

function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildIntegrityIssuesCsv(issues: IntegrityIssue[]): string {
  const headers = [
    'Severity',
    'Owner',
    'Source',
    'Domain',
    'Issue Type',
    'Title',
    'What Needs Attention',
    'Record Type',
    'Record IDs',
    'Manual Review Required',
    'Safe Repair Available',
    'Current State',
    'Detected At',
    'Updated At',
    'Evidence',
    'Proposed Repair',
  ];
  const rows = issues.map((issue) => [
    issue.severity,
    issue.ownerId ?? 'Shared',
    'Automatic Integrity Center',
    issue.entityType,
    issue.kind.replaceAll('_', ' '),
    issue.title,
    issue.detail,
    issue.entityType,
    issue.entityIds.join(' | '),
    issue.ambiguous ? 'Yes' : 'No',
    issue.repair && !issue.ambiguous ? 'Yes' : 'No',
    issue.state,
    issue.detectedAt,
    issue.updatedAt,
    issue.evidence,
    issue.repair ?? '',
  ]);
  return [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

export function buildIntegrityIssuesJson(
  issues: IntegrityIssue[],
  options: {
    filter?: IntegrityIssueExportFilter;
    exportedAt?: string;
    ownerId?: string;
    appliedFilters?: Record<string, string>;
  } = {},
): string {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  return JSON.stringify({
    schemaVersion: 1,
    reportType: 'easy-seas-data-trust-issues',
    exportedAt,
    ownerId: options.ownerId ?? null,
    severityView: options.filter ?? 'all',
    appliedFilters: options.appliedFilters ?? {},
    issueCount: issues.length,
    issues: issues.map((issue) => ({
      severity: issue.severity,
      owner: issue.ownerId ?? 'Shared',
      source: 'Automatic Integrity Center',
      domain: issue.entityType,
      issueType: issue.kind,
      title: issue.title,
      explanation: issue.detail,
      recordIds: issue.entityIds,
      repairability: issue.repair && !issue.ambiguous ? 'safe' : 'manual-review',
      status: issue.state,
      detectedAt: issue.detectedAt,
      updatedAt: issue.updatedAt,
      evidence: issue.evidence,
      proposedRepair: issue.repair ?? null,
    })),
  }, null, 2);
}
