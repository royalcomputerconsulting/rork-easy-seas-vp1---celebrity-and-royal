export interface CrownAnchorLevelInfo {
  name: string;
  cruiseNights: number;
  color: string;
  bgColor: string;
  benefits: string[];
}

export const CROWN_ANCHOR_LEVELS: Record<string, CrownAnchorLevelInfo> = {
  Gold: {
    name: 'Gold',
    cruiseNights: 1,
    color: '#D4AF37',
    bgColor: 'rgba(212, 175, 55, 0.15)',
    benefits: [
      'Crown & Anchor Society welcome',
      'Member savings on future cruises',
      'Members-only rates and offers',
    ],
  },
  Platinum: {
    name: 'Platinum',
    cruiseNights: 30,
    color: '#B8C0CC',
    bgColor: 'rgba(184, 192, 204, 0.18)',
    benefits: [
      'All Gold benefits',
      'Priority check-in',
      'Robes in stateroom',
      'Access to Diamond events when available',
    ],
  },
  Emerald: {
    name: 'Emerald',
    cruiseNights: 55,
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    benefits: [
      'All Platinum benefits',
      'Complimentary laundry service',
      'Complimentary premium photo',
      'Priority tender tickets',
    ],
  },
  Diamond: {
    name: 'Diamond',
    cruiseNights: 80,
    color: '#7DD3FC',
    bgColor: 'rgba(125, 211, 252, 0.18)',
    benefits: [
      'All Emerald benefits',
      'Behind-the-scenes tour',
      'Exclusive Diamond events',
      'Priority departure lounge access',
      'Complimentary pressing',
    ],
  },
  'Diamond Plus': {
    name: 'Diamond Plus',
    cruiseNights: 175,
    color: '#7B2D8E',
    bgColor: 'rgba(123, 45, 142, 0.14)',
    benefits: [
      'All Diamond benefits',
      'Four complimentary beverages per day',
      'Access to Suite Lounge',
      'Complimentary mini-bar setup',
    ],
  },
  Pinnacle: {
    name: 'Pinnacle Club',
    cruiseNights: 700,
    color: '#173B6C',
    bgColor: 'rgba(23, 59, 108, 0.16)',
    benefits: [
      'All Diamond Plus benefits',
      'Annual Pinnacle cruise experience',
      'Complimentary specialty dining',
      'Unlimited internet access',
      'Priority access for new itineraries',
    ],
  },
};

export const LEVEL_ORDER = ['Gold', 'Platinum', 'Emerald', 'Diamond', 'Diamond Plus', 'Pinnacle'];

export function getNextLevel(currentLevel: string): string | null {
  const currentIndex = LEVEL_ORDER.indexOf(currentLevel);
  if (currentIndex === -1 || currentIndex === LEVEL_ORDER.length - 1) {
    return null;
  }
  return LEVEL_ORDER[currentIndex + 1];
}

export function getLevelProgress(totalNights: number, currentLevel: string): {
  nextLevel: string | null;
  nightsToNext: number;
  percentComplete: number;
} {
  const nextLevel = getNextLevel(currentLevel);
  if (!nextLevel) {
    return { nextLevel: null, nightsToNext: 0, percentComplete: 100 };
  }

  const currentThreshold = CROWN_ANCHOR_LEVELS[currentLevel]?.cruiseNights || 0;
  const nextThreshold = CROWN_ANCHOR_LEVELS[nextLevel]?.cruiseNights || 0;
  const nightsInRange = totalNights - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;
  const percentComplete = Math.min(100, Math.max(0, (nightsInRange / rangeSize) * 100));
  const nightsToNext = Math.max(0, nextThreshold - totalNights);

  return { nextLevel, nightsToNext, percentComplete };
}

export function getLevelByNights(nights: number): string {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    const level = LEVEL_ORDER[i];
    if (nights >= CROWN_ANCHOR_LEVELS[level].cruiseNights) {
      return level;
    }
  }
  return 'Gold';
}

export function calculateNightsToPinnacle(currentNights: number): number {
  const pinnacleThreshold = CROWN_ANCHOR_LEVELS.Pinnacle.cruiseNights;
  return Math.max(0, pinnacleThreshold - currentNights);
}

export function calculateETAToPinnacle(
  currentNights: number,
  averageNightsPerMonth: number = 7
): Date | null {
  const nightsNeeded = calculateNightsToPinnacle(currentNights);
  if (nightsNeeded === 0) return null;
  
  const monthsNeeded = nightsNeeded / averageNightsPerMonth;
  const eta = new Date();
  eta.setMonth(eta.getMonth() + Math.ceil(monthsNeeded));
  return eta;
}
