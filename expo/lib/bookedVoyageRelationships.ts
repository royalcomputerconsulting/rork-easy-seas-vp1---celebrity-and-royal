import type { BookedCruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';

export interface PhysicalBookedVoyageGroup {
  key: string;
  voyage: BookedCruise;
  reservations: BookedCruise[];
}

export interface ConsecutiveBookedVoyageBlock {
  id: string;
  voyages: PhysicalBookedVoyageGroup[];
  startDate: string;
  endDate: string;
  nights: number;
}

function compact(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function ownerKey(cruise: BookedCruise): string {
  // Synced and legacy records can represent the same owner with a changing
  // local profile id. The authenticated source email is the more durable
  // account identity when it is available.
  return compact(cruise.sourceEmail) || compact(cruise.ownerProfileId) || 'shared';
}

function normalizedDate(value: string | undefined): string {
  if (!value) return '';
  try {
    const parsed = createDateFromString(value);
    if (Number.isNaN(parsed.getTime())) return compact(value);
    return [parsed.getFullYear(), String(parsed.getMonth() + 1).padStart(2, '0'), String(parsed.getDate()).padStart(2, '0')].join('-');
  } catch {
    return compact(value);
  }
}

function normalizedVoyageEnd(cruise: BookedCruise): string {
  if (cruise.returnDate) return normalizedDate(cruise.returnDate);
  if (!cruise.sailDate || !Number.isFinite(Number(cruise.nights))) return '';
  try {
    const end = createDateFromString(cruise.sailDate);
    end.setDate(end.getDate() + Math.max(0, Number(cruise.nights) || 0));
    return [end.getFullYear(), String(end.getMonth() + 1).padStart(2, '0'), String(end.getDate()).padStart(2, '0')].join('-');
  } catch {
    return '';
  }
}

export function getPhysicalBookedVoyageKey(cruise: BookedCruise): string {
  return [
    ownerKey(cruise),
    compact(cruise.shipName),
    normalizedDate(cruise.sailDate),
    normalizedVoyageEnd(cruise),
  ].join('|');
}

function hasMaterialValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function casinoEvidenceScore(cruise: BookedCruise): number {
  const evidence = cruise as BookedCruise & { pointsSource?: string; casinoCloseoutSource?: string };
  let score = 0;
  if (evidence.pointsSource === 'manual') score += 100;
  if (evidence.casinoCloseoutSource === 'manual') score += 100;
  if (cruise.sourceAuthority === 'user_entered') score += 80;
  if (cruise.sourceAuthority === 'provider') score += 50;
  for (const value of [cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints, cruise.coinIn, cruise.winningsBroughtHome, cruise.winnings, cruise.cashResult, cruise.netResult]) {
    if (Number.isFinite(Number(value))) score += 5;
  }
  if (cruise.itinerary?.length) score += 10;
  return score;
}

function mergePhysicalVoyageReservations(reservations: BookedCruise[]): BookedCruise {
  const ranked = reservations.slice().sort((left, right) => casinoEvidenceScore(right) - casinoEvidenceScore(left));
  const merged: BookedCruise = { ...ranked[0] };
  const target = merged as BookedCruise & Record<string, unknown>;
  for (const reservation of ranked.slice(1)) {
    Object.entries(reservation).forEach(([field, value]) => {
      // Booking identity remains the chosen representative's identity. The
      // complete set is retained separately in `reservations`.
      if (['id', 'bookingId', 'reservationNumber', 'reservationId', 'bookingNumber'].includes(field)) return;
      if (!hasMaterialValue(target[field]) && hasMaterialValue(value)) target[field] = value;
    });
  }
  return merged;
}

export function buildPhysicalBookedVoyageGroups(cruises: BookedCruise[]): PhysicalBookedVoyageGroup[] {
  const groups = new Map<string, PhysicalBookedVoyageGroup>();
  cruises.forEach((cruise) => {
    const key = getPhysicalBookedVoyageKey(cruise);
    const existing = groups.get(key);
    if (existing) {
      existing.reservations.push(cruise);
      existing.voyage = mergePhysicalVoyageReservations(existing.reservations);
    }
    else groups.set(key, { key, voyage: cruise, reservations: [cruise] });
  });
  return Array.from(groups.values()).sort((left, right) => left.voyage.sailDate.localeCompare(right.voyage.sailDate));
}

/** One canonical calculation row per physical voyage; reservations stay intact in the UI. */
export function buildCanonicalBookedVoyages(cruises: BookedCruise[]): BookedCruise[] {
  return buildPhysicalBookedVoyageGroups(cruises).map((group) => group.voyage);
}

function voyageEnd(group: PhysicalBookedVoyageGroup): Date {
  if (group.voyage.returnDate) return createDateFromString(group.voyage.returnDate);
  const start = createDateFromString(group.voyage.sailDate);
  start.setDate(start.getDate() + Math.max(0, Number(group.voyage.nights) || 0));
  return start;
}

export function buildConsecutiveBookedVoyageBlocks(cruises: BookedCruise[], maxGapDays = 2): ConsecutiveBookedVoyageBlock[] {
  const groups = buildPhysicalBookedVoyageGroups(cruises);
  const blocks: PhysicalBookedVoyageGroup[][] = [];
  let current: PhysicalBookedVoyageGroup[] = [];

  groups.forEach((group) => {
    if (current.length === 0) {
      current = [group];
      return;
    }
    const previous = current[current.length - 1];
    const gap = Math.round((createDateFromString(group.voyage.sailDate).getTime() - voyageEnd(previous).getTime()) / 86_400_000);
    if (gap >= 0 && gap <= maxGapDays) current.push(group);
    else {
      if (current.length > 1) blocks.push(current);
      current = [group];
    }
  });
  if (current.length > 1) blocks.push(current);

  return blocks.map((voyages) => {
    const startDate = voyages[0].voyage.sailDate;
    const endDate = voyages[voyages.length - 1].voyage.returnDate || voyageEnd(voyages[voyages.length - 1]).toISOString().slice(0, 10);
    return {
      id: `${voyages[0].key}->${voyages[voyages.length - 1].key}`,
      voyages,
      startDate,
      endDate,
      nights: voyages.reduce((sum, group) => sum + Math.max(0, Number(group.voyage.nights) || 0), 0),
    };
  });
}
