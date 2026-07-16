import type { BookedCruiseRow, OfferRow } from '@/lib/royalCaribbean/types';
import {
  carnivalBookingCanonicalKey,
  carnivalStableHash,
  ensureCarnivalBookingIdentity,
  isCarnivalBookingCompleted,
  isCarnivalSyntheticBookingId,
  normalizeCarnivalBookingClassification,
  stableStringify,
} from './carnivalDataRuntime';
export { carnivalStableHash, stableStringify, isCarnivalBookingCompleted, normalizeCarnivalBookingClassification } from './carnivalDataRuntime';
import type { CarnivalCatalogDiscovery, CarnivalRateCodeEntry } from './carnivalSafeSync';
import { isCarnivalBookingLinkForCode, parseCarnivalPersonalizedUrl, parseCarnivalTgo } from './carnivalSafeSync';

export const CARNIVAL_SYNC_CHECKPOINT_VERSION = 2;
export const CARNIVAL_SYNC_CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000;

export type CarnivalCheckpointCodeStatus =
  | 'success'
  | 'authoritative_empty'
  | 'incomplete'
  | 'blocked'
  | 'auth_lost'
  | 'cancelled'
  | 'failed';

export interface CarnivalCheckpointIdentity {
  appProfileId: string;
  authenticatedEmailHash: string;
  vifpNumber: string;
  personalizationHash: string;
  catalogHash: string;
  resident: string;
  locality: string;
  currency: string;
  fingerprint: string;
}

export interface CarnivalCheckpointOfferContext {
  code: string;
  shopNowUrl: string;
  tgoHash: string;
  contextFingerprint: string;
  offerName: string;
  expiry: string;
  extractedAt: string;
}

export interface CarnivalCheckpointCodeRecord {
  status: CarnivalCheckpointCodeStatus;
  rows: OfferRow[];
  context: CarnivalCheckpointOfferContext;
  totalResults: number;
  pagesVisited: number;
  nextPageNumber?: number;
  nextUrl?: string;
  terminalProof?: string;
  error?: string;
  updatedAt: string;
}

export interface CarnivalSyncCheckpoint {
  version: number;
  identity: CarnivalCheckpointIdentity;
  catalogCodes: string[];
  catalogHash: string;
  codeStates: Record<string, CarnivalCheckpointCodeRecord>;
  createdAt: string;
  updatedAt: string;
}

export interface BuildCarnivalCheckpointIdentityInput {
  catalog: CarnivalCatalogDiscovery;
  appProfileId?: string | null;
  authenticatedEmail?: string | null;
}

const normalizeCode = (value: unknown): string => String(value ?? '').trim().toUpperCase();
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Small deterministic, non-cryptographic hash used only for equality/fingerprint
 * checks. It deliberately avoids storing the authenticated EasySeas email or raw
 * TGO string in checkpoint identity metadata.
 */
function normalizedCatalogCodes(catalog: CarnivalCatalogDiscovery): string[] {
  const codes: string[] = (catalog.rateCodes ?? []).map((entry) => normalizeCode(entry.code)).filter((code): code is string => Boolean(code));
  return Array.from(new Set<string>(codes)).sort();
}

function extractTgoFromUrl(value: string): string {
  if (!value) return '';
  try {
    return new URL(value).searchParams.get('tgo') || '';
  } catch {
    return '';
  }
}

function normalizeContextUrl(value: string, code?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    ['pageNumber', 'pagenumber', 'page', 'offset', 'cursor', 'pagesize', 'pageSize'].forEach((key) => url.searchParams.delete(key));
    if (code) url.searchParams.set('ratecodes', normalizeCode(code));
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function buildCarnivalCheckpointIdentity(input: BuildCarnivalCheckpointIdentityInput): CarnivalCheckpointIdentity {
  const catalog = input.catalog;
  const codes = normalizedCatalogCodes(catalog);
  const catalogHash = carnivalStableHash(codes);
  const tgo = catalog.tgo || extractTgoFromUrl(catalog.personalizedSearchUrl || catalog.sourceUrl || '');
  const personalizationHash = carnivalStableHash({
    vifp: normalizeText(catalog.vifp),
    tgo,
    resident: normalizeText(catalog.resident),
    locality: normalizeText(catalog.locality || '1'),
    currency: normalizeText(catalog.currency || 'USD').toUpperCase(),
    tierCode: normalizeText(catalog.tierCode),
    personalizedSearchUrl: normalizeContextUrl(catalog.personalizedSearchUrl || ''),
  });
  const base = {
    appProfileId: normalizeText(input.appProfileId),
    authenticatedEmailHash: carnivalStableHash(normalizeText(input.authenticatedEmail).toLowerCase()),
    vifpNumber: normalizeText(catalog.vifp),
    personalizationHash,
    catalogHash,
    resident: normalizeText(catalog.resident),
    locality: normalizeText(catalog.locality || '1'),
    currency: normalizeText(catalog.currency || 'USD').toUpperCase(),
  };
  return {
    ...base,
    fingerprint: carnivalStableHash(base),
  };
}

export function buildCarnivalCheckpointOfferContext(
  catalog: CarnivalCatalogDiscovery,
  entry: CarnivalRateCodeEntry,
  extractedAt = new Date().toISOString(),
): CarnivalCheckpointOfferContext {
  const code = normalizeCode(entry.code);
  const shopNowUrl = normalizeContextUrl(entry.bookingLink || catalog.personalizedSearchUrl || catalog.sourceUrl || '', code);
  const tgo = extractTgoFromUrl(entry.bookingLink || '') || catalog.tgo || extractTgoFromUrl(catalog.personalizedSearchUrl || '');
  const contextBasis = {
    code,
    shopNowUrl,
    tgo,
    vifp: normalizeText(catalog.vifp),
    tierCode: normalizeText(catalog.tierCode),
    resident: normalizeText(catalog.resident),
    locality: normalizeText(catalog.locality || '1'),
    currency: normalizeText(catalog.currency || 'USD').toUpperCase(),
    expiry: normalizeText(entry.endDate),
  };
  return {
    code,
    shopNowUrl,
    tgoHash: carnivalStableHash(tgo),
    contextFingerprint: carnivalStableHash(contextBasis),
    offerName: normalizeText(entry.offerName) || `Rate Code ${code}`,
    expiry: normalizeText(entry.endDate),
    extractedAt,
  };
}

export function isCarnivalCheckpointIdentityUsable(identity: CarnivalCheckpointIdentity): boolean {
  // A VIFP number is the only durable Carnival-account identifier exposed by
  // the current authenticated pages. Without it, a saved checkpoint may be
  // retained for diagnostics but must never be auto-resumed.
  return /^[0-9]{6,15}$/.test(identity.vifpNumber);
}

export function isCarnivalCheckpointAccountCompatible(
  checkpoint: CarnivalSyncCheckpoint,
  currentIdentity: CarnivalCheckpointIdentity,
  now = Date.now(),
): boolean {
  if (!isCarnivalCheckpointFresh(checkpoint, now)) return false;
  if (!isCarnivalCheckpointIdentityUsable(currentIdentity)) return false;
  if (!isCarnivalCheckpointIdentityUsable(checkpoint.identity)) return false;
  return checkpoint.identity.vifpNumber === currentIdentity.vifpNumber
    && checkpoint.identity.appProfileId === currentIdentity.appProfileId
    && checkpoint.identity.authenticatedEmailHash === currentIdentity.authenticatedEmailHash
    && checkpoint.identity.resident === currentIdentity.resident
    && checkpoint.identity.locality === currentIdentity.locality
    && checkpoint.identity.currency === currentIdentity.currency;
}

export function isCarnivalCheckpointCompatible(
  checkpoint: CarnivalSyncCheckpoint,
  currentIdentity: CarnivalCheckpointIdentity,
  currentContexts: Record<string, CarnivalCheckpointOfferContext>,
  now = Date.now(),
): boolean {
  if (!isCarnivalCheckpointAccountCompatible(checkpoint, currentIdentity, now)) return false;

  // Catalogs can temporarily shrink while Carnival hydrates or after a WebView
  // restart. Validate every overlapping code context, but preserve non-overlap
  // states for the same verified VIFP account so completed work remains resumable.
  for (const [rawCode, saved] of Object.entries(checkpoint.codeStates ?? {})) {
    const normalized = normalizeCode(rawCode);
    const current = currentContexts[normalized];
    if (!saved || !current) continue;
    if (saved.context.contextFingerprint !== current.contextFingerprint) return false;
  }
  return true;
}

export function isCarnivalCodeSkippable(record: CarnivalCheckpointCodeRecord | null | undefined): boolean {
  return record?.status === 'success' || record?.status === 'authoritative_empty';
}

function emptyCatalog(): CarnivalCatalogDiscovery {
  return {
    sourceUrl: '',
    personalizedSearchUrl: '',
    tgo: '',
    vifp: '',
    tierCode: '',
    tierName: '',
    resident: '',
    locality: '1',
    currency: 'USD',
    rateCodes: [],
    actionCards: [],
    noOffersConfirmed: false,
  };
}

function chooseCarnivalBookingLink(
  code: string,
  prior: CarnivalRateCodeEntry | undefined,
  incoming: CarnivalRateCodeEntry,
): Pick<CarnivalRateCodeEntry, 'bookingLink' | 'bookingLinkVerified' | 'bookingLinkSource'> {
  const priorLink = String(prior?.bookingLink ?? '').trim();
  const incomingLink = String(incoming.bookingLink ?? '').trim();
  const priorVerified = Boolean(prior?.bookingLinkVerified) || isCarnivalBookingLinkForCode(priorLink, code);
  const incomingVerified = Boolean(incoming.bookingLinkVerified) || isCarnivalBookingLinkForCode(incomingLink, code);

  // A later code-specific URL always wins. A broad/global URL can fill a blank,
  // but it can never displace an already verified code-specific context.
  if (incomingVerified) {
    return {
      bookingLink: incomingLink,
      bookingLinkVerified: true,
      bookingLinkSource: incoming.bookingLinkSource || 'explicit',
    };
  }
  if (priorVerified) {
    return {
      bookingLink: priorLink,
      bookingLinkVerified: true,
      bookingLinkSource: prior?.bookingLinkSource || 'explicit',
    };
  }
  if (incomingLink) {
    return {
      bookingLink: incomingLink,
      bookingLinkVerified: false,
      bookingLinkSource: incoming.bookingLinkSource || 'observed',
    };
  }
  return {
    bookingLink: priorLink,
    bookingLinkVerified: Boolean(prior?.bookingLinkVerified),
    bookingLinkSource: prior?.bookingLinkSource,
  };
}

/**
 * Merge Carnival catalogs without allowing a broad/global page to overwrite the
 * offer-specific personalization context discovered later in the flow.
 *
 * Context fields are deliberately "last non-empty wins". Descriptive offer
 * metadata keeps the richest value while a later booking link wins because it
 * is the most specific Shop Now URL for that rate code.
 */
export function mergeCarnivalCatalogs(catalogs: Array<CarnivalCatalogDiscovery | null | undefined>): CarnivalCatalogDiscovery {
  const merged = emptyCatalog();
  const codeMap = new Map<string, CarnivalRateCodeEntry>();
  const actionMap = new Map<string, NonNullable<CarnivalCatalogDiscovery['actionCards']>[number]>();

  const applyContext = (catalog: CarnivalCatalogDiscovery): void => {
    if (nonEmpty(catalog.sourceUrl)) merged.sourceUrl = catalog.sourceUrl;
    if (nonEmpty(catalog.personalizedSearchUrl)) merged.personalizedSearchUrl = catalog.personalizedSearchUrl;
    if (nonEmpty(catalog.tgo)) {
      const incomingTgoCount = parseCarnivalTgo(catalog.tgo).length;
      const currentTgoCount = parseCarnivalTgo(merged.tgo).length;
      // Keep the richest authenticated TGO catalog. Clicking one Shop Now card
      // can expose a one-code TGO value; that narrow context must not poison the
      // global catalog used to generate isolated links for the remaining codes.
      if (!merged.tgo || incomingTgoCount >= currentTgoCount) merged.tgo = catalog.tgo;
    }
    if (nonEmpty(catalog.vifp)) merged.vifp = catalog.vifp;
    if (nonEmpty(catalog.tierCode)) merged.tierCode = catalog.tierCode;
    if (nonEmpty(catalog.tierName)) merged.tierName = catalog.tierName;
    if (nonEmpty(catalog.resident)) merged.resident = catalog.resident;
    if (nonEmpty(catalog.locality)) merged.locality = catalog.locality;
    if (nonEmpty(catalog.currency)) merged.currency = catalog.currency;
    merged.noOffersConfirmed ||= Boolean(catalog.noOffersConfirmed);
  };

  for (const catalog of catalogs) {
    if (!catalog) continue;
    applyContext(catalog);

    for (const action of catalog.actionCards ?? []) {
      const key = `${String(action.title ?? '').trim().toLowerCase()}|${String(action.href ?? '').trim().toLowerCase()}|${String(action.perks ?? '').trim().toLowerCase().slice(0, 160)}`;
      if (!actionMap.has(key)) actionMap.set(key, action);
    }

    for (const entry of catalog.rateCodes ?? []) {
      const code = normalizeCode(entry.code);
      if (!/^[A-Z0-9]{2,10}$/.test(code)) continue;
      const prior = codeMap.get(code);
      const incomingName = String(entry.offerName ?? '').trim();
      const priorName = String(prior?.offerName ?? '').trim();
      const richerName = incomingName && !/^Rate Code /i.test(incomingName)
        ? incomingName
        : priorName || incomingName || `Rate Code ${code}`;
      const selectedLink = chooseCarnivalBookingLink(code, prior, entry);
      codeMap.set(code, {
        code,
        startDate: String(entry.startDate ?? '').trim() || prior?.startDate || '',
        endDate: String(entry.endDate ?? '').trim() || prior?.endDate || '',
        offerName: richerName,
        perks: String(entry.perks ?? '').trim() || prior?.perks || '',
        ...selectedLink,
      });
    }
  }

  if (merged.personalizedSearchUrl) {
    const parsed = parseCarnivalPersonalizedUrl(merged.personalizedSearchUrl);
    // The parsed final URL is authoritative for context, but never discard
    // richer descriptive metadata already captured from the offer card.
    applyContext(parsed);
    for (const entry of parsed.rateCodes) {
      const prior = codeMap.get(entry.code);
      const parsedEntry: CarnivalRateCodeEntry = {
        ...entry,
        bookingLink: entry.bookingLink || merged.personalizedSearchUrl,
        bookingLinkVerified: isCarnivalBookingLinkForCode(entry.bookingLink || merged.personalizedSearchUrl, entry.code),
        bookingLinkSource: 'explicit',
      };
      const selectedLink = chooseCarnivalBookingLink(entry.code, prior, parsedEntry);
      codeMap.set(entry.code, {
        code: entry.code,
        startDate: entry.startDate || prior?.startDate || '',
        endDate: entry.endDate || prior?.endDate || '',
        offerName: prior?.offerName || entry.offerName || `Rate Code ${entry.code}`,
        perks: prior?.perks || entry.perks || '',
        ...selectedLink,
      });
    }
  }

  merged.rateCodes = Array.from(codeMap.values());
  merged.actionCards = Array.from(actionMap.values());
  // A transient no-offers shell may appear while Carnival is hydrating. Any
  // discovered rate code is stronger evidence and clears that transient flag.
  if (merged.rateCodes.length > 0) merged.noOffersConfirmed = false;
  return merged;
}

export function sameCarnivalCatalogCodes(a: string[], b: string[]): boolean {
  const normalize = (values: string[]) => Array.from(new Set(values.map(normalizeCode).filter(Boolean))).sort();
  const left = normalize(a);
  const right = normalize(b);
  return left.length === right.length && left.every((code, index) => code === right[index]);
}

export function isCarnivalCheckpointFresh(checkpoint: CarnivalSyncCheckpoint, now = Date.now()): boolean {
  if (checkpoint.version !== CARNIVAL_SYNC_CHECKPOINT_VERSION) return false;
  const updatedAt = Date.parse(checkpoint.updatedAt);
  return Number.isFinite(updatedAt) && now - updatedAt >= 0 && now - updatedAt <= CARNIVAL_SYNC_CHECKPOINT_TTL_MS;
}

export function mergeCarnivalBookingRows(rows: BookedCruiseRow[]): BookedCruiseRow[] {
  const map = new Map<string, BookedCruiseRow>();
  for (const rawRow of rows) {
    const row = normalizeCarnivalBookingClassification(ensureCarnivalBookingIdentity(rawRow));
    const bookingId = String(row.bookingId ?? '').trim().toLowerCase();
    const key = bookingId && !isCarnivalSyntheticBookingId(bookingId)
      ? `booking:${bookingId}`
      : `sailing:${carnivalBookingCanonicalKey(row)}`;
    const prior = map.get(key);
    if (!prior) {
      map.set(key, row);
      continue;
    }
    const priorCompleted = isCarnivalBookingCompleted(prior);
    const rowCompleted = isCarnivalBookingCompleted(row);
    const winner = rowCompleted && !priorCompleted ? row : prior;
    const alternate = winner === row ? prior : row;
    map.set(key, normalizeCarnivalBookingClassification(ensureCarnivalBookingIdentity({
      ...alternate,
      ...winner,
      bookingId: !isCarnivalSyntheticBookingId(winner.bookingId) ? winner.bookingId : alternate.bookingId,
      passengers: winner.passengers?.length ? winner.passengers : alternate.passengers,
      passengersInStateroom: winner.passengersInStateroom?.length ? winner.passengersInStateroom : alternate.passengersInStateroom,
      numberOfNights: winner.numberOfNights ?? alternate.numberOfNights,
    })));
  }
  return Array.from(map.values()).map((row) => normalizeCarnivalBookingClassification(ensureCarnivalBookingIdentity(row)));
}
