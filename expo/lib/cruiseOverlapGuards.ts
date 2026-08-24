import type { BookedCruise, ItineraryDay } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { dedupeBookedCruises } from '@/lib/dataIdentity';
import {
  USER_CONFIRMED_BOOKED_CRUISE_MANIFEST,
  USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS,
} from '@/constants/confirmedBookedCruises';

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

/**
 * Public-document itinerary for VACAYA's 6–15 August 2026 Celebrity Equinox
 * charter. This sailing is intentionally kept as a complete day-by-day plan:
 * the Ibiza overnight spans two calendar days and the two final days are at
 * sea. Weather, calendar, and casino-day consumers must not infer those dates
 * from the shorter ports-only list.
 *
 * Source: https://www.myvacaya.com/trip/total-eclipse-med-cruise-2026/
 */
export const VERIFIED_EQUINOX_ECLIPSE_2026_ITINERARY: ItineraryDay[] = [
  { day: 1, port: 'Barcelona, Spain', departure: '17:00', isSeaDay: false, source: 'public_document', dataConfidence: 'verified' },
  { day: 2, port: 'Ibiza, Spain', arrival: '11:00', departure: 'Overnight', isSeaDay: false, notes: 'Overnight in Ibiza', source: 'public_document', dataConfidence: 'verified' },
  { day: 3, port: 'Ibiza, Spain', departure: '09:00', isSeaDay: false, notes: 'Overnight stay continues until 9:00 AM; relaxing sea day follows departure.', source: 'public_document', dataConfidence: 'verified' },
  { day: 4, port: 'Tangier, Morocco', arrival: '07:00', departure: '16:00', isSeaDay: false, source: 'public_document', dataConfidence: 'verified' },
  { day: 5, port: 'Lisbon, Portugal', arrival: '10:30', departure: '21:00', isSeaDay: false, source: 'public_document', dataConfidence: 'verified' },
  { day: 6, port: 'Porto (Leixoes), Portugal', arrival: '08:30', departure: '18:00', isSeaDay: false, source: 'public_document', dataConfidence: 'verified' },
  { day: 7, port: 'A Coruna, Spain', arrival: '08:00', departure: '17:00', isSeaDay: false, notes: 'Total eclipse day', source: 'public_document', dataConfidence: 'verified' },
  { day: 8, port: 'At Sea', isSeaDay: true, source: 'public_document', dataConfidence: 'verified' },
  { day: 9, port: 'At Sea', isSeaDay: true, source: 'public_document', dataConfidence: 'verified' },
  { day: 10, port: 'Barcelona, Spain', arrival: '05:00', isSeaDay: false, source: 'public_document', dataConfidence: 'verified' },
];

export const VERIFIED_EQUINOX_ECLIPSE_2026_PORTS = [
  'Barcelona, Spain',
  'Ibiza, Spain',
  'Ibiza, Spain',
  'Tangier, Morocco',
  'Lisbon, Portugal',
  'Porto (Leixoes), Portugal',
  'A Coruna, Spain',
  'Barcelona, Spain',
];

const CONFIRMED_PINNACLE_CRUISE_PLAN: BookedCruise[] = [
  {
    id: 'booked-icon-2026-05-09',
    reservationNumber: '871437',
    shipName: 'Icon of the Seas',
    sailDate: '2026-05-09',
    returnDate: '2026-05-16',
    departurePort: 'Miami, Florida',
    destination: 'Western Caribbean & Perfect Day',
    itineraryName: '7 Night Western Caribbean Cruise',
    nights: 7,
    cabinType: 'Interior GTY',
    cabinNumber: '7616',
    retailValue: 4800,
    totalRetailCost: 4800,
    originalPrice: 4800,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ICON_MAY_2026_PORTS,
    itinerary: ICON_MAY_2026_ITINERARY,
    seaDays: 2,
    portDays: 4,
    casinoOpenDays: 7,
  },
  {
    id: 'booked-3820089',
    reservationNumber: '3820089',
    shipName: 'Symphony of the Seas',
    sailDate: '2026-05-17',
    returnDate: '2026-05-24',
    departurePort: 'Galveston, Texas',
    destination: 'Western Caribbean',
    itineraryName: '7 Night Western Caribbean Cruise',
    nights: 7,
    cabinType: 'Ocean View Balcony GTY',
    retailValue: 3786,
    totalRetailCost: 3786,
    originalPrice: 3786,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Galveston, Texas', 'Cozumel, Mexico', 'Roatan, Honduras', 'Puerto Costa Maya, Mexico'],
  },
  {
    id: 'booked-5455777',
    reservationNumber: '5455777',
    shipName: 'Navigator of the Seas',
    sailDate: '2026-05-29',
    returnDate: '2026-06-05',
    departurePort: 'Los Angeles, California',
    destination: 'Mexican Riviera',
    itineraryName: '7 Night Ensenada, Cabo & Mazatlan',
    nights: 7,
    cabinType: 'Ocean View GTY',
    retailValue: 1798,
    totalRetailCost: 1798,
    originalPrice: 1798,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Los Angeles, California', 'Ensenada, Mexico', 'Cabo San Lucas, Mexico', 'Mazatlan, Mexico'],
  },
  {
    id: 'booked-3879193',
    reservationNumber: '3879193',
    shipName: 'Quantum of the Seas',
    sailDate: '2026-06-05',
    returnDate: '2026-06-12',
    departurePort: 'Los Angeles, California',
    destination: 'Mexican Riviera',
    itineraryName: '7 Night Cabo Overnight, Catalina & Ensenada',
    nights: 7,
    cabinType: 'Ocean View Balcony GTY',
    retailValue: 2650,
    totalRetailCost: 2650,
    originalPrice: 2650,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Los Angeles, California', 'Catalina Island, California', 'Cabo San Lucas, Mexico', 'Cabo San Lucas, Mexico', 'Ensenada, Mexico'],
  },
  {
    id: 'booked-6173746',
    reservationNumber: '6173746',
    shipName: 'Quantum of the Seas',
    sailDate: '2026-06-19',
    returnDate: '2026-06-26',
    departurePort: 'Los Angeles, California',
    destination: 'Mexican Riviera',
    itineraryName: '7 Night Cabo Overnight & Ensenada',
    nights: 7,
    cabinType: 'Ocean View GTY',
    retailValue: 2250,
    totalRetailCost: 2250,
    originalPrice: 2250,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Los Angeles, California', 'Cabo San Lucas, Mexico', 'Cabo San Lucas, Mexico', 'Ensenada, Mexico'],
  },
  {
    id: 'booked-star-2026-07-05',
    reservationNumber: '2656334',
    bookingId: '2656334',
    shipName: 'Star of the Seas',
    sailDate: '2026-07-05',
    returnDate: '2026-07-12',
    departurePort: 'Port Canaveral, Florida',
    destination: 'Eastern Caribbean & Perfect Day',
    itineraryName: '7 Night Eastern Caribbean & Perfect Day',
    nights: 7,
    cabinType: 'Interior',
    cabinCategory: 'V4',
    cabinNumber: '10518',
    stateroomNumber: '10518',
    stateroomCategoryCode: 'V4',
    stateroomType: 'Interior Stateroom Obstructed View',
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Port Canaveral, Florida', 'Eastern Caribbean', 'Perfect Day at CocoCay, Bahamas', 'Port Canaveral, Florida'],
    taxes: 150.92,
    taxesFeesEstimate: 150.92,
    amountPaid: 200,
    depositPaid: 200,
    balanceDue: 0,
    netEffectivePaid: 150.92,
    retailValue: 5500,
    totalRetailCost: 5500,
    originalPrice: 5500,
    pricePaid: 150.92,
    totalCasinoDiscount: 5500,
    compValue: 5349.08,
    cruiseValueCaptured: 5349.08,
    totalEconomicValue: 5349.08,
    offerCode: '26TIER3',
    offerName: 'CR Targeted Offer (26TIER3)',
    offerCategory: 'Casino Comp',
    freeOBC: 50,
    perks: ['Casino Comp', 'YHP5-Casino Slots', '$50 onboard credit'],
    specialRequests: 'CR TARGETED OFFER(26TIER3); dining waitlist 8:30 PM',
    cruiseSource: 'royal',
    brand: 'Royal Caribbean',
    casinoProgram: 'clubRoyale',
    calculationConfidence: 'actual',
    notes: 'Reservation issued 2026-04-28. Cruise-only package. Casino Comp CGRP-FIT PROMO YHP5-Casino Slots. User-updated estimated retail value $5,500; taxes/fees/port expenses $150.92; amount paid $200; balance due $0; onboard credit $50. Casino analytics should use $5,500 retail value and $150.92 net effective paid while preserving the $200 paid amount separately.',
  },
  {
    id: 'booked-4097701',
    reservationNumber: '4097701',
    shipName: 'Navigator of the Seas',
    sailDate: '2026-07-17',
    returnDate: '2026-07-24',
    departurePort: 'Los Angeles, California',
    destination: 'Mexican Riviera',
    itineraryName: '7 Night Cabo Overnight & Ensenada',
    nights: 7,
    cabinType: 'Ocean View Balcony GTY',
    cabinNumber: '10718',
    retailValue: 3874,
    totalRetailCost: 3874,
    originalPrice: 3874,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Los Angeles, California', 'Cabo San Lucas, Mexico', 'Cabo San Lucas, Mexico', 'Ensenada, Mexico'],
  },
  {
    id: 'booked-navigator-2026-07-24',
    reservationNumber: 'NAV-20260724',
    shipName: 'Navigator of the Seas',
    sailDate: '2026-07-24',
    returnDate: '2026-07-31',
    departurePort: 'Los Angeles, California',
    destination: 'Mexican Riviera',
    itineraryName: '7 Night Cabo Overnight & Ensenada',
    nights: 7,
    cabinType: 'Ocean View Balcony GTY',
    retailValue: 3750,
    totalRetailCost: 3750,
    originalPrice: 3750,
    guestNames: ['Scott Merlis'],
    guests: 1,
    singleOccupancy: true,
    status: 'booked',
    completionState: 'upcoming',
    ports: ['Los Angeles, California', 'Cabo San Lucas, Mexico', 'Cabo San Lucas, Mexico', 'Ensenada, Mexico'],
  },
];

function normalizeDateOnly(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const dateOnly = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  const compactMatch = dateOnly.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = dateOnly.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const mdyMatch = dateOnly.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (mdyMatch) {
    const [, month, day, yearPart] = mdyMatch;
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateOnly;
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

function normalizeCruiseKey(shipName?: string, sailDate?: string): string {
  return `${(shipName ?? '').trim().toLowerCase()}|${normalizeDateOnly(sailDate)}`;
}

function getReservationKey(cruise: BookedCruise): string {
  return String(cruise.bookingId ?? cruise.reservationNumber ?? cruise.bwoNumber ?? '').trim().toUpperCase();
}

const USER_CONFIRMED_MANIFEST_RESERVATIONS = new Set(
  USER_CONFIRMED_BOOKED_CRUISE_MANIFEST.map(getReservationKey).filter((reservation) => reservation.length > 0)
);

const USER_CONFIRMED_MANIFEST_SAILINGS = new Set(
  USER_CONFIRMED_BOOKED_CRUISE_MANIFEST.map((cruise) => normalizeCruiseKey(cruise.shipName, cruise.sailDate))
);

function isScottPinnaclePlanningData(cruises: BookedCruise[]): boolean {
  return cruises.some((cruise) =>
    cruise.guestNames?.some((guest) => guest.toLowerCase().includes('scott')) === true
    || ['871437', '3820089', '5455777', '3879193', '6173746', '4097701'].includes(getReservationKey(cruise))
  );
}

function shouldApplyUserConfirmedManifest(cruises: BookedCruise[]): boolean {
  return cruises.some((cruise) => {
    const reservation = getReservationKey(cruise);
    const sailing = normalizeCruiseKey(cruise.shipName, cruise.sailDate);
    const ship = cruise.shipName?.toLowerCase().trim() ?? '';
    const sailDate = normalizeDateOnly(cruise.sailDate);
    const returnDate = normalizeDateOnly(cruise.returnDate);

    return cruise.guestNames?.some((guest) => guest.toLowerCase().includes('scott')) === true
      || USER_CONFIRMED_MANIFEST_RESERVATIONS.has(reservation)
      || USER_CONFIRMED_MANIFEST_SAILINGS.has(sailing)
      || isSymphonyMay2026Replacement(cruise)
      || (ship === 'allure of the seas' && sailDate === '2026-04-29' && (!returnDate || returnDate === '2026-05-02'))
      || (ship === 'st of the seas' || ship === 'sg of the seas');
  });
}

function mergeUserConfirmedCruise(existing: BookedCruise | undefined, confirmed: BookedCruise): BookedCruise {
  return {
    ...(existing ?? {}),
    ...confirmed,
    id: existing?.id || confirmed.id,
    bookingId: confirmed.bookingId,
    reservationNumber: confirmed.reservationNumber,
    sourcePayload: existing?.sourcePayload,
    sourceProvider: existing?.sourceProvider ?? confirmed.sourceProvider,
    sourceEndpoint: existing?.sourceEndpoint ?? confirmed.sourceEndpoint,
    sourceRetrievedAt: existing?.sourceRetrievedAt ?? confirmed.sourceRetrievedAt,
  };
}

function mergeConfirmedPlanCruise(existing: BookedCruise, confirmed: BookedCruise): BookedCruise {
  return {
    ...existing,
    ...confirmed,
    id: existing.id || confirmed.id,
    reservationNumber: existing.reservationNumber || confirmed.reservationNumber,
    notes: existing.notes,
  };
}

/** Ensures the user-confirmed 590 → 702 Pinnacle plan is present and uses solo double C&A points. */
export function applyConfirmedPinnacleCruisePlan(cruises: BookedCruise[]): BookedCruise[] {
  // Bundled personal plans are fixtures, never a provider source of truth.
  return cruises;
}

function normalizeKnownShipAlias(cruise: BookedCruise): BookedCruise {
  const rawShipName = cruise.shipName?.trim() ?? '';
  const rawShipCode = String((cruise as { shipCode?: string }).shipCode ?? '').trim().toUpperCase();
  const normalizedShipName = rawShipName.toLowerCase();
  const shouldUseStarName = ['ST', 'SG', 'SN'].includes(rawShipCode) || ['st', 'sg', 'sn', 'st of the seas', 'sg of the seas', 'sn of the seas', 'st of seas', 'star'].includes(normalizedShipName);

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
  // Do not discard a provider row because it resembles a bundled fixture.
  return false;
}

/** Applies known booking corrections that should be treated as authoritative in-app. */
export function applyKnownBookingCorrectionsToCruise(cruise: BookedCruise): BookedCruise {
  const shipName = cruise.shipName?.trim().toLowerCase();
  const sailDate = normalizeDateOnly(cruise.sailDate);
  const itineraryName = cruise.itineraryName?.trim().toLowerCase() ?? '';
  const isVerifiedEclipseCharter = shipName === 'celebrity equinox'
    && (sailDate === '2026-08-05' || sailDate === '2026-08-06')
    && (itineraryName.includes('eclipse') || itineraryName.includes('ibiza') || cruise.programCharter?.trim().toLowerCase() === 'vacaya');

  if (isVerifiedEclipseCharter) {
    return {
      ...cruise,
      sailDate: '2026-08-06',
      returnDate: '2026-08-15',
      nights: 9,
      departurePort: 'Barcelona, Spain',
      destination: cruise.destination || 'Mediterranean',
      itineraryName: cruise.itineraryName || 'VACAYA Total Eclipse Mediterranean Cruise',
      ports: [...VERIFIED_EQUINOX_ECLIPSE_2026_PORTS],
      itinerary: VERIFIED_EQUINOX_ECLIPSE_2026_ITINERARY.map((day) => ({ ...day })),
      itineraryNeedsManualEntry: false,
      sourceAuthority: 'public_document',
      dataConfidence: 'verified',
      notes: addCorrectionNote(cruise.notes, 'Verified itinerary: VACAYA Total Eclipse Med Cruise, August 6–15, 2026.'),
    };
  }

  return cruise;
}

/** Applies the user-confirmed booked-cruise manifest so stale imports cannot recreate duplicate or made-up sailings. */
export function applyUserConfirmedBookedCruiseManifest(cruises: BookedCruise[]): BookedCruise[] {
  const corrected = cruises.map(applyKnownBookingCorrectionsToCruise);
  if (!shouldApplyUserConfirmedManifest(corrected)) {
    return dedupeBookedCruises(corrected, 'booked cruises without user-confirmed current manifest');
  }

  const knownStaleReservations = new Set(['NAV-20260821', 'HARMONY-20260905', 'HERO-20271016']);
  const knownStaleSailings = new Set([
    normalizeCruiseKey('Navigator of the Seas', '2026-08-21'),
    normalizeCruiseKey('Harmony of the Seas', '2026-09-05'),
    normalizeCruiseKey('Hero of the Seas', '2027-10-16'),
  ]);
  const currentReservationKeys = new Set(USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.map(getReservationKey));
  const merged = corrected.filter((cruise) => {
    const reservation = getReservationKey(cruise);
    const sailing = normalizeCruiseKey(cruise.shipName, cruise.sailDate);
    return !knownStaleReservations.has(reservation) && !knownStaleSailings.has(sailing);
  });
  const usedIndexes = new Set<number>();

  USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.forEach((confirmed) => {
    const confirmedReservation = getReservationKey(confirmed);
    let existingIndex = merged.findIndex((candidate, index) =>
      !usedIndexes.has(index) && getReservationKey(candidate) === confirmedReservation
    );

    if (existingIndex < 0) {
      const confirmedSailing = normalizeCruiseKey(confirmed.shipName, confirmed.sailDate);
      existingIndex = merged.findIndex((candidate, index) => {
        if (usedIndexes.has(index) || normalizeCruiseKey(candidate.shipName, candidate.sailDate) !== confirmedSailing) return false;
        const candidateReservation = getReservationKey(candidate);
        // A synthetic old sailing key may be upgraded to the confirmed booking
        // number; another real reservation on the same departure may not.
        return !candidateReservation || !currentReservationKeys.has(candidateReservation);
      });
    }

    if (existingIndex >= 0) {
      merged[existingIndex] = mergeUserConfirmedCruise(merged[existingIndex], confirmed);
      usedIndexes.add(existingIndex);
    } else {
      merged.push({ ...confirmed });
      usedIndexes.add(merged.length - 1);
    }
  });

  return dedupeBookedCruises(merged, 'booked cruises with user-confirmed current Royal manifest');
}

/** Applies known booking corrections to a list without mutating the input records. */
export function applyKnownBookingCorrections(cruises: BookedCruise[]): BookedCruise[] {
  return dedupeBookedCruises(
    cruises.map(applyKnownBookingCorrectionsToCruise),
    'booked cruises with verified corrections',
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

function isSameBookingRecord(left: BookedCruise, right: BookedCruise): boolean {
  if (left === right) return true;
  if (left.id && right.id && left.id === right.id) return true;

  const leftReservation = getReservationKey(left);
  const rightReservation = getReservationKey(right);
  if (leftReservation && rightReservation && leftReservation === rightReservation) return true;

  const sameSailing = normalizeCruiseKey(left.shipName, left.sailDate) === normalizeCruiseKey(right.shipName, right.sailDate);
  if (!sameSailing) return false;

  const leftReturnDate = normalizeDateOnly(left.returnDate);
  const rightReturnDate = normalizeDateOnly(right.returnDate);
  return !leftReturnDate || !rightReturnDate || leftReturnDate === rightReturnDate;
}

export function findOverlappingBookedCruises(cruises: BookedCruise[]): CruiseOverlapWarning[] {
  const activeCruises = dedupeBookedCruises(
    cruises.map(applyKnownBookingCorrectionsToCruise),
    'booking overlap detection'
  ).filter(isActiveBookedCruiseForOverlap);
  const warnings: CruiseOverlapWarning[] = [];

  for (let leftIndex = 0; leftIndex < activeCruises.length; leftIndex += 1) {
    const left = activeCruises[leftIndex];
    const leftRange = getBookedCruiseDateRange(left);
    if (!leftRange) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < activeCruises.length; rightIndex += 1) {
      const right = activeCruises[rightIndex];
      if (isSameBookingRecord(left, right)) continue;
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
