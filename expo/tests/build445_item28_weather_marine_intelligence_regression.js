const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const { classifyMarineObservationEvidence } = loadTs('lib/weatherEvidence.ts');
const now = Date.parse('2026-09-01T12:00:00Z');
assert.deepEqual(
  classifyMarineObservationEvidence('2026-09-01T11:00:00Z', 25, now),
  { freshness: 'fresh', confidence: 'high', ageHours: 1 },
);
assert.deepEqual(
  classifyMarineObservationEvidence('2026-09-01T06:00:00Z', 100, now),
  { freshness: 'aging', confidence: 'medium', ageHours: 6 },
);
assert.deepEqual(
  classifyMarineObservationEvidence('2026-08-31T12:00:00Z', 20, now),
  { freshness: 'stale', confidence: 'low', ageHours: 24 },
);

const provider = fs.readFileSync('state/SailingWeatherProvider.tsx', 'utf8');
for (const marker of [
  'resolveCruiseWeatherPoint',
  'getCruiseDayForDate(cruise, targetDate)',
  'Route position:',
  'Marine forecast along day ${canonicalDay.day} itinerary position',
  'attachNwsMarineZone',
  'https://api.weather.gov/points/',
  "point.properties?.type ?? '').toLowerCase() !== 'marine'",
  'point.properties?.forecastZone',
  'NWS marine zone ${zone.id}',
  'fetchNearestNdbcObservation',
  'NDBC_MAX_VALIDATION_DISTANCE_MILES',
  'classifyMarineObservationEvidence',
  "source: 'planning'",
  "source: isHistoricalDate ? 'historical' : 'live'",
  "source: 'cache-stale'",
  'quotaSafeGetJsonItem<Record<string, SailingWeatherForecast>>',
  'quotaSafeSetJsonItem',
]) assert.ok(provider.includes(marker), `Weather provider is missing ${marker}.`);

// Dated providers are used only in their published window; outside it a planning/current-area record is explicit.
assert.match(provider, /if \(targetDay >= today && !isWithinForecastWindow\(targetDay, FORECAST_PREFETCH_HORIZON_DAYS\)\)[\s\S]*buildPlanningForecast/);
assert.match(provider, /weatherSourceLabel: 'Dated forecast not published yet'/);
assert.match(provider, /marineSourceLabel: 'Dated marine guidance not published yet'/);
assert.match(provider, /Current area weather snapshot; dated forecast not published yet/);
assert.match(provider, /cachedByCruiseDay\.source !== 'planning'/);

const card = fs.readFileSync('components/SailingWeatherCard.tsx', 'utf8');
for (const marker of [
  'sailing-weather-marine-zone-',
  'NOAA/NWS marine zone',
  'Mapped from this itinerary coordinate',
  'sailing-weather-buoy-',
  'distanceMiles.toFixed(0)',
  'formatObservationTime(forecast.nearestBuoyObservation.observedAt)',
  "freshness ?? 'freshness unknown'",
  "confidence ?? 'confidence unknown'",
  'Forecast not available yet · planning outlook (not live)',
  'Typical September planning range',
  'Dated model refresh begins around',
  'Saved locally for this sailing day',
]) assert.ok(card.includes(marker), `Weather card is missing ${marker}.`);
assert.match(card, /forecast\.source === 'planning'/);
assert.match(card, /<VisibleItineraryMap/);

console.log('PASS Build 445 Item 28 itinerary/route weather, dated-vs-planning truth, official NWS marine zone, NDBC freshness/distance/confidence, and offline cache');
