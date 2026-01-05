import type { BookedCruise, Cruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';

export interface CasinoHoursEstimate {
  totalCasinoHours: number;
  hoursPerCruise: number;
  avgHoursPerDay: number;
  seaDays: number;
  portDays: number;
  casinoOpenDays: number;
  estimatedSessionCount: number;
  assumptions: string[];
}

export interface TheoreticalLoss {
  theoreticalLoss: number;
  theoreticalLossPerHour: number;
  theoreticalLossPerCruise: number;
  avgBetSize: number;
  handsPerHour: number;
  houseEdge: number;
  totalCoinIn: number;
  totalPoints: number;
  effectiveLoss: number;
  pointValue: number;
  netTheoAfterPointValue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  assumptions: string[];
}

export interface PredictiveScore {
  score: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  projectedTierUpgrade: string | null;
  projectedUpgradeDate: Date | null;
  
  factors: {
    avgDailyTheoretical: number;
    consistency: number;
    cruiseFrequency: number;
    totalCoinIn: number;
    avgBetSize: number;
    playTimeHours: number;
  };
  
  projections: {
    nextCruiseExpectedTheo: number;
    yearlyProjectedTheo: number;
    projectedOfferValue: number;
  };
  
  recommendations: string[];
  hostValueIndicator: 'low' | 'medium' | 'high' | 'vip';
}

export const GAME_HOUSE_EDGES: Record<string, number> = {
  'Slots': 0.08,
  'Video Poker (Jacks or Better)': 0.005,
  'Video Poker (Other)': 0.02,
  'Blackjack (Basic Strategy)': 0.005,
  'Blackjack (Average Player)': 0.015,
  'Craps (Pass/Don\'t Pass)': 0.014,
  'Craps (Field)': 0.055,
  'Roulette (Double Zero)': 0.053,
  'Baccarat (Banker)': 0.0106,
  'Baccarat (Player)': 0.0124,
  'Three Card Poker': 0.035,
  'Let It Ride': 0.035,
  'Caribbean Stud': 0.052,
  'Pai Gow Poker': 0.026,
  'Casino War': 0.029,
};

export const HANDS_PER_HOUR: Record<string, number> = {
  'Slots': 600,
  'Video Poker': 400,
  'Blackjack': 70,
  'Craps': 100,
  'Roulette': 35,
  'Baccarat': 70,
  'Three Card Poker': 50,
  'Let It Ride': 40,
  'Caribbean Stud': 40,
  'Pai Gow Poker': 30,
  'Casino War': 65,
};

export function estimateCasinoHours(
  cruises: (Cruise | BookedCruise)[],
  avgSessionHoursPerDay: number = 3,
  playOnPortDays: boolean = true
): CasinoHoursEstimate {
  console.log('[CasinoCalculator] Estimating casino hours for', cruises.length, 'cruises');

  let totalSeaDays = 0;
  let totalPortDays = 0;
  let totalCasinoOpenDays = 0;
  let totalNights = 0;

  cruises.forEach(cruise => {
    const nights = cruise.nights || 7;
    totalNights += nights;
    
    const seaDays = cruise.seaDays ?? Math.ceil(nights * 0.4);
    const portDays = cruise.portDays ?? (nights - seaDays);
    const casinoOpen = cruise.casinoOpenDays ?? (playOnPortDays ? nights : seaDays);
    
    totalSeaDays += seaDays;
    totalPortDays += portDays;
    totalCasinoOpenDays += casinoOpen;
  });

  const portPlayFactor = playOnPortDays ? 0.5 : 0;
  const effectiveCasinoHours = (totalSeaDays * avgSessionHoursPerDay) + 
                               (totalPortDays * avgSessionHoursPerDay * portPlayFactor);
  
  const totalCasinoHours = Math.round(effectiveCasinoHours);
  const hoursPerCruise = cruises.length > 0 ? totalCasinoHours / cruises.length : 0;
  const avgHoursPerDay = totalNights > 0 ? totalCasinoHours / totalNights : 0;
  const estimatedSessionCount = Math.round(totalCasinoHours / avgSessionHoursPerDay);

  const assumptions = [
    `Average ${avgSessionHoursPerDay} hours of play per active casino day`,
    playOnPortDays 
      ? 'Playing on port days at 50% of sea day rate' 
      : 'No casino play on port days',
    `${totalSeaDays} sea days, ${totalPortDays} port days across ${cruises.length} cruise(s)`,
    'Casino typically operates 16+ hours per day at sea',
  ];

  console.log('[CasinoCalculator] Hours estimate:', { totalCasinoHours, hoursPerCruise, avgHoursPerDay });

  return {
    totalCasinoHours,
    hoursPerCruise,
    avgHoursPerDay,
    seaDays: totalSeaDays,
    portDays: totalPortDays,
    casinoOpenDays: totalCasinoOpenDays,
    estimatedSessionCount,
    assumptions,
  };
}

export function calculateTheoreticalLoss(
  totalCoinIn: number,
  primaryGame: string = 'Slots',
  avgBetSize: number = 25,
  hoursPlayed?: number
): TheoreticalLoss {
  console.log('[CasinoCalculator] Calculating theoretical loss:', { totalCoinIn, primaryGame, avgBetSize });

  const houseEdge = GAME_HOUSE_EDGES[primaryGame] || GAME_HOUSE_EDGES['Slots'];
  const handsPerHour = HANDS_PER_HOUR[primaryGame.split(' ')[0]] || HANDS_PER_HOUR['Slots'];

  const theoreticalLoss = totalCoinIn * houseEdge;

  const estimatedHours = hoursPlayed || (totalCoinIn / (avgBetSize * handsPerHour));
  const theoreticalLossPerHour = estimatedHours > 0 ? theoreticalLoss / estimatedHours : 0;
  const theoreticalLossPerCruise = theoreticalLoss;

  const totalPoints = Math.floor(totalCoinIn / DOLLARS_PER_POINT);
  const pointValue = totalPoints * 0.01;

  const netTheoAfterPointValue = theoreticalLoss - pointValue;
  const effectiveLoss = Math.max(0, netTheoAfterPointValue);

  let riskLevel: 'low' | 'medium' | 'high' | 'very-high' = 'low';
  if (theoreticalLoss > 5000) riskLevel = 'very-high';
  else if (theoreticalLoss > 2000) riskLevel = 'high';
  else if (theoreticalLoss > 500) riskLevel = 'medium';

  const assumptions = [
    `${primaryGame} with ${(houseEdge * 100).toFixed(2)}% house edge`,
    `Average bet size: $${avgBetSize}`,
    `Approximately ${handsPerHour} hands/spins per hour`,
    `Points earn rate: 1 point per $${DOLLARS_PER_POINT} coin-in`,
    `Point value estimated at $0.01 per point`,
    `Estimated ${estimatedHours.toFixed(1)} hours of play`,
  ];

  console.log('[CasinoCalculator] Theoretical loss result:', { theoreticalLoss, netTheoAfterPointValue, riskLevel });

  return {
    theoreticalLoss,
    theoreticalLossPerHour,
    theoreticalLossPerCruise,
    avgBetSize,
    handsPerHour,
    houseEdge,
    totalCoinIn,
    totalPoints,
    effectiveLoss,
    pointValue,
    netTheoAfterPointValue,
    riskLevel,
    assumptions,
  };
}

export function calculateTheoreticalFromPoints(
  points: number,
  primaryGame: string = 'Slots',
  avgBetSize: number = 25
): TheoreticalLoss {
  const totalCoinIn = points * DOLLARS_PER_POINT;
  return calculateTheoreticalLoss(totalCoinIn, primaryGame, avgBetSize);
}

export function calculatePredictiveScore(
  completedCruises: BookedCruise[],
  currentPoints: number,
  currentTier: string
): PredictiveScore {
  console.log('[CasinoCalculator] Calculating predictive score');

  if (completedCruises.length === 0) {
    return getDefaultPredictiveScore();
  }

  const totalCoinIn = currentPoints * DOLLARS_PER_POINT;
  const avgCoinInPerCruise = totalCoinIn / completedCruises.length;
  
  const totalNights = completedCruises.reduce((sum, c) => sum + (c.nights || 0), 0);
  const avgNightsPerCruise = totalNights / completedCruises.length;
  
  const avgDailyTheoretical = totalNights > 0 
    ? (totalCoinIn * 0.08) / totalNights 
    : 0;

  const pointsPerCruise = completedCruises.map(c => c.earnedPoints || c.casinoPoints || 0);
  const avgPoints = pointsPerCruise.reduce((a, b) => a + b, 0) / pointsPerCruise.length;
  const variance = pointsPerCruise.reduce((sum, p) => sum + Math.pow(p - avgPoints, 2), 0) / pointsPerCruise.length;
  const stdDev = Math.sqrt(variance);
  const consistency = avgPoints > 0 ? Math.max(0, 100 - (stdDev / avgPoints * 100)) : 50;

  const cruiseFrequency = completedCruises.length / 12;
  const estimatedAvgBet = avgCoinInPerCruise > 0 && avgNightsPerCruise > 0
    ? avgCoinInPerCruise / (avgNightsPerCruise * 3 * 100)
    : 25;
  const playTimeHours = totalCoinIn / (estimatedAvgBet * 200);

  let score = 0;
  score += Math.min(avgDailyTheoretical / 10, 30);
  score += Math.min(consistency * 0.2, 20);
  score += Math.min(cruiseFrequency * 15, 20);
  score += Math.min(totalCoinIn / 50000, 20);
  score += Math.min(playTimeHours / 100, 10);
  
  score = Math.min(100, Math.round(score));

  let tier: PredictiveScore['tier'] = 'Bronze';
  if (score >= 85) tier = 'Diamond';
  else if (score >= 70) tier = 'Platinum';
  else if (score >= 50) tier = 'Gold';
  else if (score >= 30) tier = 'Silver';

  const projectedTierUpgrade = getTierUpgradeProjection(score, tier);
  const projectedUpgradeDate = projectedTierUpgrade 
    ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    : null;

  const nextCruiseExpectedTheo = avgCoinInPerCruise * 0.08;
  const yearlyProjectedTheo = avgCoinInPerCruise * 0.08 * cruiseFrequency * 12;
  const projectedOfferValue = yearlyProjectedTheo * 0.3;

  let hostValueIndicator: PredictiveScore['hostValueIndicator'] = 'low';
  if (yearlyProjectedTheo > 10000) hostValueIndicator = 'vip';
  else if (yearlyProjectedTheo > 5000) hostValueIndicator = 'high';
  else if (yearlyProjectedTheo > 2000) hostValueIndicator = 'medium';

  const recommendations = generateScoreRecommendations(
    score,
    avgDailyTheoretical,
    consistency,
    cruiseFrequency,
    estimatedAvgBet
  );

  console.log('[CasinoCalculator] Predictive score result:', { score, tier, hostValueIndicator });

  return {
    score,
    tier,
    projectedTierUpgrade,
    projectedUpgradeDate,
    factors: {
      avgDailyTheoretical,
      consistency,
      cruiseFrequency,
      totalCoinIn,
      avgBetSize: estimatedAvgBet,
      playTimeHours,
    },
    projections: {
      nextCruiseExpectedTheo,
      yearlyProjectedTheo,
      projectedOfferValue,
    },
    recommendations,
    hostValueIndicator,
  };
}

function getDefaultPredictiveScore(): PredictiveScore {
  return {
    score: 0,
    tier: 'Bronze',
    projectedTierUpgrade: null,
    projectedUpgradeDate: null,
    factors: {
      avgDailyTheoretical: 0,
      consistency: 0,
      cruiseFrequency: 0,
      totalCoinIn: 0,
      avgBetSize: 0,
      playTimeHours: 0,
    },
    projections: {
      nextCruiseExpectedTheo: 0,
      yearlyProjectedTheo: 0,
      projectedOfferValue: 0,
    },
    recommendations: ['Complete your first cruise to start building your predictive score'],
    hostValueIndicator: 'low',
  };
}

function getTierUpgradeProjection(score: number, currentTier: PredictiveScore['tier']): string | null {
  const tiers: PredictiveScore['tier'][] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const currentIndex = tiers.indexOf(currentTier);
  
  if (currentIndex >= tiers.length - 1) return null;
  
  const nextTier = tiers[currentIndex + 1];
  const thresholds = { Silver: 30, Gold: 50, Platinum: 70, Diamond: 85 };
  const threshold = thresholds[nextTier as keyof typeof thresholds];
  
  if (threshold && score >= threshold - 15) {
    return nextTier;
  }
  
  return null;
}

function generateScoreRecommendations(
  score: number,
  avgDailyTheo: number,
  consistency: number,
  cruiseFrequency: number,
  avgBet: number
): string[] {
  const recommendations: string[] = [];
  
  if (score < 30) {
    recommendations.push('Increase casino play time to qualify for better offers');
  }
  
  if (consistency < 50) {
    recommendations.push('More consistent play patterns lead to better predictive offers');
  }
  
  if (cruiseFrequency < 0.5) {
    recommendations.push('Book more cruises to increase your value to casino hosts');
  }
  
  if (avgDailyTheo < 50) {
    recommendations.push('Consider slightly higher average bets to increase theoretical value');
  }
  
  if (avgBet < 10) {
    recommendations.push('Higher denomination play typically receives better comps');
  }
  
  if (score >= 70) {
    recommendations.push('Contact casino host to discuss VIP benefits and offers');
    recommendations.push('You may qualify for invite-only tournament events');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Maintain current play patterns for consistent offers');
  }
  
  return recommendations;
}

export function formatCasinoHoursForDisplay(estimate: CasinoHoursEstimate): string {
  return `${estimate.totalCasinoHours} total hours (${estimate.avgHoursPerDay.toFixed(1)} hrs/day avg)`;
}

export function formatTheoreticalLossForDisplay(theo: TheoreticalLoss): string {
  return `$${theo.theoreticalLoss.toFixed(0)} theoretical (${theo.riskLevel} risk)`;
}

export function formatPredictiveScoreForDisplay(score: PredictiveScore): string {
  return `${score.score}/100 (${score.tier}) - ${score.hostValueIndicator.toUpperCase()} value`;
}
