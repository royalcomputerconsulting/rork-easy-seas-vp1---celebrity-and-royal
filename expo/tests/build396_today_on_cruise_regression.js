const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
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

function dateOnly(value) {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

const pipeline = {
  toCruiseDateOnly: dateOnly,
  buildCruiseDayPlan: (cruise) => ({
    sailDate: cruise.sailDate,
    returnDate: cruise.returnDate,
    days: cruise.itinerary,
    integrity: 'verified',
    issues: [],
  }),
  getCruiseDayForDate: (cruise, target) => cruise.itinerary.find((day) => day.date === dateOnly(target)),
};

const today = new Date(2026, 7, 21, 12, 0, 0);
const todayKey = '2026-08-21';
const inProgress = (cruise) => cruise.sailDate <= todayKey && cruise.returnDate >= todayKey;
const lib = compileTs('lib/todayOnCruise.ts', {
  '@/types/models': {},
  '@/lib/cruiseDayPipeline': pipeline,
  '@/lib/date': { toLocalCalendarDateOnly: () => todayKey },
  '@/lib/bookedCruiseStatus': { isInProgressBookedCruise: inProgress },
});

const cruise = {
  id: 'booking-1',
  shipName: 'Celebrity Equinox',
  sailDate: '2026-08-20',
  returnDate: '2026-08-23',
  departurePort: 'Barcelona',
  destination: 'Mediterranean',
  nights: 3,
  cabinNumber: '7021',
  cabinCategory: 'Balcony',
  musterStation: 'C4',
  reservationNumber: 'ABC123',
  itinerary: [
    { day: 1, date: '2026-08-20', port: 'Barcelona', isSeaDay: false },
    { day: 2, date: todayKey, port: 'Tangier', arrival: '8:00 AM', departure: '6:00 PM', isSeaDay: false },
    { day: 3, date: '2026-08-22', port: '', isSeaDay: true },
    { day: 4, date: '2026-08-23', port: 'Barcelona', isSeaDay: false },
  ],
  diningReservations: [{ restaurant: 'Tuscan Grille', date: todayKey, time: '7:30 PM' }],
  excursions: [{ name: 'Tangier Highlights', date: todayKey, cost: 125, booked: true }],
};
const events = [{ id: 'spa-1', title: 'Spa appointment', startDate: `${todayKey}T14:00:00`, endDate: `${todayKey}T15:00:00`, type: 'personal', cruiseId: cruise.id, location: 'Deck 12' }];

const brief = lib.buildTodayOnCruiseBrief(cruise, events, today);
assert.equal(brief.phase, 'onboard');
assert.equal(brief.statusLabel, 'Day 2 of 4');
assert.equal(brief.locationLabel, 'Tangier');
assert.equal(brief.arrival, '8:00 AM');
assert.equal(brief.departure, '6:00 PM');
assert.equal(brief.agenda.length, 3);
assert.ok(brief.agenda.some((item) => item.title === 'Tuscan Grille'));
assert.ok(brief.agenda.some((item) => item.title === 'Tangier Highlights'));
assert.ok(brief.agenda.some((item) => item.title === 'Spa appointment'));
assert.ok(brief.essentials.some((item) => item.label === 'Stateroom' && /7021/.test(item.value)));
assert.ok(brief.essentials.some((item) => item.label === 'Muster' && item.value === 'C4'));

const future = { ...cruise, id: 'future', sailDate: '2026-09-10', returnDate: '2026-09-15' };
assert.equal(lib.selectOperationalCruise([future, cruise], today)?.id, cruise.id);
assert.equal(lib.selectOperationalCruise([future], today)?.id, future.id);
assert.equal(lib.selectOperationalCruise([future, cruise], today, future.id)?.id, future.id);

const screen = read('app/today-on-cruise.tsx');
const booked = read('app/(tabs)/booked.tsx');
const agenda = read('app/day-agenda.tsx');
assert.match(screen, /today-on-cruise-location-card/);
assert.match(screen, /today-on-cruise-agenda-card/);
assert.match(screen, /today-on-cruise-essentials-card/);
assert.doesNotMatch(screen, /SailingWeatherCard|VoyageWeatherSection|today-on-cruise-weather-card/, 'Today on My Cruise must not duplicate the weather presentation.');
assert.match(agenda, /<VoyageWeatherSection/, 'Day Agenda must retain the canonical daily weather presentation.');
assert.match(booked, /<VoyageWeatherSection cruise=\{nextCruise\}/, 'Booked must retain the one upcoming-voyage weather presentation.');
assert.match(booked, /booked-today-on-cruise-button/);
assert.match(booked, /pathname: '\/today-on-cruise'/);

console.log('PASS build396_today_on_cruise_regression — active/next voyage selection, cruise-day location, local agenda, essentials, single-owner weather placement, and My Cruises navigation verified');
