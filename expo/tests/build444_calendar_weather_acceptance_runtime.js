const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
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
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const normalizeDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : undefined;
const dateStub = {
  toCalendarDateOnly: normalizeDate,
  toTimeZoneCalendarDateOnly: (value) => value.toISOString().slice(0, 10),
};
const cruiseDays = compileTs('lib/cruiseDayPipeline.ts', { './date': dateStub });
const voyageSelection = compileTs('lib/calendar/voyageWeatherSelection.ts', {
  '../cruiseDayPipeline': { toCruiseDateOnly: normalizeDate },
});
const agendaNavigation = compileTs('lib/calendar/agendaNavigation.ts');
const positionPresentation = compileTs('lib/weatherPositionPresentation.ts');
const visibleMapTiles = compileTs('lib/visibleMapTiles.ts');

assert.equal(agendaNavigation.shiftAgendaDate('2026-09-30', 1), '2026-10-01');
assert.equal(agendaNavigation.shiftAgendaDate('2028-03-01', -1), '2028-02-29');

const b2b = [
  { id: 'harmony-a-reservation-1', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', returnDate: '2026-09-15', nights: 5, departurePort: 'Port Canaveral', destination: 'Bahamas & Perfect Day' },
  { id: 'harmony-b-reservation-1', shipName: 'Harmony of the Seas', sailDate: '2026-09-15', returnDate: '2026-09-19', nights: 4, departurePort: 'Port Canaveral', destination: 'Bahamas & Perfect Day' },
  { id: 'harmony-b-reservation-2', shipName: 'Harmony of the Seas', sailDate: '2026-09-15', returnDate: '2026-09-19', nights: 4, departurePort: 'Port Canaveral', destination: 'Bahamas & Perfect Day' },
  { id: 'harmony-c-reservation-1', shipName: 'Harmony of the Seas', sailDate: '2026-09-19', returnDate: '2026-09-26', nights: 7, departurePort: 'Port Canaveral', destination: 'Eastern Caribbean & Perfect Day' },
  { id: 'unrelated', shipName: 'Icon of the Seas', sailDate: '2026-10-24', returnDate: '2026-10-31', nights: 7 },
];

const selectedBlock = voyageSelection.selectVoyageWeatherBlock(b2b, '2026-09-12');
assert.equal(selectedBlock.length, 3, 'all three physical Harmony legs must be visible from any day in the block');
assert.deepEqual(selectedBlock.map((row) => row.sailDate), ['2026-09-10', '2026-09-15', '2026-09-19']);
assert.equal(voyageSelection.selectVoyageWeatherBlock(b2b, '2026-09-15').length, 3, 'turnaround day must retain both adjacent legs and the full block');

const dateCoverage = new Set();
for (const voyage of selectedBlock) {
  const plan = cruiseDays.buildCruiseDayPlan(voyage);
  assert.ok(plan, `weather plan missing for ${voyage.sailDate}`);
  plan.days.forEach((day) => {
    assert.ok(day.date, `date missing for day ${day.day}`);
    assert.ok(day.port || day.isSeaDay, `route truth missing for ${day.date}`);
    dateCoverage.add(day.date);
  });
}
assert.equal(dateCoverage.size, 17, 'Sep 10 through Sep 26 must have continuous itinerary/weather coverage');
assert.ok(dateCoverage.has('2026-09-12'));
assert.ok(dateCoverage.has('2026-09-26'));

const todayPosition = positionPresentation.buildWeatherPositionPresentation('2026-09-12', 25.08, -77.34, 'Nassau route', '2026-09-12');
assert.equal(todayPosition.kind, 'today-expected');
assert.match(todayPosition.disclaimer, /not live AIS/i);
assert.match(todayPosition.mapUrl, /maps\.apple\.com/);
const futurePosition = positionPresentation.buildWeatherPositionPresentation('2026-09-13', 25.08, -77.34, 'Nassau route', '2026-09-12');
assert.equal(futurePosition.kind, 'planned');

const mapLayout = visibleMapTiles.buildVisibleMapTileLayout(25.08, -77.34, 340, 176, 7);
assert.equal(mapLayout.tiles.length, 9, 'visible map must be backed by a 3x3 geographic tile grid');
assert.ok(mapLayout.tiles.every((tile) => /^https:\/\/tile\.openstreetmap\.org\/7\/\d+\/\d+\.png$/.test(tile.url)));
assert.equal(mapLayout.markerLeft, 170);
assert.equal(mapLayout.markerTop, 88);

const agenda = read('app/day-agenda.tsx');
assert.match(agenda, /day-agenda-previous-day/);
assert.match(agenda, /day-agenda-next-day/);
assert.match(agenda, /selectVoyageWeatherBlock\(allWeatherCruises, dateStr\)/);
assert.match(agenda, /agenda-weather-back-to-back-summary/);
assert.match(agenda, /weatherVoyages\.map/);

const calendar = read('app/(tabs)/events.tsx');
for (const target of ['calendar-view-events', 'calendar-view-week', 'calendar-view-month', 'calendar-view-90days', 'calendar-view-passenger']) {
  assert.ok(calendar.includes('testID={`calendar-view-${mode}`}'), `${target} must be generated by the mode selector`);
}
for (const target of ['calendar-period-previous', 'calendar-period-next', 'calendar-go-to-today', 'tarot-month-toggle', 'calendar-open-crew-recognition', 'clear-events-button']) {
  assert.ok(calendar.includes(`testID="${target}"`), `${target} is missing`);
}

const weatherSection = read('components/VoyageWeatherSection.tsx');
assert.match(weatherSection, /expandedWeatherSections/);
assert.match(weatherSection, /finally \{[\s\S]*setPersistentExpanded\(true\)/, 'refresh completion must leave the folder open');
assert.match(weatherSection, /plan\.days\.map/, 'every voyage day must render a weather card');

const weatherCard = read('components/SailingWeatherCard.tsx');
assert.match(weatherCard, /VisibleItineraryMap/);
assert.match(weatherCard, /sailing-weather-visible-map-/);
assert.match(weatherCard, /nearestBuoyObservation\.distanceMiles/);
assert.match(weatherCard, /forecast\.weatherSourceLabel/);
assert.match(weatherCard, /forecast\.marineSourceLabel/);
assert.match(weatherCard, /forecast\.updatedAt/);
assert.match(weatherCard, /operationalMarine\.confidence/);

console.log('PASS Build 444 Calendar, B2B itinerary weather, visible map, source disclosure, and expansion acceptance');
