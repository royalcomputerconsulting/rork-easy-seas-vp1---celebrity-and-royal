const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const catalog = loadTs('lib/certificates/certificateCatalog.ts');
const referenceDate = new Date('2026-08-21T12:00:00.000Z');
assert.equal(catalog.getMonthCodeForTarget('thisMonth', referenceDate), '2608');
assert.equal(catalog.getMonthCodeForTarget('nextMonth', referenceDate), '2609');
assert.match(catalog.getMonthLabelForTarget('nextMonth', referenceDate), /September 2026/);

const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(batch, /activeCertificateBatchKeys/);
assert.match(batch, /CERTIFICATE_BATCH_ALREADY_RUNNING/);
assert.match(batch, /skipCertificateCodes\?: string\[\]/);
assert.match(batch, /discoveredEntries\.filter\(\(entry\) => !skippedCodeSet\.has\(entry\.certificateCode\)\)/);
assert.match(batch, /skippedCompletedCodes/);
assert.match(batch, /Already parsed and saved locally/i);

const codesScreen = read('app/certificate-codes.tsx');
assert.match(codesScreen, /certificateOperationRef/);
assert.match(codesScreen, /skipCertificateCodes: durablyCompletedCodes/);
assert.match(codesScreen, /Download Missing \/ Retry Failed/);
assert.match(codesScreen, /certificate-codes\.month-\$\{target\}/);
assert.match(codesScreen, /handleMonthTargetChange\(target\)/);
assert.match(codesScreen, /disabled=\{downloadBusy\}/);

const lookup = read('app/certificate-lookup.tsx');
assert.match(lookup, /searchOperationRef/);
assert.match(lookup, /skipCertificateCodes: completedCodes/);
assert.match(lookup, /handleNextMonth/);

const weather = read('state/SailingWeatherProvider.tsx');
assert.match(weather, /interface SailingWeatherPrefetchReport/);
assert.match(weather, /forecastAvailableFrom/);
assert.match(weather, /refreshedDates/);
assert.match(weather, /unavailableDates/);

const weatherCard = read('components/SailingWeatherCard.tsx');
assert.match(weatherCard, /Refresh Weather & Waves Now/);
assert.match(weatherCard, /Check live weather again/);
assert.match(weatherCard, /Cruise-day location unavailable—sync itinerary/);
assert.match(weatherCard, /Forecast not available yet/);
assert.match(weatherCard, /getForecastAvailabilityLabel/);

const booked = read('app/(tabs)/booked.tsx');
assert.match(booked, /prefetchCruiseForecastWindow\(nextCruise, \{ force: true \}\)/);
assert.match(booked, /invalidateQueries\(\{ queryKey: \['sailing-weather', nextCruise\.id\] \}\)/);

const offlinePack = read('app/offline-voyage-pack.tsx');
assert.match(offlinePack, /await refreshData\(\)/);
assert.match(offlinePack, /weatherReport\.forecastAvailableFrom/);
assert.match(offlinePack, /Run the cruise-line sync again to import its verified ports/);
assert.match(offlinePack, /never substitutes invented weather or itinerary ports/);

console.log('PASS Build 396 certificate resume/failed retry, next-month routing, weather refresh, forecast horizon, and itinerary diagnostics regression');
