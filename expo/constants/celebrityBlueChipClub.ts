import { BLUE_CHIP_CLUB_TIER_COLORS, withAlpha } from '@/constants/loyaltyColors';

export interface CelebrityBlueChipTierInfo {
  name: string;
  level: number;
  qualifyingPoints: number;
  color: string;
  bgColor: string;
  benefits: string[];
  pointsPerNight: number;
}

export const CELEBRITY_BLUE_CHIP_TIERS: Record<string, CelebrityBlueChipTierInfo> = {
  Pearl: {
    name: 'Pearl',
    level: 1,
    qualifyingPoints: 1,
    color: BLUE_CHIP_CLUB_TIER_COLORS.Pearl,
    bgColor: withAlpha(BLUE_CHIP_CLUB_TIER_COLORS.Pearl, 0.18),
    benefits: [
      'Basic casino privileges',
      'Access to Blue Chip Club lounge',
      'Tier credits and reward points',
    ],
    pointsPerNight: 100,
  },
  Onyx: {
    name: 'Onyx',
    level: 2,
    qualifyingPoints: 2_500,
    color: BLUE_CHIP_CLUB_TIER_COLORS.Onyx,
    bgColor: withAlpha(BLUE_CHIP_CLUB_TIER_COLORS.Onyx, 0.15),
    benefits: [
      'All Pearl benefits',
      'Priority boarding',
      'Enhanced casino offers',
      'Dedicated casino host',
    ],
    pointsPerNight: 125,
  },
  Amethyst: {
    name: 'Amethyst',
    level: 3,
    qualifyingPoints: 25_000,
    color: BLUE_CHIP_CLUB_TIER_COLORS.Amethyst,
    bgColor: withAlpha(BLUE_CHIP_CLUB_TIER_COLORS.Amethyst, 0.15),
    benefits: [
      'All Onyx benefits',
      'Complimentary specialty dining',
      'Priority restaurant reservations',
      'Exclusive events access',
    ],
    pointsPerNight: 150,
  },
  Sapphire: {
    name: 'Sapphire',
    level: 4,
    qualifyingPoints: 100_000,
    color: BLUE_CHIP_CLUB_TIER_COLORS.Sapphire,
    bgColor: withAlpha(BLUE_CHIP_CLUB_TIER_COLORS.Sapphire, 0.15),
    benefits: [
      'All Amethyst benefits',
      'Suite-level amenities',
      'Enhanced freeplay offers',
      'VIP lounge access',
    ],
    pointsPerNight: 200,
  },
  'Sapphire Plus': {
    name: 'Sapphire Plus',
    level: 5,
    qualifyingPoints: 500_000,
    color: BLUE_CHIP_CLUB_TIER_COLORS['Sapphire Plus'],
    bgColor: withAlpha(BLUE_CHIP_CLUB_TIER_COLORS['Sapphire Plus'], 0.15),
    benefits: [
      'All Sapphire benefits',
      'Complimentary cabin upgrades',
      'Priority departure lounge',
      'Exclusive VIP experiences',
    ],
    pointsPerNight: 250,
  },
  Ruby: {
    name: 'Ruby',
    level: 6,
    qualifyingPoints: 1_000_000,
    color: BLUE_CHIP_CLUB_TIER_COLORS.Ruby,
    bgColor: withAlpha(BLUE_CHIP_CLUB_TIER_COLORS.Ruby, 0.15),
    benefits: [
      'All Sapphire Plus benefits',
      'Complimentary suite upgrades',
      'Personal casino concierge',
      'Premium VIP experiences',
      'Maximum comp value',
    ],
    pointsPerNight: 300,
  },
};

export const CELEBRITY_TIER_ORDER = ['Pearl', 'Onyx', 'Amethyst', 'Sapphire', 'Sapphire Plus', 'Ruby'];

export function normalizeCelebrityBlueChipTier(tier: string | null | undefined): string | null {
  const normalized = String(tier ?? '')
    .trim()
    .toLowerCase()
    .replace(/[+_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized) return null;
  return CELEBRITY_TIER_ORDER.find((candidate) => candidate.toLowerCase() === normalized) ?? null;
}

export function getCelebrityBlueChipTierByPoints(points: number): string {
  const safePoints = Math.max(0, Number.isFinite(points) ? points : 0);
  for (let index = CELEBRITY_TIER_ORDER.length - 1; index >= 0; index -= 1) {
    const tier = CELEBRITY_TIER_ORDER[index];
    if (safePoints >= CELEBRITY_BLUE_CHIP_TIERS[tier].qualifyingPoints) return tier;
  }
  // The app models an enrolled zero-balance member as Pearl rather than
  // inventing an unsupported seventh "None" tier.
  return 'Pearl';
}

export interface CelebrityBlueChipStatus {
  earnedTier: string;
  reportedTier: string | null;
  effectiveTier: string;
  isReportedTierRetained: boolean;
}

export function getCelebrityBlueChipStatus(
  points: number,
  reportedTier?: string | null,
): CelebrityBlueChipStatus {
  const earnedTier = getCelebrityBlueChipTierByPoints(points);
  const normalizedReportedTier = normalizeCelebrityBlueChipTier(reportedTier);
  const earnedIndex = CELEBRITY_TIER_ORDER.indexOf(earnedTier);
  const reportedIndex = normalizedReportedTier ? CELEBRITY_TIER_ORDER.indexOf(normalizedReportedTier) : -1;
  const effectiveTier = reportedIndex > earnedIndex ? normalizedReportedTier! : earnedTier;
  return {
    earnedTier,
    reportedTier: normalizedReportedTier,
    effectiveTier,
    isReportedTierRetained: reportedIndex > earnedIndex,
  };
}

export function getCelebrityBlueChipProgress(points: number, earnedTier?: string | null): {
  nextTier: string | null;
  pointsToNext: number;
  percentComplete: number;
} {
  const safePoints = Math.max(0, Number.isFinite(points) ? points : 0);
  const normalizedEarned = normalizeCelebrityBlueChipTier(earnedTier) ?? getCelebrityBlueChipTierByPoints(safePoints);
  const nextTier = getNextCelebrityTier(normalizedEarned);
  if (!nextTier) return { nextTier: null, pointsToNext: 0, percentComplete: 100 };
  const currentThreshold = CELEBRITY_BLUE_CHIP_TIERS[normalizedEarned].qualifyingPoints;
  const nextThreshold = CELEBRITY_BLUE_CHIP_TIERS[nextTier].qualifyingPoints;
  const range = Math.max(1, nextThreshold - currentThreshold);
  const percentComplete = Math.min(100, Math.max(0, ((safePoints - currentThreshold) / range) * 100));
  return {
    nextTier,
    pointsToNext: Math.max(0, nextThreshold - safePoints),
    percentComplete,
  };
}

export function getNextCelebrityTier(currentTier: string): string | null {
  const currentIndex = CELEBRITY_TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === CELEBRITY_TIER_ORDER.length - 1) {
    return null;
  }
  return CELEBRITY_TIER_ORDER[currentIndex + 1];
}

export function getCelebrityBlueChipTierByLevel(level: number): string {
  const tier = CELEBRITY_TIER_ORDER.find(
    (tierName) => CELEBRITY_BLUE_CHIP_TIERS[tierName].level === level
  );
  return tier || 'Pearl';
}

export function getCelebrityBlueChipTierInfo(tierName: string): CelebrityBlueChipTierInfo {
  return CELEBRITY_BLUE_CHIP_TIERS[tierName] || CELEBRITY_BLUE_CHIP_TIERS.Pearl;
}
