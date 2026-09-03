import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCruiseDayPlan } from '@/lib/cruiseDayPipeline';
import {
  resolveKnownWeatherPortCoordinates,
  type SailingWeatherCruiseInput,
} from '@/state/SailingWeatherProvider';

const CACHE_KEY_PREFIX = '@easyseas:noaa-voyage-alerts:v1:';
const REFRESH_MS = 4 * 60 * 60 * 1000;
const MAX_TROPICAL_DISTANCE_MILES = 1500;
const REQUEST_TIMEOUT_MS = 12000;

export type OfficialVoyageAlert = {
  id: string;
  source: 'NHC' | 'NWS';
  severity: 'watch' | 'warning' | 'advisory';
  title: string;
  detail: string;
  issuedAt: string;
  expiresAt?: string;
  distanceMiles?: number;
  url?: string;
};

export type OfficialVoyageAlertSnapshot = {
  alerts: OfficialVoyageAlert[];
  checkedAt: string;
  sourceStatus: string;
  isStale: boolean;
};

type Point = { latitude: number; longitude: number; label: string };

function radians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceMiles(left: Point, right: Point): number {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function buildRoutePoints(cruise: SailingWeatherCruiseInput): Point[] {
  const plan = buildCruiseDayPlan(cruise);
  const names = [cruise.departurePort, ...(plan?.days.map((day) => day.port) ?? [])].filter((value): value is string => Boolean(value));
  const points = names
    .map((name) => resolveKnownWeatherPortCoordinates(name))
    .filter((point): point is Point => Boolean(point));
  return Array.from(new Map(points.map((point) => [`${point.latitude.toFixed(2)}:${point.longitude.toFixed(2)}`, point])).values());
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/geo+json, application/json',
        'User-Agent': 'EasySeas mobile weather alerts',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function classificationLabel(classification: string): string {
  if (classification === 'HU') return 'Hurricane';
  if (classification === 'TS') return 'Tropical Storm';
  if (classification === 'TD') return 'Tropical Depression';
  if (classification === 'PTC') return 'Potential Tropical Cyclone';
  return 'Tropical Cyclone';
}

async function loadNhcAlerts(routePoints: Point[]): Promise<OfficialVoyageAlert[]> {
  const payload = await fetchJson<{ activeStorms?: Array<Record<string, unknown>> }>('https://www.nhc.noaa.gov/CurrentStorms.json');
  return (payload.activeStorms ?? []).flatMap((storm) => {
    const latitude = Number(storm.latitudeNumeric);
    const longitude = Number(storm.longitudeNumeric);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || routePoints.length === 0) return [];
    const stormPoint = { latitude, longitude, label: String(storm.name ?? 'storm') };
    const distance = Math.min(...routePoints.map((point) => distanceMiles(point, stormPoint)));
    if (distance > MAX_TROPICAL_DISTANCE_MILES) return [];
    const classification = String(storm.classification ?? '');
    const kind = classificationLabel(classification);
    const advisory = storm.publicAdvisory as Record<string, unknown> | null | undefined;
    const hasWatchesWarnings = Boolean(storm.windWatchesWarnings);
    return [{
      id: `nhc:${String(storm.id ?? storm.name ?? 'storm')}`,
      source: 'NHC' as const,
      severity: hasWatchesWarnings || classification === 'HU' ? 'warning' as const : classification === 'TS' ? 'watch' as const : 'advisory' as const,
      title: `${kind} ${String(storm.name ?? '').trim()}`.trim(),
      detail: `${Math.round(distance).toLocaleString()} miles from the nearest verified voyage point · ${String(storm.intensity ?? '—')} kt sustained winds · moving ${String(storm.movementDir ?? '—')}° at ${String(storm.movementSpeed ?? '—')} kt${hasWatchesWarnings ? ' · active NHC watches/warnings issued' : ''}.`,
      issuedAt: String(storm.lastUpdate ?? advisory?.issuance ?? new Date().toISOString()),
      distanceMiles: Math.round(distance),
      url: typeof advisory?.url === 'string' ? advisory.url : undefined,
    }];
  });
}

function alertSeverity(value: string, event: string): OfficialVoyageAlert['severity'] {
  const combined = `${value} ${event}`.toLowerCase();
  if (combined.includes('warning') || combined.includes('extreme') || combined.includes('severe')) return 'warning';
  if (combined.includes('watch')) return 'watch';
  return 'advisory';
}

async function loadNwsAlerts(routePoints: Point[]): Promise<OfficialVoyageAlert[]> {
  const results = await Promise.allSettled(routePoints.slice(0, 8).map(async (point) => {
    const payload = await fetchJson<{ features?: Array<{ id?: string; properties?: Record<string, unknown> }> }>(
      `https://api.weather.gov/alerts/active?point=${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`,
    );
    return (payload.features ?? []).map((feature): OfficialVoyageAlert => {
      const properties = feature.properties ?? {};
      const event = String(properties.event ?? 'NOAA/NWS weather alert');
      return {
        id: `nws:${String(feature.id ?? properties.id ?? `${event}:${point.label}`)}`,
        source: 'NWS',
        severity: alertSeverity(String(properties.severity ?? ''), event),
        title: event,
        detail: `${point.label}: ${String(properties.headline ?? properties.description ?? 'Active official alert.')}`,
        issuedAt: String(properties.sent ?? properties.effective ?? new Date().toISOString()),
        expiresAt: typeof properties.expires === 'string' ? properties.expires : undefined,
        url: typeof properties['@id'] === 'string' ? String(properties['@id']) : typeof feature.id === 'string' ? feature.id : undefined,
      };
    });
  }));
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

function cacheKey(cruise: SailingWeatherCruiseInput): string {
  return `${CACHE_KEY_PREFIX}${cruise.id}:${cruise.sailDate}:${cruise.returnDate}`;
}

async function readCache(cruise: SailingWeatherCruiseInput): Promise<OfficialVoyageAlertSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(cruise));
    return raw ? JSON.parse(raw) as OfficialVoyageAlertSnapshot : null;
  } catch {
    return null;
  }
}

export async function getOfficialVoyageAlerts(
  cruise: SailingWeatherCruiseInput,
  options: { force?: boolean } = {},
): Promise<OfficialVoyageAlertSnapshot> {
  const cached = await readCache(cruise);
  const cacheAge = cached ? Date.now() - new Date(cached.checkedAt).getTime() : Number.POSITIVE_INFINITY;
  if (!options.force && cached && Number.isFinite(cacheAge) && cacheAge < REFRESH_MS) return { ...cached, isStale: false };

  const routePoints = buildRoutePoints(cruise);
  try {
    const [nhcResult, nwsResult] = await Promise.allSettled([loadNhcAlerts(routePoints), loadNwsAlerts(routePoints)]);
    if (nhcResult.status === 'rejected' && nwsResult.status === 'rejected') throw new Error('Official alert sources unavailable');
    const alerts = [
      ...(nhcResult.status === 'fulfilled' ? nhcResult.value : []),
      ...(nwsResult.status === 'fulfilled' ? nwsResult.value : []),
    ];
    const unique = Array.from(new Map(alerts.map((alert) => [alert.id, alert])).values())
      .sort((a, b) => (a.severity === 'warning' ? 0 : a.severity === 'watch' ? 1 : 2) - (b.severity === 'warning' ? 0 : b.severity === 'watch' ? 1 : 2));
    const snapshot: OfficialVoyageAlertSnapshot = {
      alerts: unique,
      checkedAt: new Date().toISOString(),
      sourceStatus: `NHC ${nhcResult.status === 'fulfilled' ? 'checked' : 'unavailable'} · NOAA/NWS ${nwsResult.status === 'fulfilled' ? 'checked' : 'unavailable'} · 1,500-mile tropical radius`,
      isStale: false,
    };
    await AsyncStorage.setItem(cacheKey(cruise), JSON.stringify(snapshot));
    return snapshot;
  } catch {
    if (cached) return { ...cached, isStale: true, sourceStatus: `${cached.sourceStatus} · offline saved result` };
    return { alerts: [], checkedAt: new Date().toISOString(), sourceStatus: 'Official alert check unavailable; retry while online', isStale: true };
  }
}

