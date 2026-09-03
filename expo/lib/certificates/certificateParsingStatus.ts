export const CERTIFICATE_PARSING_STATUS_VERSION = 'v2.0.0-material-row-dual-path-truthful-status';

export type CertificateParseStatus =
  | 'not_scanned'
  | 'downloading'
  | 'downloaded'
  | 'parsed'
  | 'parse_failed'
  | 'network_error'
  | 'unsupported_pdf';

export type CertificateParserSource = 'backend' | 'direct-device' | 'none';

export interface CertificateParseDiagnostics {
  status: CertificateParseStatus;
  parserSource: CertificateParserSource;
  downloadedBytes: number | null;
  extractedTextLength: number;
  parsedSailingReferences: number;
  sailingGroups: number;
  evidence: string[];
  message: string;
  errorMessage: string | null;
}

export interface CertificateCatalogParseEntry {
  certificateCode: string;
  status?: string;
  parserSource?: CertificateParserSource | string;
  downloadedBytes?: number | null;
  extractedTextLength?: number | null;
  textLength?: number | null;
  sailingsFound?: number | null;
  parsedSailingReferences?: number | null;
  sailingGroups?: number | null;
  evidence?: string[];
  errorMessage?: string | null;
}

const FINAL_STATUS_SET = new Set<CertificateParseStatus>([
  'not_scanned',
  'downloading',
  'downloaded',
  'parsed',
  'parse_failed',
  'network_error',
  'unsupported_pdf',
]);

function nonNegativeInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function countCertificateSailingGroups(matches: any[], certificateCode: string): number {
  const normalizedCode = certificateCode.toUpperCase();
  return matches.filter((match) =>
    Array.isArray(match?.levels) && match.levels.some(
      (level: any) => String(level?.certificateCode ?? '').toUpperCase() === normalizedCode,
    ),
  ).length;
}

export function countCertificateSailingReferences(matches: any[], certificateCode: string): number {
  const normalizedCode = certificateCode.toUpperCase();
  return matches.reduce((total, match) => {
    if (!Array.isArray(match?.levels)) return total;
    return total + match.levels.filter(
      (level: any) => String(level?.certificateCode ?? '').toUpperCase() === normalizedCode,
    ).length;
  }, 0);
}

export function normalizeCertificateParseDiagnostics(
  entry: CertificateCatalogParseEntry,
  matches: any[] = [],
  fallbackSource: CertificateParserSource = 'none',
): CertificateParseDiagnostics {
  const rawStatus = String(entry.status ?? 'not_scanned').toLowerCase();
  const parserSource = entry.parserSource === 'backend' || entry.parserSource === 'direct-device'
    ? entry.parserSource
    : fallbackSource;
  const downloadedBytes = entry.downloadedBytes == null ? null : nonNegativeInteger(entry.downloadedBytes);
  const extractedTextLength = nonNegativeInteger(entry.extractedTextLength ?? entry.textLength);
  const derivedReferences = countCertificateSailingReferences(matches, entry.certificateCode);
  const derivedGroups = countCertificateSailingGroups(matches, entry.certificateCode);
  const parsedSailingReferences = Math.max(
    derivedReferences,
    nonNegativeInteger(entry.parsedSailingReferences ?? entry.sailingsFound),
  );
  const sailingGroups = Math.max(derivedGroups, nonNegativeInteger(entry.sailingGroups));
  const errorMessage = entry.errorMessage ? String(entry.errorMessage) : null;

  let status: CertificateParseStatus;
  if (FINAL_STATUS_SET.has(rawStatus as CertificateParseStatus)) {
    status = rawStatus as CertificateParseStatus;
  } else if (rawStatus === 'ok') {
    status = parsedSailingReferences > 0 ? 'parsed' : 'parse_failed';
  } else if (rawStatus === 'no_sailings') {
    status = 'parse_failed';
  } else if (rawStatus === 'empty') {
    status = extractedTextLength > 0 ? 'unsupported_pdf' : 'network_error';
  } else if (rawStatus === 'error') {
    status = /pdf|format|header|content[- ]type|extract|unreadable/i.test(errorMessage ?? '')
      ? 'unsupported_pdf'
      : 'network_error';
  } else {
    status = 'not_scanned';
  }

  // A downloaded/scanned certificate may never be reported as successful when
  // it yielded zero sailing evidence. Zero references after readable PDF text
  // is a parser failure, not a successful empty result.
  if ((status === 'parsed' || status === 'downloaded') && parsedSailingReferences === 0) {
    status = extractedTextLength > 0 || downloadedBytes !== null ? 'parse_failed' : status;
  }
  if (parsedSailingReferences > 0) status = 'parsed';

  const evidence = Array.from(new Set([
    ...(Array.isArray(entry.evidence) ? entry.evidence.map(String) : []),
    parserSource !== 'none' ? `Parser source: ${parserSource}` : '',
    downloadedBytes !== null ? `Downloaded bytes: ${downloadedBytes.toLocaleString()}` : '',
    extractedTextLength > 0 ? `Extracted text characters: ${extractedTextLength.toLocaleString()}` : '',
    parsedSailingReferences > 0 ? `Parsed sailing references: ${parsedSailingReferences.toLocaleString()}` : '',
    sailingGroups > 0 ? `Sailing groups: ${sailingGroups.toLocaleString()}` : '',
  ].filter(Boolean)));

  const messageByStatus: Record<CertificateParseStatus, string> = {
    not_scanned: 'Certificate has not been scanned yet.',
    downloading: 'Certificate download is in progress.',
    downloaded: 'Certificate downloaded; parsing is still pending.',
    parsed: `${parsedSailingReferences.toLocaleString()} sailing reference${parsedSailingReferences === 1 ? '' : 's'} parsed into ${sailingGroups.toLocaleString()} group${sailingGroups === 1 ? '' : 's'}.`,
    parse_failed: 'The PDF downloaded, but no eligible sailings could be parsed. Open the PDF and export the certificate log for diagnostics.',
    network_error: errorMessage || 'The PDF could not be downloaded from the backend or Royal Caribbean.',
    unsupported_pdf: errorMessage || 'The downloaded file was not a readable supported PDF.',
  };

  return {
    status,
    parserSource,
    downloadedBytes,
    extractedTextLength,
    parsedSailingReferences,
    sailingGroups,
    evidence,
    message: messageByStatus[status],
    errorMessage,
  };
}

export function isCertificateParseSuccess(status: CertificateParseStatus): boolean {
  return status === 'parsed';
}
