import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { CasinoOffer, BookedCruise } from '@/types/models';

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

export function transformOffersToCasinoOffers(
  offers: OfferRow[], 
  loyaltyData: LoyaltyData | null
): CasinoOffer[] {
  return offers.map(offer => {
    const casinoOffer: CasinoOffer = {
      id: generateId(),
      title: offer.offerName || 'Royal Caribbean Offer',
      offerCode: offer.offerCode,
      offerName: offer.offerName,
      offerType: determineOfferType(offer.perks),
      category: offer.offerType,
      perks: offer.perks ? [offer.perks] : [],
      
      shipName: offer.shipName,
      sailingDate: parseDate(offer.sailingDate),
      itineraryName: offer.itinerary,
      
      roomType: offer.cabinType,
      guestsInfo: offer.numberOfGuests,
      guests: parseGuestCount(offer.numberOfGuests),
      
      expires: parseDate(offer.offerExpirationDate),
      expiryDate: parseDate(offer.offerExpirationDate),
      offerExpiryDate: parseDate(offer.offerExpirationDate),
      
      status: 'active' as const,
      offerSource: 'royal' as const,
      
      freePlay: extractFreePlay(offer.perks),
      freeplayAmount: extractFreePlay(offer.perks),
      OBC: extractOBC(offer.perks),
      obcAmount: extractOBC(offer.perks),
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return casinoOffer;
  });
}

export function transformBookedCruisesToAppFormat(
  cruises: BookedCruiseRow[],
  loyaltyData: LoyaltyData | null
): BookedCruise[] {
  return cruises.map(cruise => {
    const startDate = parseDate(cruise.sailingStartDate);
    const endDate = parseDate(cruise.sailingEndDate);
    
    const nights = calculateNights(startDate, endDate);
    
    const isCourtesyHold = cruise.status === 'Courtesy Hold';
    
    const bookedCruise: BookedCruise = {
      id: generateId(),
      shipName: cruise.shipName,
      sailDate: startDate,
      returnDate: endDate,
      departurePort: cruise.departurePort,
      destination: cruise.itinerary || 'Unknown',
      nights: nights,
      
      cabinType: cruise.cabinType,
      cabinNumber: cruise.cabinNumberOrGTY && cruise.cabinNumberOrGTY !== 'GTY' ? cruise.cabinNumberOrGTY : undefined,
      bookingId: cruise.bookingId,
      reservationNumber: cruise.bookingId,
      
      status: isCourtesyHold ? 'available' : 'booked',
      completionState: isCourtesyHold ? 'upcoming' : 'upcoming',
      notes: isCourtesyHold ? 'On Hold' : undefined,
      
      itineraryName: cruise.itinerary,
      itineraryRaw: cruise.itinerary ? [cruise.itinerary] : [],
      
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

function parseGuestCount(guestsInfo: string): number | undefined {
  if (!guestsInfo) return undefined;
  
  const match = guestsInfo.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return undefined;
}

function calculateNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
}
