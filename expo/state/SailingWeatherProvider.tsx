import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import type { ItineraryDay } from '@/types/models';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetItem, quotaSafeSetJsonItem, quotaSafeRemoveItem } from '@/lib/storage/quotaSafeStorage';
import { useAuth } from './AuthProvider';

const BASE_STORAGE_KEY = '@easy_seas_sailing_weather_cache_v1';
const CACHE_REFRESH_MS = 1000 * 60 * 60 * 6;
const CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 10;
const FORECAST_PREFETCH_HORIZON_DAYS = 15;
const FORECAST_PREFETCH_START_SOON_DAYS = 3;
const FORECAST_PREFETCH_WINDOW_DAYS = 2;
const FORECAST_PREFETCH_MAX_CRUISE_DAYS = 8;

const PORT_COORDINATES: Record<string, { latitude: number; longitude: number; label: string }> = {
  miami: { latitude: 25.7781, longitude: -80.1794, label: 'Miami' },
  'port miami': { latitude: 25.7781, longitude: -80.1794, label: 'Miami' },
  'fort lauderdale': { latitude: 26.0956, longitude: -80.1217, label: 'Fort Lauderdale' },
  'port everglades': { latitude: 26.0906, longitude: -80.1186, label: 'Port Everglades' },
  'port canaveral': { latitude: 28.4102, longitude: -80.631, label: 'Port Canaveral' },
  orlando: { latitude: 28.4102, longitude: -80.631, label: 'Port Canaveral' },
  tampa: { latitude: 27.9513, longitude: -82.4572, label: 'Tampa' },
  galveston: { latitude: 29.3013, longitude: -94.7977, label: 'Galveston' },
  'new orleans': { latitude: 29.947, longitude: -90.0628, label: 'New Orleans' },
  seattle: { latitude: 47.6062, longitude: -122.3321, label: 'Seattle' },
  vancouver: { latitude: 49.2827, longitude: -123.1207, label: 'Vancouver' },
  'los angeles': { latitude: 33.7405, longitude: -118.2775, label: 'Los Angeles' },
  'long beach': { latitude: 33.7683, longitude: -118.1956, label: 'Long Beach' },
  'san pedro': { latitude: 33.7361, longitude: -118.2923, label: 'San Pedro' },
  'san diego': { latitude: 32.7157, longitude: -117.1611, label: 'San Diego' },
  'catalina island': { latitude: 33.3879, longitude: -118.4163, label: 'Catalina Island' },
  avalon: { latitude: 33.3428, longitude: -118.3278, label: 'Avalon' },
  ensenada: { latitude: 31.8667, longitude: -116.6167, label: 'Ensenada' },
  'ensenada mexico': { latitude: 31.8667, longitude: -116.6167, label: 'Ensenada' },
  'cabo san lucas': { latitude: 22.8905, longitude: -109.9167, label: 'Cabo San Lucas' },
  cabo: { latitude: 22.8905, longitude: -109.9167, label: 'Cabo San Lucas' },
  mazatlan: { latitude: 23.2494, longitude: -106.4111, label: 'Mazatlán' },
  'puerto vallarta': { latitude: 20.6534, longitude: -105.2253, label: 'Puerto Vallarta' },
  'la paz': { latitude: 24.1426, longitude: -110.3128, label: 'La Paz' },
  loreto: { latitude: 26.011, longitude: -111.3447, label: 'Loreto' },
  manzanillo: { latitude: 19.0522, longitude: -104.3158, label: 'Manzanillo' },
  acapulco: { latitude: 16.8531, longitude: -99.8237, label: 'Acapulco' },
  huatulco: { latitude: 15.7683, longitude: -96.1292, label: 'Huatulco' },
  'puerto chiapas': { latitude: 14.7069, longitude: -92.3983, label: 'Puerto Chiapas' },
  salina: { latitude: 16.175, longitude: -95.2, label: 'Salina Cruz' },
  'salina cruz': { latitude: 16.175, longitude: -95.2, label: 'Salina Cruz' },
  nassau: { latitude: 25.078, longitude: -77.3431, label: 'Nassau' },
  'nassau bahamas': { latitude: 25.078, longitude: -77.3431, label: 'Nassau, Bahamas' },
  bahamas: { latitude: 25.0343, longitude: -77.3963, label: 'Northwest Bahamas' },
  'berry islands': { latitude: 25.625, longitude: -77.825, label: 'Berry Islands / CocoCay' },
  'northwest bahamas': { latitude: 25.55, longitude: -78.0, label: 'Northwest Bahamas marine zone' },
  'florida straits': { latitude: 24.8, longitude: -80.2, label: 'Florida Straits marine zone' },
  'western atlantic': { latitude: 26.0, longitude: -76.5, label: 'Western Atlantic marine zone' },
  cococay: { latitude: 25.8184, longitude: -77.9428, label: 'Perfect Day at CocoCay' },
  'coco cay': { latitude: 25.8184, longitude: -77.9428, label: 'Perfect Day at CocoCay' },
  'perfect day at cococay': { latitude: 25.8184, longitude: -77.9428, label: 'Perfect Day at CocoCay' },
  labadee: { latitude: 19.7932, longitude: -72.2456, label: 'Labadee' },
  cozumel: { latitude: 20.423, longitude: -86.9223, label: 'Cozumel' },
  'costa maya': { latitude: 18.715, longitude: -87.6994, label: 'Costa Maya' },
  roatan: { latitude: 16.3168, longitude: -86.5519, label: 'Roatan' },
  'roatan honduras': { latitude: 16.3168, longitude: -86.5519, label: 'Roatan' },
  'st thomas': { latitude: 18.3419, longitude: -64.9307, label: 'St. Thomas' },
  'st. thomas': { latitude: 18.3419, longitude: -64.9307, label: 'St. Thomas' },
  'charlotte amalie': { latitude: 18.3419, longitude: -64.9307, label: 'St. Thomas' },
  basseterre: { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'basseterre st kitts': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'basseterre saint kitts': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'st kitts': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'st. kitts': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'saint kitts': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'saint kitts nevis': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'st kitts nevis': { latitude: 17.2948, longitude: -62.7261, label: 'Basseterre, St. Kitts' },
  'san juan': { latitude: 18.4655, longitude: -66.1057, label: 'San Juan' },
  'puerto plata': { latitude: 19.7939, longitude: -70.6871, label: 'Puerto Plata' },
  'eastern caribbean': { latitude: 18.0, longitude: -64.3, label: 'Eastern Caribbean marine zone' },
  'st maarten': { latitude: 18.0425, longitude: -63.0548, label: 'St. Maarten' },
  'st. maarten': { latitude: 18.0425, longitude: -63.0548, label: 'St. Maarten' },
  'philipsburg': { latitude: 18.0252, longitude: -63.0458, label: 'Philipsburg' },
  keywest: { latitude: 24.5551, longitude: -81.78, label: 'Key West' },
  'key west': { latitude: 24.5551, longitude: -81.78, label: 'Key West' },
  civitavecchia: { latitude: 42.0933, longitude: 11.7956, label: 'Civitavecchia' },
  rome: { latitude: 42.0933, longitude: 11.7956, label: 'Civitavecchia' },
  barcelona: { latitude: 41.3851, longitude: 2.1734, label: 'Barcelona' },
  marseille: { latitude: 43.2965, longitude: 5.3698, label: 'Marseille' },
  naples: { latitude: 40.8518, longitude: 14.2681, label: 'Naples' },
  athens: { latitude: 37.942, longitude: 23.6465, label: 'Piraeus' },
  piraeus: { latitude: 37.942, longitude: 23.6465, label: 'Piraeus' },
  santorini: { latitude: 36.3932, longitude: 25.4615, label: 'Santorini' },
  mykonos: { latitude: 37.4467, longitude: 25.3289, label: 'Mykonos' },
  juneau: { latitude: 58.3005, longitude: -134.4201, label: 'Juneau' },
  skagway: { latitude: 59.4583, longitude: -135.3139, label: 'Skagway' },
  ketchikan: { latitude: 55.3422, longitude: -131.6461, label: 'Ketchikan' },
  sitka: { latitude: 57.0531, longitude: -135.33, label: 'Sitka' },
  victoria: { latitude: 48.4284, longitude: -123.3656, label: 'Victoria' },
};

const SORTED_PORT_COORDINATE_KEYS = Object.keys(PORT_COORDINATES).sort((left, right) => right.length - left.length);

type SailingWeatherSource = 'live' | 'cache-fresh' | 'cache-stale' | 'offline-placeholder';

interface SailingWeatherPoint {
  isoTime: string;
  label: string;
  temperatureF: number | null;
  windMph: number | null;
  windGustMph: number | null;
  windDirectionDegrees: number | null;
  waveHeightFt: number | null;
  waveDirectionDegrees: number | null;
  wavePeriodSeconds: number | null;
  swellWaveHeightFt: number | null;
  swellWaveDirectionDegrees: number | null;
  swellWavePeriodSeconds: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
}

interface SailingWeatherAdvisory {
  id: string;
  severity: 'info' | 'watch' | 'warning';
  title: string;
  detail: string;
}

export interface SailingWeatherForecast {
  cacheKey: string;
  cruiseId: string;
  shipName: string;
  dateKey: string;
  locationName: string;
  zoneLabel: string;
  latitude: number;
  longitude: number;
  timezone: string;
  updatedAt: string;
  nextRefreshAt: string;
  source: SailingWeatherSource;
  isStale: boolean;
  isSeaDay: boolean;
  summary: string;
  headline: string;
  advisories: SailingWeatherAdvisory[];
  metrics: {
    highTempF: number | null;
    lowTempF: number | null;
    maxWindMph: number | null;
    maxWindGustMph: number | null;
    dominantWindDirectionDegrees: number | null;
    maxWaveHeightFt: number | null;
    maxWavePeriodSeconds: number | null;
    dominantWaveDirectionDegrees: number | null;
    maxSwellHeightFt: number | null;
    dominantSwellDirectionDegrees: number | null;
    precipitationChance: number | null;
    conditionLabel: string;
  };
  snapshots: SailingWeatherPoint[];
  hourly: SailingWeatherPoint[];
}

export interface SailingWeatherCruiseInput {
  id: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  departurePort?: string;
  destination?: string;
  itineraryName?: string;
  nights: number;
  itinerary?: ItineraryDay[];
}

interface SailingWeatherState {
  isHydrated: boolean;
  getForecastForCruiseDay: (
    cruise: SailingWeatherCruiseInput,
    targetDate: Date,
    options?: { force?: boolean }
  ) => Promise<SailingWeatherForecast | null>;
  prefetchCruiseForecastWindow: (
    cruise: SailingWeatherCruiseInput,
    options?: { anchorDate?: Date; force?: boolean }
  ) => Promise<void>;
  clearWeatherCache: () => Promise<void>;
}

interface PortCoordinates {
  latitude: number;
  longitude: number;
  label: string;
}

interface ResolvedCruiseWeatherPoint extends PortCoordinates {
  isSeaDay: boolean;
  zoneLabel: string;
}

interface ForecastApiResponse {
  timezone?: string;
  timezone_abbreviation?: string;
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
    wind_direction_10m_dominant?: number[];
    weather_code?: number[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    wind_direction_10m?: number[];
    weather_code?: number[];
  };
}

interface MarineApiResponse {
  daily?: {
    wave_height_max?: number[];
    wave_direction_dominant?: number[];
    wave_period_max?: number[];
    swell_wave_height_max?: number[];
    swell_wave_direction_dominant?: number[];
  };
  hourly?: {
    time?: string[];
    wave_height?: number[];
    wave_direction?: number[];
    wave_period?: number[];
    swell_wave_height?: number[];
    swell_wave_direction?: number[];
    swell_wave_period?: number[];
  };
}

function normalizePortName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bport of\b/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPortLookupCandidates(rawValue: string): string[] {
  const normalized = normalizePortName(rawValue);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([normalized]);

  rawValue
    .split(/[,&/;]|→|->/)
    .map((segment) => normalizePortName(segment))
    .filter(Boolean)
    .forEach((segment) => {
      candidates.add(segment);
    });

  normalized
    .split(/\b(?:and|to|via)\b/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      candidates.add(segment);
    });

  return Array.from(candidates);
}

function matchKnownPortCoordinates(normalizedValue: string): PortCoordinates | null {
  const directMatch = PORT_COORDINATES[normalizedValue];
  if (directMatch) {
    return directMatch;
  }

  for (const key of SORTED_PORT_COORDINATE_KEYS) {
    if (
      normalizedValue.startsWith(`${key} `)
      || normalizedValue.endsWith(` ${key}`)
      || normalizedValue.includes(` ${key} `)
      || key.startsWith(`${normalizedValue} `)
      || key.endsWith(` ${normalizedValue}`)
    ) {
      return PORT_COORDINATES[key] ?? null;
    }
  }

  return null;
}

function resolveKnownPortCoordinates(rawValue: string): PortCoordinates | null {
  for (const candidate of buildPortLookupCandidates(rawValue)) {
    const knownCoordinates = matchKnownPortCoordinates(candidate);
    if (knownCoordinates) {
      return knownCoordinates;
    }
  }

  return null;
}

function roundNumber(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getCruiseEndDate(cruise: Pick<SailingWeatherCruiseInput, 'sailDate' | 'returnDate' | 'nights'>): Date | null {
  const start = startOfDay(new Date(cruise.sailDate));
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const explicitEnd = startOfDay(new Date(cruise.returnDate));
  if (!Number.isNaN(explicitEnd.getTime()) && explicitEnd >= start) {
    return explicitEnd;
  }

  const inferredNights = typeof cruise.nights === 'number' && Number.isFinite(cruise.nights) && cruise.nights >= 0
    ? cruise.nights
    : 0;
  return addDays(start, inferredNights);
}

function isSameDay(left: Date, right: Date): boolean {
  return formatDateKey(left) === formatDateKey(right);
}

function buildCruiseDateRange(cruise: SailingWeatherCruiseInput): Date[] {
  const start = startOfDay(new Date(cruise.sailDate));
  const end = getCruiseEndDate(cruise);
  if (Number.isNaN(start.getTime()) || !end || end < start) {
    return [];
  }

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildPrefetchDates(cruise: SailingWeatherCruiseInput, anchorDate?: Date): Date[] {
  const today = startOfDay(new Date());
  const anchor = startOfDay(anchorDate ?? today);
  const horizonEnd = addDays(today, FORECAST_PREFETCH_HORIZON_DAYS);
  const cruiseDates = buildCruiseDateRange(cruise).filter((date) => date <= horizonEnd);
  if (cruiseDates.length === 0) {
    return [];
  }

  const cruiseStart = cruiseDates[0];
  const startsSoon = cruiseStart >= today && cruiseStart <= addDays(today, FORECAST_PREFETCH_START_SOON_DAYS);
  if (startsSoon && cruiseDates.length <= FORECAST_PREFETCH_MAX_CRUISE_DAYS) {
    return cruiseDates.filter((date) => date >= today);
  }

  const remainingCruiseDates = cruiseDates.filter((date) => date >= anchor && date >= today);
  if (remainingCruiseDates.length > 0 && remainingCruiseDates.length <= FORECAST_PREFETCH_MAX_CRUISE_DAYS) {
    return remainingCruiseDates;
  }

  const windowStart = addDays(anchor, -1);
  const windowEnd = addDays(anchor, FORECAST_PREFETCH_WINDOW_DAYS);
  return cruiseDates.filter((date) => date >= windowStart && date <= windowEnd && (date >= today || isSameDay(date, today)));
}

function createCacheKey(cruiseId: string, dateKey: string, latitude: number, longitude: number): string {
  return `${cruiseId}:${dateKey}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNullableNumber(value: unknown): number | null {
  return isNumber(value) ? value : null;
}

function isCacheExpired(updatedAt: string): boolean {
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return true;
  return Date.now() - updatedTime > CACHE_REFRESH_MS;
}

function pruneCacheEntries(cache: Record<string, SailingWeatherForecast>): Record<string, SailingWeatherForecast> {
  const cutoff = Date.now() - CACHE_RETENTION_MS;
  const nextEntries = Object.entries(cache).filter(([, value]) => {
    const updatedTime = new Date(value.updatedAt).getTime();
    return Number.isFinite(updatedTime) && updatedTime >= cutoff;
  });
  return Object.fromEntries(nextEntries);
}

function getDayOfCruise(cruise: SailingWeatherCruiseInput, targetDate: Date): number {
  const start = new Date(cruise.sailDate);
  start.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}


function getCruiseLengthDays(cruise: SailingWeatherCruiseInput): number {
  const start = startOfDay(new Date(cruise.sailDate));
  const end = getCruiseEndDate(cruise);
  if (Number.isNaN(start.getTime()) || !end || end < start) {
    return Math.max(1, (cruise.nights || 0) + 1);
  }
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function hasUsableItinerary(itinerary?: ItineraryDay[]): boolean {
  return Array.isArray(itinerary) && itinerary.some((item) => Boolean(item.port?.trim()) && normalizePortName(item.port) !== 'at sea');
}

function makeSyntheticItineraryDay(day: number, port: string, isSeaDay = false, notes?: string): ItineraryDay {
  return {
    day,
    port,
    isSeaDay,
    notes,
  };
}

function getNormalizedSailDateText(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function matchesDate(value: string | undefined, isoDate: string, usDate: string): boolean {
  const normalized = getNormalizedSailDateText(value);
  return normalized.includes(isoDate.toLowerCase()) || normalized.includes(usDate.toLowerCase());
}

function getKnownExactItinerary(cruise: SailingWeatherCruiseInput): ItineraryDay[] | null {
  const routeText = [cruise.shipName, cruise.destination, cruise.itineraryName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Royal's public/app itinerary for Star of the Seas 07-05-2026 Eastern Caribbean & Perfect Day.
  // This prevents the weather engine from falling back to a generic Eastern Caribbean template
  // that incorrectly used Philipsburg for Day 5.
  const isStarJuly2026Sailing = routeText.includes('star of the seas')
    && matchesDate(cruise.sailDate, '2026-07-05', '07-05-2026');
  const starJulyReturnDate = getCruiseEndDate(cruise);
  const isStarJuly7NightWindow = starJulyReturnDate ? formatDateKey(starJulyReturnDate) === '2026-07-12' : (cruise.nights ?? 0) === 7;

  if (isStarJuly2026Sailing && isStarJuly7NightWindow) {
    return [
      makeSyntheticItineraryDay(1, cruise.departurePort || 'Port Canaveral', false, 'Embarkation port'),
      makeSyntheticItineraryDay(2, 'Perfect Day at CocoCay', false, 'Official itinerary port'),
      makeSyntheticItineraryDay(3, 'Northwest Bahamas', true, 'Sea-day marine zone after CocoCay'),
      makeSyntheticItineraryDay(4, 'Charlotte Amalie, St. Thomas', false, 'Official itinerary port'),
      makeSyntheticItineraryDay(5, 'Basseterre, St. Kitts & Nevis', false, 'Official itinerary port'),
      makeSyntheticItineraryDay(6, 'Western Atlantic', true, 'Return-route marine zone'),
      makeSyntheticItineraryDay(7, 'Western Atlantic', true, 'Return-route marine zone'),
      makeSyntheticItineraryDay(8, cruise.departurePort || 'Port Canaveral', false, 'Return port'),
    ];
  }

  return null;
}

function inferRouteItinerary(cruise: SailingWeatherCruiseInput): ItineraryDay[] {
  const exactItinerary = getKnownExactItinerary(cruise);
  if (exactItinerary) {
    return exactItinerary;
  }

  if (hasUsableItinerary(cruise.itinerary)) {
    return cruise.itinerary ?? [];
  }

  const totalDays = getCruiseLengthDays(cruise);
  const departurePort = cruise.departurePort || 'Port Canaveral';
  const routeText = [cruise.shipName, cruise.destination, cruise.itineraryName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (totalDays <= 1) {
    return [makeSyntheticItineraryDay(1, departurePort, false, 'Departure-port fallback')];
  }

  const days: ItineraryDay[] = [makeSyntheticItineraryDay(1, departurePort, false, 'Embarkation port')];
  const addReturn = () => {
    days.push(makeSyntheticItineraryDay(totalDays, departurePort, false, 'Return port'));
  };

  if (routeText.includes('eastern caribbean') && routeText.includes('perfect day')) {
    days.push(makeSyntheticItineraryDay(2, 'Perfect Day at CocoCay', false, 'Inferred from Eastern Caribbean & Perfect Day itinerary name'));
    if (totalDays >= 4) days.push(makeSyntheticItineraryDay(3, 'Northwest Bahamas', true, 'Inferred sea-day marine zone between Florida and the Eastern Caribbean'));
    if (totalDays >= 5) days.push(makeSyntheticItineraryDay(4, 'Eastern Caribbean', true, 'Exact port unavailable; using broad Eastern Caribbean marine zone instead of inventing a named port'));
    if (totalDays >= 6) days.push(makeSyntheticItineraryDay(5, 'Eastern Caribbean', true, 'Exact port unavailable; using broad Eastern Caribbean marine zone instead of inventing a named port'));
    for (let day = 6; day < totalDays; day += 1) {
      days.push(makeSyntheticItineraryDay(day, 'Western Atlantic', true, 'Inferred return-route marine zone'));
    }
    addReturn();
    return days.filter((item, index, all) => all.findIndex((other) => other.day === item.day) === index);
  }

  if (routeText.includes('bahamas') || routeText.includes('perfect day') || routeText.includes('cococay')) {
    if (totalDays >= 3) days.push(makeSyntheticItineraryDay(2, routeText.includes('perfect day') || routeText.includes('cococay') ? 'Perfect Day at CocoCay' : 'Northwest Bahamas', !routeText.includes('perfect day') && !routeText.includes('cococay'), 'Inferred Bahamas marine forecast target'));
    if (totalDays >= 4) days.push(makeSyntheticItineraryDay(3, routeText.includes('nassau') ? 'Nassau, Bahamas' : 'Northwest Bahamas', !routeText.includes('nassau'), 'Inferred Bahamas cruise day'));
    for (let day = 4; day < totalDays; day += 1) {
      days.push(makeSyntheticItineraryDay(day, 'Florida Straits', true, 'Inferred Bahamas route sea day'));
    }
    addReturn();
    return days.filter((item, index, all) => all.findIndex((other) => other.day === item.day) === index);
  }

  for (let day = 2; day < totalDays; day += 1) {
    days.push(makeSyntheticItineraryDay(day, cruise.destination || cruise.itineraryName || departurePort, true, 'Route itinerary unavailable; using destination as marine target'));
  }
  addReturn();
  return days.filter((item, index, all) => all.findIndex((other) => other.day === item.day) === index);
}

function findNearestPortDay(itinerary: ItineraryDay[] | undefined, startDay: number, direction: -1 | 1): ItineraryDay | undefined {
  if (!itinerary || itinerary.length === 0) return undefined;
  let cursor = startDay;
  for (let index = 0; index < itinerary.length + 2; index += 1) {
    cursor += direction;
    const match = itinerary.find((item) => item.day === cursor && !item.isSeaDay && item.port && normalizePortName(item.port) !== 'at sea');
    if (match) return match;
  }
  return undefined;
}

function describeWeatherCode(code: number | null): string {
  if (!isNumber(code)) return 'Marine outlook';
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Storm risk';
  return 'Marine outlook';
}

function getHourFromIso(value: string): number {
  const timePart = value.split('T')[1] ?? '';
  const hour = Number.parseInt(timePart.split(':')[0] ?? '0', 10);
  return Number.isFinite(hour) ? hour : 0;
}

function formatHourLabel(value: string): string {
  const hour = getHourFromIso(value);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${meridiem}`;
}

function toFeetFromMeters(value: number | null): number | null {
  if (!isNumber(value)) return null;
  return roundNumber(value * 3.28084, 1);
}

function getMaxValue(values: Array<number | null>): number | null {
  const filtered = values.filter(isNumber);
  if (filtered.length === 0) return null;
  return roundNumber(Math.max(...filtered), 1);
}

function getMinValue(values: Array<number | null>): number | null {
  const filtered = values.filter(isNumber);
  if (filtered.length === 0) return null;
  return roundNumber(Math.min(...filtered), 1);
}

function toDegrees(value: number | null): number | null {
  if (!isNumber(value)) return null;
  const normalized = ((value % 360) + 360) % 360;
  return roundNumber(normalized, 0);
}

function withinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function buildSnapshots(hourly: SailingWeatherPoint[]): SailingWeatherPoint[] {
  const targetHours = [
    { hour: 8, label: 'Morning' },
    { hour: 12, label: 'Midday' },
    { hour: 16, label: 'Afternoon' },
    { hour: 20, label: 'Evening' },
  ];

  return targetHours.map((target) => {
    const closest = hourly.reduce<SailingWeatherPoint | null>((best, candidate) => {
      if (!best) return candidate;
      const candidateDiff = Math.abs(getHourFromIso(candidate.isoTime) - target.hour);
      const bestDiff = Math.abs(getHourFromIso(best.isoTime) - target.hour);
      return candidateDiff < bestDiff ? candidate : best;
    }, null);

    if (!closest) {
      return {
        isoTime: '',
        label: target.label,
        temperatureF: null,
        windMph: null,
        windGustMph: null,
        windDirectionDegrees: null,
        waveHeightFt: null,
        waveDirectionDegrees: null,
        wavePeriodSeconds: null,
        swellWaveHeightFt: null,
        swellWaveDirectionDegrees: null,
        swellWavePeriodSeconds: null,
        precipitationProbability: null,
        weatherCode: null,
      };
    }

    return {
      ...closest,
      label: target.label,
    };
  });
}

function buildSummary(metrics: SailingWeatherForecast['metrics'], isSeaDay: boolean): { headline: string; summary: string } {
  const condition = metrics.conditionLabel;
  const tempLabel = metrics.highTempF !== null && metrics.lowTempF !== null
    ? `${Math.round(metrics.lowTempF)}°-${Math.round(metrics.highTempF)}°F`
    : 'temps pending';
  const windLabel = metrics.maxWindMph !== null ? `${Math.round(metrics.maxWindMph)} mph wind` : 'wind pending';
  const gustLabel = metrics.maxWindGustMph !== null ? `gusts ${Math.round(metrics.maxWindGustMph)} mph` : windLabel;
  const waveLabel = metrics.maxWaveHeightFt !== null ? `${roundNumber(metrics.maxWaveHeightFt, 1)} ft seas` : 'wave data pending';
  const swellLabel = metrics.maxSwellHeightFt !== null ? `${roundNumber(metrics.maxSwellHeightFt, 1)} ft swell` : waveLabel;
  const precipLabel = metrics.precipitationChance !== null ? `${Math.round(metrics.precipitationChance)}% precip` : 'precip pending';

  return {
    headline: `${condition} · ${tempLabel}`,
    summary: isSeaDay ? `${waveLabel} · ${gustLabel} · ${precipLabel}` : `${windLabel} · ${swellLabel} · ${precipLabel}`,
  };
}


function buildOfflinePlaceholderForecast(
  cruise: SailingWeatherCruiseInput,
  targetDate: Date,
  resolvedPoint: ResolvedCruiseWeatherPoint,
  reason?: string,
): SailingWeatherForecast {
  const dateKey = formatDateKey(targetDate);
  const updatedAt = new Date().toISOString();
  const metrics: SailingWeatherForecast['metrics'] = {
    highTempF: null,
    lowTempF: null,
    maxWindMph: null,
    maxWindGustMph: null,
    dominantWindDirectionDegrees: null,
    maxWaveHeightFt: null,
    maxWavePeriodSeconds: null,
    dominantWaveDirectionDegrees: null,
    maxSwellHeightFt: null,
    dominantSwellDirectionDegrees: null,
    precipitationChance: null,
    conditionLabel: 'Offline forecast saved as route card',
  };
  const emptyHourly: SailingWeatherPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    isoTime: `${dateKey}T${String(hour).padStart(2, '0')}:00`,
    label: formatHourLabel(`${dateKey}T${String(hour).padStart(2, '0')}:00`),
    temperatureF: null,
    windMph: null,
    windGustMph: null,
    windDirectionDegrees: null,
    waveHeightFt: null,
    waveDirectionDegrees: null,
    wavePeriodSeconds: null,
    swellWaveHeightFt: null,
    swellWaveDirectionDegrees: null,
    swellWavePeriodSeconds: null,
    precipitationProbability: null,
    weatherCode: null,
  }));
  return {
    cacheKey: createCacheKey(cruise.id, dateKey, resolvedPoint.latitude, resolvedPoint.longitude),
    cruiseId: cruise.id,
    shipName: cruise.shipName,
    dateKey,
    locationName: resolvedPoint.label,
    zoneLabel: resolvedPoint.zoneLabel,
    latitude: resolvedPoint.latitude,
    longitude: resolvedPoint.longitude,
    timezone: 'Offline',
    updatedAt,
    nextRefreshAt: new Date(Date.now() + CACHE_REFRESH_MS).toISOString(),
    source: 'offline-placeholder',
    isStale: true,
    isSeaDay: resolvedPoint.isSeaDay,
    headline: 'Offline route card',
    summary: reason || 'No internet connection or live marine forecast is unavailable. This card keeps the cruise day, route zone, and detailed forecast layout ready until service returns.',
    advisories: [
      {
        id: 'offline-weather-card',
        severity: 'info',
        title: 'Offline weather card',
        detail: 'Live wind, swell, precipitation, and temperature data are not available right now. The app will refresh this exact itinerary-day marine forecast when internet returns.',
      },
    ],
    metrics,
    snapshots: buildSnapshots(emptyHourly),
    hourly: emptyHourly,
  };
}

function buildMarineAdvisories(
  cruise: SailingWeatherCruiseInput,
  resolvedPoint: ResolvedCruiseWeatherPoint,
  metrics: SailingWeatherForecast['metrics'],
): SailingWeatherAdvisory[] {
  const advisories: SailingWeatherAdvisory[] = [];
  const normalizedContext = [resolvedPoint.label, cruise.destination, cruise.itineraryName, cruise.departurePort]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const inBajaZone = withinRange(resolvedPoint.latitude, 22, 32.6) && withinRange(resolvedPoint.longitude, -118.8, -105);
  const inTehuantepecZone = withinRange(resolvedPoint.latitude, 13.2, 17.6) && withinRange(resolvedPoint.longitude, -97.8, -91.8);
  const severeWind = Math.max(metrics.maxWindMph ?? 0, metrics.maxWindGustMph ?? 0) >= 28;
  const severeSeas = (metrics.maxWaveHeightFt ?? 0) >= 8;
  const stormRisk = metrics.conditionLabel === 'Storm risk' || (metrics.precipitationChance ?? 0) >= 70;

  if (inTehuantepecZone || normalizedContext.includes('tehuantepec') || normalizedContext.includes('huatulco') || normalizedContext.includes('puerto chiapas')) {
    advisories.push({
      id: 'tehuantepec-gap-wind',
      severity: severeWind || severeSeas ? 'warning' : 'watch',
      title: 'Gulf of Tehuantepec watch',
      detail: 'Gap-wind events here can ramp quickly and build steep seas. Recheck the latest forecast before sailaway and tender operations.',
    });
  }

  if (inBajaZone || normalizedContext.includes('ensenada') || normalizedContext.includes('cabo') || normalizedContext.includes('mazatlan') || normalizedContext.includes('vallarta') || normalizedContext.includes('baja')) {
    advisories.push({
      id: 'baja-pacific-pattern',
      severity: severeWind ? 'watch' : 'info',
      title: 'Baja / Mexican Riviera pattern',
      detail: 'The outer Baja and Riviera corridor often sees fresh NW flow and building swell. North of Punta Eugenia can turn choppier than the port forecast suggests.',
    });
  }

  if (severeWind || severeSeas) {
    advisories.push({
      id: 'rougher-marine-window',
      severity: severeWind && severeSeas ? 'warning' : 'watch',
      title: 'Rougher marine window',
      detail: `Model guidance is showing up to ${Math.round(metrics.maxWindGustMph ?? metrics.maxWindMph ?? 0)} mph wind and ${roundNumber(metrics.maxWaveHeightFt ?? 0, 1)} ft seas for this cruise day.`,
    });
  }

  if (stormRisk) {
    advisories.push({
      id: 'storm-or-squall-risk',
      severity: 'watch',
      title: 'Squall / rain risk',
      detail: 'Rain bands or squalls may shift timing quickly. Download the forecast early so you still have it offline when service drops.',
    });
  }

  return advisories.slice(0, 3);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stringifyLogValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return stringifyLogValue({
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
  }

  return stringifyLogValue(error);
}

function logSailingWeather(level: 'warn' | 'error', message: string, details?: Record<string, unknown>): void {
  const logger = level === 'warn' ? console.warn : console.error;
  if (!details) {
    logger(message);
    return;
  }

  logger(`${message} ${stringifyLogValue(details)}`);
}

function getResponseBodySnippet(bodyText: string): string | null {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 220);
}

function buildResponseError(message: string, response: Response, bodyText: string, url: string): Error {
  const bodySnippet = getResponseBodySnippet(bodyText);
  const contentType = response.headers.get('content-type');

  const detailParts = [
    `status=${response.status}`,
    response.statusText ? `statusText=${response.statusText}` : null,
    contentType ? `contentType=${contentType}` : null,
    bodySnippet ? `body=${bodySnippet}` : null,
    `url=${url}`,
  ].filter(Boolean);

  return new Error(`${message} (${detailParts.join(', ')})`);
}

async function fetchJson<T>(url: string, options?: { retries?: number; timeoutMs?: number }): Promise<T> {
  const retries = options?.retries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 15000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      console.log('[SailingWeather] Fetching JSON resource', {
        url,
        attempt: attempt + 1,
        timeoutMs,
      });

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      const responseText = await response.text();

      if (!response.ok) {
        throw buildResponseError('Request failed', response, responseText, url);
      }

      if (!responseText.trim()) {
        throw buildResponseError('Response body was empty', response, responseText, url);
      }

      try {
        return JSON.parse(responseText) as T;
      } catch (error) {
        throw buildResponseError(`Failed to parse JSON: ${serializeError(error)}`, response, responseText, url);
      }
    } catch (error) {
      lastError = error;
      const logLevel = attempt < retries ? 'warn' : 'error';
      logSailingWeather(logLevel, '[SailingWeather] JSON fetch attempt failed', {
        url,
        attempt: attempt + 1,
        retries: retries + 1,
        error: serializeError(error),
      });

      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch forecast data');
}

export const [SailingWeatherProvider, useSailingWeather] = createContextHook((): SailingWeatherState => {
  const { authenticatedEmail } = useAuth();
  const storageKeyRef = useRef<string>(getUserScopedKey(BASE_STORAGE_KEY, authenticatedEmail));
  const geocodeCacheRef = useRef<Map<string, PortCoordinates>>(new Map());
  const inFlightRef = useRef<Partial<Record<string, Promise<SailingWeatherForecast | null>>>>({});
  const [cache, setCache] = useState<Record<string, SailingWeatherForecast>>({});
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const cacheRef = useRef<Record<string, SailingWeatherForecast>>({});

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  useEffect(() => {
    storageKeyRef.current = getUserScopedKey(BASE_STORAGE_KEY, authenticatedEmail);
    setIsHydrated(false);

    const loadCache = async () => {
      try {
        const stored = await quotaSafeGetItem(storageKeyRef.current);
        if (!stored) {
          setCache({});
          setIsHydrated(true);
          console.log('[SailingWeather] No stored weather cache found');
          return;
        }

        const parsed = JSON.parse(stored) as Record<string, SailingWeatherForecast>;
        const pruned = pruneCacheEntries(parsed);
        setCache(pruned);
        cacheRef.current = pruned;
        console.log('[SailingWeather] Loaded cached forecasts:', Object.keys(pruned).length);
      } catch (error) {
        logSailingWeather('error', '[SailingWeather] Failed to load stored weather cache', {
          error: serializeError(error),
        });
        setCache({});
        cacheRef.current = {};
      } finally {
        setIsHydrated(true);
      }
    };

    void loadCache();
  }, [authenticatedEmail]);

  useEffect(() => {
    if (!isHydrated) return;

    const persistCache = async () => {
      try {
        const pruned = pruneCacheEntries(cache);
        if (Object.keys(pruned).length !== Object.keys(cache).length) {
          setCache(pruned);
          cacheRef.current = pruned;
          return;
        }
        await quotaSafeSetJsonItem(storageKeyRef.current, pruned);
        console.log('[SailingWeather] Persisted cached forecasts:', Object.keys(pruned).length);
      } catch (error) {
        logSailingWeather('error', '[SailingWeather] Failed to persist weather cache', {
          error: serializeError(error),
        });
      }
    };

    void persistCache();
  }, [cache, isHydrated]);

  const resolvePortCoordinates = useCallback(async (rawPortName: string | undefined): Promise<PortCoordinates | null> => {
    const portName = rawPortName?.trim();
    if (!portName) return null;

    const normalized = normalizePortName(portName);
    if (!normalized) return null;

    const localCoordinates = resolveKnownPortCoordinates(portName);
    if (localCoordinates) {
      console.log('[SailingWeather] Resolved port from bundled coordinates', {
        portName,
        label: localCoordinates.label,
        latitude: localCoordinates.latitude,
        longitude: localCoordinates.longitude,
      });
      geocodeCacheRef.current.set(normalized, localCoordinates);
      return localCoordinates;
    }

    const cached = geocodeCacheRef.current.get(normalized);
    if (cached) {
      return cached;
    }

    const candidates = buildPortLookupCandidates(portName);

    for (const candidate of candidates) {
      const searchName = encodeURIComponent(candidate.replace(/\bport\b/gi, '').trim());
      if (!searchName) {
        continue;
      }

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${searchName}&count=1&language=en&format=json`;

      try {
        const json = await fetchJson<{ results?: Array<{ name?: string; latitude?: number; longitude?: number; country?: string; admin1?: string }> }>(url);
        const first = json.results?.[0];
        if (!first || !isNumber(first.latitude) || !isNumber(first.longitude)) {
          continue;
        }

        const labelParts = [first.name, first.admin1, first.country].filter(Boolean);
        const resolved: PortCoordinates = {
          latitude: first.latitude,
          longitude: first.longitude,
          label: labelParts.join(', ') || portName,
        };
        geocodeCacheRef.current.set(normalized, resolved);
        console.log('[SailingWeather] Resolved port via geocoding', {
          portName,
          candidate,
          label: resolved.label,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        });
        return resolved;
      } catch (error) {
        logSailingWeather('warn', '[SailingWeather] Geocoding attempt failed for port candidate', {
          portName,
          candidate,
          error: serializeError(error),
        });
      }
    }

    logSailingWeather('error', '[SailingWeather] Geocoding failed for port', {
      portName,
      candidates,
    });
    return null;
  }, []);

  const resolveCruiseWeatherPoint = useCallback(async (cruise: SailingWeatherCruiseInput, targetDate: Date): Promise<ResolvedCruiseWeatherPoint | null> => {
    const dayOfCruise = getDayOfCruise(cruise, targetDate);
    const effectiveItinerary = inferRouteItinerary(cruise);
    const itineraryDay = effectiveItinerary.find((item) => item.day === dayOfCruise);
    const normalizedDayPort = normalizePortName(itineraryDay?.port ?? '');
    const isSeaDay = Boolean(itineraryDay?.isSeaDay || normalizedDayPort === 'at sea' || normalizedDayPort.includes('at sea'));

    if (!isSeaDay) {
      const portName = itineraryDay?.port || (dayOfCruise === 1 || dayOfCruise === getCruiseLengthDays(cruise) ? cruise.departurePort : undefined) || cruise.destination || cruise.itineraryName;
      const coordinates = await resolvePortCoordinates(portName);
      if (!coordinates) return null;
      return {
        ...coordinates,
        isSeaDay: false,
        zoneLabel: `Marine forecast near ${coordinates.label}${itineraryDay?.notes ? ` · ${itineraryDay.notes}` : ''}`,
      };
    }

    const previousPortDay = findNearestPortDay(effectiveItinerary, dayOfCruise, -1);
    const nextPortDay = findNearestPortDay(effectiveItinerary, dayOfCruise, 1);

    const [previousCoordinates, nextCoordinates] = await Promise.all([
      resolvePortCoordinates(previousPortDay?.port || cruise.departurePort),
      resolvePortCoordinates(nextPortDay?.port || cruise.destination || cruise.itineraryName),
    ]);

    if (previousCoordinates && nextCoordinates) {
      return {
        latitude: roundNumber((previousCoordinates.latitude + nextCoordinates.latitude) / 2, 4),
        longitude: roundNumber((previousCoordinates.longitude + nextCoordinates.longitude) / 2, 4),
        label: `${previousCoordinates.label} → ${nextCoordinates.label}`,
        isSeaDay: true,
        zoneLabel: `Sea-day midpoint between ${previousCoordinates.label} and ${nextCoordinates.label}`,
      };
    }

    if (previousCoordinates) {
      return {
        ...previousCoordinates,
        isSeaDay: true,
        zoneLabel: `Sea-day fallback near ${previousCoordinates.label}`,
      };
    }

    if (nextCoordinates) {
      return {
        ...nextCoordinates,
        isSeaDay: true,
        zoneLabel: `Sea-day fallback near ${nextCoordinates.label}`,
      };
    }

    return null;
  }, [resolvePortCoordinates]);

  const fetchForecast = useCallback(async (
    cruise: SailingWeatherCruiseInput,
    targetDate: Date,
    resolvedPoint: ResolvedCruiseWeatherPoint,
  ): Promise<SailingWeatherForecast> => {
    const dateKey = formatDateKey(targetDate);
    const targetDay = startOfDay(targetDate);
    const today = startOfDay(new Date());
    const weatherApiHost = targetDay < today
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';
    const query = `latitude=${resolvedPoint.latitude}&longitude=${resolvedPoint.longitude}&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&start_date=${dateKey}&end_date=${dateKey}`;
    const weatherUrl = `${weatherApiHost}?${query}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,weather_code&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${resolvedPoint.latitude}&longitude=${resolvedPoint.longitude}&timezone=auto&start_date=${dateKey}&end_date=${dateKey}&daily=wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max,swell_wave_direction_dominant&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period`;

    console.log('[SailingWeather] Fetching live forecast', {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      dateKey,
      location: resolvedPoint.label,
      latitude: resolvedPoint.latitude,
      longitude: resolvedPoint.longitude,
      isSeaDay: resolvedPoint.isSeaDay,
      zoneLabel: resolvedPoint.zoneLabel,
      weatherApiHost,
      marineUrl,
    });

    const weatherJson = await fetchJson<ForecastApiResponse>(weatherUrl);
    const marineJson = await fetchJson<MarineApiResponse>(marineUrl, { retries: 1 }).catch((error: unknown) => {
      logSailingWeather('warn', '[SailingWeather] Marine forecast request failed, continuing with weather-only data', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        dateKey,
        url: marineUrl,
        error: serializeError(error),
      });
      return null;
    });

    const marineTimeIndex = new Map<string, number>();
    (marineJson?.hourly?.time ?? []).forEach((time, index) => {
      marineTimeIndex.set(time, index);
    });

    const hourlyTimes = weatherJson.hourly?.time ?? [];
    const hourly = hourlyTimes.map<SailingWeatherPoint>((time, index) => {
      const marineIndex = marineTimeIndex.get(time);
      const marineHourIndex = isNumber(marineIndex) ? marineIndex : null;
      return {
        isoTime: time,
        label: formatHourLabel(time),
        temperatureF: toNullableNumber(weatherJson.hourly?.temperature_2m?.[index]),
        windMph: toNullableNumber(weatherJson.hourly?.wind_speed_10m?.[index]),
        windGustMph: toNullableNumber(weatherJson.hourly?.wind_gusts_10m?.[index]),
        windDirectionDegrees: toDegrees(toNullableNumber(weatherJson.hourly?.wind_direction_10m?.[index])),
        waveHeightFt: toFeetFromMeters(toNullableNumber(marineHourIndex !== null ? marineJson?.hourly?.wave_height?.[marineHourIndex] : null)),
        waveDirectionDegrees: toDegrees(toNullableNumber(marineHourIndex !== null ? marineJson?.hourly?.wave_direction?.[marineHourIndex] : null)),
        wavePeriodSeconds: toNullableNumber(marineHourIndex !== null ? marineJson?.hourly?.wave_period?.[marineHourIndex] : null),
        swellWaveHeightFt: toFeetFromMeters(toNullableNumber(marineHourIndex !== null ? marineJson?.hourly?.swell_wave_height?.[marineHourIndex] : null)),
        swellWaveDirectionDegrees: toDegrees(toNullableNumber(marineHourIndex !== null ? marineJson?.hourly?.swell_wave_direction?.[marineHourIndex] : null)),
        swellWavePeriodSeconds: toNullableNumber(marineHourIndex !== null ? marineJson?.hourly?.swell_wave_period?.[marineHourIndex] : null),
        precipitationProbability: toNullableNumber(weatherJson.hourly?.precipitation_probability?.[index]),
        weatherCode: toNullableNumber(weatherJson.hourly?.weather_code?.[index]),
      };
    });

    const dailyHigh = toNullableNumber(weatherJson.daily?.temperature_2m_max?.[0]) ?? getMaxValue(hourly.map((item) => item.temperatureF));
    const dailyLow = toNullableNumber(weatherJson.daily?.temperature_2m_min?.[0]) ?? getMinValue(hourly.map((item) => item.temperatureF));
    const maxWind = toNullableNumber(weatherJson.daily?.wind_speed_10m_max?.[0]) ?? getMaxValue(hourly.map((item) => item.windMph));
    const maxWindGust = toNullableNumber(weatherJson.daily?.wind_gusts_10m_max?.[0]) ?? getMaxValue(hourly.map((item) => item.windGustMph));
    const dominantWindDirectionDegrees = toDegrees(toNullableNumber(weatherJson.daily?.wind_direction_10m_dominant?.[0]) ?? hourly.find((item) => item.windDirectionDegrees !== null)?.windDirectionDegrees ?? null);
    const maxWave = toFeetFromMeters(toNullableNumber(marineJson?.daily?.wave_height_max?.[0])) ?? getMaxValue(hourly.map((item) => item.waveHeightFt));
    const maxWavePeriodSeconds = toNullableNumber(marineJson?.daily?.wave_period_max?.[0]) ?? getMaxValue(hourly.map((item) => item.wavePeriodSeconds));
    const dominantWaveDirectionDegrees = toDegrees(toNullableNumber(marineJson?.daily?.wave_direction_dominant?.[0]) ?? hourly.find((item) => item.waveDirectionDegrees !== null)?.waveDirectionDegrees ?? null);
    const maxSwellHeightFt = toFeetFromMeters(toNullableNumber(marineJson?.daily?.swell_wave_height_max?.[0])) ?? getMaxValue(hourly.map((item) => item.swellWaveHeightFt));
    const dominantSwellDirectionDegrees = toDegrees(toNullableNumber(marineJson?.daily?.swell_wave_direction_dominant?.[0]) ?? hourly.find((item) => item.swellWaveDirectionDegrees !== null)?.swellWaveDirectionDegrees ?? null);
    const precipitationChance = toNullableNumber(weatherJson.daily?.precipitation_probability_max?.[0]) ?? getMaxValue(hourly.map((item) => item.precipitationProbability));
    const weatherCode = toNullableNumber(weatherJson.daily?.weather_code?.[0]) ?? hourly.find((item) => item.weatherCode !== null)?.weatherCode ?? null;

    const metrics = {
      highTempF: dailyHigh,
      lowTempF: dailyLow,
      maxWindMph: maxWind,
      maxWindGustMph: maxWindGust,
      dominantWindDirectionDegrees,
      maxWaveHeightFt: maxWave,
      maxWavePeriodSeconds,
      dominantWaveDirectionDegrees,
      maxSwellHeightFt,
      dominantSwellDirectionDegrees,
      precipitationChance,
      conditionLabel: describeWeatherCode(weatherCode),
    };

    const summary = buildSummary(metrics, resolvedPoint.isSeaDay);
    const updatedAt = new Date().toISOString();
    const advisories = buildMarineAdvisories(cruise, resolvedPoint, metrics);

    return {
      cacheKey: createCacheKey(cruise.id, dateKey, resolvedPoint.latitude, resolvedPoint.longitude),
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      dateKey,
      locationName: resolvedPoint.label,
      zoneLabel: resolvedPoint.zoneLabel,
      latitude: resolvedPoint.latitude,
      longitude: resolvedPoint.longitude,
      timezone: weatherJson.timezone_abbreviation ?? weatherJson.timezone ?? 'Local',
      updatedAt,
      nextRefreshAt: new Date(Date.now() + CACHE_REFRESH_MS).toISOString(),
      source: 'live',
      isStale: false,
      isSeaDay: resolvedPoint.isSeaDay,
      summary: summary.summary,
      headline: summary.headline,
      advisories,
      metrics,
      snapshots: buildSnapshots(hourly),
      hourly,
    };
  }, []);

  const getForecastForCruiseDay = useCallback(async (
    cruise: SailingWeatherCruiseInput,
    targetDate: Date,
    options?: { force?: boolean },
  ): Promise<SailingWeatherForecast | null> => {
    const resolvedPoint = await resolveCruiseWeatherPoint(cruise, targetDate);
    if (!resolvedPoint) {
      console.log('[SailingWeather] Unable to resolve coordinates for cruise day', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        date: formatDateKey(targetDate),
      });
      return null;
    }

    const dateKey = formatDateKey(targetDate);
    const cacheKey = createCacheKey(cruise.id, dateKey, resolvedPoint.latitude, resolvedPoint.longitude);
    const rawCached = cacheRef.current[cacheKey];
    const cached = rawCached && rawCached.dateKey === dateKey && rawCached.cacheKey === cacheKey ? rawCached : undefined;
    const shouldForce = options?.force === true;

    if (rawCached && !cached) {
      logSailingWeather('warn', '[SailingWeather] Ignoring cached forecast with mismatched date/key', {
        requestedDateKey: dateKey,
        requestedCacheKey: cacheKey,
        cachedDateKey: rawCached.dateKey,
        cachedCacheKey: rawCached.cacheKey,
      });
      setCache((previousCache) => {
        const nextCache = { ...previousCache };
        delete nextCache[cacheKey];
        cacheRef.current = nextCache;
        return nextCache;
      });
    }

    if (!shouldForce && cached && !isCacheExpired(cached.updatedAt)) {
      console.log('[SailingWeather] Serving fresh cached forecast', { cacheKey, source: 'cache-fresh' });
      const freshForecast: SailingWeatherForecast = {
        ...cached,
        source: 'cache-fresh',
        isStale: false,
      };
      return freshForecast;
    }

    const inFlightRequest = inFlightRef.current[cacheKey];
    if (!shouldForce && inFlightRequest) {
      console.log('[SailingWeather] Awaiting in-flight forecast request', { cacheKey });
      return inFlightRequest;
    }

    const forecastPromise: Promise<SailingWeatherForecast | null> = (async (): Promise<SailingWeatherForecast | null> => {
      try {
        const liveForecast = await fetchForecast(cruise, targetDate, resolvedPoint);
        setCache((previousCache) => {
          const nextCache = {
            ...previousCache,
            [cacheKey]: liveForecast,
          };
          cacheRef.current = nextCache;
          return nextCache;
        });
        return liveForecast;
      } catch (error) {
        logSailingWeather('error', '[SailingWeather] Live forecast fetch failed', {
          cacheKey,
          cruiseId: cruise.id,
          shipName: cruise.shipName,
          dateKey,
          error: serializeError(error),
        });
        if (cached) {
          const staleForecast: SailingWeatherForecast = {
            ...cached,
            source: 'cache-stale',
            isStale: true,
          };
          return staleForecast;
        }
        const offlinePlaceholder = buildOfflinePlaceholderForecast(
          cruise,
          targetDate,
          resolvedPoint,
          'Offline: no saved live forecast is available yet for this itinerary day. The route card remains visible and will refresh wind, swell, precipitation, and temperature details when service returns.',
        );
        setCache((previousCache) => {
          const nextCache = {
            ...previousCache,
            [cacheKey]: offlinePlaceholder,
          };
          cacheRef.current = nextCache;
          return nextCache;
        });
        return offlinePlaceholder;
      } finally {
        delete inFlightRef.current[cacheKey];
      }
    })();

    inFlightRef.current[cacheKey] = forecastPromise;
    return forecastPromise;
  }, [fetchForecast, resolveCruiseWeatherPoint]);

  const prefetchCruiseForecastWindow = useCallback(async (
    cruise: SailingWeatherCruiseInput,
    options?: { anchorDate?: Date; force?: boolean },
  ): Promise<void> => {
    const datesToPrefetch = buildPrefetchDates(cruise, options?.anchorDate);
    if (datesToPrefetch.length === 0) {
      console.log('[SailingWeather] No prefetchable forecast dates for cruise window', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        anchorDate: options?.anchorDate ? formatDateKey(options.anchorDate) : null,
      });
      return;
    }

    console.log('[SailingWeather] Prefetching forecast window', {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      dates: datesToPrefetch.map((date) => formatDateKey(date)),
      force: options?.force === true,
    });

    for (const forecastDate of datesToPrefetch) {
      try {
        await getForecastForCruiseDay(cruise, forecastDate, { force: options?.force === true });
      } catch (error) {
        logSailingWeather('error', '[SailingWeather] Failed to prefetch cruise forecast date', {
          cruiseId: cruise.id,
          shipName: cruise.shipName,
          date: formatDateKey(forecastDate),
          error: serializeError(error),
        });
      }
    }
  }, [getForecastForCruiseDay]);

  const clearWeatherCache = useCallback(async () => {
    setCache({});
    cacheRef.current = {};
    try {
      await quotaSafeRemoveItem(storageKeyRef.current);
      console.log('[SailingWeather] Cleared all cached forecasts');
    } catch (error) {
      logSailingWeather('error', '[SailingWeather] Failed to clear weather cache', {
        error: serializeError(error),
      });
    }
  }, []);

  return useMemo(() => ({
    isHydrated,
    getForecastForCruiseDay,
    prefetchCruiseForecastWindow,
    clearWeatherCache,
  }), [clearWeatherCache, getForecastForCruiseDay, isHydrated, prefetchCruiseForecastWindow]);
});
