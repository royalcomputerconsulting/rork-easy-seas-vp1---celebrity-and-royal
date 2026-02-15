import type { BookedCruise } from '@/types/models';
import {
  parseCSVLine,
  normalizeDateString,
  calculateReturnDate,
  detectDelimiter,
  createHeaderMap,
  getColumnIndex,
} from './csvParser';

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function calculateNightsFromDates(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : null;
  } catch {
    return null;
  }
}

function extractNightsFromItinerary(itineraryName: string): number | null {
  if (!itineraryName) return null;
  
  const nightsMatch = itineraryName.match(/(\d+)\s*night/i);
  if (nightsMatch) {
    const nights = parseInt(nightsMatch[1], 10);
    if (nights > 0 && nights <= 365) {
      return nights;
    }
  }
  
  return null;
}

function normalizeRowLength(
  values: string[],
  expectedLen: number,
  options?: { joinFromIndex?: number; tailCount?: number }
): string[] {
  if (values.length === expectedLen) return values;

  const joinFromIndex = options?.joinFromIndex ?? -1;
  const tailCount = options?.tailCount ?? 0;

  if (values.length > expectedLen && joinFromIndex >= 0 && tailCount > 0) {
    const head = values.slice(0, joinFromIndex);
    const tail = values.slice(values.length - tailCount);
    const middle = values.slice(joinFromIndex, values.length - tailCount);
    const joined = middle.join(' ').replace(/\s+/g, ' ').trim();
    const next = [...head, joined, ...tail];

    if (next.length === expectedLen) return next;
  }

  if (values.length < expectedLen) {
    return [...values, ...Array.from({ length: expectedLen - values.length }, () => '')];
  }

  return values.slice(0, expectedLen);
}

export interface ParsedBookedRow {
  id: string;
  ship: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  itineraryName: string;
  departurePort: string;
  portsRoute: string;
  reservationNumber: string;
  guests: number;
  bookingId: string;
  isBooked: boolean;
  winningsBroughtHome: number;
  cruisePointsEarned: number;
}

function isDuplicateCruise(cruise: BookedCruise, existingCruises: BookedCruise[]): boolean {
  return existingCruises.some(existing => {
    if (cruise.reservationNumber && existing.reservationNumber && 
        cruise.reservationNumber === existing.reservationNumber) {
      console.log('[BookedParser] Duplicate found by reservation number:', cruise.reservationNumber);
      return true;
    }
    
    if (cruise.shipName === existing.shipName && 
        cruise.sailDate === existing.sailDate && 
        cruise.nights === existing.nights) {
      console.log('[BookedParser] Duplicate found by ship/date/nights:', cruise.shipName, cruise.sailDate);
      return true;
    }
    
    return false;
  });
}

export function parseBookedCSV(content: string, existingCruises: BookedCruise[] = []): BookedCruise[] {
  console.log('[BookedParser] Starting to parse booked CSV');
  console.log('[BookedParser] Existing cruises count:', existingCruises.length);
  
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    console.log('[BookedParser] Booked CSV has no data rows');
    return [];
  }

  const headerLine = lines[0];
  const isTabDelimited = detectDelimiter(headerLine) === 'tab';
  
  console.log('[BookedParser] Detected delimiter:', isTabDelimited ? 'TAB' : 'COMMA');
  
  const headers = isTabDelimited
    ? headerLine.split('\t').map(h => stripOuterQuotes(h).trim().toLowerCase())
    : parseCSVLine(headerLine).map(h => stripOuterQuotes(h).trim().toLowerCase());
  
  console.log('[BookedParser] Booked CSV Headers:', headers);

  const headerMap = createHeaderMap(headers);

  const colIndices = {
    id: getColumnIndex(headerMap, ['id', 'cruiseid', 'cruise_id']),
    ship: getColumnIndex(headerMap, ['ship', 'shipname', 'ship name', 'ship_name']),
    shipAndDates: getColumnIndex(headerMap, ['ship and dates', 'ship & dates', 'shipanddates']),
    departureDate: getColumnIndex(headerMap, [
      'departuredate',
      'departure date',
      'departure_date',
      'saildate',
      'sail date',
      'sailing date',
      'start date',
      'startdate',
    ]),
    returnDate: getColumnIndex(headerMap, ['returndate', 'return date', 'return_date', 'enddate', 'end date', 'end_date']),
    nights: getColumnIndex(headerMap, ['nights', 'duration', 'length', 'night']),
    itineraryName: getColumnIndex(headerMap, ['itineraryname', 'itinerary name', 'itinerary_name', 'itinerary', 'cruise title', 'cruisetitle']),
    departurePort: getColumnIndex(headerMap, ['departureport', 'departure port', 'departure_port', 'homeport', 'home port']),
    portsRoute: getColumnIndex(headerMap, [
      'portsroute',
      'ports route',
      'ports_route',
      'ports',
      'route',
      'ports & times',
    ]),
    reservationNumber: getColumnIndex(headerMap, ['reservationnumber', 'reservation number', 'reservation_number', 'reservation', 'confirmation']),
    guests: getColumnIndex(headerMap, ['guests', 'guest count', 'guestcount', 'pax', 'guests info']),
    bookingId: getColumnIndex(headerMap, ['bookingid', 'booking id', 'booking_id', 'booking']),
    isBooked: getColumnIndex(headerMap, ['isbooked', 'is booked', 'is_booked', 'booked', 'status']),
    winningsBroughtHome: getColumnIndex(headerMap, ['winningsbroughthome', 'winnings brought home', 'winnings_brought_home', 'winnings', 'casino winnings']),
    cruisePointsEarned: getColumnIndex(headerMap, ['cruisepointsearned', 'cruise points earned', 'cruise_points_earned', 'points earned', 'points']),
    cabinCategory: getColumnIndex(headerMap, ['cabincategory', 'cabin category', 'cabin_category', 'category', 'room type', 'cabintype', 'cabin type', 'roomtype']),
    cabinNumber: getColumnIndex(headerMap, ['cabinnumber', 'cabin number', 'cabin_number', 'cabin', 'cabin #', 'cabin#']),
    pricePaid: getColumnIndex(headerMap, ['pricepaid', 'price paid', 'price_paid', 'paid']),
    totalRetailCost: getColumnIndex(headerMap, ['totalretailcost', 'total retail cost', 'total_retail_cost', 'retail cost', 'retailcost']),
    totalCasinoDiscount: getColumnIndex(headerMap, ['totalcasinodiscount', 'total casino discount', 'total_casino_discount', 'casino discount', 'casinodiscount', 'discount', 'offer value']),
    portTaxesFees: getColumnIndex(headerMap, ['port taxes & fees', 'port taxes and fees', 'porttaxes', 'port_taxes', 'taxes & fees', 'taxes and fees', 'taxes', 'fees', 'port charges', 'portcharges']),
  };

  console.log('[BookedParser] Booked column indices:', colIndices);

  const bookedCruises: BookedCruise[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const rawValues = isTabDelimited
      ? parseCSVLine(line)
      : parseCSVLine(line);

    const values = normalizeRowLength(
      rawValues.map(v => stripOuterQuotes(v)),
      headers.length,
      isTabDelimited
        ? {
            joinFromIndex: headers.findIndex(h => h === 'ports & times'),
            tailCount: 3,
          }
        : undefined
    );

    const getValue = (idx: number): string => {
      if (idx === -1 || idx >= values.length) return '';
      return stripOuterQuotes(values[idx] || '');
    };

    const getNumericValue = (idx: number): number => {
      const val = getValue(idx).replace(/[,$]/g, '');
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    const getBooleanValue = (idx: number): boolean => {
      const val = getValue(idx).toLowerCase();
      return val === 'true' || val === 'yes' || val === '1';
    };

    const id = getValue(colIndices.id) || `booked_${Date.now()}_${i}`;
    const ship = getValue(colIndices.ship);
    const departureDateRaw = getValue(colIndices.departureDate);
    const returnDateRaw = getValue(colIndices.returnDate);
    const itineraryName = getValue(colIndices.itineraryName);
    
    // Calculate nights with multiple fallbacks:
    // 1. Use explicit nights column if available
    // 2. Calculate from departure and return dates
    // 3. Extract from itinerary name (e.g., "12 Night Hawaii Cruise")
    // 4. Default to 7 only as last resort
    const explicitNights = getNumericValue(colIndices.nights);
    const sailDate = normalizeDateString(departureDateRaw);
    const returnDate = returnDateRaw ? normalizeDateString(returnDateRaw) : '';
    const calculatedNights = calculateNightsFromDates(sailDate, returnDate);
    const itineraryNights = extractNightsFromItinerary(itineraryName);
    
    const nights = explicitNights > 0 
      ? explicitNights 
      : (calculatedNights !== null 
          ? calculatedNights 
          : (itineraryNights !== null 
              ? itineraryNights 
              : 7));
    
    console.log(`[BookedParser] Nights calculation for ${ship}: explicit=${explicitNights}, calculated=${calculatedNights}, itinerary=${itineraryNights}, final=${nights}`);
    const departurePort = getValue(colIndices.departurePort);
    const portsRoute = getValue(colIndices.portsRoute);
    const reservationNumber = getValue(colIndices.reservationNumber);
    const guestsRaw = getValue(colIndices.guests);
    const guestsParsed = parseInt((guestsRaw.match(/\d+/)?.[0] ?? '').trim(), 10);
    const guests = Number.isFinite(guestsParsed) && guestsParsed > 0 ? guestsParsed : (getNumericValue(colIndices.guests) || 2);
    const bookingId = getValue(colIndices.bookingId) || reservationNumber;
    const isBookedValue = getValue(colIndices.isBooked);
    const isBooked = isBookedValue ? getBooleanValue(colIndices.isBooked) : true;
    const winningsBroughtHome = getNumericValue(colIndices.winningsBroughtHome);
    const cruisePointsEarned = getNumericValue(colIndices.cruisePointsEarned);
    const cabinCategory = getValue(colIndices.cabinCategory);
    const cabinNumber = getValue(colIndices.cabinNumber);
    const pricePaid = getNumericValue(colIndices.pricePaid);
    const totalRetailCost = getNumericValue(colIndices.totalRetailCost);
    const totalCasinoDiscount = getNumericValue(colIndices.totalCasinoDiscount);
    const portTaxesFees = getNumericValue(colIndices.portTaxesFees) / 2;

    if (!ship || !departureDateRaw) {
      console.log(`[BookedParser] Skipping booked row ${i}: missing ship or date`);
      continue;
    }

    if (!isBooked) {
      console.log(`[BookedParser] Skipping unbooked cruise row ${i}: ${ship} - isBooked is FALSE`);
      continue;
    }

    // Use already calculated sailDate and returnDate, or calculate returnDate from nights
    const finalReturnDate = returnDate || calculateReturnDate(sailDate, nights);

    const ports = portsRoute
      ? portsRoute
          .split(/[→›|]/)
          .map(p => p.trim())
          .filter(Boolean)
      : [];

    const completionState = isBooked 
      ? (new Date(sailDate) < new Date() ? 'completed' : 'upcoming')
      : 'upcoming';

    const bookedCruise: BookedCruise = {
      id,
      shipName: ship,
      sailDate,
      returnDate: finalReturnDate,
      departurePort,
      destination: itineraryName,
      nights,
      itineraryName,
      ports,
      guests,
      reservationNumber,
      bookingId,
      status: isBooked ? 'booked' : 'available',
      completionState,
      winnings: winningsBroughtHome || undefined,
      earnedPoints: cruisePointsEarned || undefined,
      cabinCategory: cabinCategory || undefined,
      cabinNumber: cabinNumber || undefined,
      pricePaid: pricePaid > 0 ? pricePaid : undefined,
      totalRetailCost: totalRetailCost > 0 ? totalRetailCost : undefined,
      totalCasinoDiscount: totalCasinoDiscount > 0 ? totalCasinoDiscount : undefined,
      taxes: portTaxesFees > 0 ? portTaxesFees : undefined,
      createdAt: new Date().toISOString(),
    };

    if (isDuplicateCruise(bookedCruise, [...existingCruises, ...bookedCruises])) {
      console.log(`[BookedParser] Skipping duplicate cruise: ${ship} - ${sailDate} - ${reservationNumber}`);
      continue;
    }

    bookedCruises.push(bookedCruise);
    console.log(`[BookedParser] Parsed booked cruise: ${ship} - ${sailDate} - ${itineraryName}`);
  }

  console.log(`[BookedParser] Parsed ${bookedCruises.length} booked cruises`);
  return bookedCruises;
}

function escapeCSVField(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDateMMDDYYYY(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  } catch {
    return dateStr;
  }
}

export function generateBookedCSV(bookedCruises: BookedCruise[]): string {
  const filteredCruises = bookedCruises.filter(c => c.status !== 'available');
  const headers = [
    'id',
    'ship',
    'departureDate',
    'returnDate',
    'nights',
    'itineraryName',
    'departurePort',
    'portsRoute',
    'reservationNumber',
    'guests',
    'bookingId',
    'isBooked',
    'winningsBroughtHome',
    'cruisePointsEarned',
  ];

  const rows: string[] = [headers.join(',')];

  for (const cruise of filteredCruises) {
    const row = [
      escapeCSVField(cruise.id || ''),
      escapeCSVField(cruise.shipName || ''),
      formatDateMMDDYYYY(cruise.sailDate || ''),
      formatDateMMDDYYYY(cruise.returnDate || ''),
      (cruise.nights ?? 0).toString(),
      escapeCSVField(cruise.itineraryName || cruise.destination || ''),
      escapeCSVField(cruise.departurePort || ''),
      escapeCSVField(cruise.ports?.join(' | ') || ''),
      escapeCSVField(cruise.reservationNumber || ''),
      (cruise.guests ?? 0).toString(),
      escapeCSVField(cruise.bookingId || cruise.reservationNumber || ''),
      (cruise.status === 'booked').toString().toUpperCase(),
      (cruise.winnings ?? '').toString(),
      (cruise.earnedPoints ?? '').toString(),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}
