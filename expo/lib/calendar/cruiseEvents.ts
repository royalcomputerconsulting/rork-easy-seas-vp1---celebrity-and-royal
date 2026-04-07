import type { BookedCruise, CalendarEvent, ItineraryDay } from '@/types/models';
import { createDateFromString } from '@/lib/date';

const SHORT_EVENT_MINUTES = 30;
const ALL_ABOARD_WINDOW_MINUTES = 45;

interface ParsedTime {
  hours: number;
  minutes: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeText(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeDateOnly(value?: string | null): string {
  if (!value) return '';
  const parsed = createDateFromString(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const baseDate = createDateFromString(dateOnly);
  if (Number.isNaN(baseDate.getTime())) return dateOnly;
  baseDate.setDate(baseDate.getDate() + days);
  return `${baseDate.getFullYear()}-${pad2(baseDate.getMonth() + 1)}-${pad2(baseDate.getDate())}`;
}

function parseTimeValue(value?: string): ParsedTime | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  const upperValue = normalizedValue.toUpperCase();
  if (upperValue === 'MIDNIGHT') return { hours: 0, minutes: 0 };
  if (upperValue === 'NOON') return { hours: 12, minutes: 0 };

  const twelveHourMatch = upperValue.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/);
  if (twelveHourMatch) {
    const parsedHours = parseInt(twelveHourMatch[1], 10);
    const parsedMinutes = parseInt(twelveHourMatch[2] ?? '0', 10);
    if (parsedHours < 1 || parsedHours > 12 || parsedMinutes < 0 || parsedMinutes > 59) return null;
    return {
      hours: parsedHours % 12 + (twelveHourMatch[3] === 'PM' ? 12 : 0),
      minutes: parsedMinutes,
    };
  }

  const twentyFourHourMatch = upperValue.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (twentyFourHourMatch) {
    const parsedHours = parseInt(twentyFourHourMatch[1], 10);
    const parsedMinutes = parseInt(twentyFourHourMatch[2], 10);
    if (parsedHours < 0 || parsedHours > 23 || parsedMinutes < 0 || parsedMinutes > 59) return null;
    return { hours: parsedHours, minutes: parsedMinutes };
  }

  return null;
}

function combineDateAndTime(dateOnly: string, timeValue?: string): string | null {
  const parsedTime = parseTimeValue(timeValue);
  if (!parsedTime) return null;
  return `${dateOnly}T${pad2(parsedTime.hours)}:${pad2(parsedTime.minutes)}:00`;
}

function addMinutesToDateTime(dateTime: string, minutesToAdd: number): string {
  const parsedDate = new Date(dateTime);
  if (Number.isNaN(parsedDate.getTime())) return dateTime;
  parsedDate.setMinutes(parsedDate.getMinutes() + minutesToAdd);
  return `${parsedDate.getFullYear()}-${pad2(parsedDate.getMonth() + 1)}-${pad2(parsedDate.getDate())}T${pad2(parsedDate.getHours())}:${pad2(parsedDate.getMinutes())}:00`;
}

function getEventStartValue(event: CalendarEvent): string {
  return event.start || event.startDate || '';
}

function getEventEndValue(event: CalendarEvent): string {
  return event.end || event.endDate || getEventStartValue(event);
}

function isTimedEvent(event: CalendarEvent): boolean {
  return getEventStartValue(event).includes('T') || getEventEndValue(event).includes('T');
}

function buildCruiseDescription(cruise: BookedCruise, itineraryDay?: ItineraryDay): string | undefined {
  const lines: string[] = [];

  if (cruise.shipName) lines.push(cruise.shipName);
  if (itineraryDay) lines.push(`Day ${itineraryDay.day}${itineraryDay.port ? ` • ${itineraryDay.port}` : ''}`);
  if (cruise.itineraryName) lines.push(cruise.itineraryName);
  if (cruise.reservationNumber) lines.push(`Reservation ${cruise.reservationNumber}`);
  if (cruise.cabinNumber) lines.push(`Cabin ${cruise.cabinNumber}`);
  if (itineraryDay?.notes) lines.push(itineraryDay.notes);

  return lines.length > 0 ? lines.join(' • ') : undefined;
}

function createCruiseEvent(event: CalendarEvent): CalendarEvent {
  return event;
}

function createCruiseSpanEvent(cruise: BookedCruise): CalendarEvent | null {
  const sailDate = normalizeDateOnly(cruise.sailDate);
  const returnDate = normalizeDateOnly(cruise.returnDate);
  if (!sailDate || !returnDate) return null;

  return createCruiseEvent({
    id: `generated-cruise-span-${cruise.id}`,
    title: cruise.shipName || 'Cruise',
    startDate: sailDate,
    endDate: returnDate,
    start: sailDate,
    end: returnDate,
    type: 'cruise',
    sourceType: 'cruise',
    location: cruise.departurePort,
    description: buildCruiseDescription(cruise),
    cruiseId: cruise.id,
    allDay: true,
    source: 'import',
  });
}

function createTimedCruiseEvent(params: {
  id: string;
  title: string;
  start: string;
  end: string;
  cruise: BookedCruise;
  itineraryDay?: ItineraryDay;
  location?: string;
  description?: string;
}): CalendarEvent {
  const startDateOnly = normalizeDateOnly(params.start);
  const endDateOnly = normalizeDateOnly(params.end);
  return createCruiseEvent({
    id: params.id,
    title: params.title,
    startDate: startDateOnly,
    endDate: endDateOnly || startDateOnly,
    start: params.start,
    end: params.end,
    type: 'cruise',
    sourceType: 'cruise',
    location: params.location,
    description: params.description ?? buildCruiseDescription(params.cruise, params.itineraryDay),
    cruiseId: params.cruise.id,
    allDay: false,
    source: 'import',
  });
}

function createAllDayCruiseEvent(params: {
  id: string;
  title: string;
  dateOnly: string;
  cruise: BookedCruise;
  itineraryDay?: ItineraryDay;
  location?: string;
  description?: string;
}): CalendarEvent {
  return createCruiseEvent({
    id: params.id,
    title: params.title,
    startDate: params.dateOnly,
    endDate: params.dateOnly,
    start: params.dateOnly,
    end: params.dateOnly,
    type: 'cruise',
    sourceType: 'cruise',
    location: params.location,
    description: params.description ?? buildCruiseDescription(params.cruise, params.itineraryDay),
    cruiseId: params.cruise.id,
    allDay: true,
    source: 'import',
  });
}

function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((left, right) => {
    const leftIsTimed = isTimedEvent(left);
    const rightIsTimed = isTimedEvent(right);
    if (leftIsTimed !== rightIsTimed) {
      return leftIsTimed ? 1 : -1;
    }
    const leftStart = getEventStartValue(left);
    const rightStart = getEventStartValue(right);
    if (leftStart !== rightStart) {
      return leftStart.localeCompare(rightStart);
    }
    return left.title.localeCompare(right.title);
  });
}

function matchesCruiseSummaryEvent(event: CalendarEvent, cruise: BookedCruise): boolean {
  const eventCruiseId = event.cruiseId;
  if (eventCruiseId && eventCruiseId === cruise.id) return true;

  const eventStartDate = normalizeDateOnly(getEventStartValue(event));
  const eventEndDate = normalizeDateOnly(getEventEndValue(event));
  const cruiseStartDate = normalizeDateOnly(cruise.sailDate);
  const cruiseEndDate = normalizeDateOnly(cruise.returnDate);
  if (!eventStartDate || !eventEndDate || !cruiseStartDate || !cruiseEndDate) return false;
  if (eventStartDate !== cruiseStartDate || eventEndDate !== cruiseEndDate) return false;

  const normalizedShipName = normalizeText(cruise.shipName);
  if (!normalizedShipName) return false;

  const haystacks = [event.title, event.location, event.description]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return haystacks.some((value) => value.includes(normalizedShipName));
}

export function isGeneratedCruiseEventId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith('generated-cruise-');
}

export function isCruiseCalendarEventBackedByBookedCruise(event: CalendarEvent, bookedCruises: BookedCruise[]): boolean {
  if (isGeneratedCruiseEventId(event.id)) return true;
  if (event.sourceType !== 'cruise' && event.type !== 'cruise') return false;
  return bookedCruises.some((cruise) => matchesCruiseSummaryEvent(event, cruise));
}

export function getDisplayCalendarEvents(bookedCruises: BookedCruise[], calendarEvents: CalendarEvent[]): CalendarEvent[] {
  return sortCalendarEvents(
    calendarEvents.filter((event) => !isCruiseCalendarEventBackedByBookedCruise(event, bookedCruises))
  );
}

export function generateCruiseCalendarEvents(bookedCruises: BookedCruise[]): CalendarEvent[] {
  const generatedEvents: CalendarEvent[] = [];

  bookedCruises.forEach((cruise) => {
    const cruiseSpanEvent = createCruiseSpanEvent(cruise);
    if (cruiseSpanEvent) {
      generatedEvents.push(cruiseSpanEvent);
    }

    const sailDate = normalizeDateOnly(cruise.sailDate);
    if (!sailDate || !Array.isArray(cruise.itinerary) || cruise.itinerary.length === 0) {
      return;
    }

    cruise.itinerary
      .slice()
      .sort((left, right) => left.day - right.day)
      .forEach((itineraryDay) => {
        const eventDate = addDaysToDateOnly(sailDate, itineraryDay.day - 1);
        const portLabel = itineraryDay.port || cruise.departurePort || 'Port';
        const arrivalDateTime = combineDateAndTime(eventDate, itineraryDay.arrival);
        const departureDateTime = combineDateAndTime(eventDate, itineraryDay.departure);

        if (itineraryDay.isSeaDay) {
          generatedEvents.push(
            createAllDayCruiseEvent({
              id: `generated-cruise-sea-day-${cruise.id}-${itineraryDay.day}`,
              title: `Sea Day • Day ${itineraryDay.day}`,
              dateOnly: eventDate,
              cruise,
              itineraryDay,
              location: cruise.shipName,
            })
          );
          return;
        }

        if (arrivalDateTime && departureDateTime) {
          generatedEvents.push(
            createTimedCruiseEvent({
              id: `generated-cruise-time-in-port-${cruise.id}-${itineraryDay.day}`,
              title: `TIME IN PORT • ${portLabel}`,
              start: arrivalDateTime,
              end: departureDateTime,
              cruise,
              itineraryDay,
              location: portLabel,
              description: `Time in port ${itineraryDay.arrival} - ${itineraryDay.departure}${buildCruiseDescription(cruise, itineraryDay) ? ` • ${buildCruiseDescription(cruise, itineraryDay)}` : ''}`,
            })
          );

          generatedEvents.push(
            createTimedCruiseEvent({
              id: `generated-cruise-port-arrival-${cruise.id}-${itineraryDay.day}`,
              title: `Port Arrival • ${portLabel}`,
              start: arrivalDateTime,
              end: addMinutesToDateTime(arrivalDateTime, SHORT_EVENT_MINUTES),
              cruise,
              itineraryDay,
              location: portLabel,
            })
          );

          const allAboardStart = addMinutesToDateTime(departureDateTime, -ALL_ABOARD_WINDOW_MINUTES);
          generatedEvents.push(
            createTimedCruiseEvent({
              id: `generated-cruise-all-aboard-${cruise.id}-${itineraryDay.day}`,
              title: `All Aboard • ${portLabel}`,
              start: allAboardStart,
              end: departureDateTime,
              cruise,
              itineraryDay,
              location: portLabel,
            })
          );
          return;
        }

        if (departureDateTime) {
          generatedEvents.push(
            createAllDayCruiseEvent({
              id: `generated-cruise-embarkation-day-${cruise.id}-${itineraryDay.day}`,
              title: itineraryDay.day === 1 ? 'Embarkation Day' : `Port Day • ${portLabel}`,
              dateOnly: eventDate,
              cruise,
              itineraryDay,
              location: portLabel,
            })
          );

          generatedEvents.push(
            createTimedCruiseEvent({
              id: `generated-cruise-sail-away-${cruise.id}-${itineraryDay.day}`,
              title: `Sail Away • ${portLabel}`,
              start: addMinutesToDateTime(departureDateTime, -ALL_ABOARD_WINDOW_MINUTES),
              end: departureDateTime,
              cruise,
              itineraryDay,
              location: portLabel,
            })
          );
          return;
        }

        if (arrivalDateTime) {
          generatedEvents.push(
            createAllDayCruiseEvent({
              id: `generated-cruise-disembarkation-day-${cruise.id}-${itineraryDay.day}`,
              title: itineraryDay.day === cruise.nights + 1 ? 'Disembarkation Day' : `Port Day • ${portLabel}`,
              dateOnly: eventDate,
              cruise,
              itineraryDay,
              location: portLabel,
            })
          );

          generatedEvents.push(
            createTimedCruiseEvent({
              id: `generated-cruise-disembarkation-${cruise.id}-${itineraryDay.day}`,
              title: `Disembarkation • ${portLabel}`,
              start: arrivalDateTime,
              end: addMinutesToDateTime(arrivalDateTime, SHORT_EVENT_MINUTES),
              cruise,
              itineraryDay,
              location: portLabel,
            })
          );
          return;
        }

        generatedEvents.push(
          createAllDayCruiseEvent({
            id: `generated-cruise-port-day-${cruise.id}-${itineraryDay.day}`,
            title: `Port Day • ${portLabel}`,
            dateOnly: eventDate,
            cruise,
            itineraryDay,
            location: portLabel,
          })
        );
      });
  });

  return sortCalendarEvents(generatedEvents);
}

export function getCalendarEventsWithGeneratedCruiseEvents(bookedCruises: BookedCruise[], calendarEvents: CalendarEvent[]): CalendarEvent[] {
  const visibleCalendarEvents = getDisplayCalendarEvents(bookedCruises, calendarEvents).filter(
    (event) => !isGeneratedCruiseEventId(event.id)
  );
  const generatedCruiseEvents = generateCruiseCalendarEvents(bookedCruises);
  return sortCalendarEvents([...visibleCalendarEvents, ...generatedCruiseEvents]);
}
