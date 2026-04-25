import { CLUB_ROYALE_TIER_COLORS, withAlpha } from '@/constants/loyaltyColors';

export interface ClubRoyaleTierInfo {
  name: string;
  threshold: number;
  color: string;
  bgColor: string;
  benefits: string[];
  pointsPerNight: number;
}

export const CLUB_ROYALE_TIERS: Record<string, ClubRoyaleTierInfo> = {
  Choice: {
    name: 'Choice',
    threshold: 0,
    color: CLUB_ROYALE_TIER_COLORS.Choice,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Choice, 0.15),
    benefits: [
      'Basic casino privileges',
      'Access to Club Royale lounge',
    ],
    pointsPerNight: 100,
  },
  Prime: {
    name: 'Prime',
    threshold: 2501,
    color: CLUB_ROYALE_TIER_COLORS.Prime,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Prime, 0.15),
    benefits: [
      'Priority boarding',
      'Complimentary specialty dining',
      'Enhanced casino offers',
      'Dedicated casino host',
    ],
    pointsPerNight: 150,
  },
  Signature: {
    name: 'Signature',
    threshold: 25001,
    color: CLUB_ROYALE_TIER_COLORS.Signature,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Signature, 0.12),
    benefits: [
      'All Prime benefits',
      'Suite-level amenities',
      'Priority restaurant reservations',
      'Exclusive events',
      'Increased freeplay offers',
    ],
    pointsPerNight: 200,
  },
  Masters: {
    name: 'Masters',
    threshold: 100001,
    color: CLUB_ROYALE_TIER_COLORS.Masters,
    bgColor: withAlpha(CLUB_ROYALE_TIER_COLORS.Masters, 0.15),
    benefits: [
      'All Signature benefits',
      'Complimentary suite upgrades',
      'Personal casino concierge',
      'VIP experiences',
      'Maximum comp value',
    ],
    pointsPerNight: 300,
  },
};

export const TIER_ORDER = ['Choice', 'Prime', 'Signature', 'Masters'];

export function getNextTier(currentTier: string): string | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === TIER_ORDER.length - 1) {
    return null;
  }
  return TIER_ORDER[currentIndex + 1];
}

export function getTierProgress(currentPoints: number, currentTier: string): {
  nextTier: string | null;
  pointsToNext: number;
  percentComplete: number;
} {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) {
    return { nextTier: null, pointsToNext: 0, percentComplete: 100 };
  }

  const currentThreshold = CLUB_ROYALE_TIERS[currentTier]?.threshold || 0;
  const nextThreshold = CLUB_ROYALE_TIERS[nextTier]?.threshold || 0;
  const pointsInRange = currentPoints - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;
  const percentComplete = Math.min(100, Math.max(0, (pointsInRange / rangeSize) * 100));
  const pointsToNext = Math.max(0, nextThreshold - currentPoints);

  return { nextTier, pointsToNext, percentComplete };
}

export function getTierByPoints(points: number): string {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (points >= CLUB_ROYALE_TIERS[tier].threshold) {
      return tier;
    }
  }
  return 'Choice';
}

export function calculateNightsToTier(
  currentPoints: number,
  targetTier: string,
  averagePointsPerNight: number = 150
): number {
  const targetThreshold = CLUB_ROYALE_TIERS[targetTier]?.threshold || 0;
  const pointsNeeded = Math.max(0, targetThreshold - currentPoints);
  return Math.ceil(pointsNeeded / averagePointsPerNight);
}

export function calculateETAToTier(
  currentPoints: number,
  targetTier: string,
  averageNightsPerMonth: number = 7,
  averagePointsPerNight: number = 150
): Date | null {
  const nightsNeeded = calculateNightsToTier(currentPoints, targetTier, averagePointsPerNight);
  if (nightsNeeded === 0) return null;

  const monthsNeeded = nightsNeeded / averageNightsPerMonth;
  const eta = new Date();
  eta.setMonth(eta.getMonth() + Math.ceil(monthsNeeded));
  return eta;
}
