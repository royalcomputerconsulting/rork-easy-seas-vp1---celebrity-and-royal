import type { CasinoProgram, TravelBrand } from './models';

export type EvidenceStatus = 'verified' | 'imported' | 'user_entered' | 'estimated' | 'missing';
export type RecommendationConfidence = 'high' | 'medium' | 'low' | 'insufficient';
export type HouseholdScope = 'me' | 'companion' | 'household' | 'unassigned';

export interface EvidenceDescriptor {
  field: string;
  status: EvidenceStatus;
  source?: string;
  capturedAt?: string;
  explanation: string;
  couldChangeRecommendation?: boolean;
}

export type TripCostCategory =
  | 'cruise_fare'
  | 'taxes_fees'
  | 'airfare'
  | 'hotel'
  | 'transfers'
  | 'parking'
  | 'gratuities'
  | 'wifi'
  | 'drinks'
  | 'dining'
  | 'excursions'
  | 'upgrade'
  | 'insurance'
  | 'gambling_budget'
  | 'other';

export interface TripCostEntry {
  id: string;
  tripId: string;
  category: TripCostCategory;
  label: string;
  amount: number | null;
  currency: string;
  evidenceStatus: EvidenceStatus;
  ownerProfileId?: string;
  source?: string;
  notes?: string;
  updatedAt: string;
}

export interface TripCostLedger {
  tripId: string;
  currency: string;
  entries: TripCostEntry[];
  verifiedAndImportedTotal: number;
  estimatedTotal: number;
  expectedTotal: number;
  gamblingBudget: number;
  missingCategories: TripCostCategory[];
  evidence: EvidenceDescriptor[];
  confidence: RecommendationConfidence;
}

export interface ValueEfficiencyMetrics {
  totalVacationValue: number;
  totalTripCost: number;
  netVacationValue: number;
  vacationDays: number;
  casinoHours: number | null;
  valuePerVacationDay: number;
  valuePerCasinoHour: number | null;
  confidence: RecommendationConfidence;
}

export type OfferLineageEventType =
  | 'promotion_received'
  | 'certificate_issued'
  | 'certificate_redeemed'
  | 'offer_replaced'
  | 'booking_created'
  | 'repriced'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface OfferLineageEvent {
  id: string;
  type: OfferLineageEventType;
  occurredAt: string;
  entityId: string;
  entityType: 'offer' | 'certificate' | 'cruise' | 'booking' | 'price';
  parentEntityId?: string;
  ownerProfileId?: string;
  label: string;
  offerCode?: string;
  playerOfferId?: string;
  evidenceStatus: EvidenceStatus;
  notes?: string;
}

export interface OfferLineage {
  rootEntityId: string;
  events: OfferLineageEvent[];
  unresolvedLinks: string[];
  confidence: RecommendationConfidence;
}

export type NextBestActionType =
  | 'book_expiring_offer'
  | 'redeem_certificate'
  | 'review_price_drop'
  | 'finish_trip_task'
  | 'review_casino_guardrail'
  | 'review_schedule_conflict'
  | 'verify_missing_data';

export interface NextBestAction {
  id: string;
  type: NextBestActionType;
  title: string;
  explanation: string;
  score: number;
  urgency: 'now' | 'soon' | 'monitor';
  expectedBenefit?: number;
  route: string;
  routeParams?: Record<string, string>;
  ownerProfileId?: string;
  brand?: TravelBrand | string;
  casinoProgram?: CasinoProgram | string;
  confidence: RecommendationConfidence;
  evidence: EvidenceDescriptor[];
  missingData: string[];
  requiresConfirmation: boolean;
  externalSideEffect: false;
}

export interface RecommendationScope {
  profile: HouseholdScope | string;
  brand: TravelBrand | 'all';
  casinoProgram: CasinoProgram | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface ResponsiblePlayLimits {
  tripId: string;
  tripBankroll: number | null;
  dailyStopLoss: number | null;
  dailyWinGoal: number | null;
  sessionMinutes: number | null;
  cooldownMinutes: number | null;
  privateOnDevice: true;
  updatedAt: string;
}

export type MachineObservationStatus = 'seen_onboard' | 'removed' | 'bank_moved' | 'poor_condition' | 'progressive_available';
export interface ShipCasinoObservation {
  id: string;
  shipName: string;
  machineName?: string;
  location?: string;
  status: MachineObservationStatus;
  observedAt: string;
  ownerProfileId?: string;
  evidenceStatus: EvidenceStatus;
  notes?: string;
}
