import { trpcClient } from '@/lib/trpc';
import { certificateDownloadLogger } from '@/lib/certificates/certificateDownloadLogger';
import {
  buildCertificateCatalog,
  type CertificateCatalogEntry,
  type CertificateType,
  ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
} from '@/lib/certificates/certificateCatalog';

export const CERTIFICATE_BATCH_DOWNLOAD_VERSION = 'v12.4.0-certificate-download-live-log-export';

export interface CertificateBatchResult {
  catalog: any[];
  matches: any[];
  summary: {
    attemptedCodes: number;
    completedCodes: number;
    failedCodes: string[];
    matchedCertificateCount: number;
    matchedSailingCount: number;
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function dedupeMatches(matches: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const match of matches) {
    const key = `${String(match?.shipName ?? '').toLowerCase()}__${String(match?.sailDate ?? '')}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, match);
      continue;
    }
    const levels = [...(existing.levels ?? []), ...(match.levels ?? [])];
    const levelByCode = new Map(levels.map((level: any) => [String(level?.certificateCode ?? level?.pdfUrl ?? Math.random()), level]));
    byKey.set(key, { ...existing, ...match, levels: Array.from(levelByCode.values()) });
  }
  return Array.from(byKey.values()).sort((a, b) => String(a.sailDate ?? '').localeCompare(String(b.sailDate ?? '')));
}

export async function downloadCertificateCatalogBatched(input: {
  monthCode: string;
  includeA?: boolean;
  includeC?: boolean;
  shipQuery?: string;
  certificateCodes?: string[];
  onProgress?: (completed: number, total: number) => void;
  resetLog?: boolean;
}): Promise<CertificateBatchResult> {
  const includeA = input.includeA ?? true;
  const includeC = input.includeC ?? true;
  const localEntries: CertificateCatalogEntry[] = [
    ...(includeC ? buildCertificateCatalog(input.monthCode, 'C') : []),
    ...(includeA ? buildCertificateCatalog(input.monthCode, 'A') : []),
  ];
  const requested = new Set((input.certificateCodes ?? []).map((code) => code.toUpperCase()));
  const entries = requested.size > 0
    ? localEntries.filter((entry) => requested.has(entry.certificateCode))
    : localEntries;

  const groups = chunk(entries, 3);
  const catalog: any[] = [];
  const matches: any[] = [];
  const failedCodes: string[] = [];
  let completedCodes = 0;

  certificateDownloadLogger.startSession(
    `Starting ${input.monthCode} certificate download: ${entries.length} A/C certificate code${entries.length === 1 ? '' : 's'} queued.`,
    { reset: input.resetLog ?? true, certificateCodes: entries.map((entry) => entry.certificateCode) },
  );

  if (entries.length === 0) {
    certificateDownloadLogger.finish('No certificate codes were selected for download.', 'warning');
  }

  for (const group of groups) {
    const codes = group.map((entry) => entry.certificateCode);
    const startIndex = completedCodes + 1;
    const endIndex = Math.min(completedCodes + group.length, entries.length);
    const activity = `Downloading ${codes.join(', ')} (${startIndex}-${endIndex} of ${entries.length}).`;
    certificateDownloadLogger.setActivity(activity, codes);
    certificateDownloadLogger.log(activity, 'info', codes);
    try {
      const result = await trpcClient.certificateExplorer.examine.mutate({
        monthCode: input.monthCode,
        shipQuery: input.shipQuery?.trim() || ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
        includeA: group.some((entry) => entry.certificateType === 'A'),
        includeC: group.some((entry) => entry.certificateType === 'C'),
        certificateCodes: codes,
      });
      const resultCatalog = Array.isArray((result as any)?.catalog) ? (result as any).catalog : [];
      const resultMatches = Array.isArray((result as any)?.matches) ? (result as any).matches : [];
      catalog.push(...resultCatalog);
      matches.push(...resultMatches);
      for (const code of codes) {
        const sailingCount = resultMatches.filter((match: any) =>
          (match?.levels ?? []).some((level: any) => String(level?.certificateCode ?? '').toUpperCase() === code.toUpperCase()),
        ).length;
        certificateDownloadLogger.log(
          `Downloaded ${code}: ${sailingCount.toLocaleString()} eligible sailing group${sailingCount === 1 ? '' : 's'} found.`,
          'success',
          [code],
        );
      }
    } catch (error) {
      certificateDownloadLogger.log(
        `Batch ${codes.join(', ')} did not finish. Retrying each certificate separately.`,
        'warning',
        codes,
      );
      console.warn('[CertificateBatchDownload] batch failed; retrying one code at a time', codes, error);
      for (const entry of group) {
        certificateDownloadLogger.setActivity(
          `Retrying ${entry.certificateCode} individually (${completedCodes + group.indexOf(entry) + 1} of ${entries.length}).`,
          [entry.certificateCode],
        );
        certificateDownloadLogger.log(`Retrying ${entry.certificateCode} individually.`, 'info', [entry.certificateCode]);
        try {
          const result = await trpcClient.certificateExplorer.examine.mutate({
            monthCode: input.monthCode,
            shipQuery: input.shipQuery?.trim() || ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
            includeA: entry.certificateType === 'A',
            includeC: entry.certificateType === 'C',
            certificateCodes: [entry.certificateCode],
          });
          const resultCatalog = Array.isArray((result as any)?.catalog) ? (result as any).catalog : [];
          const resultMatches = Array.isArray((result as any)?.matches) ? (result as any).matches : [];
          catalog.push(...resultCatalog);
          matches.push(...resultMatches);
          const sailingCount = resultMatches.filter((match: any) =>
            (match?.levels ?? []).some((level: any) => String(level?.certificateCode ?? '').toUpperCase() === entry.certificateCode.toUpperCase()),
          ).length;
          certificateDownloadLogger.log(
            `Downloaded ${entry.certificateCode}: ${sailingCount.toLocaleString()} eligible sailing group${sailingCount === 1 ? '' : 's'} found.`,
            'success',
            [entry.certificateCode],
          );
        } catch (singleError) {
          failedCodes.push(entry.certificateCode);
          certificateDownloadLogger.log(
            `${entry.certificateCode} failed: ${singleError instanceof Error ? singleError.message : String(singleError)}.`,
            'error',
            [entry.certificateCode],
          );
          console.warn('[CertificateBatchDownload] code failed', entry.certificateCode, singleError);
        }
      }
    }
    completedCodes += group.length;
    input.onProgress?.(Math.min(completedCodes, entries.length), entries.length);
    certificateDownloadLogger.setActivity(
      `Checked ${Math.min(completedCodes, entries.length)} of ${entries.length} certificate codes.`,
      [],
    );
  }

  const catalogByCode = new Map<string, any>();
  entries.forEach((entry) => catalogByCode.set(entry.certificateCode, { ...entry, status: 'not_scanned' }));
  catalog.forEach((entry) => catalogByCode.set(String(entry.certificateCode), { ...catalogByCode.get(String(entry.certificateCode)), ...entry }));
  failedCodes.forEach((code) => catalogByCode.set(code, { ...catalogByCode.get(code), status: 'error' }));

  const dedupedMatches = dedupeMatches(matches);
  const completedCount = Math.max(0, entries.length - failedCodes.length);
  const completionMessage = failedCodes.length > 0
    ? `Certificate download finished with ${completedCount} successful code${completedCount === 1 ? '' : 's'} and ${failedCodes.length} failure${failedCodes.length === 1 ? '' : 's'}.`
    : `Certificate download complete: ${completedCount} certificate code${completedCount === 1 ? '' : 's'} checked and ${dedupedMatches.length.toLocaleString()} eligible sailing group${dedupedMatches.length === 1 ? '' : 's'} found.`;
  certificateDownloadLogger.finish(completionMessage, failedCodes.length > 0 ? 'warning' : 'success');
  return {
    catalog: Array.from(catalogByCode.values()),
    matches: dedupedMatches,
    summary: {
      attemptedCodes: entries.length,
      completedCodes: completedCount,
      failedCodes,
      matchedCertificateCount: new Set(dedupedMatches.flatMap((match: any) => (match.levels ?? []).map((level: any) => level.certificateCode))).size,
      matchedSailingCount: dedupedMatches.length,
    },
  };
}
