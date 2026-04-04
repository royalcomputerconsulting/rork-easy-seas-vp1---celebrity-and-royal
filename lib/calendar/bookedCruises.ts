import type { BookedCruise } from '@/types/models';

export function mergeBookedCruiseSources(localBooked: BookedCruise[], storedBooked: BookedCruise[]): BookedCruise[] {
  const seen = new Map<string, BookedCruise>();

  const addCruise = (cruise: BookedCruise) => {
    const key = cruise.id || `${cruise.shipName}-${cruise.sailDate}-${cruise.reservationNumber || ''}`;
    if (!seen.has(key)) {
      seen.set(key, cruise);
    }
  };

  storedBooked.forEach(addCruise);
  localBooked.forEach(addCruise);

  return Array.from(seen.values());
}
