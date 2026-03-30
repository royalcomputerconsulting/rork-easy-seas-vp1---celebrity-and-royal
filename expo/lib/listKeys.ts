import type { BookedCruise, Cruise } from '@/types/models';

type KeyPart = string | number | null | undefined;

type CruiseIdentitySource = Pick<Cruise, 'id' | 'shipName' | 'sailDate' | 'returnDate' | 'offerCode'> &
  Partial<Pick<BookedCruise, 'reservationNumber' | 'bookingId' | 'cabinNumber' | 'stateroomNumber'>>;

function normalizeKeyPart(value: KeyPart): string {
  const text = `${value ?? ''}`.trim();
  return text.length > 0 ? text : 'na';
}

export function createCompositeKey(parts: KeyPart[]): string {
  return parts.map(normalizeKeyPart).join('::');
}

export function createIndexedKey(parts: KeyPart[], index: number): string {
  return `${createCompositeKey(parts)}::${index}`;
}

export function createCruiseIdentityKey(cruise: CruiseIdentitySource): string {
  return createCompositeKey([
    'cruise',
    cruise.id,
    cruise.sailDate,
    cruise.returnDate,
    cruise.shipName,
    cruise.offerCode,
    cruise.reservationNumber,
    cruise.bookingId,
    cruise.cabinNumber,
    cruise.stateroomNumber,
  ]);
}

export function createCruiseListKey(cruise: CruiseIdentitySource, index: number): string {
  return createIndexedKey([
    createCruiseIdentityKey(cruise),
  ], index);
}

export function dedupeCruisesByIdentity<T extends CruiseIdentitySource>(cruises: T[]): T[] {
  const seenCruiseKeys = new Set<string>();

  return cruises.filter((cruise) => {
    const cruiseKey = createCruiseIdentityKey(cruise);
    if (seenCruiseKeys.has(cruiseKey)) {
      return false;
    }
    seenCruiseKeys.add(cruiseKey);
    return true;
  });
}
