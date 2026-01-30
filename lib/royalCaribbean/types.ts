export type SyncStatus = 
  | 'not_logged_in'
  | 'logged_in'
  | 'running_step_1'
  | 'running_step_2'
  | 'running_step_3'
  | 'running_step_4'
  | 'awaiting_confirmation'
  | 'syncing'
  | 'complete'
  | 'login_expired'
  | 'error';

export interface LogEntry {
  timestamp: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface LoyaltyData {
  crownAndAnchorLevel?: string;
  crownAndAnchorPoints?: string;
  clubRoyaleTier?: string;
  clubRoyalePoints?: string;
}

export interface RoyalCaribbeanLoyaltyApiResponse {
  status: number;
  errors: string[];
  payload: {
    accountId: string;
    loyaltyInformation: LoyaltyApiInformation;
    coBrandCardInfo?: {
      status: number;
      errorMessage?: string;
      activeCardHolder: boolean;
    };
  };
}

export interface LoyaltyApiInformation {
  captainsClubId?: string;
  crownAndAnchorId?: string;

  captainsClubLoyaltyTier?: string;
  captainsClubLoyaltyIndividualPoints?: number;
  captainsClubLoyaltyRelationshipPoints?: number;
  captainsClubNextTier?: string;
  captainsClubRemainingPoints?: number;
  captainsClubTrackerPercentage?: number;
  captainsClubLoyaltyMatchTier?: string;

  celebrityBlueChipLoyaltyTier?: string;
  celebrityBlueChipLoyaltyIndividualPoints?: number;
  celebrityBlueChipLoyaltyRelationshipPoints?: number;

  clubRoyaleLoyaltyTier?: string;
  clubRoyaleLoyaltyIndividualPoints?: number;
  clubRoyaleLoyaltyRelationshipPoints?: number;

  crownAndAnchorSocietyLoyaltyTier?: string;
  crownAndAnchorSocietyLoyaltyIndividualPoints?: number;
  crownAndAnchorSocietyLoyaltyRelationshipPoints?: number;
  crownAndAnchorSocietyNextTier?: string;
  crownAndAnchorSocietyRemainingPoints?: number;
  crownAndAnchorTrackerPercentage?: number;
  crownAndAnchorLoyaltyMatchTier?: string;

  venetianSocietyLoyaltyTier?: string;
  venetianSocietyNextTier?: string;
  venetianSocietyLoyaltyMatchTier?: string;
  venetianSocietyEnrollmentSubmitted?: boolean;
  vsMemberNumber?: string;
}

export interface ExtendedLoyaltyData extends LoyaltyData {
  accountId?: string;

  captainsClubId?: string;
  captainsClubTier?: string;
  captainsClubPoints?: number;
  captainsClubRelationshipPoints?: number;
  captainsClubNextTier?: string;
  captainsClubRemainingPoints?: number;
  captainsClubTrackerPercentage?: number;
  captainsClubLoyaltyMatchTier?: string;

  celebrityBlueChipTier?: string;
  celebrityBlueChipPoints?: number;
  celebrityBlueChipRelationshipPoints?: number;

  clubRoyaleTierFromApi?: string;
  clubRoyalePointsFromApi?: number;
  clubRoyaleRelationshipPointsFromApi?: number;

  crownAndAnchorId?: string;
  crownAndAnchorTier?: string;
  crownAndAnchorPointsFromApi?: number;
  crownAndAnchorRelationshipPointsFromApi?: number;
  crownAndAnchorNextTier?: string;
  crownAndAnchorRemainingPoints?: number;
  crownAndAnchorTrackerPercentage?: number;
  crownAndAnchorLoyaltyMatchTier?: string;

  venetianSocietyTier?: string;
  venetianSocietyNextTier?: string;
  venetianSocietyMemberNumber?: string;
  venetianSocietyEnrolled?: boolean;
  venetianSocietyLoyaltyMatchTier?: string;

  hasCoBrandCard?: boolean;
  coBrandCardStatus?: number;
  coBrandCardErrorMessage?: string;
}

export interface OfferRow {
  sourcePage: string;
  offerName: string;
  offerCode: string;
  offerExpirationDate: string;
  offerType: string;
  shipName: string;
  sailingDate: string;
  itinerary: string;
  departurePort: string;
  cabinType: string;
  numberOfGuests: string;
  perks: string;
  loyaltyLevel: string;
  loyaltyPoints: string;
  interiorPrice?: string;
  oceanviewPrice?: string;
  balconyPrice?: string;
  suitePrice?: string;
  portList?: string;
}

export interface BookedCruiseRow {
  sourcePage: string;
  shipName: string;
  shipCode?: string;
  cruiseTitle?: string;
  sailingStartDate: string;
  sailingEndDate: string;
  sailingDates: string;
  itinerary: string;
  departurePort: string;
  arrivalPort?: string;
  isOneWay?: string;
  cabinType: string;
  cabinCategory?: string;
  cabinNumberOrGTY: string;
  deckNumber?: string;
  bookingId: string;
  numberOfGuests?: string;
  numberOfNights?: number;
  daysToGo?: string;
  status: string;
  loyaltyLevel: string;
  loyaltyPoints: string;
  paidInFull?: string;
  balanceDue?: string;
  balanceDueAmount?: number;
  depositAmountDue?: number;
  musterStation?: string;
  holdExpiration?: string;
  offerExpirationDate?: string;
  bookingStatus?: string;
  packageCode?: string;
  passengerStatus?: string;
  stateroomNumber?: string;
  stateroomCategoryCode?: string;
  stateroomType?: string;
  stateroomSubtype?: string;
  interiorPrice?: string;
  oceanviewPrice?: string;
  balconyPrice?: string;
  suitePrice?: string;
  portList?: string;
  stateroomDescription?: string;
  bookingChannel?: string;
  bookingCurrency?: string;
  bookingOfficeCountryCode?: string;
  officeCode?: string;
  bookingType?: string;
  brand?: string;
  consumerId?: string;
  grantorPassengerId?: string;
  linkFlow?: string;
  linkType?: string;
  masterBookingId?: string;
  masterPassengerId?: string;
  passengerId?: string;
  preferred?: boolean;
  isDirect?: boolean;
  isBoardingExpressEnabled?: boolean;
  isInternationalBooking?: boolean;
  amendToken?: string;
  passengers?: {
    birthdate?: string;
    consumerId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    hasFlight?: boolean;
    passengerId?: string;
    passengerStatus?: string;
    stateroomNumber?: string;
    stateroomCategoryCode?: string;
    stateroomType?: string;
    title?: string;
  }[];
  passengersInStateroom?: {
    birthdate?: string;
    consumerId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    hasFlight?: boolean;
    passengerId?: string;
    passengerStatus?: string;
    stateroomNumber?: string;
    stateroomCategoryCode?: string;
    stateroomType?: string;
    title?: string;
  }[];
}

export interface ProgressInfo {
  current: number;
  total: number;
  stepName?: string;
}

export type WebViewMessage = 
  | { type: 'auth_status'; loggedIn: boolean }
  | { type: 'log'; message: string; logType?: 'info' | 'success' | 'warning' | 'error' }
  | { type: 'progress'; current: number; total: number; stepName?: string }
  | { type: 'offers_batch'; step: number; data: any[]; isFinal?: boolean }
  | { type: 'cruise_batch'; data: any[] }
  | { type: 'step_complete'; step: number; data: any[]; totalCount?: number; offerCount?: number }
  | { type: 'offer_progress'; offerIndex: number; totalOffers: number; offerName: string; sailingsCount: number; status: string }
  | { type: 'all_bookings_data'; bookings: any[]; vdsId?: string }
  | { type: 'loyalty_data'; data?: LoyaltyData; loyalty?: LoyaltyApiInformation }
  | { type: 'extended_loyalty_data'; data: LoyaltyApiInformation; accountId?: string }
  | { type: 'network_payload'; endpoint: string; data: any; url: string }
  | { type: 'network_capture_headers'; url: string; hasApiKey?: boolean; hasAuthorization?: boolean; hasAccountId?: boolean }
  | { type: 'error'; message: string }
  | { type: 'complete' };

export interface SyncDataCounts {
  offerCount: number;
  offerRows: number;
  upcomingCruises: number;
  courtesyHolds: number;
}

export interface RoyalCaribbeanSyncState {
  status: SyncStatus;
  currentStep: string;
  progress: ProgressInfo | null;
  logs: LogEntry[];
  extractedOffers: OfferRow[];
  extractedBookedCruises: BookedCruiseRow[];
  loyaltyData: LoyaltyData | null;
  error: string | null;
  lastSyncTimestamp: string | null;
  syncCounts: SyncDataCounts | null;
  syncPreview: any | null;
  scrapePricingAndItinerary: boolean;
}
