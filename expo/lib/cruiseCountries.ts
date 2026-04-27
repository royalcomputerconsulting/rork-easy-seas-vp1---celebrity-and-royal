import type { BookedCruise, ItineraryDay } from '@/types/models';
import { createDateFromString } from '@/lib/date';

export type CruiseCountryFilter = 'all' | 'upcoming' | 'completed';

export interface CountryVisit {
  id: string;
  cruiseId: string;
  cruiseName: string;
  shipName: string;
  port: string;
  country: string;
  date: string;
  year: number;
  isCompleted: boolean;
}

export interface CountryYearSummary {
  year: number;
  countries: string[];
  ports: string[];
  visits: CountryVisit[];
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  'new jersey': 'United States',
  nj: 'United States',
  'ny metro': 'United States',
  california: 'United States',
  ca: 'United States',
  florida: 'United States',
  fl: 'United States',
  texas: 'United States',
  tx: 'United States',
  washington: 'United States',
  wa: 'United States',
  alaska: 'United States',
  ak: 'United States',
  hawaii: 'United States',
  hi: 'United States',
  massachusetts: 'United States',
  ma: 'United States',
  maine: 'United States',
  me: 'United States',
  oregon: 'United States',
  or: 'United States',
  'puerto rico': 'Puerto Rico',
  'st. thomas': 'U.S. Virgin Islands',
  'st thomas': 'U.S. Virgin Islands',
  'u.s. virgin islands': 'U.S. Virgin Islands',
  'us virgin islands': 'U.S. Virgin Islands',
  usvi: 'U.S. Virgin Islands',
  'st. maarten': 'Sint Maarten',
  'st maarten': 'Sint Maarten',
  'st. martin': 'Sint Maarten',
  'st martin': 'Sint Maarten',
  'sint maarten': 'Sint Maarten',
  antigua: 'Antigua and Barbuda',
  'antigua and barbuda': 'Antigua and Barbuda',
  barbados: 'Barbados',
  'st. lucia': 'Saint Lucia',
  'st lucia': 'Saint Lucia',
  'saint lucia': 'Saint Lucia',
  bahamas: 'Bahamas',
  mexico: 'Mexico',
  honduras: 'Honduras',
  jamaica: 'Jamaica',
  belize: 'Belize',
  canada: 'Canada',
  'british columbia': 'Canada',
  bc: 'Canada',
  'new brunswick': 'Canada',
  'nova scotia': 'Canada',
  aruba: 'Aruba',
  curaçao: 'Curaçao',
  curacao: 'Curaçao',
  bonaire: 'Bonaire',
  bermuda: 'Bermuda',
  'cayman islands': 'Cayman Islands',
  'grand cayman': 'Cayman Islands',
  cayman: 'Cayman Islands',
  grenada: 'Grenada',
  dominica: 'Dominica',
  martinique: 'Martinique',
  guadeloupe: 'Guadeloupe',
  panama: 'Panama',
  colombia: 'Colombia',
  'dominican republic': 'Dominican Republic',
  'st. kitts': 'Saint Kitts and Nevis',
  'st kitts': 'Saint Kitts and Nevis',
  'saint kitts': 'Saint Kitts and Nevis',
  'saint kitts and nevis': 'Saint Kitts and Nevis',
  'british virgin islands': 'British Virgin Islands',
  bvi: 'British Virgin Islands',
  spain: 'Spain',
  italy: 'Italy',
  france: 'France',
  greece: 'Greece',
  portugal: 'Portugal',
  netherlands: 'Netherlands',
  germany: 'Germany',
  norway: 'Norway',
  denmark: 'Denmark',
  sweden: 'Sweden',
  finland: 'Finland',
  iceland: 'Iceland',
  ireland: 'Ireland',
  'united kingdom': 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
};

const PORT_COUNTRY_LOOKUP: Record<string, string> = {
  'perfect day at cococay': 'Bahamas',
  cococay: 'Bahamas',
  'coco cay': 'Bahamas',
  nassau: 'Bahamas',
  bimini: 'Bahamas',
  'cabo san lucas': 'Mexico',
  ensenada: 'Mexico',
  mazatlan: 'Mexico',
  'puerto vallarta': 'Mexico',
  cozumel: 'Mexico',
  acapulco: 'Mexico',
  'puerto costa maya': 'Mexico',
  'costa maya': 'Mexico',
  roatan: 'Honduras',
  labadee: 'Haiti',
  falmouth: 'Jamaica',
  'san juan': 'Puerto Rico',
  'charlotte amalie': 'U.S. Virgin Islands',
  tortola: 'British Virgin Islands',
  'st. john\'s': 'Antigua and Barbuda',
  'st john\'s': 'Antigua and Barbuda',
  bridgetown: 'Barbados',
  castries: 'Saint Lucia',
  philipsburg: 'Sint Maarten',
  'puerto plata': 'Dominican Republic',
  'grand cayman': 'Cayman Islands',
  'george town': 'Cayman Islands',
  'st. kitts': 'Saint Kitts and Nevis',
  'st kitts': 'Saint Kitts and Nevis',
  'panama canal': 'Panama',
  cartagena: 'Colombia',
  vancouver: 'Canada',
  victoria: 'Canada',
  'saint john': 'Canada',
  'st. john, new brunswick': 'Canada',
  'st john, new brunswick': 'Canada',
  halifax: 'Canada',
  miami: 'United States',
  galveston: 'United States',
  'los angeles': 'United States',
  'cape liberty': 'United States',
  seattle: 'United States',
  'fort lauderdale': 'United States',
  'port canaveral': 'United States',
  tampa: 'United States',
  boston: 'United States',
  portland: 'United States',
  'bar harbor': 'United States',
  astoria: 'United States',
  'san francisco': 'United States',
  'san diego': 'United States',
  'catalina island': 'United States',
  'key west': 'United States',
  juneau: 'United States',
  skagway: 'United States',
  'endicott arm': 'United States',
  honolulu: 'United States',
  maui: 'United States',
  kauai: 'United States',
  kona: 'United States',
  'kailua kona': 'United States',
  southampton: 'United Kingdom',
  'le havre': 'France',
  bilbao: 'Spain',
  'la coruna': 'Spain',
  'a coruña': 'Spain',
  vigo: 'Spain',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
}

function isLikelyDateString(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  return /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(value) || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value.trim());
}

function safeDateFromString(value: string | undefined): Date | null {
  if (!isLikelyDateString(value)) return null;
  const parsed = createDateFromString(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatISODate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getCruiseReturnDate(cruise: BookedCruise): Date | null {
  const returnDate = safeDateFromString(cruise.returnDate);
  if (returnDate) return returnDate;

  const sailDate = safeDateFromString(cruise.sailDate);
  if (sailDate && typeof cruise.nights === 'number' && Number.isFinite(cruise.nights)) {
    return addDays(sailDate, cruise.nights);
  }

  return null;
}

export function isCruiseCompletedForCountries(cruise: BookedCruise): boolean {
  if (cruise.status === 'cancelled') {
    return true;
  }

  const sailDate = safeDateFromString(cruise.sailDate);
  const returnDate = getCruiseReturnDate(cruise);
  const today = toLocalDateOnly(new Date());

  if (returnDate) {
    return toLocalDateOnly(returnDate) < today;
  }

  if (sailDate) {
    return toLocalDateOnly(sailDate) < today;
  }

  return cruise.completionState === 'completed' || cruise.status === 'completed';
}

function cleanPortName(port: string): string {
  return port
    .replace(/^day\s*\d+\s*[:.)-]?\s*/i, '')
    .replace(/^\d+\s*[:.)-]\s*/, '')
    .replace(/\s+arriv(?:e|al).*$/i, '')
    .replace(/\s+depart(?:ure)?.*$/i, '')
    .replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSeaDayPort(port: string): boolean {
  const normalizedPort = normalizeText(port);
  return normalizedPort === 'at sea' || normalizedPort === 'sea day' || normalizedPort === 'cruising' || normalizedPort.includes('at sea') || normalizedPort.includes('sea day');
}

export function getCountryFromPort(port: string): string | null {
  const cleanedPort = cleanPortName(port);
  if (!cleanedPort || isSeaDayPort(cleanedPort)) return null;

  const normalizedPort = normalizeText(cleanedPort);
  const lookupKey = Object.keys(PORT_COUNTRY_LOOKUP).find((key) => normalizedPort.includes(key));
  if (lookupKey) return PORT_COUNTRY_LOOKUP[lookupKey];

  const commaParts = cleanedPort.split(',').map((part) => part.trim()).filter(Boolean);
  const likelyCountry = commaParts[commaParts.length - 1] ?? cleanedPort;
  const normalizedCountry = normalizeText(likelyCountry.replace(/[()]/g, '').replace(/\bmetro\b/gi, '').trim());
  if (COUNTRY_ALIASES[normalizedCountry]) return COUNTRY_ALIASES[normalizedCountry];

  const aliasKey = Object.keys(COUNTRY_ALIASES).find((key) => normalizedPort.includes(key));
  if (aliasKey) return COUNTRY_ALIASES[aliasKey];

  if (commaParts.length > 1) return likelyCountry;
  return null;
}

function parsePortsAndTimes(value: string | undefined): ItineraryDay[] {
  if (!value?.trim()) return [];

  const normalizedValue = value.replace(/\r/g, '\n');
  const rawLines = normalizedValue.includes('\n')
    ? normalizedValue.split('\n')
    : normalizedValue.split(/[→›]|\s+-\s+|\s+•\s+/);

  return rawLines
    .map((line, index): ItineraryDay | null => {
      const parts = line.split(/[;|\t]/).map((part) => part.trim()).filter(Boolean);
      const port = cleanPortName(parts[0] ?? line);
      if (!port) return null;

      return {
        day: index + 1,
        port,
        arrival: parts[1],
        departure: parts[2],
        isSeaDay: isSeaDayPort(port),
      };
    })
    .filter((day): day is ItineraryDay => day !== null);
}

function parseItineraryRaw(raw: string[] | undefined): ItineraryDay[] {
  if (!raw || raw.length === 0) return [];

  if (raw.length === 1 && (raw[0].includes('\n') || raw[0].includes('→') || raw[0].includes('›'))) {
    return parsePortsAndTimes(raw[0]);
  }

  return raw
    .map((port, index): ItineraryDay | null => {
      const cleanedPort = cleanPortName(port);
      if (!cleanedPort) return null;
      return {
        day: index + 1,
        port: cleanedPort,
        isSeaDay: isSeaDayPort(cleanedPort),
      };
    })
    .filter((day): day is ItineraryDay => day !== null);
}

function getBestItinerary(cruise: BookedCruise): ItineraryDay[] {
  const sources: ItineraryDay[][] = [
    cruise.itinerary ?? [],
    parsePortsAndTimes(cruise.portsAndTimes),
    parseItineraryRaw(cruise.itineraryRaw),
    (cruise.ports ?? []).map((port, index) => ({
      day: index + 1,
      port: cleanPortName(port),
      isSeaDay: isSeaDayPort(port),
    })),
    [cruise.departurePort, cruise.destination]
      .filter((port): port is string => Boolean(port?.trim()))
      .map((port, index) => ({
        day: index + 1,
        port: cleanPortName(port),
        isSeaDay: isSeaDayPort(port),
      })),
  ];

  return sources.reduce<ItineraryDay[]>((bestSource, source) => {
    const bestPorts = bestSource.filter((day) => !day.isSeaDay && getCountryFromPort(day.port)).length;
    const sourcePorts = source.filter((day) => !day.isSeaDay && getCountryFromPort(day.port)).length;
    return sourcePorts > bestPorts ? source : bestSource;
  }, []);
}

function getPortDate(cruise: BookedCruise, portIndex: number, itineraryDay: ItineraryDay): string {
  const sailDate = safeDateFromString(cruise.sailDate);
  if (sailDate) {
    const dayOffset = typeof itineraryDay.day === 'number' && Number.isFinite(itineraryDay.day)
      ? Math.max(itineraryDay.day - 1, 0)
      : portIndex;
    return formatISODate(addDays(sailDate, dayOffset));
  }

  const returnDate = safeDateFromString(cruise.returnDate);
  return returnDate ? formatISODate(returnDate) : '';
}

function getCruiseDedupeKey(cruise: BookedCruise): string {
  const directKey = cruise.reservationNumber || cruise.bookingId || cruise.bwoNumber;
  if (directKey) return `reservation:${normalizeText(directKey)}`;
  return `sailing:${normalizeText(cruise.shipName)}:${cruise.sailDate}:${cruise.returnDate}:${normalizeText(cruise.itineraryName || cruise.destination || '')}`;
}

function getCruiseDataScore(cruise: BookedCruise): number {
  return (cruise.itinerary?.length ?? 0) * 8 + (cruise.ports?.length ?? 0) * 5 + (cruise.itineraryRaw?.length ?? 0) * 3 + (cruise.portsAndTimes ? 6 : 0) + (cruise.reservationNumber ? 4 : 0) + (cruise.offerCode ? 2 : 0);
}

function dedupeCruises(cruises: BookedCruise[]): BookedCruise[] {
  const cruiseMap = new Map<string, BookedCruise>();
  cruises.forEach((cruise) => {
    const key = getCruiseDedupeKey(cruise);
    const existingCruise = cruiseMap.get(key);
    if (!existingCruise || getCruiseDataScore(cruise) > getCruiseDataScore(existingCruise)) {
      cruiseMap.set(key, cruise);
    }
  });
  return Array.from(cruiseMap.values());
}

export function buildCountryVisits(cruises: BookedCruise[], filter: CruiseCountryFilter): CountryVisit[] {
  const visits: CountryVisit[] = [];
  const uniqueCruises = dedupeCruises(cruises);
  let skippedWithoutPorts = 0;
  let skippedUnmappedPorts = 0;

  uniqueCruises.forEach((cruise) => {
    const isCompleted = isCruiseCompletedForCountries(cruise);
    if (filter === 'completed' && !isCompleted) return;
    if (filter === 'upcoming' && isCompleted) return;

    const itinerary = getBestItinerary(cruise).filter((day) => !day.isSeaDay);
    if (itinerary.length === 0) {
      skippedWithoutPorts += 1;
      return;
    }

    itinerary.forEach((itineraryDay, index) => {
      const port = cleanPortName(itineraryDay.port);
      const country = getCountryFromPort(port);
      const date = getPortDate(cruise, index, itineraryDay);
      const visitDate = safeDateFromString(date) ?? safeDateFromString(cruise.sailDate) ?? safeDateFromString(cruise.returnDate);
      const year = visitDate?.getFullYear() ?? NaN;
      if (!country || !Number.isFinite(year)) {
        skippedUnmappedPorts += 1;
        return;
      }

      visits.push({
        id: `${cruise.id}-${index}-${date || cruise.sailDate}-${normalizeText(port)}`,
        cruiseId: cruise.id,
        cruiseName: cruise.itineraryName || cruise.destination || cruise.shipName,
        shipName: cruise.shipName,
        port,
        country,
        date: date || formatISODate(visitDate),
        year,
        isCompleted,
      });
    });
  });

  console.log('[CruiseCountries] Built visits from cruise data:', {
    inputCruises: cruises.length,
    uniqueCruises: uniqueCruises.length,
    filter,
    visits: visits.length,
    skippedWithoutPorts,
    skippedUnmappedPorts,
  });

  return visits.sort((left, right) => {
    const leftDate = safeDateFromString(left.date)?.getTime() ?? 0;
    const rightDate = safeDateFromString(right.date)?.getTime() ?? 0;
    return leftDate - rightDate;
  });
}

export function summarizeVisitsByYear(visits: CountryVisit[]): CountryYearSummary[] {
  const yearMap = new Map<number, CountryVisit[]>();
  visits.forEach((visit) => {
    const current = yearMap.get(visit.year) ?? [];
    current.push(visit);
    yearMap.set(visit.year, current);
  });

  return Array.from(yearMap.entries())
    .map(([year, yearVisits]) => ({
      year,
      visits: yearVisits,
      countries: Array.from(new Set(yearVisits.map((visit) => visit.country))).sort((a, b) => a.localeCompare(b)),
      ports: Array.from(new Set(yearVisits.map((visit) => visit.port))).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) => right.year - left.year);
}
