const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const cruiseDayPipeline = compileTs('lib/cruiseDayPipeline.ts', {
  './date': {
    toCalendarDateOnly: (value) => {
      const text = String(value ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      return undefined;
    },
    toTimeZoneCalendarDateOnly: (value) => value.toISOString().slice(0, 10),
  },
});

const harmonyFiveNight = cruiseDayPipeline.buildCruiseDayPlan({
  id: 'harmony-2026-09-10',
  shipName: 'Harmony of the Seas',
  sailDate: '2026-09-10',
  returnDate: '2026-09-15',
  nights: 5,
  departurePort: 'Port Canaveral, Florida',
  itineraryName: '5-Night Bahamas & Perfect Day Cruise',
  destination: 'Bahamas & Perfect Day',
  itinerary: [],
});

assert.ok(harmonyFiveNight, 'Harmony five-night sailing must build a weather route');
assert.equal(harmonyFiveNight.days.length, 6, 'weather plan includes embarkation through return/disembarkation day');
assert.equal(harmonyFiveNight.days[0].port, 'Port Canaveral, Florida');
assert.equal(harmonyFiveNight.days[1].port, 'Nassau, Bahamas');
assert.equal(harmonyFiveNight.days[2].date, '2026-09-12');
assert.equal(harmonyFiveNight.days[2].isSeaDay, true, 'Sep 12 day 3 must be treated as an offshore sea/weather-route day');
assert.match(harmonyFiveNight.days[2].port, /Nassau.*CocoCay/, 'Sep 12 route label must anchor near Nassau and CocoCay');
assert.equal(harmonyFiveNight.days[3].port, 'Perfect Day at CocoCay, Bahamas');
assert.equal(harmonyFiveNight.days[5].port, 'Port Canaveral, Florida');

const harmonyFourNight = cruiseDayPipeline.buildCruiseDayPlan({
  id: 'harmony-2026-09-15',
  shipName: 'Harmony of the Seas',
  sailDate: '2026-09-15',
  returnDate: '2026-09-19',
  nights: 4,
  departurePort: 'Port Canaveral',
  itineraryName: '4-Night Bahamas & Perfect Day Cruise',
  destination: 'Bahamas & Perfect Day',
});

assert.equal(harmonyFourNight.days[2].port, 'Perfect Day at CocoCay, Bahamas', 'four-night fallback must place day 3 at CocoCay');
assert.equal(harmonyFourNight.days[3].isSeaDay, true, 'four-night fallback must place return transit offshore');

const harmonySevenNight = cruiseDayPipeline.buildCruiseDayPlan({
  id: 'harmony-2026-09-19',
  shipName: 'Harmony of the Seas',
  sailDate: '2026-09-19',
  returnDate: '2026-09-26',
  nights: 7,
  departurePort: 'Port Canaveral',
  itineraryName: '7-Night Eastern Caribbean & Perfect Day',
  destination: 'Eastern Caribbean & Perfect Day',
});

assert.equal(harmonySevenNight.days[1].port, 'Perfect Day at CocoCay, Bahamas');
assert.equal(harmonySevenNight.days[3].port, 'Charlotte Amalie, St. Thomas, USVI');
assert.equal(harmonySevenNight.days[4].port, 'Philipsburg, St. Maarten');
assert.equal(harmonySevenNight.days[7].port, 'Port Canaveral');

const providerPlan = cruiseDayPipeline.buildCruiseDayPlan({
  sailDate: '2026-09-10',
  returnDate: '2026-09-15',
  nights: 5,
  departurePort: 'Port Canaveral',
  itineraryName: '5-Night Bahamas & Perfect Day Cruise',
  itinerary: [
    { day: 1, port: 'Port Canaveral', source: 'provider' },
    { day: 2, port: 'Perfect Day at CocoCay', source: 'provider' },
  ],
});

assert.equal(providerPlan.days[1].port, 'Perfect Day at CocoCay', 'provider itinerary must win over derived fallback');
assert.match(providerPlan.days[2].port, /Nassau.*CocoCay|route position estimated|Bahamas/, 'missing provider days should still receive a usable route fallback');

const weatherSection = read('components/VoyageWeatherSection.tsx');
assert.match(weatherSection, /useState\(false\)/, 'voyage weather section must remain collapsed until the user opens it');
assert.match(weatherSection, /Sync Weather for Entire Sailing/, 'weather section must expose an explicit full-sailing sync control');

const sailingWeatherProvider = read('state/SailingWeatherProvider.tsx');
assert.match(sailingWeatherProvider, /ports\?: string\[\]/, 'weather cruise input must accept the imported route port list');

const dayAgenda = read('app/day-agenda.tsx');
assert.match(dayAgenda, /ports: c\.ports/, 'Day Agenda upcoming weather payload must preserve ports');
assert.match(dayAgenda, /ports: cruise\.ports/, 'Day Agenda fallback weather payload must preserve ports');

console.log('PASS Build 426 derives Harmony B2B weather route days instead of falling back to the embarkation city');
