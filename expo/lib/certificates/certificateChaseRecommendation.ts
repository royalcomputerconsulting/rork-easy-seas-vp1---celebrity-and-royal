import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';
import { INSTANT_CERTIFICATE_POINT_LADDER } from '@/lib/certificates/instantCertificateUrls';

export type InstantCertificateLevelLike = {
  code: string;
  levelCode?: string;
  pointsRequired: number;
  summary?: {
    bestStateroomCategory?: string;
    sailingCount?: number;
    hasCruiseFareFor2?: boolean;
    freeplayValues?: number[];
    obcValues?: number[];
  };
};

export type CertificateChaseRecommendation = {
  currentPoints: number;
  currentLevel: InstantCertificateLevelLike | null;
  nextLevel: InstantCertificateLevelLike | null;
  pointsNeeded: number;
  estimatedSlotCoinInNeeded: number;
  estimatedRoyalVpCoinInNeeded: number;
  valueUpgradeSummary: string;
  recommendation: 'stop' | 'light-chase' | 'worth-chasing' | 'do-not-chase' | 'unknown';
  reasons: string[];
  warnings: string[];
};

function defaultLevels(): InstantCertificateLevelLike[] {
  return Object.entries(INSTANT_CERTIFICATE_POINT_LADDER)
    .map(([levelCode, pointsRequired]) => ({ code: levelCode, levelCode, pointsRequired }))
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
}

export function buildCertificateChaseRecommendation(input: {
  currentPoints?: number;
  levels?: InstantCertificateLevelLike[];
}): CertificateChaseRecommendation {
  const currentPoints = Math.max(0, Math.floor(Number(input.currentPoints ?? 0) || 0));
  const levels = (input.levels && input.levels.length > 0 ? input.levels : defaultLevels())
    .filter(level => Number.isFinite(level.pointsRequired) && level.pointsRequired > 0)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);

  if (levels.length === 0) {
    return {
      currentPoints,
      currentLevel: null,
      nextLevel: null,
      pointsNeeded: 0,
      estimatedSlotCoinInNeeded: 0,
      estimatedRoyalVpCoinInNeeded: 0,
      valueUpgradeSummary: 'No certificate ladder is available yet.',
      recommendation: 'unknown',
      reasons: ['Load this month or next month certificates to compare levels.'],
      warnings: ['Certificate ladder unavailable.'],
    };
  }

  const currentLevel = [...levels].reverse().find(level => currentPoints >= level.pointsRequired) ?? null;
  const nextLevel = levels.find(level => currentPoints < level.pointsRequired) ?? null;
  const pointsNeeded = nextLevel ? Math.max(0, nextLevel.pointsRequired - currentPoints) : 0;
  const estimatedSlotCoinInNeeded = estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0;
  const estimatedRoyalVpCoinInNeeded = estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'video-poker' }).coinIn ?? 0;

  if (!nextLevel) {
    return {
      currentPoints,
      currentLevel,
      nextLevel: null,
      pointsNeeded: 0,
      estimatedSlotCoinInNeeded: 0,
      estimatedRoyalVpCoinInNeeded: 0,
      valueUpgradeSummary: 'You are at or above the highest known certificate level.',
      recommendation: 'stop',
      reasons: ['No higher known instant-certificate level remains in the loaded ladder.'],
      warnings: ['Estimated coin-in is wagering volume, not expected loss or cost.'],
    };
  }

  const reasons: string[] = [];
  const upgrades: string[] = [];
  const nextSummary = nextLevel.summary;
  if (nextSummary?.bestStateroomCategory) upgrades.push(`best cabin may improve to ${nextSummary.bestStateroomCategory}`);
  if (nextSummary?.hasCruiseFareFor2) upgrades.push('includes cruise fare for 2 on at least some sailings');
  if ((nextSummary?.freeplayValues?.length ?? 0) > 0) upgrades.push('adds possible FreePlay value');
  if ((nextSummary?.obcValues?.length ?? 0) > 0) upgrades.push('adds possible OBC value');
  if ((nextSummary?.sailingCount ?? 0) > 0) upgrades.push(`${nextSummary?.sailingCount} eligible sailings at next level`);

  let recommendation: CertificateChaseRecommendation['recommendation'];
  if (pointsNeeded <= 0) recommendation = 'stop';
  else if (pointsNeeded <= 250) recommendation = 'light-chase';
  else if (pointsNeeded <= 750 && upgrades.length > 0) recommendation = 'worth-chasing';
  else if (pointsNeeded >= 1500 && upgrades.length === 0) recommendation = 'do-not-chase';
  else recommendation = 'unknown';

  reasons.push(`${pointsNeeded.toLocaleString()} points needed for ${nextLevel.code}.`);
  if (recommendation === 'light-chase') reasons.push('Points needed are small enough to consider a controlled light chase.');
  if (recommendation === 'worth-chasing') reasons.push('The next level appears to add materially better certificate options.');
  if (recommendation === 'do-not-chase') reasons.push('The next level requires substantial additional coin-in without a known value upgrade.');

  return {
    currentPoints,
    currentLevel,
    nextLevel,
    pointsNeeded,
    estimatedSlotCoinInNeeded,
    estimatedRoyalVpCoinInNeeded,
    valueUpgradeSummary: upgrades.length > 0 ? upgrades.join('; ') : 'No parsed value upgrade summary is available for the next level yet.',
    recommendation,
    reasons,
    warnings: ['Estimated coin-in is wagering volume, not expected loss or cost.', 'Royal video poker uses the $15-per-point estimate; reel slots use $5-per-point.'],
  };
}
