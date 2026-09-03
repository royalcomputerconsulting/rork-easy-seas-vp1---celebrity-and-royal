import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import type { ItineraryDay } from '@/types/models';
import { buildCruiseDayPlan, getCruiseDayForDate, isWithinForecastWindow } from '@/lib/cruiseDayPipeline';
import { isOperationallyAuthoritative } from '@/lib/dataAuthority';
import { getItineraryFingerprint } from '@/lib/itineraryIntegrity';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem, quotaSafeRemoveItem } from '@/lib/storage/quotaSafeStorage';
import { useAuth } from './AuthProvider';
import { useCoreData } from './CoreDataProvider';
import { subscribeToCruiseRecordChanges } from '@/lib/cruiseRecordChangeEvents';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { classifyMarineObservationEvidence } from '@/lib/weatherEvidence';

const BASE_STORAGE_KEY = '@easy_seas_sailing_weather_cache_v1';
export const SAILING_WEATHER_REFRESH_MS = 1000 * 60 * 60 * 4;
const CACHE_REFRESH_MS = SAILING_WEATHER_REFRESH_MS;
const CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 45;
// Open-Meteo's official weather and marine endpoints publish up to 16 days.
// Day zero is today, so this covers today plus the following 15 calendar days.
const FORECAST_PREFETCH_HORIZON_DAYS = 16;
const FORECAST_PREFETCH_CONCURRENCY = 3;
const BACKGROUND_PREFETCH_DELAY_MS = 8000;
const MARINE_BEST_MATCH_HORIZON_DAYS = 7;
const MARINE_LONG_RANGE_MODEL = 'ncep_gfswave025';
const MARINE_STRATEGY_VERSION = 3;
const DAY_MS = 1000 * 60 * 60 * 24;
const NDBC_OBSERVATION_CACHE_MS = 1000 * 60 * 15;
const NDBC_MAX_VALIDATION_DISTANCE_MILES = 250;

interface NdbcObservation {
  stationId: string;
  observedAt: string;
  distanceMiles: number;
  freshness: 'fresh' | 'aging' | 'stale';
  confidence: 'high' | 'medium' | 'low';
  latitude: number;
  longitude: number;
  windMph: number | null;
  waveHeightFt: number | null;
  airTemperatureF: number | null;
  waterTemperatureF: number | null;
}

let ndbcObservationCache: { loadedAt: number; observations: NdbcObservation[] } | null = null;

interface NwsMarineZone {
  id: string;
  name: string;
  url: string;
  resolvedAt: string;
}

const nwsMarineZoneCache = new Map<string, NwsMarineZone | null>();

const PORT_COORDINATES: Record<string, { latitude: number; longitude: number; label: string }> = {
  miami: { latitude: 25.7781, longitude: -80.1794, label: 'Miami' },
  'port miami': { latitude: 25.7781, longitude: -80.1794, label: 'Miami' },
  'fort lauderdale': { latitude: 26.0956, longitude: -80.1217, label: 'Fort Lauderdale' },
  'port everglades': { latitude: 26.0906, longitude: -80.1186, label: 'Port Everglades' },
  'port canaveral': { latitude: 28.4102, longitude: -80.631, label: 'Port Canaveral' },
  'port canaveral florida': { latitude: 28.4102, longitude: -80.631, label: 'Port Canaveral' },
  orlando: { latitude: 28.4102, longitude: -80.631, label: 'Port Canaveral / Atlantic waters off Brevard County (Orlando-area embarkation)' },
  'orlando florida': { latitude: 28.4102, longitude: -80.631, label: 'Port Canaveral / Atlantic waters off Brevard County (Orlando-area embarkation)' },
  'miami florida': { latitude: 25.7781, longitude: -80.1794, label: 'Miami' },
  'fort lauderdale florida': { latitude: 26.0956, longitude: -80.1217, label: 'Fort Lauderdale' },
  'los angeles california': { latitude: 33.7405, longitude: -118.2775, label: 'Los Angeles' },
  'tampa florida': { latitude: 27.9513, longitude: -82.4572, label: 'Tampa' },
  'galveston texas': { latitude: 29.3013, longitude: -94.7977, label: 'Galveston' },
  'seattle washington': { latitude: 47.6062, longitude: -122.3321, label: 'Seattle' },
  'vancouver british columbia': { latitude: 49.2827, longitude: -123.1207, label: 'Vancouver' },
  'cape liberty new jersey': { latitude: 40.6728, longitude: -74.0722, label: 'Cape Liberty' },
  'baltimore maryland': { latitude: 39.2667, longitude: -76.579, label: 'Baltimore' },
  'san juan puerto rico': { latitude: 18.4655, longitude: -66.1057, label: 'San Juan' },
  'barcelona spain': { latitude: 41.3851, longitude: 2.1734, label: 'Barcelona' },
  'rome italy': { latitude: 42.0933, longitude: 11.7956, label: 'Civitavecchia' },
  'venice italy': { latitude: 45.4408, longitude: 12.3155, label: 'Venice' },
  'athens greece': { latitude: 37.942, longitude: 23.6465, label: 'Piraeus' },
  'southampton england': { latitude: 50.8998, longitude: -1.4132, label: 'Southampton' },
  'seward alaska': { latitude: 60.1042, longitude: -149.4422, label: 'Seward' },
  'honolulu oahu hawaii': { latitude: 21.3069, longitude: -157.8583, label: 'Honolulu' },
  'shanghai china': { latitude: 31.2304, longitude: 121.4737, label: 'Shanghai' },
  'cartagena colombia': { latitude: 10.391, longitude: -75.4794, label: 'Cartagena' },
  'colon panama': { latitude: 9.3592, longitude: -79.9014, label: 'Colón' },
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
  'san juan': { latitude: 18.4655, longitude: -66.1057, label: 'San Juan' },
  'puerto plata': { latitude: 19.7939, longitude: -70.6871, label: 'Puerto Plata' },
  'st maarten': { latitude: 18.0425, longitude: -63.0548, label: 'St. Maarten' },
  'st. maarten': { latitude: 18.0425, longitude: -63.0548, label: 'St. Maarten' },
  'philipsburg': { latitude: 18.0252, longitude: -63.0458, label: 'Philipsburg' },
  keywest: { latitude: 24.5551, longitude: -81.78, label: 'Key West' },
  'key west': { latitude: 24.5551, longitude: -81.78, label: 'Key West' },
  civitavecchia: { latitude: 42.0933, longitude: 11.7956, label: 'Civitavecchia' },
  barcelona: { latitude: 41.3851, longitude: 2.1734, label: 'Barcelona' },
  'ibiza spain': { latitude: 38.912, longitude: 1.447, label: 'Ibiza' },
  ibiza: { latitude: 38.912, longitude: 1.447, label: 'Ibiza' },
  'eivissa spain': { latitude: 38.912, longitude: 1.447, label: 'Ibiza' },
  eivissa: { latitude: 38.912, longitude: 1.447, label: 'Ibiza' },
  'tangier morocco': { latitude: 35.789, longitude: -5.8, label: 'Tangier' },
  tangier: { latitude: 35.789, longitude: -5.8, label: 'Tangier' },
  'tanger morocco': { latitude: 35.789, longitude: -5.8, label: 'Tangier' },
  tanger: { latitude: 35.789, longitude: -5.8, label: 'Tangier' },
  'lisbon portugal': { latitude: 38.707, longitude: -9.136, label: 'Lisbon' },
  lisbon: { latitude: 38.707, longitude: -9.136, label: 'Lisbon' },
  'porto leixoes portugal': { latitude: 41.185, longitude: -8.705, label: 'Porto (Leixoes)' },
  'porto portugal': { latitude: 41.185, longitude: -8.705, label: 'Porto (Leixoes)' },
  porto: { latitude: 41.185, longitude: -8.705, label: 'Porto (Leixoes)' },
  leixoes: { latitude: 41.185, longitude: -8.705, label: 'Porto (Leixoes)' },
  'a coruna spain': { latitude: 43.368, longitude: -8.391, label: 'A Coruna' },
  'a coruna': { latitude: 43.368, longitude: -8.391, label: 'A Coruna' },
  coruna: { latitude: 43.368, longitude: -8.391, label: 'A Coruna' },
  marseille: { latitude: 43.2965, longitude: 5.3698, label: 'Marseille' },
  naples: { latitude: 40.8518, longitude: 14.2681, label: 'Naples' },
  piraeus: { latitude: 37.942, longitude: 23.6465, label: 'Piraeus' },
  santorini: { latitude: 36.3932, longitude: 25.4615, label: 'Santorini' },
  mykonos: { latitude: 37.4467, longitude: 25.3289, label: 'Mykonos' },
  juneau: { latitude: 58.3005, longitude: -134.4201, label: 'Juneau' },
  skagway: { latitude: 59.4583, longitude: -135.3139, label: 'Skagway' },
  ketchikan: { latitude: 55.3422, longitude: -131.6461, label: 'Ketchikan' },
  sitka: { latitude: 57.0531, longitude: -135.33, label: 'Sitka' },
  victoria: { latitude: 48.4284, longitude: -123.3656, label: 'Victoria' },
};

type SailingWeatherSource = 'live' | 'historical' | 'planning' | 'cache-fresh' | 'cache-stale';

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
  source: 'easyseas_model';
}

export interface SailingWeatherForecast {
  cacheKey: string;
  cruiseId: string;
  shipName: string;
  dateKey: string;
  itineraryFingerprint: string;
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
  isFallback: boolean;
  dataConfidence: 'verified' | 'partial';
  /** Optional for backward compatibility with weather already cached by older builds. */
  marineStrategyVersion?: number;
  weatherSourceLabel?: string;
  marineSourceLabel?: string;
  nwsMarineZoneId?: string;
  nwsMarineZoneName?: string;
  nwsMarineZoneUrl?: string;
  nwsMarineZoneResolvedAt?: string;
  nearestBuoyObservation?: NdbcObservation;
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
    /** Sea-state claims are valid only when the marine provider returned wave data. */
    marineDataStatus: 'verified' | 'pending' | 'unavailable';
  };
  snapshots: SailingWeatherPoint[];
  hourly: SailingWeatherPoint[];
}

export interface SailingWeatherCruiseInput {
  id: string;
  shipName: string;
  sailDate: string;
  returnDate?: string;
  departurePort?: string;
  destination?: string;
  itineraryName?: string;
  ports?: string[];
  nights: number;
  itinerary?: ItineraryDay[];
  dataConfidence?: 'verified' | 'partial' | 'enriched' | 'unknown';
}

export interface SailingWeatherPrefetchReport {
  cruiseId: string;
  voyageDates: string[];
  eligibleDates: string[];
  refreshedDates: string[];
  datedForecastDates: string[];
  planningDates: string[];
  failedDates: string[];
  unavailableDates: string[];
  forecastAvailableFrom: string | null;
}

export interface SailingWeatherPrefetchProgress {
  cruiseId: string;
  completed: number;
  total: number;
  dateKey: string;
  result: 'dated' | 'planning' | 'failed';
}

interface SailingWeatherState {
  isHydrated: boolean;
  cachedForecasts: SailingWeatherForecast[];
  getForecastForCruiseDay: (
    cruise: SailingWeatherCruiseInput,
    targetDate: Date,
    options?: { force?: boolean }
  ) => Promise<SailingWeatherForecast | null>;
  prefetchCruiseForecastWindow: (
    cruise: SailingWeatherCruiseInput,
    options?: { anchorDate?: Date; force?: boolean; onProgress?: (progress: SailingWeatherPrefetchProgress) => void }
  ) => Promise<SailingWeatherPrefetchReport>;
  clearWeatherCache: () => Promise<void>;
  clearWeatherCacheForCruise: (cruiseId: string) => Promise<void>;
}

interface PortCoordinates {
  latitude: number;
  longitude: number;
  label: string;
}

interface ResolvedCruiseWeatherPoint extends PortCoordinates {
  isSeaDay: boolean;
  isFallback: boolean;
  zoneLabel: string;
  nwsMarineZoneId?: string;
  nwsMarineZoneName?: string;
  nwsMarineZoneUrl?: string;
  nwsMarineZoneResolvedAt?: string;
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

interface MetNorwayForecastResponse {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: { air_temperature?: number; wind_speed?: number; wind_from_direction?: number } };
        next_1_hours?: { summary?: { symbol_code?: string }; details?: { probability_of_precipitation?: number } };
        next_6_hours?: { summary?: { symbol_code?: string }; details?: { probability_of_precipitation?: number } };
      };
    }>;
  };
}

interface NwsPointResponse {
  properties?: {
    forecast?: string;
    forecastGridData?: string;
    forecastZone?: string;
    type?: string;
    cwa?: string;
  };
}

interface NwsZoneResponse {
  properties?: {
    id?: string;
    name?: string;
    updated?: string;
  };
}

interface NwsForecastResponse {
  properties?: {
    periods?: Array<{
      startTime?: string;
      isDaytime?: boolean;
      temperature?: number;
      temperatureUnit?: string;
      windSpeed?: string;
      windDirection?: string;
      shortForecast?: string;
      detailedForecast?: string;
      probabilityOfPrecipitation?: { value?: number | null };
    }>;
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

function marineResponseHasWaveData(response: MarineApiResponse | null): boolean {
  if (!response) return false;
  const candidates: unknown[] = [
    ...(response.daily?.wave_height_max ?? []),
    ...(response.daily?.swell_wave_height_max ?? []),
    ...(response.hourly?.wave_height ?? []),
    ...(response.hourly?.swell_wave_height ?? []),
  ];
  return candidates.some(isNumber);
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

  // Keep the complete identifier first, then allow the city portion of a
  // comma-separated port label. Open-Meteo returns `Tangier` for the query
  // `Tangier, Morocco`; requiring the country suffix in the result name made
  // valid itinerary ports fall back to the embarkation city.
  const cityName = normalizePortName(rawValue.split(',')[0] ?? '');
  return Array.from(new Set([normalized, cityName].filter(Boolean)));
}

function matchKnownPortCoordinates(normalizedValue: string): PortCoordinates | null {
  const directMatch = PORT_COORDINATES[normalizedValue];
  if (directMatch) {
    return directMatch;
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

/** Shared read-only port lookup for route-scoped official weather alerts. */
export function resolveKnownWeatherPortCoordinates(rawValue: string): PortCoordinates | null {
  return resolveKnownPortCoordinates(rawValue);
}

function roundNumber(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function buildCruiseDateRange(cruise: SailingWeatherCruiseInput): Date[] {
  const plan = buildCruiseDayPlan(cruise);
  return plan?.days.map((day) => new Date(`${day.date}T00:00:00.000Z`)) ?? [];
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }));
}

function buildPrefetchDates(cruise: SailingWeatherCruiseInput, anchorDate?: Date): Date[] {
  const today = startOfDay(new Date());
  const horizonEnd = addDays(today, FORECAST_PREFETCH_HORIZON_DAYS);
  void anchorDate;
  return buildCruiseDateRange(cruise).filter((date) => date >= today && date <= horizonEnd);
}

function createCacheKey(cruiseId: string, itineraryFingerprint: string, dateKey: string, latitude: number, longitude: number): string {
  return `${cruiseId}:${itineraryFingerprint}:${dateKey}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}

/**
 * Find a saved cruise-day forecast without first resolving coordinates.
 *
 * Coordinate resolution can require the network for an unfamiliar port. On an
 * offline voyage the saved forecast is still useful, so the cache lookup must
 * happen before geocoding. The itinerary fingerprint prevents an old itinerary
 * for the same booking from being reused after its ports or dates change.
 */
export function findCachedForecastForCruiseDay(
  cache: Record<string, SailingWeatherForecast>,
  cruiseId: string,
  itineraryFingerprint: string,
  dateKey: string,
): SailingWeatherForecast | undefined {
  return Object.values(cache).find((forecast) => (
    forecast.cruiseId === cruiseId
    && forecast.dateKey === dateKey
    && forecast.itineraryFingerprint === itineraryFingerprint
  ));
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

  if (metrics.marineDataStatus === 'pending') {
    return {
      headline: `${condition} · ${tempLabel}`,
      summary: `${windLabel} · NOAA wave forecast is pending publication; EasySeas will retry automatically online.`,
    };
  }

  if (metrics.marineDataStatus === 'unavailable') {
    return {
      headline: `${condition} · ${tempLabel}`,
      summary: `${windLabel} · Marine data unavailable: EasySeas cannot assess sea state for this cruise day.`,
    };
  }

  return {
    headline: `${condition} · ${tempLabel}`,
    summary: isSeaDay ? `${waveLabel} · ${gustLabel} · ${precipLabel}` : `${windLabel} · ${swellLabel} · ${precipLabel}`,
  };
}

/**
 * Creates a truthful, location-specific card before dated model guidance is
 * published. It deliberately contains no invented temperature, wind, or wave
 * values. The card is cached so every itinerary day remains visible offline,
 * then is replaced automatically once that date enters the live window.
 */
function buildPlanningForecast(
  cruise: SailingWeatherCruiseInput,
  targetDate: Date,
  resolvedPoint: ResolvedCruiseWeatherPoint,
): SailingWeatherForecast {
  const dateKey = formatDateKey(targetDate);
  const updatedAt = new Date().toISOString();
  const itineraryFingerprint = getItineraryFingerprint(cruise);
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
    conditionLabel: 'Planning outlook',
    marineDataStatus: 'pending',
  };

  return {
    cacheKey: createCacheKey(cruise.id, itineraryFingerprint, dateKey, resolvedPoint.latitude, resolvedPoint.longitude),
    cruiseId: cruise.id,
    shipName: cruise.shipName,
    dateKey,
    itineraryFingerprint,
    locationName: resolvedPoint.label,
    zoneLabel: resolvedPoint.zoneLabel,
    latitude: resolvedPoint.latitude,
    longitude: resolvedPoint.longitude,
    timezone: 'Local',
    updatedAt,
    // Planning entries are reconsidered frequently and never block a live
    // refresh merely because their local cache is still fresh.
    nextRefreshAt: new Date(Date.now() + CACHE_REFRESH_MS).toISOString(),
    source: 'planning',
    isStale: false,
    isSeaDay: resolvedPoint.isSeaDay,
    isFallback: resolvedPoint.isFallback,
    dataConfidence: 'partial',
    marineStrategyVersion: MARINE_STRATEGY_VERSION,
    weatherSourceLabel: 'Dated forecast not published yet',
    marineSourceLabel: 'Dated marine guidance not published yet',
    nwsMarineZoneId: resolvedPoint.nwsMarineZoneId,
    nwsMarineZoneName: resolvedPoint.nwsMarineZoneName,
    nwsMarineZoneUrl: resolvedPoint.nwsMarineZoneUrl,
    nwsMarineZoneResolvedAt: resolvedPoint.nwsMarineZoneResolvedAt,
    headline: `Planning outlook · ${resolvedPoint.label}`,
    summary: 'The dated NOAA/Open-Meteo forecast is not published yet. EasySeas will replace this card automatically when live guidance becomes available.',
    advisories: [],
    metrics,
    snapshots: [],
    hourly: [],
  };
}

function buildCurrentAreaSnapshotForecast(
  cruise: SailingWeatherCruiseInput,
  targetDate: Date,
  resolvedPoint: ResolvedCruiseWeatherPoint,
  currentForecast: SailingWeatherForecast,
): SailingWeatherForecast {
  const dateKey = formatDateKey(targetDate);
  const updatedAt = new Date().toISOString();
  const itineraryFingerprint = getItineraryFingerprint(cruise);
  const summary = buildSummary(currentForecast.metrics, resolvedPoint.isSeaDay);
  const buoy = currentForecast.nearestBuoyObservation;
  const buoyDetail = buoy
    ? ` Nearest NOAA buoy ${buoy.stationId} is ${roundNumber(buoy.distanceMiles, 0)} mi away${buoy.waveHeightFt !== null ? ` with ${buoy.waveHeightFt} ft observed seas` : ''}${buoy.windMph !== null ? ` and ${buoy.windMph} mph wind` : ''}.`
    : '';

  return {
    cacheKey: createCacheKey(cruise.id, itineraryFingerprint, dateKey, resolvedPoint.latitude, resolvedPoint.longitude),
    cruiseId: cruise.id,
    shipName: cruise.shipName,
    dateKey,
    itineraryFingerprint,
    locationName: resolvedPoint.label,
    zoneLabel: resolvedPoint.zoneLabel,
    latitude: resolvedPoint.latitude,
    longitude: resolvedPoint.longitude,
    timezone: currentForecast.timezone,
    updatedAt,
    nextRefreshAt: new Date(Date.now() + CACHE_REFRESH_MS).toISOString(),
    source: 'planning',
    isStale: false,
    isSeaDay: resolvedPoint.isSeaDay,
    isFallback: resolvedPoint.isFallback,
    dataConfidence: currentForecast.dataConfidence,
    marineStrategyVersion: MARINE_STRATEGY_VERSION,
    weatherSourceLabel: 'Current area weather snapshot; dated forecast not published yet',
    marineSourceLabel: currentForecast.marineSourceLabel ?? 'Current nearby marine snapshot',
    nwsMarineZoneId: resolvedPoint.nwsMarineZoneId,
    nwsMarineZoneName: resolvedPoint.nwsMarineZoneName,
    nwsMarineZoneUrl: resolvedPoint.nwsMarineZoneUrl,
    nwsMarineZoneResolvedAt: resolvedPoint.nwsMarineZoneResolvedAt,
    nearestBuoyObservation: buoy,
    headline: `Current area snapshot · not a dated forecast`,
    summary: `Today's conditions near ${resolvedPoint.label}: ${summary.summary}.${buoyDetail} EasySeas will replace this with the dated forecast for ${dateKey} when the provider window opens.`,
    advisories: [
      ...currentForecast.advisories,
      {
        id: 'current-area-snapshot',
        severity: 'info',
        title: 'Current route-area snapshot',
        detail: `This uses today's weather/marine conditions near the itinerary location for ${dateKey}. It is useful situational awareness, not a guarantee for the sailing date.`,
        source: 'easyseas_model',
      },
    ],
    metrics: currentForecast.metrics,
    snapshots: currentForecast.snapshots,
    hourly: currentForecast.hourly,
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

  if (metrics.marineDataStatus === 'verified' && (inTehuantepecZone || normalizedContext.includes('tehuantepec') || normalizedContext.includes('huatulco') || normalizedContext.includes('puerto chiapas'))) {
    advisories.push({
      id: 'tehuantepec-gap-wind',
      severity: severeWind || severeSeas ? 'warning' : 'watch',
      title: 'Gulf of Tehuantepec watch',
      detail: 'Gap-wind events here can ramp quickly and build steep seas. Recheck the latest forecast before sailaway and tender operations.',
      source: 'easyseas_model',
    });
  }

  if (metrics.marineDataStatus === 'verified' && (inBajaZone || normalizedContext.includes('ensenada') || normalizedContext.includes('cabo') || normalizedContext.includes('mazatlan') || normalizedContext.includes('vallarta') || normalizedContext.includes('baja'))) {
    advisories.push({
      id: 'baja-pacific-pattern',
      severity: severeWind ? 'watch' : 'info',
      title: 'Baja / Mexican Riviera pattern',
      detail: 'The outer Baja and Riviera corridor often sees fresh NW flow and building swell. North of Punta Eugenia can turn choppier than the port forecast suggests.',
      source: 'easyseas_model',
    });
  }

  if (metrics.marineDataStatus === 'verified' && (severeWind || severeSeas)) {
    advisories.push({
      id: 'rougher-marine-window',
      severity: severeWind && severeSeas ? 'warning' : 'watch',
      title: 'Rougher marine window',
      detail: `Model guidance is showing up to ${Math.round(metrics.maxWindGustMph ?? metrics.maxWindMph ?? 0)} mph wind and ${roundNumber(metrics.maxWaveHeightFt ?? 0, 1)} ft seas for this cruise day.`,
      source: 'easyseas_model',
    });
  }

  if (stormRisk) {
    advisories.push({
      id: 'storm-or-squall-risk',
      severity: 'watch',
      title: 'Squall / rain risk',
      detail: 'Rain bands or squalls may shift timing quickly. Download the forecast early so you still have it offline when service drops.',
      source: 'easyseas_model',
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

async function fetchJson<T>(url: string, options?: { retries?: number; timeoutMs?: number; headers?: Record<string, string> }): Promise<T> {
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
          ...options?.headers,
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

function ndbcNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return value && value !== 'MM' && Number.isFinite(parsed) ? parsed : null;
}

function haversineMiles(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadNdbcObservations(): Promise<NdbcObservation[]> {
  if (ndbcObservationCache && Date.now() - ndbcObservationCache.loadedAt < NDBC_OBSERVATION_CACHE_MS) {
    return ndbcObservationCache.observations;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt', {
      signal: controller.signal,
      headers: { 'User-Agent': 'EasySeas/13.0 mobile-weather-client' },
    });
    if (!response.ok) throw new Error(`NDBC observations request failed (${response.status})`);
    const body = await response.text();
    const observations = body.split(/\r?\n/).flatMap<NdbcObservation>((line) => {
      if (!line.trim() || line.startsWith('#')) return [];
      const columns = line.trim().split(/\s+/);
      const latitude = ndbcNumber(columns[1]);
      const longitude = ndbcNumber(columns[2]);
      if (latitude === null || longitude === null) return [];
      const year = ndbcNumber(columns[3]);
      const month = ndbcNumber(columns[4]);
      const day = ndbcNumber(columns[5]);
      const hour = ndbcNumber(columns[6]);
      const minute = ndbcNumber(columns[7]);
      const windMetersPerSecond = ndbcNumber(columns[9]);
      const waveMeters = ndbcNumber(columns[11]);
      const airCelsius = ndbcNumber(columns[17]);
      const waterCelsius = ndbcNumber(columns[18]);
      const observedAt = year !== null && month !== null && day !== null && hour !== null && minute !== null
        ? new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString()
        : new Date().toISOString();
      return [{
        stationId: columns[0] ?? 'NDBC',
        observedAt,
        distanceMiles: 0,
        ...classifyMarineObservationEvidence(observedAt, Number.POSITIVE_INFINITY),
        latitude,
        longitude,
        windMph: windMetersPerSecond === null ? null : roundNumber(windMetersPerSecond * 2.236936, 1),
        waveHeightFt: waveMeters === null ? null : roundNumber(waveMeters * 3.28084, 1),
        airTemperatureF: airCelsius === null ? null : roundNumber((airCelsius * 9 / 5) + 32, 1),
        waterTemperatureF: waterCelsius === null ? null : roundNumber((waterCelsius * 9 / 5) + 32, 1),
      }];
    });
    ndbcObservationCache = { loadedAt: Date.now(), observations };
    return observations;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNearestNdbcObservation(latitude: number, longitude: number): Promise<NdbcObservation | null> {
  try {
    const observations = await loadNdbcObservations();
    let nearest: NdbcObservation | null = null;
    for (const observation of observations) {
      const distanceMiles = haversineMiles(latitude, longitude, observation.latitude, observation.longitude);
      if (distanceMiles > NDBC_MAX_VALIDATION_DISTANCE_MILES) continue;
      if (!nearest || distanceMiles < nearest.distanceMiles) {
        const roundedDistanceMiles = roundNumber(distanceMiles, 1);
        nearest = {
          ...observation,
          distanceMiles: roundedDistanceMiles,
          ...classifyMarineObservationEvidence(observation.observedAt, roundedDistanceMiles),
        };
      }
    }
    return nearest;
  } catch (error) {
    logSailingWeather('warn', '[SailingWeather] NDBC buoy validation unavailable', { error: serializeError(error) });
    return null;
  }
}

function metNorwaySymbolToWeatherCode(symbol: string | undefined): number | null {
  const normalized = String(symbol ?? '').toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('thunder')) return 95;
  if (normalized.includes('snow')) return 73;
  if (normalized.includes('sleet')) return 67;
  if (normalized.includes('heavyrain')) return 65;
  if (normalized.includes('rain')) return 61;
  if (normalized.includes('fog')) return 45;
  if (normalized.includes('cloudy')) return normalized.includes('partly') ? 2 : 3;
  if (normalized.includes('fair')) return 1;
  if (normalized.includes('clearsky')) return 0;
  return null;
}

function convertMetNorwayForecast(response: MetNorwayForecastResponse, dateKey: string): ForecastApiResponse | null {
  const rows = (response.properties?.timeseries ?? []).filter((row) => String(row.time ?? '').startsWith(dateKey));
  if (rows.length === 0) return null;

  const temperatures = rows.map((row) => {
    const celsius = toNullableNumber(row.data?.instant?.details?.air_temperature);
    return celsius === null ? null : roundNumber((celsius * 9 / 5) + 32, 1);
  });
  const windSpeeds = rows.map((row) => {
    const metersPerSecond = toNullableNumber(row.data?.instant?.details?.wind_speed);
    return metersPerSecond === null ? null : roundNumber(metersPerSecond * 2.236936, 1);
  });
  const precipitation = rows.map((row) => toNullableNumber(
    row.data?.next_1_hours?.details?.probability_of_precipitation
      ?? row.data?.next_6_hours?.details?.probability_of_precipitation,
  ));
  const weatherCodes = rows.map((row) => metNorwaySymbolToWeatherCode(
    row.data?.next_1_hours?.summary?.symbol_code
      ?? row.data?.next_6_hours?.summary?.symbol_code,
  ));

  return {
    timezone: 'UTC',
    daily: {
      temperature_2m_max: [getMaxValue(temperatures) ?? undefined].filter(isNumber),
      temperature_2m_min: [getMinValue(temperatures) ?? undefined].filter(isNumber),
      precipitation_probability_max: [getMaxValue(precipitation) ?? undefined].filter(isNumber),
      wind_speed_10m_max: [getMaxValue(windSpeeds) ?? undefined].filter(isNumber),
      wind_direction_10m_dominant: [rows
        .map((row) => toNullableNumber(row.data?.instant?.details?.wind_from_direction))
        .find((value): value is number => value !== null) ?? undefined].filter(isNumber),
      weather_code: [weatherCodes.find((value): value is number => value !== null) ?? undefined].filter(isNumber),
    },
    hourly: {
      time: rows.map((row) => String(row.time ?? '')),
      temperature_2m: temperatures.map((value) => value ?? Number.NaN),
      precipitation_probability: precipitation.map((value) => value ?? Number.NaN),
      wind_speed_10m: windSpeeds.map((value) => value ?? Number.NaN),
      wind_direction_10m: rows.map((row) => toNullableNumber(row.data?.instant?.details?.wind_from_direction) ?? Number.NaN),
      weather_code: weatherCodes.map((value) => value ?? Number.NaN),
    },
  };
}

function isLikelyNwsCoverage(latitude: number, longitude: number): boolean {
  // Continental U.S., Alaska, Hawaii, Puerto Rico and nearby U.S. waters.
  return latitude >= 17 && latitude <= 72 && longitude >= -180 && longitude <= -60;
}

async function fetchNwsMarineZone(latitude: number, longitude: number): Promise<NwsMarineZone | null> {
  if (!isLikelyNwsCoverage(latitude, longitude)) return null;
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  if (nwsMarineZoneCache.has(cacheKey)) return nwsMarineZoneCache.get(cacheKey) ?? null;
  const headers = {
    Accept: 'application/geo+json',
    'User-Agent': 'EasySeas/13.0 mobile-weather-client',
  };
  try {
    const point = await fetchJson<NwsPointResponse>(`https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, {
      retries: 0,
      headers,
    });
    const zoneUrl = point.properties?.forecastZone;
    if (String(point.properties?.type ?? '').toLowerCase() !== 'marine' || !zoneUrl) {
      nwsMarineZoneCache.set(cacheKey, null);
      return null;
    }
    const zone = await fetchJson<NwsZoneResponse>(zoneUrl, { retries: 0, headers });
    const id = String(zone.properties?.id || zoneUrl.split('/').filter(Boolean).pop() || '').trim();
    if (!id) return null;
    const resolved = {
      id,
      name: String(zone.properties?.name || 'Official marine forecast zone').trim(),
      url: zoneUrl,
      resolvedAt: new Date().toISOString(),
    };
    nwsMarineZoneCache.set(cacheKey, resolved);
    return resolved;
  } catch (error) {
    logSailingWeather('warn', '[SailingWeather] Official NWS marine zone unavailable', {
      latitude,
      longitude,
      error: serializeError(error),
    });
    return null;
  }
}

async function attachNwsMarineZone(point: ResolvedCruiseWeatherPoint): Promise<ResolvedCruiseWeatherPoint> {
  const zone = await fetchNwsMarineZone(point.latitude, point.longitude);
  if (!zone) return point;
  return {
    ...point,
    zoneLabel: `NWS marine zone ${zone.id} · ${zone.name}`,
    nwsMarineZoneId: zone.id,
    nwsMarineZoneName: zone.name,
    nwsMarineZoneUrl: zone.url,
    nwsMarineZoneResolvedAt: zone.resolvedAt,
  };
}

function parseNwsWindSpeed(value: string | undefined): number | null {
  const speeds = String(value ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  return speeds.length > 0 ? Math.max(...speeds) : null;
}

function nwsDirectionToDegrees(value: string | undefined): number | null {
  const directions: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return directions[String(value ?? '').trim().toUpperCase()] ?? null;
}

function nwsTextToWeatherCode(value: string | undefined): number | null {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('thunder')) return 95;
  if (normalized.includes('snow')) return 73;
  if (normalized.includes('sleet') || normalized.includes('freezing')) return 67;
  if (normalized.includes('heavy rain')) return 65;
  if (normalized.includes('rain') || normalized.includes('shower')) return 61;
  if (normalized.includes('fog')) return 45;
  if (normalized.includes('overcast') || normalized.includes('cloudy')) return normalized.includes('partly') ? 2 : 3;
  if (normalized.includes('mostly sunny') || normalized.includes('mostly clear')) return 1;
  if (normalized.includes('sunny') || normalized.includes('clear')) return 0;
  return null;
}

async function fetchNwsPointForecast(latitude: number, longitude: number, dateKey: string): Promise<ForecastApiResponse | null> {
  if (!isLikelyNwsCoverage(latitude, longitude)) return null;
  const headers = {
    Accept: 'application/geo+json',
    'User-Agent': 'EasySeas/13.0 mobile-weather-client',
  };
  const point = await fetchJson<NwsPointResponse>(`https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, {
    retries: 1,
    headers,
  });
  const forecastUrl = point.properties?.forecast;
  if (!forecastUrl) return null;
  const forecast = await fetchJson<NwsForecastResponse>(forecastUrl, { retries: 1, headers });
  const periods = (forecast.properties?.periods ?? []).filter((period) => String(period.startTime ?? '').startsWith(dateKey));
  if (periods.length === 0) return null;
  const daytime = periods.find((period) => period.isDaytime === true) ?? periods[0];
  const temperatures = periods
    .map((period) => period.temperatureUnit === 'C' && isNumber(period.temperature)
      ? roundNumber((period.temperature * 9 / 5) + 32, 1)
      : toNullableNumber(period.temperature))
    .filter(isNumber);
  const windSpeeds = periods.map((period) => parseNwsWindSpeed(period.windSpeed)).filter(isNumber);
  const precipitation = periods
    .map((period) => toNullableNumber(period.probabilityOfPrecipitation?.value))
    .filter(isNumber);
  const weatherCode = nwsTextToWeatherCode(daytime?.shortForecast ?? daytime?.detailedForecast);

  return {
    timezone: 'Local',
    daily: {
      temperature_2m_max: temperatures.length > 0 ? [Math.max(...temperatures)] : [],
      temperature_2m_min: temperatures.length > 0 ? [Math.min(...temperatures)] : [],
      precipitation_probability_max: precipitation.length > 0 ? [Math.max(...precipitation)] : [],
      wind_speed_10m_max: windSpeeds.length > 0 ? [Math.max(...windSpeeds)] : [],
      wind_direction_10m_dominant: [nwsDirectionToDegrees(daytime?.windDirection) ?? undefined].filter(isNumber),
      weather_code: [weatherCode ?? undefined].filter(isNumber),
    },
    hourly: {
      time: periods.map((period) => String(period.startTime ?? '')),
      temperature_2m: periods.map((period) => {
        if (!isNumber(period.temperature)) return Number.NaN;
        return period.temperatureUnit === 'C' ? roundNumber((period.temperature * 9 / 5) + 32, 1) : period.temperature;
      }),
      precipitation_probability: periods.map((period) => toNullableNumber(period.probabilityOfPrecipitation?.value) ?? Number.NaN),
      wind_speed_10m: periods.map((period) => parseNwsWindSpeed(period.windSpeed) ?? Number.NaN),
      wind_direction_10m: periods.map((period) => nwsDirectionToDegrees(period.windDirection) ?? Number.NaN),
      weather_code: periods.map((period) => nwsTextToWeatherCode(period.shortForecast ?? period.detailedForecast) ?? Number.NaN),
    },
  };
}

export const [SailingWeatherProvider, useSailingWeather] = createContextHook((): SailingWeatherState => {
  const { authenticatedEmail } = useAuth();
  const { bookedCruises, isLoading: isCoreDataLoading } = useCoreData();
  const storageKeyRef = useRef<string>(getUserScopedKey(BASE_STORAGE_KEY, authenticatedEmail));
  const geocodeCacheRef = useRef<Map<string, PortCoordinates>>(new Map());
  const inFlightRef = useRef<Partial<Record<string, Promise<SailingWeatherForecast | null>>>>({});
  const [cache, setCache] = useState<Record<string, SailingWeatherForecast>>({});
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const cacheRef = useRef<Record<string, SailingWeatherForecast>>({});
  const loadedCacheSnapshotRef = useRef<Record<string, SailingWeatherForecast> | null>(null);
  const sessionRef = useRef({ key: storageKeyRef.current, generation: 0 });
  const backgroundRefreshInFlightRef = useRef(false);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  useEffect(() => {
    const storageKey = getUserScopedKey(BASE_STORAGE_KEY, authenticatedEmail);
    storageKeyRef.current = storageKey;
    sessionRef.current = { key: storageKey, generation: sessionRef.current.generation + 1 };
    const session = sessionRef.current;
    setIsHydrated(false);
    setCache({});
    cacheRef.current = {};
    inFlightRef.current = {};

    const loadCache = async () => {
      try {
        const stored = await quotaSafeGetJsonItem<Record<string, SailingWeatherForecast>>(
          storageKey,
          {},
          (value): value is Record<string, SailingWeatherForecast> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
        );
        if (sessionRef.current.generation !== session.generation || sessionRef.current.key !== session.key) return;
        if (Object.keys(stored).length === 0) {
          const emptyCache: Record<string, SailingWeatherForecast> = {};
          loadedCacheSnapshotRef.current = emptyCache;
          setCache(emptyCache);
          setIsHydrated(true);
          console.log('[SailingWeather] No stored weather cache found');
          return;
        }

        const pruned = pruneCacheEntries(stored);
        if (sessionRef.current.generation !== session.generation || sessionRef.current.key !== session.key) return;
        loadedCacheSnapshotRef.current = pruned;
        setCache(pruned);
        cacheRef.current = pruned;
        console.log('[SailingWeather] Loaded cached forecasts:', Object.keys(pruned).length);
      } catch (error) {
        if (sessionRef.current.generation !== session.generation || sessionRef.current.key !== session.key) return;
        logSailingWeather('error', '[SailingWeather] Failed to load stored weather cache', {
          error: serializeError(error),
        });
        setCache({});
        cacheRef.current = {};
      } finally {
        if (sessionRef.current.generation === session.generation && sessionRef.current.key === session.key) {
          setIsHydrated(true);
        }
      }
    };

    void loadCache();
  }, [authenticatedEmail]);

  useEffect(() => {
    if (!isHydrated) return;
    if (loadedCacheSnapshotRef.current === cache) {
      loadedCacheSnapshotRef.current = null;
      return;
    }

    const persistCache = async () => {
      const session = sessionRef.current;
      try {
        const pruned = pruneCacheEntries(cache);
        if (Object.keys(pruned).length !== Object.keys(cache).length) {
          setCache(pruned);
          cacheRef.current = pruned;
          return;
        }
        await quotaSafeSetJsonItem(session.key, pruned);
        if (sessionRef.current.generation !== session.generation || sessionRef.current.key !== session.key) return;
        console.log('[SailingWeather] Persisted cached forecasts:', Object.keys(pruned).length);
      } catch (error) {
        logSailingWeather('error', '[SailingWeather] Failed to persist weather cache', {
          error: serializeError(error),
        });
      }
    };

    // A full sailing preload can complete several dates close together. One
    // short debounce turns that burst into a single transactional local write
    // instead of making the UI contend with a write for every forecast day.
    const persistTimer = setTimeout(() => {
      void persistCache();
    }, 500);

    return () => clearTimeout(persistTimer);
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
      if (!searchName) continue;
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${searchName}&count=10&language=en&format=json`;

      try {
        const json = await fetchJson<{ results?: Array<{ name?: string; latitude?: number; longitude?: number; country?: string; admin1?: string }> }>(url);
        const exact = json.results?.find((result) => normalizePortName(result.name ?? '') === candidate)
          ?? json.results?.find((result) => {
            const resultName = normalizePortName(result.name ?? '');
            return resultName.length >= 3 && (candidate.startsWith(resultName) || resultName.startsWith(candidate));
          });
        if (!exact || !isNumber(exact.latitude) || !isNumber(exact.longitude)) {
          logSailingWeather('warn', '[SailingWeather] Refused ambiguous geocoding result', { portName, candidate });
          continue;
        }

        const labelParts = [exact.name, exact.admin1, exact.country].filter(Boolean);
        const resolved: PortCoordinates = {
          latitude: exact.latitude,
          longitude: exact.longitude,
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
    const cruiseDayPlan = buildCruiseDayPlan(cruise);
    const canonicalDay = getCruiseDayForDate(cruise, targetDate);
    if (!canonicalDay) {
      return null;
    }
    const isSeaDay = canonicalDay.isSeaDay === true;

    if (!isSeaDay) {
      const portName = canonicalDay.port || (canonicalDay.day === 1 ? cruise.departurePort : undefined);
      const coordinates = await resolvePortCoordinates(portName);
      if (coordinates) {
        return attachNwsMarineZone({
          ...coordinates,
          isSeaDay: false,
          isFallback: false,
          zoneLabel: `Forecast near ${coordinates.label}`,
        });
      }

      // A number of Royal booking payloads arrive before voyage enrichment.
      // When the exact cruise-day port is missing, show a clearly labeled
      // departure-port reference instead of a blank card. This is not treated
      // as the ship's position and never receives a marine/sea-state claim.
      const departureReference = await resolvePortCoordinates(cruise.departurePort);
      if (departureReference) {
        return attachNwsMarineZone({
          ...departureReference,
          isSeaDay: false,
          isFallback: true,
          zoneLabel: `Departure-port reference: ${departureReference.label}`,
        });
      }
      return null;
    }

    if (
      isOperationallyAuthoritative(canonicalDay.source)
      && isNumber(canonicalDay.latitude)
      && isNumber(canonicalDay.longitude)
    ) {
      return attachNwsMarineZone({
        latitude: canonicalDay.latitude,
        longitude: canonicalDay.longitude,
        label: canonicalDay.port || 'Verified itinerary coordinates',
        isSeaDay: true,
        isFallback: false,
        zoneLabel: 'Forecast at verified itinerary coordinates',
      });
    }

    // Most provider itineraries identify the ports around a sea day but do not
    // publish a noon ship coordinate. Resolve both surrounding ports and use
    // the sea day's proportional position along that route. This gives every
    // itinerary day its own marine grid point instead of incorrectly reusing
    // the embarkation port (the previous behavior that repeated wave heights).
    const previousPortDay = findNearestPortDay(cruiseDayPlan?.days, canonicalDay.day, -1);
    const nextPortDay = findNearestPortDay(cruiseDayPlan?.days, canonicalDay.day, 1);
    const previousPortName = previousPortDay?.port || (canonicalDay.day > 1 ? cruise.departurePort : undefined);
    const nextPortName = nextPortDay?.port;
    const [previousCoordinates, nextCoordinates] = await Promise.all([
      resolvePortCoordinates(previousPortName),
      resolvePortCoordinates(nextPortName),
    ]);
    if (previousCoordinates && nextCoordinates) {
      const previousDayNumber = previousPortDay?.day ?? 1;
      const nextDayNumber = nextPortDay?.day ?? canonicalDay.day + 1;
      const span = Math.max(1, nextDayNumber - previousDayNumber);
      const progress = Math.min(1, Math.max(0, (canonicalDay.day - previousDayNumber) / span));
      return attachNwsMarineZone({
        latitude: roundNumber(previousCoordinates.latitude + ((nextCoordinates.latitude - previousCoordinates.latitude) * progress), 4),
        longitude: roundNumber(previousCoordinates.longitude + ((nextCoordinates.longitude - previousCoordinates.longitude) * progress), 4),
        label: `Route position: ${previousCoordinates.label} to ${nextCoordinates.label}`,
        isSeaDay: true,
        isFallback: false,
        zoneLabel: `Marine forecast along day ${canonicalDay.day} itinerary position`,
      });
    }

    // If the route cannot be resolved, retain the explicitly labeled land
    // reference and suppress marine claims rather than inventing coordinates.
    const departureReference = await resolvePortCoordinates(cruise.departurePort);
    if (departureReference) {
      return attachNwsMarineZone({
        ...departureReference,
        isSeaDay: true,
        isFallback: true,
        zoneLabel: `Departure-port reference: ${departureReference.label}`,
      });
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
    const isHistoricalDate = targetDay < today;
    const query = `latitude=${resolvedPoint.latitude}&longitude=${resolvedPoint.longitude}&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&start_date=${dateKey}&end_date=${dateKey}`;
    const weatherUrl = `${weatherApiHost}?${query}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,weather_code&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code`;
    const gfsWeatherUrl = `https://api.open-meteo.com/v1/gfs?${query}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,weather_code&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code`;
    const metNorwayUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${resolvedPoint.latitude}&lon=${resolvedPoint.longitude}`;
    // Port coordinates are often a few kilometres inland. Explicit sea-cell
    // selection prevents a valid published marine forecast from coming back as
    // all-null simply because the nearest grid point was on land.
    const marineQuery = `latitude=${resolvedPoint.latitude}&longitude=${resolvedPoint.longitude}&timezone=auto&cell_selection=sea&start_date=${dateKey}&end_date=${dateKey}&daily=wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max,swell_wave_direction_dominant&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period`;
    const bestMatchMarineUrl = `https://marine-api.open-meteo.com/v1/marine?${marineQuery}`;
    const noaaGfsMarineUrl = `${bestMatchMarineUrl}&models=${MARINE_LONG_RANGE_MODEL}`;
    const daysAhead = Math.max(0, Math.round((targetDay.getTime() - today.getTime()) / DAY_MS));
    const preferLongRangeMarineModel = daysAhead > MARINE_BEST_MATCH_HORIZON_DAYS;
    const marineUrl = preferLongRangeMarineModel ? noaaGfsMarineUrl : bestMatchMarineUrl;
    let marineSourceLabel = preferLongRangeMarineModel
      ? 'NOAA GFS Wave via Open-Meteo'
      : 'Open-Meteo marine best match';
    let weatherSourceLabel = isHistoricalDate ? 'Open-Meteo historical archive' : 'Open-Meteo weather best match';

    console.log('[SailingWeather] Fetching live forecast', {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      dateKey,
      location: resolvedPoint.label,
      latitude: resolvedPoint.latitude,
      longitude: resolvedPoint.longitude,
      isSeaDay: resolvedPoint.isSeaDay,
      weatherApiHost,
      marineUrl: (isHistoricalDate || resolvedPoint.isFallback) ? 'skipped for historical weather/reference fallback' : marineUrl,
    });

    const [weatherJson, marineJson, nearestBuoyObservation] = await Promise.all([
      (async () => {
        if (!isHistoricalDate && isLikelyNwsCoverage(resolvedPoint.latitude, resolvedPoint.longitude)) {
          try {
            const nwsForecast = await fetchNwsPointForecast(resolvedPoint.latitude, resolvedPoint.longitude, dateKey);
            if (nwsForecast) {
              weatherSourceLabel = 'Official NOAA / National Weather Service';
              return nwsForecast;
            }
          } catch (nwsError) {
            logSailingWeather('warn', '[SailingWeather] Official NWS point forecast unavailable; trying Open-Meteo', {
              cruiseId: cruise.id, dateKey, error: serializeError(nwsError),
            });
          }
        }
        try {
          return await fetchJson<ForecastApiResponse>(weatherUrl);
        } catch (primaryError) {
          if (isHistoricalDate) throw primaryError;
          logSailingWeather('warn', '[SailingWeather] Best-match weather failed; retrying NOAA GFS', {
            cruiseId: cruise.id, dateKey, error: serializeError(primaryError),
          });
          try {
            const gfsForecast = await fetchJson<ForecastApiResponse>(gfsWeatherUrl, { retries: 1 });
            weatherSourceLabel = 'NOAA GFS atmospheric model via Open-Meteo';
            return gfsForecast;
          } catch (gfsError) {
            logSailingWeather('warn', '[SailingWeather] NOAA GFS weather failed; retrying MET Norway', {
              cruiseId: cruise.id, dateKey, error: serializeError(gfsError),
            });
            const metForecast = await fetchJson<MetNorwayForecastResponse>(metNorwayUrl, {
              retries: 1,
              headers: { 'User-Agent': 'EasySeas/13.0 mobile-weather-client' },
            });
            const converted = convertMetNorwayForecast(metForecast, dateKey);
            if (!converted) throw new Error(`MET Norway returned no forecast rows for ${dateKey}`);
            weatherSourceLabel = 'MET Norway Locationforecast';
            return converted;
          }
        }
      })(),
      (isHistoricalDate || resolvedPoint.isFallback)
        ? Promise.resolve<MarineApiResponse | null>(null)
        : (async (): Promise<MarineApiResponse | null> => {
            const fetchMarineCandidate = async (url: string, sourceLabel: string): Promise<MarineApiResponse | null> => {
              try {
                const response = await fetchJson<MarineApiResponse>(url, { retries: 1 });
                if (marineResponseHasWaveData(response)) marineSourceLabel = sourceLabel;
                return response;
              } catch (error) {
                logSailingWeather('warn', '[SailingWeather] Marine forecast request failed, continuing with the next safe source', {
                  cruiseId: cruise.id,
                  shipName: cruise.shipName,
                  dateKey,
                  sourceLabel,
                  url,
                  error: serializeError(error),
                });
                return null;
              }
            };

            const primaryMarine = await fetchMarineCandidate(
              marineUrl,
              preferLongRangeMarineModel ? 'NOAA GFS Wave via Open-Meteo' : 'Open-Meteo marine best match',
            );
            if (marineResponseHasWaveData(primaryMarine)) return primaryMarine;

            // Long-range NOAA and Open-Meteo's best-match blend have different
            // publication windows. Always try the other safe source before
            // reporting "pending"; the old early return skipped ECMWF/MFWAM
            // best-match data whenever the NOAA grid had not populated yet.
            const secondaryMarine = preferLongRangeMarineModel
              ? await fetchMarineCandidate(bestMatchMarineUrl, 'Open-Meteo marine best match')
              : await fetchMarineCandidate(noaaGfsMarineUrl, 'NOAA GFS Wave via Open-Meteo');
            return marineResponseHasWaveData(secondaryMarine) ? secondaryMarine : primaryMarine ?? secondaryMarine;
          })(),
      (!isHistoricalDate && dateKey === formatDateKey(today))
        ? fetchNearestNdbcObservation(resolvedPoint.latitude, resolvedPoint.longitude)
        : Promise.resolve<NdbcObservation | null>(null),
    ]);

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

    const marineDataStatus: SailingWeatherForecast['metrics']['marineDataStatus'] = maxWave !== null || maxSwellHeightFt !== null
      ? 'verified'
      : (!isHistoricalDate && !resolvedPoint.isFallback && targetDay > today ? 'pending' : 'unavailable');
    if (marineDataStatus === 'pending') marineSourceLabel = 'NOAA GFS Wave publication pending';
    if (marineDataStatus === 'unavailable') marineSourceLabel = 'Marine data unavailable';

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
      marineDataStatus,
    };

    const summary = buildSummary(metrics, resolvedPoint.isSeaDay);
    const updatedAt = new Date().toISOString();
    const advisories = buildMarineAdvisories(cruise, resolvedPoint, metrics);

    return {
      cacheKey: createCacheKey(cruise.id, getItineraryFingerprint(cruise), dateKey, resolvedPoint.latitude, resolvedPoint.longitude),
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      dateKey,
      itineraryFingerprint: getItineraryFingerprint(cruise),
      locationName: resolvedPoint.label,
      zoneLabel: resolvedPoint.zoneLabel,
      latitude: resolvedPoint.latitude,
      longitude: resolvedPoint.longitude,
      timezone: weatherJson.timezone_abbreviation ?? weatherJson.timezone ?? 'Local',
      updatedAt,
      nextRefreshAt: new Date(Date.now() + CACHE_REFRESH_MS).toISOString(),
      source: isHistoricalDate ? 'historical' : 'live',
      isStale: false,
      isSeaDay: resolvedPoint.isSeaDay,
      isFallback: resolvedPoint.isFallback,
      dataConfidence: metrics.marineDataStatus === 'verified' ? 'verified' : 'partial',
      marineStrategyVersion: MARINE_STRATEGY_VERSION,
      weatherSourceLabel,
      marineSourceLabel,
      nwsMarineZoneId: resolvedPoint.nwsMarineZoneId,
      nwsMarineZoneName: resolvedPoint.nwsMarineZoneName,
      nwsMarineZoneUrl: resolvedPoint.nwsMarineZoneUrl,
      nwsMarineZoneResolvedAt: resolvedPoint.nwsMarineZoneResolvedAt,
      nearestBuoyObservation: nearestBuoyObservation ?? undefined,
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
    const targetDay = startOfDay(targetDate);
    const today = startOfDay(new Date());
    const dateKey = formatDateKey(targetDate);
    const itineraryFingerprint = getItineraryFingerprint(cruise);
    const cachedByCruiseDay = findCachedForecastForCruiseDay(
      cacheRef.current,
      cruise.id,
      itineraryFingerprint,
      dateKey,
    );
    const shouldForce = options?.force === true;

    // Saved forecasts are the offline contract. Serve them before any network
    // dependent coordinate lookup, including days that have moved outside the
    // provider's current live-forecast window.
    if (
      !shouldForce
      && cachedByCruiseDay
      && cachedByCruiseDay.source !== 'planning'
      && !isCacheExpired(cachedByCruiseDay.updatedAt)
    ) {
      return {
        ...cachedByCruiseDay,
        source: cachedByCruiseDay.source === 'historical' ? 'historical' : 'cache-fresh',
        isStale: false,
      };
    }

    const resolvedPoint = await resolveCruiseWeatherPoint(cruise, targetDate);
    if (!resolvedPoint) {
      console.log('[SailingWeather] Unable to resolve coordinates for cruise day', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        date: dateKey,
      });
      return cachedByCruiseDay
        ? { ...cachedByCruiseDay, source: 'cache-stale', isStale: true }
        : null;
    }

    if (targetDay >= today && !isWithinForecastWindow(targetDay, FORECAST_PREFETCH_HORIZON_DAYS)) {
      logSailingWeather('warn', '[SailingWeather] Forecast date is outside the provider availability window', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        date: dateKey,
      });
      if (cachedByCruiseDay && cachedByCruiseDay.source !== 'planning') {
        return { ...cachedByCruiseDay, source: 'cache-stale', isStale: true };
      }

      let planningForecast = buildPlanningForecast(cruise, targetDate, resolvedPoint);
      try {
        const currentAreaForecast = await fetchForecast(cruise, today, resolvedPoint);
        planningForecast = buildCurrentAreaSnapshotForecast(cruise, targetDate, resolvedPoint, currentAreaForecast);
      } catch (error) {
        logSailingWeather('warn', '[SailingWeather] Current route-area snapshot unavailable; using static planning card', {
          cruiseId: cruise.id,
          shipName: cruise.shipName,
          date: dateKey,
          error: serializeError(error),
        });
      }
      setCache((previousCache) => {
        const nextCache = {
          ...previousCache,
          [planningForecast.cacheKey]: planningForecast,
        };
        cacheRef.current = nextCache;
        return nextCache;
      });
      return planningForecast;
    }

    const cacheKey = createCacheKey(cruise.id, itineraryFingerprint, dateKey, resolvedPoint.latitude, resolvedPoint.longitude);
    const rawCached = cacheRef.current[cacheKey];
    const exactCached = rawCached && rawCached.dateKey === dateKey && rawCached.cacheKey === cacheKey && rawCached.itineraryFingerprint === itineraryFingerprint ? rawCached : undefined;
    const cached = exactCached ?? cachedByCruiseDay;

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

    const needsMarineStrategyUpgrade = Boolean(
      cached
      && targetDay >= today
      && !resolvedPoint.isFallback
      && cached.metrics.marineDataStatus !== 'verified'
      && cached.marineStrategyVersion !== MARINE_STRATEGY_VERSION,
    );

    if (
      !shouldForce
      && cached
      && cached.source !== 'planning'
      && !needsMarineStrategyUpgrade
      && !isCacheExpired(cached.updatedAt)
    ) {
      console.log('[SailingWeather] Serving fresh cached forecast', { cacheKey, source: 'cache-fresh' });
      const freshForecast: SailingWeatherForecast = {
        ...cached,
        source: cached.source === 'historical' ? 'historical' : 'cache-fresh',
        isStale: false,
      };
      return freshForecast;
    }

    const inFlightRequest = inFlightRef.current[cacheKey];
    if (!shouldForce && inFlightRequest) {
      if (cached) {
        return {
          ...cached,
          source: cached.source === 'historical' ? 'historical' : cached.source === 'planning' ? 'planning' : 'cache-stale',
          isStale: cached.source === 'historical' || cached.source === 'planning' ? false : true,
        };
      }
      console.log('[SailingWeather] Awaiting in-flight forecast request', { cacheKey });
      return inFlightRequest;
    }

    const session = sessionRef.current;
    const forecastPromise: Promise<SailingWeatherForecast | null> = (async (): Promise<SailingWeatherForecast | null> => {
      try {
        const liveForecast = await fetchForecast(cruise, targetDate, resolvedPoint);
        if (sessionRef.current.generation !== session.generation || sessionRef.current.key !== session.key) {
          logSailingWeather('warn', '[SailingWeather] Discarded forecast from a previous account session', { cruiseId: cruise.id, dateKey });
          return null;
        }
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
            source: cached.source === 'planning' ? 'planning' : 'cache-stale',
            isStale: cached.source === 'planning' ? false : true,
          };
          return staleForecast;
        }
        let planningForecast = buildPlanningForecast(cruise, targetDate, resolvedPoint);
        if (targetDay > today) {
          try {
            const currentAreaForecast = await fetchForecast(cruise, today, resolvedPoint);
            planningForecast = buildCurrentAreaSnapshotForecast(cruise, targetDate, resolvedPoint, currentAreaForecast);
          } catch (snapshotError) {
            logSailingWeather('warn', '[SailingWeather] Fallback current route-area snapshot unavailable after dated forecast failure', {
              cruiseId: cruise.id,
              shipName: cruise.shipName,
              dateKey,
              error: serializeError(snapshotError),
            });
          }
        }
        setCache((previousCache) => {
          const nextCache = {
            ...previousCache,
            [cacheKey]: planningForecast,
          };
          cacheRef.current = nextCache;
          return nextCache;
        });
        return planningForecast;
      } finally {
        delete inFlightRef.current[cacheKey];
      }
    })();

    inFlightRef.current[cacheKey] = forecastPromise;
    if (!shouldForce && cached) {
      // Stale-while-revalidate keeps tab changes responsive and makes offline
      // use immediate. The in-flight request updates the transactional cache
      // when connectivity is available; failures are already contained above.
      void forecastPromise.catch(() => undefined);
      return {
        ...cached,
        source: cached.source === 'historical' ? 'historical' : cached.source === 'planning' ? 'planning' : 'cache-stale',
        isStale: cached.source === 'historical' || cached.source === 'planning' ? false : true,
      };
    }
    return forecastPromise;
  }, [fetchForecast, resolveCruiseWeatherPoint]);

  const prefetchCruiseForecastWindow = useCallback(async (
    cruise: SailingWeatherCruiseInput,
    options?: { anchorDate?: Date; force?: boolean; onProgress?: (progress: SailingWeatherPrefetchProgress) => void },
  ): Promise<SailingWeatherPrefetchReport> => {
    const voyageDates = buildCruiseDateRange(cruise);
    // Resolve every voyage date so a five-day cruise always owns five local
    // cards. Dates outside the live publication window become planning cards;
    // dates inside it are populated from the provider chain.
    const datesToPrefetch = voyageDates;
    const liveForecastDates = buildPrefetchDates(cruise, options?.anchorDate);
    const voyageDateKeys = voyageDates.map((date) => formatDateKey(date));
    const eligibleDateKeys = liveForecastDates.map((date) => formatDateKey(date));
    const eligibleSet = new Set(eligibleDateKeys);
    const unavailableDates = voyageDateKeys.filter((date) => !eligibleSet.has(date));
    const firstFutureVoyageDate = voyageDates.find((date) => date >= startOfDay(new Date()));
    const forecastAvailableFrom = firstFutureVoyageDate && unavailableDates.length > 0
      ? formatDateKey(addDays(firstFutureVoyageDate, -FORECAST_PREFETCH_HORIZON_DAYS))
      : null;
    if (datesToPrefetch.length === 0) {
      console.log('[SailingWeather] No prefetchable forecast dates for cruise window', {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        anchorDate: options?.anchorDate ? formatDateKey(options.anchorDate) : null,
      });
      return {
        cruiseId: cruise.id,
        voyageDates: voyageDateKeys,
        eligibleDates: [],
        refreshedDates: [],
        datedForecastDates: [],
        planningDates: [],
        failedDates: [],
        unavailableDates,
        forecastAvailableFrom,
      };
    }

    console.log('[SailingWeather] Prefetching forecast window', {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      dates: datesToPrefetch.map((date) => formatDateKey(date)),
      force: options?.force === true,
    });

    const refreshedDates: string[] = [];
    const datedForecastDates: string[] = [];
    const planningDates: string[] = [];
    const failedDates: string[] = [];
    let completed = 0;
    await runWithConcurrency(datesToPrefetch, FORECAST_PREFETCH_CONCURRENCY, async (forecastDate) => {
      const dateKey = formatDateKey(forecastDate);
      let result: SailingWeatherPrefetchProgress['result'] = 'failed';
      try {
        const forecast = await getForecastForCruiseDay(cruise, forecastDate, { force: options?.force === true });
        if (forecast) {
          refreshedDates.push(dateKey);
          if (forecast.source === 'planning') {
            planningDates.push(dateKey);
            result = 'planning';
          } else {
            datedForecastDates.push(dateKey);
            result = 'dated';
          }
        } else {
          failedDates.push(dateKey);
        }
      } catch (error) {
        failedDates.push(dateKey);
        logSailingWeather('error', '[SailingWeather] Failed to prefetch cruise forecast date', {
          cruiseId: cruise.id,
          shipName: cruise.shipName,
          date: formatDateKey(forecastDate),
          error: serializeError(error),
        });
      } finally {
        completed += 1;
        options?.onProgress?.({
          cruiseId: cruise.id,
          completed,
          total: datesToPrefetch.length,
          dateKey,
          result,
        });
      }
    });
    return {
      cruiseId: cruise.id,
      voyageDates: voyageDateKeys,
      eligibleDates: eligibleDateKeys,
      refreshedDates: Array.from(new Set(refreshedDates)).sort(),
      datedForecastDates: Array.from(new Set(datedForecastDates)).sort(),
      planningDates: Array.from(new Set(planningDates)).sort(),
      failedDates: Array.from(new Set(failedDates)).sort(),
      unavailableDates,
      forecastAvailableFrom,
    };
  }, [getForecastForCruiseDay]);

  const upcomingCruisesForBackgroundWeather = useMemo((): SailingWeatherCruiseInput[] => {
    const todayKey = formatDateKey(startOfDay(new Date()));
    return bookedCruises
      .filter((cruise) => {
        const status = String(cruise.status ?? '').trim().toLowerCase();
        if (['completed', 'cancelled', 'canceled', 'archived'].includes(status) || cruise.completionState === 'completed') {
          return false;
        }
        const plan = buildCruiseDayPlan(cruise);
        if (!plan) return false;
        return plan.returnDate >= todayKey;
      })
      .sort((left, right) => String(left.sailDate).localeCompare(String(right.sailDate)))
      // Preload the current/next three voyages without walking a user's full
      // cruise history or blocking navigation.
      .slice(0, 3)
      .map((cruise) => ({
        id: cruise.id,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        returnDate: cruise.returnDate,
        departurePort: cruise.departurePort,
        destination: cruise.destination,
        itineraryName: cruise.itineraryName,
        nights: cruise.nights,
        itinerary: cruise.itinerary,
        dataConfidence: cruise.dataConfidence,
      }));
  }, [bookedCruises]);

  useEffect(() => {
    if (!isHydrated || isCoreDataLoading || upcomingCruisesForBackgroundWeather.length === 0) {
      return;
    }

    let isCancelled = false;
    const refreshUpcomingCruises = async () => {
      if (isCancelled || backgroundRefreshInFlightRef.current) return;
      backgroundRefreshInFlightRef.current = true;
      try {
        for (const cruise of upcomingCruisesForBackgroundWeather) {
          if (isCancelled) break;
          await prefetchCruiseForecastWindow(cruise);
        }
      } finally {
        backgroundRefreshInFlightRef.current = false;
      }
    };

    // Delay network work until after the local-first provider tree has painted.
    // Forecast refreshes are never awaited by startup or tab navigation.
    let initialTimer: ReturnType<typeof setTimeout> | null = null;
    const initialInteraction = runAfterUiSettles(() => {
      initialTimer = setTimeout(() => {
        void refreshUpcomingCruises();
      }, BACKGROUND_PREFETCH_DELAY_MS);
    });
    const interval = setInterval(() => {
      void refreshUpcomingCruises();
    }, SAILING_WEATHER_REFRESH_MS);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshUpcomingCruises();
      }
    });

    return () => {
      isCancelled = true;
      initialInteraction.cancel();
      if (initialTimer) clearTimeout(initialTimer);
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [isCoreDataLoading, isHydrated, prefetchCruiseForecastWindow, upcomingCruisesForBackgroundWeather]);

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

  const clearWeatherCacheForCruise = useCallback(async (cruiseId: string) => {
    const nextCache = Object.fromEntries(Object.entries(cacheRef.current).filter(([, forecast]) => forecast.cruiseId !== cruiseId));
    setCache(nextCache);
    cacheRef.current = nextCache;
  }, []);

  useEffect(() => subscribeToCruiseRecordChanges((change) => {
    void clearWeatherCacheForCruise(change.cruiseId);
  }), [clearWeatherCacheForCruise]);

  return useMemo(() => ({
    isHydrated,
    cachedForecasts: Object.values(cache),
    getForecastForCruiseDay,
    prefetchCruiseForecastWindow,
    clearWeatherCache,
    clearWeatherCacheForCruise,
  }), [cache, clearWeatherCache, clearWeatherCacheForCruise, getForecastForCruiseDay, isHydrated, prefetchCruiseForecastWindow]);
});
