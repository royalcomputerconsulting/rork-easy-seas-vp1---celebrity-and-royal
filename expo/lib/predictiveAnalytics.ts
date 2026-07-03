import type { 
  BookedCruise, 
  Cruise, 
  CasinoOffer, 
  ClubRoyaleTier,
  CrownAnchorLevel,
} from '@/types/models';
import { CLUB_ROYALE_TIERS, CROWN_ANCHOR_LEVELS, DOLLARS_PER_POINT } from '@/types/models';
import { calculateCabinRetailValue } from '@/mocks/bookedCruises';
import { getCruisesByStatus } from './lifecycleManager';

export interface TierForecast {
  currentTier: ClubRoyaleTier;
  currentPoints: number;
  targetTier: ClubRoyaleTier;
  targetThreshold: number;
  pointsNeeded: number;
  
  projectedDateToReach: Date | null;
  estimatedCruisesNeeded: number;
  estimatedNightsNeeded: number;
  estimatedCoinInNeeded: number;
  
  fromBookedCruises: {
    pointsContribution: number;
    cruiseCount: number;
  };
  
  remainingAfterBooked: {
    pointsNeeded: number;
    cruisesNeeded: number;
    nightsNeeded: number;
  };
  
  confidenceLevel: 'high' | 'medium' | 'low';
  assumptions: string[];
  milestones: TierMilestone[];
}

export interface TierMilestone {
  tier: ClubRoyaleTier;
  pointsRequired: number;
  currentProgress: number;
  projectedDate: Date | null;
  isAchieved: boolean;
}

export interface ROIProjection {
  currentPortfolioROI: number;
  projectedROI: number;
  projectedSavings: number;
  projectedPointsValue: number;
  
  bestCaseROI: number;
  worstCaseROI: number;
  expectedROI: number;
  
  roiByScenario: {
    conservative: number;
    moderate: number;
    aggressive: number;
  };
  
  historicalComparison: {
    avgROIFromHistory: number;
    projectionVsHistory: number;
  };
  
  recommendations: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  
  factors: RiskFactor[];
  
  mitigation: string[];
  opportunities: string[];
}

export interface RiskFactor {
  name: string;
  category: 'financial' | 'timing' | 'casino' | 'booking';
  severity: 'low' | 'medium' | 'high';
  impact: string;
  probability: number;
}

export function calculateTierForecast(
  currentPoints: number,
  currentTier: ClubRoyaleTier,
  targetTier: ClubRoyaleTier,
  bookedCruises: BookedCruise[],
  historicalAvgPointsPerNight: number = 100
): TierForecast {
  console.log(`[PredictiveAnalytics] Calculating tier forecast: ${currentTier} -> ${targetTier}`);

  const targetThreshold = CLUB_ROYALE_TIERS[targetTier]?.threshold || 0;
  const pointsNeeded = Math.max(0, targetThreshold - currentPoints);

  const cruisesByStatus = getCruisesByStatus(bookedCruises);
  const upcomingCruises = cruisesByStatus.upcoming;

  const avgPointsPerNight = historicalAvgPointsPerNight || 100;
  const avgNightsPerCruise = bookedCruises.length > 0
    ? bookedCruises.reduce((sum, c) => sum + (c.nights || 0), 0) / bookedCruises.length
    : 5;

  const estimatedPointsFromBooked = upcomingCruises.reduce((sum, c) => {
    const estimatedPoints = (c.nights || 0) * avgPointsPerNight;
    return sum + (c.earnedPoints || c.casinoPoints || estimatedPoints);
  }, 0);

  const remainingPointsNeeded = Math.max(0, pointsNeeded - estimatedPointsFromBooked);
  const estimatedCruisesNeeded = avgNightsPerCruise > 0 && avgPointsPerNight > 0
    ? Math.ceil(remainingPointsNeeded / (avgNightsPerCruise * avgPointsPerNight))
    : Math.ceil(remainingPointsNeeded / 2500);
  const estimatedNightsNeeded = Math.ceil(remainingPointsNeeded / avgPointsPerNight);
  const estimatedCoinInNeeded = remainingPointsNeeded * DOLLARS_PER_POINT;

  const avgCruisesPerMonth = 1.5;
  const monthsToTarget = estimatedCruisesNeeded / avgCruisesPerMonth;
  const projectedDateToReach = pointsNeeded <= estimatedPointsFromBooked
    ? upcomingCruises[upcomingCruises.length - 1]
      ? new Date(upcomingCruises[upcomingCruises.length - 1].sailDate)
      : new Date()
    : new Date(Date.now() + monthsToTarget * 30 * 24 * 60 * 60 * 1000);

  let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
  if (bookedCruises.length >= 5 && estimatedPointsFromBooked >= pointsNeeded * 0.5) {
    confidenceLevel = 'high';
  } else if (bookedCruises.length < 3 || estimatedPointsFromBooked < pointsNeeded * 0.2) {
    confidenceLevel = 'low';
  }

  const assumptions: string[] = [
    `Average ${avgPointsPerNight} points earned per cruise night`,
    `Average ${avgNightsPerCruise.toFixed(1)} nights per cruise`,
    `Approximately ${avgCruisesPerMonth} cruises per month projected`,
    `Casino play patterns remain consistent with historical data`,
  ];

  const allTiers: ClubRoyaleTier[] = ['Choice', 'Prime', 'Signature', 'Masters'];
  const currentTierIndex = allTiers.indexOf(currentTier);
  const targetTierIndex = allTiers.indexOf(targetTier);

  const milestones: TierMilestone[] = allTiers
    .slice(currentTierIndex, targetTierIndex + 1)
    .map(tier => {
      const threshold = CLUB_ROYALE_TIERS[tier]?.threshold || 0;
      const isAchieved = currentPoints >= threshold;
      const progress = threshold > 0 ? Math.min(100, (currentPoints / threshold) * 100) : 100;
      
      const pointsToThis = Math.max(0, threshold - currentPoints);
      const monthsToThis = pointsToThis / (avgPointsPerNight * avgNightsPerCruise * avgCruisesPerMonth);
      const projectedDate = isAchieved ? null : new Date(Date.now() + monthsToThis * 30 * 24 * 60 * 60 * 1000);

      return {
        tier,
        pointsRequired: threshold,
        currentProgress: progress,
        projectedDate,
        isAchieved,
      };
    });

  return {
    currentTier,
    currentPoints,
    targetTier,
    targetThreshold,
    pointsNeeded,
    projectedDateToReach,
    estimatedCruisesNeeded,
    estimatedNightsNeeded,
    estimatedCoinInNeeded,
    fromBookedCruises: {
      pointsContribution: estimatedPointsFromBooked,
      cruiseCount: upcomingCruises.length,
    },
    remainingAfterBooked: {
      pointsNeeded: remainingPointsNeeded,
      cruisesNeeded: estimatedCruisesNeeded,
      nightsNeeded: estimatedNightsNeeded,
    },
    confidenceLevel,
    assumptions,
    milestones,
  };
}

export function calculateROIProjection(
  bookedCruises: BookedCruise[],
  projectedCruises: Cruise[] = [],
  playerAvgWinRate: number = -0.02
): ROIProjection {
  console.log('[PredictiveAnalytics] Calculating ROI projection');

  const completedCruises = bookedCruises.filter(c => c.completionState === 'completed');

  let currentPortfolioROI = 0;
  if (completedCruises.length > 0) {
    const totalSpent = completedCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
    const totalRetail = completedCruises.reduce((sum, c) => {
      return sum + (c.retailValue || calculateCabinRetailValue(c.cabinType || 'Balcony', c.nights || 0));
    }, 0);
    currentPortfolioROI = totalSpent > 0 ? ((totalRetail - totalSpent) / totalSpent) * 100 : 0;
  }

  const avgHistoricalROI = currentPortfolioROI;

  const upcomingCruises = bookedCruises.filter(c => c.completionState === 'upcoming');
  
  let projectedSavings = 0;
  let projectedSpend = 0;
  
  upcomingCruises.forEach(cruise => {
    const retailValue = cruise.retailValue || calculateCabinRetailValue(cruise.cabinType || 'Balcony', cruise.nights || 0);
    const amountPaid = cruise.totalPrice || cruise.price || 0;
    projectedSavings += (retailValue - amountPaid);
    projectedSpend += amountPaid;
  });

  const projectedROI = projectedSpend > 0 ? (projectedSavings / projectedSpend) * 100 : currentPortfolioROI;

  const projectedNights = upcomingCruises.reduce((sum, c) => sum + (c.nights || 0), 0);
  const projectedPointsValue = (projectedNights * 500 * DOLLARS_PER_POINT) * 0.01;

  const volatility = 0.3;
  const bestCaseROI = projectedROI * (1 + volatility);
  const worstCaseROI = projectedROI * (1 - volatility);
  const expectedROI = projectedROI;

  const recommendations: string[] = [];
  
  if (projectedROI < 20) {
    recommendations.push('Consider booking with better offers to improve ROI');
  }
  if (projectedROI > 100) {
    recommendations.push('Excellent projected ROI - maximize booking opportunities');
  }
  if (upcomingCruises.length === 0) {
    recommendations.push('No upcoming cruises - explore available offers');
  }
  if (avgHistoricalROI > projectedROI) {
    recommendations.push('Projected ROI is below historical average - review offer selection');
  }

  return {
    currentPortfolioROI,
    projectedROI,
    projectedSavings,
    projectedPointsValue,
    bestCaseROI,
    worstCaseROI,
    expectedROI,
    roiByScenario: {
      conservative: worstCaseROI,
      moderate: expectedROI,
      aggressive: bestCaseROI,
    },
    historicalComparison: {
      avgROIFromHistory: avgHistoricalROI,
      projectionVsHistory: projectedROI - avgHistoricalROI,
    },
    recommendations,
  };
}

export function assessRisk(
  bookedCruises: BookedCruise[],
  offers: CasinoOffer[],
  currentPoints: number
): RiskAssessment {
  console.log('[PredictiveAnalytics] Assessing portfolio risk');

  const factors: RiskFactor[] = [];
  let riskScore = 0;

  const cruisesByStatus = getCruisesByStatus(bookedCruises);
  const upcomingCruises = cruisesByStatus.upcoming;

  if (upcomingCruises.length > 5) {
    factors.push({
      name: 'High booking concentration',
      category: 'booking',
      severity: 'medium',
      impact: 'Multiple concurrent bookings increase cancellation risk',
      probability: 0.3,
    });
    riskScore += 20;
  }

  const totalCommitted = upcomingCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
  if (totalCommitted > 10000) {
    factors.push({
      name: 'Significant financial commitment',
      category: 'financial',
      severity: totalCommitted > 25000 ? 'high' : 'medium',
      impact: `$${totalCommitted.toLocaleString()} committed to upcoming cruises`,
      probability: 0.5,
    });
    riskScore += totalCommitted > 25000 ? 30 : 15;
  }

  const expiringOffers = offers.filter(o => {
    const expires = o.expires || o.expiryDate;
    if (!expires) return false;
    const daysUntil = Math.ceil((new Date(expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil > 0 && daysUntil <= 14;
  });

  if (expiringOffers.length > 0) {
    factors.push({
      name: 'Expiring offers',
      category: 'timing',
      severity: expiringOffers.length > 3 ? 'high' : 'medium',
      impact: `${expiringOffers.length} offer(s) expiring within 14 days`,
      probability: 0.9,
    });
    riskScore += expiringOffers.length * 5;
  }

  const completedCruises = cruisesByStatus.completed;
  const avgWinnings = completedCruises.length > 0
    ? completedCruises.reduce((sum, c) => sum + (c.winnings || 0), 0) / completedCruises.length
    : 0;

  if (avgWinnings < -500) {
    factors.push({
      name: 'Negative casino trend',
      category: 'casino',
      severity: avgWinnings < -1000 ? 'high' : 'medium',
      impact: `Average loss of $${Math.abs(avgWinnings).toFixed(0)} per cruise`,
      probability: 0.7,
    });
    riskScore += avgWinnings < -1000 ? 25 : 15;
  }

  let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskScore >= 70) overallRisk = 'critical';
  else if (riskScore >= 50) overallRisk = 'high';
  else if (riskScore >= 25) overallRisk = 'medium';

  const mitigation: string[] = [];
  const opportunities: string[] = [];

  if (overallRisk === 'high' || overallRisk === 'critical') {
    mitigation.push('Review and potentially reduce booking concentration');
    mitigation.push('Set strict casino budgets for upcoming cruises');
  }

  if (expiringOffers.length > 0) {
    opportunities.push(`Act on ${expiringOffers.length} expiring offer(s) before deadline`);
  }

  if (avgWinnings >= 0) {
    opportunities.push('Positive casino trend - consider increasing play volume');
  }

  if (upcomingCruises.length < 3) {
    opportunities.push('Room for additional bookings in portfolio');
  }

  return {
    overallRisk,
    riskScore: Math.min(100, riskScore),
    factors,
    mitigation,
    opportunities,
  };
}

export function calculateLoyaltyForecast(
  currentNights: number,
  currentLevel: CrownAnchorLevel,
  targetLevel: CrownAnchorLevel,
  bookedCruises: BookedCruise[]
): {
  nightsNeeded: number;
  projectedDate: Date | null;
  fromBooked: number;
  remainingNeeded: number;
  estimatedCruises: number;
} {
  const targetNights = CROWN_ANCHOR_LEVELS[targetLevel]?.cruiseNights || 0;
  const nightsNeeded = Math.max(0, targetNights - currentNights);

  const upcomingCruises = bookedCruises.filter(c => c.completionState === 'upcoming');
  const nightsFromBooked = upcomingCruises.reduce((sum, c) => sum + (c.nights || 0), 0);

  const remainingNeeded = Math.max(0, nightsNeeded - nightsFromBooked);

  const avgNightsPerCruise = bookedCruises.length > 0
    ? bookedCruises.reduce((sum, c) => sum + (c.nights || 0), 0) / bookedCruises.length
    : 5;

  const estimatedCruises = avgNightsPerCruise > 0
    ? Math.ceil(remainingNeeded / avgNightsPerCruise)
    : Math.ceil(remainingNeeded / 5);

  const avgCruisesPerMonth = 1.5;
  const monthsNeeded = estimatedCruises / avgCruisesPerMonth;
  const projectedDate = nightsNeeded <= nightsFromBooked
    ? upcomingCruises[upcomingCruises.length - 1]
      ? new Date(upcomingCruises[upcomingCruises.length - 1].sailDate)
      : new Date()
    : new Date(Date.now() + monthsNeeded * 30 * 24 * 60 * 60 * 1000);

  return {
    nightsNeeded,
    projectedDate,
    fromBooked: nightsFromBooked,
    remainingNeeded,
    estimatedCruises,
  };
}

export function formatTierForecastForAgent(forecast: TierForecast): string {
  const lines: string[] = [
    `## Tier Progression Forecast`,
    '',
    `**Current:** ${forecast.currentTier} (${forecast.currentPoints.toLocaleString()} points)`,
    `**Target:** ${forecast.targetTier} (${forecast.targetThreshold.toLocaleString()} points)`,
    `**Points Needed:** ${forecast.pointsNeeded.toLocaleString()}`,
    '',
    '### From Booked Cruises',
    `- Upcoming Cruises: ${forecast.fromBookedCruises.cruiseCount}`,
    `- Estimated Points: ${forecast.fromBookedCruises.pointsContribution.toLocaleString()}`,
    '',
    '### Remaining After Booked',
    `- Points Still Needed: ${forecast.remainingAfterBooked.pointsNeeded.toLocaleString()}`,
    `- Est. Additional Cruises: ${forecast.remainingAfterBooked.cruisesNeeded}`,
    `- Est. Additional Nights: ${forecast.remainingAfterBooked.nightsNeeded}`,
    '',
    `**Projected Date:** ${forecast.projectedDateToReach?.toLocaleDateString() || 'Already achieved'}`,
    `**Confidence:** ${forecast.confidenceLevel.toUpperCase()}`,
    '',
    '### Milestones',
  ];

  forecast.milestones.forEach(m => {
    const status = m.isAchieved ? '✅' : '⏳';
    const date = m.projectedDate ? ` (${m.projectedDate.toLocaleDateString()})` : '';
    lines.push(`${status} ${m.tier}: ${m.currentProgress.toFixed(0)}%${date}`);
  });

  return lines.join('\n');
}

export function formatROIProjectionForAgent(projection: ROIProjection): string {
  const lines: string[] = [
    '## ROI Projection Analysis',
    '',
    `**Current Portfolio ROI:** ${projection.currentPortfolioROI.toFixed(1)}%`,
    `**Projected ROI:** ${projection.projectedROI.toFixed(1)}%`,
    `**Projected Savings:** $${projection.projectedSavings.toLocaleString()}`,
    '',
    '### Scenario Analysis',
    `- Conservative: ${projection.roiByScenario.conservative.toFixed(1)}%`,
    `- Moderate: ${projection.roiByScenario.moderate.toFixed(1)}%`,
    `- Aggressive: ${projection.roiByScenario.aggressive.toFixed(1)}%`,
    '',
    '### Historical Comparison',
    `- Avg Historical ROI: ${projection.historicalComparison.avgROIFromHistory.toFixed(1)}%`,
    `- Projection vs History: ${projection.historicalComparison.projectionVsHistory >= 0 ? '+' : ''}${projection.historicalComparison.projectionVsHistory.toFixed(1)}%`,
  ];

  if (projection.recommendations.length > 0) {
    lines.push('');
    lines.push('### Recommendations');
    projection.recommendations.forEach(r => lines.push(`- ${r}`));
  }

  return lines.join('\n');
}

export function formatRiskAssessmentForAgent(assessment: RiskAssessment): string {
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  const lines: string[] = [
    '## Risk Assessment',
    '',
    `**Overall Risk:** ${riskEmoji[assessment.overallRisk]} ${assessment.overallRisk.toUpperCase()}`,
    `**Risk Score:** ${assessment.riskScore}/100`,
    '',
  ];

  if (assessment.factors.length > 0) {
    lines.push('### Risk Factors');
    assessment.factors.forEach(f => {
      const severityEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
      lines.push(`${severityEmoji[f.severity]} **${f.name}** (${f.category})`);
      lines.push(`   ${f.impact}`);
    });
    lines.push('');
  }

  if (assessment.mitigation.length > 0) {
    lines.push('### Mitigation Actions');
    assessment.mitigation.forEach(m => lines.push(`- ${m}`));
    lines.push('');
  }

  if (assessment.opportunities.length > 0) {
    lines.push('### Opportunities');
    assessment.opportunities.forEach(o => lines.push(`- ${o}`));
  }

  return lines.join('\n');
}
