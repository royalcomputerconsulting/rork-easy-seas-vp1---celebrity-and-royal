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

  for (const event of events) {
    const formatDate = (dateStr: string): string => {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length <= 2) {
        return `${parts[2]}${parts[0]}${parts[1]}`;
      }
      return dateStr.replace(/-/g, '');
    };

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}`);
    lines.push(`DTSTART:${formatDate(event.startDate || event.start || '')}`);
    lines.push(`DTEND:${formatDate(event.endDate || event.end || '')}`);
    lines.push(`SUMMARY:${(event.title || '').replace(/,/g, '\\,').replace(/\n/g, '\\n')}`);
    if (event.location) {
      lines.push(`LOCATION:${event.location.replace(/,/g, '\\,').replace(/\n/g, '\\n')}`);
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/,/g, '\\,').replace(/\n/g, '\\n')}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
