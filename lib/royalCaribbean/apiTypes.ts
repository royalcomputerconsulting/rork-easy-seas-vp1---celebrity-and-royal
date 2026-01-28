export interface RCApiPassenger {
  arrivalTime: string;
  birthdate: string;
  consumerId: string;
  email: string;
  firstName: string;
  hasFlight: boolean;
  lastName: string;
  onlineCheckinStatus: string;
  passengerId: string;
  passengerStatus: string;
  stateroomNumber: string;
  stateroomCategoryCode?: string;
  stateroomType: string;
  title: string;
}

export interface RCApiProfileBooking {
  balanceDue: boolean;
  balanceDueAmount?: number;
  bookingChannel: string;
  bookingCurrency: string;
  bookingOfficeCountryCode: string;
  bookingId: string;
  bookingLinkReferences: unknown[];
  bookingStatus: string;
  bookingType: string;
  brand: string;
  consumerId: string;
  deckNumber?: string;
  depositAmountDue?: number;
  grantorPassengerId: string;
  lastName: string;
  linkFlow: string;
  linkType: string;
  masterBookingId: string;
  masterPassengerId: string;
  musterStation?: string;
  numberOfNights: number;
  officeCode: string;
  offerExpirationDate?: string;
  packageCode: string;
  passengerId: string;
  passengers: RCApiPassenger[];
  passengersInStateroom: RCApiPassenger[];
  preferred: boolean;
  sailDate: string;
  shipCode: string;
  stateroomDescription?: string;
  stateroomNumber: string;
  stateroomSubtype?: string;
  stateroomType: string;
  stateroomCategoryCode?: string;
  isDirect: boolean;
  isBoardingExpressEnabled: boolean;
  isInternationalBooking: boolean;
  amendToken: string;
  paidInFull: boolean;
}

export interface RCApiProfileBookingsResponse {
  status: number;
  errors: unknown[];
  payload: {
    vdsId: string;
    profileBookings: RCApiProfileBooking[];
  };
}

export interface RCApiPortInfo {
  identifier: string;
  title: string;
  description: string;
  arrivalDateTime: string;
  departureDateTime: string;
  pointsOfInterest: { title: string; latitude?: number; longitude?: number }[];
  portImageURL?: string;
  gangwayUp?: string;
  gangwayDown?: string;
  portCode: string;
  portType: 'EMBARK' | 'DEBARK' | 'DOCKED' | 'TENDERED' | 'CRUISING';
  day: number;
  shortDescription: string;
}

export interface RCApiItinerary {
  source: string;
  description: string;
  portInfo: RCApiPortInfo[];
}

export interface RCApiVoyageImage {
  web: { title: string; fileReference: string; height?: number; width?: number }[];
  mobile: { title: string; fileReference: string; height?: number; width?: number }[];
}

export interface RCApiTerminal {
  name: string;
  code: string;
  description: string;
  latitude: string;
  longitude: string;
  address: string;
  addressHyperlink: string;
}

export interface RCApiDeparturePortInfo {
  found: boolean;
  name: string;
  code: string;
  description: string;
  timeZoneName: string;
  countryCode: string;
  terminals: RCApiTerminal[];
}

export interface RCApiSmartShipCapabilities {
  isFullCreditCardSupported: boolean;
  isArrivalAppointmentTimesCheckinSupported: boolean;
  isSecurityPhotoSupported: boolean;
  isEnhancedBoardingPassSupported: boolean;
  isCharterSailingSupported: boolean;
  isExcaliburWebSupported: boolean;
  isBiometricConsentSupported: boolean;
  isDynamicCurrencyConversionSupported: boolean;
}

export interface RCApiSailingInfo {
  shipCode: string;
  shipName: string;
  duration: number;
  sailDate: string;
  sailingEndDate: string;
  voyageImage: RCApiVoyageImage;
  regionCode: string;
  masterSailDate: {
    master1SailDate: string;
    master2SailDate: string;
  };
  voyageType: string;
  voyageId: number;
  canceled: boolean;
  canceledReason: string;
  canceledDate: string;
  charter: boolean;
  blacklist: unknown[];
  isOlciEnabled: boolean;
  isCheckinAvailable: boolean;
  checkinWindowRemainingTime: string;
  checkinStart: string;
  checkWindowOpenStartDateTime: string;
  itinerary: RCApiItinerary;
  healthQuestionnaireStartDateTime: string;
  healthQuestionnaireIsOpen: boolean;
  brand: string;
  isSailingClosed: boolean;
  beginOnlineCheckinDays: string;
  transpacificNumberOfDays: number;
  visitsCuba: boolean;
  visitsGalapagos: boolean;
  isCreditCardOnlyEnabled: boolean;
  beginOnlineCheckin: string;
  departurePort: string;
  departurePortCountryCode: string;
  departurePortName: string;
  arrivalPort: string;
  arrivalPortCountryCode: string;
  arrivalPortName: string;
  smartShipCapabilities: RCApiSmartShipCapabilities;
  departurePortInformation: RCApiDeparturePortInfo;
}

export interface RCApiSailingInfoResponse {
  status: number;
  errors: unknown[];
  payload: {
    sailingInfo: RCApiSailingInfo[];
  };
}

export interface RCApiMarketingCurrency {
  code: string;
  decimalSeparator: string;
  name: string;
  symbol: string;
  symbolOnLeft: boolean;
  thousandsSeparator: string;
}

export interface RCApiMarketingPrice {
  value: number;
  currency: RCApiMarketingCurrency;
}

export interface RCApiMarketingPerk {
  __typename: 'MarketingPricePerk' | string;
  description: string[];
  name: string;
  qualifier: string;
  price: RCApiMarketingPrice;
}

export interface RCApiMarketingUiAttributes {
  ctaLink: string;
}

export interface RCApiMarketingTargetedOffer {
  title: string;
  marketingEndDate: string;
  description: string;
  termsAndConditionsUrl: string;
  marketingCouponCode: string;
  type: string;
  code: string;
  marketingUiAttributes: RCApiMarketingUiAttributes;
  marketingPerks: RCApiMarketingPerk[];
}

export interface RCApiMarketingTargetedOfferImage {
  url: string;
  type: string;
}

export interface RCApiMarketingStaticContent {
  header: string;
  headerLoyalty: string;
  marketingEndDate: string;
  marketingCouponCode: string;
  findCruisesCta: string;
  termsAndConditions: string;
  resources: RCApiMarketingTargetedOfferImage[];
}

export interface RCApiMarketingTargetedOffersResponse {
  data: {
    getMarketingTargetedOffers: {
      marketingTargetedOfferStaticContent: RCApiMarketingStaticContent;
      marketingTargetedOfferResult: RCApiMarketingTargetedOffer[];
    };
  };
}

export interface RCApiLoyaltySummaryResponse {
  status: number;
  errors: unknown[];
  payload: {
    totalNights: number;
    totalTrips: number;
  };
}

export interface RCApiCourtesyHoldBooking extends RCApiProfileBooking {
  bookingStatus: 'OF';
}

export const SHIP_CODE_TO_NAME: Record<string, string> = {
  'AL': 'Allure of the Seas',
  'AN': 'Anthem of the Seas',
  'AD': 'Adventure of the Seas',
  'BR': 'Brilliance of the Seas',
  'EN': 'Enchantment of the Seas',
  'EX': 'Explorer of the Seas',
  'FR': 'Freedom of the Seas',
  'GR': 'Grandeur of the Seas',
  'HM': 'Harmony of the Seas',
  'ID': 'Independence of the Seas',
  'JW': 'Jewel of the Seas',
  'LE': 'Legend of the Seas',
  'LB': 'Liberty of the Seas',
  'MA': 'Mariner of the Seas',
  'NV': 'Navigator of the Seas',
  'OA': 'Oasis of the Seas',
  'OD': 'Odyssey of the Seas',
  'OV': 'Ovation of the Seas',
  'QN': 'Quantum of the Seas',
  'RD': 'Radiance of the Seas',
  'RH': 'Rhapsody of the Seas',
  'SE': 'Serenade of the Seas',
  'SP': 'Spectrum of the Seas',
  'SY': 'Symphony of the Seas',
  'UT': 'Utopia of the Seas',
  'VI': 'Vision of the Seas',
  'VY': 'Voyager of the Seas',
  'WN': 'Wonder of the Seas',
  'IC': 'Icon of the Seas',
  'SG': 'Star of the Seas',
};

export const STATEROOM_TYPE_MAP: Record<string, string> = {
  'I': 'Interior',
  'O': 'Oceanview',
  'B': 'Balcony',
  'S': 'Suite',
  'J': 'Junior Suite',
  'G': 'Grand Suite',
};

export function getShipNameFromCode(shipCode: string): string {
  return SHIP_CODE_TO_NAME[shipCode] || shipCode;
}

export function getStateroomTypeName(typeCode: string): string {
  return STATEROOM_TYPE_MAP[typeCode] || typeCode;
}

export function parseRCDate(dateStr: string): string {
  if (!dateStr) return '';
  
  if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    console.warn('[parseRCDate] Failed to parse date:', dateStr);
  }
  
  return dateStr;
}

export function isCourtesyHold(booking: RCApiProfileBooking): boolean {
  return booking.bookingStatus === 'OF';
}

export function isConfirmedBooking(booking: RCApiProfileBooking): boolean {
  return booking.bookingStatus === 'BK';
}
