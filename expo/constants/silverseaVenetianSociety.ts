export interface SilverseaVenetianTierInfo {
  name: string;
  cruiseDays: number;
  color: string;
  bgColor: string;
  benefits: string[];
}

export const SILVERSEA_VENETIAN_TIERS: Record<string, SilverseaVenetianTierInfo> = {
  Member: {
    name: 'Member',
    cruiseDays: 0,
    color: '#708090',
    bgColor: 'rgba(112, 128, 144, 0.15)',
    benefits: [
      'Venetian Society membership',
      'Exclusive member savings',
      'Priority notification of new voyages',
    ],
  },
  Silver: {
    name: 'Silver',
    cruiseDays: 50,
    color: '#C0C0C0',
    bgColor: 'rgba(192, 192, 192, 0.15)',
    benefits: [
      'All Member benefits',
      '5% savings on select voyages',
      'Complimentary pressing service',
      'Venetian Society events onboard',
    ],
  },
  Gold: {
    name: 'Gold',
    cruiseDays: 100,
    color: '#D4AF37',
    bgColor: 'rgba(212, 175, 55, 0.15)',
    benefits: [
      'All Silver benefits',
      '10% savings on select voyages',
      'Complimentary specialty dining',
      'Private Venetian Society shore event',
    ],
  },
  Platinum: {
    name: 'Platinum',
    cruiseDays: 200,
    color: '#E5E4E2',
    bgColor: 'rgba(229, 228, 226, 0.20)',
    benefits: [
      'All Gold benefits',
      '15% savings on select voyages',
      'Complimentary spa treatment',
      'Priority suite upgrades',
    ],
  },
  Diamond: {
    name: 'Diamond',
    cruiseDays: 350,
    color: '#B9F2FF',
    bgColor: 'rgba(185, 242, 255, 0.15)',
    benefits: [
      'All Platinum benefits',
      '20% savings on select voyages',
      'Complimentary shore excursion',
      'Exclusive Diamond reception with Captain',
    ],
  },
  'Diamond Elite': {
    name: 'Diamond Elite',
    cruiseDays: 500,
    color: '#0097A7',
    bgColor: 'rgba(0, 151, 167, 0.15)',
    benefits: [
      'All Diamond benefits',
      '25% savings on select voyages',
      'Complimentary suite upgrade guarantee',
      'Annual voyage gift',
      'Personal voyage consultant',
    ],
  },
};

export const SILVERSEA_TIER_ORDER = ['Member', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Diamond Elite'];

export function getSilverseaTierByDays(days: number): string {
  for (let i = SILVERSEA_TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = SILVERSEA_TIER_ORDER[i];
    if (days >= SILVERSEA_VENETIAN_TIERS[tier].cruiseDays) {
      return tier;
    }
  }
  return 'Member';
}

export function getNextSilverseaTier(currentTier: string): string | null {
  const currentIndex = SILVERSEA_TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === SILVERSEA_TIER_ORDER.length - 1) {
    return null;
  }
  return SILVERSEA_TIER_ORDER[currentIndex + 1];
}

export function getSilverseaTierProgress(currentDays: number, currentTier: string): {
  nextTier: string | null;
  daysToNext: number;
  percentComplete: number;
} {
  const nextTier = getNextSilverseaTier(currentTier);
  if (!nextTier) {
    return { nextTier: null, daysToNext: 0, percentComplete: 100 };
  }

  const currentThreshold = SILVERSEA_VENETIAN_TIERS[currentTier]?.cruiseDays || 0;
  const nextThreshold = SILVERSEA_VENETIAN_TIERS[nextTier]?.cruiseDays || 0;
  const daysInRange = currentDays - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;
  const percentComplete = Math.min(100, Math.max(0, (daysInRange / rangeSize) * 100));
  const daysToNext = Math.max(0, nextThreshold - currentDays);

  return { nextTier, daysToNext, percentComplete };
}
