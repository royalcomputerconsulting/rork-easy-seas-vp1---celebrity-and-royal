export type CabinCategory = 
  | 'Interior GTY'
  | 'Interior'
  | 'Oceanview GTY'
  | 'Oceanview'
  | 'Balcony GTY'
  | 'Balcony'
  | 'Suite GTY'
  | 'Junior Suite'
  | 'Grand Suite'
  | 'Owner\'s Suite'
  | 'Grand Suite 2BR'
  | 'Owner\'s Suite 2BR'
  | 'Royal Suite'
  | 'Penthouse Suite';

export const CABIN_HIERARCHY: CabinCategory[] = [
  'Interior GTY',
  'Interior',
  'Oceanview GTY',
  'Oceanview',
  'Balcony GTY',
  'Balcony',
  'Suite GTY',
  'Junior Suite',
  'Grand Suite',
  'Owner\'s Suite',
  'Grand Suite 2BR',
  'Owner\'s Suite 2BR',
  'Royal Suite',
  'Penthouse Suite',
];

export interface Cruise {
  id: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  departurePort: string;
  destination: string;
  nights: number;
  category?: string;
  price?: number;
  pricePerNight?: number;
  cabinType?: CabinCategory | 'Interior' | 'Oceanview' | 'Balcony' | 'Suite' | string;
  balconyPrice?: number;
  oceanviewPrice?: number;
  interiorPrice?: number;
  suitePrice?: number;
  juniorSuitePrice?: number;
  grandSuitePrice?: number;
  taxes?: number;
  gratuities?: number;
  totalPrice?: number;
  originalPrice?: number;
  priceDrop?: number;
  offerCode?: string;
  offerName?: string;
  offerExpiry?: string;
  offerCategory?: string;
  freeOBC?: number;
  freeGratuities?: boolean;
  freeDrinkPackage?: boolean;
  freeWifi?: boolean;
  freeSpecialtyDining?: boolean;
  freePlay?: number;
  tradeInValue?: number;
  offerValue?: number;
  perks?: string[];
  percentOff?: number;
  status?: 'available' | 'booked' | 'completed' | 'cancelled';
  notes?: string;
  imageUrl?: string;
  itinerary?: ItineraryDay[];
  itineraryRaw?: string[];
  itineraryName?: string;
  ports?: string[];
  portsAndTimes?: string;
  itineraryNeedsManualEntry?: boolean;
  destinationRegion?: string;
  guests?: number;
  guestsInfo?: string;
  retailValue?: number;
  compValue?: number;
  totalValue?: number;
  roi?: number;
  valueScore?: number;
  casinoOpenDays?: number;
  seaDays?: number;
  portDays?: number;
  received?: string;
  cruiseSource?: 'royal' | 'celebrity';
  createdAt?: string;
  updatedAt?: string;
}

export interface ItineraryDay {
  day: number;
  port: string;
  arrival?: string;
  departure?: string;
  isSeaDay: boolean;
  casinoOpen?: boolean;
  notes?: string;
}

export interface BookedCruise extends Cruise {
  sourcePayload?: unknown;
  reservationNumber?: string;
  bookingId?: string;
  bwoNumber?: string;
  isCourtesyHold?: boolean;
  holdExpiration?: string;
  checkInDate?: string;
  casinoLevel?: string;
  casinoHost?: string;
  casinoHostEmail?: string;
  casinoHostPhone?: string;
  depositPaid?: number;
  depositDate?: string;
  balanceDue?: number;
  balanceDueDate?: string;
  cabinNumber?: string;
  cabinCategory?: string;
  deckNumber?: string;
  bookingStatus?: string;
  packageCode?: string;
  passengerStatus?: string;
  stateroomNumber?: string;
  stateroomCategoryCode?: string;
  stateroomType?: string;
  musterStation?: string;
  guestNames?: string[];
  specialRequests?: string;
  airfare?: {
    included: boolean;
    cost?: number;
    flightDetails?: string;
  };
  insurance?: {
    included: boolean;
    cost?: number;
    provider?: string;
  };
  excursions?: {
    name: string;
    date: string;
    cost: number;
    booked: boolean;
  }[];
  diningReservations?: {
    restaurant: string;
    date: string;
    time: string;
  }[];
  casinoPoints?: number;
  earnedPoints?: number;
  pointsGoal?: number;
  dailyPointsGoal?: number;
  documents?: string[];
  actualSpend?: number;
  totalSpend?: number;
  totalWinnings?: number;
  netResult?: number;
  winnings?: number;
  hoursPlayed?: number;
  sessionsPlayed?: number;
  avgBet?: number;
  theoreticalLoss?: number;
  actualLoss?: number;
  completionState?: 'upcoming' | 'in-progress' | 'completed';
  financialRecordIds?: string[];
  pricePaid?: number;
  totalRetailCost?: number;
  totalCasinoDiscount?: number;
  usedNextCruiseCertificate?: boolean;
  nextCruiseCertificateValue?: number;
  nextCruiseCertificateId?: string;
}

export type OfferClassification = 
  | '2person'         
  | '1+discount'      
  | 'freeplay'
  | 'discount'
  | 'obc'
  | 'package'
  | 'upgrade'
  | 'comped'
  | 'partial';

export interface CasinoOffer {
  id: string;
  cruiseId?: string;
  cruiseIds?: string[];
  
  offerCode?: string;
  offerName?: string;
  offerType: OfferClassification;
  classification?: '2person' | '1+discount' | 'comped' | 'partial';
  
  title: string;
  description?: string;
  category?: string;
  perks?: string[];
  
  shipName?: string;
  sailingDate?: string;
  itineraryName?: string;
  nights?: number;
  ports?: string[];
  portsAndTimes?: string;
  itineraryNeedsManualEntry?: boolean;
  
  roomType?: CabinCategory | string;
  guestsInfo?: string;
  guests?: number;
  
  value?: number;
  offerValue?: number;
  
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  juniorSuitePrice?: number;
  grandSuitePrice?: number;
  
  taxesFees?: number;
  portCharges?: number;
  
  freePlay?: number;
  freeplayAmount?: number;
  OBC?: number;
  obcAmount?: number;
  tradeInValue?: number;
  
  retailCabinValue?: number;
  totalValue?: number;
  discountValue?: number;
  discountPercent?: number;
  
  received?: string;
  expires?: string;
  expiryDate?: string;
  offerExpiryDate?: string;
  validFrom?: string;
  validUntil?: string;
  
  status?: 'active' | 'expired' | 'used' | 'booked';
  has2025Badge?: boolean;
  
  termsConditions?: string;
  promoCode?: string;
  cruiseLines?: string[];
  minNights?: number;
  maxNights?: number;
  eligibleShips?: string[];
  requiresDeposit?: boolean;
  
  offerSource?: 'royal' | 'celebrity';
  csvRowNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  start?: string;
  end?: string;
  type: 'cruise' | 'travel' | 'hotel' | 'flight' | 'personal' | 'other';
  sourceType?: 'TripIt' | 'personal' | 'cruise' | 'import';
  location?: string;
  description?: string;
  cruiseId?: string;
  color?: string;
  allDay?: boolean;
  reminder?: string;
  notes?: string;
  source?: 'manual' | 'tripit' | 'import';
}

export interface FinancialsRecord {
  id: string;
  sourceType: 'receipt' | 'statement';
  date: string;
  amount: number;
  category: string;
  department?: string;
  folioOrRef?: string;
  cruiseId?: string;
  bookingId?: string;
  cabinNumber?: string;
  normalizedCategory?: string;
  description?: string;
  createdAt?: string;
}

export interface CasinoPerformance {
  coinIn: number;
  actualRisk: number;
  riskMultiplier: number;
  totalWinnings: number;
  totalLosses: number;
  netResult: number;
  pointsEarned: number;
  freePlayUsed: number;
  freePlayEarned: number;
}

export interface EstimatorParams {
  pointsPerNight: number;
  averageDailySpend: number;
  targetTier: string;
  currentPoints: number;
  targetPoints: number;
}

export interface TierProgress {
  currentTier: string;
  currentPoints: number;
  nextTier: string;
  nextTierThreshold: number;
  pointsToNextTier: number;
  percentComplete: number;
  estimatedDate?: string;
  nightsRemaining?: number;
}

export type ClubRoyaleTier = 'Choice' | 'Prime' | 'Signature' | 'Masters';
export type CrownAnchorLevel = 'Gold' | 'Platinum' | 'Emerald' | 'Diamond' | 'Diamond Plus' | 'Pinnacle';

export interface ClubRoyaleProfile {
  memberId: string;
  memberName: string;
  tier: ClubRoyaleTier | 'Classic' | 'Select' | 'Elite' | 'Elite Plus' | 'Pinnacle';
  tierPoints: number;
  pointsToNextTier?: number;
  nextTier?: string;
  totalPoints: number;
  lifetimeCruises: number;
  lifetimeNights: number;
  averageDaily?: number;
  preferredCabin?: string;
  preferredDining?: string;
  homePort?: string;
  birthdayMonth?: number;
  anniversaryMonth?: number;
  email?: string;
  phone?: string;
  crownAnchorNumber?: string;
  crownAnchorLevel?: CrownAnchorLevel;
  loyaltyPoints?: number;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export const CLUB_ROYALE_TIERS: Record<ClubRoyaleTier, { threshold: number; color: string }> = {
  Choice: { threshold: 0, color: '#6B7280' },
  Prime: { threshold: 2501, color: '#3B82F6' },
  Signature: { threshold: 25001, color: '#8B5CF6' },
  Masters: { threshold: 100001, color: '#F59E0B' },
};

export const CROWN_ANCHOR_LEVELS: Record<CrownAnchorLevel, { cruiseNights: number; color: string }> = {
  Gold: { cruiseNights: 1, color: '#D4AF37' },
  Platinum: { cruiseNights: 30, color: '#E5E4E2' },
  Emerald: { cruiseNights: 55, color: '#50C878' },
  Diamond: { cruiseNights: 80, color: '#B9F2FF' },
  'Diamond Plus': { cruiseNights: 175, color: '#7B68EE' },
  Pinnacle: { cruiseNights: 700, color: '#1C1C1C' },
};

export const SAMPLE_CLUB_ROYALE_PROFILE: ClubRoyaleProfile = {
  memberId: '',
  memberName: '',
  tier: 'Choice',
  tierPoints: 0,
  totalPoints: 0,
  lifetimeCruises: 0,
  lifetimeNights: 0,
  crownAnchorLevel: 'Gold',
  loyaltyPoints: 0,
};

export interface CruiseFilter {
  searchQuery?: string;
  shipNames?: string[];
  departurePorts?: string[];
  destinations?: string[];
  minNights?: number;
  maxNights?: number;
  minPrice?: number;
  maxPrice?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  hasOffer?: boolean;
  hasFreeplay?: boolean;
  hasOBC?: boolean;
  cabinTypes?: ('Interior' | 'Oceanview' | 'Balcony' | 'Suite')[];
  sortBy?: 'date' | 'price' | 'nights' | 'ship' | 'destination' | 'roi' | 'expiring';
  sortOrder?: 'asc' | 'desc';
  onlyAvailable?: boolean;
  onlyBooked?: boolean;
  noConflicts?: boolean;
}

export interface AnalyticsData {
  totalSpent: number;
  totalSaved: number;
  totalCruises: number;
  totalNights: number;
  totalPoints: number;
  totalPortTaxes: number;
  portfolioROI: number;
  averagePricePerNight: number;
  averageROI: number;
  favoriteShip?: string;
  favoriteDestination?: string;
  favoritePort?: string;
  monthlySpending: { month: string; amount: number }[];
  yearlySpending: { year: string; amount: number }[];
  cabinTypeDistribution: { type: string; count: number }[];
  destinationDistribution: { destination: string; count: number }[];
  roiByMonth: { month: string; roi: number }[];
  pointsByMonth: { month: string; points: number }[];
}

export interface CruiseAnalytics {
  cruiseId: string;
  roi: number;
  retailValue: number;
  paidValue: number;
  compValue: number;
  pointsEarned: number;
  costPerPoint: number;
  valueScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FinancialSummary {
  totalDeposits: number;
  totalPaid: number;
  totalDue: number;
  upcomingPayments: {
    cruiseId: string;
    amount: number;
    dueDate: string;
  }[];
  totalFreeplay: number;
  totalOBC: number;
  totalSavings: number;
  totalCasinoSpend: number;
  totalNonCasinoSpend: number;
  categoryBreakdown: { category: string; amount: number }[];
}

export interface PortfolioMetrics {
  coinIn: number;
  actualRisk: number;
  riskMultiplier: number;
  totalCruises: number;
  highROICruises: number;
  mediumROICruises: number;
  lowROICruises: number;
}

export interface Certificate {
  id: string;
  type: 'NextCruise' | 'FPP' | 'OBC' | 'Upgrade';
  value: number;
  expiryDate?: string;
  used: boolean;
  cruiseId?: string;
  reservationNumber?: string;
  description?: string;
  earnedOnCruise?: string;
  cruiseLength?: number;
}

export interface CasinoPayTable {
  freePlay: number;
  OBC: number;
  cabinValue: number;
  cabinType: CabinCategory | string;
  taxesFees: number;
  retailCabinPrice: number;
  discountValue: number;
  totalValue: number;
}

export interface OfferValuation {
  offerId: string;
  offerCode: string;
  
  retailCabinValue: number;
  taxesFees: number;
  amountPaid: number;
  
  freePlayValue: number;
  obcValue: number;
  tradeInValue: number;
  
  compValue: number;
  discountValue: number;
  totalValue: number;
  
  isFullyComped: boolean;
  is2Person: boolean;
  
  valuationFormula: string;
  calculatedAt: string;
}

export interface ROICalculation {
  cruiseId: string;
  
  retailCabinValue: number;
  winnings: number;
  outOfPocketSpend: number;
  
  roi: number;
  roiPercentage: number;
  
  pointsEarned: number;
  coinIn: number;
  costPerPoint: number;
  
  riskLevel: 'low' | 'medium' | 'high';
  valueScore: number;
  
  comparisonRank?: number;
  calculatedAt: string;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  description?: string;
  
  baselineCruiseId?: string;
  
  hypotheticalCoinIn: number;
  hypotheticalWinLoss: number;
  hypotheticalNights: number;
  hypotheticalCabinType: CabinCategory | string;
  
  projectedPoints: number;
  projectedTierProgress: number;
  projectedROI: number;
  projectedCostPerPoint: number;
  
  riskAssessment: {
    probability: number;
    bestCase: number;
    worstCase: number;
    expectedValue: number;
  };
  
  createdAt: string;
}

export interface TierProjection {
  currentTier: ClubRoyaleTier;
  currentPoints: number;
  
  targetTier: ClubRoyaleTier;
  targetPoints: number;
  pointsNeeded: number;
  
  estimatedCruisesNeeded: number;
  estimatedNightsNeeded: number;
  estimatedCoinInNeeded: number;
  
  projectedDate: string;
  confidenceLevel: 'low' | 'medium' | 'high';
  
  milestones: {
    tier: ClubRoyaleTier;
    pointsNeeded: number;
    estimatedDate: string;
  }[];
}

export const DOLLARS_PER_POINT = 5;

export function calculateCoinInFromPoints(points: number): number {
  return points * DOLLARS_PER_POINT;
}

export function calculatePointsFromCoinIn(coinIn: number): number {
  return Math.floor(coinIn / DOLLARS_PER_POINT);
}

export function getCabinPriceForType(
  cruise: Cruise | CasinoOffer,
  cabinType: CabinCategory | string
): number | undefined {
  const typeKey = cabinType.toLowerCase();
  
  if (typeKey.includes('interior')) return cruise.interiorPrice;
  if (typeKey.includes('ocean') || typeKey.includes('oceanview')) return cruise.oceanviewPrice;
  if (typeKey.includes('balcony')) return cruise.balconyPrice;
  if (typeKey.includes('junior') || typeKey.includes('jr')) return cruise.juniorSuitePrice;
  if (typeKey.includes('grand')) return cruise.grandSuitePrice;
  if (typeKey.includes('suite')) return cruise.suitePrice;
  
  return cruise.balconyPrice || cruise.oceanviewPrice || cruise.interiorPrice;
}

export function calculateTotalValue(
  cabinPrice: number,
  taxesFees: number,
  freePlay: number = 0,
  obc: number = 0,
  guestCount: number = 2
): number {
  const cabinValueForTwo = cabinPrice * guestCount;
  return cabinValueForTwo + taxesFees + freePlay + obc;
}

export function calculateROI(
  retailValue: number,
  winnings: number,
  outOfPocketSpend: number
): number {
  if (outOfPocketSpend <= 0) return 0;
  return ((retailValue + winnings) / outOfPocketSpend) * 100;
}

export type AnomalyType = 
  | 'roi_outlier'
  | 'spending_spike'
  | 'points_mismatch'
  | 'value_drop'
  | 'unusual_pattern'
  | 'offer_expiring'
  | 'tier_milestone'
  | 'booking_conflict'
  | 'back_to_back'
  | 'price_drop';

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus = 'active' | 'dismissed' | 'resolved' | 'snoozed';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AlertPriority;
  title: string;
  description: string;
  detectedAt: string;
  dataPoints: {
    cruiseId?: string;
    offerId?: string;
    metric: string;
    expectedValue: number;
    actualValue: number;
    deviation: number;
    deviationPercent: number;
    isBookedCruise?: number;
  };
  relatedEntityId?: string;
  relatedEntityType?: 'cruise' | 'offer' | 'financial';
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: AnomalyType;
  enabled: boolean;
  conditions: AlertCondition[];
  priority: AlertPriority;
  cooldownMinutes: number;
  notifyOnTrigger: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface AlertCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte' | 'between' | 'outside';
  value: number | [number, number];
  unit?: string;
}

export interface Alert {
  id: string;
  ruleId?: string;
  anomaly?: Anomaly;
  type: AnomalyType;
  priority: AlertPriority;
  status: AlertStatus;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  createdAt: string;
  dismissedAt?: string;
  snoozedUntil?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'cruise' | 'offer' | 'financial';
}

export interface PatternInsight {
  id: string;
  type: 'trend' | 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  data: {
    metric: string;
    trend?: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    correlation?: { metric1: string; metric2: string; coefficient: number };
    prediction?: { targetDate: string; predictedValue: number; range: [number, number] };
    recommendation?: string;
  };
  createdAt: string;
}

export interface AnomalyDetectionConfig {
  roiThresholds: {
    lowWarning: number;
    highWarning: number;
    criticalLow: number;
    criticalHigh: number;
  };
  spendingThresholds: {
    dailyWarning: number;
    dailyCritical: number;
    weeklyWarning: number;
    weeklyCritical: number;
  };
  pointsMismatchTolerance: number;
  offerExpiryWarningDays: number;
  tierMilestoneAlertPercent: number;
}

export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  roiThresholds: {
    lowWarning: -20,
    highWarning: 500,
    criticalLow: -50,
    criticalHigh: 1000,
  },
  spendingThresholds: {
    dailyWarning: 1000,
    dailyCritical: 5000,
    weeklyWarning: 5000,
    weeklyCritical: 20000,
  },
  pointsMismatchTolerance: 0.15,
  offerExpiryWarningDays: 14,
  tierMilestoneAlertPercent: 90,
};

export interface PriceHistoryRecord {
  id: string;
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  nights: number;
  destination: string;
  cabinType: string;
  price: number;
  taxesFees: number;
  totalPrice: number;
  freePlay?: number;
  obc?: number;
  offerCode?: string;
  offerName?: string;
  offerId?: string;
  recordedAt: string;
  source: 'offer' | 'cruise' | 'manual';
}

export interface PriceDropAlert {
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  destination: string;
  cabinType: string;
  previousPrice: number;
  currentPrice: number;
  priceDrop: number;
  priceDropPercent: number;
  previousRecordedAt: string;
  currentRecordedAt: string;
  offerId?: string;
  offerName?: string;
}

export interface CompItem {
  id: string;
  category: 'drinks' | 'dining' | 'wifi' | 'gratuities' | 'obc' | 'excursions' | 'other';
  name: string;
  value: number;
  cruiseId?: string;
  createdAt: string;
}

export interface W2GRecord {
  id: string;
  date: string;
  amount: number;
  withheld: number;
  description: string;
  cruiseId?: string;
  cruiseName?: string;
  createdAt: string;
}

export interface TaxSummary {
  totalW2GWinnings: number;
  totalW2GWithheld: number;
  w2gCount: number;
  taxYear: number;
}

export function generateCruiseKey(shipName: string, sailDate: string, cabinType?: string): string {
  const normalizedShip = shipName.toLowerCase().trim().replace(/\s+/g, '-');
  const normalizedCabin = cabinType ? cabinType.toLowerCase().trim().replace(/\s+/g, '-') : 'any';
  return `${normalizedShip}_${sailDate}_${normalizedCabin}`;
}

export type SlotManufacturer = 
  | 'Aristocrat'
  | 'Konami'
  | 'Light & Wonder' 
  | 'IGT'
  | 'Everi'
  | 'Bally'
  | 'Ainsworth'
  | 'AGS'
  | 'Other';

export type MachineVolatility = 'Low' | 'Medium-Low' | 'Medium' | 'Medium-High' | 'High' | 'Very High';

export type CabinetType = 
  | 'Slant Top'
  | 'Standard Upright'
  | 'Upright'
  | 'Video'
  | 'Curved'
  | 'Mechanical'
  | 'Premium'
  | 'Wide Screen'
  | 'Tower'
  | 'Pod'
  | 'Multi-Screen'
  | 'Other';

export type PersistenceType = 'True' | 'Pseudo' | 'None';

export type APRiskLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export interface SlotMachineImage {
  uri: string;
  type: 'user' | 'default';
  uploadedAt?: string;
}

export interface JackpotType {
  name: string;
  minimumBet?: number;
  mustHitBy?: number;
  type: 'fixed' | 'progressive' | 'mystery';
}

export interface APMetadata {
  persistenceType: PersistenceType;
  hasMustHitBy: boolean;
  mhbThresholds?: {
    minor?: number;
    major?: number;
    grand?: number;
    mega?: number;
  };
  entryConditions?: string[];
  exitConditions?: string[];
  risks?: string[];
  recommendedBankroll?: {
    min: number;
    max: number;
  };
  resetValues?: {
    mini?: number;
    minor?: number;
    major?: number;
    grand?: number;
    mega?: number;
  };
  bonusVolatility?: MachineVolatility;
  expectedAPReturn?: number;
  notesAndTips?: string;
}

export interface JackpotResetValues {
  mini?: { min: number; max: number };
  minor?: { min: number; max: number };
  major?: { min: number; max: number };
  grand?: { min: number; max: number };
  mega?: { min: number; max: number };
}

export interface ProgressiveBehavior {
  sharedAcrossBank?: boolean;
  growthRate?: string;
  independentPots?: boolean;
  notes?: string;
}

export interface SpecialMechanics {
  description: string;
  triggers?: string[];
  bonusFeatures?: string[];
  symbolBehavior?: string;
  bestCombos?: string[];
}

export interface BonusGameBehavior {
  description: string;
  features?: string[];
  volatilityNotes?: string;
}

export interface DenominationBehavior {
  denom: string;
  notes: string;
  recommendation?: string;
}

export interface APTriggers {
  primary: string[];
  secondary?: string[];
  visualClues?: string[];
}

export interface WalkAwayConditions {
  conditions: string[];
  reasoning?: string;
}

export interface CruiseShipNotes {
  reelStripDifferences?: string;
  triggerFrequency?: string;
  placement?: string;
  otherNotes?: string;
}

export interface DetailedSlotProfile {
  jackpotResetValues?: JackpotResetValues;
  progressiveBehavior?: ProgressiveBehavior;
  specialMechanics?: SpecialMechanics;
  bonusGameBehavior?: BonusGameBehavior;
  denominationBehavior?: DenominationBehavior[];
  apTriggers?: APTriggers;
  walkAwayConditions?: WalkAwayConditions;
  bestDenominationForAP?: string;
  cruiseShipNotes?: CruiseShipNotes;
  simpleSummary?: string;
}

export interface SlotMachine {
  id: string;
  machineName: string;
  manufacturer: SlotManufacturer;
  gameSeries?: string;
  volatility: MachineVolatility;
  cabinetType: CabinetType;
  releaseYear: number;
  
  rtpRanges?: {
    min: number;
    max: number;
  };
  
  theme?: string;
  basePaytable?: string;
  bonusMechanics?: string[];
  jackpotTypes?: JackpotType[];
  denominationFamilies?: string[];
  
  apMetadata?: APMetadata;
  detailedProfile?: DetailedSlotProfile;
  
  images?: SlotMachineImage[];
  
  shipSpecificNotes?: {
    shipName: string;
    deckLocation?: string;
    notes: string;
    lastSeen?: string;
  }[];
  
  userNotes?: string;
  
  source: 'global' | 'user' | 'youtube';
  isActive: boolean;
  
  createdAt: string;
  updatedAt: string;
  createdBy?: 'system' | 'user';
}

export interface SlotMachineFilter {
  searchQuery?: string;
  manufacturers?: SlotManufacturer[];
  volatility?: MachineVolatility[];
  cabinetTypes?: CabinetType[];
  releaseYears?: {
    min: number;
    max: number;
  };
  persistenceType?: PersistenceType[];
  hasMustHitBy?: boolean;
  hasAPPotential?: boolean;
  ships?: string[];
  sortBy?: 'name' | 'manufacturer' | 'releaseYear' | 'volatility' | 'apRating';
  sortOrder?: 'asc' | 'desc';
}

export interface DeckPlanLocation {
  id: string;
  shipName: string;
  deckNumber: string;
  deckName: string;
  section?: string;
  machineId: string;
  position?: {
    x: number;
    y: number;
  };
  notes?: string;
  lastVerified?: string;
  createdAt: string;
}

export interface MachineEncyclopediaEntry {
  id: string;
  globalMachineId?: string;
  machineName: string;
  manufacturer: SlotManufacturer;
  gameSeries?: string;
  volatility: MachineVolatility;
  cabinetType: CabinetType;
  releaseYear: number | null;
  
  rtpRanges?: {
    min: number;
    max: number;
  };
  
  theme?: string | null;
  description?: string;
  basePaytable?: string;
  bonusMechanics?: string;
  jackpotTypes?: string[];
  denominationFamilies?: string[];
  denominations?: string[];
  
  apMetadata?: APMetadata;
  detailedProfile?: DetailedSlotProfile;
  
  simpleSummary?: string;
  summary?: string;
  coreMechanics?: string;
  apTriggers?: string[];
  walkAway?: string[];
  shipNotes?: string;
  
  jackpotReset?: {
    mini?: string;
    minor?: string;
    major?: string;
    grand?: string;
    mega?: string;
    yummy?: string;
    upsized?: string;
    spicy?: string;
    super?: string;
  };
  
  images?: SlotMachineImage[];
  
  shipAssignments?: {
    shipName: string;
    deckLocations?: string[];
    notes?: string;
    lastSeen?: string;
  }[];
  
  userNotes?: string;
  
  source: 'global' | 'user' | 'youtube' | string;
  source_verbatim?: string[];
  isInMyAtlas: boolean;
  addedToAtlasAt?: string;
  isFavorite?: boolean;
  favoritedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface AddGameWizardData {
  step: 1 | 2 | 3;
  source?: 'global' | 'youtube' | 'manual';
  globalMachineId?: string;
  
  machineName?: string;
  manufacturer?: SlotManufacturer;
  gameSeries?: string;
  volatility?: MachineVolatility;
  cabinetType?: CabinetType;
  releaseYear?: number;
  theme?: string;
  rtpMin?: number;
  rtpMax?: number;
  basePaytable?: string;
  bonusMechanic?: string;
  jackpotTypes?: string[];
  denominationFamilies?: string[];
  
  persistenceType?: PersistenceType;
  hasMustHitBy?: boolean;
  mhbMinor?: number;
  mhbMajor?: number;
  mhbGrand?: number;
  mhbMega?: number;
  entryConditions?: string[];
  exitConditions?: string[];
  risks?: string[];
  bankrollMin?: number;
  bankrollMax?: number;
  resetMinor?: number;
  resetMajor?: number;
  resetGrand?: number;
  resetMega?: number;
  bonusVolatility?: MachineVolatility;
  expectedAPReturn?: number;
  apNotes?: string;
  
  shipName?: string;
  deckLocation?: string;
  shipNotes?: string;
  
  userNotes?: string;
  images?: SlotMachineImage[];
}
