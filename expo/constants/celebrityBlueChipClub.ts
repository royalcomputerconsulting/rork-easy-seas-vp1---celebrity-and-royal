export interface CelebrityBlueChipTierInfo {
  name: string;
  level: number;
  qualifyPoints: number;
  color: string;
  bgColor: string;
  benefits: string[];
  pointsPerNight: number;
}

export const CELEBRITY_BLUE_CHIP_TIERS: Record<string, CelebrityBlueChipTierInfo> = {
  Pearl: {
    name: 'Pearl',
    level: 1,
    qualifyPoints: 1,
    color: '#B9BCC2',
    bgColor: 'rgba(185, 188, 194, 0.18)',
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
    qualifyPoints: 500,
    color: '#2D2F33',
    bgColor: 'rgba(45, 47, 51, 0.16)',
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
    qualifyPoints: 5000,
    color: '#6F2DBD',
    bgColor: 'rgba(111, 45, 189, 0.16)',
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
    qualifyPoints: 15000,
    color: '#2B6FD6',
    bgColor: 'rgba(43, 111, 214, 0.16)',
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
    qualifyPoints: 75000,
    color: '#2E33B7',
    bgColor: 'rgba(46, 51, 183, 0.16)',
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
    qualifyPoints: 150000,
    color: '#C61B22',
    bgColor: 'rgba(198, 27, 34, 0.16)',
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

export function getNextCelebrityTier(currentTier: string): string | null {
  const currentIndex = CELEBRITY_TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === CELEBRITY_TIER_ORDER.length - 1) {
    return null;
  }
  return CELEBRITY_TIER_ORDER[currentIndex + 1];
}

export function getCelebrityBlueChipTierByLevel(level: number): string {
  const tier = CELEBRITY_TIER_ORDER.find(
    tierName => CELEBRITY_BLUE_CHIP_TIERS[tierName].level === level
  );
  return tier || 'Pearl';
}

export function getCelebrityBlueChipTierByPoints(points: number): string {
  for (let i = CELEBRITY_TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = CELEBRITY_TIER_ORDER[i];
    if (points >= CELEBRITY_BLUE_CHIP_TIERS[tier].qualifyPoints) {
      return tier;
    }
  }

  return 'Pearl';
}

export function getCelebrityBlueChipTierInfo(tierName: string): CelebrityBlueChipTierInfo {
  return CELEBRITY_BLUE_CHIP_TIERS[tierName] || CELEBRITY_BLUE_CHIP_TIERS.Pearl;
}
