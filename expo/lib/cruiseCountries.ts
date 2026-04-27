import type { BookedCruise } from '@/types/models';
import { createDateFromString, isDateInPast } from '@/lib/date';

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
  florida: 'United States',
  texas: 'United States',
  washington: 'United States',
  alaska: 'United States',
  hawaii: 'United States',
  'puerto rico': 'Puerto Rico',
  'st. thomas': 'U.S. Virgin Islands',
  'st thomas': 'U.S. Virgin Islands',
  'u.s. virgin islands': 'U.S. Virgin Islands',
  'us virgin islands': 'U.S. Virgin Islands',
  'st. maarten': 'Sint Maarten',
  'st maarten': 'Sint Maarten',
  'st. martin': 'Sint Maarten',
  'st martin': 'Sint Maarten',
  antigua: 'Antigua and Barbuda',
  barbados: 'Barbados',
  'st. lucia': 'Saint Lucia',
  'st lucia': 'Saint Lucia',
  bahamas: 'Bahamas',
  mexico: 'Mexico',
  honduras: 'Honduras',
  jamaica: 'Jamaica',
  belize: 'Belize',
  canada: 'Canada',
  aruba: 'Aruba',
  curaçao: 'Curaçao',
  curacao: 'Curaçao',
  bonaire: 'Bonaire',
  bermuda: 'Bermuda',
  'cayman islands': 'Cayman Islands',
  grenada: 'Grenada',
  dominica: 'Dominica',
  martinique: 'Martinique',
  guadeloupe: 'Guadeloupe',
  panama: 'Panama',
  colombia: 'Colombia',
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
  'puerto costa maya': 'Mexico',
  'costa maya': 'Mexico',
  roatan: 'Honduras',
  'san juan': 'Puerto Rico',
  'charlotte amalie': 'U.S. Virgin Islands',
  'st. john\'s': 'Antigua and Barbuda',
  'st john\'s': 'Antigua and Barbuda',
  bridgetown: 'Barbados',
  castries: 'Saint Lucia',
  philipsburg: 'Sint Maarten',
  miami: 'United States',
  galveston: 'United States',
  'los angeles': 'United States',
  'cape liberty': 'United States',
  seattle: 'United States',
  'fort lauderdale': 'United States',
  'port canaveral': 'United States',
  tampa: 'United States',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isCruiseCompletedForCountries(cruise: BookedCruise): boolean {
  if (cruise.completionState === 'completed' || cruise.status === 'completed') {
    return true;
  }
  if (cruise.returnDate) {
    return isDateInPast(cruise.returnDate);
  }
  if (cruise.sailDate && cruise.nights) {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + cruise.nights);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return returnDate < today;
  }
  if (cruise.sailDate) {
    return isDateInPast(cruise.sailDate);
  }
  return false;
}

export function getCountryFromPort(port: string): string | null {
  const cleanedPort = port.trim();
  if (!cleanedPort) return null;

  const normalizedPort = normalizeText(cleanedPort);
  const lookupKey = Object.keys(PORT_COUNTRY_LOOKUP).find((key) => normalizedPort.includes(key));
  if (lookupKey) return PORT_COUNTRY_LOOKUP[lookupKey];

  const commaParts = cleanedPort.split(',').map((part) => part.trim()).filter(Boolean);
  const likelyCountry = commaParts[commaParts.length - 1] ?? cleanedPort;
  const normalizedCountry = normalizeText(likelyCountry.replace(/[()]/g, ''));
  if (COUNTRY_ALIASES[normalizedCountry]) return COUNTRY_ALIASES[normalizedCountry];

  const aliasKey = Object.keys(COUNTRY_ALIASES).find((key) => normalizedPort.includes(key));
  if (aliasKey) return COUNTRY_ALIASES[aliasKey];

  if (commaParts.length > 1) return likelyCountry;
  return null;
}

function getPortDate(cruise: BookedCruise, portIndex: number, port: string): string {
  const itineraryDay = cruise.itinerary?.find((day) => normalizeText(day.port) === normalizeText(port));
  if (itineraryDay?.day && cruise.sailDate) {
    const date = createDateFromString(cruise.sailDate);
    date.setDate(date.getDate() + itineraryDay.day - 1);
    return date.toISOString().split('T')[0] ?? cruise.sailDate;
  }
  if (cruise.sailDate) {
    const date = createDateFromString(cruise.sailDate);
    date.setDate(date.getDate() + portIndex);
    return date.toISOString().split('T')[0] ?? cruise.sailDate;
  }
  return cruise.returnDate || '';
}

export function buildCountryVisits(cruises: BookedCruise[], filter: CruiseCountryFilter): CountryVisit[] {
  const visits: CountryVisit[] = [];

  cruises.forEach((cruise) => {
    const isCompleted = isCruiseCompletedForCountries(cruise);
    if (filter === 'completed' && !isCompleted) return;
    if (filter === 'upcoming' && isCompleted) return;

    const rawPorts = cruise.itinerary?.length
      ? cruise.itinerary.filter((day) => !day.isSeaDay).map((day) => day.port)
      : cruise.ports ?? [];
    const ports = rawPorts.length > 0 ? rawPorts : [cruise.departurePort, cruise.destination].filter(Boolean);

    ports.forEach((port, index) => {
      const country = getCountryFromPort(port);
      const date = getPortDate(cruise, index, port);
      const year = date ? createDateFromString(date).getFullYear() : createDateFromString(cruise.sailDate).getFullYear();
      if (!country || !Number.isFinite(year)) return;

      visits.push({
        id: `${cruise.id}-${index}-${normalizeText(port)}`,
        cruiseId: cruise.id,
        cruiseName: cruise.itineraryName || cruise.destination || cruise.shipName,
        shipName: cruise.shipName,
        port,
        country,
        date,
        year,
        isCompleted,
      });
    });
  });

  return visits.sort((left, right) => createDateFromString(left.date).getTime() - createDateFromString(right.date).getTime());
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
