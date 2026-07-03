import type { BookedCruise, CasinoOffer } from '@/types/models';
import { CLUB_ROYALE_TIERS, getTierByPoints, TIER_ORDER } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS, getLevelByNights, LEVEL_ORDER } from '@/constants/crownAnchor';
import { DOLLARS_PER_POINT } from '@/types/models';


export type ScenarioType = 
  | 'add_cruise'
  | 'remove_cruise'
  | 'change_cabin'
  | 'adjust_spend'
  | 'book_offer'
  | 'custom';

export interface ScenarioInput {
  type: ScenarioType;
  cruiseId?: string;
  newNights?: number;
  newSpend?: number;
  newCabinType?: string;
  offerId?: string;
  customPoints?: number;
  customNights?: number;
}

export interface TierForecast {
  currentTier: string;
  projectedTier: string;
  currentPoints: number;
  projectedPoints: number;
  pointsGained: number;
  currentNights: number;
  projectedNights: number;
  nightsGained: number;
  tierUpgrade: boolean;
  nextTierThreshold: number;
  pointsToNextTier: number;
  monthsToNextTier: number;
  projectedDate: Date | null;
}

export interface LoyaltyForecast {
  currentLevel: string;
  projectedLevel: string;
  currentNights: number;
  projectedNights: number;
  nightsGained: number;
  levelUpgrade: boolean;
  nextLevelThreshold: number;
  nightsToNextLevel: number;
  monthsToNextLevel: number;
  projectedDate: Date | null;
}

export interface ROIProjection {
  totalInvestment: number;
  projectedValue: number;
  projectedROI: number;
  pointsValue: number;
  compValue: number;
  savings: number;
  breakEvenDate: Date | null;
  monthlyROI: number;
  riskAdjustedROI: number;
}

export interface RiskAnalysis {
  overallRisk: 'low' | 'medium' | 'high';
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
  volatility: number;
  confidenceInterval: { low: number; high: number };
}

export interface RiskFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface SimulationResult {
  tierForecast: TierForecast;
  loyaltyForecast: LoyaltyForecast;
  roiProjection: ROIProjection;
  riskAnalysis: RiskAnalysis;
  comparison?: {
    baseline: SimulationResult;
    difference: {
      pointsDiff: number;
      nightsDiff: number;
      roiDiff: number;
      tierChange: boolean;
      levelChange: boolean;
    };
  };
}

export interface PlayerContext {
  currentPoints: number;
  currentNights: number;
  currentTier: string;
  currentLevel: string;
  averagePointsPerNight: number;
  averageNightsPerMonth: number;
  averageSpendPerCruise: number;
}

export function calculateTierForecast(
  playerContext: PlayerContext,
  additionalPoints: number,
  additionalNights: number
): TierForecast {
  const projectedPoints = playerContext.currentPoints + additionalPoints;
  const projectedNights = playerContext.currentNights + additionalNights;
  
  const currentTier = getTierByPoints(playerContext.currentPoints);
  const projectedTier = getTierByPoints(projectedPoints);
  const tierUpgrade = TIER_ORDER.indexOf(projectedTier) > TIER_ORDER.indexOf(currentTier);
  
  const currentTierIndex = TIER_ORDER.indexOf(projectedTier);
  const nextTier = currentTierIndex < TIER_ORDER.length - 1 
    ? TIER_ORDER[currentTierIndex + 1] 
    : null;
  const nextTierThreshold = nextTier ? CLUB_ROYALE_TIERS[nextTier].threshold : 0;
  const pointsToNextTier = nextTier ? Math.max(0, nextTierThreshold - projectedPoints) : 0;
  
  const monthsToNextTier = pointsToNextTier > 0 && playerContext.averagePointsPerNight > 0
    ? Math.ceil(pointsToNextTier / (playerContext.averagePointsPerNight * playerContext.averageNightsPerMonth))
    : 0;
  
  const projectedDate = monthsToNextTier > 0 
    ? new Date(Date.now() + monthsToNextTier * 30 * 24 * 60 * 60 * 1000)
    : null;
  
  return {
    currentTier,
    projectedTier,
    currentPoints: playerContext.currentPoints,
    projectedPoints,
    pointsGained: additionalPoints,
    currentNights: playerContext.currentNights,
    projectedNights,
    nightsGained: additionalNights,
    tierUpgrade,
    nextTierThreshold,
    pointsToNextTier,
    monthsToNextTier,
    projectedDate,
  };
}

export function calculateLoyaltyForecast(
  playerContext: PlayerContext,
  additionalNights: number
): LoyaltyForecast {
  const projectedNights = playerContext.currentNights + additionalNights;
  
  const currentLevel = getLevelByNights(playerContext.currentNights);
  const projectedLevel = getLevelByNights(projectedNights);
  const levelUpgrade = LEVEL_ORDER.indexOf(projectedLevel) > LEVEL_ORDER.indexOf(currentLevel);
  
  const currentLevelIndex = LEVEL_ORDER.indexOf(projectedLevel);
  const nextLevel = currentLevelIndex < LEVEL_ORDER.length - 1 
    ? LEVEL_ORDER[currentLevelIndex + 1] 
    : null;
  const nextLevelThreshold = nextLevel ? CROWN_ANCHOR_LEVELS[nextLevel].cruiseNights : 0;
  const nightsToNextLevel = nextLevel ? Math.max(0, nextLevelThreshold - projectedNights) : 0;
  
  const monthsToNextLevel = nightsToNextLevel > 0 && playerContext.averageNightsPerMonth > 0
    ? Math.ceil(nightsToNextLevel / playerContext.averageNightsPerMonth)
    : 0;
  
  const projectedDate = monthsToNextLevel > 0 
    ? new Date(Date.now() + monthsToNextLevel * 30 * 24 * 60 * 60 * 1000)
    : null;
  
  return {
    currentLevel,
    projectedLevel,
    currentNights: playerContext.currentNights,
    projectedNights,
    nightsGained: additionalNights,
    levelUpgrade,
    nextLevelThreshold,
    nightsToNextLevel,
    monthsToNextLevel,
    projectedDate,
  };
}

export function calculateROIProjection(
  totalSpend: number,
  retailValue: number,
  pointsEarned: number,
  compValue: number = 0,
  timeHorizonMonths: number = 12
): ROIProjection {
  const pointsValue = pointsEarned * DOLLARS_PER_POINT;
  const savings = Math.max(0, retailValue - totalSpend);
  const totalValue = retailValue + pointsValue + compValue;
  const projectedROI = totalSpend > 0 ? ((savings + pointsValue + compValue) / totalSpend) * 100 : 0;
  
  const monthlyROI = projectedROI / Math.max(1, timeHorizonMonths);
  
  const riskFactor = 0.85;
  const riskAdjustedROI = projectedROI * riskFactor;
  
  const breakEvenDate = totalSpend > retailValue 
    ? new Date(Date.now() + ((totalSpend - retailValue) / (monthlyROI * totalSpend / 100)) * 30 * 24 * 60 * 60 * 1000)
    : null;
  
  return {
    totalInvestment: totalSpend,
    projectedValue: totalValue,
    projectedROI,
    pointsValue,
    compValue,
    savings,
    breakEvenDate,
    monthlyROI,
    riskAdjustedROI,
  };
}

export function calculateRiskAnalysis(
  bookedCruises: BookedCruise[],
  projectedROI: number,
  tierForecast: TierForecast
): RiskAnalysis {
  const factors: RiskFactor[] = [];
  let riskScore = 50;
  
  if (bookedCruises.length >= 5) {
    factors.push({
      name: 'Portfolio Diversity',
      impact: 'positive',
      weight: 15,
      description: 'Well-diversified cruise portfolio',
    });
    riskScore -= 10;
  } else if (bookedCruises.length < 2) {
    factors.push({
      name: 'Portfolio Concentration',
      impact: 'negative',
      weight: 15,
      description: 'Limited cruise experience may reduce reliability',
    });
    riskScore += 10;
  } else {
    factors.push({
      name: 'Portfolio Size',
      impact: 'neutral',
      weight: 10,
      description: 'Moderate cruise portfolio',
    });
  }
  
  if (projectedROI >= 50) {
    factors.push({
      name: 'Strong ROI',
      impact: 'positive',
      weight: 20,
      description: 'Excellent return on investment potential',
    });
    riskScore -= 15;
  } else if (projectedROI < 10) {
    factors.push({
      name: 'Low ROI',
      impact: 'negative',
      weight: 20,
      description: 'Returns may not justify investment',
    });
    riskScore += 15;
  }
  
  if (tierForecast.tierUpgrade) {
    factors.push({
      name: 'Tier Advancement',
      impact: 'positive',
      weight: 15,
      description: 'On track for tier upgrade with enhanced benefits',
    });
    riskScore -= 10;
  }
  
  if (tierForecast.pointsToNextTier > 50000) {
    factors.push({
      name: 'Long Tier Path',
      impact: 'neutral',
      weight: 10,
      description: 'Significant investment needed for next tier',
    });
    riskScore += 5;
  }
  
  const totalSpend = bookedCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
  if (totalSpend > 50000) {
    factors.push({
      name: 'High Commitment',
      impact: 'neutral',
      weight: 10,
      description: 'Substantial financial commitment',
    });
    riskScore += 5;
  }
  
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  const overallRisk: 'low' | 'medium' | 'high' = 
    riskScore < 35 ? 'low' : 
    riskScore < 65 ? 'medium' : 
    'high';
  
  const recommendations: string[] = [];
  
  if (overallRisk === 'high') {
    recommendations.push('Consider diversifying with different ship classes');
    recommendations.push('Look for higher-value offers to improve ROI');
    recommendations.push('Focus on earning points through high-return cruises');
  } else if (overallRisk === 'medium') {
    recommendations.push('Maintain current cruise frequency for steady progress');
    recommendations.push('Watch for exclusive offers to boost value');
  } else {
    recommendations.push('Excellent position - consider optimizing for tier advancement');
    recommendations.push('Look for premium experiences within budget');
  }
  
  const volatility = Math.abs(projectedROI - 25) / 100;
  const confidenceMargin = riskScore * 0.5;
  
  return {
    overallRisk,
    riskScore,
    factors,
    recommendations,
    volatility,
    confidenceInterval: {
      low: projectedROI - confidenceMargin,
      high: projectedROI + confidenceMargin,
    },
  };
}

export function runSimulation(
  playerContext: PlayerContext,
  bookedCruises: BookedCruise[],
  scenario: ScenarioInput,
  offers: CasinoOffer[] = []
): SimulationResult {
  let additionalPoints = 0;
  let additionalNights = 0;
  let additionalSpend = 0;
  let additionalRetailValue = 0;
  let additionalCompValue = 0;

  switch (scenario.type) {
    case 'add_cruise':
      additionalNights = scenario.newNights || 7;
      additionalPoints = additionalNights * playerContext.averagePointsPerNight;
      additionalSpend = scenario.newSpend || playerContext.averageSpendPerCruise;
      additionalRetailValue = additionalSpend * 1.3;
      break;
      
    case 'remove_cruise':
      if (scenario.cruiseId) {
        const cruise = bookedCruises.find(c => c.id === scenario.cruiseId);
        if (cruise) {
          additionalNights = -(cruise.nights || 0);
          additionalPoints = -(cruise.earnedPoints || cruise.casinoPoints || additionalNights * playerContext.averagePointsPerNight);
          additionalSpend = -(cruise.totalPrice || cruise.price || 0);
        }
      }
      break;
      
    case 'change_cabin':
      const cabinMultipliers: Record<string, number> = {
        Interior: 0.8,
        Oceanview: 1.0,
        Balcony: 1.3,
        Suite: 2.0,
      };
      const multiplier = cabinMultipliers[scenario.newCabinType || 'Balcony'] || 1.0;
      additionalSpend = (playerContext.averageSpendPerCruise * multiplier) - playerContext.averageSpendPerCruise;
      additionalPoints = Math.floor(additionalSpend * 0.5);
      break;
      
    case 'book_offer':
      if (scenario.offerId) {
        const offer = offers.find(o => o.id === scenario.offerId);
        if (offer) {
          additionalNights = offer.minNights || 7;
          additionalPoints = additionalNights * playerContext.averagePointsPerNight;
          additionalCompValue = (offer.freeplayAmount || 0) + (offer.obcAmount || 0);
          additionalSpend = playerContext.averageSpendPerCruise * (1 - (offer.discountPercent || 0) / 100);
          additionalRetailValue = playerContext.averageSpendPerCruise;
        }
      }
      break;
      
    case 'custom':
      additionalPoints = scenario.customPoints || 0;
      additionalNights = scenario.customNights || 0;
      additionalSpend = scenario.newSpend || 0;
      additionalRetailValue = additionalSpend * 1.2;
      break;
      
    default:
      break;
  }

  const tierForecast = calculateTierForecast(playerContext, additionalPoints, additionalNights);
  const loyaltyForecast = calculateLoyaltyForecast(playerContext, additionalNights);
  
  const existingSpend = bookedCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
  const existingRetail = bookedCruises.reduce((sum, c) => sum + (c.retailValue || c.originalPrice || c.totalPrice || 0), 0);
  const existingPoints = bookedCruises.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
  const existingComp = bookedCruises.reduce((sum, c) => sum + (c.compValue || 0), 0);
  
  const roiProjection = calculateROIProjection(
    existingSpend + additionalSpend,
    existingRetail + additionalRetailValue,
    existingPoints + additionalPoints,
    existingComp + additionalCompValue
  );
  
  const riskAnalysis = calculateRiskAnalysis(bookedCruises, roiProjection.projectedROI, tierForecast);

  return {
    tierForecast,
    loyaltyForecast,
    roiProjection,
    riskAnalysis,
  };
}

export function runComparisonSimulation(
  playerContext: PlayerContext,
  bookedCruises: BookedCruise[],
  scenario: ScenarioInput,
  offers: CasinoOffer[] = []
): SimulationResult {
  const baselineScenario: ScenarioInput = { type: 'custom', customPoints: 0, customNights: 0 };
  const baseline = runSimulation(playerContext, bookedCruises, baselineScenario, offers);
  const projected = runSimulation(playerContext, bookedCruises, scenario, offers);

  return {
    ...projected,
    comparison: {
      baseline,
      difference: {
        pointsDiff: projected.tierForecast.projectedPoints - baseline.tierForecast.projectedPoints,
        nightsDiff: projected.loyaltyForecast.projectedNights - baseline.loyaltyForecast.projectedNights,
        roiDiff: projected.roiProjection.projectedROI - baseline.roiProjection.projectedROI,
        tierChange: projected.tierForecast.projectedTier !== baseline.tierForecast.projectedTier,
        levelChange: projected.loyaltyForecast.projectedLevel !== baseline.loyaltyForecast.projectedLevel,
      },
    },
  };
}

export function generateTimelineProjections(
  playerContext: PlayerContext,
  bookedCruises: BookedCruise[],
  monthsAhead: number = 24
): {
  month: number;
  points: number;
  nights: number;
  tier: string;
  level: string;
}[] {
  const projections: {
    month: number;
    points: number;
    nights: number;
    tier: string;
    level: string;
  }[] = [];

  let currentPoints = playerContext.currentPoints;
  let currentNights = playerContext.currentNights;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  const nextAprilFirst = new Date(currentYear, 3, 1);
  if (today >= nextAprilFirst) {
    nextAprilFirst.setFullYear(currentYear + 1);
  }
  
  const monthsUntilExpiration = 
    (nextAprilFirst.getFullYear() - currentYear) * 12 + 
    (nextAprilFirst.getMonth() - currentMonth);

  for (let month = 0; month <= monthsAhead; month++) {
    if (month === monthsUntilExpiration && month > 0) {
      currentPoints = 0;
    }
    
    if (month > monthsUntilExpiration && (month - monthsUntilExpiration) % 12 === 0) {
      currentPoints = 0;
    }
    
    projections.push({
      month,
      points: currentPoints,
      nights: currentNights,
      tier: getTierByPoints(currentPoints),
      level: getLevelByNights(currentNights),
    });

    currentPoints += playerContext.averagePointsPerNight * playerContext.averageNightsPerMonth;
    currentNights += playerContext.averageNightsPerMonth;
  }

  return projections;
}
