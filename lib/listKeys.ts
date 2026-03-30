import type { BookedCruise, Cruise } from '@/types/models';

function getDefinedFieldCount(record: Cruise | BookedCruise): number {
  return Object.values(record).filter((value) => value !== undefined && value !== null && value !== '').length;
}

function buildCruiseIdentity(cruise: Cruise | BookedCruise, index?: number): string {
  const bookedCruise = cruise as BookedCruise;
  return [
    cruise.id,
    bookedCruise.bookingId,
    bookedCruise.reservationNumber,
    cruise.offerCode,
    cruise.shipName,
    cruise.sailDate,
    cruise.returnDate,
    cruise.cabinType,
    typeof index === 'number' ? `${index}` : undefined,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value).trim().toLowerCase())
    .join('::');
}

export function createCruiseListKey(cruise: Cruise | BookedCruise, index: number): string {
  return buildCruiseIdentity(cruise, index);
}

export function dedupeCruisesByIdentity<T extends Cruise | BookedCruise>(cruises: T[]): T[] {
  const deduped = new Map<string, T>();

  cruises.forEach((cruise, index) => {
    const key = buildCruiseIdentity(cruise, index);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, cruise);
      return;
    }

    const existingFieldCount = getDefinedFieldCount(existing);
    const nextFieldCount = getDefinedFieldCount(cruise);

    if (nextFieldCount >= existingFieldCount) {
      deduped.set(key, cruise);
    }
  });

  return Array.from(deduped.values());
}
