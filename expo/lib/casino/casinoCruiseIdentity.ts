import type { BookedCruise } from '@/types/models';

export type CasinoCruiseMatchSource = 'reservation' | 'booking' | 'owner-ship-date' | 'ship-date' | 'cruise-id';

const clean = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const dateKey = (value: unknown): string => String(value ?? '').slice(0, 10);

export interface CasinoCruiseIdentity {
  ownerProfileId?: string;
  sourceEmail?: string;
  reservationNumber?: string;
  bookingId?: string;
  shipName: string;
  sailDate: string;
  matchKey: string;
  matchSource: CasinoCruiseMatchSource;
}

/**
 * Stable casino cruise identity. Reservation/booking IDs win. If those are
 * missing, owner + normalized ship + sailing date is the only cross-record
 * fallback allowed to avoid merging unrelated guests or duplicate offer names.
 */
export function buildCasinoCruiseIdentity(cruise: BookedCruise): CasinoCruiseIdentity {
  const reservation = clean(cruise.reservationNumber);
  if (reservation) {
    return {
      ownerProfileId: cruise.ownerProfileId,
      sourceEmail: cruise.sourceEmail,
      reservationNumber: cruise.reservationNumber,
      bookingId: cruise.bookingId,
      shipName: cruise.shipName || 'Unknown ship',
      sailDate: dateKey(cruise.sailDate),
      matchKey: `reservation:${reservation}`,
      matchSource: 'reservation',
    };
  }

  const booking = clean(cruise.bookingId);
  if (booking) {
    return {
      ownerProfileId: cruise.ownerProfileId,
      sourceEmail: cruise.sourceEmail,
      reservationNumber: cruise.reservationNumber,
      bookingId: cruise.bookingId,
      shipName: cruise.shipName || 'Unknown ship',
      sailDate: dateKey(cruise.sailDate),
      matchKey: `booking:${booking}`,
      matchSource: 'booking',
    };
  }

  const owner = clean(cruise.ownerProfileId ?? cruise.sourceEmail);
  const ship = clean(cruise.shipName);
  const sailing = dateKey(cruise.sailDate);
  if (owner && ship && sailing) {
    return {
      ownerProfileId: cruise.ownerProfileId,
      sourceEmail: cruise.sourceEmail,
      reservationNumber: cruise.reservationNumber,
      bookingId: cruise.bookingId,
      shipName: cruise.shipName || 'Unknown ship',
      sailDate: sailing,
      matchKey: `owner-ship-date:${owner}:${ship}:${sailing}`,
      matchSource: 'owner-ship-date',
    };
  }

  if (ship && sailing) {
    return {
      ownerProfileId: cruise.ownerProfileId,
      sourceEmail: cruise.sourceEmail,
      reservationNumber: cruise.reservationNumber,
      bookingId: cruise.bookingId,
      shipName: cruise.shipName || 'Unknown ship',
      sailDate: sailing,
      matchKey: `ship-date:${ship}:${sailing}`,
      matchSource: 'ship-date',
    };
  }

  return {
    ownerProfileId: cruise.ownerProfileId,
    sourceEmail: cruise.sourceEmail,
    reservationNumber: cruise.reservationNumber,
    bookingId: cruise.bookingId,
    shipName: cruise.shipName || 'Unknown ship',
    sailDate: sailing,
    matchKey: `cruise-id:${clean(cruise.id)}`,
    matchSource: 'cruise-id',
  };
}
