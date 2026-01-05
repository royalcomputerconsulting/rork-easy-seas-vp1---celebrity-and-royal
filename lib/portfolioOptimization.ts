import type { 
  BookedCruise, 
  Cruise, 
  CasinoOffer, 
  ClubRoyaleTier,
} from '@/types/models';

import { calculateCabinRetailValue } from '@/mocks/bookedCruises';
import { getCruisesByStatus } from './lifecycleManager';
import { createDateFromString, getDaysUntil } from '@/lib/date';

export interface OptimizationGoal {
  type: 'tier' | 'roi' | 'points' | 'value' | 'nights' | 'budget';
  targetValue?: number;
  priority: number;
}

export interface OptimizationConstraints {
  maxBudget?: number;
  maxCruises?: number;
  maxNights?: number;
  timeframeMonths?: number;
  preferredShips?: string[];
  excludedShips?: string[];
  preferredCabinTypes?: string[];
  preferredDestinations?: string[];
  excludeConflicts?: boolean;
}

export interface OptimizedCruise {
  cruise: Cruise;
  score: number;
  scoreBreakdown: {
    valueScore: number;
    pointsScore: number;
    roiScore: number;
    preferenceScore: number;
  };
  estimatedValue: {
    retailValue: number;
    amountPaid: number;
    savings: number;
    roi: number;
    estimatedPoints: number;
  };
  reasoning: string[];
}

export interface PortfolioOptimizationResult {
  recommendations: OptimizedCruise[];
  summary: {
    totalCruises: number;
    totalNights: number;
    totalEstimatedCost: number;
    totalEstimatedSavings: number;
    totalEstimatedPoints: number;
    avgROI: number;
    tierContribution: number;
  };
  goalProgress: {
    goal: OptimizationGoal;
    currentValue: number;
    projectedValue: number;
    progressPercent: number;
  }[];
  budgetAnalysis: {
    totalBudget: number;
    allocatedAmount: number;
    remainingBudget: number;
    utilizationPercent: number;
  };
  insights: string[];
  alternativeCruises: OptimizedCruise[];
}

export interface BudgetAllocation {
  category: string;
  amount: number;
  percentage: number;
  cruiseCount: number;
  averagePerCruise: number;
}

export function optimizePortfolio(
  availableCruises: Cruise[],
  offers: CasinoOffer[],
  bookedCruises: BookedCruise[],
  goals: OptimizationGoal[],
  constraints: OptimizationConstraints,
  currentPoints: number,
  currentTier: ClubRoyaleTier
): PortfolioOptimizationResult {
  console.log('[PortfolioOptimization] Starting optimization with goals:', goals.map(g => g.type));

  const bookedIds = new Set(bookedCruises.map(c => c.id));
  const bookedDates = bookedCruises.map(c => ({
    start: createDateFromString(c.sailDate),
    end: createDateFromString(c.returnDate || c.sailDate),
  }));

  let filteredCruises = availableCruises.filter(cruise => {
    if (bookedIds.has(cruise.id)) return false;
    
    if (getDaysUntil(cruise.sailDate) <= 0) return false;

    if (constraints.preferredShips?.length && 
        !constraints.preferredShips.some(s => cruise.shipName?.toLowerCase().includes(s.toLowerCase()))) {
      return false;
    }

    if (constraints.excludedShips?.some(s => cruise.shipName?.toLowerCase().includes(s.toLowerCase()))) {
      return false;
    }

    if (constraints.preferredCabinTypes?.length &&
        !constraints.preferredCabinTypes.some(t => cruise.cabinType?.toLowerCase().includes(t.toLowerCase()))) {
      return false;
    }

    if (constraints.timeframeMonths) {
      const sailDate = createDateFromString(cruise.sailDate);
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + constraints.timeframeMonths);
      if (sailDate > maxDate) return false;
    }

    if (constraints.excludeConflicts) {
      const cruiseStart = createDateFromString(cruise.sailDate);
      const cruiseEnd = new Date(cruiseStart.getTime() + (cruise.nights || 0) * 24 * 60 * 60 * 1000);
      
      const hasConflict = bookedDates.some(booked => 
        cruiseStart <= booked.end && cruiseEnd >= booked.start
      );
      if (hasConflict) return false;
    }

    if (constraints.maxBudget) {
      const price = cruise.totalPrice || cruise.price || 0;
      if (price > constraints.maxBudget) return false;
    }

    return true;
  });

  console.log(`[PortfolioOptimization] ${filteredCruises.length} cruises after filtering`);

  const scoredCruises = filteredCruises.map(cruise => scoreCruise(cruise, offers, goals, constraints, currentPoints));

  scoredCruises.sort((a, b) => b.score - a.score);

  const maxCruises = constraints.maxCruises || 10;
  let recommendations: OptimizedCruise[] = [];
  let totalBudgetUsed = 0;
  let totalNights = 0;

  for (const scored of scoredCruises) {
    if (recommendations.length >= maxCruises) break;
    
    const cruiseCost = scored.estimatedValue.amountPaid;
    
    if (constraints.maxBudget && totalBudgetUsed + cruiseCost > constraints.maxBudget) {
      continue;
    }

    if (constraints.maxNights && totalNights + (scored.cruise.nights || 0) > constraints.maxNights) {
      continue;
    }

    recommendations.push(scored);
    totalBudgetUsed += cruiseCost;
    totalNights += scored.cruise.nights || 0;
  }

  const summary = calculateSummary(recommendations, currentPoints);
  const goalProgress = calculateGoalProgress(goals, recommendations, currentPoints, currentTier);
  const budgetAnalysis = calculateBudgetAnalysis(recommendations, constraints.maxBudget || 0);
  const insights = generateInsights(recommendations, goals, constraints, summary);
  const alternativeCruises = scoredCruises
    .filter(c => !recommendations.includes(c))
    .slice(0, 5);

  console.log('[PortfolioOptimization] Optimization complete:', {
    recommendations: recommendations.length,
    totalCost: summary.totalEstimatedCost,
    totalPoints: summary.totalEstimatedPoints,
  });

  return {
    recommendations,
    summary,
    goalProgress,
    budgetAnalysis,
    insights,
    alternativeCruises,
  };
}

function scoreCruise(
  cruise: Cruise,
  offers: CasinoOffer[],
  goals: OptimizationGoal[],
  constraints: OptimizationConstraints,
  currentPoints: number
): OptimizedCruise {
  const cabinType = cruise.cabinType || 'Balcony';
  const nights = cruise.nights || 0;
  const amountPaid = cruise.totalPrice || cruise.price || 0;
  const retailValue = cruise.retailValue || calculateCabinRetailValue(cabinType, nights);
  const savings = retailValue - amountPaid;
  const roi = amountPaid > 0 ? (savings / amountPaid) * 100 : 0;
  const estimatedPoints = nights * 500;

  let valueScore = Math.min(100, (savings / 1000) * 20);
  let pointsScore = Math.min(100, (estimatedPoints / 5000) * 100);
  let roiScore = Math.min(100, Math.max(0, roi / 2));
  let preferenceScore = 50;

  if (constraints.preferredShips?.some(s => cruise.shipName?.toLowerCase().includes(s.toLowerCase()))) {
    preferenceScore += 25;
  }
  if (constraints.preferredDestinations?.some(d => 
    cruise.destination?.toLowerCase().includes(d.toLowerCase()) ||
    cruise.itineraryName?.toLowerCase().includes(d.toLowerCase())
  )) {
    preferenceScore += 25;
  }

  const offer = offers.find(o => o.offerCode === cruise.offerCode);
  if (offer) {
    if (offer.freePlay) valueScore += 10;
    if (offer.OBC) valueScore += 10;
    if (offer.classification === '2person') valueScore += 20;
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const goal of goals) {
    const weight = goal.priority;
    totalWeight += weight;

    switch (goal.type) {
      case 'value':
        totalScore += valueScore * weight;
        break;
      case 'points':
      case 'tier':
        totalScore += pointsScore * weight;
        break;
      case 'roi':
        totalScore += roiScore * weight;
        break;
      case 'nights':
        totalScore += Math.min(100, (nights / 7) * 50) * weight;
        break;
      case 'budget':
        const budgetEfficiency = amountPaid > 0 ? Math.min(100, (retailValue / amountPaid) * 50) : 50;
        totalScore += budgetEfficiency * weight;
        break;
    }
  }

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 50;

  const reasoning: string[] = [];
  if (roi > 50) reasoning.push(`High ROI (${roi.toFixed(0)}%)`);
  if (estimatedPoints > 2000) reasoning.push(`Strong points potential (${estimatedPoints})`);
  if (offer) reasoning.push(`Has offer: ${offer.offerCode}`);
  if (savings > 1000) reasoning.push(`Significant savings ($${savings.toFixed(0)})`);
  if (cruise.casinoOpenDays && cruise.casinoOpenDays > 4) reasoning.push(`${cruise.casinoOpenDays} casino-open days`);

  return {
    cruise,
    score: finalScore,
    scoreBreakdown: {
      valueScore,
      pointsScore,
      roiScore,
      preferenceScore,
    },
    estimatedValue: {
      retailValue,
      amountPaid,
      savings,
      roi,
      estimatedPoints,
    },
    reasoning,
  };
}

function calculateSummary(recommendations: OptimizedCruise[], currentPoints: number) {
  const totalCruises = recommendations.length;
  const totalNights = recommendations.reduce((sum, r) => sum + (r.cruise.nights || 0), 0);
  const totalEstimatedCost = recommendations.reduce((sum, r) => sum + r.estimatedValue.amountPaid, 0);
  const totalEstimatedSavings = recommendations.reduce((sum, r) => sum + r.estimatedValue.savings, 0);
  const totalEstimatedPoints = recommendations.reduce((sum, r) => sum + r.estimatedValue.estimatedPoints, 0);
  const avgROI = totalEstimatedCost > 0 ? (totalEstimatedSavings / totalEstimatedCost) * 100 : 0;

  return {
    totalCruises,
    totalNights,
    totalEstimatedCost,
    totalEstimatedSavings,
    totalEstimatedPoints,
    avgROI,
    tierContribution: totalEstimatedPoints,
  };
}

function calculateGoalProgress(
  goals: OptimizationGoal[],
  recommendations: OptimizedCruise[],
  currentPoints: number,
  currentTier: ClubRoyaleTier
) {
  return goals.map(goal => {
    let currentValue = 0;
    let projectedValue = 0;

    switch (goal.type) {
      case 'tier':
      case 'points':
        currentValue = currentPoints;
        projectedValue = currentPoints + recommendations.reduce((sum, r) => sum + r.estimatedValue.estimatedPoints, 0);
        break;
      case 'roi':
        const totalCost = recommendations.reduce((sum, r) => sum + r.estimatedValue.amountPaid, 0);
        const totalSavings = recommendations.reduce((sum, r) => sum + r.estimatedValue.savings, 0);
        currentValue = 0;
        projectedValue = totalCost > 0 ? (totalSavings / totalCost) * 100 : 0;
        break;
      case 'nights':
        currentValue = 0;
        projectedValue = recommendations.reduce((sum, r) => sum + (r.cruise.nights || 0), 0);
        break;
      case 'value':
        currentValue = 0;
        projectedValue = recommendations.reduce((sum, r) => sum + r.estimatedValue.savings, 0);
        break;
      case 'budget':
        currentValue = 0;
        projectedValue = recommendations.reduce((sum, r) => sum + r.estimatedValue.amountPaid, 0);
        break;
    }

    const target = goal.targetValue || projectedValue;
    const progressPercent = target > 0 ? Math.min(100, (projectedValue / target) * 100) : 100;

    return {
      goal,
      currentValue,
      projectedValue,
      progressPercent,
    };
  });
}

function calculateBudgetAnalysis(recommendations: OptimizedCruise[], maxBudget: number) {
  const allocatedAmount = recommendations.reduce((sum, r) => sum + r.estimatedValue.amountPaid, 0);
  const remainingBudget = Math.max(0, maxBudget - allocatedAmount);
  const utilizationPercent = maxBudget > 0 ? (allocatedAmount / maxBudget) * 100 : 0;

  return {
    totalBudget: maxBudget,
    allocatedAmount,
    remainingBudget,
    utilizationPercent,
  };
}

function generateInsights(
  recommendations: OptimizedCruise[],
  goals: OptimizationGoal[],
  constraints: OptimizationConstraints,
  summary: ReturnType<typeof calculateSummary>
): string[] {
  const insights: string[] = [];

  if (summary.avgROI > 100) {
    insights.push(`Excellent portfolio ROI of ${summary.avgROI.toFixed(0)}% - maximize these opportunities`);
  } else if (summary.avgROI > 50) {
    insights.push(`Good portfolio ROI of ${summary.avgROI.toFixed(0)}% - solid value selections`);
  } else if (summary.avgROI < 20) {
    insights.push(`Portfolio ROI of ${summary.avgROI.toFixed(0)}% is below average - consider higher-value offers`);
  }

  const hasPointsGoal = goals.some(g => g.type === 'points' || g.type === 'tier');
  if (hasPointsGoal && summary.totalEstimatedPoints > 5000) {
    insights.push(`Projected ${summary.totalEstimatedPoints.toLocaleString()} points will significantly boost tier progress`);
  }

  const highValueCruises = recommendations.filter(r => r.estimatedValue.roi > 100);
  if (highValueCruises.length > 0) {
    insights.push(`${highValueCruises.length} cruise(s) have exceptional ROI (>100%)`);
  }

  if (constraints.maxBudget) {
    const utilization = (summary.totalEstimatedCost / constraints.maxBudget) * 100;
    if (utilization < 70) {
      insights.push(`Budget utilization at ${utilization.toFixed(0)}% - room for additional bookings`);
    } else if (utilization > 95) {
      insights.push(`Budget nearly fully utilized (${utilization.toFixed(0)}%)`);
    }
  }

  const offerCruises = recommendations.filter(r => r.cruise.offerCode);
  if (offerCruises.length > 0) {
    insights.push(`${offerCruises.length} recommended cruise(s) have casino offers attached`);
  }

  return insights;
}

export function calculateBudgetAllocation(
  bookedCruises: BookedCruise[],
  totalBudget: number
): BudgetAllocation[] {
  const cruisesByStatus = getCruisesByStatus(bookedCruises);
  const allocations: BudgetAllocation[] = [];

  const cabinTypeSpend: Record<string, { amount: number; count: number }> = {};

  for (const cruise of cruisesByStatus.upcoming) {
    const cabinType = cruise.cabinType || 'Unknown';
    const amount = cruise.totalPrice || cruise.price || 0;

    if (!cabinTypeSpend[cabinType]) {
      cabinTypeSpend[cabinType] = { amount: 0, count: 0 };
    }
    cabinTypeSpend[cabinType].amount += amount;
    cabinTypeSpend[cabinType].count += 1;
  }

  const totalSpent = Object.values(cabinTypeSpend).reduce((sum, cat) => sum + cat.amount, 0);

  for (const [category, data] of Object.entries(cabinTypeSpend)) {
    allocations.push({
      category,
      amount: data.amount,
      percentage: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
      cruiseCount: data.count,
      averagePerCruise: data.count > 0 ? data.amount / data.count : 0,
    });
  }

  allocations.sort((a, b) => b.amount - a.amount);

  return allocations;
}

export function formatPortfolioOptimizationForAgent(result: PortfolioOptimizationResult): string {
  const lines: string[] = [
    '## Portfolio Optimization Results',
    '',
    '### Summary',
    `- Recommended Cruises: ${result.summary.totalCruises}`,
    `- Total Nights: ${result.summary.totalNights}`,
    `- Total Est. Cost: $${result.summary.totalEstimatedCost.toLocaleString()}`,
    `- Total Est. Savings: $${result.summary.totalEstimatedSavings.toLocaleString()}`,
    `- Total Est. Points: ${result.summary.totalEstimatedPoints.toLocaleString()}`,
    `- Avg ROI: ${result.summary.avgROI.toFixed(1)}%`,
    '',
  ];

  if (result.budgetAnalysis.totalBudget > 0) {
    lines.push('### Budget Analysis');
    lines.push(`- Budget: $${result.budgetAnalysis.totalBudget.toLocaleString()}`);
    lines.push(`- Allocated: $${result.budgetAnalysis.allocatedAmount.toLocaleString()} (${result.budgetAnalysis.utilizationPercent.toFixed(0)}%)`);
    lines.push(`- Remaining: $${result.budgetAnalysis.remainingBudget.toLocaleString()}`);
    lines.push('');
  }

  lines.push('### Top Recommendations');
  result.recommendations.slice(0, 5).forEach((rec, idx) => {
    lines.push(`**${idx + 1}. ${rec.cruise.shipName}** (Score: ${rec.score.toFixed(0)})`);
    lines.push(`   ${rec.cruise.sailDate} | ${rec.cruise.nights} nights | ${rec.cruise.destination || rec.cruise.itineraryName}`);
    lines.push(`   Est. Cost: $${rec.estimatedValue.amountPaid.toLocaleString()} | ROI: ${rec.estimatedValue.roi.toFixed(0)}% | Points: ${rec.estimatedValue.estimatedPoints}`);
    if (rec.reasoning.length > 0) {
      lines.push(`   ✓ ${rec.reasoning.join(' • ')}`);
    }
    lines.push('');
  });

  if (result.insights.length > 0) {
    lines.push('### Insights');
    result.insights.forEach(i => lines.push(`- ${i}`));
    lines.push('');
  }

  if (result.goalProgress.length > 0) {
    lines.push('### Goal Progress');
    result.goalProgress.forEach(gp => {
      const icon = gp.progressPercent >= 100 ? '✅' : gp.progressPercent >= 50 ? '🟡' : '⏳';
      lines.push(`${icon} ${gp.goal.type.toUpperCase()}: ${gp.projectedValue.toLocaleString()} (${gp.progressPercent.toFixed(0)}% of target)`);
    });
  }

  return lines.join('\n');
}
