import { useMemo, useCallback } from "react";
import createContextHook from "@nkzw/create-context-hook";
import type { AnalyticsData, BookedCruise, Cruise, CasinoOffer } from "@/types/models";
import { useCruiseStore } from "./CruiseStore";
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

const DEFAULT_CASINO_ANALYTICS: CasinoAnalytics = {
  totalCoinIn: 0,
  totalWinLoss: 0,
  totalPointsEarned: 0,
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
  const { bookedCruises: storedBookedCruises, cruises, casinoOffers, isLoading } = useCruiseStore();
  const { clubRoyalePoints: loyaltyClubRoyalePoints } = useLoyalty();

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
    // IMPORTANT: loyaltyClubRoyalePoints is the CURRENT Club Royale point balance
    // This is NOT the sum of all cruise points - it's the actual account balance
    const currentPointBalance = loyaltyClubRoyalePoints || 0;
    
    // Sum points from completed cruises for historical calculations
    let cruisePointsSum = 0;
    let totalWinLoss = 0;

    completedCruises.forEach((cruise: BookedCruise) => {
      const points = cruise.earnedPoints || cruise.casinoPoints || 0;
      cruisePointsSum += points;
      
      const winnings = cruise.winnings || 0;
      totalWinLoss += winnings;
    });

    // For display purposes:
    // - totalPointsEarned should show CURRENT balance (not historical sum)
    // - totalCoinIn is calculated from current balance × $5
    const totalPointsEarned = currentPointBalance;
    // Total Coin-In = Current Points × $5 (standard formula)
    const totalCoinIn = totalPointsEarned * DOLLARS_PER_POINT;
    const netResult = totalWinLoss;
    const count = completedCruises.length;

    // For averages, use the cruise points sum divided by count
    // This gives a more accurate per-cruise average
    const avgPointsPerCruise = count > 0 ? cruisePointsSum / count : 0;
    const avgCoinInPerCruise = avgPointsPerCruise * DOLLARS_PER_POINT;

    console.log('[CasinoAnalytics] Calculated:', {
      completedCruisesCount: count,
      currentPointBalance,
      cruisePointsSum,
      totalPointsEarned,
      totalCoinIn,
      totalWinLoss,
      netResult,
      avgPointsPerCruise,
      avgCoinInPerCruise,
    });

    return {
      totalCoinIn,
      totalWinLoss,
      totalPointsEarned,
      netResult,
      avgCoinInPerCruise,
      avgWinLossPerCruise: count > 0 ? totalWinLoss / count : 0,
      avgPointsPerCruise,
      completedCruisesCount: count,
    };
  }, [completedCruises, loyaltyClubRoyalePoints]);

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

  const getTotalCruises = () => analytics.totalCruises;
  const getTotalNights = () => analytics.totalNights;
  const getTotalSpent = () => analytics.totalSpent;
  const getAveragePricePerNight = () => analytics.averagePricePerNight;
  const getFavoriteShip = () => analytics.favoriteShip;
  const getFavoriteDestination = () => analytics.favoriteDestination;
  
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

  return {
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
  };
});
