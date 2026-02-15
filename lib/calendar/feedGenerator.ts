import type { BookedCruise, CalendarEvent } from '@/types/models';

function formatICSDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/[^\d-\/]/g, '');
  
  let year: string, month: string, day: string;
  
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts[0].length === 4) {
      [year, month, day] = parts;
    } else {
      [month, day, year] = parts;
    }
  } else if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts[0].length === 4) {
      [year, month, day] = parts;
    } else {
      [month, day, year] = parts;
    }
  } else {
    return cleaned;
  }

  month = month.padStart(2, '0');
  day = day.padStart(2, '0');
  if (year.length === 2) year = '20' + year;

  return `${year}${month}${day}`;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function generateUID(id: string): string {
  return `${id}@easyseas.app`;
}

function buildCruiseDescription(cruise: BookedCruise): string {
  const lines: string[] = [];

  if (cruise.itineraryName) {
    lines.push(cruise.itineraryName);
  }
  if (cruise.reservationNumber) {
    lines.push(`Reservation: ${cruise.reservationNumber}`);
  }
  if (cruise.cabinNumber) {
    lines.push(`Cabin: ${cruise.cabinNumber}${cruise.cabinCategory ? ` (${cruise.cabinCategory})` : ''}`);
  } else if (cruise.cabinType) {
    lines.push(`Cabin Type: ${cruise.cabinType}`);
  }
  if (cruise.deckNumber) {
    lines.push(`Deck: ${cruise.deckNumber}`);
  }
  if (cruise.departurePort) {
    lines.push(`Port: ${cruise.departurePort}`);
  }
  if (cruise.guestNames && cruise.guestNames.length > 0) {
    lines.push(`Guests: ${cruise.guestNames.join(', ')}`);
  } else if (cruise.guests) {
    lines.push(`Guests: ${cruise.guests}`);
  }
  if (cruise.casinoHost) {
    lines.push(`Casino Host: ${cruise.casinoHost}`);
  }
  if (cruise.casinoHostEmail) {
    lines.push(`Host Email: ${cruise.casinoHostEmail}`);
  }
  if (cruise.casinoHostPhone) {
    lines.push(`Host Phone: ${cruise.casinoHostPhone}`);
  }
  if (cruise.freePlay) {
    lines.push(`Free Play: $${cruise.freePlay}`);
  }
  if (cruise.freeOBC) {
    lines.push(`OBC: $${cruise.freeOBC}`);
  }
  if (cruise.offerCode) {
    lines.push(`Offer: ${cruise.offerCode}`);
  }

  return lines.join('\\n');
}

function buildPortDayEvents(cruise: BookedCruise): string[] {
  const events: string[] = [];
  
  if (!cruise.itinerary || cruise.itinerary.length === 0) return events;
  if (!cruise.sailDate) return events;

  const sailDateStr = formatICSDate(cruise.sailDate);
  if (sailDateStr.length !== 8) return events;
  
  const baseYear = parseInt(sailDateStr.slice(0, 4), 10);
  const baseMonth = parseInt(sailDateStr.slice(4, 6), 10) - 1;
  const baseDay = parseInt(sailDateStr.slice(6, 8), 10);

  for (const day of cruise.itinerary) {
    const eventDate = new Date(baseYear, baseMonth, baseDay + (day.day - 1));
    const yr = eventDate.getFullYear();
    const mo = String(eventDate.getMonth() + 1).padStart(2, '0');
    const dy = String(eventDate.getDate()).padStart(2, '0');
    const dateFormatted = `${yr}${mo}${dy}`;

    const nextDate = new Date(eventDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nyr = nextDate.getFullYear();
    const nmo = String(nextDate.getMonth() + 1).padStart(2, '0');
    const ndy = String(nextDate.getDate()).padStart(2, '0');
    const nextDateFormatted = `${nyr}${nmo}${ndy}`;

    const portName = day.isSeaDay ? 'At Sea' : day.port;
    const summary = `Day ${day.day}: ${portName} - ${cruise.shipName}`;
    
    let description = '';
    if (!day.isSeaDay && day.arrival) {
      description += `Arrival: ${day.arrival}`;
    }
    if (!day.isSeaDay && day.departure) {
      description += description ? '\\n' : '';
      description += `Departure: ${day.departure}`;
    }
    if (day.casinoOpen !== undefined) {
      description += description ? '\\n' : '';
      description += `Casino: ${day.casinoOpen ? 'Open' : 'Closed'}`;
    }
    if (day.notes) {
      description += description ? '\\n' : '';
      description += day.notes;
    }

    const lines: string[] = [];
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${generateUID(`port-${cruise.id}-day${day.day}`)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateFormatted}`);
    lines.push(`DTEND;VALUE=DATE:${nextDateFormatted}`);
    lines.push(`SUMMARY:${escapeICSText(summary)}`);
    if (description) {
      lines.push(`DESCRIPTION:${escapeICSText(description)}`);
    }
    if (!day.isSeaDay && day.port) {
      lines.push(`LOCATION:${escapeICSText(day.port)}`);
    }
    lines.push(`CATEGORIES:${day.isSeaDay ? 'Sea Day' : 'Port Day'}`);
    lines.push(`TRANSP:TRANSPARENT`);
    lines.push('END:VEVENT');
    events.push(lines.join('\r\n'));
  }

  return events;
}

export function generateCalendarFeed(
  bookedCruises: BookedCruise[],
  calendarEvents: CalendarEvent[]
): string {
  console.log('[FeedGenerator] Generating calendar feed:', {
    cruises: bookedCruises.length,
    events: calendarEvents.length,
  });

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EasySeas//Cruise Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Easy Seas Cruises',
    'X-WR-CALDESC:Your cruise schedule from Easy Seas',
    'X-WR-TIMEZONE:America/New_York',
    `LAST-MODIFIED:${timestamp}`,
  ];

  const sortedCruises = [...bookedCruises].sort((a, b) => {
    const dateA = a.sailDate || '';
    const dateB = b.sailDate || '';
    return dateA.localeCompare(dateB);
  });

  for (const cruise of sortedCruises) {
    if (!cruise.sailDate || !cruise.returnDate) continue;

    const dtStart = formatICSDate(cruise.sailDate);
    const dtEnd = formatICSDate(cruise.returnDate);
    if (!dtStart || !dtEnd) continue;

    const endParts = {
      year: parseInt(dtEnd.slice(0, 4), 10),
      month: parseInt(dtEnd.slice(4, 6), 10) - 1,
      day: parseInt(dtEnd.slice(6, 8), 10),
    };
    const endPlusOne = new Date(endParts.year, endParts.month, endParts.day + 1);
    const endFormatted = `${endPlusOne.getFullYear()}${String(endPlusOne.getMonth() + 1).padStart(2, '0')}${String(endPlusOne.getDate()).padStart(2, '0')}`;

    const summary = `${cruise.shipName}${cruise.nights ? ` (${cruise.nights}N)` : ''}`;
    const description = buildCruiseDescription(cruise);
    const location = cruise.departurePort || '';

    const brand = cruise.cruiseSource === 'celebrity' ? 'Celebrity' : 'Royal Caribbean';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${generateUID(`cruise-${cruise.id}`)}`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${endFormatted}`);
    lines.push(`SUMMARY:${escapeICSText(summary)}`);
    if (description) {
      lines.push(`DESCRIPTION:${escapeICSText(description)}`);
    }
    if (location) {
      lines.push(`LOCATION:${escapeICSText(location)}`);
    }
    lines.push(`CATEGORIES:Cruise,${escapeICSText(brand)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');

    if (cruise.completionState === 'completed' || cruise.status === 'completed') {
      lines.push('X-EASYSEAS-STATUS:completed');
    } else {
      lines.push('X-EASYSEAS-STATUS:upcoming');
    }

    lines.push('END:VEVENT');

    const portEvents = buildPortDayEvents(cruise);
    for (const pe of portEvents) {
      lines.push(pe);
    }
  }

  const cruiseEventIds = new Set(
    bookedCruises.map(c => `cruise-${c.id}`)
  );
  
  for (const event of calendarEvents) {
    if (cruiseEventIds.has(event.id)) continue;
    if (event.cruiseId && bookedCruises.some(c => c.id === event.cruiseId)) continue;

    const startDate = formatICSDate(event.startDate || event.start || '');
    const endDate = formatICSDate(event.endDate || event.end || startDate);
    if (!startDate) continue;

    let endFormatted = endDate;
    if (endDate) {
      const endParts = {
        year: parseInt(endDate.slice(0, 4), 10),
        month: parseInt(endDate.slice(4, 6), 10) - 1,
        day: parseInt(endDate.slice(6, 8), 10),
      };
      const endPlusOne = new Date(endParts.year, endParts.month, endParts.day + 1);
      endFormatted = `${endPlusOne.getFullYear()}${String(endPlusOne.getMonth() + 1).padStart(2, '0')}${String(endPlusOne.getDate()).padStart(2, '0')}`;
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${generateUID(`event-${event.id}`)}`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endFormatted || startDate}`);
    lines.push(`SUMMARY:${escapeICSText(event.title || 'Untitled Event')}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICSText(event.location)}`);
    }
    lines.push(`CATEGORIES:${escapeICSText(event.type || 'other')}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const icsContent = lines.join('\r\n');
  console.log('[FeedGenerator] Generated ICS feed:', icsContent.length, 'chars');
  return icsContent;
}

export function generateFeedToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
