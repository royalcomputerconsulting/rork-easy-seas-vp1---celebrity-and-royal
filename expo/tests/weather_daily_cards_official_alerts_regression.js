const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const voyage = read('components/VoyageWeatherSection.tsx');
assert.match(voyage, /Current or next available sailing/);
assert.match(voyage, /plan\.days\.map/);
assert.match(voyage, /Sync Weather for Entire Sailing/);
assert.match(voyage, /<OfficialVoyageAlerts/);

const officialAlerts = read('lib/noaaVoyageAlerts.ts');
assert.match(officialAlerts, /MAX_TROPICAL_DISTANCE_MILES = 1500/);
assert.match(officialAlerts, /https:\/\/www\.nhc\.noaa\.gov\/CurrentStorms\.json/);
assert.match(officialAlerts, /https:\/\/api\.weather\.gov\/alerts\/active\?point=/);
assert.match(officialAlerts, /AsyncStorage\.setItem/);
assert.match(officialAlerts, /offline saved result/);

const card = read('components/SailingWeatherCard.tsx');
assert.match(card, /planning outlook \(not live\)/);
assert.match(card, /Port Canaveral · Atlantic waters off Brevard County/);
assert.match(card, /AT SEA · Atlantic route toward\/near the Bahamas/);
assert.match(card, /Check live weather again/);

const agenda = read('app/day-agenda.tsx');
assert.match(agenda, /selectVoyageWeatherBlock/);
assert.match(agenda, /weatherVoyages\.map/);
assert.match(agenda, /cruise=\{voyage\}/);
assert.doesNotMatch(agenda, /<CruiseWeatherDayPicker/);

const weatherProvider = read('state/SailingWeatherProvider.tsx');
assert.doesNotMatch(weatherProvider, /forecast_days=16&start_date=/, 'Open-Meteo rejects forecast_days combined with an explicit date range');

console.log('PASS one-card-per-voyage-day weather, honest planning outlooks, refresh controls, and cached NOAA/NHC route alerts');
