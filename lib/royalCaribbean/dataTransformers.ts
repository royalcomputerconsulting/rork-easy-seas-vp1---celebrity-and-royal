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

function calculateNightsFromDates(startDate: string, endDate: string): number {
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

function calculateNightsFromItinerary(itinerary: string): number {
  if (!itinerary) return 7;
  
  const nightsMatch = itinerary.match(/(\d+)\s*night/i);
  if (nightsMatch) {
    return parseInt(nightsMatch[1], 10);
  }
  
  return 7;
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

export function transformOfferRowsToCruisesAndOffers(
  offerRows: OfferRow[],
  loyaltyData: LoyaltyData | null
): { cruises: Cruise[]; offers: CasinoOffer[] } {
  const cruises: Cruise[] = [];
  const offerMap = new Map<string, CasinoOffer>();
  const cruiseIdsByOfferKey = new Map<string, string[]>();

  for (const offer of offerRows) {
    const cruiseId = generateId();
    const sailDate = parseDate(offer.sailingDate);
    const offerExpiryDate = parseDate(offer.offerExpirationDate);
    const nights = calculateNightsFromItinerary(offer.itinerary);
    const returnDate = calculateReturnDate(sailDate, nights);

    const cruise: Cruise = {
      id: cruiseId,
      shipName: offer.shipName,
      sailDate,
      returnDate,
      departurePort: offer.departurePort,
      destination: offer.itinerary,
      nights,
      cabinType: offer.cabinType || 'Balcony',
      offerCode: offer.offerCode,
      offerName: offer.offerName,
      offerExpiry: offerExpiryDate,
      itineraryName: offer.itinerary,
      guestsInfo: offer.numberOfGuests,
      guests: parseGuestCount(offer.numberOfGuests),
      status: 'available',
      freePlay: extractFreePlay(offer.perks),
      freeOBC: extractOBC(offer.perks),
      perks: offer.perks ? [offer.perks] : [],
      cruiseSource: 'royal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    cruises.push(cruise);

    const offerKey = (offer.offerCode || offer.offerName || `UNNAMED_${Date.now()}`).trim();
    if (!offerMap.has(offerKey)) {
      const displayName = offer.offerName && offer.offerName.trim() && offer.offerName !== offer.offerCode 
        ? offer.offerName 
        : (offer.offerCode || 'Royal Caribbean Offer');
      
      const casinoOffer: CasinoOffer = {
        id: `offer_${offerKey.replace(/\s+/g, '_')}_${Date.now()}`,
        title: displayName,
        offerCode: offer.offerCode || '',
        offerName: displayName,
        offerType: determineOfferType(offer.perks),
        category: offer.offerType,
        perks: offer.perks ? [offer.perks] : [],
        cruiseIds: [],
        expires: offerExpiryDate,
        expiryDate: offerExpiryDate,
        offerExpiryDate: offerExpiryDate,
        status: 'active' as const,
        offerSource: 'royal' as const,
        freePlay: extractFreePlay(offer.perks),
        freeplayAmount: extractFreePlay(offer.perks),
        OBC: extractOBC(offer.perks),
        obcAmount: extractOBC(offer.perks),
        tradeInValue: offer.perks.includes('$') ? parseFloat(offer.perks.match(/\$?([\d,]+)/)?.[1]?.replace(/,/g, '') || '0') : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      offerMap.set(offerKey, casinoOffer);
      cruiseIdsByOfferKey.set(offerKey, []);
    }

    cruiseIdsByOfferKey.get(offerKey)?.push(cruiseId);
  }

  offerMap.forEach((offer, key) => {
    offer.cruiseIds = cruiseIdsByOfferKey.get(key) || [];
  });

  return {
    cruises,
    offers: Array.from(offerMap.values())
  };
}

export function transformOffersToCasinoOffers(
  offers: OfferRow[], 
  loyaltyData: LoyaltyData | null
): CasinoOffer[] {
  const { offers: casinoOffers } = transformOfferRowsToCruisesAndOffers(offers, loyaltyData);
  return casinoOffers;
}

export function transformBookedCruisesToAppFormat(
  cruises: BookedCruiseRow[],
  loyaltyData: LoyaltyData | null
): BookedCruise[] {
  return cruises.map(cruise => {
    const startDate = parseDate(cruise.sailingStartDate);
    const endDate = parseDate(cruise.sailingEndDate);
    
    const nights = calculateNightsFromDates(startDate, endDate);
    
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
