import type { BookedCruise, Cruise, ItineraryDay } from '@/types/models';
import { createDateFromString } from '@/lib/date';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeDateOnly(value?: string | null): string {
  if (!value) return '';
  const parsed = createDateFromString(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function normalizeKey(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMaybeDate(value?: string | null): string {
  return normalizeDateOnly(value);
}

function parsePortsAndTimes(value?: string | null): ItineraryDay[] {
  if (!value || typeof value !== 'string') return [];
  const lines = value
    .split(/\r?\n|>|›|→/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => {
    const parts = line.split(/[;,|\t]/).map(part => part.trim()).filter(Boolean);
    const port = parts[0] || line;
    const arrival = parts.find(part => /arriv|\bAM\b|\bPM\b|^\d{1,2}:\d{2}/i.test(part) && !/depart/i.test(part));
    const departure = parts.find(part => /depart|sail|leave/i.test(part)) || (parts.length >= 3 ? parts[2] : undefined);
    const seaText = normalizeKey(port);
    return {
      day: index + 1,
      port,
      arrival,
      departure,
      isSeaDay: seaText.includes('at sea') || seaText.includes('sea day') || seaText.includes('marine zone'),
      notes: 'Parsed from shared Ports & Times / casino intelligence fallback source.',
    };
  }).filter(day => day.port.length > 0);
}

function hasUsefulItinerary(days: ItineraryDay[] | undefined): days is ItineraryDay[] {
  return Array.isArray(days) && days.length > 0 && days.some(day => Boolean(day.port));
}

function matchesShipAndDate(cruise: Pick<Cruise, 'shipName' | 'sailDate'>, shipNeedle: string, sailDate: string): boolean {
  return normalizeKey(cruise.shipName).includes(normalizeKey(shipNeedle)) && normalizeDateOnly(cruise.sailDate) === sailDate;
}

function starJuly52026Itinerary(): ItineraryDay[] {
  return [
    { day: 1, port: 'Port Canaveral, Florida', departure: '16:30', isSeaDay: false, notes: 'Researched/confirmed Star of the Seas 07-05-2026 itinerary.' },
    { day: 2, port: 'Perfect Day at CocoCay, Bahamas', arrival: '07:00', departure: '17:00', isSeaDay: false, notes: 'Royal private destination; EasySeas marks casino usually open in port.' },
    { day: 3, port: 'Northwest Bahamas marine zone', isSeaDay: true, notes: 'Marine/sea day.' },
    { day: 4, port: 'Charlotte Amalie, St. Thomas', arrival: '12:30', departure: '20:00', isSeaDay: false, notes: 'User-confirmed casino-open port.' },
    { day: 5, port: 'Basseterre, St. Kitts & Nevis', arrival: '08:00', departure: '17:00', isSeaDay: false, notes: 'User-confirmed casino closed while docked; reopen after sailaway.' },
    { day: 6, port: 'Western Atlantic marine zone', isSeaDay: true, notes: 'Marine/sea day.' },
    { day: 7, port: 'Western Atlantic marine zone', isSeaDay: true, notes: 'Marine/sea day.' },
    { day: 8, port: 'Port Canaveral, Florida', arrival: '06:00', isSeaDay: false, notes: 'Return port / disembarkation.' },
  ];
}

function celebrityEquinoxAugust62026Itinerary(): ItineraryDay[] {
  return [
    { day: 1, port: 'Barcelona, Spain', departure: '17:00', isSeaDay: false, notes: 'VACAYA Total Eclipse Med Cruise; departs Barcelona 5:00 PM.' },
    { day: 2, port: 'Ibiza, Spain', arrival: '11:00', isSeaDay: false, notes: 'Overnight in Ibiza; arrival 11:00 AM.' },
    { day: 3, port: 'Ibiza, Spain', departure: '09:00', isSeaDay: false, notes: 'Overnight continues; departs Ibiza 9:00 AM.' },
    { day: 4, port: 'Tangier, Morocco', arrival: '07:00', departure: '16:00', isSeaDay: false, notes: 'Port day from researched itinerary.' },
    { day: 5, port: 'Lisbon, Portugal', arrival: '10:30', departure: '21:00', isSeaDay: false, notes: 'Port day from researched itinerary.' },
    { day: 6, port: 'Porto (Leixões), Portugal', arrival: '08:30', departure: '18:00', isSeaDay: false, notes: 'Port day from researched itinerary.' },
    { day: 7, port: 'A Coruña, Spain', arrival: '08:00', departure: '17:00', isSeaDay: false, notes: 'Port day from researched itinerary; eclipse day.' },
    { day: 8, port: 'At Sea', isSeaDay: true, notes: 'Sea day.' },
    { day: 9, port: 'At Sea', isSeaDay: true, notes: 'Sea day.' },
    { day: 10, port: 'Barcelona, Spain', arrival: '05:00', isSeaDay: false, notes: 'Return port / disembarkation.' },
  ];
}

export function getKnownCruiseItineraryDays(cruise: Pick<BookedCruise, 'shipName' | 'sailDate' | 'itineraryName' | 'destination'> | Pick<Cruise, 'shipName' | 'sailDate' | 'itineraryName' | 'destination'>): ItineraryDay[] | null {
  if (matchesShipAndDate(cruise as Cruise, 'Star of the Seas', '2026-07-05')) return starJuly52026Itinerary();
  const shipKey = normalizeKey((cruise as any).shipName);
  const sailDateOnly = normalizeMaybeDate((cruise as any).sailDate);
  const itineraryKey = normalizeKey(`${(cruise as any).itineraryName || ''} ${(cruise as any).destination || ''} ${(cruise as any).departurePort || ''}`);
  if (matchesShipAndDate(cruise as Cruise, 'Celebrity Equinox', '2026-08-05') ||
      matchesShipAndDate(cruise as Cruise, 'Celebrity Equinox', '2026-08-06') ||
      (shipKey.includes('celebrity equinox') && sailDateOnly.startsWith('2026-08') && /(vacaya|total eclipse|barcelona|ibiza|lisbon|portugal|tangier)/.test(itineraryKey))) {
    return celebrityEquinoxAugust62026Itinerary();
  }
  return null;
}

export function getTrustedCruiseItineraryDays(cruise: BookedCruise | Cruise): ItineraryDay[] {
  const known = getKnownCruiseItineraryDays(cruise as BookedCruise);
  if (known) return known;
  const direct = (cruise as any).itinerary;
  if (hasUsefulItinerary(direct)) return direct;
  const parsedPortsAndTimes = parsePortsAndTimes((cruise as any).portsAndTimes || (cruise as any).portTimes || (cruise as any).ports_times);
  if (parsedPortsAndTimes.length > 0) return parsedPortsAndTimes;
  const casinoIntel = (cruise as any).casinoIntelligence || (cruise as any).casinoOpportunity || (cruise as any).casinoSchedule;
  if (hasUsefulItinerary(casinoIntel?.itineraryDays)) return casinoIntel.itineraryDays;
  if (hasUsefulItinerary(casinoIntel?.days)) return casinoIntel.days;
  const parsedCasinoPorts = parsePortsAndTimes(casinoIntel?.portsAndTimes || casinoIntel?.portAgenda);
  if (parsedCasinoPorts.length > 0) return parsedCasinoPorts;
  return [];
}
