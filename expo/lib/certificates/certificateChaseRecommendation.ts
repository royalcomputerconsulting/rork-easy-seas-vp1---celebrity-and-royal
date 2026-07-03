import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';
import type { InstantCertificateLevel, InstantCertificateLevelSummary } from './instantCertificateSummaries';

export type CertificateChaseRecommendation = {
  currentPoints: number;
  currentLevel: InstantCertificateLevel | null;
  nextLevel: InstantCertificateLevel | null;
  pointsNeeded: number;
  estimatedSlotCoinInNeeded: number;
  estimatedRoyalVpCoinInNeeded: number;
  valueUpgradeSummary: string;
  recommendation: 'stop' | 'light-chase' | 'worth-chasing' | 'do-not-chase' | 'unknown';
  reasons: string[];
  warnings: string[];
};

function cabinRank(category?: string): number {
  const text = String(category ?? '').toLowerCase();
  if (text.includes('suite')) return text.includes('junior') ? 4 : 5;
  if (text.includes('balcony')) return 3;
  if (text.includes('ocean')) return 2;
  if (text.includes('interior')) return 1;
  return 0;
}

export function buildCertificateChaseRecommendation(input: {
  currentPoints: number;
  levels: InstantCertificateLevel[];
  summaries?: Record<string, InstantCertificateLevelSummary>;
}): CertificateChaseRecommendation {
  const levels = [...input.levels].sort((a, b) => b.pointsRequired - a.pointsRequired);
  const currentLevel = [...levels].reverse().filter((level) => input.currentPoints >= level.pointsRequired).sort((a, b) => b.pointsRequired - a.pointsRequired)[0] ?? null;
  const nextLevel = [...levels].reverse().filter((level) => level.pointsRequired > input.currentPoints).sort((a, b) => a.pointsRequired - b.pointsRequired)[0] ?? null;
  const pointsNeeded = nextLevel ? Math.max(0, nextLevel.pointsRequired - input.currentPoints) : 0;
  const estimatedSlotCoinInNeeded = estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0;
  const estimatedRoyalVpCoinInNeeded = estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'video-poker' }).coinIn ?? 0;
  const currentSummary = currentLevel ? input.summaries?.[currentLevel.code] : undefined;
  const nextSummary = nextLevel ? input.summaries?.[nextLevel.code] : undefined;
  const reasons: string[] = [];
  const warnings = [
    'Estimated coin-in is not expected loss.',
    'FreePlay coin-in does not earn points by default unless verified onboard data says otherwise.',
    'Table-game points are not a fixed coin-in formula.',
  ];

  if (!nextLevel) {
    return {
      currentPoints: input.currentPoints,
      currentLevel,
      nextLevel: null,
      pointsNeeded: 0,
      estimatedSlotCoinInNeeded: 0,
      estimatedRoyalVpCoinInNeeded: 0,
      valueUpgradeSummary: 'You are at or above the highest available level in this ladder.',
      recommendation: currentLevel ? 'stop' : 'unknown',
      reasons: ['No higher certificate level is available in the supplied ladder.'],
      warnings,
    };
  }

  const cabinImproves = cabinRank(nextSummary?.bestStateroomCategory) > cabinRank(currentSummary?.bestStateroomCategory);
  const guestImproves = Boolean(nextSummary?.hasCruiseFareFor2 && !currentSummary?.hasCruiseFareFor2);
  const sailingImproves = (nextSummary?.sailingCount ?? 0) > (currentSummary?.sailingCount ?? 0) * 1.25;
  const fpImproves = Math.max(0, ...(nextSummary?.freeplayValues ?? [0])) > Math.max(0, ...(currentSummary?.freeplayValues ?? [0]));
  if (cabinImproves) reasons.push('Next level appears to improve cabin category.');
  if (guestImproves) reasons.push('Next level appears to improve guest coverage to cruise fare for 2.');
  if (sailingImproves) reasons.push('Next level appears to materially expand sailing availability.');
  if (fpImproves) reasons.push('Next level appears to improve FreePlay.');
  if (pointsNeeded <= 250) reasons.push('Points needed are small enough for a light chase if bankroll rules permit.');
  if (!reasons.length) reasons.push('Next level has limited visible incremental value from the supplied summaries.');

  const materiallyImproves = cabinImproves || guestImproves || sailingImproves || fpImproves;
  const recommendation = pointsNeeded <= 0
    ? 'stop'
    : pointsNeeded <= 250
      ? 'light-chase'
      : materiallyImproves && pointsNeeded <= 1500
        ? 'worth-chasing'
        : materiallyImproves && pointsNeeded <= 3000
          ? 'light-chase'
          : 'do-not-chase';

  return {
    currentPoints: input.currentPoints,
    currentLevel,
    nextLevel,
    pointsNeeded,
    estimatedSlotCoinInNeeded,
    estimatedRoyalVpCoinInNeeded,
    valueUpgradeSummary: nextSummary
      ? `Next level ${nextLevel.code} has ${nextSummary.sailingCount} sailings, best cabin ${nextSummary.bestStateroomCategory}, and ${nextSummary.hasCruiseFareFor2 ? 'fare for 2 appears available' : 'guest coverage must be reviewed'}.`
      : `Next level is ${nextLevel.code}; parse details to compare exact sailing value.`,
    recommendation,
    reasons,
    warnings,
  };
}
