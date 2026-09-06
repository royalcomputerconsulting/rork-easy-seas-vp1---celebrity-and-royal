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
  | 'complete_with_warnings'
  | 'partial'
  | 'resumable'
  | 'cancelled'
  | 'authentication_required'
  | 'invalid_response'
  | 'login_expired'
  | 'error';

export type CarnivalSyncOutcome = 'complete' | 'complete_with_warnings' | 'partial' | 'invalid_response';

export type CarnivalCollectionKey =
  | 'offers'
  | 'offerSailings'
  | 'bookedCruises'
  | 'cruiseHolds'
  | 'completedCruises'
  | 'vifpIdentity'
  | 'vifpTier'
  | 'vifpPoints'
  | 'cruiseDayPoints'
  | 'cruiseCount';

export type CarnivalCollectionStatus = 'not_started' | 'captured' | 'empty' | 'unavailable' | 'failed';

export interface CarnivalCollectionEvidence {
  status: CarnivalCollectionStatus;
  count: number;
  source: string;
  capturedAt: string;
  reason?: string;
}

export type CarnivalCollectionEvidenceMap = Record<CarnivalCollectionKey, CarnivalCollectionEvidence>;

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
  crownAndAnchorNumber?: string;
  crownAnchorNumber?: string;
  crownAndAnchorSocietyId?: string;
  crownAndAnchorSocietyNumber?: string;
  crownAndAnchorMembershipNumber?: string;

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
  crownAndAnchorSocietyTier?: string;
  crownAndAnchorTier?: string;
  crownAnchorTier?: string;
  crownAndAnchorLevel?: string;
  crownAnchorLevel?: string;
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
  lastSyncTimestamp?: string | null;
  loyaltyObservedAt?: string | null;
  loyaltySourceEndpoint?: string | null;

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
  /** Royal's unique offer-instance identifier; offerCode is not unique. */
  playerOfferId?: string;
  /** Provider-neutral instance identity used by Carnival and future sources. */
  offerInstanceId?: string;
  carnivalOfferId?: string;
  offerName: string;
  offerCode: string;
  offerExpirationDate: string;
  offerType: string;
  shipName: string;
  shipCode?: string;
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
  taxesAndFees?: string;
  portList?: string;
  dayByDayItinerary?: DayByDayPort[];
  destinationName?: string;
  totalNights?: number;
  bookingLink?: string;
  offerStatus?: string;
  isInProgress?: boolean;
}

export interface DayByDayPort {
  day: number;
  type: string;
  portName: string;
  portCode?: string;
  arrivalTime?: string;
  departureTime?: string;
}

export interface BookedCruiseRow {
  rawBooking?: unknown;
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
  taxesAndFees?: string;
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
  | { type: 'step_complete'; step: number; data?: any[]; totalCount?: number; offerCount?: number }
  | { type: 'offer_progress'; offerIndex: number; totalOffers: number; offerName: string; sailingsCount: number; status: string }
  | { type: 'all_bookings_data'; bookings: any[]; vdsId?: string }
  | { type: 'loyalty_data'; data?: LoyaltyData; loyalty?: LoyaltyApiInformation }
  | { type: 'extended_loyalty_data'; data: LoyaltyApiInformation; accountId?: string }
  | { type: 'network_payload'; endpoint: string; data: any; url: string }
  | { type: 'network_capture_headers'; url: string; hasApiKey?: boolean; hasAuthorization?: boolean; hasAccountId?: boolean }
  | { type: 'offer_sailings_result'; offerCode: string; offerName: string; sailings: OfferRow[] }
  | { type: 'error'; message: string }
  | { type: 'complete' };

export interface SyncDataCounts {
  /** Manifest run that produced every count in this receipt. */
  commitRunId?: string;
  committedAt?: string;
  /** Active SQLite generation(s) read back for this provider/run. */
  inventoryGenerationIds?: string[];
  offerCount: number;
  offerRows: number;
  storageOfferReadbackRows?: number;
  upcomingCruises: number;
  courtesyHolds: number;
  completedCruises?: number;
  bookedCruises?: number;
  /** User-facing available cruise option rows saved for this provider/run. */
  availableCruiseRows?: number;
  /** Physical ship/date/itinerary rows after canonical storage dedupe. */
  physicalSailingRows?: number;
  /** Exact offer-to-sailing relationships read back from SQLite. */
  offerSailingRelationships?: number;
  /** All-provider catalog total after this provider-scoped commit. */
  grandTotalAvailableCruiseRows?: number;
  storageBookedReadbackRows?: number;
  /** Back-compat alias for availableCruiseRows. */
  totalImportedCruises?: number;
  rawRowsReceived?: number;
  canonicalRows?: number;
  retainedVariants?: number;
  consolidatedDuplicates?: number;
  rejectedRows?: number;
  insertedRows?: number;
  updatedRows?: number;
  unchangedRows?: number;
  royalHandoffEvidence?: RoyalSyncHandoffEvidence;
  carnivalOutcome?: CarnivalSyncOutcome;
  carnivalCollections?: CarnivalCollectionEvidenceMap;
  carnivalRateCodes?: Record<string, {
    code: string;
    requestedPages: number;
    acknowledgedPages: number;
    receivedRows: number;
    status: 'not_started' | 'captured' | 'incomplete' | 'failed';
    reason?: string;
  }>;
}

/**
 * Counts preserved at each application handoff so a raw provider row cannot be
 * mistaken for a duplicate merely because it did not reach canonical storage.
 */
export interface RoyalSyncHandoffEvidence {
  discoveredOfferRows: number;
  discoveredBookedRows: number;
  normalizedOfferRows: number;
  normalizedBookedRows: number;
  /** Browser-reported rows before the React Native bridge accepts them. */
  emittedRows: number;
  /** Rows acknowledged by the application message handler. */
  acknowledgedRows: number;
  /** Rows retained in the in-memory accepted payload. */
  receivedRows: number;
  malformedOfferRows: number;
  malformedBookedRows: number;
  exactOfferDuplicates: number;
  exactBookedDuplicates: number;
  canonicalRows: number;
  rejectedRows: number;
  quarantinedRows: number;
  insertedRows: number;
  updatedRows: number;
  unchangedRows: number;
  /** Stable rows found again after storage persistence. */
  databaseReadbackRows: number;
  unaccountedRows: number;
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
  hasResumableCarnivalCheckpoint?: boolean;
}
