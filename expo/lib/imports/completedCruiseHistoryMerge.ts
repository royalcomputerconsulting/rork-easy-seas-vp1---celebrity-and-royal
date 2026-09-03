import type { BookedCruise } from '@/types/models';

export interface CompletedCruiseHistoryMergeResult {
  cruises: BookedCruise[];
  addedCruises: BookedCruise[];
  updatedRows: number;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function ownerKey(cruise: BookedCruise): string {
  const record = cruise as BookedCruise & { dataOwnerScopeId?: string; dataOwnerEmail?: string };
  return normalized(record.ownerProfileId ?? record.dataOwnerScopeId ?? record.sourceEmail ?? record.dataOwnerEmail);
}

export function getCompletedCruiseHistoryIdentity(cruise: BookedCruise): string {
  const owner = ownerKey(cruise);
  const reservation = normalized(cruise.bookingId ?? cruise.reservationNumber ?? cruise.bwoNumber);
  if (reservation) return `${owner}|reservation:${reservation}`;
  return `${owner}|sailing:${normalized(cruise.shipName)}|${normalized(cruise.sailDate)}`;
}

function isSavedValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

// A completed-history import is a fallback/reconciliation source. Values
// already saved on the cruise—especially a manual closeout—must win field by
// field, including an intentional zero. Each alias group is kept coherent so
// Casino, Booked, Agent SEA, and backup consumers read the same truth.
const SAVED_VALUE_ALIAS_GROUPS = [
  ['pointsEarned', 'earnedPoints', 'casinoPoints', 'clubRoyalePoints'],
  ['coinIn', 'totalCoinIn'],
  ['winningsBroughtHome', 'winnings', 'totalWinnings'],
  ['cashResult', 'netResult', 'winLoss', 'casinoWinLoss', 'actualWinLoss'],
  ['hoursPlayed', 'estimatedPlayHours'],
  ['ratedGamingDays'],
  ['retailValue', 'totalRetailCost', 'originalPrice', 'price', 'totalPrice'],
  ['amountPaid', 'pricePaid', 'netEffectivePaid'],
  ['taxes', 'taxesFeesEstimate'],
] as const;

export function mergeCompletedCruiseHistoryRecord(existing: BookedCruise, imported: BookedCruise): BookedCruise {
  const existingRecord = existing as BookedCruise & Record<string, unknown>;
  const mergedRecord = {
    ...existing,
    ...imported,
    id: existing.id,
    ports: existing.ports?.length ? existing.ports : imported.ports,
    itinerary: existing.itinerary?.length ? existing.itinerary : imported.itinerary,
    itineraryRaw: existing.itineraryRaw?.length ? existing.itineraryRaw : imported.itineraryRaw,
    guestNames: existing.guestNames?.length ? existing.guestNames : imported.guestNames,
    createdAt: existing.createdAt ?? imported.createdAt,
  } as BookedCruise & Record<string, unknown>;

  for (const group of SAVED_VALUE_ALIAS_GROUPS) {
    const savedValue = group.map((field) => existingRecord[field]).find(isSavedValue);
    if (!isSavedValue(savedValue)) continue;
    for (const field of group) (mergedRecord as Record<string, unknown>)[field] = savedValue;
  }

  // Retain explicit closeout/manual provenance while still attaching the
  // imported history ID and file provenance supplied by the imported record.
  for (const field of [
    'sourceAuthority',
    'postCruiseCloseoutAt',
    'postCruiseCloseoutNotes',
    'closeoutStatus',
    'casinoCloseoutSource',
    'closeoutSource',
  ]) {
    if (isSavedValue(existingRecord[field])) mergedRecord[field] = existingRecord[field];
  }

  return mergedRecord as BookedCruise;
}

export function mergeCompletedCruiseHistory(
  existingCruises: BookedCruise[],
  importedCruises: BookedCruise[],
): CompletedCruiseHistoryMergeResult {
  const importedByIdentity = new Map(importedCruises.map((cruise) => [getCompletedCruiseHistoryIdentity(cruise), cruise] as const));
  let updatedRows = 0;
  const mergedExisting = existingCruises.map((existing) => {
    const identity = getCompletedCruiseHistoryIdentity(existing);
    const imported = importedByIdentity.get(identity);
    if (!imported) return existing;
    importedByIdentity.delete(identity);
    updatedRows += 1;
    return mergeCompletedCruiseHistoryRecord(existing, imported);
  });
  const addedCruises = Array.from(importedByIdentity.values());
  return { cruises: [...mergedExisting, ...addedCruises], addedCruises, updatedRows };
}
