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
}

export interface BookedCruiseRow {
  sourcePage: string;
  shipName: string;
  sailingStartDate: string;
  sailingEndDate: string;
  sailingDates: string;
  itinerary: string;
  departurePort: string;
  cabinType: string;
  cabinNumberOrGTY: string;
  bookingId: string;
  status: string;
  loyaltyLevel: string;
  loyaltyPoints: string;
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
  | { type: 'step_complete'; step: number; data: any[] }
  | { type: 'loyalty_data'; data: LoyaltyData }
  | { type: 'error'; message: string }
  | { type: 'complete' };

export interface SyncDataCounts {
  offers: number;
  cruises: number;
  upcomingCruises: number;
  courtesyHolds: number;
}

export interface RoyalCaribbeanSyncState {
  status: SyncStatus;
  currentStep: string;
  currentUrl: string | null;
  progress: ProgressInfo | null;
  logs: LogEntry[];
  extractedOffers: OfferRow[];
  extractedBookedCruises: BookedCruiseRow[];
  loyaltyData: LoyaltyData | null;
  error: string | null;
  lastSyncTimestamp: string | null;
  syncCounts: SyncDataCounts | null;
}
