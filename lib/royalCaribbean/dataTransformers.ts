import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    console.warn('Failed to parse date:', dateStr);
  }
  
  return dateStr;
}

function generateId(): string {
  return `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface TransformedOffersData {
  offers: CasinoOffer[];
  cruises: Cruise[];
}

export function transformOffersToCasinoOffers(
  offerRows: OfferRow[], 
  loyaltyData: LoyaltyData | null
): TransformedOffersData {
  const offersMap = new Map<string, { offer: CasinoOffer; sailings: OfferRow[] }>();
  const cruises: Cruise[] = [];
  
  for (const row of offerRows) {
    if (!row.offerCode) continue;
    
    if (!offersMap.has(row.offerCode)) {
      const casinoOffer: CasinoOffer = {
        id: generateId(),
        title: row.offerName || 'Royal Caribbean Offer',
        offerCode: row.offerCode,
        offerName: row.offerName,
        offerType: determineOfferType(row.perks),
        category: row.offerType || 'Club Royale Offer',
        perks: row.perks ? [row.perks] : [],
        
        expires: parseDate(row.offerExpirationDate),
        expiryDate: parseDate(row.offerExpirationDate),
        offerExpiryDate: parseDate(row.offerExpirationDate),
        
        status: 'active' as const,
        offerSource: 'royal' as const,
        
        freePlay: extractFreePlay(row.perks),
        freeplayAmount: extractFreePlay(row.perks),
        OBC: extractOBC(row.perks),
        obcAmount: extractOBC(row.perks),
        
        cruiseIds: [],
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      offersMap.set(row.offerCode, { offer: casinoOffer, sailings: [] });
    }
    
    const offerData = offersMap.get(row.offerCode)!;
    offerData.sailings.push(row);
    
    if (row.shipName && row.sailingDate) {
      const cruiseId = generateId();
      const sailDate = parseDate(row.sailingDate);
      const nights = 7;
      
      const cruise: Cruise = {
        id: cruiseId,
        shipName: row.shipName,
        sailDate: sailDate,
        returnDate: calculateReturnDate(sailDate, nights),
        departurePort: row.departurePort || '',
        destination: row.itinerary || '',
        nights: nights,
        
        cabinType: row.cabinType || 'Balcony',
        itineraryName: row.itinerary || '',
        
        offerCode: row.offerCode,
        offerValue: extractOfferValue(row.perks),
        offerExpiry: parseDate(row.offerExpirationDate),
        
        guestsInfo: row.numberOfGuests || '2 Guests',
        
        status: 'available' as const,
        cruiseSource: 'royal' as const,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      cruises.push(cruise);
      offerData.offer.cruiseIds?.push(cruiseId);
    }
  }
  
  const offers = Array.from(offersMap.values()).map(({ offer }) => offer);
  
  return { offers, cruises };
}

export function transformBookedCruisesToAppFormat(
  cruises: BookedCruiseRow[],
  loyaltyData: LoyaltyData | null
): BookedCruise[] {
  return cruises.map(cruise => {
    const startDate = parseDate(cruise.sailingStartDate);
    const endDate = parseDate(cruise.sailingEndDate);
    
    const nights = calculateNights(startDate, endDate);
    
    const bookedCruise: BookedCruise = {
      id: generateId(),
      shipName: cruise.shipName,
      sailDate: startDate,
      returnDate: endDate,
      departurePort: cruise.departurePort || '',
      destination: cruise.itinerary || 'Unknown',
      nights: nights,
      
      cabinType: cruise.cabinType || 'Balcony',
      cabinNumber: cruise.cabinNumberOrGTY && cruise.cabinNumberOrGTY !== 'GTY' ? cruise.cabinNumberOrGTY : undefined,
      bookingId: cruise.bookingId,
      reservationNumber: cruise.bookingId,
      
      status: cruise.status === 'Courtesy Hold' ? 'available' : 'booked',
      completionState: cruise.status === 'Upcoming' ? 'upcoming' : 'upcoming',
      
      itineraryName: cruise.itinerary || '',
      itineraryRaw: cruise.itinerary ? [cruise.itinerary] : [],
      
      guests: 2,
      
      cruiseSource: 'royal' as const,
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return bookedCruise;
  });
}

function determineOfferType(perks: string): 'freeplay' | 'obc' | '2person' | 'discount' | 'package' {
  const perksLower = perks.toLowerCase();
  
  if (perksLower.includes('free play') || perksLower.includes('freeplay')) {
    return 'freeplay';
  }
  if (perksLower.includes('obc') || perksLower.includes('onboard credit')) {
    return 'obc';
  }
  if (perksLower.includes('2') || perksLower.includes('two') || perksLower.includes('couple')) {
    return '2person';
  }
  if (perksLower.includes('discount') || perksLower.includes('%') || perksLower.includes('off')) {
    return 'discount';
  }
  
  return 'package';
}

function extractFreePlay(perks: string): number | undefined {
  if (!perks) return undefined;
  
  const match = perks.match(/\$?([\d,]+)\s*(free\s*play|freeplay)/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  
  return undefined;
}

function extractOBC(perks: string): number | undefined {
  if (!perks) return undefined;
  
  const match = perks.match(/\$?([\d,]+)\s*(obc|onboard\s*credit)/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  
  return undefined;
}

function calculateNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 7;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 7;
  } catch {
    return 7;
  }
}

function calculateReturnDate(startDate: string, nights: number): string {
  if (!startDate) return '';
  
  try {
    const date = new Date(startDate);
    date.setDate(date.getDate() + nights);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function extractOfferValue(perks: string): number {
  const freePlay = extractFreePlay(perks);
  const obc = extractOBC(perks);
  return freePlay || obc || 0;
}
