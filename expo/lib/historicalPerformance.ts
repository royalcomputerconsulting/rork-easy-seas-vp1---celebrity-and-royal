import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';

export interface HistoricalPerformanceMetrics {
  averagePointsPerNight: number;
  averagePointsPerCruise: number;
  averageCoinInPerNight: number;
  averageCoinInPerCruise: number;
  bestCruise: {
    points: number;
    coinIn: number;
    winnings: number;
    roi: number;
    cruiseName: string;
  } | null;
  worstCruise: {
    points: number;
    coinIn: number;
    winnings: number;
    roi: number;
    cruiseName: string;
  } | null;
  averageWinningsPerCruise: number;
  totalWinnings: number;
  totalCoinIn: number;
  totalPoints: number;
  successRate: number;
  averageROI: number;
  consistencyScore: number;
}

export interface ROIProjection {
  expectedPoints: number;
  expectedCoinIn: number;
  expectedWinnings: {
    best: number;
    average: number;
    worst: number;
  };
  expectedROI: {
    best: number;
    average: number;
    worst: number;
  };
  confidence: 'high' | 'medium' | 'low';
  assumptions: string[];
}

export function calculateHistoricalPerformance(
  completedCruises: BookedCruise[]
): HistoricalPerformanceMetrics {
  console.log('[HistoricalPerformance] Analyzing', completedCruises.length, 'completed cruises');

  if (completedCruises.length === 0) {
    return getEmptyMetrics();
  }

  const totalNights = completedCruises.reduce((sum, c) => sum + (c.nights || 0), 0);
  const totalPoints = completedCruises.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
  const totalCoinIn = totalPoints * DOLLARS_PER_POINT;
  const totalWinnings = completedCruises.reduce((sum, c) => sum + (c.winnings || 0), 0);

  const averagePointsPerNight = totalNights > 0 ? totalPoints / totalNights : 0;
  const averagePointsPerCruise = totalPoints / completedCruises.length;
  const averageCoinInPerNight = totalNights > 0 ? totalCoinIn / totalNights : 0;
  const averageCoinInPerCruise = totalCoinIn / completedCruises.length;
  const averageWinningsPerCruise = totalWinnings / completedCruises.length;

  const cruisesWithROI = completedCruises.map(cruise => {
    const retailValue = cruise.retailValue || 0;
    const amountPaid = cruise.totalPrice || cruise.price || 0;
    const winnings = cruise.winnings || 0;
    const points = cruise.earnedPoints || cruise.casinoPoints || 0;
    const coinIn = points * DOLLARS_PER_POINT;

    const roi = amountPaid > 0 
      ? ((retailValue + winnings - amountPaid) / amountPaid) * 100 
      : 0;

    return {
      cruise,
      points,
      coinIn,
      winnings,
      roi,
      retailValue,
      amountPaid,
    };
  });

  cruisesWithROI.sort((a, b) => b.roi - a.roi);

  const bestCruise = cruisesWithROI.length > 0 ? {
    points: cruisesWithROI[0].points,
    coinIn: cruisesWithROI[0].coinIn,
    winnings: cruisesWithROI[0].winnings,
    roi: cruisesWithROI[0].roi,
    cruiseName: `${cruisesWithROI[0].cruise.shipName} - ${cruisesWithROI[0].cruise.sailDate}`,
  } : null;

  const worstCruise = cruisesWithROI.length > 0 ? {
    points: cruisesWithROI[cruisesWithROI.length - 1].points,
    coinIn: cruisesWithROI[cruisesWithROI.length - 1].coinIn,
    winnings: cruisesWithROI[cruisesWithROI.length - 1].winnings,
    roi: cruisesWithROI[cruisesWithROI.length - 1].roi,
    cruiseName: `${cruisesWithROI[cruisesWithROI.length - 1].cruise.shipName} - ${cruisesWithROI[cruisesWithROI.length - 1].cruise.sailDate}`,
  } : null;

  const profitableCruises = cruisesWithROI.filter(c => c.winnings > 0).length;
  const successRate = cruisesWithROI.length > 0 
    ? (profitableCruises / cruisesWithROI.length) * 100 
    : 0;

  const totalROI = cruisesWithROI.reduce((sum, c) => sum + c.roi, 0);
  const averageROI = cruisesWithROI.length > 0 ? totalROI / cruisesWithROI.length : 0;

  const pointsValues = cruisesWithROI.map(c => c.points);
  const avgPoints = pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length;
  const variance = pointsValues.reduce((sum, p) => sum + Math.pow(p - avgPoints, 2), 0) / pointsValues.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = avgPoints > 0 ? Math.max(0, 100 - (stdDev / avgPoints * 100)) : 0;

  console.log('[HistoricalPerformance] Metrics calculated:', {
    averagePointsPerNight,
    averagePointsPerCruise,
    averageROI,
    successRate,
    consistencyScore,
  });

  return {
    averagePointsPerNight,
    averagePointsPerCruise,
    averageCoinInPerNight,
    averageCoinInPerCruise,
    bestCruise,
    worstCruise,
    averageWinningsPerCruise,
    totalWinnings,
    totalCoinIn,
    totalPoints,
    successRate,
    averageROI,
    consistencyScore,
  };
}

export function projectROIForUpcomingCruise(
  cruise: BookedCruise,
  historicalMetrics: HistoricalPerformanceMetrics
): ROIProjection {
  console.log('[HistoricalPerformance] Projecting ROI for cruise:', cruise.shipName);

  const nights = cruise.nights || 7;
  const casinoOpenDays = cruise.casinoOpenDays || Math.ceil(nights * 0.5);

  const expectedPointsFromHistory = historicalMetrics.averagePointsPerNight * nights;
  const expectedCoinInFromHistory = expectedPointsFromHistory * DOLLARS_PER_POINT;

  const seaDayFactor = casinoOpenDays / nights;
  const expectedPoints = Math.round(expectedPointsFromHistory * (0.7 + (seaDayFactor * 0.3)));
  const expectedCoinIn = expectedPoints * DOLLARS_PER_POINT;

  const bestWinnings = historicalMetrics.bestCruise?.winnings || 3000;
  const averageWinnings = historicalMetrics.averageWinningsPerCruise;
  const worstWinnings = historicalMetrics.worstCruise?.winnings || 0;

  const retailValue = cruise.retailValue || 0;
  const amountPaid = cruise.totalPrice || cruise.price || 0;

  const calculateROI = (winnings: number) => {
    if (amountPaid <= 0) return 0;
    return ((retailValue + winnings - amountPaid) / amountPaid) * 100;
  };

  const expectedROI = {
    best: calculateROI(bestWinnings),
    average: calculateROI(averageWinnings),
    worst: calculateROI(worstWinnings),
  };

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (historicalMetrics.consistencyScore > 70) {
    confidence = 'high';
  } else if (historicalMetrics.consistencyScore > 40) {
    confidence = 'medium';
  }

  const assumptions = [
    `Based on ${historicalMetrics.totalPoints.toLocaleString()} points from past cruises`,
    `Average ${historicalMetrics.averagePointsPerNight.toFixed(0)} points per night historically`,
    `${casinoOpenDays} casino-open days on this ${nights}-night cruise`,
    `Success rate: ${historicalMetrics.successRate.toFixed(0)}% (cruises with winnings)`,
    `Historical ROI range: ${historicalMetrics.worstCruise?.roi.toFixed(0)}% to ${historicalMetrics.bestCruise?.roi.toFixed(0)}%`,
  ];

  console.log('[HistoricalPerformance] Projection complete:', {
    expectedPoints,
    expectedCoinIn,
    expectedROI,
    confidence,
  });

  return {
    expectedPoints,
    expectedCoinIn,
    expectedWinnings: {
      best: bestWinnings,
      average: averageWinnings,
      worst: worstWinnings,
    },
    expectedROI,
    confidence,
    assumptions,
  };
}

export function calculateCostPerPoint(completedCruises: BookedCruise[]): {
  average: number;
  best: number;
  worst: number;
  median: number;
} {
  if (completedCruises.length === 0) {
    return { average: 0, best: 0, worst: 0, median: 0 };
  }

  const costPerPointValues = completedCruises
    .map(cruise => {
      const points = cruise.earnedPoints || cruise.casinoPoints || 0;
      const amountPaid = cruise.totalPrice || cruise.price || 0;
      return points > 0 ? amountPaid / points : 0;
    })
    .filter(cpp => cpp > 0)
    .sort((a, b) => a - b);

  if (costPerPointValues.length === 0) {
    return { average: 0, best: 0, worst: 0, median: 0 };
  }

  const average = costPerPointValues.reduce((a, b) => a + b, 0) / costPerPointValues.length;
  const best = costPerPointValues[0];
  const worst = costPerPointValues[costPerPointValues.length - 1];
  const median = costPerPointValues[Math.floor(costPerPointValues.length / 2)];

  console.log('[HistoricalPerformance] Cost per point:', { average, best, worst, median });

  return { average, best, worst, median };
}

function getEmptyMetrics(): HistoricalPerformanceMetrics {
  return {
    averagePointsPerNight: 0,
    averagePointsPerCruise: 0,
    averageCoinInPerNight: 0,
    averageCoinInPerCruise: 0,
    bestCruise: null,
    worstCruise: null,
    averageWinningsPerCruise: 0,
    totalWinnings: 0,
    totalCoinIn: 0,
    totalPoints: 0,
    successRate: 0,
    averageROI: 0,
    consistencyScore: 0,
  };
}

export function formatHistoricalSummary(metrics: HistoricalPerformanceMetrics): string {
  const lines = [
    '=== Historical Casino Performance ===',
    '',
    `Total Points Earned: ${metrics.totalPoints.toLocaleString()}`,
    `Total Coin-In: $${metrics.totalCoinIn.toLocaleString()}`,
    `Total Winnings: $${metrics.totalWinnings.toLocaleString()}`,
    '',
    `Average Points/Night: ${metrics.averagePointsPerNight.toFixed(0)}`,
    `Average Points/Cruise: ${metrics.averagePointsPerCruise.toFixed(0)}`,
    `Average Winnings/Cruise: $${metrics.averageWinningsPerCruise.toFixed(0)}`,
    '',
    `Success Rate: ${metrics.successRate.toFixed(0)}%`,
    `Average ROI: ${metrics.averageROI.toFixed(1)}%`,
    `Consistency Score: ${metrics.consistencyScore.toFixed(0)}/100`,
    '',
  ];

  if (metrics.bestCruise) {
    lines.push('Best Performance:');
    lines.push(`  ${metrics.bestCruise.cruiseName}`);
    lines.push(`  ${metrics.bestCruise.points.toLocaleString()} points, $${metrics.bestCruise.winnings.toLocaleString()} winnings`);
    lines.push(`  ROI: ${metrics.bestCruise.roi.toFixed(1)}%`);
    lines.push('');
  }

  if (metrics.worstCruise) {
    lines.push('Worst Performance:');
    lines.push(`  ${metrics.worstCruise.cruiseName}`);
    lines.push(`  ${metrics.worstCruise.points.toLocaleString()} points, $${metrics.worstCruise.winnings.toLocaleString()} winnings`);
    lines.push(`  ROI: ${metrics.worstCruise.roi.toFixed(1)}%`);
  }

  return lines.join('\n');
}
