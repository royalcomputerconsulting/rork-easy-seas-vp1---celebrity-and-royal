const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const calendar = loadTs('lib/calendar/cruiseEvents.ts');
const { USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS } = loadTs('constants/confirmedBookedCruises.ts');

const staleOvation = {
  id: 'cruise-old-ovation-september',
  title: 'Ovation of the Seas',
  type: 'cruise',
  sourceType: 'cruise',
  startDate: '2026-09-04',
  endDate: '2026-09-18',
  start: '2026-09-04',
  end: '2026-09-18',
  allDay: true,
};
const personalSeptemberEvent = {
  id: 'personal-september-4',
  title: 'Personal appointment',
  type: 'personal',
  startDate: '2026-09-04',
  endDate: '2026-09-04',
  allDay: true,
};

const eligible = calendar.getCalendarEligibleCruises(USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS);
assert.equal(eligible.length, 13, 'same-sailing cabins must share one calendar schedule while all confirmed current sailings remain visible');
assert.equal(eligible.some((cruise) => cruise.reservationNumber === '1861386'), true, 'Utopia confirmed booking must mark cruise days');
assert.equal(eligible.some((cruise) => cruise.reservationNumber === '891839'), true, 'Icon Oct 24 confirmed booking must mark cruise days');
assert.equal(eligible.filter((cruise) => cruise.shipName === 'Harmony of the Seas' && cruise.sailDate === '2026-09-15').length, 1);

const confirmedHarmony = USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS.find((cruise) => cruise.reservationNumber === '3658443');
const withConflictingDuplicate = calendar.getCalendarEligibleCruises([
  ...USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS,
  { ...confirmedHarmony, id: 'stale-harmony-range', reservationNumber: 'STALE', returnDate: '2026-09-17', nights: 5 },
]);
const selectedHarmony = withConflictingDuplicate.find((cruise) => cruise.shipName === 'Harmony of the Seas' && cruise.sailDate === '2026-09-10');
assert.equal(selectedHarmony.returnDate, '2026-09-15', 'a conflicting duplicate return date must not add phantom cruise days');

const events = calendar.getCalendarEventsWithGeneratedCruiseEvents(
  USER_CONFIRMED_CURRENT_ROYAL_BOOKINGS,
  [staleOvation, personalSeptemberEvent],
);
assert.equal(events.some((event) => event.id === staleOvation.id), false, 'orphaned stored cruise spans must be removed');
assert.equal(events.some((event) => event.id === personalSeptemberEvent.id), true, 'non-cruise calendar events must remain');

const septemberCruiseDates = new Set();
events
  .filter((event) => event.id.startsWith('generated-cruise-span-'))
  .forEach((event) => {
    const start = String(event.startDate || event.start || '').slice(0, 10);
    const end = String(event.endDate || event.end || start).slice(0, 10);
    for (let cursor = start; cursor && cursor <= end;) {
      if (cursor.startsWith('2026-09-')) septemberCruiseDates.add(cursor);
      cursor = calendarDateAdd(cursor, 1);
    }
  });

function calendarDateAdd(value, days) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

for (let day = 1; day <= 9; day += 1) {
  assert.equal(septemberCruiseDates.has(`2026-09-${String(day).padStart(2, '0')}`), false, `September ${day} must not be marked as a cruise day`);
}
for (let day = 10; day <= 26; day += 1) {
  assert.equal(septemberCruiseDates.has(`2026-09-${String(day).padStart(2, '0')}`), true, `September ${day} must reflect a confirmed Harmony sailing`);
}
assert.equal(septemberCruiseDates.has('2026-09-27'), false, 'September 27 must not be marked as a cruise day');
assert.equal(septemberCruiseDates.has('2026-09-28'), false, 'September 28 must not be marked as a cruise day');
assert.equal(septemberCruiseDates.has('2026-09-29'), true, 'September 29 must reflect the confirmed Anthem sailing');
assert.equal(septemberCruiseDates.has('2026-09-30'), true, 'September 30 must reflect the confirmed Anthem sailing');

const eventsScreen = fs.readFileSync(path.join(root, 'app/(tabs)/events.tsx'), 'utf8');
const agenda = fs.readFileSync(path.join(root, 'app/day-agenda.tsx'), 'utf8');
const passenger = fs.readFileSync(path.join(root, 'app/passenger-calendar.tsx'), 'utf8');
assert.ok(eventsScreen.includes('getCalendarEligibleCruises(filteredBookedCruises)'));
assert.ok(eventsScreen.includes('visibleSourceCalendarEvents'));
assert.ok(agenda.includes('.filter(isBookedCruiseEligibleForCalendar)'));
assert.ok(passenger.includes('getDisplayCalendarEvents(normalizedBookedCruises, filteredEvents)'));

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
assert.equal(app.version, '13.0.61');
assert.equal(String(app.ios.buildNumber), '427');
assert.equal(app.android.versionCode, 130093);

console.log('PASS Build 394 calendar uses booked-sailing truth, removes orphan cruise spans, and marks September accurately');
