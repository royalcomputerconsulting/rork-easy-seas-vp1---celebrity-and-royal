import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';

export type SyncDataSource = NonNullable<Cruise['cruiseSource']>;

function getBrandOfferFallback(source: SyncDataSource): string {
  if (source === 'celebrity') {
    return 'Celebrity Cruises Offer';
  }
  if (source === 'carnival') {
    return 'Carnival Offer';
  }
  return 'Royal Caribbean Offer';
}

function parseDate(dateStr: string): string {
  if (!dateStr) return '';

  const trimmed = dateStr.trim();

  try {
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2];
      const day = isoMatch[3];
      console.log(`[parseDate] ISO date detected: ${trimmed} -> ${month}-${day}-${year}`);
      return `${month}-${day}-${year}`;
    }

    const mmddyyyyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (mmddyyyyDash) {
      const month = mmddyyyyDash[1].padStart(2, '0');
      const day = mmddyyyyDash[2].padStart(2, '0');
      const year = mmddyyyyDash[3];
      return `${month}-${day}-${year}`;
    }

    const mmddyyyySlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mmddyyyySlash) {
      const month = mmddyyyySlash[1].padStart(2, '0');
      const day = mmddyyyySlash[2].padStart(2, '0');
      const year = mmddyyyySlash[3].length === 2 ? `20${mmddyyyySlash[3]}` : mmddyyyySlash[3];
      return `${month}-${day}-${year}`;
    }

    const monthNameMatch = trimmed.match(/(\w{3})\s+(\d{1,2}),?\s*(\d{4})/);
    if (monthNameMatch) {
      const monthNames: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      const month = monthNames[monthNameMatch[1].toLowerCase()];
      const day = parseInt(monthNameMatch[2], 10);
      const year = parseInt(monthNameMatch[3], 10);
      if (month !== undefined && !Number.isNaN(day) && !Number.isNaN(year)) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${monthStr}-${dayStr}-${year}`;
      }
    }

    const fullMonthMatch = trimmed.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/i);
    if (fullMonthMatch) {
      const fullMonthNames: Record<string, number> = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };
      const month = fullMonthNames[fullMonthMatch[1].toLowerCase()];
      const day = parseInt(fullMonthMatch[2], 10);
      const year = parseInt(fullMonthMatch[3], 10);
      if (month !== undefined && !Number.isNaN(day) && !Number.isNaN(year)) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${monthStr}-${dayStr}-${year}`;
      }
    }

    const date = new Date(trimmed + (trimmed.includes('T') ? '' : 'T12:00:00'));
    if (!Number.isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      console.log(`[parseDate] Fallback Date parse: ${trimmed} -> ${month}-${day}-${year}`);
      return `${month}-${day}-${year}`;
    }
  } catch {
    console.warn('[parseDate] Failed to parse date:', dateStr);
  }

  return dateStr;
}

function generateId(): string {
  return `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;

  const parts = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (parts) {
    const [, month, day, year] = parts;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }

  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateNightsFromDates(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;

  try {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);

    if (!start || !end) return null;

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 365 ? diffDays : null;
  } catch {
    return null;
  }
}

function extractNightsFromText(text: string): number | null {
  if (!text) return null;

  const nightsMatch = text.match(/(\d+)\s*[-]?\s*night/i);
  if (nightsMatch) {
    const nights = parseInt(nightsMatch[1], 10);
    if (nights > 0 && nights <= 365) {
      return nights;
    }
  }

  return null;
}

function calculateReturnDate(startDate: string, nights: number): string {
  if (!startDate) return '';

  try {
    const parts = startDate.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    let date: Date;

    if (parts) {
      const [, month, day, year] = parts;
      date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    } else {
      date = new Date(startDate);
    }

    if (Number.isNaN(date.getTime())) {
      console.warn('[calculateReturnDate] Invalid start date:', startDate);
      return '';
    }

    date.setDate(date.getDate() + nights);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${month}-${day}-${year}`;
  } catch (error) {
    console.warn('[calculateReturnDate] Error calculating return date:', error);
    return '';
  }
}

function parseMoneyValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getLowestPositivePrice(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (filtered.length === 0) {
    return undefined;
  }
  return Math.min(...filtered);
}

function parsePortList(portList: string | undefined): string[] | undefined {
  if (!portList) {
    return undefined;
  }

  const ports = portList
    .split(',')
    .map((port) => port.trim())
    .filter(Boolean);

  return ports.length > 0 ? ports : undefined;
}

function extractTradeInValue(perks: string): number | undefined {
  if (!perks) return undefined;

  const tradeInMatch = perks.match(/trade\s*[- ]?in\s*value[^\d$]*\$?([\d,]+)/i);
  if (tradeInMatch) {
    return parseInt(tradeInMatch[1].replace(/,/g, ''), 10);
  }

  return undefined;
}

export function transformOfferRowsToCruisesAndOffers(
  offerRows: OfferRow[],
  _loyaltyData: LoyaltyData | null,
  source: SyncDataSource = 'royal'
): { cruises: Cruise[]; offers: CasinoOffer[] } {
  const cruises: Cruise[] = [];
  const offerMap = new Map<string, CasinoOffer>();
  const cruiseIdsByOfferKey = new Map<string, string[]>();

  for (const offer of offerRows) {
    const cruiseId = generateId();
    const sailDate = parseDate(offer.sailingDate);
    const offerExpiryDate = parseDate(offer.offerExpirationDate);
    const safePerks = typeof offer.perks === 'string' ? offer.perks.trim() : '';
    const guests = parseGuestCount(offer.numberOfGuests);
    const itineraryNights = extractNightsFromText(offer.itinerary);
    const explicitNights = typeof offer.totalNights === 'number' && Number.isFinite(offer.totalNights) && offer.totalNights > 0
      ? offer.totalNights
      : null;
    const nights = explicitNights ?? itineraryNights ?? 7;
    const returnDate = calculateReturnDate(sailDate, nights);
    const interiorPrice = parseMoneyValue(offer.interiorPrice);
    const oceanviewPrice = parseMoneyValue(offer.oceanviewPrice);
    const balconyPrice = parseMoneyValue(offer.balconyPrice);
    const suitePrice = parseMoneyValue(offer.suitePrice);
    const taxes = parseMoneyValue(offer.taxesAndFees);
    const lowestPrice = getLowestPositivePrice([interiorPrice, oceanviewPrice, balconyPrice, suitePrice]);
    const ports = parsePortList(offer.portList);

    console.log(
      `[DataTransformer] Transforming offer row ${offer.offerCode || offer.offerName || 'unknown'} -> ${offer.shipName || 'unknown ship'} ${sailDate || 'unknown date'} with prices`,
      { interiorPrice, oceanviewPrice, balconyPrice, suitePrice, taxes, nights }
    );

    const cruise: Cruise = {
      id: cruiseId,
      shipName: offer.shipName,
      sailDate,
      returnDate,
      departurePort: offer.departurePort,
      destination: offer.itinerary,
      nights,
      price: lowestPrice,
      interiorPrice,
      oceanviewPrice,
      balconyPrice,
      suitePrice,
      taxes,
      totalPrice: typeof lowestPrice === 'number' ? lowestPrice + (taxes ?? 0) : undefined,
      cabinType: offer.cabinType || 'Balcony',
      offerCode: offer.offerCode,
      offerName: offer.offerName,
      offerExpiry: offerExpiryDate,
      itineraryName: offer.itinerary,
      itineraryRaw: offer.itinerary ? [offer.itinerary] : [],
      ports,
      guestsInfo: offer.numberOfGuests,
      guests,
      status: 'available',
      freePlay: extractFreePlay(safePerks),
      freeOBC: extractOBC(safePerks),
      tradeInValue: extractTradeInValue(safePerks),
      perks: safePerks ? [safePerks] : [],
      cruiseSource: source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    cruises.push(cruise);

    const offerKey = (
      offer.offerCode ||
      offer.offerName ||
      `${offer.shipName || 'unknown'}|${sailDate || 'unknown'}|${offer.itinerary || 'unknown'}`
    ).trim();

    if (!offerMap.has(offerKey)) {
      const displayName = offer.offerName && offer.offerName.trim() && offer.offerName !== offer.offerCode
        ? offer.offerName
        : (offer.offerCode || getBrandOfferFallback(source));

      const casinoOffer: CasinoOffer = {
        id: `offer_${offerKey.replace(/\s+/g, '_')}_${Date.now()}`,
        cruiseId: cruiseId,
        cruiseIds: [],
        offerCode: offer.offerCode || '',
        offerName: displayName,
        offerType: determineOfferType(safePerks),
        title: displayName,
        description: safePerks || offer.itinerary || offer.departurePort || displayName,
        category: offer.offerType,
        perks: safePerks ? [safePerks] : [],
        shipName: offer.shipName || undefined,
        sailingDate: sailDate || undefined,
        itineraryName: offer.itinerary || undefined,
        nights,
        ports,
        roomType: offer.cabinType || undefined,
        guestsInfo: offer.numberOfGuests || undefined,
        guests,
        value: lowestPrice,
        offerValue: lowestPrice,
        interiorPrice,
        oceanviewPrice,
        balconyPrice,
        suitePrice,
        taxesFees: taxes,
        portCharges: taxes,
        freePlay: extractFreePlay(safePerks),
        freeplayAmount: extractFreePlay(safePerks),
        OBC: extractOBC(safePerks),
        obcAmount: extractOBC(safePerks),
        tradeInValue: extractTradeInValue(safePerks),
        expires: offerExpiryDate,
        expiryDate: offerExpiryDate,
        offerExpiryDate: offerExpiryDate,
        status: 'active',
        offerSource: source,
        bookingLink: offer.bookingLink || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      offerMap.set(offerKey, casinoOffer);
      cruiseIdsByOfferKey.set(offerKey, []);
    }

    const aggregatedOffer = offerMap.get(offerKey);
    if (aggregatedOffer) {
      aggregatedOffer.shipName = aggregatedOffer.shipName || offer.shipName || undefined;
      aggregatedOffer.sailingDate = aggregatedOffer.sailingDate || sailDate || undefined;
      aggregatedOffer.itineraryName = aggregatedOffer.itineraryName || offer.itinerary || undefined;
      aggregatedOffer.nights = aggregatedOffer.nights || nights;
      aggregatedOffer.roomType = aggregatedOffer.roomType || offer.cabinType || undefined;
      aggregatedOffer.guestsInfo = aggregatedOffer.guestsInfo || offer.numberOfGuests || undefined;
      aggregatedOffer.guests = aggregatedOffer.guests ?? guests;
      aggregatedOffer.ports = aggregatedOffer.ports ?? ports;
      aggregatedOffer.description = aggregatedOffer.description || safePerks || offer.itinerary || undefined;
      if (!aggregatedOffer.bookingLink && offer.bookingLink) {
        aggregatedOffer.bookingLink = offer.bookingLink;
      }

      if (interiorPrice !== undefined) {
        aggregatedOffer.interiorPrice = getLowestPositivePrice([aggregatedOffer.interiorPrice, interiorPrice]);
      }
      if (oceanviewPrice !== undefined) {
        aggregatedOffer.oceanviewPrice = getLowestPositivePrice([aggregatedOffer.oceanviewPrice, oceanviewPrice]);
      }
      if (balconyPrice !== undefined) {
        aggregatedOffer.balconyPrice = getLowestPositivePrice([aggregatedOffer.balconyPrice, balconyPrice]);
      }
      if (suitePrice !== undefined) {
        aggregatedOffer.suitePrice = getLowestPositivePrice([aggregatedOffer.suitePrice, suitePrice]);
      }
      if (taxes !== undefined) {
        aggregatedOffer.taxesFees = getLowestPositivePrice([aggregatedOffer.taxesFees, taxes]);
        aggregatedOffer.portCharges = getLowestPositivePrice([aggregatedOffer.portCharges, taxes]);
      }

      const aggregatedBestPrice = getLowestPositivePrice([
        aggregatedOffer.interiorPrice,
        aggregatedOffer.oceanviewPrice,
        aggregatedOffer.balconyPrice,
        aggregatedOffer.suitePrice,
      ]);
      aggregatedOffer.value = aggregatedBestPrice;
      aggregatedOffer.offerValue = aggregatedBestPrice;
      aggregatedOffer.updatedAt = new Date().toISOString();
    }

    cruiseIdsByOfferKey.get(offerKey)?.push(cruiseId);
  }

  offerMap.forEach((offer, key) => {
    const cruiseIds = cruiseIdsByOfferKey.get(key) || [];
    offer.cruiseIds = cruiseIds;
    offer.cruiseId = cruiseIds[0];
  });

  return {
    cruises,
    offers: Array.from(offerMap.values()),
  };
}

export function transformOffersToCasinoOffers(
  offers: OfferRow[],
  loyaltyData: LoyaltyData | null,
  source: SyncDataSource = 'royal'
): CasinoOffer[] {
  const { offers: casinoOffers } = transformOfferRowsToCruisesAndOffers(offers, loyaltyData, source);
  return casinoOffers;
}

export function transformBookedCruisesToAppFormat(
  cruises: BookedCruiseRow[],
  _loyaltyData: LoyaltyData | null,
  source: SyncDataSource = 'royal'
): BookedCruise[] {
  return cruises.map((cruise) => {
    const startDate = parseDate(cruise.sailingStartDate);
    const endDate = parseDate(cruise.sailingEndDate);

    let nights: number = 7;
    let calculationMethod = 'default';

    if (startDate && endDate) {
      const dateNights = calculateNightsFromDates(startDate, endDate);
      if (dateNights !== null && dateNights > 0 && dateNights <= 365) {
        nights = dateNights;
        calculationMethod = 'dates';
        console.log(`[DataTransformer] ✓ Calculated nights from dates for ${cruise.shipName}: ${nights} nights (${startDate} to ${endDate})`);
      }
    }

    if (calculationMethod === 'default') {
      const rawNights = cruise.numberOfNights;
      if (rawNights !== undefined && rawNights !== null) {
        const numValue = typeof rawNights === 'number' ? rawNights : parseInt(String(rawNights), 10);
        if (!Number.isNaN(numValue) && numValue > 0 && numValue <= 365) {
          nights = numValue;
          calculationMethod = 'api';
          console.log(`[DataTransformer] ✓ Using API nights for ${cruise.shipName}: ${nights}`);
        }
      }
    }

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

    if (typeof nights !== 'number' || Number.isNaN(nights) || nights <= 0 || nights > 365) {
      console.error(`[DataTransformer] ❌ INVALID nights value for ${cruise.shipName}: ${nights} (type: ${typeof nights}). Using default: 7`);
      nights = 7;
      calculationMethod = 'default';
    }

    console.log(`[DataTransformer] Final nights for ${cruise.shipName} (${startDate} to ${endDate}): ${nights} (method: ${calculationMethod})`);

    const isCourtesyHold = cruise.status === 'Courtesy Hold' || cruise.status === 'Offer';
    const finalEndDate = endDate || calculateReturnDate(startDate, nights);

    const bookedCruise: BookedCruise = {
      sourcePayload: (cruise as { rawBooking?: unknown }).rawBooking,
      id: generateId(),
      shipName: cruise.shipName,
      sailDate: startDate,
      returnDate: finalEndDate,
      departurePort: cruise.departurePort,
      destination: cruise.itinerary || cruise.cruiseTitle || 'Unknown',
      nights,
      cabinType: cruise.cabinType,
      cabinNumber: cruise.cabinNumberOrGTY && cruise.cabinNumberOrGTY !== 'GTY' ? cruise.cabinNumberOrGTY : undefined,
      cabinCategory: cruise.cabinCategory || cruise.stateroomCategoryCode,
      deckNumber: cruise.deckNumber,
      bookingId: cruise.bookingId,
      reservationNumber: cruise.bookingId,
      status: 'booked',
      completionState: 'upcoming',
      isCourtesyHold,
      holdExpiration: cruise.holdExpiration || undefined,
      notes: isCourtesyHold ? `Courtesy Hold${cruise.holdExpiration ? ` (expires ${cruise.holdExpiration})` : ''}` : undefined,
      itineraryName: cruise.itinerary,
      itineraryRaw: cruise.itinerary ? [cruise.itinerary] : [],
      bookingStatus: cruise.bookingStatus,
      packageCode: cruise.packageCode,
      passengerStatus: cruise.passengerStatus,
      stateroomNumber: cruise.stateroomNumber,
      stateroomCategoryCode: cruise.stateroomCategoryCode,
      stateroomType: cruise.stateroomType,
      musterStation: cruise.musterStation,
      cruiseSource: source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return bookedCruise;
  });
}

function determineOfferType(perks?: string): 'freeplay' | 'obc' | '2person' | 'discount' | 'package' {
  const perksLower = (perks ?? '').toLowerCase();

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
