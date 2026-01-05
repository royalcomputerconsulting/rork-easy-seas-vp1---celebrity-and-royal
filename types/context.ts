import type {
  Cruise,
  BookedCruise,
  CasinoOffer,
  CalendarEvent,
  ClubRoyaleProfile,
  FinancialsRecord,
  AnalyticsData,
  FinancialSummary,
  CruiseFilter,
  TierProgress,
  CasinoPerformance,
  PortfolioMetrics,
  Certificate,
  CasinoPayTable,
  OfferValuation,
  ROICalculation,
  WhatIfScenario,
  TierProjection,
  CabinCategory,
} from './models';

export interface LocalData {
  cruises: Cruise[];
  booked: BookedCruise[];
  offers: CasinoOffer[];
  calendar: CalendarEvent[];
  tripit: CalendarEvent[];
  financials: FinancialsRecord[];
  certificates: Certificate[];
  lastImport: string | null;
  clubRoyaleProfile?: ClubRoyaleProfile;
}

export interface AppSettings {
  showTaxesInList: boolean;
  showPricePerNight: boolean;
  priceDropAlerts: boolean;
  dailySummaryNotifications: boolean;
  theme: 'system' | 'light' | 'dark';
  currency: string;
  pointsPerDay: number;
}

export interface AppStateContextValue {
  settings: AppSettings;
  lastImportDate: string | null;
  localData: LocalData;
  hasLocalData: boolean;
  isLoading: boolean;
  userPoints: number;
  clubRoyaleProfile: ClubRoyaleProfile;
  
  updateSettings: (updates: Partial<AppSettings>) => void;
  setLocalData: (data: Partial<LocalData>) => void;
  mergeLocalData: (data: Partial<LocalData>) => void;
  clearLocalData: () => void;
  setUserPoints: (points: number) => void;
  updateUserPoints: (delta: number) => void;
  setClubRoyaleProfile: (profile: ClubRoyaleProfile) => void;
  refreshData: () => Promise<void>;
  cleanExpiredOffers: () => void;
  autoCompletePaidCruises: () => void;
}

export interface CruiseStoreContextValue {
  allCruises: Cruise[];
  bookedCruises: BookedCruise[];
  availableCruises: Cruise[];
  isLoading: boolean;
  
  getCruiseById: (id: string) => Cruise | undefined;
  getCruisesByShip: (shipName: string) => Cruise[];
  getCruisesByDate: (startDate: string, endDate: string) => Cruise[];
  getCruisesByOffer: (offerCode: string) => Cruise[];
  markAsBooked: (cruiseId: string, bookingDetails: Partial<BookedCruise>) => void;
  updateCruise: (cruiseId: string, updates: Partial<Cruise>) => void;
}

export interface FiltersContextValue {
  filters: CruiseFilter;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  
  setFilters: (filters: Partial<CruiseFilter>) => void;
  clearFilters: () => void;
  toggleShipFilter: (shipName: string) => void;
  toggleCabinFilter: (cabinType: string) => void;
  setDateRange: (start: string, end: string) => void;
  clearDateRange: () => void;
}

export interface AnalyticsContextValue {
  analytics: AnalyticsData;
  isLoading: boolean;
  
  getTotalCruises: () => number;
  getTotalNights: () => number;
  getTotalSpent: () => number;
  getTotalPoints: () => number;
  getPortfolioROI: () => number;
  getAveragePricePerNight: () => number;
  getFavoriteShip: () => string | undefined;
  getFavoriteDestination: () => string | undefined;
  
  calculateCruiseROI: (cruise: BookedCruise) => number;
  calculateValueScore: (cruise: Cruise) => number;
  calculateRetailValue: (cruise: Cruise) => number;
}

export interface FinancialsContextValue {
  summary: FinancialSummary;
  records: FinancialsRecord[];
  isCalculating: boolean;
  
  calculateSummary: (cruises: BookedCruise[]) => FinancialSummary;
  getTotalSpent: () => number;
  getTotalDue: () => number;
  getUpcomingPayments: () => { cruiseId: string; amount: number; dueDate: string }[];
  getCategoryBreakdown: () => { category: string; amount: number }[];
}

export interface CasinoStrategyContextValue {
  targetTier: string;
  desiredROI: number;
  dailyBudget: number;
  strategy: 'chase-tier' | 'chase-comps' | 'balanced';
  
  setTargetTier: (tier: string) => void;
  setDesiredROI: (roi: number) => void;
  setDailyBudget: (budget: number) => void;
  setStrategy: (strategy: 'chase-tier' | 'chase-comps' | 'balanced') => void;
}

export interface UserContextValue {
  profile: ClubRoyaleProfile;
  tierProgress: TierProgress;
  pinnacleProgress: TierProgress;
  
  updateProfile: (updates: Partial<ClubRoyaleProfile>) => void;
  updatePoints: (points: number) => void;
  getNightsToTier: (targetTier: string) => number;
}

export interface CelebrityContextValue {
  celebrityOffers: CasinoOffer[];
  celebrityCruises: Cruise[];
  
  getCelebrityOfferById: (id: string) => CasinoOffer | undefined;
  getCelebrityCruiseById: (id: string) => Cruise | undefined;
}

export interface PortfolioContextValue {
  metrics: PortfolioMetrics;
  performance: CasinoPerformance;
  
  getHighROICruises: () => BookedCruise[];
  getMediumROICruises: () => BookedCruise[];
  getLowROICruises: () => BookedCruise[];
}

export interface ValuationContextValue {
  calculateOfferValue: (offer: CasinoOffer) => OfferValuation;
  calculatePayTable: (offer: CasinoOffer) => CasinoPayTable;
  calculateCruiseROI: (cruise: BookedCruise) => ROICalculation;
  getCabinPrice: (item: Cruise | CasinoOffer, cabinType: CabinCategory | string) => number | undefined;
  compareCruiseROI: (cruiseIds: string[]) => ROICalculation[];
}

export interface WhatIfContextValue {
  scenarios: WhatIfScenario[];
  activeScenario: WhatIfScenario | null;
  
  createScenario: (params: Partial<WhatIfScenario>) => WhatIfScenario;
  updateScenario: (id: string, updates: Partial<WhatIfScenario>) => void;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string | null) => void;
  
  runSimulation: (scenario: WhatIfScenario) => WhatIfScenario;
  compareScenarios: (scenarioIds: string[]) => WhatIfScenario[];
}

export interface TierProjectionContextValue {
  currentProjection: TierProjection | null;
  projections: TierProjection[];
  
  calculateProjection: (targetTier: string) => TierProjection;
  getTimeToTier: (tier: string) => { days: number; cruises: number; nights: number };
  getMilestones: () => TierProjection['milestones'];
}
