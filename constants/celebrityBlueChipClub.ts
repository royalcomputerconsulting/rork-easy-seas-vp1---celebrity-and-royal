export interface CelebrityBlueChipTierInfo {
  name: string;
  level: number;
  color: string;
  bgColor: string;
  benefits: string[];
  pointsPerNight: number;
}

export const CELEBRITY_BLUE_CHIP_TIERS: Record<string, CelebrityBlueChipTierInfo> = {
  Pearl: {
    name: 'Pearl',
    level: 1,
    color: '#1C1C1C',
    bgColor: 'rgba(240, 234, 214, 0.15)',
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
    color: '#353839',
    bgColor: 'rgba(53, 56, 57, 0.15)',
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
    color: '#9966CC',
    bgColor: 'rgba(153, 102, 204, 0.15)',
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
    color: '#0F52BA',
    bgColor: 'rgba(15, 82, 186, 0.15)',
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
    color: '#0067A5',
    bgColor: 'rgba(0, 103, 165, 0.15)',
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
    color: '#E0115F',
    bgColor: 'rgba(224, 17, 95, 0.15)',
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

export function getCelebrityBlueChipTierInfo(tierName: string): CelebrityBlueChipTierInfo {
  return CELEBRITY_BLUE_CHIP_TIERS[tierName] || CELEBRITY_BLUE_CHIP_TIERS.Pearl;
}
