import { toCruiseDateOnly } from '../cruiseDayPipeline';

export interface VoyageWeatherCandidate {
  id: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
}

function normalizedShip(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function physicalVoyageKey(voyage: VoyageWeatherCandidate): string {
  return `${normalizedShip(voyage.shipName)}|${toCruiseDateOnly(voyage.sailDate) ?? ''}|${toCruiseDateOnly(voyage.returnDate) ?? ''}`;
}

/**
 * Selects the physical sailing that owns the chosen day plus every directly
 * connected same-ship leg. A same-day turnaround belongs to both adjacent
 * legs, so neither half of a back-to-back block disappears from Day Agenda.
 */
export function selectVoyageWeatherBlock<T extends VoyageWeatherCandidate>(
  voyages: T[],
  selectedDate: string,
): T[] {
  const dateKey = toCruiseDateOnly(selectedDate);
  if (!dateKey) return [];

  const unique = new Map<string, T>();
  voyages.forEach((voyage) => {
    const sailDate = toCruiseDateOnly(voyage.sailDate);
    const returnDate = toCruiseDateOnly(voyage.returnDate);
    if (!sailDate || !returnDate || returnDate < sailDate) return;
    const key = physicalVoyageKey(voyage);
    if (!unique.has(key)) unique.set(key, { ...voyage, sailDate, returnDate });
  });

  const ordered = [...unique.values()].sort((left, right) => (
    left.sailDate.localeCompare(right.sailDate)
    || left.returnDate.localeCompare(right.returnDate)
    || left.shipName.localeCompare(right.shipName)
  ));
  if (ordered.length === 0) return [];

  const activeIndexes = ordered
    .map((voyage, index) => ({ voyage, index }))
    .filter(({ voyage }) => voyage.sailDate <= dateKey && voyage.returnDate >= dateKey)
    .map(({ index }) => index);
  const anchorIndex = activeIndexes[0]
    ?? ordered.findIndex((voyage) => voyage.sailDate >= dateKey);
  const resolvedAnchorIndex = anchorIndex >= 0 ? anchorIndex : ordered.length - 1;
  const anchorShip = normalizedShip(ordered[resolvedAnchorIndex].shipName);

  let first = resolvedAnchorIndex;
  while (first > 0) {
    const previous = ordered[first - 1];
    const current = ordered[first];
    if (normalizedShip(previous.shipName) !== anchorShip || previous.returnDate !== current.sailDate) break;
    first -= 1;
  }

  let last = resolvedAnchorIndex;
  while (last < ordered.length - 1) {
    const current = ordered[last];
    const next = ordered[last + 1];
    if (normalizedShip(next.shipName) !== anchorShip || current.returnDate !== next.sailDate) break;
    last += 1;
  }

  return ordered.slice(first, last + 1);
}

/**
 * Day Agenda presents one forecast surface at a time. On turnaround days the
 * newly departing leg owns the screen; otherwise the sailing containing the
 * selected date wins, followed by the nearest leg supplied by the block
 * selector. The full block is still prefetched and remains available as the
 * user moves between agenda days.
 */
export function selectPrimaryVoyageWeather<T extends VoyageWeatherCandidate>(
  voyages: T[],
  selectedDate: string,
): T | undefined {
  const dateKey = toCruiseDateOnly(selectedDate);
  if (!dateKey || voyages.length === 0) return undefined;

  return voyages.find((voyage) => toCruiseDateOnly(voyage.sailDate) === dateKey)
    ?? voyages.find((voyage) => {
      const sailDate = toCruiseDateOnly(voyage.sailDate);
      const returnDate = toCruiseDateOnly(voyage.returnDate);
      return Boolean(sailDate && returnDate && sailDate <= dateKey && returnDate >= dateKey);
    })
    ?? voyages[0];
}
