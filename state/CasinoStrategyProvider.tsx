import { useState, useCallback, useMemo } from "react";
import createContextHook from "@nkzw/create-context-hook";
import type { CasinoOffer, Cruise } from "@/types/models";

interface CasinoStrategy {
  id: string;
  name: string;
  description: string;
  targetPointsPerDay: number;
  recommendedBet: number;
  playTime: number;
  expectedValue: number;
}

interface CasinoStrategyState {
  strategies: CasinoStrategy[];
  selectedStrategy: CasinoStrategy | null;
  dailyTarget: number;
  currentProgress: number;
  
  setSelectedStrategy: (strategy: CasinoStrategy | null) => void;
  setDailyTarget: (target: number) => void;
  updateProgress: (points: number) => void;
  getRecommendedOffers: (offers: CasinoOffer[], cruises: Cruise[]) => CasinoOffer[];
  calculateExpectedValue: (offer: CasinoOffer) => number;
}

const DEFAULT_STRATEGIES: CasinoStrategy[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Low risk, steady points accumulation',
    targetPointsPerDay: 100,
    recommendedBet: 5,
    playTime: 2,
    expectedValue: 0.95,
  },
  {
    id: 'moderate',
    name: 'Moderate',
    description: 'Balanced approach for regular cruisers',
    targetPointsPerDay: 250,
    recommendedBet: 10,
    playTime: 3,
    expectedValue: 0.92,
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'High volume for tier advancement',
    targetPointsPerDay: 500,
    recommendedBet: 25,
    playTime: 4,
    expectedValue: 0.88,
  },
];

export const [CasinoStrategyProvider, useCasinoStrategy] = createContextHook((): CasinoStrategyState => {
  const [selectedStrategy, setSelectedStrategy] = useState<CasinoStrategy | null>(null);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);

  const strategies = useMemo(() => DEFAULT_STRATEGIES, []);

  const updateProgress = useCallback((points: number) => {
    setCurrentProgress(prev => prev + points);
    console.log('[CasinoStrategy] Updated progress:', points);
  }, []);

  const getRecommendedOffers = useCallback((offers: CasinoOffer[], cruises: Cruise[]): CasinoOffer[] => {
    const validOffers = offers.filter(offer => {
      if (offer.status === 'expired' || offer.status === 'used') return false;
      if (offer.expiryDate && new Date(offer.expiryDate) < new Date()) return false;
      return true;
    });

    return validOffers.sort((a, b) => {
      const valueA = (a.freeplayAmount || 0) + (a.obcAmount || 0) + ((a.discountPercent || 0) * 10);
      const valueB = (b.freeplayAmount || 0) + (b.obcAmount || 0) + ((b.discountPercent || 0) * 10);
      return valueB - valueA;
    });
  }, []);

  const calculateExpectedValue = useCallback((offer: CasinoOffer): number => {
    let ev = 0;
    
    if (offer.freeplayAmount) {
      ev += offer.freeplayAmount * 0.9;
    }
    if (offer.obcAmount) {
      ev += offer.obcAmount;
    }
    if (offer.discountPercent) {
      ev += offer.discountPercent * 5;
    }
    
    return ev;
  }, []);

  return {
    strategies,
    selectedStrategy,
    dailyTarget,
    currentProgress,
    setSelectedStrategy,
    setDailyTarget,
    updateProgress,
    getRecommendedOffers,
    calculateExpectedValue,
  };
});
