import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    // Handle various date formats
    // Format: "Mar 16, 2026" or "Mar 16 2026"
    const monthNameMatch = dateStr.match(/(\w{3})\s+(\d{1,2}),?\s*(\d{4})/);
    if (monthNameMatch) {
      const monthNames: Record<string, number> = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      const month = monthNames[monthNameMatch[1].toLowerCase()];
      const day = parseInt(monthNameMatch[2], 10);
      const year = parseInt(monthNameMatch[3], 10);
      if (month !== undefined && !isNaN(day) && !isNaN(year)) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${monthStr}-${dayStr}-${year}`;
      }
    }
    
    // Try standard Date parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${month}-${day}-${year}`;
    }
  } catch {
    console.warn('Failed to parse date:', dateStr);
  }
  
  return dateStr;
}

function generateId(): string {
  return `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateNightsFromDates(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Sanity check - cruises are typically 2-30 nights
    return diffDays > 0 && diffDays <= 365 ? diffDays : null;
  } catch {
    return null;
  }
}

function extractNightsFromText(text: string): number | null {
  if (!text) return null;
  
  // Match patterns like "12 night", "7 Night", "3-night"
  const nightsMatch = text.match(/(\d+)\s*[-]?\s*night/i);
  if (nightsMatch) {
    const nights = parseInt(nightsMatch[1], 10);
    // Sanity check - cruises are typically 2-30 nights
    if (nights > 0 && nights <= 365) {
      return nights;
    }
  }
  
  return null;
}

function calculateReturnDate(startDate: string, nights: number): string {
  if (!startDate) return '';
  
  try {
    const date = new Date(startDate);
    date.setDate(date.getDate() + nights);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${month}-${day}-${year}`;
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
    
    // Extract nights from itinerary text (e.g., "12 Night Hawaii Cruise")
    const itineraryNights = extractNightsFromText(offer.itinerary);
    const nights = itineraryNights !== null ? itineraryNights : 7;
    const returnDate = calculateReturnDate(sailDate, nights);
    
    console.log(`[DataTransformer] Offer nights: itinerary="${offer.itinerary?.substring(0, 50)}", extracted=${itineraryNights}, final=${nights}`);

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
    
    // PRIORITY 1: If we have both sailDate and returnDate, ALWAYS calculate nights from dates
    // This is the most reliable method and prevents string concatenation bugs
    let nights: number = 7; // default fallback
    let calculationMethod = 'default';
    
    if (startDate && endDate) {
      const dateNights = calculateNightsFromDates(startDate, endDate);
      if (dateNights !== null && dateNights > 0 && dateNights <= 365) {
        nights = dateNights;
        calculationMethod = 'dates';
        console.log(`[DataTransformer] ✓ Calculated nights from dates for ${cruise.shipName}: ${nights} nights (${startDate} to ${endDate})`);
      }
    }
    
    // PRIORITY 2: Use API numberOfNights only if date calculation failed
    if (calculationMethod === 'default') {
      const rawNights = cruise.numberOfNights;
      if (rawNights !== undefined && rawNights !== null) {
        const numValue = typeof rawNights === 'number' ? rawNights : parseInt(String(rawNights), 10);
        if (!isNaN(numValue) && numValue > 0 && numValue <= 365) {
          nights = numValue;
          calculationMethod = 'api';
          console.log(`[DataTransformer] ✓ Using API nights for ${cruise.shipName}: ${nights}`);
        }
      }
    }
    
    // PRIORITY 3: Extract from cruise title/itinerary text
    if (calculationMethod === 'default') {
      const titleNights = extractNightsFromText(cruise.cruiseTitle || '');
      if (titleNights !== null && titleNights > 0 && titleNights <= 365) {
        nights = titleNights;
        calculationMethod = 'title';
        console.log(`[DataTransformer] ✓ Extracted nights from title for ${cruise.shipName}: ${nights}`);
      } else {
        const itineraryNights = extractNightsFromText(cruise.itinerary || '');
        if (itineraryNights !== null && itineraryNights > 0 && itineraryNights <= 365) {
          nights = itineraryNights;
          calculationMethod = 'itinerary';
          console.log(`[DataTransformer] ✓ Extracted nights from itinerary for ${cruise.shipName}: ${nights}`);
        }
      }
    }
    
    // Final validation - ensure nights is a number
    if (typeof nights !== 'number' || isNaN(nights) || nights <= 0 || nights > 365) {
      console.error(`[DataTransformer] ❌ INVALID nights value for ${cruise.shipName}: ${nights} (type: ${typeof nights}). Using default: 7`);
      nights = 7;
      calculationMethod = 'default';
    }
    
    console.log(`[DataTransformer] Final nights for ${cruise.shipName} (${startDate} to ${endDate}): ${nights} (method: ${calculationMethod})`);
    
    // Check for courtesy hold - both 'Courtesy Hold' and 'Offer' statuses are courtesy holds
    const isCourtesyHold = cruise.status === 'Courtesy Hold' || cruise.status === 'Offer';
    
    // If we don't have an end date, calculate it from the nights
    const finalEndDate = endDate || calculateReturnDate(startDate, nights);
    
    const bookedCruise: BookedCruise = {
      sourcePayload: (cruise as any).rawBooking,
      id: generateId(),
      shipName: cruise.shipName,
      sailDate: startDate,
      returnDate: finalEndDate,
      departurePort: cruise.departurePort,
      destination: cruise.itinerary || cruise.cruiseTitle || 'Unknown',
      nights: nights,
      
      cabinType: cruise.cabinType,
      cabinNumber: cruise.cabinNumberOrGTY && cruise.cabinNumberOrGTY !== 'GTY' ? cruise.cabinNumberOrGTY : undefined,
      cabinCategory: cruise.cabinCategory || cruise.stateroomCategoryCode,
      deckNumber: cruise.deckNumber,
      bookingId: cruise.bookingId,
      reservationNumber: cruise.bookingId,
      
      status: 'booked',
      completionState: 'upcoming',
      isCourtesyHold: isCourtesyHold,
      holdExpiration: cruise.holdExpiration || undefined,
      notes: isCourtesyHold ? `Courtesy Hold${cruise.holdExpiration ? ` (expires ${cruise.holdExpiration})` : ''}` : undefined,
      
      itineraryName: cruise.itinerary,
      itineraryRaw: cruise.itinerary ? [cruise.itinerary] : [],
      
      // New enrichment fields from API
      bookingStatus: cruise.bookingStatus,
      packageCode: cruise.packageCode,
      passengerStatus: cruise.passengerStatus,
      stateroomNumber: cruise.stateroomNumber,
      stateroomCategoryCode: cruise.stateroomCategoryCode,
      stateroomType: cruise.stateroomType,
      musterStation: cruise.musterStation,
      
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
