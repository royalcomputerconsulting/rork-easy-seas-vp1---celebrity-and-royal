import type { BookedCruise, ItineraryDay } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { dedupeBookedCruises } from '@/lib/dataIdentity';

export interface CruiseOverlapWarning {
  cruiseId: string;
  conflictingCruiseId: string;
  message: string;
}

interface CruiseDateRange {
  start: Date;
  end: Date;
}

const ICON_MAY_2026_ITINERARY: ItineraryDay[] = [
  { day: 1, port: 'Miami, Florida', departure: '16:30', isSeaDay: false },
  { day: 2, port: 'At Sea', isSeaDay: true },
  { day: 3, port: 'Costa Maya, Mexico', arrival: '08:00', departure: '17:00', isSeaDay: false },
  { day: 4, port: 'Roatan, Honduras', arrival: '07:00', departure: '16:00', isSeaDay: false },
  { day: 5, port: 'Cozumel, Mexico', arrival: '08:00', departure: '18:00', isSeaDay: false },
  { day: 6, port: 'At Sea', isSeaDay: true },
  { day: 7, port: 'Perfect Day at CocoCay, Bahamas', arrival: '07:00', departure: '17:00', isSeaDay: false },
  { day: 8, port: 'Miami, Florida', arrival: '06:00', isSeaDay: false },
];

const ICON_MAY_2026_PORTS: string[] = [
  'Miami, Florida',
  'Costa Maya, Mexico',
  'Roatan, Honduras',
  'Cozumel, Mexico',
  'Perfect Day at CocoCay, Bahamas',
  'Miami, Florida',
];

function normalizeDateOnly(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
}

function addCorrectionNote(notes: string | undefined, note: string): string {
  if (notes?.includes(note)) return notes;
  return notes ? `${notes}\n${note}` : note;
}

function isSymphonyMay2026Replacement(cruise: BookedCruise): boolean {
  return cruise.shipName?.toLowerCase().trim() === 'symphony of the seas'
    && normalizeDateOnly(cruise.sailDate) === '2026-05-10'
    && (!cruise.returnDate || normalizeDateOnly(cruise.returnDate) === '2026-05-17');
}

function normalizeKnownShipAlias(cruise: BookedCruise): BookedCruise {
  const rawShipName = cruise.shipName?.trim() ?? '';
  const rawShipCode = String((cruise as { shipCode?: string }).shipCode ?? '').trim().toUpperCase();
  const normalizedShipName = rawShipName.toLowerCase();
  const shouldUseStarName = rawShipCode === 'ST' || rawShipCode === 'SG' || normalizedShipName === 'st of the seas';

  if (!shouldUseStarName || rawShipName === 'Star of the Seas') {
    return cruise;
  }

  return {
    ...cruise,
    shipName: 'Star of the Seas',
    notes: addCorrectionNote(cruise.notes, 'Corrected by EasySeas: Royal Caribbean ship code ST/SG maps to Star of the Seas.'),
  };
}

/** Returns true for known bad sample/scraped booking rows that should never be treated as real bookings. */
export function isKnownInvalidBookedCruise(cruise: BookedCruise): boolean {
  const ship = cruise.shipName?.toLowerCase().trim() ?? '';
  const sailDate = normalizeDateOnly(cruise.sailDate);
  const returnDate = normalizeDateOnly(cruise.returnDate);
  const reservation = String(cruise.reservationNumber ?? cruise.bookingId ?? '').trim().toUpperCase();
  const offerCode = String(cruise.offerCode ?? '').trim().toUpperCase();
  const itinerary = cruise.itineraryName?.toLowerCase().trim() ?? '';

  const status = String(cruise.status ?? '').trim().toLowerCase();
  const isCompleted = cruise.completionState === 'completed' || status === 'completed' || status === 'past';
  const isFutureSupplementWithoutBooking = cruise.id?.startsWith('supp-') === true && !isCompleted && !reservation;
  const isBogusAllureCurrentSailing = ship === 'allure of the seas'
    && sailDate === '2026-04-29'
    && (!returnDate || returnDate === '2026-05-02')
    && (
      cruise.id === 'booked-allure-apr29'
      || reservation === 'A05-2512A07'
      || offerCode === '2512A07 / A05'
      || itinerary.includes('3 night bahamas')
    );

  return isFutureSupplementWithoutBooking || isBogusAllureCurrentSailing;
}

/** Applies known booking corrections that should be treated as authoritative in-app. */
export function applyKnownBookingCorrectionsToCruise(cruise: BookedCruise): BookedCruise {
  const normalizedCruise = normalizeKnownShipAlias(cruise);

  if (!isSymphonyMay2026Replacement(normalizedCruise)) {
    return normalizedCruise;
  }

  return {
    ...normalizedCruise,
    shipName: 'Icon of the Seas',
    sailDate: '2026-05-09',
    returnDate: '2026-05-16',
    departurePort: 'Miami, Florida',
    destination: 'Western Caribbean & Perfect Day',
    itineraryName: '7 Night Western Caribbean & Perfect Day',
    nights: 7,
    ports: ICON_MAY_2026_PORTS,
    itinerary: ICON_MAY_2026_ITINERARY,
    seaDays: 2,
    portDays: 4,
    casinoOpenDays: 7,
    notes: addCorrectionNote(normalizedCruise.notes, 'Corrected by EasySeas: Symphony of the Seas May 10-17, 2026 was replaced by Icon of the Seas May 9-16, 2026.'),
    reconciliationStatus: normalizedCruise.reconciliationStatus === 'overlap' ? 'matched' : normalizedCruise.reconciliationStatus,
  };
}

/** Applies known booking corrections to a list without mutating the input records. */
export function applyKnownBookingCorrections(cruises: BookedCruise[]): BookedCruise[] {
  return dedupeBookedCruises(
    cruises.filter((cruise) => !isKnownInvalidBookedCruise(cruise)).map(applyKnownBookingCorrectionsToCruise),
    'known booking corrections'
  );
}

export function getBookedCruiseDateRange(cruise: BookedCruise): CruiseDateRange | null {
  const sailDate = normalizeDateOnly(cruise.sailDate);
  if (!sailDate) return null;

  const start = createDateFromString(sailDate);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);

  const returnDate = normalizeDateOnly(cruise.returnDate);
  const end = returnDate ? createDateFromString(returnDate) : new Date(start);
  if (!returnDate && typeof cruise.nights === 'number' && cruise.nights > 0) {
    end.setDate(end.getDate() + cruise.nights);
  }
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(0, 0, 0, 0);

  return { start, end };
}

export function isActiveBookedCruiseForOverlap(cruise: BookedCruise): boolean {
  const status = String(cruise.status ?? '').trim().toLowerCase();
  if (['completed', 'cancelled', 'canceled', 'archived', 'replaced', 'skipped'].includes(status)) {
    return false;
  }
  if (cruise.completionState === 'completed') {
    return false;
  }
  return Boolean(getBookedCruiseDateRange(cruise));
}

function ownerKey(cruise: BookedCruise): string {
  return [cruise.ownerProfileId ?? '', cruise.sourceEmail ?? ''].map((part) => part.trim().toLowerCase()).join('|');
}

function canOverlapForSameTraveler(left: BookedCruise, right: BookedCruise): boolean {
  const leftOwner = ownerKey(left);
  const rightOwner = ownerKey(right);
  return !leftOwner.replace('|', '') || !rightOwner.replace('|', '') || leftOwner === rightOwner;
}

function formatCruiseLabel(cruise: BookedCruise): string {
  const sailDate = normalizeDateOnly(cruise.sailDate);
  const returnDate = normalizeDateOnly(cruise.returnDate);
  return `${cruise.shipName || 'Cruise'} ${sailDate}${returnDate ? `-${returnDate}` : ''}`;
}

function rangesOverlap(left: CruiseDateRange, right: CruiseDateRange): boolean {
  return left.start.getTime() < right.end.getTime() && left.end.getTime() > right.start.getTime();
}

export function findOverlappingBookedCruises(cruises: BookedCruise[]): CruiseOverlapWarning[] {
  const activeCruises = cruises.filter(isActiveBookedCruiseForOverlap);
  const warnings: CruiseOverlapWarning[] = [];

  for (let leftIndex = 0; leftIndex < activeCruises.length; leftIndex += 1) {
    const left = activeCruises[leftIndex];
    const leftRange = getBookedCruiseDateRange(left);
    if (!leftRange) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < activeCruises.length; rightIndex += 1) {
      const right = activeCruises[rightIndex];
      if (!canOverlapForSameTraveler(left, right)) continue;
      const rightRange = getBookedCruiseDateRange(right);
      if (!rightRange || !rangesOverlap(leftRange, rightRange)) continue;

      const message = `Schedule conflict: ${formatCruiseLabel(left)} overlaps ${formatCruiseLabel(right)}. Review one of these bookings before planning around both.`;
      warnings.push({ cruiseId: left.id, conflictingCruiseId: right.id, message });
      warnings.push({ cruiseId: right.id, conflictingCruiseId: left.id, message });
    }
  }

  return warnings;
}

/** Marks overlapping active bookings for review so the UI can call out conflicts instead of silently treating both as valid. */
export function annotateOverlappingCruises(cruises: BookedCruise[]): BookedCruise[] {
  const correctedCruises = applyKnownBookingCorrections(cruises);
  const warnings = findOverlappingBookedCruises(correctedCruises);
  if (warnings.length === 0) return correctedCruises;

  const warningByCruiseId = new Map<string, string>();
  warnings.forEach((warning) => {
    if (!warningByCruiseId.has(warning.cruiseId)) {
      warningByCruiseId.set(warning.cruiseId, warning.message);
    }
  });

  return correctedCruises.map((cruise) => {
    const warning = warningByCruiseId.get(cruise.id);
    if (!warning) return cruise;
    return {
      ...cruise,
      reconciliationStatus: 'overlap',
      notes: addCorrectionNote(cruise.notes, warning),
    };
  });
}
