const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const { shiftAgendaDate } = loadTs('lib/calendar/agendaNavigation.ts');
assert.equal(shiftAgendaDate('2026-09-30', 1), '2026-10-01');
assert.equal(shiftAgendaDate('2026-09-01', -1), '2026-08-31');
assert.equal(shiftAgendaDate('2028-03-01', -1), '2028-02-29');

const agenda = fs.readFileSync('app/day-agenda.tsx', 'utf8');
for (const marker of [
  'testID="day-agenda-back"',
  'testID="day-agenda-refresh"',
  'testID="day-agenda-previous-day"',
  'testID="day-agenda-next-day"',
  'shiftAgendaDate(currentDateKey, offset)',
  'router.setParams({ date: nextDate })',
  'testID="day-agenda-todays-priorities"',
  'Today’s Priorities',
  "router.push('/easy-seas-home' as any)",
  'testID="day-agenda-weather-heading"',
  'testID="day-agenda-schedule-heading"',
  'testID="day-agenda-luck-heading"',
  'testID="day-agenda-events-heading"',
  'testID="day-agenda-timeline-heading"',
]) assert.ok(agenda.includes(marker), `Day Agenda is missing ${marker}.`);

// The route date must drive the complete agenda truth, not only its label.
assert.match(agenda, /const selectedDate = useMemo\([\s\S]*\}, \[date\]\)/);
assert.match(agenda, /const mergedCruiseBookings = useMemo[\s\S]*\}, \[normalizedBookedCruises, selectedDate, isDateInRange\]\)/);
assert.match(agenda, /const timelineEvents = useMemo[\s\S]*\[selectedDate, mergedCruiseBookings, calendarEvents/);
assert.match(agenda, /const agendaItems = useMemo[\s\S]*\[selectedDate, calendarEvents, mergedCruiseBookings/);
assert.match(agenda, /selectVoyageWeatherBlock\(allWeatherCruises, dateStr\)/);
assert.match(agenda, /prefetchCruiseForecastWindow\(cruise, \{[\s\S]*anchorDate:/);
assert.match(agenda, /getItineraryForDay\(cruiseData, dayNum\)/);

// Refresh reconciles cruise-backed events and leaves weather expansion under the persistent weather section.
assert.match(agenda, /generateCruiseCalendarEvents\(normalizedBookedCruises\)/);
assert.match(agenda, /await coreData\.setCalendarEvents\(allEvents\)/);
assert.match(agenda, /<VoyageWeatherSection key=/);

const weatherSection = fs.readFileSync('components/VoyageWeatherSection.tsx', 'utf8');
assert.match(weatherSection, /const expandedWeatherSections = new Set<string>\(\)/);
assert.match(weatherSection, /finally \{[\s\S]*setPersistentExpanded\(true\)/);
assert.match(weatherSection, /plan\.days\.map/);

const weatherCard = fs.readFileSync('components/SailingWeatherCard.tsx', 'utf8');
assert.match(weatherCard, /<VisibleItineraryMap/);
assert.match(weatherCard, /sailing-weather-visible-map-/);
assert.match(weatherCard, /sailing-weather-position-map-/);

const map = fs.readFileSync('components/VisibleItineraryMap.tsx', 'utf8');
const mapTiles = fs.readFileSync('lib/visibleMapTiles.ts', 'utf8');
assert.match(map, /layout\.tiles\.map/);
assert.match(map, /layout\.markerLeft/);
assert.match(mapTiles, /tile\.openstreetmap\.org/);

console.log('PASS Build 445 Item 27 Day Agenda arrows, route-driven truth, themed priorities/sections, persistent refresh, itinerary position, and visible map');
