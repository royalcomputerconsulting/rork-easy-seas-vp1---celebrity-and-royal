import type { BookedCruise } from '@/types/models';

export function getBookedCruiseMergeKey(cruise: BookedCruise): string {
  return [
    cruise.id,
    cruise.reservationNumber,
    cruise.bookingId,
    cruise.shipName,
    cruise.sailDate,
    cruise.returnDate,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('::');
}

function getBookedCruiseCompletenessScore(cruise: BookedCruise): number {
  return Object.values(cruise).reduce<number>((score, value) => {
    if (Array.isArray(value)) {
      return score + (value.length > 0 ? 2 : 0);
    }

    if (typeof value === 'number') {
      return score + (Number.isFinite(value) ? 1 : 0);
    }

    if (typeof value === 'boolean') {
      return score + 1;
    }

    if (typeof value === 'string') {
      return score + (value.trim().length > 0 ? 1 : 0);
    }

    return score;
  }, 0);
}

export function mergeBookedCruiseSources(primaryCruises: BookedCruise[], secondaryCruises: BookedCruise[]): BookedCruise[] {
  const mergedCruises = new Map<string, BookedCruise>();

  [...primaryCruises, ...secondaryCruises].forEach((cruise) => {
    const mergeKey = getBookedCruiseMergeKey(cruise);
    if (!mergeKey) {
      return;
    }

    const existingCruise = mergedCruises.get(mergeKey);
    if (!existingCruise) {
      mergedCruises.set(mergeKey, cruise);
      return;
    }

    const existingScore = getBookedCruiseCompletenessScore(existingCruise);
    const nextScore = getBookedCruiseCompletenessScore(cruise);
    mergedCruises.set(
      mergeKey,
      nextScore >= existingScore
        ? { ...existingCruise, ...cruise }
        : { ...cruise, ...existingCruise },
    );
  });

  return Array.from(mergedCruises.values());
}
