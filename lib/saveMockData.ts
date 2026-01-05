import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BookedCruise, CasinoOffer, CalendarEvent } from '@/types/models';
import { ALL_STORAGE_KEYS } from './storage/storageKeys';

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function formatCruiseForTS(cruise: BookedCruise, indent: string = '  '): string {
  const lines: string[] = ['{'];
  
  const addField = (key: string, value: any) => {
    if (value === undefined || value === null) return;
    
    if (typeof value === 'string') {
      lines.push(`${indent}  ${key}: '${escapeString(value)}',`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${indent}  ${key}: ${value},`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${indent}  ${key}: [],`);
      } else if (typeof value[0] === 'string') {
        const strArray = value.map(v => `'${escapeString(v)}'`).join(', ');
        lines.push(`${indent}  ${key}: [${strArray}],`);
      } else if (typeof value[0] === 'object') {
        lines.push(`${indent}  ${key}: [`);
        value.forEach((item, idx) => {
          const itemStr = JSON.stringify(item, null, 2)
            .split('\n')
            .map((line, i) => i === 0 ? `${indent}    ${line}` : `${indent}    ${line}`)
            .join('\n');
          lines.push(itemStr + (idx < value.length - 1 ? ',' : ''));
        });
        lines.push(`${indent}  ],`);
      }
    }
  };

  addField('id', cruise.id);
  addField('reservationNumber', cruise.reservationNumber);
  addField('shipName', cruise.shipName);
  addField('sailDate', cruise.sailDate);
  addField('returnDate', cruise.returnDate);
  addField('departurePort', cruise.departurePort);
  addField('destination', cruise.destination);
  addField('itineraryName', cruise.itineraryName);
  addField('nights', cruise.nights);
  addField('cabinType', cruise.cabinType);
  addField('cabinNumber', cruise.cabinNumber);
  addField('deckNumber', cruise.deckNumber);
  addField('guestNames', cruise.guestNames);
  addField('guests', cruise.guests);
  addField('status', cruise.status);
  addField('completionState', cruise.completionState);
  addField('earnedPoints', cruise.earnedPoints);
  addField('casinoPoints', cruise.casinoPoints);
  addField('actualSpend', cruise.actualSpend);
  addField('winnings', cruise.winnings);
  addField('totalPrice', cruise.totalPrice);
  addField('price', cruise.price);
  addField('taxes', cruise.taxes);
  addField('retailValue', cruise.retailValue);
  addField('depositPaid', cruise.depositPaid);
  addField('balanceDue', cruise.balanceDue);
  addField('balanceDueDate', cruise.balanceDueDate);
  addField('freeOBC', cruise.freeOBC);
  addField('freePlay', cruise.freePlay);
  addField('offerCode', cruise.offerCode);
  addField('offerName', cruise.offerName);
  addField('offerValue', cruise.offerValue);
  addField('seaDays', cruise.seaDays);
  addField('portDays', cruise.portDays);
  addField('casinoOpenDays', cruise.casinoOpenDays);
  addField('ports', cruise.ports);
  addField('itinerary', cruise.itinerary);
  
  lines.push(`${indent}}`);
  return lines.join('\n');
}

function generateBookedCruisesFile(cruises: BookedCruise[]): string {
  const header = `import type { BookedCruise } from '@/types/models';

export const BOOKED_CRUISES_DATA: BookedCruise[] = [`;
  
  const cruiseStrings = cruises.map(cruise => formatCruiseForTS(cruise, '  '));
  
  const footer = `];

export const getCabinValueByType = (cabinType: string): { basePrice: number; category: string } => {
  const type = cabinType.toLowerCase();
  
  if (type.includes('penthouse')) return { basePrice: 8000, category: 'Penthouse Suite' };
  if (type.includes('royal suite')) return { basePrice: 6000, category: 'Royal Suite' };
  if (type.includes('owner') && type.includes('2br')) return { basePrice: 5000, category: "Owner's Suite 2BR" };
  if (type.includes('grand') && type.includes('2br')) return { basePrice: 4500, category: 'Grand Suite 2BR' };
  if (type.includes('owner')) return { basePrice: 4000, category: "Owner's Suite" };
  if (type.includes('grand suite')) return { basePrice: 3500, category: 'Grand Suite' };
  if (type.includes('junior') || type.includes('jr')) return { basePrice: 2500, category: 'Junior Suite' };
  if (type.includes('suite gty')) return { basePrice: 2000, category: 'Suite GTY' };
  if (type.includes('balcony gty') || type.includes('gty')) return { basePrice: 1200, category: 'Balcony GTY' };
  if (type.includes('balcony')) return { basePrice: 1500, category: 'Balcony' };
  if (type.includes('ocean') && type.includes('gty')) return { basePrice: 900, category: 'Oceanview GTY' };
  if (type.includes('ocean')) return { basePrice: 1100, category: 'Oceanview' };
  if (type.includes('interior gty')) return { basePrice: 600, category: 'Interior GTY' };
  if (type.includes('interior')) return { basePrice: 800, category: 'Interior' };
  
  return { basePrice: 1000, category: 'Unknown' };
};

export const calculateCabinRetailValue = (cabinType: string, nights: number): number => {
  const { basePrice } = getCabinValueByType(cabinType);
  const perNightRate = basePrice / 7;
  return Math.round(perNightRate * nights * 2);
};
`;

  return header + '\n' + cruiseStrings.join(',\n') + '\n' + footer;
}

function generateCompletedCruisesFile(cruises: BookedCruise[]): string {
  const header = `import type { BookedCruise } from '@/types/models';

export const COMPLETED_CRUISES_DATA: BookedCruise[] = [`;
  
  const cruiseStrings = cruises.map(cruise => formatCruiseForTS(cruise, '  '));
  
  const footer = `];
`;

  return header + '\n' + cruiseStrings.join(',\n') + '\n' + footer;
}

function generateCalendarEventsFile(events: CalendarEvent[]): string {
  const header = `import type { CalendarEvent } from '@/types/models';

export const CALENDAR_EVENTS_DATA: CalendarEvent[] = [`;
  
  const eventStrings = events.map(event => {
    return `  {
    id: '${escapeString(event.id)}',
    title: '${escapeString(event.title)}',
    startDate: '${escapeString(event.startDate)}',
    endDate: '${escapeString(event.endDate)}',${event.location ? `\n    location: '${escapeString(event.location)}',` : ''}${event.description ? `\n    description: '${escapeString(event.description)}',` : ''}${event.cruiseId ? `\n    cruiseId: '${escapeString(event.cruiseId)}',` : ''}
    allDay: ${event.allDay || false},
  }`;
  });
  
  const footer = `];
`;

  return header + '\n' + eventStrings.join(',\n') + '\n' + footer;
}

export async function saveMockData(): Promise<{
  success: boolean;
  message: string;
  counts?: {
    booked: number;
    completed: number;
    offers: number;
    events: number;
  };
}> {
  try {
    console.log('[SaveMockData] Reading data from AsyncStorage...');
    
    const [bookedData, offersData, eventsData] = await Promise.all([
      AsyncStorage.getItem(ALL_STORAGE_KEYS.BOOKED_CRUISES),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CASINO_OFFERS),
      AsyncStorage.getItem(ALL_STORAGE_KEYS.CALENDAR_EVENTS),
    ]);

    if (!bookedData) {
      return {
        success: false,
        message: 'No booked cruises data found. Please import data first.',
      };
    }

    const allCruises: BookedCruise[] = JSON.parse(bookedData);
    const offers: CasinoOffer[] = offersData ? JSON.parse(offersData) : [];
    const events: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];

    const today = new Date();
    const bookedCruises = allCruises.filter(cruise => {
      if (cruise.status === 'completed' || cruise.completionState === 'completed') {
        return false;
      }
      if (cruise.returnDate) {
        const returnDate = new Date(cruise.returnDate);
        return returnDate >= today;
      }
      return true;
    });

    const completedCruises = allCruises.filter(cruise => {
      if (cruise.status === 'completed' || cruise.completionState === 'completed') {
        return true;
      }
      if (cruise.returnDate) {
        const returnDate = new Date(cruise.returnDate);
        return returnDate < today;
      }
      return false;
    });

    console.log('[SaveMockData] Generating files...');
    console.log('[SaveMockData] Booked:', bookedCruises.length);
    console.log('[SaveMockData] Completed:', completedCruises.length);
    console.log('[SaveMockData] Offers:', offers.length);
    console.log('[SaveMockData] Events:', events.length);

    const bookedContent = generateBookedCruisesFile(bookedCruises);
    const completedContent = generateCompletedCruisesFile(completedCruises);
    const eventsContent = generateCalendarEventsFile(events);

    const result = {
      success: true,
      message: `Mock data generated successfully!\n\nBooked Cruises: ${bookedCruises.length}\nCompleted Cruises: ${completedCruises.length}\nOffers: ${offers.length}\nCalendar Events: ${events.length}\n\nFiles are ready to be written to:\n- mocks/bookedCruises.ts\n- mocks/completedCruises.ts\n- mocks/calendarEvents.ts`,
      counts: {
        booked: bookedCruises.length,
        completed: completedCruises.length,
        offers: offers.length,
        events: events.length,
      },
      files: {
        'mocks/bookedCruises.ts': bookedContent,
        'mocks/completedCruises.ts': completedContent,
        'mocks/calendarEvents.ts': eventsContent,
      },
    };

    console.log('[SaveMockData] Files generated successfully');
    console.log('[SaveMockData] Booked file size:', bookedContent.length, 'bytes');
    console.log('[SaveMockData] Completed file size:', completedContent.length, 'bytes');
    console.log('[SaveMockData] Events file size:', eventsContent.length, 'bytes');

    if (typeof window !== 'undefined') {
      console.log('[SaveMockData] Downloading files on web...');
      
      const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      downloadFile(bookedContent, 'bookedCruises.ts');
      setTimeout(() => downloadFile(completedContent, 'completedCruises.ts'), 500);
      setTimeout(() => downloadFile(eventsContent, 'calendarEvents.ts'), 1000);
    }

    return result as any;
  } catch (error) {
    console.error('[SaveMockData] Error:', error);
    return {
      success: false,
      message: `Failed to save mock data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
