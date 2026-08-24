export interface CarnivalVifpTierInfo {
  name: string;
  cruiseDays: number;
  color: string;
  bgColor: string;
  benefits: string[];
}

export const CARNIVAL_VIFP_TIERS: Record<string, CarnivalVifpTierInfo> = {
  Blue: {
    name: 'Blue',
    cruiseDays: 0,
    color: '#1E90FF',
    bgColor: 'rgba(30, 144, 255, 0.15)',
    benefits: [
      'VIFP Club membership',
      'Member-only pricing',
      'Fun Points earning',
    ],
  },
  Red: {
    name: 'Red',
    cruiseDays: 25,
    color: '#CC2232',
    bgColor: 'rgba(204, 34, 50, 0.15)',
    benefits: [
      'All Blue benefits',
      'Priority check-in',
      'Exclusive VIFP offers',
      'Special member gifts onboard',
    ],
  },
  Gold: {
    name: 'Gold',
    cruiseDays: 75,
    color: '#D4AF37',
    bgColor: 'rgba(212, 175, 55, 0.15)',
    benefits: [
      'All Red benefits',
      'Priority embarkation & debarkation',
      'Complimentary drink vouchers',
      'Gold VIFP pin',
      'Priority tender tickets',
    ],
  },
  Platinum: {
    name: 'Platinum',
    cruiseDays: 200,
    color: '#E5E4E2',
    bgColor: 'rgba(229, 228, 226, 0.20)',
    benefits: [
      'All Gold benefits',
      'Complimentary laundry service',
      'Priority dining reservations',
      'Platinum VIFP pin',
      'Behind-the-scenes ship tour',
    ],
  },
  Diamond: {
    name: 'Diamond',
    cruiseDays: 500,
    color: '#B9F2FF',
    bgColor: 'rgba(185, 242, 255, 0.15)',
    benefits: [
      'All Platinum benefits',
      'Exclusive Diamond-only events',
      'Complimentary specialty dining',
      'Fresh fruit & cookies delivered',
      'Diamond VIFP pin',
    ],
  },
};

export const CARNIVAL_VIFP_TIER_ORDER = ['Blue', 'Red', 'Gold', 'Platinum', 'Diamond'];

export interface CarnivalPlayersClubTierInfo {
  name: string;
  color: string;
  bgColor: string;
}

export const CARNIVAL_PLAYERS_CLUB_TIERS: Record<string, CarnivalPlayersClubTierInfo> = {
  Blue: {
    name: 'Blue',
    color: '#1E90FF',
    bgColor: 'rgba(30, 144, 255, 0.15)',
  },
  Gold: {
    name: 'Gold',
    color: '#D4AF37',
    bgColor: 'rgba(212, 175, 55, 0.15)',
  },
  Platinum: {
    name: 'Platinum',
    color: '#E5E4E2',
    bgColor: 'rgba(229, 228, 226, 0.20)',
  },
  'Black Card': {
    name: 'Black Card',
    color: '#1C1C1C',
    bgColor: 'rgba(28, 28, 28, 0.20)',
  },
};

export const CARNIVAL_PLAYERS_TIER_ORDER = ['Blue', 'Gold', 'Platinum', 'Black Card'];

export function getCarnivalVifpTierByDays(days: number): string {
  for (let i = CARNIVAL_VIFP_TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = CARNIVAL_VIFP_TIER_ORDER[i];
    if (days >= CARNIVAL_VIFP_TIERS[tier].cruiseDays) {
      return tier;
    }
  }
  return 'Blue';
}

export function getNextCarnivalVifpTier(currentTier: string): string | null {
  const currentIndex = CARNIVAL_VIFP_TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === CARNIVAL_VIFP_TIER_ORDER.length - 1) {
    return null;
  }
  return CARNIVAL_VIFP_TIER_ORDER[currentIndex + 1];
}

export function getCarnivalVifpTierProgress(currentDays: number, currentTier: string): {
  nextTier: string | null;
  daysToNext: number;
  percentComplete: number;
} {
  const nextTier = getNextCarnivalVifpTier(currentTier);
  if (!nextTier) {
    return { nextTier: null, daysToNext: 0, percentComplete: 100 };
  }

  const currentThreshold = CARNIVAL_VIFP_TIERS[currentTier]?.cruiseDays || 0;
  const nextThreshold = CARNIVAL_VIFP_TIERS[nextTier]?.cruiseDays || 0;
  const daysInRange = currentDays - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;
  const percentComplete = Math.min(100, Math.max(0, (daysInRange / rangeSize) * 100));
  const daysToNext = Math.max(0, nextThreshold - currentDays);

  return { nextTier, daysToNext, percentComplete };
}
