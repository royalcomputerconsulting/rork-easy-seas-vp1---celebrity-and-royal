import type { BookedCruise, CalendarEvent, ItineraryDay } from '@/types/models';
import { toCalendarDateOnly } from '@/lib/date';
import { buildCruiseDayPlan } from '@/lib/cruiseDayPipeline';

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
  return toCalendarDateOnly(value) ?? '';
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

function getCruiseFoundationFields(cruise: BookedCruise): Partial<CalendarEvent> {
  return {
    ownerProfileId: cruise.ownerProfileId,
    sourceEmail: cruise.sourceEmail,
    brand: cruise.brand ?? cruise.cruiseSource,
    casinoProgram: cruise.casinoProgram,
    importStatus: cruise.importStatus,
    reconciliationStatus: cruise.reconciliationStatus,
  };
}

function createCruiseEvent(event: CalendarEvent): CalendarEvent {
  return event;
}

const NON_SAILING_BOOKING_STATUSES = new Set([
  'available',
  'cancelled',
  'canceled',
  'archived',
  'replaced',
  'skipped',
  'courtesy hold',
  'hold',
  'offer',
]);

/**
 * The calendar represents actual sailings, not offers or unconfirmed holds.
 * Completed cruises remain eligible so historical months continue to work.
 */
export function isBookedCruiseEligibleForCalendar(cruise: BookedCruise): boolean {
  const status = normalizeText(cruise.status).replace(/[\s_-]+/g, ' ');
  if (NON_SAILING_BOOKING_STATUSES.has(status) || cruise.isCourtesyHold === true) return false;
  return getNormalizedCruiseDateRange(cruise) !== null;
}

function getCruiseCalendarScheduleKey(cruise: BookedCruise): string {
  const range = getNormalizedCruiseDateRange(cruise);
  return [
    normalizeText(cruise.ownerProfileId),
    normalizeText(cruise.sourceEmail),
    normalizeText(cruise.brand ?? cruise.cruiseSource),
    normalizeText(cruise.shipName),
    range?.sailDate ?? '',
  ].join('|');
}

function cruiseCalendarDetailScore(cruise: BookedCruise): number {
  const plan = buildCruiseDayPlan(cruise);
  const integrityScore = plan?.integrity === 'verified'
    ? 10_000
    : plan?.integrity === 'partial'
      ? 5_000
      : plan?.integrity === 'conflict'
        ? -10_000
        : 0;
  const authorityScore = cruise.sourceAuthority === 'user_entered'
    ? 1_000
    : cruise.sourceAuthority === 'provider'
      ? 750
      : cruise.sourceAuthority === 'public_document' || cruise.sourceAuthority === 'verified_local'
        ? 500
        : 0;
  return integrityScore + authorityScore
    + (cruise.itinerary?.length ?? 0) * 100
    + (cruise.ports?.length ?? 0) * 10
    + (cruise.departurePort ? 4 : 0)
    + (cruise.itineraryName ? 2 : 0)
    + (cruise.reservationNumber ? 1 : 0);
}

/**
 * One calendar schedule per physical ship departure, even when several cabins
 * share it or an older duplicate retained a conflicting return date.
 */
export function getCalendarEligibleCruises(bookedCruises: BookedCruise[]): BookedCruise[] {
  const bySchedule = new Map<string, BookedCruise>();
  bookedCruises.filter(isBookedCruiseEligibleForCalendar).forEach((cruise) => {
    const key = getCruiseCalendarScheduleKey(cruise);
    const existing = bySchedule.get(key);
    if (!existing || cruiseCalendarDetailScore(cruise) > cruiseCalendarDetailScore(existing)) {
      bySchedule.set(key, cruise);
    }
  });
  return Array.from(bySchedule.values());
}

export function getNormalizedCruiseDateRange(cruise: BookedCruise): { sailDate: string; returnDate: string } | null {
  const plan = buildCruiseDayPlan(cruise);
  return plan ? { sailDate: plan.sailDate, returnDate: plan.returnDate } : null;
}

function createCruiseSpanEvent(cruise: BookedCruise): CalendarEvent | null {
  const cruiseDateRange = getNormalizedCruiseDateRange(cruise);
  if (!cruiseDateRange) return null;

  return createCruiseEvent({
    id: `generated-cruise-span-${cruise.id}`,
    title: cruise.shipName || 'Cruise',
    startDate: cruiseDateRange.sailDate,
    endDate: cruiseDateRange.returnDate,
    start: cruiseDateRange.sailDate,
    end: cruiseDateRange.returnDate,
    type: 'cruise',
    sourceType: 'cruise',
    location: cruise.departurePort,
    description: buildCruiseDescription(cruise),
    cruiseId: cruise.id,
    allDay: true,
    source: 'import',
    ...getCruiseFoundationFields(cruise),
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
    ...getCruiseFoundationFields(params.cruise),
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
    ...getCruiseFoundationFields(params.cruise),
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

export function isGeneratedCruiseEventId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith('generated-cruise-');
}

export function isCruiseCalendarEventBackedByBookedCruise(event: CalendarEvent, _bookedCruises: BookedCruise[]): boolean {
  if (isGeneratedCruiseEventId(event.id)) return true;
  if (event.sourceType !== 'cruise' && event.type !== 'cruise') return false;
  // Booked cruises are the only authority for cruise-day markings. Suppress
  // every stored cruise event here, including orphaned legacy spans whose
  // former cruise no longer exists or whose dates have since changed.
  return true;
}

export function getDisplayCalendarEvents(bookedCruises: BookedCruise[], calendarEvents: CalendarEvent[]): CalendarEvent[] {
  return sortCalendarEvents(
    calendarEvents.filter((event) => !isCruiseCalendarEventBackedByBookedCruise(event, bookedCruises))
  );
}

export function generateCruiseCalendarEvents(bookedCruises: BookedCruise[]): CalendarEvent[] {
  const generatedEvents: CalendarEvent[] = [];

  getCalendarEligibleCruises(bookedCruises).forEach((cruise) => {
    const cruiseSpanEvent = createCruiseSpanEvent(cruise);
    if (cruiseSpanEvent) {
      generatedEvents.push(cruiseSpanEvent);
    }

    const dayPlan = buildCruiseDayPlan(cruise);
    if (!dayPlan) {
      return;
    }

    if (!Array.isArray(cruise.itinerary) || cruise.itinerary.length === 0) {
      dayPlan.days.forEach((day) => {
        const isFirstDay = day.day === 1;
        const isLastDay = day.day === dayPlan.days.length;
        generatedEvents.push(
          createAllDayCruiseEvent({
            id: `generated-cruise-day-${cruise.id}-${day.day}`,
            title: isFirstDay ? 'Embarkation Day' : isLastDay ? 'Disembarkation Day' : `Cruise Day • Day ${day.day}`,
            dateOnly: day.date,
            cruise,
            itineraryDay: day,
            location: isFirstDay || isLastDay ? cruise.departurePort : undefined,
            description: `${buildCruiseDescription(cruise, day) ?? cruise.shipName} • Itinerary details unavailable`,
          })
        );
      });
      return;
    }

    dayPlan.days
      .forEach((itineraryDay) => {
        const eventDate = itineraryDay.date;
        const isFirstDay = itineraryDay.day === 1;
        const isLastDay = itineraryDay.day === dayPlan.days.length;
        const portLabel = itineraryDay.port || (isFirstDay || isLastDay ? cruise.departurePort : '');
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

        if (!portLabel) {
          generatedEvents.push(
            createAllDayCruiseEvent({
              id: `generated-cruise-itinerary-pending-${cruise.id}-${itineraryDay.day}`,
              title: `Itinerary Pending • Day ${itineraryDay.day}`,
              dateOnly: eventDate,
              cruise,
              itineraryDay,
              description: `${buildCruiseDescription(cruise, itineraryDay) ?? cruise.shipName} • Provider itinerary details unavailable`,
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
              title: isFirstDay ? 'Embarkation Day' : `Port Day • ${portLabel}`,
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
              title: isLastDay ? 'Disembarkation Day' : `Port Day • ${portLabel}`,
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

export function getDayAgendaEventCountForYear(bookedCruises: BookedCruise[], calendarEvents: CalendarEvent[], year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const visibleCalendarEvents = getDisplayCalendarEvents(bookedCruises, calendarEvents).filter(
    (event) => !isGeneratedCruiseEventId(event.id)
  );
  const generatedCruiseEvents = generateCruiseCalendarEvents(bookedCruises).filter(
    (event) => !event.id.startsWith('generated-cruise-span-')
  );
  return [...visibleCalendarEvents, ...generatedCruiseEvents].filter((event) => {
    const start = normalizeDateOnly(getEventStartValue(event));
    const end = normalizeDateOnly(getEventEndValue(event)) || start;
    if (!start) return false;
    return start <= yearEnd && end >= yearStart;
  }).length;
}
