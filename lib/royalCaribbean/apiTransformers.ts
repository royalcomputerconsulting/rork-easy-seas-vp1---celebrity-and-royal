import { 
  RCApiProfileBooking, 
  RCApiSailingInfo, 
  RCApiMarketingTargetedOffer,
  RCApiLoyaltySummaryResponse,
  getShipNameFromCode,
  getStateroomTypeName,
  parseRCDate,
  isCourtesyHold,
  isConfirmedBooking,
  RCApiPortInfo
} from './apiTypes';
import { BookedCruiseRow, OfferRow, LoyaltyData } from './types';
import { BookedCruise, CasinoOffer, ItineraryDay } from '@/types/models';

function generateId(): string {
  return `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractPerksFromMarketing(offer: RCApiMarketingTargetedOffer): string {
  const perks: string[] = [];
  
  for (const perk of offer.marketingPerks) {
    if (perk.description && perk.description.length > 0) {
      perks.push(...perk.description);
    }
  }
  
  return perks.join('; ');
}

function extractValueFromPerk(perk: RCApiMarketingTargetedOffer): number | undefined {
  for (const p of perk.marketingPerks) {
    if (p.price?.value) {
      return p.price.value;
    }
  }
  return undefined;
}

export function transformApiBookingToBookedCruiseRow(
  booking: RCApiProfileBooking,
  sailingInfo?: RCApiSailingInfo
): BookedCruiseRow {
  const shipName = sailingInfo?.shipName || getShipNameFromCode(booking.shipCode);
  const sailDate = parseRCDate(booking.sailDate);
  
  let sailingEndDate = '';
  let itinerary = '';
  let departurePort = '';
  
  if (sailingInfo) {
    sailingEndDate = parseRCDate(sailingInfo.sailingEndDate);
    itinerary = sailingInfo.itinerary?.description || '';
    departurePort = sailingInfo.departurePortName || '';
  } else {
    const startDate = new Date(sailDate);
    startDate.setDate(startDate.getDate() + booking.numberOfNights);
    sailingEndDate = startDate.toISOString().split('T')[0];
  }
  
  const status = isCourtesyHold(booking) ? 'Courtesy Hold' : 'Upcoming';
  const cabinType = getStateroomTypeName(booking.stateroomType);
  
  const row: BookedCruiseRow = {
    sourcePage: 'API',
    shipName,
    shipCode: booking.shipCode,
    cruiseTitle: itinerary,
    sailingStartDate: sailDate,
    sailingEndDate,
    sailingDates: `${sailDate} - ${sailingEndDate}`,
    itinerary,
    departurePort,
    cabinType,
    cabinCategory: booking.stateroomCategoryCode,
    cabinNumberOrGTY: booking.stateroomNumber || 'GTY',
    deckNumber: booking.deckNumber,
    bookingId: booking.bookingId,
    numberOfGuests: String(booking.passengers?.length || 1),
    status,
    loyaltyLevel: '',
    loyaltyPoints: '',
    paidInFull: booking.paidInFull ? 'Yes' : 'No',
    balanceDue: booking.balanceDueAmount ? `$${booking.balanceDueAmount.toFixed(2)}` : undefined,
    musterStation: booking.musterStation,
  };
  
  return row;
}

export function transformApiBookingsToBookedCruiseRows(
  bookings: RCApiProfileBooking[],
  sailingInfoMap: Map<string, RCApiSailingInfo>
): BookedCruiseRow[] {
  return bookings.map(booking => {
    const key = `${booking.shipCode}_${booking.sailDate}`;
    const sailingInfo = sailingInfoMap.get(key);
    return transformApiBookingToBookedCruiseRow(booking, sailingInfo);
  });
}

export function transformApiMarketingOfferToOfferRow(
  offer: RCApiMarketingTargetedOffer
): OfferRow {
  const expiryDate = parseRCDate(offer.marketingEndDate);
  const perks = extractPerksFromMarketing(offer);
  
  const row: OfferRow = {
    sourcePage: 'API',
    offerName: offer.title,
    offerCode: offer.marketingCouponCode,
    offerExpirationDate: expiryDate,
    offerType: offer.type,
    shipName: '',
    sailingDate: '',
    itinerary: offer.description,
    departurePort: '',
    cabinType: '',
    numberOfGuests: '',
    perks,
    loyaltyLevel: '',
    loyaltyPoints: '',
  };
  
  return row;
}

export function transformApiMarketingOffersToOfferRows(
  offers: RCApiMarketingTargetedOffer[]
): OfferRow[] {
  return offers.map(offer => transformApiMarketingOfferToOfferRow(offer));
}

export function transformApiBookingToBookedCruise(
  booking: RCApiProfileBooking,
  sailingInfo?: RCApiSailingInfo
): BookedCruise {
  const shipName = sailingInfo?.shipName || getShipNameFromCode(booking.shipCode);
  const sailDate = parseRCDate(booking.sailDate);
  
  let sailingEndDate = '';
  let itinerary = '';
  let departurePort = '';
  let destination = '';
  let itineraryDays: ItineraryDay[] = [];
  let ports: string[] = [];
  
  if (sailingInfo) {
    sailingEndDate = parseRCDate(sailingInfo.sailingEndDate);
    itinerary = sailingInfo.itinerary?.description || '';
    departurePort = sailingInfo.departurePortName || '';
    destination = sailingInfo.regionCode || '';
    
    if (sailingInfo.itinerary?.portInfo) {
      itineraryDays = transformPortInfoToItinerary(sailingInfo.itinerary.portInfo);
      ports = sailingInfo.itinerary.portInfo
        .filter(p => p.portType !== 'CRUISING')
        .map(p => p.title);
    }
  } else {
    const startDate = new Date(sailDate);
    startDate.setDate(startDate.getDate() + booking.numberOfNights);
    sailingEndDate = startDate.toISOString().split('T')[0];
  }
  
  const status = isCourtesyHold(booking) ? 'available' : 'booked';
  const cabinType = getStateroomTypeName(booking.stateroomType);
  
  const bookedCruise: BookedCruise = {
    id: generateId(),
    shipName,
    sailDate,
    returnDate: sailingEndDate,
    departurePort,
    destination: destination || itinerary,
    nights: booking.numberOfNights,
    cabinType,
    cabinCategory: booking.stateroomCategoryCode,
    cabinNumber: booking.stateroomNumber !== 'GTY' ? booking.stateroomNumber : undefined,
    deckNumber: booking.deckNumber,
    bookingId: booking.bookingId,
    reservationNumber: booking.bookingId,
    status,
    completionState: 'upcoming',
    notes: isCourtesyHold(booking) ? 'Courtesy Hold' : undefined,
    itineraryName: itinerary,
    itinerary: itineraryDays.length > 0 ? itineraryDays : undefined,
    itineraryRaw: itinerary ? [itinerary] : undefined,
    ports: ports.length > 0 ? ports : undefined,
    guests: booking.passengers?.length || 1,
    balanceDue: booking.balanceDueAmount,
    cruiseSource: 'royal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  return bookedCruise;
}

export function transformPortInfoToItinerary(portInfo: RCApiPortInfo[]): ItineraryDay[] {
  return portInfo.map(port => {
    const isSeaDay = port.portType === 'CRUISING';
    
    let arrival: string | undefined;
    let departure: string | undefined;
    
    if (port.arrivalDateTime) {
      const arrTime = port.arrivalDateTime.split('T')[1];
      if (arrTime && arrTime !== '000000') {
        arrival = `${arrTime.substring(0, 2)}:${arrTime.substring(2, 4)}`;
      }
    }
    
    if (port.departureDateTime) {
      const depTime = port.departureDateTime.split('T')[1];
      if (depTime && depTime !== '235959' && depTime !== '000000') {
        departure = `${depTime.substring(0, 2)}:${depTime.substring(2, 4)}`;
      }
    }
    
    return {
      day: port.day,
      port: isSeaDay ? 'At Sea' : port.title,
      arrival: arrival,
      departure: departure,
      isSeaDay,
      casinoOpen: isSeaDay,
    };
  });
}

export function transformApiBookingsToBookedCruises(
  bookings: RCApiProfileBooking[],
  sailingInfoMap: Map<string, RCApiSailingInfo>
): BookedCruise[] {
  return bookings.map(booking => {
    const key = `${booking.shipCode}_${booking.sailDate}`;
    const sailingInfo = sailingInfoMap.get(key);
    return transformApiBookingToBookedCruise(booking, sailingInfo);
  });
}

export function transformApiMarketingOfferToCasinoOffer(
  offer: RCApiMarketingTargetedOffer
): CasinoOffer {
  const expiryDate = parseRCDate(offer.marketingEndDate);
  const perks = extractPerksFromMarketing(offer);
  const value = extractValueFromPerk(offer);
  
  const casinoOffer: CasinoOffer = {
    id: `offer_${offer.code}_${Date.now()}`,
    title: offer.title,
    offerCode: offer.marketingCouponCode,
    offerName: offer.title,
    offerType: 'discount',
    category: offer.type,
    perks: perks ? [perks] : [],
    description: offer.description,
    expires: expiryDate,
    expiryDate: expiryDate,
    offerExpiryDate: expiryDate,
    status: 'active',
    offerSource: 'royal',
    tradeInValue: value,
    termsConditions: offer.termsAndConditionsUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  return casinoOffer;
}

export function transformApiMarketingOffersToCasinoOffers(
  offers: RCApiMarketingTargetedOffer[]
): CasinoOffer[] {
  return offers.map(offer => transformApiMarketingOfferToCasinoOffer(offer));
}

export function transformApiLoyaltyToLoyaltyData(
  loyaltySummary: RCApiLoyaltySummaryResponse['payload']
): LoyaltyData {
  return {
    crownAndAnchorPoints: String(loyaltySummary.totalNights),
    crownAndAnchorLevel: determineCrownAnchorLevel(loyaltySummary.totalNights),
  };
}

function determineCrownAnchorLevel(totalNights: number): string {
  if (totalNights >= 700) return 'Pinnacle';
  if (totalNights >= 175) return 'Diamond Plus';
  if (totalNights >= 80) return 'Diamond';
  if (totalNights >= 55) return 'Emerald';
  if (totalNights >= 30) return 'Platinum';
  return 'Gold';
}

export function buildSailingInfoMap(sailingInfoList: RCApiSailingInfo[]): Map<string, RCApiSailingInfo> {
  const map = new Map<string, RCApiSailingInfo>();
  
  for (const info of sailingInfoList) {
    const key = `${info.shipCode}_${info.sailDate}`;
    map.set(key, info);
  }
  
  return map;
}

export function separateBookingsByStatus(bookings: RCApiProfileBooking[]): {
  confirmedBookings: RCApiProfileBooking[];
  courtesyHolds: RCApiProfileBooking[];
} {
  const confirmedBookings: RCApiProfileBooking[] = [];
  const courtesyHolds: RCApiProfileBooking[] = [];
  
  for (const booking of bookings) {
    if (isCourtesyHold(booking)) {
      courtesyHolds.push(booking);
    } else if (isConfirmedBooking(booking)) {
      confirmedBookings.push(booking);
    }
  }
  
  return { confirmedBookings, courtesyHolds };
}

export interface TransformedApiData {
  bookedCruises: BookedCruise[];
  courtesyHolds: BookedCruise[];
  casinoOffers: CasinoOffer[];
  loyaltyData: LoyaltyData | null;
  counts: {
    confirmedBookings: number;
    courtesyHolds: number;
    marketingOffers: number;
  };
}

export function transformAllApiData(
  profileBookings: RCApiProfileBooking[],
  sailingInfo: RCApiSailingInfo[],
  marketingOffers: RCApiMarketingTargetedOffer[],
  loyaltySummary?: RCApiLoyaltySummaryResponse['payload']
): TransformedApiData {
  const sailingInfoMap = buildSailingInfoMap(sailingInfo);
  const { confirmedBookings, courtesyHolds } = separateBookingsByStatus(profileBookings);
  
  const bookedCruises = transformApiBookingsToBookedCruises(confirmedBookings, sailingInfoMap);
  const courtesyHoldCruises = transformApiBookingsToBookedCruises(courtesyHolds, sailingInfoMap);
  const casinoOffers = transformApiMarketingOffersToCasinoOffers(marketingOffers);
  const loyaltyData = loyaltySummary ? transformApiLoyaltyToLoyaltyData(loyaltySummary) : null;
  
  return {
    bookedCruises,
    courtesyHolds: courtesyHoldCruises,
    casinoOffers,
    loyaltyData,
    counts: {
      confirmedBookings: confirmedBookings.length,
      courtesyHolds: courtesyHolds.length,
      marketingOffers: marketingOffers.length,
    },
  };
}

export function transformApiDataToSyncFormat(
  profileBookings: RCApiProfileBooking[],
  sailingInfo: RCApiSailingInfo[],
  marketingOffers: RCApiMarketingTargetedOffer[],
  loyaltySummary?: RCApiLoyaltySummaryResponse['payload']
): {
  offerRows: OfferRow[];
  bookedCruiseRows: BookedCruiseRow[];
  loyaltyData: LoyaltyData | null;
} {
  const sailingInfoMap = buildSailingInfoMap(sailingInfo);
  
  const bookedCruiseRows = transformApiBookingsToBookedCruiseRows(profileBookings, sailingInfoMap);
  const offerRows = transformApiMarketingOffersToOfferRows(marketingOffers);
  const loyaltyData = loyaltySummary ? transformApiLoyaltyToLoyaltyData(loyaltySummary) : null;
  
  return {
    offerRows,
    bookedCruiseRows,
    loyaltyData,
  };
}
