import type { Cruise, BookedCruise, ItineraryDay } from '@/types/models';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';

function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime()) && date.getTime() > 0;
}

function safeParseSailDate(sailDate: string | undefined): Date {
  if (!sailDate) {
    console.warn('[CasinoAvailability] No sailDate provided, using current date');
    return new Date();
  }
  
  try {
    const parsed = new Date(sailDate);
    if (isValidDate(parsed)) {
      return parsed;
    }
    console.warn('[CasinoAvailability] Invalid sailDate:', sailDate, '- using current date');
    return new Date();
  } catch (e) {
    console.warn('[CasinoAvailability] Error parsing sailDate:', sailDate, e);
    return new Date();
  }
}

function safeFormatDate(date: Date): string {
  try {
    if (!isValidDate(date)) {
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.warn('[CasinoAvailability] Error formatting date:', e);
    return new Date().toISOString().split('T')[0];
  }
}

export const US_PORTS = [
  'Miami',
  'Fort Lauderdale',
  'Port Everglades',
  'Tampa',
  'Port Canaveral',
  'Jacksonville',
  'Galveston',
  'New Orleans',
  'San Diego',
  'Los Angeles',
  'Long Beach',
  'San Francisco',
  'Seattle',
  'Honolulu',
  'Bayonne',
  'Cape Liberty',
  'New York',
  'Baltimore',
  'Boston',
  'Charleston',
  'Savannah',
  'Mobile',
  'Houston',
  'Portland',
  'Juneau',
  'Ketchikan',
  'Skagway',
  'Sitka',
  'Hilo',
  'Kahului',
  'Kona',
  'Key West',
  'Puerto Rico',
  'San Juan',
];

// Near-shore US ports where the ship reaches international waters during the day
// Casino operates similar to foreign ports: open early AM from previous night, closed while docked, reopens evening
export const NEARSHORE_US_PORTS = [
  'Catalina Island',
  'Catalina',
  'Avalon',
  'Two Harbors',
];

export const US_TERRITORIES = [
  'Puerto Rico',
  'San Juan',
  'US Virgin Islands',
  'St. Thomas',
  'St. John',
  'St. Croix',
  'Guam',
  'American Samoa',
];

export const MEXICAN_PORTS = [
  'Cabo San Lucas',
  'Cabo',
  'Ensenada',
  'Cozumel',
  'Puerto Vallarta',
  'Costa Maya',
  'Puerto Costa Maya',
  'Mazatlan',
  'La Paz',
  'Loreto',
  'Manzanillo',
  'Progreso',
  'Zihuatanejo',
  'Ixtapa',
  'Acapulco',
  'Huatulco',
  'Cancun',
  'Playa del Carmen',
];

export interface CasinoAvailability {
  day: number;
  date: string;
  port: string;
  isSeaDay: boolean;
  isUSPort: boolean;
  isUSTerritory: boolean;
  casinoOpen: boolean;
  casinoOpenHours: string;
  reason: string;
  arrivalTime?: string;
  departureTime?: string;
}

export interface CruiseCasinoSummary {
  totalDays: number;
  seaDays: number;
  portDays: number;
  casinoOpenDays: number;
  casinoClosedDays: number;
  usPortDays: number;
  foreignPortDays: number;
  estimatedCasinoHours: number;
  dailyAvailability: CasinoAvailability[];
  bestGamblingDays: number[];
  gamblingWindowsDescription: string;
}

export function isUSPort(portName: string): boolean {
  const normalizedPort = portName.toLowerCase().trim();
  
  for (const usPort of US_PORTS) {
    if (normalizedPort.includes(usPort.toLowerCase())) {
      return true;
    }
  }
  
  if (normalizedPort.includes('usa') || 
      normalizedPort.includes('united states') ||
      normalizedPort.includes(', fl') ||
      normalizedPort.includes(', tx') ||
      normalizedPort.includes(', ca') ||
      normalizedPort.includes(', wa') ||
      normalizedPort.includes(', la') ||
      normalizedPort.includes(', nj') ||
      normalizedPort.includes(', md') ||
      normalizedPort.includes(', ma') ||
      normalizedPort.includes(', sc') ||
      normalizedPort.includes(', ga') ||
      normalizedPort.includes(', al') ||
      normalizedPort.includes(', hi') ||
      normalizedPort.includes(', ak')) {
    return true;
  }
  
  return false;
}

export function isUSTerritory(portName: string): boolean {
  const normalizedPort = portName.toLowerCase().trim();
  
  for (const territory of US_TERRITORIES) {
    if (normalizedPort.includes(territory.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function isNearshoreUSPort(portName: string): boolean {
  const normalizedPort = portName.toLowerCase().trim();
  
  for (const nearshorePort of NEARSHORE_US_PORTS) {
    if (normalizedPort.includes(nearshorePort.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function isMexicanPort(portName: string): boolean {
  const normalizedPort = portName.toLowerCase().trim();
  
  for (const mexicanPort of MEXICAN_PORTS) {
    if (normalizedPort.includes(mexicanPort.toLowerCase())) {
      return true;
    }
  }
  
  if (normalizedPort.includes('mexico') || normalizedPort.includes('méxico')) {
    return true;
  }
  
  return false;
}

export function determineSeaDay(port: string): boolean {
  const normalizedPort = port.toLowerCase().trim();
  
  return normalizedPort === 'at sea' || 
         normalizedPort === 'sea day' ||
         normalizedPort === 'cruising' ||
         normalizedPort.includes('sea day') ||
         normalizedPort.includes('at sea');
}

export interface CasinoHoursInfo {
  open: boolean;
  hours: string;
  reason: string;
  estimatedHours: number;
  openTime?: string;
  closeTime?: string;
}

export interface CasinoDayContext {
  dayNumber: number;
  totalDays: number;
  isSeaDay: boolean;
  isDepartureDay: boolean;
  isDisembarkDay: boolean;
  previousDayIsSeaDay?: boolean;
  nextDayIsSeaDay?: boolean;
  nextDayIsPortDay?: boolean;
  sailAwayTime?: string;
  port: string;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  let totalMinutes = hours * 60 + mins + minutes;
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

export function determineCasinoAvailability(
  port: string,
  isSeaDay: boolean,
  arrivalTime?: string,
  departureTime?: string
): CasinoHoursInfo {
  if (isSeaDay) {
    return {
      open: true,
      hours: 'Open all day (10am - 2am)',
      reason: 'Sea day - casino open in international waters',
      estimatedHours: 16,
    };
  }
  
  const isUS = isUSPort(port);
  const isTerritory = isUSTerritory(port);
  const isMexico = isMexicanPort(port);
  
  if (isUS && !isTerritory) {
    return {
      open: false,
      hours: 'Closed',
      reason: `US port (${port}) - casino closed in US territorial waters`,
      estimatedHours: 0,
    };
  }
  
  if (isTerritory) {
    return {
      open: false,
      hours: 'Closed',
      reason: `US territory (${port}) - casino closed`,
      estimatedHours: 0,
    };
  }
  
  if (isMexico) {
    return {
      open: false,
      hours: 'Closed while docked',
      reason: `Mexican port (${port}) - casino closed in Mexican waters`,
      estimatedHours: 0,
    };
  }
  
  const hasOvernight = !departureTime || departureTime === '' || departureTime.toLowerCase() === 'overnight';
  
  if (hasOvernight) {
    return {
      open: true,
      hours: 'Evening only (6pm - 2am)',
      reason: `Overnight in ${port} - casino opens after sailing`,
      estimatedHours: 8,
    };
  }
  
  return {
    open: true,
    hours: 'Evening only after departure (until 2am)',
    reason: `Foreign port (${port}) - casino opens after leaving port`,
    estimatedHours: 8,
  };
}

export function determineCasinoHoursWithContext(context: CasinoDayContext): CasinoHoursInfo {
  const { 
    dayNumber, 
    totalDays, 
    isSeaDay, 
    isDepartureDay, 
    isDisembarkDay,
    nextDayIsSeaDay,
    sailAwayTime,
    port 
  } = context;

  const isUS = isUSPort(port);
  const isTerritory = isUSTerritory(port);
  const isMexico = isMexicanPort(port);
  const isNearshore = isNearshoreUSPort(port);
  
  // For casino purposes: US ports (non-territory) and US territories are restricted
  // EXCEPT nearshore ports like Catalina where ship reaches international waters
  // Mexican ports, Caribbean ports, and nearshore US ports operate similarly
  const isUSRestrictedPort = (isUS && !isTerritory && !isNearshore) || isTerritory;

  if (isDisembarkDay) {
    return {
      open: false,
      hours: 'Closed',
      reason: 'Disembarkation day - casino closed',
      estimatedHours: 0,
    };
  }

  if (isDepartureDay) {
    // Departure day - casino always opens in evening after sailing into international waters
    const sailTime = sailAwayTime || '17:00';
    const casinoOpenTime = addMinutesToTime(sailTime, 90);
    const is24Hours = nextDayIsSeaDay === true;
    const closeTime = is24Hours ? '(24 hrs - slots)' : '02:30';
    const estimatedHours = is24Hours ? 12 : 8;
    
    return {
      open: true,
      hours: `Opens ~${casinoOpenTime} until ${closeTime}`,
      reason: `Departure day - opens 1.5 hrs after sail away${is24Hours ? ', 24hr slots (next day is sea day)' : ''}`,
      estimatedHours,
      openTime: casinoOpenTime,
      closeTime: is24Hours ? undefined : '02:30',
    };
  }

  if (isSeaDay) {
    const is24Hours = nextDayIsSeaDay === true || dayNumber === totalDays - 1;
    const closeTime = is24Hours ? '(24 hrs)' : '02:30';
    const estimatedHours = is24Hours ? 16 : 14;
    
    return {
      open: true,
      hours: `Open all day until ${closeTime}`,
      reason: `Sea day - casino open${is24Hours ? ' 24 hours (slots)' : ' until 2:30am'}`,
      estimatedHours,
      openTime: '05:00',
      closeTime: is24Hours ? undefined : '02:30',
    };
  }

  // Port day logic - US ports vs foreign ports (including Mexico and nearshore US)
  if (isUSRestrictedPort) {
    // US mainland/territory port day - truly closed all day
    return {
      open: false,
      hours: 'Closed',
      reason: `US ${isTerritory ? 'territory' : 'port'} (${port}) - casino closed in US waters`,
      estimatedHours: 0,
    };
  }

  // Foreign port day OR nearshore US port (Catalina, etc.)
  // Casino pattern: slots open until ~5am from previous night, closed while docked,
  // reopens ~1-1.5hrs after sail away once in international waters
  const sailTime = sailAwayTime || '17:00';
  const casinoOpenTime = addMinutesToTime(sailTime, 90);
  const portType = isNearshore ? 'Nearshore US port' : (isMexico ? 'Mexican port' : 'Foreign port');
  
  let estimatedHours: number;
  let reason: string;
  let hoursDescription: string;
  
  if (nextDayIsSeaDay === true) {
    estimatedHours = 12;
    reason = `${portType} (${port}) - slots til 5am, reopens ~${casinoOpenTime}, 24hr slots (next day is sea day)`;
    hoursDescription = `Slots til 5am, reopens ~${casinoOpenTime} (24 hrs)`;
  } else {
    estimatedHours = 10;
    reason = `${portType} (${port}) - slots til 5am, reopens ~${casinoOpenTime}, closes 5am (next day is port day)`;
    hoursDescription = `Slots til 5am, reopens ~${casinoOpenTime} til 5am`;
  }
  
  return {
    open: true,
    hours: hoursDescription,
    reason,
    estimatedHours,
    openTime: casinoOpenTime,
    closeTime: nextDayIsSeaDay ? undefined : '05:00',
  };
}

function parsePortsAndTimes(portsAndTimesStr: string): ItineraryDay[] {
  if (!portsAndTimesStr || typeof portsAndTimesStr !== 'string') {
    return [];
  }
  
  console.log('[CasinoAvailability] Parsing Ports&Times:', portsAndTimesStr);
  
  const result: ItineraryDay[] = [];
  const lines = portsAndTimesStr.split(/\r?\n/).filter(line => line.trim());
  
  lines.forEach((line, index) => {
    const parts = line.split(/[;,|\t]/).map(p => p.trim());
    
    if (parts.length >= 1) {
      const port = parts[0];
      const arrival = parts[1] || undefined;
      const departure = parts[2] || undefined;
      const isSeaDay = determineSeaDay(port);
      
      result.push({
        day: index + 1,
        port,
        arrival,
        departure,
        isSeaDay,
      });
    }
  });
  
  console.log('[CasinoAvailability] Parsed itinerary:', result);
  return result;
}

export function calculateCasinoAvailabilityForCruise(
  cruise: Cruise | BookedCruise,
  offers?: { offerCode?: string; portsAndTimes?: string; ports?: string[] }[]
): CruiseCasinoSummary {
  const dailyAvailability: CasinoAvailability[] = [];
  
  let itineraryToUse: ItineraryDay[] = [];
  
  if (cruise.itinerary && cruise.itinerary.length > 0) {
    itineraryToUse = cruise.itinerary;
    console.log('[CasinoAvailability] Using cruise.itinerary:', itineraryToUse.length, 'days');
  } else {
    // Try to find matching cruise in BOOKED_CRUISES_DATA for accurate itinerary
    const bookedCruise = cruise as BookedCruise;
    const mockMatch = BOOKED_CRUISES_DATA.find(mc => 
      mc.id === cruise.id || 
      mc.reservationNumber === bookedCruise.reservationNumber ||
      (mc.shipName === cruise.shipName && mc.sailDate === cruise.sailDate)
    );
    
    if (mockMatch?.itinerary && mockMatch.itinerary.length > 0) {
      itineraryToUse = mockMatch.itinerary;
      console.log('[CasinoAvailability] Using BOOKED_CRUISES_DATA mock itinerary for:', mockMatch.id, mockMatch.itinerary.length, 'days');
    } else if ((cruise as any).portsAndTimes) {
      itineraryToUse = parsePortsAndTimes((cruise as any).portsAndTimes);
      console.log('[CasinoAvailability] Parsed from cruise.portsAndTimes field');
    } else if (offers && offers.length > 0 && (cruise as any).offerCode) {
      // Try to find linked offer with itinerary data from CruiseStore
      const linkedOffer = offers.find(o => 
        o.offerCode === (cruise as any).offerCode ||
        o.offerCode === cruise.id
      );
      
      if (linkedOffer?.portsAndTimes) {
        itineraryToUse = parsePortsAndTimes(linkedOffer.portsAndTimes);
        console.log('[CasinoAvailability] Parsed from linkedOffer.portsAndTimes:', (cruise as any).offerCode);
      } else if (linkedOffer?.ports && linkedOffer.ports.length > 0) {
        itineraryToUse = linkedOffer.ports.map((port, index) => ({
          day: index + 1,
          port,
          isSeaDay: determineSeaDay(port),
        }));
        console.log('[CasinoAvailability] Using linkedOffer.ports:', (cruise as any).offerCode);
      }
    }
    
    // If still no itinerary, check itineraryRaw
    if (itineraryToUse.length === 0 && cruise.itineraryRaw && cruise.itineraryRaw.length > 0) {
      itineraryToUse = cruise.itineraryRaw.map((port, index) => ({
        day: index + 1,
        port: port.trim(),
        isSeaDay: determineSeaDay(port),
      }));
      console.log('[CasinoAvailability] Using cruise.itineraryRaw');
    } 
    
    // If still no itinerary, check ports array
    if (itineraryToUse.length === 0 && cruise.ports && cruise.ports.length > 0) {
      itineraryToUse = cruise.ports.map((port, index) => ({
        day: index + 1,
        port,
        isSeaDay: determineSeaDay(port),
      }));
      console.log('[CasinoAvailability] Using cruise.ports');
    }
  }
  
  const expectedDays = (cruise.nights || 7) + 1;
  
  if (itineraryToUse.length > 0) {
    itineraryToUse.forEach((day: ItineraryDay, index: number) => {
      const isSeaDay = day.isSeaDay || determineSeaDay(day.port);
      const isDepartureDay = index === 0;
      const isDisembarkDay = index === itineraryToUse.length - 1;
      
      // Look ahead to see if next day is a sea day (for 24hr slot logic)
      const nextDay = itineraryToUse[index + 1];
      const nextDayIsSeaDay = nextDay ? (nextDay.isSeaDay || determineSeaDay(nextDay.port)) : false;
      const nextDayIsPortDay = nextDay ? !nextDayIsSeaDay : false;
      
      // Use context-aware casino hours calculation
      const context: CasinoDayContext = {
        dayNumber: day.day,
        totalDays: itineraryToUse.length,
        isSeaDay,
        isDepartureDay,
        isDisembarkDay,
        nextDayIsSeaDay,
        nextDayIsPortDay,
        sailAwayTime: day.departure || '17:00',
        port: day.port,
      };
      
      const availability = determineCasinoHoursWithContext(context);
      
      const sailDate = safeParseSailDate(cruise.sailDate);
      const dayDate = new Date(sailDate);
      dayDate.setDate(sailDate.getDate() + day.day - 1);
      
      dailyAvailability.push({
        day: day.day,
        date: safeFormatDate(dayDate),
        port: day.port,
        isSeaDay,
        isUSPort: isUSPort(day.port),
        isUSTerritory: isUSTerritory(day.port),
        casinoOpen: availability.open,
        casinoOpenHours: availability.hours,
        reason: availability.reason,
        arrivalTime: day.arrival,
        departureTime: day.departure,
      });
    });
    
    if (dailyAvailability.length < expectedDays) {
      console.log('[CasinoAvailability] Itinerary has fewer days than expected, extending:', {
        actual: dailyAvailability.length,
        expected: expectedDays,
        nights: cruise.nights,
      });
      
      const existingDays = dailyAvailability.length;
      for (let i = existingDays; i < expectedDays; i++) {
        const isLastDay = i === expectedDays - 1;
        const isSeaDay = !isLastDay && i % 2 === 0;
        const port = isLastDay 
          ? (cruise.departurePort || 'Return Port') 
          : (isSeaDay ? 'At Sea' : 'Port of Call');
        
        const context: CasinoDayContext = {
          dayNumber: i + 1,
          totalDays: expectedDays,
          isSeaDay,
          isDepartureDay: false,
          isDisembarkDay: isLastDay,
          nextDayIsSeaDay: !isLastDay && (i + 1) % 2 === 0,
          sailAwayTime: '17:00',
          port,
        };
        
        const availability = determineCasinoHoursWithContext(context);
        
        const sailDate = safeParseSailDate(cruise.sailDate);
        const dayDate = new Date(sailDate);
        dayDate.setDate(sailDate.getDate() + i);
        
        dailyAvailability.push({
          day: i + 1,
          date: safeFormatDate(dayDate),
          port,
          isSeaDay,
          isUSPort: isUSPort(port),
          isUSTerritory: false,
          casinoOpen: availability.open,
          casinoOpenHours: availability.hours,
          reason: availability.reason,
        });
      }
    }
  } else {
    const nights = cruise.nights || 7;
    for (let i = 0; i < nights + 1; i++) {
      const isFirstDay = i === 0;
      const isLastDay = i === nights;
      const isSeaDay = !isFirstDay && !isLastDay && i % 2 === 0;
      const port = (isFirstDay || isLastDay)
        ? (cruise.departurePort || 'Departure Port') 
        : (isSeaDay ? 'At Sea' : 'Port of Call');
      
      const nextDayIsSeaDay = (i + 1) < nights && (i + 1) % 2 === 0;
      
      const context: CasinoDayContext = {
        dayNumber: i + 1,
        totalDays: nights + 1,
        isSeaDay,
        isDepartureDay: isFirstDay,
        isDisembarkDay: isLastDay,
        nextDayIsSeaDay,
        sailAwayTime: '17:00',
        port,
      };
      
      const availability = determineCasinoHoursWithContext(context);
      
      const sailDate = safeParseSailDate(cruise.sailDate);
      const dayDate = new Date(sailDate);
      dayDate.setDate(sailDate.getDate() + i);
      
      dailyAvailability.push({
        day: i + 1,
        date: safeFormatDate(dayDate),
        port,
        isSeaDay,
        isUSPort: isUSPort(port),
        isUSTerritory: false,
        casinoOpen: availability.open,
        casinoOpenHours: availability.hours,
        reason: availability.reason,
      });
    }
  }
  
  const totalDays = dailyAvailability.length;
  const seaDays = dailyAvailability.filter(d => d.isSeaDay).length;
  const portDays = totalDays - seaDays;
  const casinoOpenDays = dailyAvailability.filter(d => d.casinoOpen).length;
  const casinoClosedDays = totalDays - casinoOpenDays;
  const usPortDays = dailyAvailability.filter(d => d.isUSPort && !d.isSeaDay).length;
  const foreignPortDays = portDays - usPortDays;
  
  let estimatedCasinoHours = 0;
  dailyAvailability.forEach(day => {
    if (day.casinoOpen) {
      if (day.isSeaDay) {
        estimatedCasinoHours += 16;
      } else {
        estimatedCasinoHours += 8;
      }
    }
  });
  
  const bestGamblingDays = dailyAvailability
    .filter(d => d.casinoOpen)
    .map(d => d.day);
  
  let gamblingWindowsDescription = '';
  if (casinoOpenDays === 0) {
    gamblingWindowsDescription = 'No casino availability on this cruise (US territorial waters only)';
  } else if (casinoOpenDays === totalDays) {
    gamblingWindowsDescription = 'Casino open every day of the cruise';
  } else {
    gamblingWindowsDescription = `Casino open ${casinoOpenDays} of ${totalDays} days: ${seaDays} sea days + ${foreignPortDays} foreign port days`;
  }

  console.log('[CasinoAvailability] Cruise analysis:', {
    cruiseId: cruise.id,
    shipName: cruise.shipName,
    totalDays,
    seaDays,
    portDays,
    casinoOpenDays,
    usPortDays,
    foreignPortDays,
    estimatedCasinoHours,
  });

  return {
    totalDays,
    seaDays,
    portDays,
    casinoOpenDays,
    casinoClosedDays,
    usPortDays,
    foreignPortDays,
    estimatedCasinoHours,
    dailyAvailability,
    bestGamblingDays,
    gamblingWindowsDescription,
  };
}

export function formatCasinoAvailabilityText(summary: CruiseCasinoSummary): string {
  const lines = [
    `Casino Availability Summary`,
    `═══════════════════════════`,
    ``,
    `Total Days: ${summary.totalDays}`,
    `Sea Days: ${summary.seaDays}`,
    `Port Days: ${summary.portDays}`,
    ``,
    `Casino Open Days: ${summary.casinoOpenDays}`,
    `Casino Closed Days: ${summary.casinoClosedDays}`,
    ``,
    `Estimated Casino Hours: ~${summary.estimatedCasinoHours}`,
    ``,
    `Day-by-Day Schedule:`,
    `───────────────────`,
  ];
  
  summary.dailyAvailability.forEach(day => {
    const status = day.casinoOpen ? '🎰' : '❌';
    const portInfo = day.isSeaDay ? '🌊 At Sea' : `📍 ${day.port}`;
    lines.push(`Day ${day.day}: ${status} ${portInfo}`);
  });
  
  lines.push('');
  lines.push(summary.gamblingWindowsDescription);
  
  return lines.join('\n');
}

export function getCasinoOpenDaysForDateRange(
  cruises: (Cruise | BookedCruise)[],
  startDate: Date,
  endDate: Date
): { date: string; cruiseId: string; isOpen: boolean }[] {
  const results: { date: string; cruiseId: string; isOpen: boolean }[] = [];
  
  cruises.forEach(cruise => {
    const summary = calculateCasinoAvailabilityForCruise(cruise);
    
    summary.dailyAvailability.forEach(day => {
      const dayDate = new Date(day.date);
      if (dayDate >= startDate && dayDate <= endDate) {
        results.push({
          date: day.date,
          cruiseId: cruise.id,
          isOpen: day.casinoOpen,
        });
      }
    });
  });
  
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function estimateGamblingOpportunity(
  nights: number,
  departurePort: string,
  destination?: string
): { seaDays: number; casinoOpenDays: number; recommendation: string } {
  const isUSHomePor = isUSPort(departurePort);
  
  let estimatedSeaDays = 0;
  if (nights <= 3) {
    estimatedSeaDays = Math.max(0, nights - 2);
  } else if (nights <= 5) {
    estimatedSeaDays = Math.floor(nights * 0.3);
  } else if (nights <= 7) {
    estimatedSeaDays = Math.floor(nights * 0.35);
  } else {
    estimatedSeaDays = Math.floor(nights * 0.4);
  }
  
  const estimatedPortDays = nights - estimatedSeaDays;
  let foreignPortDays = estimatedPortDays;
  
  if (destination?.toLowerCase().includes('caribbean')) {
    foreignPortDays = estimatedPortDays - (isUSHomePor ? 1 : 0);
  } else if (destination?.toLowerCase().includes('bahamas')) {
    foreignPortDays = estimatedPortDays - (isUSHomePor ? 1 : 0);
  } else if (destination?.toLowerCase().includes('alaska')) {
    foreignPortDays = Math.floor(estimatedPortDays * 0.3);
  } else if (destination?.toLowerCase().includes('mexico')) {
    foreignPortDays = estimatedPortDays - (isUSHomePor ? 1 : 0);
  }
  
  const casinoOpenDays = estimatedSeaDays + Math.max(0, foreignPortDays);
  
  let recommendation = '';
  const gamblingRatio = casinoOpenDays / nights;
  
  if (gamblingRatio >= 0.7) {
    recommendation = 'Excellent gambling opportunity - casino open most of the cruise';
  } else if (gamblingRatio >= 0.5) {
    recommendation = 'Good gambling opportunity - casino open roughly half the cruise';
  } else if (gamblingRatio >= 0.3) {
    recommendation = 'Moderate gambling opportunity - limited casino hours';
  } else {
    recommendation = 'Limited gambling opportunity - primarily US waters';
  }

  return {
    seaDays: estimatedSeaDays,
    casinoOpenDays,
    recommendation,
  };
}

export function getCasinoAvailabilityEmoji(isOpen: boolean): string {
  return isOpen ? '🎰' : '❌';
}

export function getCasinoStatusBadge(casinoOpenDays: number, totalDays: number): {
  label: string;
  color: string;
  percentage: number;
} {
  const percentage = totalDays > 0 ? (casinoOpenDays / totalDays) * 100 : 0;
  
  if (percentage >= 70) {
    return { label: 'High Availability', color: '#22c55e', percentage };
  } else if (percentage >= 50) {
    return { label: 'Good Availability', color: '#3b82f6', percentage };
  } else if (percentage >= 30) {
    return { label: 'Moderate', color: '#f59e0b', percentage };
  } else {
    return { label: 'Limited', color: '#ef4444', percentage };
  }
}

export const PLAYER_SCHEDULE = {
  FIRST_DAY_HOURS: 1,
  LAST_DAY_HOURS: 2,
  SEA_DAY_MORNING_SESSION_HOURS: 2.5,
  SEA_DAY_SESSIONS_COUNT: 4,
  PORT_DAY_EVENING_HOURS: 2,
  CASINO_OPEN_TIME: '5:15 PM',
  EARLY_MORNING_START: '5:00 AM',
  EARLY_MORNING_END: '7:30 AM',
  POINTS_PER_SESSION: 384,
};

export interface PlayingSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

export interface PlayingHoursConfig {
  enabled: boolean;
  sessions: PlayingSession[];
}

export interface PersonalizedPlayEstimate {
  estimatedPlayHours: number;
  estimatedPoints: number;
  goldenHoursTotal: number;
  playDays: number;
  sessionBreakdown: {
    day: number;
    date: string;
    port: string;
    isSeaDay: boolean;
    casinoOpen: boolean;
    sessions: number;
    hoursPlayed: number;
    pointsEarned: number;
    notes: string;
    goldenWindows: { start: string; end: string; durationMinutes: number }[];
  }[];
}

function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function minutesToTime(minutes: number): string {
  const normalizedMinutes = minutes >= 0 ? minutes % (24 * 60) : (24 * 60 + minutes) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function calculateTimeOverlap(
  casinoStart: string, 
  casinoEnd: string | undefined, 
  sessionStart: string, 
  sessionEnd: string
): { start: string; end: string; durationMinutes: number } | null {
  const s1 = timeToMinutes(casinoStart);
  let e1 = casinoEnd ? timeToMinutes(casinoEnd) : 24 * 60;
  const s2 = timeToMinutes(sessionStart);
  let e2 = timeToMinutes(sessionEnd);
  
  if (e1 <= s1) e1 += 24 * 60;
  if (e2 <= s2) e2 += 24 * 60;
  
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  
  if (overlapStart >= overlapEnd) return null;
  
  return {
    start: minutesToTime(overlapStart),
    end: minutesToTime(overlapEnd),
    durationMinutes: overlapEnd - overlapStart,
  };
}

export function calculatePersonalizedPlayEstimate(
  summary: CruiseCasinoSummary,
  playingHours?: PlayingHoursConfig
): PersonalizedPlayEstimate {
  const sessionBreakdown: PersonalizedPlayEstimate['sessionBreakdown'] = [];
  let totalHours = 0;
  let totalPoints = 0;
  let totalGoldenMinutes = 0;
  let playDays = 0;
  const totalDays = summary.dailyAvailability.length;
  
  const useGoldenHours = playingHours?.enabled && playingHours?.sessions?.length > 0;
  const enabledSessions = useGoldenHours 
    ? playingHours!.sessions.filter(s => s.enabled) 
    : [];

  console.log('[CasinoAvailability] calculatePersonalizedPlayEstimate:', {
    useGoldenHours,
    enabledSessionsCount: enabledSessions.length,
    totalDays,
  });

  summary.dailyAvailability.forEach((day, index) => {
    const isFirstDay = index === 0;
    const isLastDay = index === totalDays - 1;
    
    let sessions = 0;
    let hoursPlayed = 0;
    let pointsEarned = 0;
    let notes = '';
    const goldenWindows: { start: string; end: string; durationMinutes: number }[] = [];

    if (!day.casinoOpen) {
      notes = 'Casino closed - no play';
    } else if (useGoldenHours && enabledSessions.length > 0) {
      const context: CasinoDayContext = {
        dayNumber: day.day,
        totalDays,
        isSeaDay: day.isSeaDay,
        isDepartureDay: isFirstDay,
        isDisembarkDay: isLastDay,
        port: day.port,
      };
      const casinoInfo = determineCasinoHoursWithContext(context);
      
      if (casinoInfo.open && casinoInfo.openTime) {
        enabledSessions.forEach(session => {
          const overlap = calculateTimeOverlap(
            casinoInfo.openTime!,
            casinoInfo.closeTime,
            session.startTime,
            session.endTime
          );
          
          if (overlap && overlap.durationMinutes > 0) {
            goldenWindows.push(overlap);
          }
        });
      } else if (casinoInfo.open && day.isSeaDay) {
        enabledSessions.forEach(session => {
          const overlap = calculateTimeOverlap(
            '05:00',
            '02:30',
            session.startTime,
            session.endTime
          );
          
          if (overlap && overlap.durationMinutes > 0) {
            goldenWindows.push(overlap);
          }
        });
      }
      
      const totalDayMinutes = goldenWindows.reduce((sum, w) => sum + w.durationMinutes, 0);
      hoursPlayed = Math.round((totalDayMinutes / 60) * 10) / 10;
      sessions = goldenWindows.length;
      totalGoldenMinutes += totalDayMinutes;
      
      if (sessions > 0) {
        playDays++;
        pointsEarned = PLAYER_SCHEDULE.POINTS_PER_SESSION * sessions;
        notes = `${sessions} golden session${sessions > 1 ? 's' : ''}: ${goldenWindows.map(w => `${w.start}-${w.end}`).join(', ')}`;
      } else {
        notes = 'Casino open but no overlap with your playing hours';
      }
    } else {
      if (isFirstDay) {
        sessions = 1;
        hoursPlayed = PLAYER_SCHEDULE.FIRST_DAY_HOURS;
        pointsEarned = PLAYER_SCHEDULE.POINTS_PER_SESSION;
        notes = 'First day brief session after departure';
        playDays++;
      } else if (isLastDay) {
        sessions = 1;
        hoursPlayed = PLAYER_SCHEDULE.LAST_DAY_HOURS;
        pointsEarned = PLAYER_SCHEDULE.POINTS_PER_SESSION;
        notes = 'Last day session before arrival';
        playDays++;
      } else if (day.isSeaDay) {
        sessions = PLAYER_SCHEDULE.SEA_DAY_SESSIONS_COUNT;
        hoursPlayed = PLAYER_SCHEDULE.SEA_DAY_MORNING_SESSION_HOURS * sessions;
        pointsEarned = PLAYER_SCHEDULE.POINTS_PER_SESSION * sessions;
        notes = `Sea day: 5am-7:30am morning + ${sessions - 1} additional sessions`;
        playDays++;
      } else {
        sessions = 1;
        hoursPlayed = PLAYER_SCHEDULE.PORT_DAY_EVENING_HOURS;
        pointsEarned = PLAYER_SCHEDULE.POINTS_PER_SESSION;
        notes = `Evening session after returning to international waters (~${PLAYER_SCHEDULE.CASINO_OPEN_TIME})`;
        playDays++;
      }
    }

    totalHours += hoursPlayed;
    totalPoints += pointsEarned;

    sessionBreakdown.push({
      day: day.day,
      date: day.date,
      port: day.port,
      isSeaDay: day.isSeaDay,
      casinoOpen: day.casinoOpen,
      sessions,
      hoursPlayed,
      pointsEarned,
      notes,
      goldenWindows,
    });
  });

  console.log('[CasinoAvailability] Personal estimate result:', {
    totalHours: Math.round(totalHours * 10) / 10,
    totalPoints,
    goldenHoursTotal: Math.round((totalGoldenMinutes / 60) * 10) / 10,
    playDays,
  });

  return {
    estimatedPlayHours: Math.round(totalHours * 10) / 10,
    estimatedPoints: totalPoints,
    goldenHoursTotal: Math.round((totalGoldenMinutes / 60) * 10) / 10,
    playDays,
    sessionBreakdown,
  };
}
