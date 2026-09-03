const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const provider = fs.readFileSync(path.join(root, 'state/SailingWeatherProvider.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'components/SailingWeatherCard.tsx'), 'utf8');
const voyageSection = fs.readFileSync(path.join(root, 'components/VoyageWeatherSection.tsx'), 'utf8');

assert.match(provider, /type SailingWeatherSource = [^;]*'planning'/, 'planning weather source must remain explicit');
assert.match(provider, /const datesToPrefetch = voyageDates;/, 'every voyage date must receive a local card');
assert.match(provider, /buildPlanningForecast\(cruise, targetDate, resolvedPoint\)/, 'outside-window days must receive truthful planning cards');
assert.match(provider, /Official NOAA \/ National Weather Service/, 'U.S. point forecasts must prefer official NWS data');
assert.match(provider, /Open-Meteo weather best match/, 'Open-Meteo must remain the first global fallback');
assert.match(provider, /MET Norway Locationforecast/, 'MET Norway must remain an independent atmospheric fallback');
assert.match(provider, /NOAA GFS Wave via Open-Meteo/, 'NOAA GFS Wave must remain a marine source');
assert.match(provider, /Open-Meteo marine best match/, 'marine best-match fallback must remain available');
assert.match(provider, /www\.ndbc\.noaa\.gov\/data\/latest_obs\/latest_obs\.txt/, 'same-day route cards must validate against official NDBC observations');
assert.match(provider, /haversineMiles/, 'nearest buoy selection must be based on geographic distance');
assert.match(provider, /runAfterUiSettles/, 'background weather must use the guarded scheduler');
assert.doesNotMatch(provider, /import \{[^}]*InteractionManager[^}]*\} from 'react-native'/, 'weather must not require deprecated InteractionManager');
assert.match(card, /forecast\.source === 'planning'/, 'planning forecasts must be visibly labeled');
assert.match(card, /forecast\.weatherSourceLabel/, 'cards must disclose the atmospheric source');
assert.match(card, /forecast\.nearestBuoyObservation/, 'cards must disclose current nearest-buoy validation when available');
assert.match(voyageSection, /expandedWeatherSections/, 'voyage weather folder must retain open state across refresh/remount');
assert.match(voyageSection, /setPersistentExpanded\(true\)/, 'sync/refresh must keep the weather folder open');

console.log('PASS build423 every-voyage-day weather regression');
