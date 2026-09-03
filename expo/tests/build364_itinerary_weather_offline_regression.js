const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const {
  applyKnownBookingCorrectionsToCruise,
  VERIFIED_EQUINOX_ECLIPSE_2026_ITINERARY,
} = loadTs('lib/cruiseOverlapGuards.ts');
const { buildCruiseDayPlan } = loadTs('lib/cruiseDayPipeline.ts');

const corrected = applyKnownBookingCorrectionsToCruise({
  id: 'legacy-equinox-record',
  shipName: 'Celebrity Equinox',
  sailDate: '2026-08-05',
  returnDate: '2026-08-14',
  departurePort: 'Barcelona, Spain',
  destination: 'Mediterranean',
  itineraryName: 'Mediterranean / Ibiza / Eclipse Cruise',
  nights: 9,
  itineraryNeedsManualEntry: true,
});

assert.equal(corrected.sailDate, '2026-08-06');
assert.equal(corrected.returnDate, '2026-08-15');
assert.equal(corrected.itineraryNeedsManualEntry, false);
assert.equal(corrected.sourceAuthority, 'public_document');
assert.equal(corrected.dataConfidence, 'verified');
assert.equal(corrected.itinerary.length, 10);
assert.deepEqual(corrected.itinerary.map((day) => day.port), [
  'Barcelona, Spain',
  'Ibiza, Spain',
  'Ibiza, Spain',
  'Tangier, Morocco',
  'Lisbon, Portugal',
  'Porto (Leixoes), Portugal',
  'A Coruna, Spain',
  'At Sea',
  'At Sea',
  'Barcelona, Spain',
]);
assert.equal(corrected.itinerary[1].departure, 'Overnight');
assert.equal(corrected.itinerary[2].departure, '09:00');
assert.equal(corrected.itinerary[3].arrival, '07:00');
assert.equal(corrected.itinerary[3].departure, '16:00');
assert.equal(corrected.itinerary[7].isSeaDay, true);
assert.equal(corrected.itinerary[8].isSeaDay, true);
assert.deepEqual(corrected.itinerary, VERIFIED_EQUINOX_ECLIPSE_2026_ITINERARY);

const plan = buildCruiseDayPlan(corrected);
assert.ok(plan);
assert.equal(plan.days.length, 10);
assert.equal(plan.days[0].date, '2026-08-06');
assert.equal(plan.days[1].date, '2026-08-07');
assert.equal(plan.days[1].port, 'Ibiza, Spain');
assert.equal(plan.days[2].date, '2026-08-08');
assert.equal(plan.days[2].port, 'Ibiza, Spain');
assert.equal(plan.days[3].date, '2026-08-09');
assert.equal(plan.days[3].port, 'Tangier, Morocco');
assert.equal(plan.days[9].date, '2026-08-15');

const weather = read('state/SailingWeatherProvider.tsx');
for (const marker of [
  "SAILING_WEATHER_REFRESH_MS = 1000 * 60 * 60 * 4",
  'CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 45',
  'FORECAST_PREFETCH_HORIZON_DAYS = 16',
  'FORECAST_PREFETCH_CONCURRENCY = 3',
  "'ibiza spain'",
  "'tangier morocco'",
  "'porto leixoes portugal'",
  "'a coruna spain'",
  'return buildCruiseDateRange(cruise).filter((date) => date >= today && date <= horizonEnd)',
  'await runWithConcurrency(datesToPrefetch, FORECAST_PREFETCH_CONCURRENCY',
  'const [weatherJson, marineJson] = await Promise.all([',
  "AppState.addEventListener('change'",
  "if (nextState === 'active')",
  'const { bookedCruises, isLoading: isCoreDataLoading } = useCoreData()',
  'setTimeout(() =>',
  'void refreshUpcomingCruises()',
]) {
  assert.ok(weather.includes(marker), `weather implementation missing ${marker}`);
}
for (const forbidden of [
  'FORECAST_PREFETCH_START_SOON_DAYS',
  'FORECAST_PREFETCH_WINDOW_DAYS',
  'FORECAST_PREFETCH_MAX_CRUISE_DAYS',
]) {
  assert.ok(!weather.includes(forbidden), `partial-sailing preload restriction remains: ${forbidden}`);
}

const marinePanel = read('components/MarineAlertsPanel.tsx');
for (const marker of [
  'FORECAST_LOAD_CONCURRENCY = 3',
  'Detailed {forecasts.length}-day cruise forecast',
  "forecast.marineDataStatus === 'verified'",
  'Open-Meteo weather + ${forecast.marineSourceLabel}',
  'formatUpdatedLabel(forecast.updatedAt)',
  'refetchInterval: SAILING_WEATHER_REFRESH_MS',
]) {
  assert.ok(marinePanel.includes(marker), `daily marine panel missing ${marker}`);
}

const agenda = read('app/day-agenda.tsx');
assert.ok(agenda.includes('forecastHorizonEnd.setDate(forecastHorizonEnd.getDate() + 15)'));
assert.ok(agenda.includes('<VoyageWeatherSection cruise={weatherVoyage} />'));

const voyageWeather = read('components/VoyageWeatherSection.tsx');
assert.ok(voyageWeather.includes('CURRENT OR NEXT AVAILABLE SAILING'));
assert.ok(voyageWeather.includes('plan.days.map'));
assert.ok(voyageWeather.includes('Sync Weather for Entire Sailing'));
assert.ok(voyageWeather.includes('<OfficialVoyageAlerts'));

const storage = read('state/coreData/storageLoaders.ts');
assert.ok(storage.includes('correctedKnownData'));
assert.ok(storage.includes('JSON.stringify(correctedCruise.itinerary ?? [])'));

const sailingCard = read('components/SailingWeatherCard.tsx');
assert.ok(sailingCard.includes("queryKey: ['sailing-weather', cruise.id, itineraryFingerprint, dateKey]"));
assert.ok(sailingCard.includes('Refreshes every 4 hours online'));

console.log('PASS Build 364: verified itinerary locations, daily wind/waves, full-sailing preload, offline cache, refresh-on-open, and bounded weather loading are enforced');
