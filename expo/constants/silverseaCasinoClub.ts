export interface SilverseaCasinoTierInfo {
  name: string;
  level: number;
  qualifyPoints: number;
  approximateCoinInDollars: number;
  color: string;
  bgColor: string;
  benefits: string[];
}

export const SILVERSEA_CASINO_TIERS: Record<string, SilverseaCasinoTierInfo> = {
  'Rock Star': {
    name: 'Rock Star',
    level: 1,
    qualifyPoints: 0,
    approximateCoinInDollars: 0,
    color: '#2F2F34',
    bgColor: 'rgba(47, 47, 52, 0.16)',
    benefits: [
      'Base Silversea players card tier',
      'Automatic starting tier after enrollment',
      'Earn qualifying points toward the next milestone',
    ],
  },
  'Hall of Fame': {
    name: 'Hall of Fame',
    level: 2,
    qualifyPoints: 15000,
    approximateCoinInDollars: 45000,
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.16)',
    benefits: [
      'Reached at 15,000 qualifying points',
      'Approx. $45,000 slot coin-in based on $3 per point',
      'Mid-tier Rock Star status milestone',
    ],
  },
  Legend: {
    name: 'Legend',
    level: 3,
    qualifyPoints: 50000,
    approximateCoinInDollars: 150000,
    color: '#D4A017',
    bgColor: 'rgba(212, 160, 23, 0.18)',
    benefits: [
      'Reached at 50,000 qualifying points',
      'Approx. $150,000 slot coin-in based on $3 per point',
      'Upper-tier Rock Star status milestone',
    ],
  },
  Icon: {
    name: 'Icon',
    level: 4,
    qualifyPoints: 100000,
    approximateCoinInDollars: 300000,
    color: '#D9E1EA',
    bgColor: 'rgba(217, 225, 234, 0.20)',
    benefits: [
      'Reached at 100,000 qualifying points',
      'Approx. $300,000 slot coin-in based on $3 per point',
      'Top Rock Star casino tier',
    ],
  },
};

export const SILVERSEA_CASINO_TIER_ORDER = ['Rock Star', 'Hall of Fame', 'Legend', 'Icon'];

const SILVERSEA_CASINO_TIER_ALIASES: Record<string, string> = {
  rockstar: 'Rock Star',
  'rock star': 'Rock Star',
  halloffame: 'Hall of Fame',
  'hall of fame': 'Hall of Fame',
  legend: 'Legend',
  icon: 'Icon',
};

export function resolveSilverseaCasinoTierKey(tierName: string | undefined | null): string {
  if (!tierName) {
    return 'Rock Star';
  }

  const normalized = tierName
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');

  return SILVERSEA_CASINO_TIER_ALIASES[normalized] || tierName;
}

export function getSilverseaCasinoTierByPoints(points: number): string {
  for (let i = SILVERSEA_CASINO_TIER_ORDER.length - 1; i >= 0; i -= 1) {
    const tier = SILVERSEA_CASINO_TIER_ORDER[i];
    if (points >= SILVERSEA_CASINO_TIERS[tier].qualifyPoints) {
      return tier;
    }
  }

  return 'Rock Star';
}

export function getNextSilverseaCasinoTier(currentTier: string): string | null {
  const resolvedTier = resolveSilverseaCasinoTierKey(currentTier);
  const currentIndex = SILVERSEA_CASINO_TIER_ORDER.indexOf(resolvedTier);
  if (currentIndex === -1 || currentIndex === SILVERSEA_CASINO_TIER_ORDER.length - 1) {
    return null;
  }
  return SILVERSEA_CASINO_TIER_ORDER[currentIndex + 1];
}

export function getSilverseaCasinoTierInfo(tierName: string): SilverseaCasinoTierInfo {
  return SILVERSEA_CASINO_TIERS[resolveSilverseaCasinoTierKey(tierName)] || SILVERSEA_CASINO_TIERS['Rock Star'];
}
