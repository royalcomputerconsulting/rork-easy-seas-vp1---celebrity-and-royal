export interface SilverseaVenetianTierInfo {
  name: string;
  cruiseDays: number;
  color: string;
  bgColor: string;
  benefits: string[];
}

export const SILVERSEA_VENETIAN_TIERS: Record<string, SilverseaVenetianTierInfo> = {
  '1 VS Day': {
    name: '1 VS Day',
    cruiseDays: 1,
    color: '#8C5A3C',
    bgColor: 'rgba(140, 90, 60, 0.14)',
    benefits: [
      'Pre-sale access to new itineraries',
      'Access to Venetian Society events on reunion voyage',
      '5% off Venetian Society sailings',
    ],
  },
  '100 VS Days': {
    name: '100 VS Days',
    cruiseDays: 100,
    color: '#A87345',
    bgColor: 'rgba(168, 115, 69, 0.16)',
    benefits: [
      'All 1 VS Day benefits',
      '5% Venetian Society member savings on all future sailings',
      'Complimentary laundry & pressing',
    ],
  },
  '250 VS Days': {
    name: '250 VS Days',
    cruiseDays: 250,
    color: '#C18E52',
    bgColor: 'rgba(193, 142, 82, 0.16)',
    benefits: [
      'All 100 VS Days benefits',
      '10% Venetian Society member savings on all future sailings',
      'Upgrade Champagne Welcome in Suite',
    ],
  },
  '350 VS Days': {
    name: '350 VS Days',
    cruiseDays: 350,
    color: '#7C5A37',
    bgColor: 'rgba(124, 90, 55, 0.18)',
    benefits: [
      'All 250 VS Days benefits',
      'Complimentary laundry & pressing',
      'Complimentary 7-day cruise',
    ],
  },
  '500 VS Days': {
    name: '500 VS Days',
    cruiseDays: 500,
    color: '#5A3723',
    bgColor: 'rgba(90, 55, 35, 0.2)',
    benefits: [
      'All 350 VS Days benefits',
      'Complimentary laundry & pressing',
      'Complimentary 14-day cruise',
    ],
  },
};

export const SILVERSEA_TIER_ORDER = ['1 VS Day', '100 VS Days', '250 VS Days', '350 VS Days', '500 VS Days'];

const SILVERSEA_TIER_ALIASES: Record<string, string> = {
  member: '1 VS Day',
  silver: '100 VS Days',
  gold: '250 VS Days',
  platinum: '350 VS Days',
  diamond: '500 VS Days',
  'diamond elite': '500 VS Days',
  '1 vs day': '1 VS Day',
  '1 vs days': '1 VS Day',
  '100 vs day': '100 VS Days',
  '100 vs days': '100 VS Days',
  '250 vs day': '250 VS Days',
  '250 vs days': '250 VS Days',
  '350 vs day': '350 VS Days',
  '350 vs days': '350 VS Days',
  '500 vs day': '500 VS Days',
  '500 vs days': '500 VS Days',
};

export function resolveSilverseaTierKey(tierName: string | undefined | null): string {
  if (!tierName) {
    return '1 VS Day';
  }

  const normalized = tierName
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');

  return SILVERSEA_TIER_ALIASES[normalized] || tierName;
}

export function getSilverseaTierByDays(days: number): string {
  for (let i = SILVERSEA_TIER_ORDER.length - 1; i >= 0; i -= 1) {
    const tier = SILVERSEA_TIER_ORDER[i];
    if (days >= SILVERSEA_VENETIAN_TIERS[tier].cruiseDays) {
      return tier;
    }
  }

  return '1 VS Day';
}

export function getNextSilverseaTier(currentTier: string): string | null {
  const resolvedTier = resolveSilverseaTierKey(currentTier);
  const currentIndex = SILVERSEA_TIER_ORDER.indexOf(resolvedTier);
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
  const resolvedTier = resolveSilverseaTierKey(currentTier);
  const nextTier = getNextSilverseaTier(resolvedTier);
  if (!nextTier) {
    return { nextTier: null, daysToNext: 0, percentComplete: 100 };
  }

  const currentThreshold = SILVERSEA_VENETIAN_TIERS[resolvedTier]?.cruiseDays || 0;
  const nextThreshold = SILVERSEA_VENETIAN_TIERS[nextTier]?.cruiseDays || 0;
  const daysInRange = currentDays - currentThreshold;
  const rangeSize = Math.max(1, nextThreshold - currentThreshold);
  const percentComplete = Math.min(100, Math.max(0, (daysInRange / rangeSize) * 100));
  const daysToNext = Math.max(0, nextThreshold - currentDays);

  return { nextTier, daysToNext, percentComplete };
}
