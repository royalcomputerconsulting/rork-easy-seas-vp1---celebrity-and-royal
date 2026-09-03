import { certificateDownloadLogger } from '@/lib/certificates/certificateDownloadLogger';
import {
  buildCertificateCatalog,
  buildCertificateCatalogFromCodes,
  buildCertificatePdfUrl,
  type CertificateCatalogEntry,
  ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
} from '@/lib/certificates/certificateCatalog';
import { fetchCertificatesDirectFromRoyalCaribbean } from '@/lib/certificates/clientCertificatePdfEngine';
import { discoverCertificateCodesFromDownloadedPdf, downloadPublicCertificatePdf } from '@/lib/certificates/certificatePdfPipeline';
import {
  archiveCertificatePdfBytes,
  archivePreparedCertificateDocumentsBatch,
  prepareCertificatePdfArchive,
  type CertificatePdfArchiveInput,
  type PreparedCertificateDocument,
} from '@/lib/certificates/certificateDocumentStore';

// archivePreparedCertificateDocumentsBatch is the bounded-memory successor to
// archiveCertificatePdfBytesBatch: parsed document records are retained, never
// an entire batch of decoded PDF byte arrays.
import { materialCertificateLevelKey, parseCertificateCode, type CertificateFamily } from '@/lib/certificates/certificatePdfParserCore';
import {
  countCertificateSailingGroups,
  countCertificateSailingReferences,
  normalizeCertificateParseDiagnostics,
  type CertificateParseDiagnostics,
  type CertificateParserSource,
} from '@/lib/certificates/certificateParsingStatus';

export const CERTIFICATE_BATCH_DOWNLOAD_VERSION = 'v16.0.0-incremental-durable-batches';
export const CERTIFICATE_DOWNLOAD_LIVE_LOG_COMPATIBILITY = 'v12.7.0-hermes-explicit-date-evidence';

const activeCertificateBatchKeys = new Set<string>();

export const CERTIFICATE_BATCH_ALREADY_RUNNING = 'CERTIFICATE_BATCH_ALREADY_RUNNING';
export const CERTIFICATE_BATCH_CANCELLED = 'CERTIFICATE_BATCH_CANCELLED';

export interface CertificateBatchResult {
  catalog: any[];
  matches: any[];
  diagnostics: Record<string, CertificateParseDiagnostics>;
  summary: {
    attemptedCodes: number; completedCodes: number; parsedCodes: number;
    discoveredCodes: number; skippedCompletedCodes: string[];
    parseFailedCodes: string[]; networkErrorCodes: string[]; unsupportedPdfCodes: string[]; failedCodes: string[];
    matchedCertificateCount: number; matchedSailingCount: number; parsedSailingReferenceCount: number; parsedSailingGroupCount: number;
    discoveryEvidence: string[]; parserDiscrepancies: string[];
  };
}

function chunk<T>(items: T[], size: number): T[][] { const result: T[][] = []; for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size)); return result; }
function statusPriority(status: string | undefined): number { return ({ parsed: 7, parse_failed: 6, unsupported_pdf: 5, network_error: 4, downloaded: 3, downloading: 2, not_scanned: 1 } as Record<string, number>)[String(status ?? 'not_scanned')] ?? 0; }
function mergeCatalogEntry(existing: any, incoming: any): any { if (!existing) return incoming; if (!incoming) return existing; const preferred = statusPriority(incoming.status) >= statusPriority(existing.status) ? incoming : existing; const secondary = preferred === incoming ? existing : incoming; return { ...secondary, ...preferred, evidence: Array.from(new Set([...(secondary.evidence ?? []), ...(preferred.evidence ?? [])])), parserSources: Array.from(new Set([...(secondary.parserSources ?? []), ...(preferred.parserSources ?? []), secondary.parserSource, preferred.parserSource].filter(Boolean))) }; }

function dedupeMatches(matches: any[]): any[] {
  const groups = new Map<string, any>();
  for (const match of matches) {
    const key = `${String(match?.shipName ?? '').trim().toLowerCase()}__${String(match?.sailDate ?? '').trim()}`;
    const existing = groups.get(key) ?? { shipName: match?.shipName, sailDate: match?.sailDate, levels: [], decisionGuide: [], opportunities: [], parserDiscrepancies: [] };
    for (const level of Array.isArray(match?.levels) ? match.levels : []) {
      const materialKey = materialCertificateLevelKey(level);
      const found = existing.levels.find((candidate: any) => materialCertificateLevelKey(candidate) === materialKey);
      if (found) {
        found.parserSources = Array.from(new Set([...(found.parserSources ?? []), ...(level.parserSources ?? [])]));
        found.benefitEvidence = Array.from(new Set([...(found.benefitEvidence ?? []), ...(level.benefitEvidence ?? [])]));
      } else existing.levels.push(level);
    }
    existing.decisionGuide = Array.from(new Set([
      ...(existing.decisionGuide ?? []),
      ...(Array.isArray(match?.decisionGuide) ? match.decisionGuide : []),
    ]));
    const opportunitiesByKey = new Map<string, any>();
    [...(existing.opportunities ?? []), ...(Array.isArray(match?.opportunities) ? match.opportunities : [])]
      .forEach((opportunity: any) => {
        const key = `${String(opportunity?.fromCode ?? '')}__${String(opportunity?.toCode ?? '')}__${String(opportunity?.summary ?? '')}`;
        opportunitiesByKey.set(key, opportunity);
      });
    existing.opportunities = Array.from(opportunitiesByKey.values());
    existing.parserDiscrepancies = Array.from(new Set([...(existing.parserDiscrepancies ?? []), ...(match?.parserDiscrepancies ?? [])]));
    groups.set(key, existing);
  }
  return Array.from(groups.values()).sort((a, b) => String(a.shipName ?? '').localeCompare(String(b.shipName ?? '')) || String(a.sailDate ?? '').localeCompare(String(b.sailDate ?? '')));
}

function filterResultForCode(result: any, code: string): any {
  const upper = code.toUpperCase();
  return {
    ...result,
    catalog: (Array.isArray(result?.catalog) ? result.catalog : []).filter((entry: any) => String(entry?.certificateCode ?? '').toUpperCase() === upper),
    matches: (Array.isArray(result?.matches) ? result.matches : []).map((match: any) => ({ ...match, levels: (Array.isArray(match?.levels) ? match.levels : []).filter((level: any) => String(level?.certificateCode ?? '').toUpperCase() === upper) })).filter((match: any) => match.levels.length > 0),
  };
}

async function discoverEntries(input: { monthCode: string; families: CertificateFamily[]; explicitCodes: string[]; documentStorageKey?: string }): Promise<{ entries: CertificateCatalogEntry[]; evidence: string[] }> {
  if (input.explicitCodes.length > 0) {
    return { entries: buildCertificateCatalogFromCodes(input.explicitCodes), evidence: ['Used explicit certificate codes; unknown families were preserved.'] };
  }

  const directCodes = new Set<string>();
  const directEvidence: string[] = [];
  for (const family of input.families.filter((value) => value === 'A' || value === 'C')) {
    const indexCode = `${input.monthCode}${family}`;
    const indexUrl = buildCertificatePdfUrl(indexCode);
    const download = await downloadPublicCertificatePdf(indexUrl);
    if (download.status !== 'downloaded' || !download.bytes) {
      directEvidence.push(`${indexCode} monthly index was unavailable on device: ${download.errorMessage ?? download.status}.`);
      continue;
    }

    const discovered = discoverCertificateCodesFromDownloadedPdf(download, {
      monthCode: input.monthCode,
      familyCodes: [family],
    });
    discovered.forEach((code) => directCodes.add(code));
    const storage = await archiveCertificatePdfBytes({
      certificateCode: indexCode,
      sourceUrl: indexUrl,
      bytes: download.bytes,
      parserSource: 'direct-device-index',
      provenance: download.provenance,
      storageKey: input.documentStorageKey,
      metadata: {
        documentKind: 'monthly_index',
        discoveryEvidence: {
          monthCode: input.monthCode,
          familyCode: family,
          discoveredCodes: discovered,
          discoveredAt: new Date().toISOString(),
        },
      },
    });
    directEvidence.push(`${indexCode} monthly index downloaded directly from Royal; discovered ${discovered.length} certificate code${discovered.length === 1 ? '' : 's'}${storage.storageStatus === 'stored' ? ' and retained the source PDF' : ''}.`);
  }

  if (directCodes.size > 0) {
    return { entries: buildCertificateCatalogFromCodes(Array.from(directCodes)), evidence: directEvidence };
  }

  return {
    entries: input.families.flatMap((family) => buildCertificateCatalog(input.monthCode, family)),
    evidence: [...directEvidence, 'Used the known A/C level ladder because the direct Royal monthly index was unavailable. No Easy Seas backend was contacted.'],
  };
}

export async function downloadCertificateCatalogBatched(input: {
  monthCode: string; includeA?: boolean; includeC?: boolean; includeD?: boolean; certificateFamilies?: string[];
  shipQuery?: string; sailDate?: string; certificateCodes?: string[]; verifyParserParity?: boolean;
  documentStorageKey?: string;
  skipCertificateCodes?: string[];
  onProgress?: (completed: number, total: number) => void; resetLog?: boolean;
  onEntry?: (entry: any, completed: number, total: number) => void;
  shouldCancel?: () => boolean;
}): Promise<CertificateBatchResult> {
  const operationKey = input.documentStorageKey ?? '__default_certificate_store__';
  if (activeCertificateBatchKeys.has(operationKey)) {
    throw new Error(`${CERTIFICATE_BATCH_ALREADY_RUNNING}: A certificate download is already running. Wait for it to finish before starting another.`);
  }
  activeCertificateBatchKeys.add(operationKey);

  try {
  const families: CertificateFamily[] = input.certificateFamilies?.length
    ? Array.from(new Set(input.certificateFamilies.map((value) => value.toUpperCase())))
    : [input.includeA ?? true ? 'A' : '', input.includeC ?? true ? 'C' : ''].filter(Boolean);
  const explicitCodes = Array.from(new Set((input.certificateCodes ?? []).map((code) => parseCertificateCode(code).code).filter(Boolean)));
  certificateDownloadLogger.startSession(
    explicitCodes.length > 0
      ? `Preparing ${explicitCodes.length} selected certificate PDF${explicitCodes.length === 1 ? '' : 's'} for direct download.`
      : `Downloading Royal's ${input.monthCode} monthly certificate index to discover every available A/C code.`,
    { reset: input.resetLog ?? true, certificateCodes: explicitCodes },
  );
  const discovery = await discoverEntries({ monthCode: input.monthCode, families, explicitCodes, documentStorageKey: input.documentStorageKey });
  const discoveredEntries = discovery.entries;
  const skippedCodeSet = new Set((input.skipCertificateCodes ?? []).map((code) => parseCertificateCode(code).code).filter(Boolean));
  const skippedCompletedCodes = discoveredEntries
    .map((entry) => entry.certificateCode)
    .filter((code) => skippedCodeSet.has(code));
  const entries = discoveredEntries.filter((entry) => !skippedCodeSet.has(entry.certificateCode));
  const discoveredOrdinal = new Map(discoveredEntries.map((entry, index) => [entry.certificateCode, index + 1]));
  // Two concurrent PDFs keeps network throughput high without retaining three
  // large PDF byte buffers and parser workspaces at once on older iPhones.
  const groups = chunk(entries, 2);
  const catalogByCode = new Map<string, any>();
  const diagnosticsByCode = new Map<string, CertificateParseDiagnostics>();
  const allMatches: any[] = [];
  // Convert each finished PDF to a light retained-document record immediately.
  // The native file URI remains durable while the multi-megabyte byte buffer
  // can be released before the next download group begins.
  const preparedArchivesByCode = new Map<string, PreparedCertificateDocument>();
  const archivePreparationErrorsByCode = new Map<string, string>();
  const parserDiscrepancies = new Set<string>();
  let completedCodes = 0;

  entries.forEach((entry) => catalogByCode.set(entry.certificateCode, { ...entry, status: 'not_scanned', parserSource: 'none', parsedSailingReferences: 0, sailingGroups: 0, evidence: [] }));
  certificateDownloadLogger.startSession(
    `Starting ${input.monthCode} certificate library check: ${discoveredEntries.length} total certificate${discoveredEntries.length === 1 ? '' : 's'}; ${entries.length} missing/failed queued; ${skippedCompletedCodes.length} already saved.`,
    { reset: false, certificateCodes: discoveredEntries.map((entry) => entry.certificateCode) },
  );
  discovery.evidence.forEach((line) => certificateDownloadLogger.log(line, 'info'));
  if (skippedCompletedCodes.length > 0) {
    skippedCompletedCodes.forEach((code) => certificateDownloadLogger.updateCertificate(code, 'saved', 'Already parsed and saved locally'));
    certificateDownloadLogger.log(`Preserved ${skippedCompletedCodes.length} completed certificate${skippedCompletedCodes.length === 1 ? '' : 's'} without downloading or parsing them again: ${skippedCompletedCodes.join(', ')}.`, 'success', skippedCompletedCodes);
  }
  input.onProgress?.(skippedCompletedCodes.length, discoveredEntries.length);

  if (entries.length === 0) {
    certificateDownloadLogger.finish(`Certificate library complete: all ${skippedCompletedCodes.length} discovered certificate code${skippedCompletedCodes.length === 1 ? '' : 's'} are parsed and saved locally.`, 'success');
    return {
      catalog: [],
      matches: [],
      diagnostics: {},
      summary: {
        attemptedCodes: 0,
        completedCodes: 0,
        parsedCodes: 0,
        discoveredCodes: discoveredEntries.length,
        skippedCompletedCodes,
        parseFailedCodes: [],
        networkErrorCodes: [],
        unsupportedPdfCodes: [],
        failedCodes: [],
        matchedCertificateCount: 0,
        matchedSailingCount: 0,
        parsedSailingReferenceCount: 0,
        parsedSailingGroupCount: 0,
        discoveryEvidence: discovery.evidence,
        parserDiscrepancies: [],
      },
    };
  }

  const callDirectPerCode = async (code: string): Promise<any | null> => {
    const slowDownloadNotice = setTimeout(() => {
      certificateDownloadLogger.updateCertificate(code, 'downloading', 'Royal is responding slowly; Easy Seas is trying the timed fetch fallback');
      certificateDownloadLogger.log(`The native ${code} download is taking longer than expected. The bounded fetch fallback will run automatically.`, 'warning', [code]);
    }, 8_000);
    try {
      certificateDownloadLogger.updateCertificate(code, 'downloading', 'Downloading official Royal PDF');
      certificateDownloadLogger.log(`Downloading certificate ${code} directly from Royal.`, 'info', [code]);
      return await fetchCertificatesDirectFromRoyalCaribbean({
        monthCode: input.monthCode,
        shipQuery: input.shipQuery?.trim() || ROYAL_CERTIFICATE_BROAD_SHIP_QUERY,
        sailDate: input.sailDate,
        certificateCodes: [code],
        documentStorageKey: input.documentStorageKey,
        deferDocumentStorage: true,
      });
    } catch (error) {
      certificateDownloadLogger.updateCertificate(code, 'failed', error instanceof Error ? error.message : String(error));
      certificateDownloadLogger.log(`Direct-device verification/archive failed for ${code}: ${error instanceof Error ? error.message : String(error)}`, 'warning', [code]);
      return null;
    } finally {
      clearTimeout(slowDownloadNotice);
    }
  };

  const ingestCodeResult = (code: string, result: any, fallbackSource: CertificateParserSource) => {
    const codeResult = filterResultForCode(result, code);
    allMatches.push(...codeResult.matches);
    const local = catalogByCode.get(code) ?? entries.find((entry) => entry.certificateCode === code) ?? { certificateCode: code };
    const returned = codeResult.catalog[0] ?? { ...local, status: 'network_error', parserSource: fallbackSource, errorMessage: 'No parser catalog result was returned.' };
    const enriched = {
      ...local, ...returned,
      sailingGroups: Math.max(Number(returned.sailingGroups ?? 0), countCertificateSailingGroups(codeResult.matches, code)),
      parsedSailingReferences: Math.max(Number(returned.parsedSailingReferences ?? returned.sailingsFound ?? 0), countCertificateSailingReferences(codeResult.matches, code)),
    };
    const diagnostic = normalizeCertificateParseDiagnostics(enriched, codeResult.matches, returned.parserSource ?? fallbackSource);
    catalogByCode.set(code, mergeCatalogEntry(catalogByCode.get(code), { ...enriched, ...diagnostic, sailingsFound: diagnostic.parsedSailingReferences }));
    diagnosticsByCode.set(code, diagnostic);
    (result?.parserParity?.discrepancies ?? []).forEach((line: string) => parserDiscrepancies.add(line));
  };

  for (const group of groups) {
    if (input.shouldCancel?.()) throw new Error(`${CERTIFICATE_BATCH_CANCELLED}: Download stopped after preserving all completed certificate batches.`);
    const codes = group.map((entry) => entry.certificateCode);
    const activity = `Downloading ${codes.join(', ')} directly from Royal (${completedCodes + 1}-${Math.min(completedCodes + codes.length, entries.length)} of ${entries.length}).`;
    certificateDownloadLogger.setActivity(activity, codes);
    codes.forEach((code) => catalogByCode.set(code, { ...catalogByCode.get(code), status: 'downloading' }));

    const directResults = await Promise.all(codes.map(async (code) => {
      const ordinal = discoveredOrdinal.get(code) ?? (skippedCompletedCodes.length + completedCodes + 1);
      certificateDownloadLogger.setActivity(`Downloading ${ordinal} of ${discoveredEntries.length}: ${code}`, [code]);
      certificateDownloadLogger.log(`Downloading ${ordinal} of ${discoveredEntries.length}: ${code}.`, 'info', [code]);
      return { code, result: await callDirectPerCode(code) };
    }));
    for (const { code, result: deviceCodeResult } of directResults) {
      let finalResult: any | null = deviceCodeResult;
      if (!finalResult) {
        finalResult = {
          catalog: [{ certificateCode: code, status: 'network_error', parserSource: 'none', errorMessage: 'The direct Royal certificate download returned no result.' }],
          matches: [],
        };
      }

      certificateDownloadLogger.updateCertificate(code, 'parsing', `Parsing certificate ${code}`);
      certificateDownloadLogger.log(`Parsing certificate ${code}.`, 'info', [code]);
      ingestCodeResult(code, finalResult, deviceCodeResult ? 'direct-device' : 'none');
      (Array.isArray(finalResult?.documentArtifacts) ? finalResult.documentArtifacts : []).forEach((artifact: CertificatePdfArchiveInput) => {
        const artifactCode = artifact.certificateCode.toUpperCase();
        try {
          preparedArchivesByCode.set(artifactCode, prepareCertificatePdfArchive(artifact));
        } catch (error) {
          archivePreparationErrorsByCode.set(artifactCode, error instanceof Error ? error.message : String(error));
        }
      });
      const diagnostic = diagnosticsByCode.get(code)!;
      const storedCatalog = Array.isArray(finalResult?.catalog)
        ? finalResult.catalog.find((entry: any) => String(entry?.certificateCode ?? '').toUpperCase() === code.toUpperCase())
        : null;
      certificateDownloadLogger.log(
        `${code} parser diagnostic: status=${diagnostic.status}; source=${diagnostic.parserSource}; downloadedBytes=${diagnostic.downloadedBytes ?? 'unknown'}; extractedTextCharacters=${diagnostic.extractedTextLength}; acceptedSailingReferences=${diagnostic.parsedSailingReferences}; sailingGroups=${diagnostic.sailingGroups}.`,
        'info',
        [code],
      );
      diagnostic.evidence.forEach((line) => certificateDownloadLogger.log(`${code} evidence: ${line}`, 'info', [code]));
      if (diagnostic.errorMessage) certificateDownloadLogger.log(`${code} parser detail: ${diagnostic.errorMessage}`, 'warning', [code]);
      if (diagnostic.status === 'parsed') {
        certificateDownloadLogger.updateCertificate(code, 'saving', `Parsed ${diagnostic.parsedSailingReferences} sailing references; queued for one local batch save`);
        certificateDownloadLogger.log(`Parsed certificate ${code}; its PDF and sailing rows are queued for the final local batch save.`, 'info', [code]);
      }
      certificateDownloadLogger.log(
        diagnostic.status === 'parsed'
          ? `Parsed ${code} directly: ${diagnostic.parsedSailingReferences} material sailing reference${diagnostic.parsedSailingReferences === 1 ? '' : 's'} in ${diagnostic.sailingGroups} group${diagnostic.sailingGroups === 1 ? '' : 's'}.`
          : `${code}: ${diagnostic.message}`,
        diagnostic.status === 'parsed' ? 'success' : diagnostic.status === 'parse_failed' ? 'error' : 'warning',
        [code],
      );
      if (diagnostic.status !== 'parsed') {
        const failure = storedCatalog?.documentStorageStatus === 'storage_failed'
          ? 'PDF parsed, but local storage did not complete'
          : diagnostic.message;
        certificateDownloadLogger.updateCertificate(code, 'failed', failure, diagnostic.parsedSailingReferences);
      }
      completedCodes += 1;
      input.onProgress?.(skippedCompletedCodes.length + completedCodes, discoveredEntries.length);
      input.onEntry?.(catalogByCode.get(code), skippedCompletedCodes.length + completedCodes, discoveredEntries.length);
    }

    // Commit every bounded download group immediately. A later network/parser
    // failure therefore cannot discard documents that already parsed, and the
    // UI/index can publish each completed certificate without waiting for the
    // entire monthly catalog.
    const groupParsedCodes = codes.filter((code) => diagnosticsByCode.get(code)?.status === 'parsed' && preparedArchivesByCode.has(code));
    if (groupParsedCodes.length > 0) {
      const prepared = groupParsedCodes.map((code) => preparedArchivesByCode.get(code)!).filter(Boolean);
      try {
        const evidenceByCode = await archivePreparedCertificateDocumentsBatch(prepared, input.documentStorageKey);
        groupParsedCodes.forEach((code) => {
          const evidence = evidenceByCode.get(code);
          const diagnostic = diagnosticsByCode.get(code)!;
          const current = catalogByCode.get(code);
          const next = {
            ...current,
            documentSha256: evidence?.sha256 ?? current?.documentSha256 ?? null,
            documentArchiveUri: evidence?.archiveUri ?? current?.documentArchiveUri ?? null,
            documentStorageStatus: evidence?.storageStatus ?? 'storage_failed',
          };
          catalogByCode.set(code, next);
          if (evidence?.storageStatus === 'stored') certificateDownloadLogger.updateCertificate(code, 'saved', 'Saved locally', diagnostic.parsedSailingReferences);
          else certificateDownloadLogger.updateCertificate(code, 'failed', evidence?.errorMessage ?? 'The bounded local save did not complete.', diagnostic.parsedSailingReferences);
          preparedArchivesByCode.delete(code);
          input.onEntry?.(next, skippedCompletedCodes.length + completedCodes, discoveredEntries.length);
        });
      } catch (error) {
        certificateDownloadLogger.log(`Bounded certificate save failed; records remain queued for the final retry: ${error instanceof Error ? error.message : String(error)}`, 'warning', groupParsedCodes);
      }
    }
  }

  const parsedCodesPendingSave = Array.from(diagnosticsByCode.entries())
    .filter(([code, diagnostic]) => diagnostic.status === 'parsed' && preparedArchivesByCode.has(code))
    .map(([code]) => code);
  if (parsedCodesPendingSave.length > 0) {
    certificateDownloadLogger.setActivity(
      `Saving ${preparedArchivesByCode.size} downloaded certificate PDF${preparedArchivesByCode.size === 1 ? '' : 's'} and all parsed sailing rows in one local transaction.`,
      parsedCodesPendingSave,
    );
    try {
      const evidenceByCode = preparedArchivesByCode.size > 0
        ? await archivePreparedCertificateDocumentsBatch(Array.from(preparedArchivesByCode.values()), input.documentStorageKey)
        : new Map();
      parsedCodesPendingSave.forEach((code) => {
        const evidence = evidenceByCode.get(code);
        const preparationError = archivePreparationErrorsByCode.get(code);
        const diagnostic = diagnosticsByCode.get(code)!;
        const current = catalogByCode.get(code);
        catalogByCode.set(code, {
          ...current,
          documentSha256: evidence?.sha256 ?? current?.documentSha256 ?? null,
          documentArchiveUri: evidence?.archiveUri ?? current?.documentArchiveUri ?? null,
          documentStorageStatus: evidence?.storageStatus ?? 'storage_failed',
          errorMessage: preparationError ?? current?.errorMessage,
        });
        if (evidence?.storageStatus === 'stored') {
          certificateDownloadLogger.updateCertificate(code, 'saved', 'Saved locally', diagnostic.parsedSailingReferences);
          certificateDownloadLogger.log(`Saved ${code} with ${diagnostic.parsedSailingReferences} sailing references.`, 'success', [code]);
        } else {
          certificateDownloadLogger.updateCertificate(code, 'failed', preparationError ?? evidence?.errorMessage ?? 'The local certificate batch save did not complete.', diagnostic.parsedSailingReferences);
        }
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      parsedCodesPendingSave.forEach((code) => {
        const diagnostic = diagnosticsByCode.get(code)!;
        certificateDownloadLogger.updateCertificate(code, 'failed', `Local batch save failed: ${detail}`, diagnostic.parsedSailingReferences);
        catalogByCode.set(code, { ...catalogByCode.get(code), documentStorageStatus: 'storage_failed' });
      });
      certificateDownloadLogger.log(`Local certificate batch save failed: ${detail}`, 'error', parsedCodesPendingSave);
    }
  }

  const dedupedMatches = dedupeMatches(allMatches);
  for (const entry of entries) {
    const current = catalogByCode.get(entry.certificateCode);
    const diagnostic = normalizeCertificateParseDiagnostics({ ...current, sailingGroups: countCertificateSailingGroups(dedupedMatches, entry.certificateCode), parsedSailingReferences: countCertificateSailingReferences(dedupedMatches, entry.certificateCode) }, dedupedMatches, current?.parserSource ?? 'none');
    diagnosticsByCode.set(entry.certificateCode, diagnostic);
    catalogByCode.set(entry.certificateCode, { ...current, ...diagnostic, sailingsFound: diagnostic.parsedSailingReferences });
  }

  const diagnostics = Array.from(diagnosticsByCode.entries());
  const parsedCodes = diagnostics.filter(([, d]) => d.status === 'parsed').map(([code]) => code);
  const parseFailedCodes = diagnostics.filter(([, d]) => d.status === 'parse_failed').map(([code]) => code);
  const networkErrorCodes = diagnostics.filter(([, d]) => d.status === 'network_error').map(([code]) => code);
  const unsupportedPdfCodes = diagnostics.filter(([, d]) => d.status === 'unsupported_pdf').map(([code]) => code);
  const storageFailedCodes = parsedCodes.filter((code) => catalogByCode.get(code)?.documentStorageStatus !== 'stored');
  const failedCodes = Array.from(new Set([...parseFailedCodes, ...networkErrorCodes, ...unsupportedPdfCodes, ...storageFailedCodes]));
  const parsedSailingReferenceCount = diagnostics.reduce((sum, [, d]) => sum + d.parsedSailingReferences, 0);
  certificateDownloadLogger.finish(failedCodes.length
    ? `Certificate download finished: ${discoveredEntries.length - failedCodes.length}/${discoveredEntries.length} saved; ${failedCodes.length} code${failedCodes.length === 1 ? '' : 's'} still need retry.`
    : `Certificate download complete: ${discoveredEntries.length}/${discoveredEntries.length} saved; ${parsedCodes.length} newly parsed with ${parsedSailingReferenceCount} material sailing references.`, failedCodes.length ? 'warning' : 'success');

  return {
    catalog: Array.from(catalogByCode.values()), matches: dedupedMatches, diagnostics: Object.fromEntries(diagnostics),
    summary: {
      attemptedCodes: entries.length, completedCodes: entries.length, parsedCodes: parsedCodes.length,
      discoveredCodes: discoveredEntries.length, skippedCompletedCodes,
      parseFailedCodes, networkErrorCodes, unsupportedPdfCodes, failedCodes,
      matchedCertificateCount: parsedCodes.length, matchedSailingCount: dedupedMatches.length,
      parsedSailingReferenceCount, parsedSailingGroupCount: dedupedMatches.length,
      discoveryEvidence: discovery.evidence, parserDiscrepancies: Array.from(parserDiscrepancies),
    },
  };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes(CERTIFICATE_BATCH_CANCELLED)) {
      const snapshot = certificateDownloadLogger.getSnapshot();
      certificateDownloadLogger.finish(
        `Certificate download stopped safely after ${snapshot.completed}/${snapshot.total} certificate${snapshot.total === 1 ? '' : 's'}. Completed PDFs and sailing rows remain saved; use Download Missing / Retry Failed to continue.`,
        'warning',
      );
    } else {
      certificateDownloadLogger.finish(`Certificate download stopped: ${detail}`, 'error');
    }
    throw error;
  } finally {
    activeCertificateBatchKeys.delete(operationKey);
  }
}
