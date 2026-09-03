import type { BookedCruise, Cruise, ItineraryDay } from '@/types/models';

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sailingKey(cruise: Pick<Cruise, 'shipName' | 'sailDate'>): string {
  return `${normalized(cruise.shipName)}|${String(cruise.sailDate ?? '').trim().slice(0, 10)}`;
}

function itinerarySignature(days: ItineraryDay[]): string {
  return days
    .slice()
    .sort((left, right) => left.day - right.day)
    .map((day) => [day.day, normalized(day.port), day.arrival ?? '', day.departure ?? '', day.isSeaDay ? 'sea' : 'port'].join('~'))
    .join('|');
}

function consensusValue<T>(values: T[], signature: (value: T) => string): T | undefined {
  const material = values.filter((value) => Boolean(signature(value)));
  if (material.length === 0) return undefined;
  const bySignature = new Map<string, T>();
  material.forEach((value) => bySignature.set(signature(value), value));
  return bySignature.size === 1 ? Array.from(bySignature.values())[0] : undefined;
}

function missing(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Fills card-only voyage facts from the available catalog only when every
 * material ship/date match agrees. Conflicts remain missing instead of being
 * guessed or copied from an arbitrary casino offer row.
 */
export function enrichBookedCruisesWithCatalogFacts(
  bookedCruises: readonly BookedCruise[],
  catalogCruises: readonly Cruise[],
): BookedCruise[] {
  const catalogBySailing = new Map<string, Cruise[]>();
  catalogCruises.forEach((cruise) => {
    const key = sailingKey(cruise);
    if (!key || key === '|') return;
    catalogBySailing.set(key, [...(catalogBySailing.get(key) ?? []), cruise]);
  });

  return bookedCruises.map((booked) => {
    const matches = catalogBySailing.get(sailingKey(booked)) ?? [];
    if (matches.length === 0) return booked;

    const itinerary = consensusValue(matches.map((row) => row.itinerary ?? []).filter((days) => days.length > 0), itinerarySignature);
    const ports = consensusValue(matches.map((row) => row.ports ?? []).filter((items) => items.length > 0), (items) => items.map(normalized).join('|'));
    const itineraryRaw = consensusValue(matches.map((row) => row.itineraryRaw ?? []).filter((items) => items.length > 0), (items) => items.map(normalized).join('|'));
    const textConsensus = (selector: (row: Cruise) => unknown) => consensusValue(
      matches.map(selector).filter((value) => normalized(value)).map(String),
      normalized,
    );
    const numberConsensus = (selector: (row: Cruise) => unknown) => consensusValue(
      matches.map(selector).map(Number).filter(Number.isFinite),
      (value) => String(value),
    );

    const enriched: BookedCruise = { ...booked };
    if (missing(enriched.itinerary) && itinerary) enriched.itinerary = itinerary;
    if (missing(enriched.ports) && ports) enriched.ports = ports;
    if (missing(enriched.itineraryRaw) && itineraryRaw) enriched.itineraryRaw = itineraryRaw;
    const portsAndTimes = textConsensus((row) => row.portsAndTimes);
    const itineraryName = textConsensus((row) => row.itineraryName);
    const destination = textConsensus((row) => row.destination);
    const departurePort = textConsensus((row) => row.departurePort);
    const returnDate = textConsensus((row) => row.returnDate);
    if (missing(enriched.portsAndTimes) && portsAndTimes) enriched.portsAndTimes = portsAndTimes;
    if (missing(enriched.itineraryName) && itineraryName) enriched.itineraryName = itineraryName;
    if (missing(enriched.destination) && destination) enriched.destination = destination;
    if (missing(enriched.departurePort) && departurePort) enriched.departurePort = departurePort;
    if (missing(enriched.returnDate) && returnDate) enriched.returnDate = returnDate;
    if (missing(enriched.nights)) enriched.nights = numberConsensus((row) => row.nights) ?? enriched.nights;
    if (missing(enriched.seaDays)) enriched.seaDays = numberConsensus((row) => row.seaDays);
    if (missing(enriched.portDays)) enriched.portDays = numberConsensus((row) => row.portDays);

    if (enriched !== booked && (itinerary || ports || itineraryRaw)) {
      enriched.dataConfidence = enriched.dataConfidence ?? 'enriched';
      enriched.sourceProvider = enriched.sourceProvider ?? 'matching catalog ship/date consensus';
    }
    return enriched;
  });
}
