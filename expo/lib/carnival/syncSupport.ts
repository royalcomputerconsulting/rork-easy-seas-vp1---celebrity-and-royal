import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeRemoveItem, quotaSafeSetJsonItem } from '../storage/quotaSafeStorage';
import type {
  BookedCruiseRow,
  CarnivalCollectionEvidence,
  CarnivalCollectionEvidenceMap,
  CarnivalCollectionKey,
  CarnivalCollectionStatus,
  CarnivalSyncOutcome,
  OfferRow,
} from '@/lib/royalCaribbean/types';

async function coordinatedCheckpointGet<T>(key: string, fallback: T): Promise<T> {
  return quotaSafeGetJsonItem<T>(key, fallback);
}
async function coordinatedCheckpointSet(key: string, value: unknown): Promise<void> {
  await quotaSafeSetJsonItem(key, value);
}
async function coordinatedCheckpointRemove(key: string): Promise<void> {
  await quotaSafeRemoveItem(key);
}

export const CARNIVAL_SYNC_CHECKPOINT_VERSION = 3;
export const CARNIVAL_SYNC_CHECKPOINT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CarnivalSyncAccessState = 'enabled' | 'authentication_required' | 'disabled_by_rollout' | 'service_unavailable' | 'unknown_error';

export interface CarnivalSyncAccess {
  state: CarnivalSyncAccessState;
  enabled: boolean;
  reason: string;
}

export interface CarnivalSyncCheckpoint {
  version: number;
  syncRunId: string;
  profileId: string;
  accountFingerprint: string;
  ownerFingerprint: string;
  createdAt: string;
  updatedAt: string;
  completedStages: string[];
  pendingStages: string[];
  collections: CarnivalCollectionEvidenceMap;
  offerRows: OfferRow[];
  bookedCruiseRows: BookedCruiseRow[];
  loyaltyData: Record<string, string>;
  rateCodes?: CarnivalRateCodeEvidenceMap;
}

export interface CarnivalCheckpointValidation {
  valid: boolean;
  requiresAccountVerification: boolean;
  reason?: 'profile_mismatch' | 'owner_mismatch' | 'account_mismatch' | 'checkpoint_expired' | 'invalid_checkpoint';
}

export interface CarnivalStructuredPayload {
  offers: unknown[];
  bookings: unknown[];
  completedCruises: unknown[];
  holds: unknown[];
  loyalty: Record<string, unknown> | null;
}

export type CarnivalRateCodeStatus = 'not_started' | 'captured' | 'incomplete' | 'failed';

export interface CarnivalRateCodeEvidence {
  code: string;
  discoveredAt: string;
  requestedPages: number;
  acknowledgedPages: number;
  expectedPages?: number;
  receivedRows: number;
  status: CarnivalRateCodeStatus;
  reason?: string;
}

export type CarnivalRateCodeEvidenceMap = Record<string, CarnivalRateCodeEvidence>;

export interface CarnivalRateCodePaginationMessage {
  requestedPages?: unknown;
  acknowledgedPages?: unknown;
  expectedPages?: unknown;
  receivedRows?: unknown;
  complete?: unknown;
  reason?: unknown;
}

export interface CarnivalRateCodePaginationAssessment {
  requestedPages: number;
  acknowledgedPages: number;
  expectedPages: number;
  receivedRows: number;
  complete: boolean;
  status: CarnivalRateCodeStatus;
  reason: string;
}

export interface CarnivalVifpPayload {
  vifpNumber: string;
  vifpTier: string;
  firstName: string;
  lastName: string;
  vifpPoints: string;
  cruiseDayPoints: string;
  cruiseCount: string;
}

/**
 * WebView extraction can split an offer's sailings across several messages.
 * Keep that protocol state Carnival-owned so the shared provider only routes
 * messages and resolves the requesting UI operation.
 */
export interface CarnivalSailingChunk {
  requestId?: number;
  offerCode?: string;
  totalChunks?: number;
  chunkIndex?: number;
  isFinal?: boolean;
  sailings?: unknown;
}

export interface CarnivalSailingChunkAccumulator {
  offerCode: string;
  totalChunks: number;
  chunks: Map<number, OfferRow[]>;
}

export interface CarnivalCompletedSailingChunks {
  offerCode: string;
  totalChunks: number;
  rows: OfferRow[];
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : fallback;
}

function toNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function textFromPayload(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Keeps Carnival's VIFP field variants out of the shared provider runtime. */
export function parseCarnivalVifpPayload(value: unknown): CarnivalVifpPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const vifpNumber = textFromPayload(record.PastGuestNumber ?? record.vifpNumber);
  const tierCode = textFromPayload(record.TierCode ?? record.tierCode ?? record.tierName);
  const vifpPoints = textFromPayload(record.Points ?? record.TotalPoints ?? record.VifpPoints ?? record.vifpPoints);
  const cruiseDayPoints = textFromPayload(record.CruiseDays ?? record.cruiseDays ?? record.CruiseDayPoints);
  const cruiseCount = textFromPayload(record.CruiseCount ?? record.cruiseCount ?? record.TotalCruises);
  if (!vifpNumber && !tierCode && !vifpPoints && !cruiseDayPoints && !cruiseCount) {
    return null;
  }
  const tierMap: Record<string, string> = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
  return {
    vifpNumber,
    vifpTier: tierMap[tierCode] ?? (tierCode || 'Unknown'),
    firstName: textFromPayload(record.FirstName ?? record.firstName),
    lastName: textFromPayload(record.LastName ?? record.lastName),
    vifpPoints,
    cruiseDayPoints,
    cruiseCount,
  };
}

/**
 * A collector's completion flag is evidence, not authority. Completion needs
 * an explicit expected page count and acknowledgements for each expected page.
 */
export function assessCarnivalRateCodePagination(
  message: CarnivalRateCodePaginationMessage,
): CarnivalRateCodePaginationAssessment {
  const requestedPages = toNonNegativeInteger(message.requestedPages);
  const acknowledgedPages = toNonNegativeInteger(message.acknowledgedPages);
  const expectedPages = toNonNegativeInteger(message.expectedPages);
  const receivedRows = toNonNegativeInteger(message.receivedRows);
  const collectorClaimsComplete = message.complete === true;
  const countersComplete = expectedPages > 0 && acknowledgedPages >= expectedPages;
  const complete = collectorClaimsComplete && countersComplete;

  let reason = String(message.reason ?? '').trim();
  if (!collectorClaimsComplete) {
    reason = reason || 'Carnival did not acknowledge pagination completeness.';
  } else if (expectedPages === 0) {
    reason = 'Carnival marked pagination complete without an expected page count.';
  } else if (acknowledgedPages < expectedPages) {
    reason = `Carnival acknowledged ${acknowledgedPages}/${expectedPages} expected page(s).`;
  }

  return {
    requestedPages,
    acknowledgedPages,
    expectedPages,
    receivedRows,
    complete,
    status: complete ? 'captured' : 'incomplete',
    reason,
  };
}

/**
 * Records one chunk and returns rows only when the terminal message confirms
 * every expected chunk. Incomplete runs remain resumable in the accumulator.
 */
export function collectCarnivalSailingChunk(
  accumulators: Map<number, CarnivalSailingChunkAccumulator>,
  chunk: CarnivalSailingChunk,
  normalizeRows: (value: unknown) => OfferRow[],
): CarnivalCompletedSailingChunks | null {
  const rawRequestId = Number(chunk.requestId ?? 0);
  const requestId = Number.isFinite(rawRequestId) ? Math.floor(rawRequestId) : 0;
  const chunkIndex = toPositiveInteger(chunk.chunkIndex, 1);
  const totalChunks = toPositiveInteger(chunk.totalChunks, 1);
  const existing = accumulators.get(requestId) ?? {
    offerCode: String(chunk.offerCode ?? ''),
    totalChunks,
    chunks: new Map<number, OfferRow[]>(),
  };

  existing.totalChunks = Math.max(existing.totalChunks, totalChunks);
  if (!existing.offerCode && chunk.offerCode) {
    existing.offerCode = String(chunk.offerCode);
  }
  existing.chunks.set(chunkIndex, normalizeRows(chunk.sailings));
  accumulators.set(requestId, existing);

  const hasEveryExpectedChunk = Array.from({ length: existing.totalChunks }, (_, index) => existing.chunks.has(index + 1))
    .every(Boolean);
  if (!chunk.isFinal || !hasEveryExpectedChunk) {
    return null;
  }

  const rows = Array.from(existing.chunks.entries())
    .sort(([left], [right]) => left - right)
    .flatMap(([, rowsForChunk]) => rowsForChunk);
  accumulators.delete(requestId);
  return { offerCode: existing.offerCode, totalChunks: existing.totalChunks, rows };
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * Carnival sync is an on-device workflow. It needs an active EasySeas
 * profile for data isolation, but never waits on a feature-policy service.
 */
export function getCarnivalSyncAccess(profileId: string | null | undefined): CarnivalSyncAccess {
  const normalizedProfileId = String(profileId ?? '').trim();
  if (!normalizedProfileId) {
    return { state: 'authentication_required', enabled: false, reason: 'Sign in and select an EasySeas profile to sync Carnival data.' };
  }

  return { state: 'enabled', enabled: true, reason: 'Carnival sync is available for this signed-in profile.' };
}

export function createCarnivalRateCodeEvidence(codes: string[]): CarnivalRateCodeEvidenceMap {
  const now = new Date().toISOString();
  return codes.reduce<CarnivalRateCodeEvidenceMap>((result, rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (code && !result[code]) {
      result[code] = {
        code,
        discoveredAt: now,
      requestedPages: 0,
      acknowledgedPages: 0,
      expectedPages: 0,
        receivedRows: 0,
        status: 'not_started',
      };
    }
    return result;
  }, {});
}

export function updateCarnivalRateCodeEvidence(
  current: CarnivalRateCodeEvidenceMap,
  code: string,
  update: Partial<Omit<CarnivalRateCodeEvidence, 'code' | 'discoveredAt'>>,
): CarnivalRateCodeEvidenceMap {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return current;
  const existing = current[normalizedCode] ?? {
    code: normalizedCode,
    discoveredAt: new Date().toISOString(),
    requestedPages: 0,
    acknowledgedPages: 0,
    expectedPages: 0,
    receivedRows: 0,
    status: 'not_started' as CarnivalRateCodeStatus,
  };
  return {
    ...current,
    [normalizedCode]: {
      ...existing,
      ...update,
      requestedPages: Math.max(0, Math.floor(update.requestedPages ?? existing.requestedPages)),
      acknowledgedPages: Math.max(0, Math.floor(update.acknowledgedPages ?? existing.acknowledgedPages)),
      expectedPages: Math.max(0, Math.floor(update.expectedPages ?? existing.expectedPages ?? 0)),
      receivedRows: Math.max(0, Math.floor(update.receivedRows ?? existing.receivedRows)),
    },
  };
}

export function hasIncompleteCarnivalRateCodes(rateCodes: CarnivalRateCodeEvidenceMap | undefined): boolean {
  return Object.values(rateCodes ?? {}).some((entry) => entry.status !== 'captured'
    || entry.acknowledgedPages < entry.requestedPages
    || (entry.expectedPages ?? 0) > entry.acknowledgedPages);
}

export function createCarnivalAccountFingerprint(vifpNumber: string | null | undefined): string {
  const normalized = normalizeText(vifpNumber);
  if (!normalized) {
    return '';
  }

  // A local comparison token, never a reusable Carnival credential.
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `carnival-${(hash >>> 0).toString(16)}`;
}

/** A local comparison token used to bind a resumable run to its EasySeas owner. */
export function createCarnivalOwnerFingerprint(
  profileId: string | null | undefined,
  authenticatedEmail: string | null | undefined,
): string {
  const normalizedProfileId = normalizeText(profileId);
  const normalizedEmail = normalizeText(authenticatedEmail);
  if (!normalizedProfileId || !normalizedEmail) return '';
  return createCarnivalAccountFingerprint(`${normalizedProfileId}|${normalizedEmail}`)?.replace('carnival-', 'easyseas-') ?? '';
}

function newEvidence(): CarnivalCollectionEvidence {
  return { status: 'not_started', count: 0, source: '', capturedAt: '' };
}

export function createCarnivalCollectionEvidence(): CarnivalCollectionEvidenceMap {
  return {
    offers: newEvidence(),
    offerSailings: newEvidence(),
    bookedCruises: newEvidence(),
    cruiseHolds: newEvidence(),
    completedCruises: newEvidence(),
    vifpIdentity: newEvidence(),
    vifpTier: newEvidence(),
    vifpPoints: newEvidence(),
    cruiseDayPoints: newEvidence(),
    cruiseCount: newEvidence(),
  };
}

export function updateCarnivalCollection(
  collections: CarnivalCollectionEvidenceMap,
  key: CarnivalCollectionKey,
  count: number,
  source: string,
  status?: CarnivalCollectionStatus,
  reason?: string,
): CarnivalCollectionEvidenceMap {
  const normalizedCount = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
  return {
    ...collections,
    [key]: {
      status: status ?? (normalizedCount > 0 ? 'captured' : 'empty'),
      count: normalizedCount,
      source,
      capturedAt: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    },
  };
}

function hasKnownCollection(collection: CarnivalCollectionEvidence): boolean {
  return collection.status === 'captured' || collection.status === 'empty';
}

export function evaluateCarnivalSyncOutcome(
  collections: CarnivalCollectionEvidenceMap,
  rateCodes?: CarnivalRateCodeEvidenceMap,
): CarnivalSyncOutcome {
  const hasOfferEvidence = hasKnownCollection(collections.offers);
  const hasOfferSailingEvidence = hasKnownCollection(collections.offerSailings);
  const hasBookingEvidence = hasKnownCollection(collections.bookedCruises);
  const hasLoyaltyIdentity = collections.vifpIdentity.status === 'captured' || collections.vifpTier.status === 'captured';
  const hasAnyEvidence = Object.values(collections).some((collection) => collection.status === 'captured' || collection.status === 'empty');

  if (!hasAnyEvidence) {
    return 'invalid_response';
  }
  if (hasIncompleteCarnivalRateCodes(rateCodes)) {
    return 'partial';
  }
  // A personalized-offer card is not proof that its full cruise inventory was
  // captured. A non-empty offer collection must have an authoritative sailing
  // collection (captured rows or an explicitly verified empty result) before
  // the run can be called complete.
  if (collections.offers.status === 'captured' && collections.offers.count > 0 && !hasOfferSailingEvidence) {
    return 'partial';
  }
  if (hasOfferEvidence && hasBookingEvidence && hasLoyaltyIdentity && collections.vifpPoints.status !== 'failed') {
    return 'complete';
  }
  if (hasOfferEvidence && hasBookingEvidence) {
    return 'complete_with_warnings';
  }
  return 'partial';
}

export function getCarnivalOutcomeMessage(outcome: CarnivalSyncOutcome): string {
  switch (outcome) {
    case 'complete':
      return 'All requested Carnival categories were captured and are ready to save.';
    case 'complete_with_warnings':
      return 'Cruise and offer data were captured, but some loyalty evidence is incomplete.';
    case 'partial':
      return 'Only part of the Carnival data was captured. Existing stored data will be preserved.';
    case 'invalid_response':
      return 'Carnival did not return a usable data response. Nothing will be saved as a successful sync.';
  }
}

function findArray(value: unknown, keys: string[], depth: number = 0, allowRootArray: boolean = false): unknown[] {
  if (!value || depth > 4) {
    return [];
  }
  if (Array.isArray(value)) {
    return depth > 0 || allowRootArray ? value : [];
  }
  if (typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  for (const childKey of ['payload', 'data', 'result', 'response', 'profile', 'profileData']) {
    const nested = findArray(record[childKey], keys, depth + 1, allowRootArray);
    if (nested.length > 0) {
      return nested;
    }
  }
  return [];
}

function findLoyalty(value: unknown, depth: number = 0): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || depth > 4) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const loyaltyKeys = ['PastGuestNumber', 'vifpNumber', 'TierCode', 'tierName', 'VifpPoints', 'CruiseDays', 'cruiseCount'];
  if (loyaltyKeys.some((key) => record[key] !== undefined)) {
    return record;
  }
  for (const key of ['loyalty', 'vifp', 'member', 'profile', 'payload', 'data', 'result']) {
    const nested = findLoyalty(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return null;
}

export interface CarnivalStructuredPayloadContext {
  url?: string;
  endpoint?: string;
}

export function isCarnivalProfileIdentityEndpoint(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return /\/profilemanagement\/api\/v1\.0\/profiles(?:[?#]|$)/i.test(normalized)
    || normalized === 'profile'
    || normalized === 'profiles';
}

export function inspectCarnivalStructuredPayload(
  data: unknown,
  context: CarnivalStructuredPayloadContext = {},
): CarnivalStructuredPayload {
  const profileIdentityOnly = isCarnivalProfileIdentityEndpoint(context.url)
    || isCarnivalProfileIdentityEndpoint(context.endpoint);

  return {
    offers: findArray(data, ['Items', 'items', 'offers', 'personalizedOffers', 'eligibleOffers', 'memberOffers', 'vifpOffers', 'casinoOffers', 'promotions', 'deals', 'campaigns']),
    // The Profiles identity endpoint contains nested historical/profile arrays
    // that are not an authoritative upcoming-bookings collection. Allowing its
    // root array to masquerade as bookings produced a 2023 Panorama record as
    // an upcoming cruise. Dedicated collectors still parse explicit named
    // booking/history arrays when Carnival returns them.
    bookings: profileIdentityOnly
      ? findArray(data, ['bookings', 'upcomingCruises', 'reservations'])
      : findArray(data, ['bookings', 'upcomingCruises', 'cruises', 'reservations', 'trips'], 0, true),
    completedCruises: findArray(data, ['pastCruises', 'completedCruises', 'cruiseHistory', 'pastTrips', 'completedTrips']),
    holds: findArray(data, ['holds', 'courtesyHolds', 'cruiseHolds']),
    loyalty: findLoyalty(data),
  };
}

function sanitizeBookedCruiseRows(rows: BookedCruiseRow[]): BookedCruiseRow[] {
  return rows.map(({ rawBooking: _rawBooking, passengers: _passengers, passengersInStateroom: _passengersInStateroom, ...row }) => row);
}

export function buildCarnivalCheckpoint(input: Omit<CarnivalSyncCheckpoint, 'version' | 'updatedAt' | 'offerRows' | 'bookedCruiseRows'> & {
  offerRows: OfferRow[];
  bookedCruiseRows: BookedCruiseRow[];
}): CarnivalSyncCheckpoint {
  return {
    ...input,
    version: CARNIVAL_SYNC_CHECKPOINT_VERSION,
    updatedAt: new Date().toISOString(),
    offerRows: input.offerRows,
    bookedCruiseRows: sanitizeBookedCruiseRows(input.bookedCruiseRows),
  };
}

export async function saveCarnivalSyncCheckpoint(email: string | null, checkpoint: CarnivalSyncCheckpoint): Promise<void> {
  await coordinatedCheckpointSet(getUserScopedKey(ALL_STORAGE_KEYS.CARNIVAL_SYNC_CHECKPOINT, email), checkpoint);
}

export async function loadCarnivalSyncCheckpoint(email: string | null): Promise<CarnivalSyncCheckpoint | null> {
  const parsed = await coordinatedCheckpointGet<Partial<CarnivalSyncCheckpoint> | null>(getUserScopedKey(ALL_STORAGE_KEYS.CARNIVAL_SYNC_CHECKPOINT, email), null);
  if (!parsed) {
    return null;
  }
  try {
    if (parsed.version !== CARNIVAL_SYNC_CHECKPOINT_VERSION || !parsed.profileId || !parsed.syncRunId || !parsed.collections || !parsed.ownerFingerprint) {
      return null;
    }
    return parsed as CarnivalSyncCheckpoint;
  } catch {
    return null;
  }
}

export async function clearCarnivalSyncCheckpoint(email: string | null): Promise<void> {
  await coordinatedCheckpointRemove(getUserScopedKey(ALL_STORAGE_KEYS.CARNIVAL_SYNC_CHECKPOINT, email));
}

export function validateCarnivalSyncCheckpoint(
  checkpoint: CarnivalSyncCheckpoint,
  profileId: string | null | undefined,
  accountFingerprint: string | null | undefined,
  ownerFingerprint?: string | null,
  now: number = Date.now(),
): CarnivalCheckpointValidation {
  if (!checkpoint.profileId || !checkpoint.syncRunId || !checkpoint.ownerFingerprint || checkpoint.version !== CARNIVAL_SYNC_CHECKPOINT_VERSION) {
    return { valid: false, requiresAccountVerification: false, reason: 'invalid_checkpoint' };
  }
  const updatedAt = new Date(checkpoint.updatedAt || checkpoint.createdAt).getTime();
  if (!Number.isFinite(updatedAt) || updatedAt > now + 5 * 60 * 1000) {
    return { valid: false, requiresAccountVerification: false, reason: 'invalid_checkpoint' };
  }
  if (now - updatedAt > CARNIVAL_SYNC_CHECKPOINT_MAX_AGE_MS) {
    return { valid: false, requiresAccountVerification: false, reason: 'checkpoint_expired' };
  }
  if (!profileId || checkpoint.profileId !== profileId) {
    return { valid: false, requiresAccountVerification: false, reason: 'profile_mismatch' };
  }
  if (!ownerFingerprint || checkpoint.ownerFingerprint !== ownerFingerprint) {
    return { valid: false, requiresAccountVerification: false, reason: 'owner_mismatch' };
  }
  if (checkpoint.accountFingerprint && accountFingerprint && checkpoint.accountFingerprint !== accountFingerprint) {
    return { valid: false, requiresAccountVerification: false, reason: 'account_mismatch' };
  }
  return {
    valid: true,
    requiresAccountVerification: !checkpoint.accountFingerprint || !accountFingerprint,
  };
}
