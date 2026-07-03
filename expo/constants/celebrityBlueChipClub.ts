import { BLUE_CHIP_CLUB_TIER_COLORS, withAlpha } from '@/constants/loyaltyColors';

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
