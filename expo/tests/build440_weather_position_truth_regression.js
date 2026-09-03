const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const helperPath = path.join(root, 'lib/weatherPositionPresentation.ts');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const output = ts.transpile(helperSource, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
});
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', output)(moduleShim, moduleShim.exports, require);
const { buildWeatherPositionPresentation } = moduleShim.exports;

const today = buildWeatherPositionPresentation('2026-08-30', 25.08, -77.34, 'Nassau', '2026-08-30');
assert.equal(today.kind, 'today-expected');
assert.match(today.label, /Today.*expected itinerary position/);
assert.match(today.disclaimer, /not live AIS ship tracking/i);
assert.match(today.mapUrl, /maps\.apple\.com/);
assert.match(today.mapUrl, /25\.08,-77\.34/);

const future = buildWeatherPositionPresentation('2026-09-12', 25.08, -77.34, 'Nassau', '2026-08-30');
assert.equal(future.kind, 'planned');
assert.equal(future.label, 'Planned itinerary position');

const past = buildWeatherPositionPresentation('2026-08-29', 25.08, -77.34, 'Nassau', '2026-08-30');
assert.equal(past.kind, 'historical');

const cardSource = fs.readFileSync(path.join(root, 'components/SailingWeatherCard.tsx'), 'utf8');
assert.match(cardSource, /sailing-weather-position-map-/);
assert.match(cardSource, /Linking\.openURL\(positionPresentation\.mapUrl\)/);
assert.match(helperSource, /not live AIS ship tracking/);

const providerSource = fs.readFileSync(path.join(root, 'state/SailingWeatherProvider.tsx'), 'utf8');
assert.match(providerSource, /api\.weather\.gov\/points/);
assert.match(providerSource, /latest_obs\.txt/);
assert.match(providerSource, /distanceMiles/);
assert.match(providerSource, /cache-stale/);
assert.match(providerSource, /open-meteo\.com/);
assert.match(providerSource, /met\.no/);

console.log('Build 440 weather position truth regression passed.');
