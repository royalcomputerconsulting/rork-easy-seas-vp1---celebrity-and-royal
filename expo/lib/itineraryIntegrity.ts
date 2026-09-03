import type { CasinoOffer, Cruise, ItineraryDay } from '../types/models';
import { getDataAuthority, isAtLeastAsAuthoritative, isOperationallyAuthoritative, type DataAuthority } from './dataAuthority';

export interface ParsedItineraryDay extends ItineraryDay {
  source: DataAuthority;
}

export function normalizeItineraryText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isExplicitSeaDay(day: Pick<ItineraryDay, 'isSeaDay' | 'port'> | undefined): boolean {
  return day?.isSeaDay === true || /^(?:at sea|sea day)$/i.test(String(day?.port ?? '').trim());
}

/**
 * A line is a day. Commas are deliberately kept inside the port name, e.g.
 * "Miami, Florida; Arrival: --; Departure: 4:00 PM".
 */
export function parsePortsAndTimes(value: string, source: DataAuthority = 'unknown'): ParsedItineraryDay[] {
  if (!value || typeof value !== 'string') return [];

  return value
    .split(/\r?\n|>/)
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split(/[;|\t]/).map((part) => part.trim()).filter(Boolean);
      const labelledPort = fields.find((field) => /^port\s*:/i.test(field));
      const port = (labelledPort ? labelledPort.replace(/^port\s*:/i, '') : fields[0] ?? '').trim();
      const arrivalField = fields.find((field) => /^(?:arrival|arrive)\s*:/i.test(field));
      const departureField = fields.find((field) => /^(?:departure|depart)\s*:/i.test(field));
      return {
        day: index + 1,
        port,
        arrival: arrivalField?.replace(/^(?:arrival|arrive)\s*:/i, '').trim() || undefined,
        departure: departureField?.replace(/^(?:departure|depart)\s*:/i, '').trim() || undefined,
        isSeaDay: /^(?:at sea|sea day)$/i.test(port),
        source,
      };
    })
    .filter((day) => Boolean(day.port));
}

export function getItineraryFingerprint(cruise: {
  id: string;
  sailDate: string;
  returnDate?: string | null;
  nights: number;
  itinerary?: ItineraryDay[] | null;
}): string {
  const entries = (cruise.itinerary ?? [])
    .slice()
    .sort((left, right) => left.day - right.day)
    .map((day) => [day.day, day.port, day.arrival, day.departure, day.isSeaDay, day.latitude, day.longitude, day.source].join('~'))
    .join('|');
  return `${cruise.id}:${cruise.sailDate}:${cruise.returnDate ?? ''}:${cruise.nights}:${entries}`;
}

function sameText(left: unknown, right: unknown): boolean {
  const first = normalizeItineraryText(left);
  const second = normalizeItineraryText(right);
  return !first || !second || first === second;
}

function sameNumber(left: unknown, right: unknown): boolean {
  if (left === undefined || left === null || right === undefined || right === null) return true;
  const first = Number(left);
  const second = Number(right);
  return !Number.isFinite(first) || !Number.isFinite(second) || first === second;
}

/**
 * Offer code by itself is never enough. A fallback is eligible only for a
 * uniquely linked or materially identical sailing in the active profile.
 */
export function findSingleMaterialOffer(cruise: Cruise, offers: CasinoOffer[]): CasinoOffer | undefined {
  const directLinks = offers.filter((offer) => {
    if (offer.cruiseId !== cruise.id && !offer.cruiseIds?.includes(cruise.id)) return false;
    // Explicit membership proves eligibility, not that aggregate row material
    // belongs to this sailing. Aggregated offers may link thousands of cruise
    // ids while retaining no row-specific ship/date at all. If material is
    // present on both records, it must agree before it can enrich itinerary.
    return sameText(cruise.shipName, offer.shipName)
      && sameText(cruise.sailDate, offer.sailingDate);
  });
  if (directLinks.length === 1) return directLinks[0];
  if (directLinks.length > 1) return undefined;

  const candidates = offers.filter((offer) => {
    if (!sameText(cruise.offerCode, offer.offerCode) || !cruise.offerCode || !offer.offerCode) return false;
    if (!sameText(cruise.shipName, offer.shipName) || !sameText(cruise.sailDate, offer.sailingDate)) return false;
    if (!sameText(cruise.brand, offer.brand) || !sameText(cruise.casinoProgram, offer.casinoProgram)) return false;
    if (!sameText(cruise.ownerProfileId, offer.ownerProfileId) || !sameText(cruise.sourceEmail, offer.sourceEmail)) return false;
    if (!sameText(cruise.cabinType, offer.roomType) || !sameNumber(cruise.guests, offer.guests)) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function canUseItineraryForOperationalDecisions(days: ItineraryDay[] | undefined): boolean {
  return Boolean(days?.length) && days!.every((day) => {
    const authority = getDataAuthority(day.source);
    return isOperationallyAuthoritative(authority) && Boolean(day.port || day.isSeaDay);
  });
}

export function mergeItineraryDay(existing: ItineraryDay, candidate: ItineraryDay): ItineraryDay {
  return isAtLeastAsAuthoritative(candidate.source, existing.source) ? candidate : existing;
}
