import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Anchor, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Globe2, MapPin, Ship } from 'lucide-react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCoreData } from '@/state/CoreDataProvider';
import { ADMIN_EMAILS, useAuth } from '@/state/AuthProvider';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { COMPLETED_CRUISES_DATA } from '@/mocks/completedCruises';
import { CRUISE_HISTORY_SUPPLEMENT_DATA } from '@/mocks/cruiseHistorySupplement';
import { buildCountryVisits, summarizeVisitsByYear, type CountryVisit, type CruiseCountryFilter } from '@/lib/cruiseCountries';
import { createDateFromString } from '@/lib/date';
import type { BookedCruise } from '@/types/models';

const FILTERS: { key: CruiseCountryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DetailMode = 'countries' | 'ports' | null;

type CountryListItem = {
  country: string;
  visitCount: number;
  portCount: number;
  shipCount: number;
  latestDate: string;
};

type PortDestinationListItem = {
  key: string;
  port: string;
  country: string;
  visitCount: number;
  shipCount: number;
  latestDate: string;
  visits: CountryVisit[];
};

type MapRegionName = 'Alaska' | 'Pacific Coast' | 'Caribbean & Bahamas' | 'Central America' | 'Mexico' | 'Canada & New England' | 'Mediterranean & Europe' | 'Hawaii' | 'Australia / New Zealand' | 'World Routes';

type PortMapCoordinate = {
  lat: number;
  lon: number;
  region: MapRegionName;
};

type CruiseMapPoint = {
  key: string;
  port: string;
  country: string;
  visitCount: number;
  x: number;
  y: number;
  color: string;
  region: MapRegionName;
};

type CruiseMapSegment = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
};

type CruiseMapRegionRow = {
  region: MapRegionName;
  destinationCount: number;
  visitCount: number;
  color: string;
};

const MAP_WIDTH = 340;
const MAP_HEIGHT = 170;

const MAP_REGION_COLORS: Record<MapRegionName, string> = {
  Alaska: '#7DD56F',
  'Pacific Coast': '#C16FE3',
  'Caribbean & Bahamas': '#F7C948',
  'Central America': '#3DD6D0',
  Mexico: '#F59E3D',
  'Canada & New England': '#6CB7F0',
  'Mediterranean & Europe': '#F6B650',
  Hawaii: '#E85BA9',
  'Australia / New Zealand': '#58A8F7',
  'World Routes': '#F8D77E',
};

const PORT_MAP_COORDINATES: Record<string, PortMapCoordinate> = {
  sitka: { lat: 57.0531, lon: -135.33, region: 'Alaska' },
  skagway: { lat: 59.4583, lon: -135.3139, region: 'Alaska' },
  juneau: { lat: 58.3019, lon: -134.4197, region: 'Alaska' },
  'icy strait point': { lat: 58.13, lon: -135.45, region: 'Alaska' },
  ketchikan: { lat: 55.3422, lon: -131.6461, region: 'Alaska' },
  seward: { lat: 60.1042, lon: -149.4422, region: 'Alaska' },
  'hubbard glacier': { lat: 60.0, lon: -139.5, region: 'Alaska' },
  vancouver: { lat: 49.2827, lon: -123.1207, region: 'Canada & New England' },
  victoria: { lat: 48.4284, lon: -123.3656, region: 'Canada & New England' },
  seattle: { lat: 47.6062, lon: -122.3321, region: 'Pacific Coast' },
  astoria: { lat: 46.1879, lon: -123.8313, region: 'Pacific Coast' },
  'san francisco': { lat: 37.7749, lon: -122.4194, region: 'Pacific Coast' },
  'los angeles': { lat: 34.0522, lon: -118.2437, region: 'Pacific Coast' },
  'san diego': { lat: 32.7157, lon: -117.1611, region: 'Pacific Coast' },
  'catalina island': { lat: 33.3879, lon: -118.4163, region: 'Pacific Coast' },
  boston: { lat: 42.3601, lon: -71.0589, region: 'Canada & New England' },
  portland: { lat: 43.6591, lon: -70.2568, region: 'Canada & New England' },
  'bar harbor': { lat: 44.3876, lon: -68.2039, region: 'Canada & New England' },
  halifax: { lat: 44.6488, lon: -63.5752, region: 'Canada & New England' },
  'saint john': { lat: 45.2733, lon: -66.0633, region: 'Canada & New England' },
  'st john new brunswick': { lat: 45.2733, lon: -66.0633, region: 'Canada & New England' },
  miami: { lat: 25.7617, lon: -80.1918, region: 'Caribbean & Bahamas' },
  'fort lauderdale': { lat: 26.1224, lon: -80.1373, region: 'Caribbean & Bahamas' },
  'port canaveral': { lat: 28.3922, lon: -80.6077, region: 'Caribbean & Bahamas' },
  tampa: { lat: 27.9506, lon: -82.4572, region: 'Caribbean & Bahamas' },
  galveston: { lat: 29.3013, lon: -94.7977, region: 'Caribbean & Bahamas' },
  'key west': { lat: 24.5551, lon: -81.78, region: 'Caribbean & Bahamas' },
  nassau: { lat: 25.0443, lon: -77.3504, region: 'Caribbean & Bahamas' },
  cococay: { lat: 25.8175, lon: -77.9364, region: 'Caribbean & Bahamas' },
  'perfect day at cococay': { lat: 25.8175, lon: -77.9364, region: 'Caribbean & Bahamas' },
  bimini: { lat: 25.699, lon: -79.2647, region: 'Caribbean & Bahamas' },
  'beach club at bimini': { lat: 25.699, lon: -79.2647, region: 'Caribbean & Bahamas' },
  labadee: { lat: 19.7867, lon: -72.2468, region: 'Caribbean & Bahamas' },
  falmouth: { lat: 18.4936, lon: -77.6559, region: 'Caribbean & Bahamas' },
  'san juan': { lat: 18.4655, lon: -66.1057, region: 'Caribbean & Bahamas' },
  'charlotte amalie': { lat: 18.3419, lon: -64.9307, region: 'Caribbean & Bahamas' },
  tortola: { lat: 18.4285, lon: -64.6185, region: 'Caribbean & Bahamas' },
  'st johns': { lat: 17.1274, lon: -61.8468, region: 'Caribbean & Bahamas' },
  bridgetown: { lat: 13.106, lon: -59.6132, region: 'Caribbean & Bahamas' },
  castries: { lat: 14.0101, lon: -60.9875, region: 'Caribbean & Bahamas' },
  philipsburg: { lat: 18.026, lon: -63.0458, region: 'Caribbean & Bahamas' },
  'puerto plata': { lat: 19.7808, lon: -70.6871, region: 'Caribbean & Bahamas' },
  'grand cayman': { lat: 19.3133, lon: -81.2546, region: 'Caribbean & Bahamas' },
  'george town': { lat: 19.2869, lon: -81.3674, region: 'Caribbean & Bahamas' },
  'st kitts': { lat: 17.3026, lon: -62.7177, region: 'Caribbean & Bahamas' },
  aruba: { lat: 12.5211, lon: -69.9683, region: 'Caribbean & Bahamas' },
  curacao: { lat: 12.1696, lon: -68.99, region: 'Caribbean & Bahamas' },
  bonaire: { lat: 12.1784, lon: -68.2385, region: 'Caribbean & Bahamas' },
  'st croix': { lat: 17.7246, lon: -64.8348, region: 'Caribbean & Bahamas' },
  frederiksted: { lat: 17.7119, lon: -64.8815, region: 'Caribbean & Bahamas' },
  cozumel: { lat: 20.422, lon: -86.9223, region: 'Central America' },
  'costa maya': { lat: 18.7149, lon: -87.7094, region: 'Central America' },
  'puerto costa maya': { lat: 18.7149, lon: -87.7094, region: 'Central America' },
  roatan: { lat: 16.3298, lon: -86.5299, region: 'Central America' },
  'belize city': { lat: 17.5046, lon: -88.1962, region: 'Central America' },
  'puerto limon': { lat: 9.9911, lon: -83.0359, region: 'Central America' },
  puntarenas: { lat: 9.9763, lon: -84.8384, region: 'Central America' },
  colon: { lat: 9.3592, lon: -79.9014, region: 'Central America' },
  cartagena: { lat: 10.391, lon: -75.4794, region: 'Central America' },
  'puerto quetzal': { lat: 13.9259, lon: -90.7882, region: 'Central America' },
  ensenada: { lat: 31.8667, lon: -116.5964, region: 'Mexico' },
  'cabo san lucas': { lat: 22.8905, lon: -109.9167, region: 'Mexico' },
  mazatlan: { lat: 23.2494, lon: -106.4111, region: 'Mexico' },
  'puerto vallarta': { lat: 20.6534, lon: -105.2253, region: 'Mexico' },
  acapulco: { lat: 16.8531, lon: -99.8237, region: 'Mexico' },
  manzanillo: { lat: 19.1138, lon: -104.3385, region: 'Mexico' },
  barcelona: { lat: 41.3851, lon: 2.1734, region: 'Mediterranean & Europe' },
  'palma de mallorca': { lat: 39.5696, lon: 2.6502, region: 'Mediterranean & Europe' },
  ibiza: { lat: 38.9067, lon: 1.4206, region: 'Mediterranean & Europe' },
  marseille: { lat: 43.2965, lon: 5.3698, region: 'Mediterranean & Europe' },
  nice: { lat: 43.7102, lon: 7.262, region: 'Mediterranean & Europe' },
  villefranche: { lat: 43.7034, lon: 7.3126, region: 'Mediterranean & Europe' },
  cannes: { lat: 43.5528, lon: 7.0174, region: 'Mediterranean & Europe' },
  'le havre': { lat: 49.4944, lon: 0.1079, region: 'Mediterranean & Europe' },
  cherbourg: { lat: 49.6337, lon: -1.6221, region: 'Mediterranean & Europe' },
  bilbao: { lat: 43.263, lon: -2.935, region: 'Mediterranean & Europe' },
  'la coruna': { lat: 43.3623, lon: -8.4115, region: 'Mediterranean & Europe' },
  vigo: { lat: 42.2406, lon: -8.7207, region: 'Mediterranean & Europe' },
  lisbon: { lat: 38.7223, lon: -9.1393, region: 'Mediterranean & Europe' },
  cadiz: { lat: 36.5271, lon: -6.2886, region: 'Mediterranean & Europe' },
  malaga: { lat: 36.7213, lon: -4.4214, region: 'Mediterranean & Europe' },
  gibraltar: { lat: 36.1408, lon: -5.3536, region: 'Mediterranean & Europe' },
  casablanca: { lat: 33.5731, lon: -7.5898, region: 'Mediterranean & Europe' },
  tangier: { lat: 35.7595, lon: -5.834, region: 'Mediterranean & Europe' },
  'la spezia': { lat: 44.1025, lon: 9.8241, region: 'Mediterranean & Europe' },
  civitavecchia: { lat: 42.0924, lon: 11.7954, region: 'Mediterranean & Europe' },
  rome: { lat: 41.9028, lon: 12.4964, region: 'Mediterranean & Europe' },
  naples: { lat: 40.8518, lon: 14.2681, region: 'Mediterranean & Europe' },
  livorno: { lat: 43.5485, lon: 10.3106, region: 'Mediterranean & Europe' },
  florence: { lat: 43.7696, lon: 11.2558, region: 'Mediterranean & Europe' },
  venice: { lat: 45.4408, lon: 12.3155, region: 'Mediterranean & Europe' },
  dubrovnik: { lat: 42.6507, lon: 18.0944, region: 'Mediterranean & Europe' },
  santorini: { lat: 36.3932, lon: 25.4615, region: 'Mediterranean & Europe' },
  mykonos: { lat: 37.4467, lon: 25.3289, region: 'Mediterranean & Europe' },
  athens: { lat: 37.9838, lon: 23.7275, region: 'Mediterranean & Europe' },
  piraeus: { lat: 37.942, lon: 23.6469, region: 'Mediterranean & Europe' },
  kusadasi: { lat: 37.8579, lon: 27.261, region: 'Mediterranean & Europe' },
  ephesus: { lat: 37.939, lon: 27.341, region: 'Mediterranean & Europe' },
  istanbul: { lat: 41.0082, lon: 28.9784, region: 'Mediterranean & Europe' },
  chania: { lat: 35.5138, lon: 24.018, region: 'Mediterranean & Europe' },
  'souda crete': { lat: 35.4871, lon: 24.0735, region: 'Mediterranean & Europe' },
  honolulu: { lat: 21.3069, lon: -157.8583, region: 'Hawaii' },
  lahaina: { lat: 20.8783, lon: -156.6825, region: 'Hawaii' },
  hilo: { lat: 19.7071, lon: -155.0885, region: 'Hawaii' },
  'kailua kona': { lat: 19.64, lon: -155.9969, region: 'Hawaii' },
  kona: { lat: 19.64, lon: -155.9969, region: 'Hawaii' },
  maui: { lat: 20.7984, lon: -156.3319, region: 'Hawaii' },
  kauai: { lat: 22.0964, lon: -159.5261, region: 'Hawaii' },
  'na pali coast': { lat: 22.2085, lon: -159.5951, region: 'Hawaii' },
  sydney: { lat: -33.8688, lon: 151.2093, region: 'Australia / New Zealand' },
  auckland: { lat: -36.8509, lon: 174.7645, region: 'Australia / New Zealand' },
  tauranga: { lat: -37.6878, lon: 176.1651, region: 'Australia / New Zealand' },
};

const COUNTRY_MAP_COORDINATES: Record<string, PortMapCoordinate> = {
  'united states': { lat: 33.5, lon: -97.5, region: 'World Routes' },
  canada: { lat: 53.0, lon: -106.0, region: 'Canada & New England' },
  bahamas: { lat: 25.0, lon: -77.4, region: 'Caribbean & Bahamas' },
  mexico: { lat: 22.8, lon: -102.5, region: 'Mexico' },
  honduras: { lat: 15.2, lon: -86.2, region: 'Central America' },
  haiti: { lat: 19.0, lon: -72.4, region: 'Caribbean & Bahamas' },
  jamaica: { lat: 18.1, lon: -77.3, region: 'Caribbean & Bahamas' },
  'puerto rico': { lat: 18.2, lon: -66.5, region: 'Caribbean & Bahamas' },
  'u.s. virgin islands': { lat: 18.34, lon: -64.93, region: 'Caribbean & Bahamas' },
  'british virgin islands': { lat: 18.42, lon: -64.62, region: 'Caribbean & Bahamas' },
  barbados: { lat: 13.2, lon: -59.55, region: 'Caribbean & Bahamas' },
  'saint lucia': { lat: 13.9, lon: -60.98, region: 'Caribbean & Bahamas' },
  'sint maarten': { lat: 18.04, lon: -63.05, region: 'Caribbean & Bahamas' },
  'dominican republic': { lat: 19.0, lon: -70.7, region: 'Caribbean & Bahamas' },
  'cayman islands': { lat: 19.31, lon: -81.25, region: 'Caribbean & Bahamas' },
  'saint kitts and nevis': { lat: 17.33, lon: -62.75, region: 'Caribbean & Bahamas' },
  aruba: { lat: 12.52, lon: -69.97, region: 'Caribbean & Bahamas' },
  curacao: { lat: 12.17, lon: -68.99, region: 'Caribbean & Bahamas' },
  curaçao: { lat: 12.17, lon: -68.99, region: 'Caribbean & Bahamas' },
  bonaire: { lat: 12.18, lon: -68.24, region: 'Caribbean & Bahamas' },
  bermuda: { lat: 32.3078, lon: -64.7505, region: 'Caribbean & Bahamas' },
  belize: { lat: 17.2, lon: -88.5, region: 'Central America' },
  panama: { lat: 8.98, lon: -79.52, region: 'Central America' },
  colombia: { lat: 10.4, lon: -75.5, region: 'Central America' },
  guatemala: { lat: 14.6, lon: -90.5, region: 'Central America' },
  'costa rica': { lat: 9.75, lon: -84.1, region: 'Central America' },
  spain: { lat: 40.2, lon: -3.7, region: 'Mediterranean & Europe' },
  italy: { lat: 42.8, lon: 12.5, region: 'Mediterranean & Europe' },
  france: { lat: 46.2, lon: 2.2, region: 'Mediterranean & Europe' },
  greece: { lat: 39.0, lon: 22.0, region: 'Mediterranean & Europe' },
  portugal: { lat: 39.5, lon: -8.0, region: 'Mediterranean & Europe' },
  morocco: { lat: 31.8, lon: -7.1, region: 'Mediterranean & Europe' },
  turkey: { lat: 39.0, lon: 35.2, region: 'Mediterranean & Europe' },
  croatia: { lat: 45.1, lon: 15.2, region: 'Mediterranean & Europe' },
  'united kingdom': { lat: 52.3, lon: -1.5, region: 'Mediterranean & Europe' },
  norway: { lat: 60.5, lon: 8.5, region: 'Mediterranean & Europe' },
  denmark: { lat: 56.0, lon: 10.0, region: 'Mediterranean & Europe' },
  sweden: { lat: 59.3, lon: 18.0, region: 'Mediterranean & Europe' },
  finland: { lat: 61.9, lon: 25.7, region: 'Mediterranean & Europe' },
  iceland: { lat: 64.9, lon: -18.6, region: 'Mediterranean & Europe' },
  ireland: { lat: 53.4, lon: -8.2, region: 'Mediterranean & Europe' },
  australia: { lat: -25.3, lon: 133.8, region: 'Australia / New Zealand' },
  'new zealand': { lat: -41.2, lon: 174.8, region: 'Australia / New Zealand' },
};

function getInitialFilter(value: string | string[] | undefined): CruiseCountryFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'upcoming' || raw === 'completed') return raw;
  return 'all';
}

function formatVisitDate(date: string): string {
  return createDateFromString(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCruiseIdentity(cruise: BookedCruise): string {
  const directId = cruise.reservationNumber || cruise.bookingId || cruise.bwoNumber;
  if (directId) return `reservation:${directId.toLowerCase().trim()}`;
  return `sailing:${cruise.shipName.toLowerCase().trim()}:${cruise.sailDate}:${cruise.returnDate}:${(cruise.itineraryName || cruise.destination || '').toLowerCase().trim()}`;
}

function getDestinationKey(visit: CountryVisit): string {
  return `${visit.port.toLowerCase().trim()}|${visit.country.toLowerCase().trim()}`;
}

function formatCount(value: number, singular: string, plural: string = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function normalizeMapKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getCoordinateForPortCountry(port: string, country: string): PortMapCoordinate | null {
  const normalizedPort = normalizeMapKey(port);
  const directPortCoordinate = PORT_MAP_COORDINATES[normalizedPort];
  if (directPortCoordinate) return directPortCoordinate;

  const matchingPortKey = Object.keys(PORT_MAP_COORDINATES).find((key) => {
    const normalizedKey = normalizeMapKey(key);
    return normalizedPort.includes(normalizedKey) || normalizedKey.includes(normalizedPort);
  });
  if (matchingPortKey) return PORT_MAP_COORDINATES[matchingPortKey];

  const normalizedCountry = normalizeMapKey(country);
  return COUNTRY_MAP_COORDINATES[normalizedCountry] ?? null;
}

function getProjectedMapPoint(coordinate: PortMapCoordinate, jitterSeed: string): { x: number; y: number } {
  const jitterTotal = jitterSeed.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const jitterX = (jitterTotal % 7) - 3;
  const jitterY = (Math.floor(jitterTotal / 7) % 7) - 3;
  const wrappedLongitude = coordinate.region === 'Hawaii' && coordinate.lon < -145 ? coordinate.lon + 360 : coordinate.lon;
  const rawX = ((wrappedLongitude + 125) / 305) * MAP_WIDTH;
  const rawY = ((70 - coordinate.lat) / 120) * MAP_HEIGHT;

  return {
    x: Math.max(8, Math.min(MAP_WIDTH - 8, rawX + jitterX)),
    y: Math.max(10, Math.min(MAP_HEIGHT - 10, rawY + jitterY)),
  };
}

function buildCruiseMapPoints(destinationRows: PortDestinationListItem[]): CruiseMapPoint[] {
  return destinationRows
    .map((destination) => {
      const coordinate = getCoordinateForPortCountry(destination.port, destination.country);
      if (!coordinate) return null;
      const point = getProjectedMapPoint(coordinate, destination.key);
      return {
        key: destination.key,
        port: destination.port,
        country: destination.country,
        visitCount: destination.visitCount,
        x: point.x,
        y: point.y,
        color: MAP_REGION_COLORS[coordinate.region],
        region: coordinate.region,
      };
    })
    .filter((point): point is CruiseMapPoint => point !== null);
}

function buildCruiseMapSegments(visits: CountryVisit[]): CruiseMapSegment[] {
  const visitsByCruise = new Map<string, CountryVisit[]>();
  visits.forEach((visit) => {
    const currentVisits = visitsByCruise.get(visit.cruiseId) ?? [];
    currentVisits.push(visit);
    visitsByCruise.set(visit.cruiseId, currentVisits);
  });

  const segments: CruiseMapSegment[] = [];
  visitsByCruise.forEach((cruiseVisits, cruiseId) => {
    const sortedVisits = [...cruiseVisits].sort((left, right) => createDateFromString(left.date).getTime() - createDateFromString(right.date).getTime());
    const projectedVisits = sortedVisits
      .map((visit) => {
        const coordinate = getCoordinateForPortCountry(visit.port, visit.country);
        if (!coordinate) return null;
        const point = getProjectedMapPoint(coordinate, `${visit.id}-${visit.port}`);
        return { ...point, color: MAP_REGION_COLORS[coordinate.region] };
      })
      .filter((point): point is { x: number; y: number; color: string } => point !== null);

    projectedVisits.forEach((point, index) => {
      const nextPoint = projectedVisits[index + 1];
      if (!nextPoint) return;
      if (Math.abs(point.x - nextPoint.x) < 1 && Math.abs(point.y - nextPoint.y) < 1) return;
      segments.push({
        key: `${cruiseId}-${index}-${segments.length}`,
        x1: point.x,
        y1: point.y,
        x2: nextPoint.x,
        y2: nextPoint.y,
        color: nextPoint.color,
      });
    });
  });

  return segments.slice(0, 140);
}

function getShortMapLabel(port: string): string {
  const cleanedPort = port.replace(/\s*\([^)]*\)/g, '').trim();
  if (cleanedPort.length <= 13) return cleanedPort;
  const firstPart = cleanedPort.split(',')[0]?.trim() ?? cleanedPort;
  if (firstPart.length <= 13) return firstPart;
  return `${firstPart.slice(0, 11).trim()}…`;
}

function getCityDotRadius(visitCount: number): number {
  return Math.min(3.1, 1.65 + Math.min(visitCount, 10) * 0.13);
}

function getCityGlowRadius(visitCount: number): number {
  return Math.min(6.2, 2.9 + Math.min(visitCount, 14) * 0.24);
}

function buildCruiseMapRegions(points: CruiseMapPoint[]): CruiseMapRegionRow[] {
  const regionMap = new Map<MapRegionName, { destinationCount: number; visitCount: number }>();
  points.forEach((point) => {
    const current = regionMap.get(point.region) ?? { destinationCount: 0, visitCount: 0 };
    regionMap.set(point.region, {
      destinationCount: current.destinationCount + 1,
      visitCount: current.visitCount + point.visitCount,
    });
  });

  return Array.from(regionMap.entries())
    .map(([region, values]) => ({
      region,
      destinationCount: values.destinationCount,
      visitCount: values.visitCount,
      color: MAP_REGION_COLORS[region],
    }))
    .sort((left, right) => right.visitCount - left.visitCount)
    .slice(0, 5);
}

function mergeCruiseData(primaryCruises: BookedCruise[], fallbackCruises: BookedCruise[]): BookedCruise[] {
  const cruiseMap = new Map<string, BookedCruise>();
  fallbackCruises.forEach((cruise) => cruiseMap.set(getCruiseIdentity(cruise), cruise));
  primaryCruises.forEach((cruise) => cruiseMap.set(getCruiseIdentity(cruise), cruise));
  return Array.from(cruiseMap.values());
}

export default function CountriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { bookedCruises, cruises } = useCoreData();
  const { authenticatedEmail } = useAuth();
  const [filter, setFilter] = useState<CruiseCountryFilter>(() => getInitialFilter(params.filter));
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showYearFilter, setShowYearFilter] = useState<boolean>(false);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [expandedDestinationKey, setExpandedDestinationKey] = useState<string | null>(null);

  const sourceCruises = useMemo(() => {
    const normalizedEmail = authenticatedEmail?.toLowerCase().trim() ?? null;
    const shouldIncludeKnownAdminCruises = !!normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail as typeof ADMIN_EMAILS[number]);
    const knownAdminCruises = shouldIncludeKnownAdminCruises ? [...COMPLETED_CRUISES_DATA, ...BOOKED_CRUISES_DATA, ...CRUISE_HISTORY_SUPPLEMENT_DATA] : [];
    const bookedLikeCruises = cruises.filter((cruise) => cruise.status === 'booked' || cruise.status === 'completed' || Boolean((cruise as BookedCruise).reservationNumber || (cruise as BookedCruise).bookingId));
    const storedCruises = mergeCruiseData(bookedCruises, bookedLikeCruises);
    const mergedCruises = mergeCruiseData(storedCruises, knownAdminCruises);
    console.log('[Countries] Resolved country cruise source:', {
      authenticatedEmail: normalizedEmail,
      storedBookedCruises: bookedCruises.length,
      storedBookedLikeCruises: bookedLikeCruises.length,
      knownAdminCruises: knownAdminCruises.length,
      mergedCruises: mergedCruises.length,
    });
    return mergedCruises;
  }, [authenticatedEmail, bookedCruises, cruises]);

  const visits = useMemo(() => {
    const builtVisits = buildCountryVisits(sourceCruises, filter);
    console.log('[Countries] Built country visits:', {
      cruises: sourceCruises.length,
      visits: builtVisits.length,
      filter,
    });
    return builtVisits;
  }, [sourceCruises, filter]);

  const summaries = useMemo(() => summarizeVisitsByYear(visits), [visits]);
  const yearOptions = useMemo(() => summaries.map((summary) => summary.year), [summaries]);
  const activeYear = selectedYear ?? yearOptions[0] ?? new Date().getFullYear();

  const activeYearVisits = useMemo(() => visits.filter((visit) => visit.year === activeYear), [activeYear, visits]);
  const activeYearCountries = useMemo(
    () => Array.from(new Set(activeYearVisits.map((visit) => visit.country))).sort((a, b) => a.localeCompare(b)),
    [activeYearVisits]
  );
  const activeYearPorts = useMemo(
    () => Array.from(new Set(activeYearVisits.map((visit) => visit.port))).sort((a, b) => a.localeCompare(b)),
    [activeYearVisits]
  );
  const lifetimeCountries = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.country))).sort((a, b) => a.localeCompare(b)),
    [visits]
  );

  const lifetimeCountryRows = useMemo<CountryListItem[]>(() => {
    const countryMap = new Map<string, CountryVisit[]>();
    visits.forEach((visit) => {
      const current = countryMap.get(visit.country) ?? [];
      current.push(visit);
      countryMap.set(visit.country, current);
    });

    return Array.from(countryMap.entries())
      .map(([country, countryVisits]) => {
        const latestVisit = [...countryVisits].sort((left, right) => {
          const leftTime = createDateFromString(left.date).getTime();
          const rightTime = createDateFromString(right.date).getTime();
          return rightTime - leftTime;
        })[0];

        return {
          country,
          visitCount: countryVisits.length,
          portCount: new Set(countryVisits.map((visit) => visit.port)).size,
          shipCount: new Set(countryVisits.map((visit) => visit.shipName)).size,
          latestDate: latestVisit?.date ?? countryVisits[0]?.date ?? '',
        };
      })
      .sort((left, right) => left.country.localeCompare(right.country));
  }, [visits]);

  const destinationRows = useMemo<PortDestinationListItem[]>(() => {
    const destinationMap = new Map<string, CountryVisit[]>();
    visits.forEach((visit) => {
      const key = getDestinationKey(visit);
      const current = destinationMap.get(key) ?? [];
      current.push(visit);
      destinationMap.set(key, current);
    });

    return Array.from(destinationMap.entries())
      .map(([key, destinationVisits]) => {
        const sortedVisits = [...destinationVisits].sort((left, right) => {
          const leftTime = createDateFromString(left.date).getTime();
          const rightTime = createDateFromString(right.date).getTime();
          return rightTime - leftTime;
        });
        const firstVisit = sortedVisits[0];

        return {
          key,
          port: firstVisit?.port ?? 'Unknown destination',
          country: firstVisit?.country ?? 'Unknown country',
          visitCount: sortedVisits.length,
          shipCount: new Set(sortedVisits.map((visit) => visit.shipName)).size,
          latestDate: firstVisit?.date ?? '',
          visits: sortedVisits,
        };
      })
      .sort((left, right) => left.port.localeCompare(right.port));
  }, [visits]);

  const cruiseMapPoints = useMemo(() => {
    const points = buildCruiseMapPoints(destinationRows);
    console.log('[Countries] Built cruise map points:', {
      destinations: destinationRows.length,
      mappedPoints: points.length,
      filter,
    });
    return points;
  }, [destinationRows, filter]);

  const cruiseMapSegments = useMemo(() => {
    const segments = buildCruiseMapSegments(visits);
    console.log('[Countries] Built cruise map route segments:', {
      visits: visits.length,
      segments: segments.length,
      filter,
    });
    return segments;
  }, [filter, visits]);

  const cruiseMapRegions = useMemo(() => buildCruiseMapRegions(cruiseMapPoints), [cruiseMapPoints]);

  const featuredMapLabels = useMemo(() => {
    return [...cruiseMapPoints]
      .sort((left, right) => right.visitCount - left.visitCount)
      .slice(0, 10);
  }, [cruiseMapPoints]);

  const visitsByMonth = useMemo(() => {
    const grouped = new Map<number, CountryVisit[]>();
    activeYearVisits.forEach((visit) => {
      const month = createDateFromString(visit.date).getMonth();
      const current = grouped.get(month) ?? [];
      current.push(visit);
      grouped.set(month, current);
    });
    return grouped;
  }, [activeYearVisits]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCountriesSummaryPress = useCallback(() => {
    console.log('[Countries] Countries summary pressed:', { countries: lifetimeCountries.length, filter });
    setDetailMode((current) => (current === 'countries' ? null : 'countries'));
  }, [filter, lifetimeCountries.length]);

  const handlePortVisitsSummaryPress = useCallback(() => {
    console.log('[Countries] Port visits summary pressed:', { visits: visits.length, destinations: destinationRows.length, filter });
    setDetailMode((current) => (current === 'ports' ? null : 'ports'));
    setExpandedDestinationKey(null);
  }, [destinationRows.length, filter, visits.length]);

  const handleDestinationPress = useCallback((destination: PortDestinationListItem) => {
    console.log('[Countries] Destination row pressed:', {
      port: destination.port,
      country: destination.country,
      visits: destination.visitCount,
    });
    setExpandedDestinationKey((current) => (current === destination.key ? null : destination.key));
  }, []);

  const handleCloseDetailPanel = useCallback(() => {
    console.log('[Countries] Detail panel closed');
    setDetailMode(null);
    setExpandedDestinationKey(null);
  }, []);

  return (
    <View style={styles.container} testID="countries-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.75} testID="countries-back-button">
                <ChevronLeft size={22} color={COLORS.navyDeep} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Countries</Text>
              <View style={styles.headerSpacer} />
            </View>

            <LinearGradient
              colors={[COLORS.navyDeep, '#0B7285', '#0E7490']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconBadge}>
                  <Globe2 size={26} color={COLORS.white} />
                </View>
                <View style={styles.heroTextGroup}>
                  <Text style={styles.heroEyebrow}>PORTS & COUNTRIES</Text>
                  <Text style={styles.heroTitle}>Your cruise map by year</Text>
                </View>
              </View>
              <Text style={styles.heroSubtitle}>See the countries and ports from your upcoming and completed cruises using your booked cruise data.</Text>
              <View style={styles.heroStatsRow}>
                <TouchableOpacity
                  style={[styles.heroStatPill, detailMode === 'countries' && styles.heroStatPillActive]}
                  onPress={handleCountriesSummaryPress}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${lifetimeCountries.length} countries`}
                  testID="countries-summary-countries-button"
                >
                  <Text style={styles.heroStatValue}>{lifetimeCountries.length}</Text>
                  <Text style={styles.heroStatLabel}>Countries</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heroStatPill, detailMode === 'ports' && styles.heroStatPillActive]}
                  onPress={handlePortVisitsSummaryPress}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${visits.length} port visits`}
                  testID="countries-summary-port-visits-button"
                >
                  <Text style={styles.heroStatValue}>{visits.length}</Text>
                  <Text style={styles.heroStatLabel}>Port visits</Text>
                </TouchableOpacity>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{yearOptions.length}</Text>
                  <Text style={styles.heroStatLabel}>Years</Text>
                </View>
              </View>
            </LinearGradient>

            {detailMode !== null && visits.length > 0 && (
              <View style={styles.detailPanel} testID={`countries-detail-panel-${detailMode}`}>
                <View style={styles.detailHeaderRow}>
                  <View style={styles.detailHeaderTitleRow}>
                    {detailMode === 'countries' ? <Globe2 size={18} color={COLORS.navyDeep} /> : <Anchor size={18} color={COLORS.navyDeep} />}
                    <Text style={styles.detailTitle}>{detailMode === 'countries' ? `${lifetimeCountries.length} countries` : `${destinationRows.length} destinations`}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detailCloseButton}
                    onPress={handleCloseDetailPanel}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel="Close list"
                    testID="countries-detail-close-button"
                  >
                    <Text style={styles.detailCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.detailSubtitle}>{detailMode === 'ports' ? `${formatCount(visits.length, 'individual port visit')} batched by destination` : filter === 'all' ? 'All upcoming and completed cruises' : filter === 'completed' ? 'Completed cruises only' : 'Upcoming cruises only'}</Text>
                {detailMode === 'ports' && (
                  <View style={styles.cruiseMapCard} testID="countries-destinations-map">
                    <View style={styles.cruiseMapHeaderRow}>
                      <View>
                        <Text style={styles.cruiseMapEyebrow}>LIFETIME AT SEA</Text>
                        <Text style={styles.cruiseMapTitle}>Ports, ships & memories across the world</Text>
                      </View>
                      <View style={styles.compassBadge}>
                        <Text style={styles.compassNorth}>N</Text>
                        <View style={styles.compassLineVertical} />
                        <View style={styles.compassLineHorizontal} />
                      </View>
                    </View>
                    <View style={styles.mapCanvasWrap}>
                      <Svg width="100%" height={190} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
                        <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} rx={18} fill="#08243B" />
                        <Rect x={4} y={4} width={MAP_WIDTH - 8} height={MAP_HEIGHT - 8} rx={15} fill="none" stroke="#D7A84C" strokeWidth={0.7} opacity={0.8} />
                        <Line x1={0} y1={42} x2={MAP_WIDTH} y2={42} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.12} />
                        <Line x1={0} y1={84} x2={MAP_WIDTH} y2={84} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.12} />
                        <Line x1={0} y1={126} x2={MAP_WIDTH} y2={126} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.12} />
                        <Line x1={68} y1={0} x2={68} y2={MAP_HEIGHT} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.1} />
                        <Line x1={136} y1={0} x2={136} y2={MAP_HEIGHT} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.1} />
                        <Line x1={204} y1={0} x2={204} y2={MAP_HEIGHT} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.1} />
                        <Line x1={272} y1={0} x2={272} y2={MAP_HEIGHT} stroke="#FFFFFF" strokeWidth={0.25} opacity={0.1} />
                        <Path d="M15 45 C30 18 70 20 87 43 C102 62 86 86 58 82 C30 78 5 70 15 45 Z" fill="#B8A47B" opacity={0.5} />
                        <Path d="M58 80 C74 88 89 111 79 139 C66 132 58 112 52 95 Z" fill="#A88C5E" opacity={0.46} />
                        <Path d="M128 50 C148 25 188 30 202 55 C211 76 195 94 169 90 C143 87 118 75 128 50 Z" fill="#C2B088" opacity={0.52} />
                        <Path d="M171 86 C196 93 215 119 204 151 C181 154 158 128 164 103 Z" fill="#9E8257" opacity={0.43} />
                        <Path d="M204 63 C222 48 250 55 267 73 C247 86 220 83 204 63 Z" fill="#B89C70" opacity={0.45} />
                        <Path d="M286 124 C305 111 329 119 335 139 C320 154 292 150 282 134 Z" fill="#BDA376" opacity={0.45} />
                        <Ellipse cx={60} cy={96} rx={48} ry={14} fill="none" stroke="#F7C948" strokeWidth={0.6} strokeDasharray="4 3" opacity={0.28} />
                        <Ellipse cx={161} cy={77} rx={44} ry={16} fill="none" stroke="#F6B650" strokeWidth={0.6} strokeDasharray="4 3" opacity={0.3} />
                        <Ellipse cx={318} cy={94} rx={28} ry={13} fill="none" stroke="#E85BA9" strokeWidth={0.6} strokeDasharray="4 3" opacity={0.32} />
                        {cruiseMapSegments.map((segment) => (
                          <Line
                            key={segment.key}
                            x1={segment.x1}
                            y1={segment.y1}
                            x2={segment.x2}
                            y2={segment.y2}
                            stroke={segment.color}
                            strokeWidth={0.8}
                            opacity={0.58}
                          />
                        ))}
                        {cruiseMapPoints.map((point) => (
                          <G key={point.key}>
                            <Circle cx={point.x} cy={point.y} r={getCityGlowRadius(point.visitCount)} fill={point.color} opacity={0.18} />
                            <Circle cx={point.x} cy={point.y} r={getCityDotRadius(point.visitCount)} fill={point.color} stroke="#FFF6D6" strokeWidth={0.55} opacity={0.98} />
                            <Circle cx={point.x - 0.65} cy={point.y - 0.65} r={0.62} fill="#FFFFFF" opacity={0.72} />
                          </G>
                        ))}
                        {featuredMapLabels.map((point, index) => {
                          const labelX = Math.max(8, Math.min(MAP_WIDTH - 62, point.x + (index % 2 === 0 ? 6 : -50)));
                          const labelY = Math.max(12, Math.min(MAP_HEIGHT - 10, point.y + (index % 3 === 0 ? -7 : 12)));
                          return (
                            <G key={`label-${point.key}`}>
                              <Line x1={point.x} y1={point.y} x2={labelX} y2={labelY - 3} stroke={point.color} strokeWidth={0.45} opacity={0.85} />
                              <SvgText x={labelX} y={labelY} fontSize={6.5} fontWeight="700" fill="#FFF2C7">
                                {getShortMapLabel(point.port)}
                              </SvgText>
                            </G>
                          );
                        })}
                        <SvgText x={16} y={18} fontSize={7.5} fontWeight="800" fill="#F8D77E">
                          {`${lifetimeCountries.length} countries • ${destinationRows.length} destinations • ${visits.length} port visits`}
                        </SvgText>
                        <SvgText x={226} y={18} fontSize={6.5} fontWeight="800" fill="#CDEFF3">
                          {filter.toUpperCase()} ROUTES
                        </SvgText>
                      </Svg>
                    </View>
                    <View style={styles.mapLegendNote} testID="countries-map-city-dot-legend">
                      <View style={styles.mapLegendDotsRow}>
                        {cruiseMapRegions.slice(0, 4).map((region) => (
                          <View key={`legend-dot-${region.region}`} style={[styles.mapLegendDot, { backgroundColor: region.color }]} />
                        ))}
                      </View>
                      <Text style={styles.mapLegendText}>{cruiseMapPoints.length} color-coded city dots mark ports traveled to. Brighter glows mean repeat visits.</Text>
                    </View>
                    <View style={styles.mapRegionGrid}>
                      {cruiseMapRegions.map((region) => (
                        <View key={region.region} style={styles.mapRegionPill}>
                          <View style={[styles.mapRegionDot, { backgroundColor: region.color }]} />
                          <Text style={styles.mapRegionText} numberOfLines={1}>{region.region}</Text>
                          <Text style={styles.mapRegionCount}>{region.destinationCount}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.mapNumbersRow}>
                      <View style={styles.mapNumberCell}>
                        <Text style={styles.mapNumberValue}>{lifetimeCountries.length}</Text>
                        <Text style={styles.mapNumberLabel}>Countries</Text>
                      </View>
                      <View style={styles.mapNumberCell}>
                        <Text style={styles.mapNumberValue}>{destinationRows.length}</Text>
                        <Text style={styles.mapNumberLabel}>Destinations</Text>
                      </View>
                      <View style={styles.mapNumberCell}>
                        <Text style={styles.mapNumberValue}>{new Set(visits.map((visit) => visit.shipName)).size}</Text>
                        <Text style={styles.mapNumberLabel}>Ships</Text>
                      </View>
                    </View>
                  </View>
                )}
                {detailMode === 'countries' ? (
                  <View style={styles.detailList} testID="countries-all-countries-list">
                    {lifetimeCountryRows.map((item, index) => (
                      <View key={item.country} style={styles.detailRow} testID={`countries-country-row-${index}`}>
                        <View style={styles.detailIndexBadge}>
                          <Text style={styles.detailIndexText}>{index + 1}</Text>
                        </View>
                        <View style={styles.detailTextGroup}>
                          <Text style={styles.detailRowTitle}>{item.country}</Text>
                          <Text style={styles.detailRowSubtitle}>{item.visitCount} visits • {item.portCount} ports • {item.shipCount} ships</Text>
                        </View>
                        {item.latestDate.length > 0 && <Text style={styles.detailDateText}>{formatVisitDate(item.latestDate)}</Text>}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.detailList} testID="countries-all-port-visits-list">
                    {destinationRows.map((destination, index) => {
                      const isExpanded = expandedDestinationKey === destination.key;
                      return (
                        <View key={destination.key} style={styles.destinationGroup} testID={`countries-destination-group-${index}`}>
                          <TouchableOpacity
                            style={[styles.detailRow, isExpanded && styles.detailRowExpanded]}
                            onPress={() => handleDestinationPress(destination)}
                            activeOpacity={0.78}
                            accessibilityRole="button"
                            accessibilityLabel={`Show ${destination.visitCount} visits to ${destination.port}`}
                            testID={`countries-destination-row-${index}`}
                          >
                            <View style={[styles.detailIndexBadge, styles.detailPortIndexBadge]}>
                              <Text style={styles.detailIndexText}>{destination.visitCount}</Text>
                            </View>
                            <View style={styles.detailTextGroup}>
                              <Text style={styles.detailRowTitle}>{destination.port}</Text>
                              <Text style={styles.detailRowSubtitle}>{destination.country} • {formatCount(destination.visitCount, 'visit')} • {formatCount(destination.shipCount, 'ship')}</Text>
                              {destination.latestDate.length > 0 && <Text style={styles.detailShipText}>Latest: {formatVisitDate(destination.latestDate)}</Text>}
                            </View>
                            {isExpanded ? <ChevronDown size={18} color={COLORS.tealAccent} /> : <ChevronRight size={18} color={COLORS.textMuted} />}
                          </TouchableOpacity>
                          {isExpanded && (
                            <View style={styles.destinationVisitsWrap} testID={`countries-destination-visits-${index}`}>
                              {destination.visits.map((visit, visitIndex) => (
                                <View key={`${visit.id}-${visitIndex}`} style={styles.destinationVisitRow} testID={`countries-destination-visit-${index}-${visitIndex}`}>
                                  <View style={[styles.visitStatusDot, visit.isCompleted ? styles.completedDot : styles.upcomingDot]} />
                                  <View style={styles.destinationVisitTextGroup}>
                                    <Text style={styles.destinationVisitTitle}>{visit.shipName}</Text>
                                    <Text style={styles.destinationVisitSubtitle}>{formatVisitDate(visit.date)} • {visit.cruiseName}</Text>
                                  </View>
                                  <View style={[styles.detailStatusPill, visit.isCompleted ? styles.completedPill : styles.upcomingPill]}>
                                    <Text style={[styles.detailStatusText, visit.isCompleted ? styles.completedText : styles.upcomingText]}>{visit.isCompleted ? 'Done' : 'Soon'}</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={styles.filterRow} testID="countries-filter-tabs">
              {FILTERS.map((item) => {
                const isActive = filter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => {
                      console.log('[Countries] Filter selected:', item.key);
                      setFilter(item.key);
                      setSelectedYear(null);
                      setDetailMode(null);
                      setExpandedDestinationKey(null);
                    }}
                    activeOpacity={0.78}
                    testID={`countries-filter-${item.key}`}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {yearOptions.length > 0 && (
              <View style={styles.yearFilterWrap} testID="countries-year-filter">
                <TouchableOpacity
                  style={styles.yearFilterButton}
                  onPress={() => setShowYearFilter((current) => !current)}
                  activeOpacity={0.78}
                  testID="countries-year-filter-button"
                >
                  <View style={styles.yearFilterIconBadge}>
                    <CalendarDays size={15} color={COLORS.white} />
                  </View>
                  <View style={styles.yearFilterTextGroup}>
                    <Text style={styles.yearFilterLabel}>Year filter</Text>
                    <Text style={styles.yearFilterValue}>{activeYear}</Text>
                  </View>
                  <Text style={styles.yearFilterCount}>{yearOptions.length} years</Text>
                </TouchableOpacity>
                {showYearFilter && (
                  <View style={styles.yearOptionsPanel} testID="countries-year-options-panel">
                    {yearOptions.map((year) => {
                      const isActive = year === activeYear;
                      const summary = summaries.find((item) => item.year === year);
                      return (
                        <TouchableOpacity
                          key={year}
                          style={[styles.yearOptionRow, isActive && styles.yearOptionRowActive]}
                          onPress={() => {
                            console.log('[Countries] Year selected:', year);
                            setSelectedYear(year);
                            setShowYearFilter(false);
                          }}
                          activeOpacity={0.78}
                          testID={`countries-year-option-${year}`}
                        >
                          <Text style={[styles.yearOptionText, isActive && styles.yearOptionTextActive]}>{year}</Text>
                          <Text style={[styles.yearOptionMeta, isActive && styles.yearOptionTextActive]}>{summary?.countries.length ?? 0} countries • {summary?.ports.length ?? 0} ports</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {visits.length === 0 ? (
              <View style={styles.emptyCard} testID="countries-empty-state">
                <View style={styles.emptyIconBadge}>
                  <MapPin size={34} color={COLORS.navyDeep} />
                </View>
                <Text style={styles.emptyTitle}>No countries found yet</Text>
                <Text style={styles.emptyText}>Add booked cruises with ports or itineraries, then return here to see your yearly country calendar.</Text>
              </View>
            ) : (
              <>
                <View style={styles.yearSummaryCard} testID="countries-year-summary">
                  <Text style={styles.sectionEyebrow}>{activeYear}</Text>
                  <Text style={styles.sectionTitle}>{activeYearCountries.length} countries • {activeYearPorts.length} ports</Text>
                  <View style={styles.countryChipsWrap}>
                    {activeYearCountries.map((country) => (
                      <View key={country} style={styles.countryChip}>
                        <Text style={styles.countryChipText}>{country}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.calendarGrid} testID="countries-year-calendar">
                  {MONTH_LABELS.map((month, index) => {
                    const monthVisits = visitsByMonth.get(index) ?? [];
                    const monthCountries = Array.from(new Set(monthVisits.map((visit) => visit.country)));
                    const monthPortLines = monthVisits.slice(0, 3);
                    return (
                      <View key={month} style={[styles.monthCard, monthVisits.length > 0 && styles.monthCardActive]}>
                        <Text style={[styles.monthLabel, monthVisits.length > 0 && styles.monthLabelActive]}>{month}</Text>
                        {monthVisits.length > 0 ? (
                          <>
                            <Text style={styles.monthCount}>{monthCountries.length} {monthCountries.length === 1 ? 'country' : 'countries'}</Text>
                            {monthPortLines.map((visit) => (
                              <Text key={`${month}-${visit.id}`} style={styles.monthPortLine} numberOfLines={2}>{visit.port} • {visit.shipName}</Text>
                            ))}
                            {monthVisits.length > monthPortLines.length && (
                              <Text style={styles.monthMoreText}>+{monthVisits.length - monthPortLines.length} more port visits</Text>
                            )}
                          </>
                        ) : (
                          <Text style={styles.monthEmpty}>No ports</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.visitsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Anchor size={18} color={COLORS.navyDeep} />
                    <Text style={styles.visitsSectionTitle}>Port visits in {activeYear}</Text>
                  </View>
                  {activeYearVisits.map((visit) => (
                    <View key={visit.id} style={styles.visitCard} testID="countries-visit-card">
                      <View style={styles.visitIconBadge}>
                        <MapPin size={16} color={COLORS.white} />
                      </View>
                      <View style={styles.visitTextGroup}>
                        <Text style={styles.visitTitle}>{visit.port}</Text>
                        <Text style={styles.visitSubtitle}>{visit.country} • {formatVisitDate(visit.date)}</Text>
                        <View style={styles.visitShipRow}>
                          <Ship size={12} color={COLORS.textMuted} />
                          <Text style={styles.visitShipText}>{visit.shipName} • {visit.cruiseName}</Text>
                        </View>
                      </View>
                      <View style={[styles.visitStatusPill, visit.isCompleted ? styles.completedPill : styles.upcomingPill]}>
                        <Text style={[styles.visitStatusText, visit.isCompleted ? styles.completedText : styles.upcomingText]}>
                          {visit.isCompleted ? 'Done' : 'Soon'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F1',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  headerSpacer: {
    width: 42,
  },
  heroCard: {
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  heroIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroTextGroup: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    color: COLORS.beigeLight,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '900' as const,
    color: COLORS.white,
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
    marginBottom: SPACING.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroStatPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroStatPillActive: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderColor: 'rgba(255,255,255,0.52)',
  },
  heroStatValue: {
    fontSize: 21,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 1,
  },
  detailPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,151,167,0.22)',
    ...SHADOW.md,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  detailHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  detailCloseButton: {
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.bgTertiary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  detailCloseText: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  detailSubtitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  cruiseMapCard: {
    backgroundColor: '#071B2D',
    borderRadius: 22,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(215,168,76,0.42)',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  cruiseMapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  cruiseMapEyebrow: {
    fontSize: 9,
    fontWeight: '900' as const,
    letterSpacing: 1.1,
    color: '#F8D77E',
  },
  cruiseMapTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900' as const,
    color: '#FFF4D6',
    marginTop: 2,
  },
  compassBadge: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(248,215,126,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  compassNorth: {
    fontSize: 9,
    fontWeight: '900' as const,
    color: '#F8D77E',
    position: 'absolute' as const,
    top: 2,
  },
  compassLineVertical: {
    position: 'absolute' as const,
    width: 1,
    height: 27,
    backgroundColor: 'rgba(248,215,126,0.55)',
  },
  compassLineHorizontal: {
    position: 'absolute' as const,
    width: 27,
    height: 1,
    backgroundColor: 'rgba(248,215,126,0.55)',
  },
  mapCanvasWrap: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#08243B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapLegendNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,215,126,0.14)',
  },
  mapLegendDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -2,
    borderWidth: 1,
    borderColor: '#FFF6D6',
  },
  mapLegendText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800' as const,
    color: 'rgba(255,244,214,0.84)',
  },
  mapRegionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
  },
  mapRegionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mapRegionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mapRegionText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#EAF7F8',
  },
  mapRegionCount: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#F8D77E',
  },
  mapNumbersRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(248,215,126,0.22)',
    paddingTop: SPACING.sm,
  },
  mapNumberCell: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(248,215,126,0.18)',
  },
  mapNumberValue: {
    fontSize: 19,
    fontWeight: '900' as const,
    color: '#F8D77E',
  },
  mapNumberLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: 'rgba(255,244,214,0.78)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  detailList: {
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FBFB',
    borderRadius: 16,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  detailRowExpanded: {
    backgroundColor: '#ECFEFF',
    borderColor: 'rgba(0,151,167,0.4)',
  },
  destinationGroup: {
    gap: 0,
  },
  destinationVisitsWrap: {
    marginLeft: 16,
    marginTop: 0,
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.sm,
    paddingTop: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0,151,167,0.18)',
    gap: SPACING.xs,
  },
  destinationVisitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,151,167,0.12)',
    gap: SPACING.sm,
  },
  visitStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  completedDot: {
    backgroundColor: COLORS.success,
  },
  upcomingDot: {
    backgroundColor: COLORS.warning,
  },
  destinationVisitTextGroup: {
    flex: 1,
  },
  destinationVisitTitle: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  destinationVisitSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  detailIndexBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  detailPortIndexBadge: {
    backgroundColor: COLORS.tealAccent,
  },
  detailIndexText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  detailTextGroup: {
    flex: 1,
  },
  detailRowTitle: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  detailRowSubtitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  detailShipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  detailDateText: {
    maxWidth: 82,
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.tealAccent,
    textAlign: 'right' as const,
  },
  detailStatusPill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailStatusText: {
    fontSize: 10,
    fontWeight: '900' as const,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 4,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  filterPillActive: {
    backgroundColor: COLORS.navyDeep,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  yearFilterWrap: {
    marginBottom: SPACING.md,
  },
  yearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  yearFilterIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearFilterTextGroup: {
    flex: 1,
  },
  yearFilterLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  yearFilterValue: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginTop: 1,
  },
  yearFilterCount: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.tealAccent,
  },
  yearOptionsPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: SPACING.sm,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  yearOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  yearOptionRowActive: {
    backgroundColor: COLORS.navyDeep,
  },
  yearOptionText: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  yearOptionMeta: {
    flex: 1,
    textAlign: 'right' as const,
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textMuted,
  },
  yearOptionTextActive: {
    color: COLORS.white,
  },
  yearScrollContent: {
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.md,
  },
  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  yearPillActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  yearPillTextActive: {
    color: COLORS.white,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: SPACING.md,
  },
  emptyIconBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  yearSummaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: COLORS.tealAccent,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  countryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  countryChip: {
    backgroundColor: 'rgba(0,151,167,0.1)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,151,167,0.18)',
  },
  countryChipText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  monthCard: {
    width: '31.9%',
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  monthCardActive: {
    backgroundColor: COLORS.white,
    borderColor: 'rgba(0,151,167,0.35)',
    ...SHADOW.sm,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  monthLabelActive: {
    color: COLORS.tealAccent,
  },
  monthCount: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  monthCountries: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textDarkGrey,
  },
  monthPortLine: {
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  monthMoreText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: COLORS.tealAccent,
    marginTop: 4,
  },
  monthEmpty: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  visitsSection: {
    gap: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  visitsSectionTitle: {
    fontSize: 17,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  visitIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.tealAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitTextGroup: {
    flex: 1,
  },
  visitTitle: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  visitSubtitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  visitShipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  visitShipText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  visitStatusPill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  completedPill: {
    backgroundColor: 'rgba(5,150,105,0.12)',
  },
  upcomingPill: {
    backgroundColor: 'rgba(245,158,11,0.14)',
  },
  visitStatusText: {
    fontSize: 11,
    fontWeight: '900' as const,
  },
  completedText: {
    color: COLORS.success,
  },
  upcomingText: {
    color: COLORS.warning,
  },
});
