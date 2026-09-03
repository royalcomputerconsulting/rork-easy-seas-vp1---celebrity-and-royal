import { quotaSafeGetItem, quotaSafeGetJsonItemWithRaw, quotaSafeSetJsonItem } from '../storage/quotaSafeStorage';
import {
  dedupeCertificateSailings,
  getCertificateFamilyDefinition,
  parseCertificatePdfOnDevice,
  type CertificateParserReconciliation,
  type ParsedCertificateSailing,
  sha256DocumentHash,
  type CertificateParseResult,
  type CertificatePdfProvenance,
  type DownloadedCertificatePdf,
} from './certificatePdfPipeline';

async function coordinatedSetJsonItem(key: string, value: unknown): Promise<void> {
  await quotaSafeSetJsonItem(key, value);
}

// PDF downloads are intentionally concurrent, but the retained document list
// is a read-modify-write value. Serialize that transaction per user-scoped key
// so two completed downloads cannot overwrite one another's records.
const certificateStoreQueues = new Map<string, Promise<unknown>>();

async function withCertificateStoreTransaction<T>(storageKey: string, operation: () => Promise<T>): Promise<T> {
  const previous = certificateStoreQueues.get(storageKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const queued = current.catch(() => undefined);
  certificateStoreQueues.set(storageKey, queued);
  try {
    return await current;
  } finally {
    if (certificateStoreQueues.get(storageKey) === queued) {
      certificateStoreQueues.delete(storageKey);
    }
  }
}

export const CERTIFICATE_DOCUMENT_STORE_KEY = '@easyseas_certificate_documents_v2';
/** Royal's monthly A/C PDF catalog is public reference inventory shared by every local profile. */
export const PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY = '@easyseas_public_certificate_documents_v1';

function calendarMonthCode(date: Date): string {
  return `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function nextCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function getCertificateDocumentMonthCode(record: CertificateDocumentRecord): string | null {
  const candidates: unknown[] = [
    record.discoveryEvidence?.monthCode,
    record.originalUrl,
    ...record.parseHistory.flatMap((entry) => entry.result.sailings.map((row) => row.certificateCode)),
  ];
  for (const candidate of candidates) {
    const match = String(candidate ?? '').toUpperCase().match(/(?:^|[^0-9])(\d{4})(?=[AC]|[^0-9]|$)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Keeps the public monthly catalog durable for the current and following
 * calendar month. Older recognized monthly PDFs are removed only after a
 * successfully stored current/next-month replacement exists. Unknown/manual
 * documents are never pruned by this rolling-catalog rule.
 */
export function retainRollingPublicCertificateCatalog(
  records: CertificateDocumentRecord[],
  now = new Date(),
): CertificateDocumentRecord[] {
  const activeCodes = new Set([calendarMonthCode(now), calendarMonthCode(nextCalendarMonth(now))]);
  const hasReplacement = records.some((record) => {
    const monthCode = getCertificateDocumentMonthCode(record);
    return monthCode !== null && activeCodes.has(monthCode);
  });
  if (!hasReplacement) return records;
  return records.filter((record) => {
    const monthCode = getCertificateDocumentMonthCode(record);
    return monthCode === null || activeCodes.has(monthCode);
  });
}

export interface CertificateDocumentStorageMetadata {
  documentKind?: 'certificate' | 'monthly_index';
  discoveryEvidence?: {
    monthCode: string;
    familyCode: string;
    discoveredCodes: string[];
    discoveredAt: string;
  };
}

export interface CertificateDocumentRecord {
  id: string;
  schemaVersion: 2 | 3 | 4 | 5;
  documentKind: 'certificate' | 'monthly_index';
  discoveryEvidence?: CertificateDocumentStorageMetadata['discoveryEvidence'];
  documentHash: string;
  documentVersion: string;
  originalUrl: string;
  provenance: CertificatePdfProvenance;
  bytesBase64: string;
  storedAt: string;
  parseHistory: Array<{
    parsedAt: string;
    parserSource: 'device';
    parserVersion: string;
    result: CertificateParseResult;
  }>;
  parserReconciliations: Array<{
    reconciledAt: string;
    backendResult: CertificateParseResult;
    status: CertificateParserReconciliation['status'];
    backendOnlyCount: number;
    deviceOnlyCount: number;
    warnings: string[];
  }>;
}

export interface CertificateDocumentLoadReport {
  documents: CertificateDocumentRecord[];
  invalidRecordCount: number;
  malformedStorage: boolean;
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += alphabet[first >>> 2];
    output += alphabet[((first & 0x03) << 4) | ((second ?? 0) >>> 4)];
    output += second === undefined ? '=' : alphabet[((second & 0x0f) << 2) | ((third ?? 0) >>> 6)];
    output += third === undefined ? '=' : alphabet[third & 0x3f];
  }
  return output;
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = value.replace(/\s/g, '');
  const output: number[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    const first = alphabet.indexOf(normalized[index]);
    const second = alphabet.indexOf(normalized[index + 1]);
    const thirdCharacter = normalized[index + 2] ?? '=';
    const fourthCharacter = normalized[index + 3] ?? '=';
    const third = thirdCharacter === '=' ? 0 : alphabet.indexOf(thirdCharacter);
    const fourth = fourthCharacter === '=' ? 0 : alphabet.indexOf(fourthCharacter);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) throw new Error('Stored certificate document is not valid base64.');
    output.push((first << 2) | (second >>> 4));
    if (thirdCharacter !== '=') output.push(((second & 0x0f) << 4) | (third >>> 2));
    if (fourthCharacter !== '=') output.push(((third & 0x03) << 6) | fourth);
  }
  return new Uint8Array(output);
}

function currentParse(result: CertificateDocumentRecord): CertificateParseResult | undefined {
  return result.parseHistory[result.parseHistory.length - 1]?.result;
}

function getDocumentSourceIdentity(originalUrl: string): string {
  const pathPart = String(originalUrl ?? '').split(/[?#]/)[0].split('/').pop() || 'certificate';
  return pathPart.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80) || 'certificate';
}

export function createCertificateDocumentRecord(
  download: DownloadedCertificatePdf,
  result: CertificateParseResult,
  metadata?: CertificateDocumentStorageMetadata,
): CertificateDocumentRecord {
  if (!download.bytes || !download.provenance.documentHash || !download.provenance.documentVersion) {
    throw new Error('A downloaded certificate PDF with a document hash and version is required for durable storage.');
  }
  const parsedAt = result.sailings[0]?.parsedAt ?? new Date().toISOString();
  return {
    // The byte hash proves integrity, but it is not a sufficient record ID:
    // Royal can publish the same bytes at multiple certificate URLs. Keeping
    // the source identity prevents one certificate code from replacing another.
    id: `${download.provenance.documentHash}-${getDocumentSourceIdentity(download.provenance.originalUrl)}`,
    schemaVersion: 5,
    documentKind: metadata?.documentKind ?? 'certificate',
    discoveryEvidence: metadata?.discoveryEvidence,
    documentHash: download.provenance.documentHash,
    documentVersion: download.provenance.documentVersion,
    originalUrl: download.provenance.originalUrl,
    provenance: download.provenance,
    // Native downloads are already retained in the app document directory by
    // certificateBinaryTransport. Duplicating every PDF as base64 inside one
    // coordinated metadata JSON value made Download All spend minutes stringifying and
    // could stall the certificate screen. Web/fallback transports without a
    // durable file URI continue to retain the bytes inline.
    bytesBase64: download.provenance.documentArchiveUri ? '' : encodeBase64(download.bytes),
    storedAt: new Date().toISOString(),
    parseHistory: [{ parsedAt, parserSource: 'device', parserVersion: result.parserVersion, result }],
    parserReconciliations: [],
  };
}

export function restoreCertificateDocumentBytes(record: CertificateDocumentRecord): Uint8Array {
  if (!record.bytesBase64) {
    throw new Error('This certificate PDF is retained as a local file and must be opened from its archive URI.');
  }
  const bytes = decodeBase64(record.bytesBase64);
  if (sha256DocumentHash(bytes) !== record.documentHash) {
    throw new Error('Stored certificate document hash does not match its retained bytes.');
  }
  return bytes;
}

async function restoreCertificateDocumentBytesForReprocess(record: CertificateDocumentRecord): Promise<Uint8Array> {
  if (record.bytesBase64) return restoreCertificateDocumentBytes(record);
  const archiveUri = record.provenance?.documentArchiveUri;
  if (!archiveUri) throw new Error('The retained certificate PDF has no local archive URI.');
  const fileSystem = require('expo-file-system/legacy') as {
    EncodingType?: { Base64?: string };
    readAsStringAsync?: (uri: string, options?: { encoding?: string }) => Promise<string>;
  };
  if (typeof fileSystem.readAsStringAsync !== 'function') {
    throw new Error('The retained certificate PDF cannot be reopened in this runtime.');
  }
  const base64 = await fileSystem.readAsStringAsync(archiveUri, {
    encoding: fileSystem.EncodingType?.Base64 ?? 'base64',
  });
  const bytes = decodeBase64(base64);
  if (sha256DocumentHash(bytes) !== record.documentHash) {
    throw new Error('Retained certificate PDF hash does not match its saved document record.');
  }
  return bytes;
}

export function isValidCertificateDocumentRecord(value: unknown): value is CertificateDocumentRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CertificateDocumentRecord>;
  if (!record.id || !record.documentHash || !record.documentVersion || !Array.isArray(record.parseHistory)) return false;
  if (!record.bytesBase64) return Boolean(record.provenance?.documentArchiveUri);
  try {
    return sha256DocumentHash(decodeBase64(record.bytesBase64)) === record.documentHash;
  } catch {
    return false;
  }
}

function isLoadableCertificateDocumentRecord(value: unknown): value is CertificateDocumentRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CertificateDocumentRecord>;
  return Boolean(
    record.id
    && record.documentHash
    && record.documentVersion
    && typeof record.bytesBase64 === 'string'
    && (record.bytesBase64.length > 0 || Boolean(record.provenance?.documentArchiveUri))
    && Array.isArray(record.parseHistory)
    && record.parseHistory.every((entry) => Boolean(entry && entry.result && Array.isArray(entry.result.sailings))),
  );
}

export function reprocessCertificateDocumentRecord(record: CertificateDocumentRecord, expectedCode?: string): CertificateDocumentRecord {
  const bytes = restoreCertificateDocumentBytes(record);
  const download: DownloadedCertificatePdf = { status: 'downloaded', bytes, provenance: record.provenance };
  const result = parseCertificatePdfOnDevice(download, expectedCode);
  return {
    ...record,
    schemaVersion: 5,
    documentKind: record.documentKind ?? 'certificate',
    provenance: { ...record.provenance, ...result.provenance },
    parseHistory: [...record.parseHistory, {
      parsedAt: result.sailings[0]?.parsedAt ?? new Date().toISOString(),
      parserSource: 'device' as const,
      parserVersion: result.parserVersion,
      result,
    }].slice(-2),
  };
}

export function inspectCertificateDocumentStorage(raw: string | null): CertificateDocumentLoadReport {
  if (!raw) return { documents: [], invalidRecordCount: 0, malformedStorage: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { documents: [], invalidRecordCount: 0, malformedStorage: true };
  }
  if (!Array.isArray(parsed)) return { documents: [], invalidRecordCount: 0, malformedStorage: true };
  return inspectParsedCertificateDocuments(parsed);
}

function inspectParsedCertificateDocuments(parsed: unknown[]): CertificateDocumentLoadReport {
  // Startup needs the parsed sailing index, not a byte-by-byte revalidation of
  // every retained PDF. Decoding all base64 PDFs and hashing them on each launch
  // blocked navigation as the certificate library grew. Full SHA-256 validation
  // still occurs in restoreCertificateDocumentBytes immediately before a PDF is
  // opened or reprocessed.
  const validRecords = parsed.filter(isLoadableCertificateDocumentRecord);
  return {
    documents: validRecords
    .map((record) => ({
      ...record,
      documentKind: record.documentKind ?? 'certificate',
      parserReconciliations: record.parserReconciliations ?? [],
    })),
    invalidRecordCount: parsed.length - validRecords.length,
    malformedStorage: false,
  };
}

export async function loadCertificateDocumentsWithReport(storageKey: string): Promise<CertificateDocumentLoadReport> {
  // Parse through the shared cooperative JSON lane. The previous path first
  // parsed the complete library to validate it, then parsed the same string a
  // second time here; that was visible when a background download completed.
  if (typeof quotaSafeGetJsonItemWithRaw === 'function') {
    const stored = await quotaSafeGetJsonItemWithRaw<unknown[]>(storageKey, [], Array.isArray);
    if (stored.raw === null) return { documents: [], invalidRecordCount: 0, malformedStorage: false };
    return inspectParsedCertificateDocuments(stored.value);
  }

  // Compatibility for recovery harnesses and older embedded runtimes that
  // expose only the original raw reader. Production always takes the
  // cooperative one-parse path above.
  const raw = typeof quotaSafeGetItem === 'function' ? await quotaSafeGetItem(storageKey) : null;
  return inspectCertificateDocumentStorage(raw);
}

export async function listCertificateDocuments(storageKey: string): Promise<CertificateDocumentRecord[]> {
  return (await loadCertificateDocumentsWithReport(storageKey)).documents;
}

export async function storeCertificateDocument(
  storageKey: string,
  download: DownloadedCertificatePdf,
  result: CertificateParseResult,
  reconciliation?: { backendResult: CertificateParseResult; comparison: CertificateParserReconciliation },
  metadata?: CertificateDocumentStorageMetadata,
): Promise<CertificateDocumentRecord> {
  return withCertificateStoreTransaction(storageKey, async () => {
    const nextRecord = createCertificateDocumentRecord(download, result, metadata);
    const current = (await listCertificateDocuments(storageKey)).map((record) => ({
      ...record,
      parseHistory: record.parseHistory.slice(-1),
    }));
    const existing = current.find((record) =>
      record.id === nextRecord.id
      || (record.documentHash === nextRecord.documentHash && record.originalUrl === nextRecord.originalUrl),
    );
    const reconciliationHistory = reconciliation ? [{
      reconciledAt: new Date().toISOString(),
      backendResult: reconciliation.backendResult,
      status: reconciliation.comparison.status,
      backendOnlyCount: reconciliation.comparison.backendOnly.length,
      deviceOnlyCount: reconciliation.comparison.deviceOnly.length,
      warnings: reconciliation.comparison.warnings,
    }] : [];
    const nextDocuments = existing
      ? current.map((record) => record.id === existing.id ? {
        ...record,
        schemaVersion: 5 as const,
        documentKind: metadata?.documentKind ?? record.documentKind ?? 'certificate',
        discoveryEvidence: metadata?.discoveryEvidence ?? record.discoveryEvidence,
        provenance: nextRecord.provenance,
        bytesBase64: nextRecord.bytesBase64,
        parseHistory: [...record.parseHistory, ...nextRecord.parseHistory].slice(-2),
        parserReconciliations: [...(record.parserReconciliations ?? []), ...reconciliationHistory],
      } : record)
      : [...current, nextRecord];
    if (!existing && reconciliationHistory.length > 0) {
      nextDocuments[nextDocuments.length - 1] = { ...nextRecord, parserReconciliations: reconciliationHistory };
    }
    const retainedDocuments = storageKey === PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY
      ? retainRollingPublicCertificateCatalog(nextDocuments)
      : nextDocuments;
    await coordinatedSetJsonItem(storageKey, retainedDocuments);
    return retainedDocuments.find((record) => record.id === (existing?.id ?? nextRecord.id)) ?? nextRecord;
  });
}

export async function reprocessStoredCertificateDocument(storageKey: string, documentId: string, expectedCode?: string): Promise<CertificateDocumentRecord> {
  return withCertificateStoreTransaction(storageKey, async () => {
    const current = await listCertificateDocuments(storageKey);
    const existing = current.find((record) => record.id === documentId);
    if (!existing) throw new Error('The stored certificate document is no longer available.');
    const bytes = await restoreCertificateDocumentBytesForReprocess(existing);
    const download: DownloadedCertificatePdf = { status: 'downloaded', bytes, provenance: existing.provenance };
    const result = parseCertificatePdfOnDevice(download, expectedCode);
    const nextRecord: CertificateDocumentRecord = {
      ...existing,
      schemaVersion: 5,
      documentKind: existing.documentKind ?? 'certificate',
      provenance: { ...existing.provenance, ...result.provenance },
      parseHistory: [...existing.parseHistory, {
        parsedAt: result.sailings[0]?.parsedAt ?? new Date().toISOString(),
        parserSource: 'device' as const,
        parserVersion: result.parserVersion,
        result,
      }].slice(-2),
    };
    await coordinatedSetJsonItem(storageKey, current.map((record) => record.id === documentId ? nextRecord : record));
    return nextRecord;
  });
}


export interface CertificateDocumentEvidence {
  sha256: string;
  archiveUri: string | null;
  storageStatus: 'stored' | 'storage_failed';
  documentId: string | null;
  errorMessage?: string;
}

export interface MaterialCertificateSailing {
  certificateCode: string;
  shipName: string;
  sailDate: string;
  departurePort?: string | null;
  itinerary?: string | null;
  offerTypeLabel?: string | null;
  nextCruiseBonusLabel?: string | null;
  cabinLabel?: string | null;
  guestCount?: number | null;
  points?: number | null;
}

function normalizedMaterialIdentity(row: {
  certificateCode: string;
  shipName: string;
  sailingDate?: string;
  sailDate?: string;
  cabinCategory?: string;
  cabinLabel?: string | null;
  guestCount?: number | null;
}): string {
  return [
    row.certificateCode.trim().toUpperCase(),
    row.shipName.trim().toLowerCase(),
    String(row.sailingDate ?? row.sailDate ?? '').trim(),
    String(row.cabinCategory ?? row.cabinLabel ?? '').trim().toLowerCase(),
    row.guestCount ?? '',
  ].join('__');
}

/**
 * The fast material-row parser understands Royal's current Excel-generated
 * table layout. Retain those verified rows even when the evidence-oriented
 * parser cannot reconstruct the same PDF font/stream grouping. This prevents
 * a successful catalog parse from being archived as a zero-row document.
 */
export function mergeMaterialCertificateSailings(
  parsedResult: CertificateParseResult,
  materialSailings: MaterialCertificateSailing[],
): CertificateParseResult {
  if (materialSailings.length === 0) return parsedResult;

  const materialByBaseIdentity = new Map<string, MaterialCertificateSailing[]>();
  materialSailings.forEach((row) => {
    const key = `${row.certificateCode.trim().toUpperCase()}__${row.shipName.trim().toLowerCase()}__${row.sailDate}`;
    const group = materialByBaseIdentity.get(key) ?? [];
    group.push(row);
    materialByBaseIdentity.set(key, group);
  });

  const enrichedRows = parsedResult.sailings.map((row) => {
    const key = `${row.certificateCode.trim().toUpperCase()}__${row.shipName.trim().toLowerCase()}__${row.sailingDate}`;
    const candidates = materialByBaseIdentity.get(key) ?? [];
    const material = candidates.find((candidate) => (
      !row.cabinCategory || !candidate.cabinLabel || candidate.cabinLabel.toLowerCase() === row.cabinCategory.toLowerCase()
    )) ?? candidates[0];
    if (!material) return row;
    return {
      ...row,
      departurePort: material.departurePort || row.departurePort,
      itinerary: material.itinerary || row.itinerary,
      offerTypeLabel: material.offerTypeLabel || row.offerTypeLabel,
      nextCruiseBonusLabel: material.nextCruiseBonusLabel || row.nextCruiseBonusLabel,
      cabinCategory: row.cabinCategory || material.cabinLabel || undefined,
      occupancy: row.occupancy || (material.guestCount ? `${material.guestCount} guest${material.guestCount === 1 ? '' : 's'}` : undefined),
      guestCount: row.guestCount ?? material.guestCount ?? undefined,
      pointRequirement: row.pointRequirement ?? material.points ?? undefined,
    };
  });

  const retainedIdentities = new Set(enrichedRows.map(normalizedMaterialIdentity));
  const recoveredRows: ParsedCertificateSailing[] = [];
  materialSailings.forEach((material, index) => {
    const identity = normalizedMaterialIdentity(material);
    if (retainedIdentities.has(identity)) return;
    const family = getCertificateFamilyDefinition(material.certificateCode);
    const sourceGroup = `shared-material-row-${index + 1}`;
    recoveredRows.push({
      certificateCode: material.certificateCode.trim().toUpperCase(),
      certificateFamily: family.family,
      certificateFamilyCode: family.familyCode,
      sourcePage: 1,
      sourceGroup,
      sourceReferences: [{ page: 1, group: sourceGroup, pageAttribution: 'inferred' }],
      pageAttribution: 'inferred',
      shipName: material.shipName,
      sailingDate: material.sailDate,
      departurePort: material.departurePort || undefined,
      itinerary: material.itinerary || undefined,
      offerTypeLabel: material.offerTypeLabel || undefined,
      nextCruiseBonusLabel: material.nextCruiseBonusLabel || undefined,
      cabinCategory: material.cabinLabel || undefined,
      occupancy: material.guestCount ? `${material.guestCount} guest${material.guestCount === 1 ? '' : 's'}` : undefined,
      guestCount: material.guestCount ?? undefined,
      pointRequirement: material.points ?? undefined,
      benefits: [],
      parserSource: 'device',
      parserVersion: `${parsedResult.parserVersion}+shared-material-row`,
      documentHash: parsedResult.provenance.documentHash,
      documentVersion: parsedResult.provenance.documentVersion,
      parsedAt: new Date().toISOString(),
      validationStatus: 'accepted',
    });
    retainedIdentities.add(identity);
  });

  const sailings = dedupeCertificateSailings([...enrichedRows, ...recoveredRows]);
  if (recoveredRows.length === 0) return { ...parsedResult, sailings };
  const recoveryWarning = `Retained ${recoveredRows.length} sailing row${recoveredRows.length === 1 ? '' : 's'} recovered by the shared material-row parser.`;
  const warnings = Array.from(new Set([...parsedResult.warnings, recoveryWarning]));
  return {
    ...parsedResult,
    status: 'parsed_with_warnings',
    sailings,
    warnings,
    provenance: {
      ...parsedResult.provenance,
      parseStatus: 'parsed_with_warnings',
      warnings,
    },
  };
}

export interface CertificatePdfArchiveInput {
  certificateCode: string;
  sourceUrl: string;
  bytes: Uint8Array;
  parserSource?: string;
  provenance?: Partial<CertificatePdfProvenance>;
  storageKey?: string;
  metadata?: CertificateDocumentStorageMetadata;
  materialSailings?: MaterialCertificateSailing[];
  parsedResult?: CertificateParseResult;
}

function prepareCertificateArchive(input: CertificatePdfArchiveInput): {
  documentHash: string;
  provenance: CertificatePdfProvenance;
  download: DownloadedCertificatePdf;
  result: CertificateParseResult;
} {
  const documentHash = input.provenance?.documentHash ?? sha256DocumentHash(input.bytes);
  const provenance: CertificatePdfProvenance = {
    originalUrl: input.sourceUrl,
    resolvedUrl: input.provenance?.resolvedUrl ?? input.sourceUrl,
    retrievedAt: input.provenance?.retrievedAt ?? new Date().toISOString(),
    contentType: input.provenance?.contentType ?? 'application/pdf',
    documentSize: input.bytes.byteLength,
    documentHash,
    documentVersion: input.provenance?.documentVersion ?? documentHash,
    documentArchiveUri: input.provenance?.documentArchiveUri ?? null,
    binaryTransport: input.provenance?.binaryTransport,
    parserSource: 'device',
  };
  const download: DownloadedCertificatePdf = { status: 'downloaded', bytes: input.bytes, provenance };
  // The direct certificate engine has already parsed the extracted PDF text.
  // Reuse that verified result when supplied instead of decompressing and
  // parsing the same PDF bytes a second time during storage handoff.
  const parsedResult = input.parsedResult ?? parseCertificatePdfOnDevice(download, input.certificateCode);
  const result = mergeMaterialCertificateSailings(parsedResult, input.materialSailings ?? []);
  return { documentHash, provenance, download, result };
}

export interface PreparedCertificateDocument {
  certificateCode: string;
  record: CertificateDocumentRecord;
  evidence: Omit<CertificateDocumentEvidence, 'storageStatus'>;
}

export function prepareCertificatePdfArchive(input: CertificatePdfArchiveInput): PreparedCertificateDocument {
  const { documentHash, provenance, download, result } = prepareCertificateArchive(input);
  const record = createCertificateDocumentRecord(download, result, input.metadata);
  return {
    certificateCode: input.certificateCode.toUpperCase(),
    record,
    evidence: {
      sha256: documentHash,
      archiveUri: provenance.documentArchiveUri ?? null,
      documentId: record.id,
    },
  };
}

export async function archivePreparedCertificateDocumentsBatch(
  preparedInputs: PreparedCertificateDocument[],
  storageKey = CERTIFICATE_DOCUMENT_STORE_KEY,
): Promise<Map<string, CertificateDocumentEvidence>> {
  const evidenceByCode = new Map<string, CertificateDocumentEvidence>();
  if (preparedInputs.length === 0) return evidenceByCode;

  return withCertificateStoreTransaction(storageKey, async () => {
    let documents = (await listCertificateDocuments(storageKey)).map((record) => ({
      ...record,
      parseHistory: record.parseHistory.slice(-1),
    }));
    for (const prepared of preparedInputs) {
      const nextRecord = prepared.record;
      const existing = documents.find((record) => (
        record.id === nextRecord.id
        || (record.documentHash === nextRecord.documentHash && record.originalUrl === nextRecord.originalUrl)
      ));
      if (existing) {
        documents = documents.map((record) => record.id === existing.id ? {
          ...record,
          ...nextRecord,
          parseHistory: [...record.parseHistory, ...nextRecord.parseHistory].slice(-2),
        } : record);
      } else {
        documents.push(nextRecord);
      }
      evidenceByCode.set(prepared.certificateCode, {
        ...prepared.evidence,
        documentId: existing?.id ?? nextRecord.id,
        storageStatus: 'stored',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await coordinatedSetJsonItem(storageKey, documents);
    return evidenceByCode;
  });
}

export async function archiveCertificatePdfBytes(input: CertificatePdfArchiveInput): Promise<CertificateDocumentEvidence> {
  const { documentHash, provenance, download, result } = prepareCertificateArchive(input);
  try {
    const record = await storeCertificateDocument(
      input.storageKey ?? CERTIFICATE_DOCUMENT_STORE_KEY,
      download,
      result,
      undefined,
      input.metadata,
    );
    return {
      sha256: documentHash,
      archiveUri: provenance.documentArchiveUri ?? null,
      storageStatus: 'stored',
      documentId: record.id,
    };
  } catch (error) {
    return {
      sha256: documentHash,
      archiveUri: provenance.documentArchiveUri ?? null,
      storageStatus: 'storage_failed',
      documentId: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Persists a completed certificate batch with one read/modify/write transaction.
 * Download All previously rewrote the entire growing PDF/sailing library once
 * per certificate, which became quadratic and could leave the UI at Saving.
 */
export async function archiveCertificatePdfBytesBatch(
  inputs: CertificatePdfArchiveInput[],
  storageKey = CERTIFICATE_DOCUMENT_STORE_KEY,
): Promise<Map<string, CertificateDocumentEvidence>> {
  const evidenceByCode = new Map<string, CertificateDocumentEvidence>();
  if (inputs.length === 0) return evidenceByCode;

  const prepared: PreparedCertificateDocument[] = [];
  for (const input of inputs) {
    try {
      prepared.push(prepareCertificatePdfArchive(input));
    } catch (error) {
      evidenceByCode.set(input.certificateCode.toUpperCase(), {
        sha256: input.provenance?.documentHash ?? sha256DocumentHash(input.bytes),
        archiveUri: input.provenance?.documentArchiveUri ?? null,
        storageStatus: 'storage_failed',
        documentId: null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const storedEvidence = await archivePreparedCertificateDocumentsBatch(prepared, storageKey);
  storedEvidence.forEach((evidence, code) => evidenceByCode.set(code, evidence));
  return evidenceByCode;
}

export function getLatestCertificateParse(record: CertificateDocumentRecord): CertificateParseResult | undefined {
  return currentParse(record);
}
