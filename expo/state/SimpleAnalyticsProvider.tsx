import { useMemo, useCallback } from "react";
import createContextHook from "@nkzw/create-context-hook";
import type { AnalyticsData, BookedCruise, Cruise, CasinoOffer } from "@/types/models";
import { useCoreData } from "./CoreDataProvider";
import { useLoyalty } from "./LoyaltyProvider";
import { 
  calculateCruiseValue, 
  calculateOfferValue, 
  calculatePortfolioValue,
  calculateROIFromValue,
  type ValueBreakdown 
} from "@/lib/valueCalculator";
import { 
  calculateCasinoAvailabilityForCruise,
  type CruiseCasinoSummary 
} from "@/lib/casinoAvailability";

export interface CasinoAnalytics {
  totalCoinIn: number;
  totalWinLoss: number;
  totalPointsEarned: number;
  historicalPointsEarned: number;
  currentPointBalance: number;
  currentStatusTier: string;
  historicalTier: string;
  pointBalanceSource: 'api' | 'manual' | 'historical';
  seasonStartDate: string;
  nextResetDate: string;
  netResult: number;
  avgCoinInPerCruise: number;
  avgWinLossPerCruise: number;
  avgPointsPerCruise: number;
  completedCruisesCount: number;
}

export interface PortfolioValueMetrics {
  totalRetailValue: number;
  totalAmountPaid: number;
  totalCompValue: number;
  totalSavings: number;
  totalCoinIn: number;
  avgROI: number;
}

interface SimpleAnalyticsState {
  analytics: AnalyticsData;
  casinoAnalytics: CasinoAnalytics;
  portfolioMetrics: PortfolioValueMetrics;
  completedCruises: BookedCruise[];
  isLoading: boolean;
  
  getTotalCruises: () => number;
  getTotalNights: () => number;
  getTotalSpent: () => number;
  getAveragePricePerNight: () => number;
  getFavoriteShip: () => string | undefined;
  getFavoriteDestination: () => string | undefined;
  
  getCruiseValueBreakdown: (cruise: Cruise | BookedCruise) => ValueBreakdown;
  getOfferValueBreakdown: (offer: CasinoOffer) => ValueBreakdown;
  getCruiseCasinoAvailability: (cruise: Cruise | BookedCruise) => CruiseCasinoSummary;
  calculateCruiseROI: (cruiseId: string, winnings?: number) => { roi: number; roiPercentage: number };
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalSpent: 0,
  totalSaved: 0,
  totalCruises: 0,
  totalNights: 0,
  totalPoints: 0,
  totalPortTaxes: 0,
  portfolioROI: 0,
  averagePricePerNight: 0,
  averageROI: 0,
  monthlySpending: [],
  yearlySpending: [],
  cabinTypeDistribution: [],
  destinationDistribution: [],
  roiByMonth: [],
  pointsByMonth: [],
};

const _DEFAULT_CASINO_ANALYTICS: CasinoAnalytics = {
  totalCoinIn: 0,
  totalWinLoss: 0,
  totalPointsEarned: 0,
  historicalPointsEarned: 0,
  currentPointBalance: 0,
  currentStatusTier: 'Choice',
  historicalTier: 'Choice',
  pointBalanceSource: 'historical',
  seasonStartDate: '',
  nextResetDate: '',
  netResult: 0,
  avgCoinInPerCruise: 0,
  avgWinLossPerCruise: 0,
  avgPointsPerCruise: 0,
  completedCruisesCount: 0,
};

const DEFAULT_PORTFOLIO_METRICS: PortfolioValueMetrics = {
  totalRetailValue: 0,
  totalAmountPaid: 0,
  totalCompValue: 0,
  totalSavings: 0,
  totalCoinIn: 0,
  avgROI: 0,
};

const DOLLARS_PER_POINT = 5;

export const [SimpleAnalyticsProvider, useSimpleAnalytics] = createContextHook((): SimpleAnalyticsState => {
  const { bookedCruises: storedBookedCruises, cruises, casinoOffers, isLoading } = useCoreData();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    clubRoyaleHistoricalPoints,
    clubRoyaleHistoricalTier,
    clubRoyalePointsSource,
    clubRoyaleSeasonStartDate,
    clubRoyaleNextResetDate,
  } = useLoyalty();

  const bookedCruises = useMemo((): BookedCruise[] => {
    if (storedBookedCruises && storedBookedCruises.length > 0) {
      return storedBookedCruises;
    }
    console.log('[SimpleAnalytics] No booked cruises available');
    return [];
  }, [storedBookedCruises]);

  const completedCruises = useMemo((): BookedCruise[] => {
    const today = new Date();
    const completed = bookedCruises.filter(cruise => {
      if (cruise.completionState === 'completed' || cruise.status === 'completed') {
        return true;
      }
      if (cruise.returnDate) {
        const returnDate = new Date(cruise.returnDate);
        return returnDate < today;
      }
      return false;
    });
    console.log('[SimpleAnalytics] Completed cruises:', completed.length, 'of', bookedCruises.length);
    return completed;
  }, [bookedCruises]);

  const casinoAnalytics = useMemo((): CasinoAnalytics => {
    const currentPointBalance = loyaltyClubRoyalePoints || 0;
    let cruisePointsSum = 0;
    let totalWinLoss = 0;

    completedCruises.forEach((cruise: BookedCruise) => {
      const points = cruise.earnedPoints || cruise.casinoPoints || 0;
      cruisePointsSum += points;

      const winnings = cruise.winnings || 0;
      totalWinLoss += winnings;
    });

    const historicalPointsEarned = clubRoyaleHistoricalPoints > 0 ? clubRoyaleHistoricalPoints : cruisePointsSum;
    const totalPointsEarned = historicalPointsEarned;
    const totalCoinIn = historicalPointsEarned * DOLLARS_PER_POINT;
    const netResult = totalWinLoss;
    const count = completedCruises.length;
    const avgPointsPerCruise = count > 0 ? historicalPointsEarned / count : 0;
    const avgCoinInPerCruise = avgPointsPerCruise * DOLLARS_PER_POINT;
    const seasonStartDate = clubRoyaleSeasonStartDate.toISOString();
    const nextResetDate = clubRoyaleNextResetDate.toISOString();

    console.log('[CasinoAnalytics] Calculated:', {
      completedCruisesCount: count,
      currentPointBalance,
      historicalPointsEarned,
      totalCoinIn,
      totalWinLoss,
      netResult,
      avgPointsPerCruise,
      avgCoinInPerCruise,
      currentStatusTier: loyaltyClubRoyaleTier,
      historicalTier: clubRoyaleHistoricalTier,
      pointBalanceSource: clubRoyalePointsSource,
      seasonStartDate,
      nextResetDate,
    });

    return {
      totalCoinIn,
      totalWinLoss,
      totalPointsEarned,
      historicalPointsEarned,
      currentPointBalance,
      currentStatusTier: loyaltyClubRoyaleTier,
      historicalTier: clubRoyaleHistoricalTier,
      pointBalanceSource: clubRoyalePointsSource,
      seasonStartDate,
      nextResetDate,
      netResult,
      avgCoinInPerCruise,
      avgWinLossPerCruise: count > 0 ? totalWinLoss / count : 0,
      avgPointsPerCruise,
      completedCruisesCount: count,
    };
  }, [
    clubRoyaleHistoricalPoints,
    clubRoyaleHistoricalTier,
    clubRoyaleNextResetDate,
    clubRoyalePointsSource,
    clubRoyaleSeasonStartDate,
    completedCruises,
    loyaltyClubRoyalePoints,
    loyaltyClubRoyaleTier,
  ]);

  const analytics = useMemo((): AnalyticsData => {
    if (bookedCruises.length === 0) {
      return DEFAULT_ANALYTICS;
    }

    let totalSpent = 0;
    let totalSaved = 0;
    let totalNights = 0;
    let totalPoints = 0;
    let totalPortTaxes = 0;
    let totalRetailValue = 0;
    const shipCounts: Record<string, number> = {};
    const destinationCounts: Record<string, number> = {};
    const cabinCounts: Record<string, number> = {};
    const monthlySpending: Record<string, number> = {};
    const yearlySpending: Record<string, number> = {};
    const roiByMonth: Record<string, number[]> = {};
    const pointsByMonth: Record<string, number> = {};

    bookedCruises.forEach((cruise: BookedCruise) => {
      totalNights += cruise.nights || 0;
      
      const price = cruise.totalPrice || cruise.price || 0;
      totalSpent += price;

      if (cruise.originalPrice && cruise.price) {
        const savings = cruise.originalPrice - cruise.price;
        if (savings > 0) {
          totalSaved += savings;
        }
      }

      if (cruise.shipName) {
        shipCounts[cruise.shipName] = (shipCounts[cruise.shipName] || 0) + 1;
      }

      if (cruise.destination) {
        destinationCounts[cruise.destination] = (destinationCounts[cruise.destination] || 0) + 1;
      }

      if (cruise.cabinType) {
        cabinCounts[cruise.cabinType] = (cabinCounts[cruise.cabinType] || 0) + 1;
      }

      if (cruise.taxes) {
        totalPortTaxes += cruise.taxes;
      }

      if (cruise.earnedPoints || cruise.casinoPoints) {
        const points = cruise.earnedPoints || cruise.casinoPoints || 0;
        totalPoints += points;
      }

      if (cruise.retailValue || cruise.originalPrice) {
        totalRetailValue += cruise.retailValue || cruise.originalPrice || 0;
      }

      if (cruise.sailDate) {
        const date = new Date(cruise.sailDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const yearKey = `${date.getFullYear()}`;
        
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + price;
        yearlySpending[yearKey] = (yearlySpending[yearKey] || 0) + price;
        
        const cruiseROI = cruise.roi || (totalRetailValue > 0 && price > 0 ? ((totalRetailValue - price) / price) * 100 : 0);
        if (!roiByMonth[monthKey]) roiByMonth[monthKey] = [];
        roiByMonth[monthKey].push(cruiseROI);
        
        const points = cruise.earnedPoints || cruise.casinoPoints || 0;
        pointsByMonth[monthKey] = (pointsByMonth[monthKey] || 0) + points;
      }
    });

    const favoriteShip = Object.entries(shipCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const favoriteDestination = Object.entries(destinationCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    const averagePricePerNight = totalNights > 0 ? totalSpent / totalNights : 0;
    // ROI = (Total Value Received - Total Cost) / Total Cost * 100
    // This correctly measures return ON investment
    const portfolioROI = totalSpent > 0 ? ((totalRetailValue - totalSpent) / totalSpent) * 100 : 0;
    // Average ROI per cruise doesn't make sense to divide again
    const averageROI = portfolioROI;

    console.log('[Analytics] Calculated analytics:', {
      totalCruises: bookedCruises.length,
      totalNights,
      totalSpent,
      totalSaved,
      favoriteShip,
      favoriteDestination,
    });

    return {
      totalSpent,
      totalSaved,
      totalCruises: bookedCruises.length,
      totalNights,
      totalPoints,
      totalPortTaxes,
      portfolioROI,
      averagePricePerNight,
      averageROI,
      favoriteShip,
      favoriteDestination,
      monthlySpending: Object.entries(monthlySpending).map(([month, amount]) => ({ month, amount })),
      yearlySpending: Object.entries(yearlySpending).map(([year, amount]) => ({ year, amount })),
      cabinTypeDistribution: Object.entries(cabinCounts).map(([type, count]) => ({ type, count })),
      destinationDistribution: Object.entries(destinationCounts).map(([destination, count]) => ({ destination, count })),
      roiByMonth: Object.entries(roiByMonth).map(([month, rois]) => ({ month, roi: rois.reduce((a, b) => a + b, 0) / rois.length })),
      pointsByMonth: Object.entries(pointsByMonth).map(([month, points]) => ({ month, points })),
    };
  }, [bookedCruises]);

  const portfolioMetrics = useMemo((): PortfolioValueMetrics => {
    if (completedCruises.length === 0) {
      return DEFAULT_PORTFOLIO_METRICS;
    }
    
    const portfolioValue = calculatePortfolioValue(completedCruises);
    
    console.log('[SimpleAnalytics] Portfolio metrics calculated:', portfolioValue);
    
    return {
      totalRetailValue: portfolioValue.totalRetailValue,
      totalAmountPaid: portfolioValue.totalAmountPaid,
      totalCompValue: portfolioValue.totalCompValue,
      totalSavings: portfolioValue.totalSavings,
      totalCoinIn: portfolioValue.totalCoinIn,
      avgROI: portfolioValue.avgROI,
    };
  }, [completedCruises]);

  const getTotalCruises = useCallback(() => analytics.totalCruises, [analytics.totalCruises]);
  const getTotalNights = useCallback(() => analytics.totalNights, [analytics.totalNights]);
  const getTotalSpent = useCallback(() => analytics.totalSpent, [analytics.totalSpent]);
  const getAveragePricePerNight = useCallback(() => analytics.averagePricePerNight, [analytics.averagePricePerNight]);
  const getFavoriteShip = useCallback(() => analytics.favoriteShip, [analytics.favoriteShip]);
  const getFavoriteDestination = useCallback(() => analytics.favoriteDestination, [analytics.favoriteDestination]);
  
  const getCruiseValueBreakdown = useCallback((cruise: Cruise | BookedCruise): ValueBreakdown => {
    return calculateCruiseValue(cruise);
  }, []);
  
  const getOfferValueBreakdown = useCallback((offer: CasinoOffer): ValueBreakdown => {
    return calculateOfferValue(offer);
  }, []);
  
  const getCruiseCasinoAvailability = useCallback((cruise: Cruise | BookedCruise): CruiseCasinoSummary => {
    return calculateCasinoAvailabilityForCruise(cruise, casinoOffers);
  }, [casinoOffers]);
  
  const calculateCruiseROI = useCallback((cruiseId: string, winnings?: number): { roi: number; roiPercentage: number } => {
    const cruise = bookedCruises.find(c => c.id === cruiseId) || cruises.find(c => c.id === cruiseId);
    if (!cruise) {
      return { roi: 0, roiPercentage: 0 };
    }
    
    const breakdown = calculateCruiseValue(cruise);
    const cruiseWinnings = winnings ?? (cruise as BookedCruise).winnings ?? 0;
    
    return calculateROIFromValue(
      breakdown.totalRetailValue,
      cruiseWinnings,
      breakdown.amountPaid
    );
  }, [bookedCruises, cruises]);

  return useMemo(() => ({
    analytics,
    casinoAnalytics,
    portfolioMetrics,
    completedCruises,
    isLoading,
    getTotalCruises,
    getTotalNights,
    getTotalSpent,
    getAveragePricePerNight,
    getFavoriteShip,
    getFavoriteDestination,
    getCruiseValueBreakdown,
    getOfferValueBreakdown,
    getCruiseCasinoAvailability,
    calculateCruiseROI,
  }), [analytics, casinoAnalytics, portfolioMetrics, completedCruises, isLoading, getTotalCruises, getTotalNights, getTotalSpent, getAveragePricePerNight, getFavoriteShip, getFavoriteDestination, getCruiseValueBreakdown, getOfferValueBreakdown, getCruiseCasinoAvailability, calculateCruiseROI]);
});
