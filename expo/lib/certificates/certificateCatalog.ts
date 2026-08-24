import type { CertificateParseStatus, CertificateParserSource } from '@/lib/certificates/certificateParsingStatus';
import {
  DEFAULT_CERTIFICATE_FAMILIES,
  DEFAULT_CERTIFICATE_POINTS,
  getCertificateFamilyFromCode,
  getCertificateLevelCode,
  parseCertificateCode,
  type CertificateFamily,
} from '@/lib/certificates/certificatePdfParserCore';

export type CertificateType = CertificateFamily;

export interface CertificateCatalogEntry {
  certificateCode: string;
  certificateType: CertificateType;
  level: string;
  points: number | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
  catalogSource?: 'monthly-index-discovery' | 'known-level-fallback' | 'explicit-code';
  recognizedFamily?: boolean;
  sailingsFound?: number;
  status?: CertificateParseStatus | string;
  parserSource?: CertificateParserSource;
  downloadedBytes?: number | null;
  extractedTextLength?: number;
  parsedSailingReferences?: number;
  sailingGroups?: number;
  evidence?: string[];
  errorMessage?: string | null;
  documentSha256?: string | null;
  documentArchiveUri?: string | null;
}

interface StoredCertificateLike {
  certificateCode?: string;
  sourcePdfUrl?: string;
  parserStatus?: string;
  parserSource?: CertificateParserSource | string;
  parsedSailings?: unknown[];
}

interface StoredCertificateDocumentLike {
  documentKind?: string;
  originalUrl?: string;
  provenance?: { documentArchiveUri?: string | null };
  parseHistory?: Array<{ result?: { status?: string; parserSource?: CertificateParserSource | string; sailings?: unknown[] } }>;
}

export const CERTIFICATE_CATALOG_VERSION = 'v12.4.4-dynamic-family-and-level-discovery';
export const CERTIFICATE_LEVELS: { suffix: string; points: number }[] = Object.entries(DEFAULT_CERTIFICATE_POINTS)
  .map(([suffix, points]) => ({ suffix, points }))
  .sort((a, b) => b.points - a.points || a.suffix.localeCompare(b.suffix));
export const CERTIFICATE_FAMILIES = DEFAULT_CERTIFICATE_FAMILIES;
export const ROYAL_CERTIFICATE_BROAD_SHIP_QUERY = 'Star, Legend, Icon, Wonder, Utopia, Symphony, Harmony, Allure, Oasis, Odyssey, Anthem, Ovation, Quantum, Spectrum, Navigator, Voyager, Mariner, Explorer, Adventure, Freedom, Liberty, Independence, Enchantment, Grandeur, Rhapsody, Vision, Radiance, Brilliance, Serenade, Jewel';

export function buildCertificatePdfUrl(code: string): string {
  return `https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/${code.toUpperCase()}.pdf`;
}

export function getMonthCodeForTarget(target: 'thisMonth' | 'nextMonth', now = new Date()): string {
  const base = target === 'nextMonth' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  return `${String(base.getFullYear()).slice(-2)}${String(base.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabelForTarget(target: 'thisMonth' | 'nextMonth', now = new Date()): string {
  const base = target === 'nextMonth' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  return base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function buildCertificateCatalog(monthCode: string, certificateType: CertificateType): CertificateCatalogEntry[] {
  const normalizedMonth = monthCode.toUpperCase().replace(/[^0-9]/g, '').slice(0, 4);
  const family = String(certificateType || 'UNKNOWN').toUpperCase();
  const monthlyIndexUrl = buildCertificatePdfUrl(`${normalizedMonth}${family}`);
  return CERTIFICATE_LEVELS.map(({ suffix, points }) => {
    const certificateCode = `${normalizedMonth}${family}${suffix}`.toUpperCase();
    return { certificateCode, certificateType: family, level: suffix, points, pdfUrl: buildCertificatePdfUrl(certificateCode), monthlyIndexUrl, catalogSource: 'known-level-fallback', recognizedFamily: parseCertificateCode(certificateCode).recognizedFamily };
  });
}

export function buildCertificateCatalogFromCodes(codes: string[]): CertificateCatalogEntry[] {
  return Array.from(new Set(codes.map((code) => parseCertificateCode(code).code).filter(Boolean))).map((certificateCode) => {
    const parts = parseCertificateCode(certificateCode);
    return {
      certificateCode,
      certificateType: getCertificateFamilyFromCode(certificateCode),
      level: getCertificateLevelCode(certificateCode),
      points: DEFAULT_CERTIFICATE_POINTS[parts.levelCode] ?? null,
      pdfUrl: buildCertificatePdfUrl(certificateCode),
      monthlyIndexUrl: buildCertificatePdfUrl(`${parts.monthCode}${parts.family}`),
      catalogSource: 'explicit-code',
      recognizedFamily: parts.recognizedFamily,
    };
  });
}

function storedStatus(status: unknown, sailingCount: number): string {
  if (sailingCount > 0) return 'parsed';
  const normalized = String(status ?? '').toLowerCase();
  if (['parse_failed', 'network_error', 'unsupported_pdf', 'downloaded', 'downloading'].includes(normalized)) return normalized;
  return normalized.startsWith('parsed') ? 'parse_failed' : 'downloaded';
}

function codeFromStoredUrl(value: unknown): string {
  return String(value ?? '').match(/(?:^|\/)(\d{4}[AC][A-Z0-9]+)(?:\.pdf)?(?:[?#]|$)/i)?.[1]?.toUpperCase() ?? '';
}

function sailingCode(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  return String((value as Record<string, unknown>).certificateCode ?? '').trim().toUpperCase();
}

function sailingGroupCount(rows: unknown[]): number {
  return new Set(rows.map((value) => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return `${String(row.shipName ?? '').trim().toLowerCase()}__${String(row.sailingDate ?? row.sailDate ?? '').trim().slice(0, 10)}`;
  }).filter((value) => value !== '__')).size;
}

function storedParserSource(value: unknown): CertificateParserSource {
  return value === 'backend' || value === 'none' ? value : 'direct-device';
}

/**
 * Rebuilds the certificate-code screen from durable local PDF records. The
 * lookup screen already consumed these records, but the catalog screen used to
 * know only about downloads completed during its current mount.
 */
export function buildStoredCertificateCatalogEntries(input: {
  certificates?: StoredCertificateLike[];
  documents?: StoredCertificateDocumentLike[];
}): CertificateCatalogEntry[] {
  const byCode = new Map<string, CertificateCatalogEntry>();

  const merge = (codeValue: string, rows: unknown[], source: {
    pdfUrl?: string;
    archiveUri?: string | null;
    status?: string;
    parserSource?: CertificateParserSource | string;
  }) => {
    const code = parseCertificateCode(codeValue).code;
    const base = buildCertificateCatalogFromCodes([code])[0];
    if (!base || (base.certificateType !== 'A' && base.certificateType !== 'C')) return;
    const prior = byCode.get(code);
    const parsedSailingReferences = Math.max(prior?.parsedSailingReferences ?? 0, rows.length);
    byCode.set(code, {
      ...base,
      ...prior,
      pdfUrl: source.pdfUrl || prior?.pdfUrl || base.pdfUrl,
      status: storedStatus(source.status ?? prior?.status, parsedSailingReferences),
      parserSource: storedParserSource(source.parserSource || prior?.parserSource),
      parsedSailingReferences,
      sailingsFound: parsedSailingReferences,
      sailingGroups: Math.max(prior?.sailingGroups ?? 0, sailingGroupCount(rows)),
      documentArchiveUri: source.archiveUri || prior?.documentArchiveUri || null,
    });
  };

  for (const certificate of input.certificates ?? []) {
    const code = String(certificate.certificateCode ?? '').trim().toUpperCase();
    if (!code) continue;
    const allRows = Array.isArray(certificate.parsedSailings) ? certificate.parsedSailings : [];
    const rows = allRows.filter((row) => !sailingCode(row) || sailingCode(row) === code);
    merge(code, rows, {
      pdfUrl: certificate.sourcePdfUrl,
      status: certificate.parserStatus,
      parserSource: certificate.parserSource,
    });
  }

  for (const document of input.documents ?? []) {
    if (document.documentKind && document.documentKind !== 'certificate') continue;
    const latest = document.parseHistory?.[document.parseHistory.length - 1]?.result;
    const allRows = Array.isArray(latest?.sailings) ? latest.sailings : [];
    const codes = Array.from(new Set(allRows.map(sailingCode).filter(Boolean)));
    const fallbackCode = codeFromStoredUrl(document.originalUrl);
    if (codes.length === 0 && fallbackCode) codes.push(fallbackCode);
    for (const code of codes) {
      const rows = allRows.filter((row) => sailingCode(row) === code);
      merge(code, rows, {
        pdfUrl: document.originalUrl,
        archiveUri: document.provenance?.documentArchiveUri,
        status: latest?.status,
        parserSource: latest?.parserSource,
      });
    }
  }

  return Array.from(byCode.values()).sort((left, right) => left.certificateCode.localeCompare(right.certificateCode));
}

export function formatCertificatePoints(points: number | null | undefined): string {
  return points == null ? 'Points unknown' : `${points.toLocaleString()} Points`;
}
