import type { BookedCruise, CalendarEvent } from '@/types/models';
import { buildCruiseDayPlan, getCruiseDayForDate, toCruiseDateOnly } from '@/lib/cruiseDayPipeline';
import { toLocalCalendarDateOnly } from '@/lib/date';
import { isInProgressBookedCruise } from '@/lib/bookedCruiseStatus';

export type VoyagePhase = 'onboard' | 'upcoming' | 'completed' | 'unknown';
export type VoyageAgendaKind = 'calendar' | 'dining' | 'excursion';

export interface VoyageAgendaItem {
  id: string;
  title: string;
  time?: string;
  location?: string;
  detail?: string;
  kind: VoyageAgendaKind;
}

export interface VoyageEssential {
  label: string;
  value: string;
}

export interface TodayOnCruiseBrief {
  cruise: BookedCruise;
  dateKey: string;
  phase: VoyagePhase;
  statusLabel: string;
  countdownDays: number | null;
  dayNumber: number | null;
  totalDays: number;
  locationLabel: string;
  arrival?: string;
  departure?: string;
  itineraryConfidence: 'verified' | 'partial' | 'conflict' | 'unknown';
  itineraryIssues: string[];
  agenda: VoyageAgendaItem[];
  essentials: VoyageEssential[];
}

function dateDistance(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  if (![startYear, startMonth, startDay, endYear, endMonth, endDay].every(Number.isFinite)) return 0;
  return Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000);
}

function eventContainsDate(event: CalendarEvent, dateKey: string): boolean {
  const start = toCruiseDateOnly(event.startDate || event.start);
  const end = toCruiseDateOnly(event.endDate || event.end) ?? start;
  return Boolean(start && end && dateKey >= start && dateKey <= end);
}

function formatEventTime(event: CalendarEvent): string | undefined {
  if (event.allDay) return undefined;
  const source = event.start || event.startDate;
  const timeMatch = String(source ?? '').match(/T(\d{1,2}):(\d{2})/);
  if (!timeMatch) return undefined;
  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2];
  if (!Number.isFinite(hour)) return undefined;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function normalizeTime(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function collectAgenda(cruise: BookedCruise, events: CalendarEvent[], dateKey: string): VoyageAgendaItem[] {
  const calendarItems: VoyageAgendaItem[] = events
    .filter((event) => eventContainsDate(event, dateKey))
    .filter((event) => !event.cruiseId || event.cruiseId === cruise.id)
    .filter((event) => event.type !== 'cruise')
    .map((event) => ({
      id: `calendar:${event.id}`,
      title: event.title,
      time: formatEventTime(event),
      location: event.location,
      detail: event.description || event.notes,
      kind: 'calendar' as const,
    }));

  const diningItems: VoyageAgendaItem[] = (cruise.diningReservations ?? [])
    .filter((reservation) => toCruiseDateOnly(reservation.date) === dateKey)
    .map((reservation, index) => ({
      id: `dining:${cruise.id}:${index}`,
      title: reservation.restaurant,
      time: normalizeTime(reservation.time),
      detail: 'Dining reservation',
      kind: 'dining' as const,
    }));

  const excursionItems: VoyageAgendaItem[] = (cruise.excursions ?? [])
    .filter((excursion) => excursion.booked && toCruiseDateOnly(excursion.date) === dateKey)
    .map((excursion, index) => ({
      id: `excursion:${cruise.id}:${index}`,
      title: excursion.name,
      detail: excursion.cost > 0 ? `$${excursion.cost.toLocaleString()} booked excursion` : 'Booked excursion',
      kind: 'excursion' as const,
    }));

  return [...calendarItems, ...diningItems, ...excursionItems].sort((left, right) => {
    if (!left.time && !right.time) return left.title.localeCompare(right.title);
    if (!left.time) return 1;
    if (!right.time) return -1;
    return left.time.localeCompare(right.time);
  });
}

function collectEssentials(cruise: BookedCruise): VoyageEssential[] {
  const essentials: VoyageEssential[] = [];
  const cabin = cruise.cabinNumber || cruise.stateroomNumber;
  const category = cruise.cabinCategory || cruise.stateroomType || cruise.cabinType;
  if (cabin) essentials.push({ label: 'Stateroom', value: category ? `${cabin} · ${category}` : cabin });
  else if (category) essentials.push({ label: 'Stateroom', value: String(category) });
  if (cruise.deckNumber) essentials.push({ label: 'Deck', value: cruise.deckNumber });
  if (cruise.musterStation) essentials.push({ label: 'Muster', value: cruise.musterStation });
  if (cruise.reservationNumber) essentials.push({ label: 'Reservation', value: cruise.reservationNumber });
  if (cruise.guestNames?.length) essentials.push({ label: 'Guests', value: cruise.guestNames.join(', ') });
  return essentials;
}

export function selectOperationalCruise(
  cruises: BookedCruise[],
  targetDate: Date = new Date(),
  requestedCruiseId?: string | null,
): BookedCruise | null {
  if (requestedCruiseId) {
    const requested = cruises.find((cruise) => cruise.id === requestedCruiseId);
    if (requested) return requested;
  }

  const inProgress = cruises.find((cruise) => isInProgressBookedCruise(cruise, targetDate));
  if (inProgress) return inProgress;

  const dateKey = toLocalCalendarDateOnly(targetDate) ?? '';
  return cruises
    .filter((cruise) => {
      const sailDate = toCruiseDateOnly(cruise.sailDate);
      return Boolean(sailDate && sailDate >= dateKey);
    })
    .sort((left, right) => String(left.sailDate).localeCompare(String(right.sailDate)))[0] ?? null;
}

export function buildTodayOnCruiseBrief(
  cruise: BookedCruise,
  events: CalendarEvent[],
  targetDate: Date = new Date(),
): TodayOnCruiseBrief {
  const dateKey = toLocalCalendarDateOnly(targetDate) ?? toCruiseDateOnly(targetDate.toISOString()) ?? '';
  const plan = buildCruiseDayPlan(cruise);
  const sailDate = plan?.sailDate ?? toCruiseDateOnly(cruise.sailDate);
  const returnDate = plan?.returnDate ?? toCruiseDateOnly(cruise.returnDate);
  let phase: VoyagePhase = 'unknown';
  if (sailDate && returnDate && dateKey >= sailDate && dateKey <= returnDate) phase = 'onboard';
  else if (sailDate && dateKey < sailDate) phase = 'upcoming';
  else if (returnDate && dateKey > returnDate) phase = 'completed';

  const displayedDate = phase === 'upcoming' && sailDate ? sailDate : dateKey;
  const currentDay = getCruiseDayForDate(cruise, displayedDate);
  const countdownDays = phase === 'upcoming' && sailDate ? Math.max(0, dateDistance(dateKey, sailDate)) : null;
  const locationLabel = currentDay
    ? currentDay.isSeaDay
      ? 'At Sea'
      : currentDay.port || (currentDay.day === 1 ? cruise.departurePort : 'Itinerary location not saved')
    : phase === 'upcoming'
      ? cruise.departurePort || 'Departure port not saved'
      : 'Itinerary location not saved';
  const statusLabel = phase === 'onboard'
    ? `Day ${currentDay?.day ?? '?'} of ${plan?.days.length ?? cruise.nights + 1}`
    : phase === 'upcoming'
      ? countdownDays === 0 ? 'Embarkation day' : `${countdownDays} day${countdownDays === 1 ? '' : 's'} to embarkation`
      : phase === 'completed'
        ? 'Completed voyage'
        : 'Voyage date needs review';

  return {
    cruise,
    dateKey: displayedDate,
    phase,
    statusLabel,
    countdownDays,
    dayNumber: currentDay?.day ?? null,
    totalDays: plan?.days.length ?? Math.max(1, cruise.nights + 1),
    locationLabel,
    arrival: currentDay?.arrival,
    departure: currentDay?.departure,
    itineraryConfidence: plan?.integrity ?? 'unknown',
    itineraryIssues: plan?.issues ?? ['No usable sailing-day plan is saved.'],
    agenda: collectAgenda(cruise, events, displayedDate),
    essentials: collectEssentials(cruise),
  };
}
