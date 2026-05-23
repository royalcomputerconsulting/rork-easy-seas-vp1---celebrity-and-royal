import type { CalendarEvent } from '@/types/models';

function parseICSDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/[^\dT]/g, '');
  if (cleaned.length >= 8) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${month}-${day}-${year}`;
  }
  return dateStr;
}

export function parseICSFile(content: string): CalendarEvent[] {
  console.log('[ICSParser] Parsing ICS file');
  
  const events: CalendarEvent[] = [];
  const eventBlocks = content.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i];
    const endIdx = block.indexOf('END:VEVENT');
    const eventContent = endIdx > -1 ? block.substring(0, endIdx) : block;

    const getValue = (key: string): string => {
      const regex = new RegExp(`${key}[^:]*:(.*)`, 'i');
      const match = eventContent.match(regex);
      return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : '';
    };

    const uid = getValue('UID') || `event_${Date.now()}_${i}`;
    const summary = getValue('SUMMARY');
    const dtstart = getValue('DTSTART');
    const dtend = getValue('DTEND');
    const location = getValue('LOCATION');
    const description = getValue('DESCRIPTION');

    if (!summary && !dtstart) continue;

    const startDate = parseICSDate(dtstart);
    const endDate = parseICSDate(dtend) || startDate;

    let eventType: CalendarEvent['type'] = 'other';
    const lowerSummary = summary.toLowerCase();
    if (lowerSummary.includes('cruise') || lowerSummary.includes('sailing')) {
      eventType = 'cruise';
    } else if (lowerSummary.includes('flight') || lowerSummary.includes('air')) {
      eventType = 'flight';
    } else if (lowerSummary.includes('hotel') || lowerSummary.includes('stay')) {
      eventType = 'hotel';
    } else if (lowerSummary.includes('travel') || lowerSummary.includes('trip')) {
      eventType = 'travel';
    }

    const event: CalendarEvent = {
      id: uid,
      title: summary || 'Untitled Event',
      startDate,
      endDate,
      start: startDate,
      end: endDate,
      type: eventType,
      sourceType: 'import',
      location: location || undefined,
      description: description || undefined,
      source: 'import',
    };

    events.push(event);
    console.log(`[ICSParser] Parsed event: ${summary} - ${startDate}`);
  }

  console.log(`[ICSParser] Parsed ${events.length} calendar events`);
  return events;
}

export function generateCalendarICS(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EasySeas//Cruise Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const escapeText = (value: string): string => value.replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const normalizeDateOnly = (value: string): string => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}${match[2]}${match[3]}`;
    }
    const parts = value.split('-');
    if (parts.length === 3 && parts[0].length <= 2) {
      return `${parts[2]}${parts[0].padStart(2, '0')}${parts[1].padStart(2, '0')}`;
    }
    return value.replace(/[^\d]/g, '').slice(0, 8);
  };
  const normalizeDateTime = (value: string): string => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6] ?? '00'}`;
    }
    return value.replace(/[^\dT]/g, '');
  };
  const addDays = (value: string, days: number): string => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return value;
    const parsed = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    parsed.setDate(parsed.getDate() + days);
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  };
  const addMinutes = (value: string, minutes: number): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    parsed.setMinutes(parsed.getMinutes() + minutes);
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}:00`;
  };

  for (const event of events) {
    const startValue = event.start || event.startDate || '';
    const endValue = event.end || event.endDate || startValue;
    if (!startValue) continue;

    const isTimedEvent = !event.allDay && (startValue.includes('T') || endValue.includes('T'));

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}`);

    if (isTimedEvent) {
      const startDateTime = normalizeDateTime(startValue);
      const endDateTime = normalizeDateTime(endValue.includes('T') ? endValue : addMinutes(startValue, 30));
      lines.push(`DTSTART:${startDateTime}`);
      lines.push(`DTEND:${endDateTime || startDateTime}`);
    } else {
      const startDate = normalizeDateOnly(startValue);
      const endDateExclusive = normalizeDateOnly(addDays(endValue || startValue, 1));
      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      lines.push(`DTEND;VALUE=DATE:${endDateExclusive || startDate}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title || 'Untitled Event')}`);
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
