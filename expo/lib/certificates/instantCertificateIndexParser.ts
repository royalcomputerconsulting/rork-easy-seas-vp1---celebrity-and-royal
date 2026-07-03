import { buildCertificateDetailUrl, INSTANT_CERTIFICATE_LEVEL_CODES, INSTANT_CERTIFICATE_POINTS, parseCertificateMonthCode, type CertificateBank } from './instantCertificateUrls';
import type { InstantCertificateLevel } from './instantCertificateSummaries';

export type InstantCertificateIndex = {
  monthCode: string;
  year: number;
  month: number;
  bank: CertificateBank;
  sourceUrl: string;
  levels: InstantCertificateLevel[];
  fetchedAt: string;
  status: 'available' | 'unavailable' | 'partial' | 'error';
  warnings: string[];
};

export const NEXT_MONTH_UNAVAILABLE_MESSAGE = "IT LOOKS LIKE THE NEXT MONTH'S CERTIFICATES ARE NOT AVAILABLE YET.";

function upper(value: unknown): string {
  return String(value ?? '').toUpperCase();
}

function parsePointsNearLevel(text: string, levelCode: string): number | null {
  const escaped = levelCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\b${escaped}\\b[^\\n]{0,80}?([0-9]{1,3}(?:,[0-9]{3})+)\\s*(?:POINT|PTS)`, 'i'),
    new RegExp(`([0-9]{1,3}(?:,[0-9]{3})+)\\s*(?:POINT|PTS)[^\\n]{0,80}?\\b${escaped}\\b`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1].replace(/,/g, ''));
  }
  return null;
}

export function parseInstantCertificateIndexText(input: {
  text: string;
  monthCode: string;
  bank: CertificateBank;
  sourceUrl: string;
  fetchedAt?: string;
}): InstantCertificateIndex {
  const parsed = parseCertificateMonthCode(input.monthCode);
  const raw = String(input.text ?? '');
  const normalized = upper(raw);
  const warnings: string[] = [];

  if (!raw.trim()) {
    return { monthCode: input.monthCode, ...parsed, bank: input.bank, sourceUrl: input.sourceUrl, levels: [], fetchedAt: input.fetchedAt ?? new Date().toISOString(), status: 'unavailable', warnings: ['Certificate index text was empty. Preserve cached data if available.'] };
  }

  const discovered = INSTANT_CERTIFICATE_LEVEL_CODES.filter((levelCode) => normalized.includes(levelCode));
  const levelCodes = discovered.length ? discovered : [...INSTANT_CERTIFICATE_LEVEL_CODES];
  if (!discovered.length) warnings.push('No level codes were explicitly detected in the index text; using default instant certificate ladder as fallback.');

  const levels: InstantCertificateLevel[] = levelCodes.map((levelCode) => {
    const parsedPoints = parsePointsNearLevel(raw, levelCode);
    const defaultPoints = INSTANT_CERTIFICATE_POINTS[levelCode];
    if (parsedPoints !== null && parsedPoints !== defaultPoints) warnings.push(`Parsed point value ${parsedPoints} for ${levelCode} differs from default ${defaultPoints}; parsed value preserved.`);
    return {
      code: `${input.monthCode}${input.bank}${levelCode}`,
      bank: input.bank,
      levelCode,
      pointsRequired: parsedPoints ?? defaultPoints,
      detailPdfUrl: buildCertificateDetailUrl(input.monthCode, input.bank, levelCode),
      detailStatus: 'not-fetched',
      sailings: [],
    };
  });

  return {
    monthCode: input.monthCode,
    ...parsed,
    bank: input.bank,
    sourceUrl: input.sourceUrl,
    levels,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    status: levels.length === INSTANT_CERTIFICATE_LEVEL_CODES.length ? 'available' : 'partial',
    warnings,
  };
}

export function buildUnavailableInstantCertificateIndex(input: {
  monthCode: string;
  bank: CertificateBank;
  sourceUrl: string;
  isNextMonth?: boolean;
  fetchedAt?: string;
  reason?: string;
}): InstantCertificateIndex {
  const parsed = parseCertificateMonthCode(input.monthCode);
  return {
    monthCode: input.monthCode,
    ...parsed,
    bank: input.bank,
    sourceUrl: input.sourceUrl,
    levels: [],
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    status: 'unavailable',
    warnings: [input.isNextMonth ? NEXT_MONTH_UNAVAILABLE_MESSAGE : (input.reason ?? 'Certificate index unavailable. Preserve cached data if available.')],
  };
}

export function mergeIndexWithCachedLevels(index: InstantCertificateIndex, cached?: InstantCertificateIndex): InstantCertificateIndex {
  if (!cached) return index;
  if (index.status === 'unavailable' || index.status === 'error' || index.levels.length === 0) {
    return {
      ...cached,
      fetchedAt: index.fetchedAt,
      warnings: [...index.warnings, 'Preserved cached certificate ladder because the latest fetch produced no usable rows.'],
      status: cached.status === 'available' ? 'partial' : cached.status,
    };
  }
  return index;
}
