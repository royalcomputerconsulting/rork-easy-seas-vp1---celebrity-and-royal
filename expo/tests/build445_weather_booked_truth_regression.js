const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const weatherProvider = fs.readFileSync(path.join(root, 'state/SailingWeatherProvider.tsx'), 'utf8');
const weatherSection = fs.readFileSync(path.join(root, 'components/VoyageWeatherSection.tsx'), 'utf8');
const booked = fs.readFileSync(path.join(root, 'app/(tabs)/booked.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(weatherProvider.includes("onProgress?: (progress: SailingWeatherPrefetchProgress) => void"), 'Weather prefetch must expose per-day progress.');
assert(weatherProvider.includes("result: 'dated' | 'planning' | 'failed'"), 'Weather progress must distinguish dated, planning, and failed evidence.');
assert(weatherProvider.includes('datedForecastDates: Array.from(new Set(datedForecastDates)).sort()'), 'The final report must retain dated provider forecast evidence.');
assert(weatherProvider.includes('planningDates: Array.from(new Set(planningDates)).sort()'), 'The final report must retain planning/current-area evidence separately.');
assert(weatherSection.includes('Processed ${progress.completed}/${progress.total} voyage days'), 'The voyage UI must advance after each completed day.');
assert(booked.includes('getCruiseByIdentity({'), 'Booked cards must query exact SQLite sailing facts after the high-volume catalog leaves memory.');
assert(booked.includes('indexedBookedCatalogFacts'), 'Indexed sailing facts must feed booked-card enrichment.');
assert(booked.includes('shipName: cruise.shipName') && booked.includes('sailDate: cruise.sailDate.slice(0, 10)'), 'Booked fact lookup must use exact ship and sailing date identity.');

console.log('PASS build445 weather progress and booked truth regression');
