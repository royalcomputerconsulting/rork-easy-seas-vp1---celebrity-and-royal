import { trpcClient } from '@/lib/trpc';
import { certificateDownloadLogger } from '@/lib/certificates/certificateDownloadLogger';
import {
  buildCertificateCatalog,
  type CertificateCatalogEntry,
  type CertificateType,
  ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
} from '@/lib/certificates/certificateCatalog';
import { fetchCertificatesDirectFromRoyalCaribbean } from '@/lib/certificates/clientCertificatePdfEngine';

export const CERTIFICATE_BATCH_DOWNLOAD_VERSION = 'v13.0.0-direct-device-fallback';

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

/**
 * Periodically pings the download logger with an elapsed-time heartbeat while
 * a slow request is in flight, so a long-running single-code retry never sits
 * on a static, unchanging message that looks frozen.
 */
function withHeartbeat<T>(promise: Promise<T>, baseMessage: string, certificateCodes: string[]): Promise<T> {
  const startedAt = Date.now();
  const intervalId = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    certificateDownloadLogger.setActivity(`${baseMessage} (${elapsedSeconds}s elapsed)`, certificateCodes);
  }, 4000);
  return promise.finally(() => clearInterval(intervalId));
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
      const result = await withHeartbeat(
        trpcClient.certificateExplorer.examine.mutate({
          monthCode: input.monthCode,
          shipQuery: input.shipQuery?.trim() || ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
          includeA: group.some((entry) => entry.certificateType === 'A'),
          includeC: group.some((entry) => entry.certificateType === 'C'),
          certificateCodes: codes,
        }),
        activity,
        codes,
      );
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
        const retryActivity = `Retrying ${entry.certificateCode} individually (${completedCodes + group.indexOf(entry) + 1} of ${entries.length}).`;
        certificateDownloadLogger.setActivity(retryActivity, [entry.certificateCode]);
        certificateDownloadLogger.log(`Retrying ${entry.certificateCode} individually.`, 'info', [entry.certificateCode]);
        try {
          const result = await withHeartbeat(
            trpcClient.certificateExplorer.examine.mutate({
              monthCode: input.monthCode,
              shipQuery: input.shipQuery?.trim() || ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
              includeA: entry.certificateType === 'A',
              includeC: entry.certificateType === 'C',
              certificateCodes: [entry.certificateCode],
            }),
            retryActivity,
            [entry.certificateCode],
          );
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
          // Our own backend failed (outage, capacity limit, timeout, bad
          // response). The certificate PDF itself is a public file on
          // royalcaribbean.com with nothing backend-specific about reading
          // it, so before giving up, try fetching and parsing it directly
          // from the device. This keeps certificate downloads working even
          // when our backend is temporarily down.
          const fallbackActivity = `Backend unavailable for ${entry.certificateCode} - downloading directly from Royal Caribbean instead.`;
          certificateDownloadLogger.setActivity(fallbackActivity, [entry.certificateCode]);
          certificateDownloadLogger.log(fallbackActivity, 'warning', [entry.certificateCode]);
          try {
            const directResult = await fetchCertificatesDirectFromRoyalCaribbean({
              monthCode: input.monthCode,
              shipQuery: input.shipQuery?.trim() || ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
              certificateCodes: [entry.certificateCode],
            });
            catalog.push(...directResult.catalog);
            matches.push(...directResult.matches);
            const directSailingCount = directResult.matches.filter((match) =>
              (match?.levels ?? []).some((level: any) => String(level?.certificateCode ?? '').toUpperCase() === entry.certificateCode.toUpperCase()),
            ).length;
            certificateDownloadLogger.log(
              `Downloaded ${entry.certificateCode} directly from Royal Caribbean (backend was unavailable): ${directSailingCount.toLocaleString()} eligible sailing group${directSailingCount === 1 ? '' : 's'} found.`,
              'success',
              [entry.certificateCode],
            );
          } catch (directError) {
            failedCodes.push(entry.certificateCode);
            certificateDownloadLogger.log(
              `${entry.certificateCode} failed on both the backend and a direct device download: ${directError instanceof Error ? directError.message : String(directError)}.`,
              'error',
              [entry.certificateCode],
            );
            console.warn('[CertificateBatchDownload] code failed on backend and direct fallback', entry.certificateCode, singleError, directError);
          }
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
