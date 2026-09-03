const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
function compileTs(relativePath) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const { shiftAgendaDate } = compileTs('lib/calendar/agendaNavigation.ts');
assert.equal(shiftAgendaDate('2026-08-31', 1), '2026-09-01');
assert.equal(shiftAgendaDate('2026-03-01', -1), '2026-02-28');
assert.equal(shiftAgendaDate('2027-01-01', -1), '2026-12-31');

const events = read('app/(tabs)/events.tsx');
for (const mode of ['events', 'week', 'month', '90days']) assert(events.includes('testID={`calendar-view-${mode}`}') || events.includes('testID={`calendar-view-${mode}`'), 'calendar view selector must be instrumented');
assert.match(events, /mode === 'events' \? 'Agenda'/, 'primary Calendar mode must be labeled Agenda');
assert.match(events, /testID="tarot-month-toggle"/, 'Tarot-only month toggle must remain available');
assert.match(events, /!tarotMonthMode \? \(\s*<>[\s\S]*TimeZoneConverter/, 'Tarot month must not mount unrelated time-zone tools');
assert.match(events, /!tarotMonthMode \? <TouchableOpacity[\s\S]*calendar-open-crew-recognition/, 'Tarot month must not mount owner-scoped Crew navigation');
assert.match(events, /testID="clear-events-button"/, 'event clearing control must remain explicit');
assert.match(events, /testID="calendar-open-crew-recognition"/, 'Calendar must provide explicit Crew navigation');

const agenda = read('app/day-agenda.tsx');
assert.match(agenda, /testID="day-agenda-previous-day"/, 'previous-day control missing');
assert.match(agenda, /testID="day-agenda-next-day"/, 'next-day control missing');
assert.match(agenda, /shiftAgendaDate\(currentDateKey, offset\)/, 'arrows must drive the selected route date');
assert.match(agenda, /prefetchCruiseForecastWindow/, 'date changes must refresh route-aware forecast data');

const weather = read('components/VoyageWeatherSection.tsx');
assert.match(weather, /expandedWeatherSections/, 'weather expansion must survive component refresh/re-mount');
assert.match(weather, /setPersistentExpanded\(true\)/, 'weather sync must keep an opened panel open');

const crew = read('app/crew-recognition.tsx');
assert.match(crew, /CrewRecognitionSection/, 'Crew drill-down must retain the complete crew workflow');
assert.match(crew, /testID="crew-recognition-back"/, 'Crew drill-down must return to Calendar');

console.log('Build 440 Calendar modes, Day Agenda navigation, weather state, Tarot, and Crew regression passed.');
